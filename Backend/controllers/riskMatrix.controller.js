import AssetRegister from '../models/assetRegisterManagement.model.js';
import Organisation from '../models/organisation.model.js';
import { getAlertsService } from '../services/wazuhService.js';
import { EncryptionUtils } from '../utils/security.util.js';

/**
 * Calculate 3D Risk Matrix Data
 * Dimensions:
 * - Severity: Wazuh rule level (8-15) normalized to 1-8
 * - Likelihood: Alert frequency per rule group, normalized to 1-10
 * - Impact: Asset criticality (low=1, medium=2, high=3, critical=4)
 */
export const getRiskMatrixData = async (req, res) => {
  try {
    const { organisation_id, time_period_hours = 24 } = req.query;

    if (!organisation_id) {
      return res.status(400).json({
        success: false,
        message: 'Organisation ID is required'
      });
    }

    console.log('🔍 [RISK MATRIX] Fetching data for organisation:', organisation_id);
    console.log('🔍 [RISK MATRIX] Time period (hours):', time_period_hours);

    // Step 1: Get organisation credentials
    const organisation = await Organisation.findById(organisation_id)
      .select('+wazuh_indexer_username +wazuh_indexer_password');

    if (!organisation) {
      return res.status(404).json({
        success: false,
        message: 'Organisation not found'
      });
    }

    if (!organisation.wazuh_indexer_ip || !organisation.wazuh_indexer_username || !organisation.wazuh_indexer_password) {
      return res.status(404).json({
        success: false,
        message: 'Wazuh indexer credentials not configured for this organisation'
      });
    }

    // Decrypt indexer password if encrypted
    let indexerPassword;
    if (typeof organisation.wazuh_indexer_password === 'object' && organisation.wazuh_indexer_password.encrypted) {
      try {
        indexerPassword = EncryptionUtils.decrypt(organisation.wazuh_indexer_password);
        console.log('🔓 [RISK MATRIX] Decrypted Wazuh indexer password');
      } catch (decryptError) {
        console.error('❌ [RISK MATRIX] Failed to decrypt Wazuh indexer password:', decryptError.message);
        return res.status(500).json({
          success: false,
          message: 'Failed to decrypt Wazuh credentials'
        });
      }
    } else {
      indexerPassword = organisation.wazuh_indexer_password;
      console.log('⚠️  [RISK MATRIX] Using plain text password (legacy format)');
    }

    // Step 2: Fetch alerts from Wazuh
    const hoursAgo = parseInt(time_period_hours);

    const indexerCredentials = {
      host: `https://${organisation.wazuh_indexer_ip}:${organisation.wazuh_indexer_port || 9200}`,
      username: organisation.wazuh_indexer_username,
      password: indexerPassword
    };

    const alertsResponse = await getAlertsService(indexerCredentials, {}, organisation_id);
    const allAlerts = alertsResponse.alerts || [];

    console.log('📊 [RISK MATRIX] Total alerts fetched from Wazuh:', allAlerts.length);

    // Filter alerts by time period
    const now = new Date();
    const startTime = new Date(now.getTime() - hoursAgo * 60 * 60 * 1000);

    console.log('🕒 [RISK MATRIX] Time range:', {
      start: startTime.toISOString(),
      end: now.toISOString(),
      hours: hoursAgo
    });

    // For debugging, log first alert timestamp if available
    if (allAlerts.length > 0) {
      const firstAlert = allAlerts[0];
      console.log('📅 [RISK MATRIX] First alert time:', firstAlert.time || firstAlert['@timestamp']);
      console.log('📅 [RISK MATRIX] First alert rule groups:', firstAlert.rule_groups || firstAlert.rule?.groups);
    }

    const alerts = allAlerts.filter(alert => {
      const alertTime = new Date(alert.time || alert['@timestamp']);
      return alertTime >= startTime && alertTime <= now;
    });

    console.log('📊 [RISK MATRIX] Alerts in time period:', alerts.length);

    // If no alerts in time period, use all recent alerts instead
    const alertsToProcess = alerts.length > 0 ? alerts : allAlerts.slice(0, 100);
    console.log('📊 [RISK MATRIX] Alerts to process:', alertsToProcess.length);

    // Step 2: Fetch assets for impact calculation
    const assets = await AssetRegister.find({
      organisation_id,
      is_deleted: false
    }).select('wazuh_agent_id asset_criticality');

    console.log('🏢 [RISK MATRIX] Total assets found:', assets.length);

    // Create agent ID to criticality map
    const agentCriticalityMap = {};
    assets.forEach(asset => {
      if (asset.wazuh_agent_id) {
        agentCriticalityMap[asset.wazuh_agent_id] = asset.asset_criticality;
      }
    });

    // Step 3: Group alerts by rule.groups and calculate metrics
    const ruleGroupMetrics = {};

    if (alertsToProcess && alertsToProcess.length > 0) {
      alertsToProcess.forEach(alert => {
        const severity = alert.severity || alert.rule?.level || 1;
        const ruleGroups = alert.rule_groups || alert.rule?.groups?.[0] || 'unknown';
        const agentId = alert.agent_id || alert.agent?.id || null;

        // Initialize rule group if not exists
        if (!ruleGroupMetrics[ruleGroups]) {
          ruleGroupMetrics[ruleGroups] = {
            alertCount: 0,
            totalSeverity: 0,
            maxSeverity: 0,
            agentIds: new Set(),
            assetCriticalities: []
          };
        }

        const metric = ruleGroupMetrics[ruleGroups];
        metric.alertCount++;
        metric.totalSeverity += severity;
        metric.maxSeverity = Math.max(metric.maxSeverity, severity);

        if (agentId) {
          metric.agentIds.add(agentId);
          const criticality = agentCriticalityMap[agentId];
          if (criticality) {
            metric.assetCriticalities.push(criticality);
          }
        }
      });
    }

    console.log('📈 [RISK MATRIX] Rule groups analyzed:', Object.keys(ruleGroupMetrics).length);

    // Step 4: Calculate 3D risk matrix data
    const riskMatrixData = [];

    Object.entries(ruleGroupMetrics).forEach(([ruleGroup, metrics]) => {
      // Severity: Use max severity from alerts (8-15 range for Wazuh)
      const rawSeverity = Math.min(15, Math.max(8, metrics.maxSeverity));
      const normalizedSeverity = rawSeverity - 7; // Convert 8-15 to 1-8

      // Likelihood: Calculate based on alert count with logarithmic scaling
      // This provides consistent likelihood regardless of time period
      // Using log scale: 1 alert = 1, 10 alerts = 2, 100 alerts = 3, etc.
      const normalizedLikelihood = metrics.alertCount === 0
        ? 1
        : Math.min(10, Math.ceil(Math.log10(metrics.alertCount) * 2) + 1);

      // Impact: Calculate from asset criticalities
      const criticalityToScore = { low: 1, medium: 2, high: 3, critical: 4 };
      let impactScore = 1; // Default low impact

      if (metrics.assetCriticalities.length > 0) {
        // Use the highest criticality among affected assets
        const criticalityScores = metrics.assetCriticalities.map(c => criticalityToScore[c] || 1);
        impactScore = Math.max(...criticalityScores);
      }

      // Calculate overall risk score
      const riskScore = normalizedSeverity * normalizedLikelihood * impactScore;
      const maxRiskScore = 8 * 10 * 4; // Max possible: 320
      const riskPercentage = Math.round((riskScore / maxRiskScore) * 100);

      // Determine risk category
      let category = 'Low';
      if (riskPercentage >= 75) category = 'Critical';
      else if (riskPercentage >= 50) category = 'High';
      else if (riskPercentage >= 25) category = 'Medium';

      riskMatrixData.push({
        ruleGroup,
        severity: normalizedSeverity,
        rawSeverity,
        likelihood: normalizedLikelihood,
        impact: impactScore,
        impactLabel: Object.keys(criticalityToScore).find(k => criticalityToScore[k] === impactScore) || 'low',
        riskScore,
        riskPercentage,
        category,
        alertCount: metrics.alertCount,
        affectedAssets: metrics.agentIds.size
      });
    });

    // Sort by risk score descending
    riskMatrixData.sort((a, b) => b.riskScore - a.riskScore);

    console.log('✅ [RISK MATRIX] Risk matrix data prepared, items:', riskMatrixData.length);

    // Step 5: Calculate summary statistics
    const summary = {
      totalAlerts: alertsToProcess?.length || 0,
      totalAlertsInPeriod: alerts?.length || 0,
      totalRuleGroups: riskMatrixData.length,
      criticalRisk: riskMatrixData.filter(item => item.category === 'Critical').length,
      highRisk: riskMatrixData.filter(item => item.category === 'High').length,
      mediumRisk: riskMatrixData.filter(item => item.category === 'Medium').length,
      lowRisk: riskMatrixData.filter(item => item.category === 'Low').length,
      totalAssets: assets.length,
      timePeriodHours: hoursAgo,
      usingFallbackData: alerts.length === 0 && allAlerts.length > 0
    };

    res.json({
      success: true,
      data: {
        matrix: riskMatrixData,
        summary
      }
    });

  } catch (error) {
    console.error('❌ [RISK MATRIX] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to calculate risk matrix data',
      error: error.message
    });
  }
};

/**
 * Get 3D Risk Matrix visualization data
 * Returns data formatted for 3D scatter plot
 */
export const get3DRiskMatrix = async (req, res) => {
  try {
    const { organisation_id, time_period_hours = 24 } = req.query;

    if (!organisation_id) {
      return res.status(400).json({
        success: false,
        message: 'Organisation ID is required'
      });
    }

    // Reuse the main risk matrix calculation
    await getRiskMatrixData(req, res);

  } catch (error) {
    console.error('❌ [3D RISK MATRIX] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to calculate 3D risk matrix data',
      error: error.message
    });
  }
};

import Organisation from '../models/organisation.model.js';
import { Ticket } from '../models/ticket.model.js';
import { getAlertsService } from '../services/wazuhService.js';
import { EncryptionUtils } from '../utils/security.util.js';

/**
 * Get Security Metrics Dashboard Data
 * - Threats Blocked: Count total alerts by severity level
 * - Incidents Closed: Count tickets with status 'closed' in time period
 * - MTTR: Mean Time to Response/Resolution
 * - Active Threats: Unique rule groups triggering alerts
 * - Top Attack Types: Most common rule groups
 * - Response Rate: % of tickets closed vs opened
 */
export const getSecurityMetrics = async (req, res) => {
  try {
    const { organisation_id, time_period_hours = 24 } = req.query;

    if (!organisation_id) {
      return res.status(400).json({
        success: false,
        message: 'Organisation ID is required'
      });
    }

    console.log('📊 [SECURITY METRICS] Fetching data for organisation:', organisation_id);
    console.log('📊 [SECURITY METRICS] Time period (hours):', time_period_hours);

    const hoursAgo = parseInt(time_period_hours);
    const now = new Date();
    const startTime = new Date(now.getTime() - hoursAgo * 60 * 60 * 1000);

    // Step 1: Fetch organisation credentials
    const organisation = await Organisation.findById(organisation_id)
      .select('+wazuh_indexer_username +wazuh_indexer_password');

    if (!organisation) {
      return res.status(404).json({
        success: false,
        message: 'Organisation not found'
      });
    }

    // Decrypt indexer password if encrypted
    let indexerPassword;
    if (typeof organisation.wazuh_indexer_password === 'object' && organisation.wazuh_indexer_password.encrypted) {
      indexerPassword = EncryptionUtils.decrypt(organisation.wazuh_indexer_password);
    } else {
      indexerPassword = organisation.wazuh_indexer_password;
    }

    // Step 2: Fetch alerts from Wazuh
    const indexerCredentials = {
      host: `https://${organisation.wazuh_indexer_ip}:${organisation.wazuh_indexer_port || 9200}`,
      username: organisation.wazuh_indexer_username,
      password: indexerPassword
    };

    const alertsResponse = await getAlertsService(indexerCredentials, {}, organisation_id);
    const allAlerts = alertsResponse.alerts || [];

    // Filter alerts by time period
    const alerts = allAlerts.filter(alert => {
      const alertTime = new Date(alert.time || alert['@timestamp']);
      return alertTime >= startTime && alertTime <= now;
    });

    console.log('📊 [SECURITY METRICS] Total alerts in time period:', alerts.length);

    // Step 3: Calculate alert metrics (matching live alerts categorization)
    const severityCounts = {
      critical: 0, // Level >= 15
      major: 0,    // Level >= 11 and < 15
      minor: 0     // Level >= 7 and < 11
    };

    const ruleGroupCounts = {};
    const uniqueRuleGroups = new Set();

    alerts.forEach(alert => {
      const severity = alert.severity || alert.rule?.level || 1;
      const ruleGroups = alert.rule_groups || alert.rule?.groups?.[0] || 'unknown';

      // Count by severity (same as live alerts: critical ≥15, major ≥11, minor ≥7)
      if (severity >= 15) severityCounts.critical++;
      else if (severity >= 11) severityCounts.major++;
      else if (severity >= 7) severityCounts.minor++;

      // Track rule groups
      uniqueRuleGroups.add(ruleGroups);
      ruleGroupCounts[ruleGroups] = (ruleGroupCounts[ruleGroups] || 0) + 1;
    });

    // Get top 5 attack types
    const topAttackTypes = Object.entries(ruleGroupCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([type, count]) => ({ type, count }));

    // Step 4: Fetch ticket metrics
    const ticketQuery = {
      organisation_id
    };

    // Get all tickets created in time period
    const ticketsInPeriod = await Ticket.find({
      ...ticketQuery,
      createdAt: { $gte: startTime, $lte: now }
    });

    // Get resolved tickets (that were resolved in time period)
    const resolvedTickets = await Ticket.find({
      ...ticketQuery,
      ticket_status: 'resolved',
      resolved_at: { $exists: true, $gte: startTime, $lte: now }
    });

    console.log('📊 [SECURITY METRICS] Time range:', { startTime, endTime: now });
    console.log('📊 [SECURITY METRICS] Tickets created in period:', ticketsInPeriod.length);
    console.log('📊 [SECURITY METRICS] Tickets resolved in period:', resolvedTickets.length);

    // Debug: Check total tickets for this org
    const totalTickets = await Ticket.countDocuments({ organisation_id });
    console.log('📊 [SECURITY METRICS] Total tickets for org:', totalTickets);

    // Debug: Sample ticket data
    if (totalTickets > 0) {
      const sampleTicket = await Ticket.findOne({ organisation_id }).select('createdAt resolved_at ticket_status');
      console.log('📊 [SECURITY METRICS] Sample ticket:', sampleTicket);
    }

    // Calculate MTTR (Mean Time to Response/Resolution) - Overall and by severity
    let mttrHours = 0;
    let mttrMinutes = 0;
    const mttrBySeverity = {
      critical: { hours: 0, minutes: 0, formatted: '0m', count: 0 },
      major: { hours: 0, minutes: 0, formatted: '0m', count: 0 },
      minor: { hours: 0, minutes: 0, formatted: '0m', count: 0 }
    };

    if (resolvedTickets.length > 0) {
      // Calculate overall MTTR
      const totalResolutionTime = resolvedTickets.reduce((sum, ticket) => {
        if (!ticket.resolved_at) return sum;

        // Use alertTimestamp if available, otherwise fall back to createdAt
        const alertTime = ticket.alertTimestamp || ticket.createdAt;
        if (!alertTime) return sum;

        const alert = new Date(alertTime);
        const resolved = new Date(ticket.resolved_at);
        const diffMs = resolved - alert;
        const diffHours = diffMs / (1000 * 60 * 60);

        console.log('📊 [MTTR] Ticket:', {
          alertTimestamp: alert.toISOString(),
          resolvedAt: resolved.toISOString(),
          diffHours: diffHours.toFixed(2)
        });

        return sum + (diffMs > 0 ? diffMs : 0);
      }, 0);

      const avgResolutionTimeMs = totalResolutionTime / resolvedTickets.length;
      mttrHours = Math.floor(avgResolutionTimeMs / (1000 * 60 * 60));
      mttrMinutes = Math.floor((avgResolutionTimeMs % (1000 * 60 * 60)) / (1000 * 60));
      console.log('📊 [MTTR] Average:', { hours: mttrHours, minutes: mttrMinutes });

      // Calculate MTTR by severity
      const severityGroups = {
        critical: [],
        major: [],
        minor: []
      };

      resolvedTickets.forEach(ticket => {
        if (!ticket.resolved_at || !ticket.severity) return;

        const alertTime = ticket.alertTimestamp || ticket.createdAt;
        if (!alertTime) return;

        const alert = new Date(alertTime);
        const resolved = new Date(ticket.resolved_at);
        const diffMs = resolved - alert;

        if (diffMs > 0 && severityGroups[ticket.severity]) {
          severityGroups[ticket.severity].push(diffMs);
        }
      });

      // Calculate average for each severity
      Object.keys(severityGroups).forEach(severity => {
        const times = severityGroups[severity];
        if (times.length > 0) {
          const avgMs = times.reduce((sum, ms) => sum + ms, 0) / times.length;
          const hours = Math.floor(avgMs / (1000 * 60 * 60));
          const minutes = Math.floor((avgMs % (1000 * 60 * 60)) / (1000 * 60));
          mttrBySeverity[severity] = {
            hours,
            minutes,
            formatted: hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`,
            count: times.length
          };
        }
      });

      console.log('📊 [MTTR] By Severity:', mttrBySeverity);
    }

    // Calculate response rate
    const openedTickets = ticketsInPeriod.length;
    const responseRate = openedTickets > 0
      ? Math.round((resolvedTickets.length / openedTickets) * 100)
      : 0;

    // Step 5: Prepare response
    const metrics = {
      threatsBlocked: {
        total: alerts.length,
        bySeverity: severityCounts
      },
      incidentsClosed: resolvedTickets.length,
      incidentsOpened: openedTickets,
      mttr: {
        hours: mttrHours,
        minutes: mttrMinutes,
        formatted: mttrHours > 0 ? `${mttrHours}h ${mttrMinutes}m` : `${mttrMinutes}m`,
        bySeverity: mttrBySeverity
      },
      activeThreats: uniqueRuleGroups.size,
      topAttackTypes,
      responseRate,
      timePeriod: {
        hours: hoursAgo,
        startTime: startTime.toISOString(),
        endTime: now.toISOString()
      }
    };

    console.log('✅ [SECURITY METRICS] Metrics calculated successfully');

    res.json({
      success: true,
      data: metrics
    });

  } catch (error) {
    console.error('❌ [SECURITY METRICS] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch security metrics',
      error: error.message
    });
  }
};

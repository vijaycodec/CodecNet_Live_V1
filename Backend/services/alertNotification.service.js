import Organisation from '../models/organisation.model.js';
import EmailLog from '../models/emailLog.model.js';
import {
  buildCriticalAlertEmail,
  buildCcList,
  sendMail,
  getSenderEmail
} from './email.service.js';

// Wazuh rule.level >= 12 is treated as Critical
const CRITICAL_LEVEL_THRESHOLD = parseInt(process.env.CRITICAL_LEVEL_THRESHOLD, 10) || 12;

const normalizeAlert = (raw) => {
  if (!raw) return null;

  const alertId = raw.alert_id || raw._id || raw.id || null;
  const level = Number(
    raw.alert_severity ?? raw.severity ?? raw.rule?.level ?? NaN
  );

  const mitre = raw.rule?.mitre || {};
  const mitreIds = Array.isArray(mitre.id) ? mitre.id : (mitre.id ? [mitre.id] : []);
  const mitreTechniques = Array.isArray(mitre.technique) ? mitre.technique : (mitre.technique ? [mitre.technique] : []);
  const mitrePairs = mitreIds.length === mitreTechniques.length
    ? mitreIds.map((id, i) => `${id} - ${mitreTechniques[i]}`)
    : [...mitreIds, ...mitreTechniques];

  const country = raw.GeoLocation?.country_name
    || raw.geoLocation?.country_name
    || raw.location?.country
    || null;

  return {
    alert_id: alertId,
    alert_title: raw.alert_title || raw.title || raw.rule?.description || 'Critical Security Alert',
    alert_severity: Number.isFinite(level) ? level : null,
    alert_source: raw.alert_source || raw.agent_name || raw.agent?.name || raw.host_name || raw.predecoder?.hostname || 'Unknown',
    alert_time: raw.alert_time || raw.time || raw['@timestamp'] || new Date().toISOString(),
    alert_description: raw.alert_description || raw.description || raw.rule?.description || '',
    agent_name: raw.agent_name || raw.agent?.name || null,
    agent_ip: raw.agent?.ip || raw.agent_ip || null,
    rule_description: raw.rule?.description || raw.alert_description || raw.description || null,
    target_user_name: raw.data?.win?.eventdata?.targetUserName || null,
    mitre: mitrePairs.join(', ') || null,
    geo_country: country,
    src_ip: raw.data?.srcip || raw.srcip || null,
    src_port: raw.data?.srcport || raw.srcport || null,
    auth_package_name: raw.data?.win?.eventdata?.authenticationPackageName || null,
    logon_type: raw.data?.win?.eventdata?.logonType || null
  };
};

export const isCriticalAlert = (rawAlert) => {
  const level = Number(
    rawAlert?.alert_severity ?? rawAlert?.severity ?? rawAlert?.rule?.level ?? NaN
  );
  return Number.isFinite(level) && level >= CRITICAL_LEVEL_THRESHOLD;
};

// Resolve recipient list for an organisation - falls back to env-configured test recipient
const resolveRecipients = async (organisationId) => {
  let toList = [];
  let ccList = [];
  let orgName = '';

  if (organisationId) {
    const org = await Organisation.findById(organisationId).select(
      'organisation_name emails cc_emails alert_email_notifications_enabled'
    );
    if (org) {
      orgName = org.organisation_name || '';
      if (org.alert_email_notifications_enabled === false) {
        return { toList: [], ccList: [], orgName, disabled: true };
      }
      toList = Array.isArray(org.emails) ? [...org.emails] : [];
      ccList = buildCcList(org.cc_emails || []);
    }
  }

  // Fallback test recipient (per spec - useful when org has no emails configured)
  if (toList.length === 0) {
    const fallback = process.env.ALERT_FALLBACK_TO;
    if (fallback) toList.push(fallback);
  }
  if (ccList.length === 0) {
    ccList = buildCcList([]);
  }

  return { toList, ccList, orgName, disabled: false };
};

// Send a critical-alert email and persist an EmailLog row.
// Returns the EmailLog document (or null if skipped because duplicate / disabled / no recipients).
export const sendCriticalAlertEmail = async ({
  alert,
  organisationId = null,
  extraCc = [],
  emailType = 'critical_alert'
}) => {
  const normalized = normalizeAlert(alert);
  if (!normalized) {
    throw new Error('Invalid alert payload');
  }

  // Dedup: if we already sent (status=sent or queued) for this alert_id, skip
  if (normalized.alert_id && emailType === 'critical_alert') {
    const existing = await EmailLog.findOne({
      alert_id: normalized.alert_id,
      email_type: 'critical_alert',
      status: { $in: ['sent', 'queued'] }
    }).lean();
    if (existing) {
      return { skipped: true, reason: 'already_sent', log: existing };
    }
  }

  const { toList, ccList, orgName, disabled } = await resolveRecipients(organisationId);

  if (disabled) {
    return { skipped: true, reason: 'notifications_disabled' };
  }

  // Merge extra CCs
  const finalCc = buildCcList(ccList.filter(c => c !== undefined), extraCc);

  if (toList.length === 0) {
    return { skipped: true, reason: 'no_recipients' };
  }

  const { subject, text, html } = buildCriticalAlertEmail(normalized, orgName);

  // Persist as queued before sending
  let log = await EmailLog.create({
    organisation_id: organisationId,
    email_type: emailType,
    from: getSenderEmail(),
    to: toList,
    cc: finalCc,
    subject,
    alert_id: normalized.alert_id,
    alert_title: normalized.alert_title,
    alert_severity: normalized.alert_severity,
    alert_source: normalized.alert_source,
    alert_time: normalized.alert_time,
    alert_description: normalized.alert_description,
    status: 'queued',
    attempts: 0
  });

  try {
    const result = await sendMail({
      to: toList,
      cc: finalCc,
      subject,
      text,
      html
    });

    log.status = 'sent';
    log.smtp_message_id = result.messageId || null;
    log.smtp_response = result.response || null;
    log.attempts = (log.attempts || 0) + 1;
    log.sent_at = new Date();
    await log.save();

    return { skipped: false, log };
  } catch (err) {
    log.status = 'failed';
    log.error_message = err.message || String(err);
    log.attempts = (log.attempts || 0) + 1;
    await log.save();
    return { skipped: false, log, error: err.message };
  }
};

// Process an array of alert objects and email any that are Critical.
// Used by the alerts polling endpoint.
export const processAlertsForNotification = async (alerts = [], organisationId = null) => {
  const results = [];
  for (const a of alerts) {
    if (!isCriticalAlert(a)) continue;
    try {
      const res = await sendCriticalAlertEmail({ alert: a, organisationId });
      results.push(res);
    } catch (err) {
      results.push({ skipped: false, error: err.message });
    }
  }
  return results;
};

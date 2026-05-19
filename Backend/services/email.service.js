import nodemailer from 'nodemailer';

// Hostinger SMTP defaults
const SMTP_HOST = process.env.SMTP_HOST || 'smtp.hostinger.com';
const SMTP_PORT = parseInt(process.env.SMTP_PORT, 10) || 465;
const SMTP_SECURE = process.env.SMTP_SECURE
  ? process.env.SMTP_SECURE === 'true'
  : SMTP_PORT === 465;

// Sender email (per spec - ccnsocservices@codecnetworks.in)
const ALERT_SENDER_EMAIL = process.env.ALERT_SENDER_EMAIL || 'ccnsocservices@codecnetworks.in';
const ALERT_SENDER_NAME = process.env.ALERT_SENDER_NAME || 'CodecNet SOC Services';
const ALERT_SENDER_PASSWORD = process.env.ALERT_SENDER_PASSWORD || '';

// Default CC - OPTIONAL. When unset/empty, no CC is auto-injected; the per-org
// cc_emails[] list is the only source. Set ALERT_DEFAULT_CC in .env if you want
// a system-wide CC on every critical-alert email.
const DEFAULT_CC_EMAIL = (process.env.ALERT_DEFAULT_CC || '').trim();

let transporter = null;

const buildTransporter = () => {
  if (transporter) return transporter;

  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    auth: ALERT_SENDER_PASSWORD
      ? { user: ALERT_SENDER_EMAIL, pass: ALERT_SENDER_PASSWORD }
      : undefined,
    tls: {
      rejectUnauthorized: false
    }
  });

  return transporter;
};

export const verifySmtpConnection = async () => {
  try {
    const tx = buildTransporter();
    await tx.verify();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
};

// Returns the deduplicated, validated default-augmented CC list
export const buildCcList = (orgCcEmails = [], extraCc = []) => {
  const set = new Set();
  const push = (e) => {
    if (typeof e === 'string' && e.trim()) set.add(e.trim().toLowerCase());
  };
  push(DEFAULT_CC_EMAIL);
  (orgCcEmails || []).forEach(push);
  (extraCc || []).forEach(push);
  return Array.from(set);
};

const severityLabel = () => 'Critical';

const escapeHtml = (str) => {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

// Critical alert email template
export const buildCriticalAlertEmail = (alert, orgName = '') => {
  const title = alert.alert_title
    || alert.title
    || alert.alert_description
    || alert.rule?.description
    || 'Critical Security Alert';

  const severity = severityLabel(
    alert.alert_severity ?? alert.severity ?? alert.rule?.level
  );

  const source = alert.alert_source
    || alert.agent_name
    || alert.agent?.name
    || alert.host_name
    || alert.predecoder?.hostname
    || 'Unknown source';

  const timeRaw = alert.alert_time || alert.time || alert['@timestamp'] || new Date().toISOString();
  const time = new Date(timeRaw).toLocaleString('en-IN', {
    timeZone: process.env.ALERT_EMAIL_TZ || 'Asia/Kolkata',
    dateStyle: 'medium',
    timeStyle: 'medium'
  });

  const description = alert.alert_description
    || alert.description
    || alert.rule?.description
    || 'No description available.';

  const agentName = alert.agent_name || alert.agent?.name || null;
  const agentIp = alert.agent_ip || alert.agent?.ip || null;
  const ruleDescription = alert.rule_description
    || alert.rule?.description
    || alert.alert_description
    || alert.description
    || null;
  const targetUserName = alert.target_user_name
    || alert.data?.win?.eventdata?.targetUserName
    || null;
  const mitreInfo = (() => {
    if (typeof alert.mitre === 'string' && alert.mitre.trim()) return alert.mitre;
    const m = alert.rule?.mitre || {};
    const ids = Array.isArray(m.id) ? m.id : (m.id ? [m.id] : []);
    const techs = Array.isArray(m.technique) ? m.technique : (m.technique ? [m.technique] : []);
    const pairs = ids.length === techs.length
      ? ids.map((id, i) => `${id} - ${techs[i]}`)
      : [...ids, ...techs];
    return pairs.join(', ') || null;
  })();
  const geoCountry = alert.geo_country
    || alert.GeoLocation?.country_name
    || alert.location?.country
    || null;
  const srcIp = alert.src_ip || alert.data?.srcip || alert.srcip || null;
  const srcPort = alert.src_port || alert.data?.srcport || alert.srcport || null;
  const authPackageName = alert.auth_package_name
    || alert.data?.win?.eventdata?.authenticationPackageName
    || null;
  const logonType = alert.logon_type
    || alert.data?.win?.eventdata?.logonType
    || null;

  const subject = `Critical Alert: ${title}`;

  const fields = [
    ['Alert Title', title],
    ['Severity', severity],
    ['Agent Name', agentName],
    ['Agent IP', agentIp],
    ['Rule Description', ruleDescription],
    ['Target User', targetUserName],
    ['MITRE', mitreInfo],
    ['Country', geoCountry],
    ['Source IP', srcIp],
    ['Source Port', srcPort],
    ['Auth Package Name', authPackageName],
    ['Logon Type', logonType],
    ['Time', time]
  ].filter(([, v]) => {
    if (v === null || v === undefined) return false;
    const s = String(v).trim();
    return s !== '' && s.toUpperCase() !== 'N/A';
  });

  const greeting = orgName ? `Hi, ${orgName}.` : 'Hi,';

  const text = [
    greeting,
    '',
    'A critical security alert has been triggered. Please find the details below:',
    '',
    ...fields.map(([k, v]) => `${k}: ${v}`),
    '',
    'Regards,',
    'This is an automated mail from CodecNet SOC.'
  ].join('\n');

  const htmlLines = fields
    .map(([k, v]) => `<strong>${escapeHtml(k)}:</strong> ${escapeHtml(v)}`)
    .join('<br>');

  const html = `<div style="font-family:Arial,sans-serif;font-size:14px;color:#222;">
<p>${escapeHtml(greeting)}</p>
<p>A critical security alert has been triggered. Please find the details below:</p>
<p>${htmlLines}</p>
<p>Regards,<br>This is an automated mail from CodecNet SOC.</p>
</div>`;

  return { subject, text, html };
};

// Low-level send via Hostinger SMTP
export const sendMail = async ({ to, cc = [], subject, text, html }) => {
  const tx = buildTransporter();
  const fromHeader = `"${ALERT_SENDER_NAME}" <${ALERT_SENDER_EMAIL}>`;

  const info = await tx.sendMail({
    from: fromHeader,
    to: Array.isArray(to) ? to.join(', ') : to,
    cc: Array.isArray(cc) && cc.length ? cc.join(', ') : undefined,
    subject,
    text,
    html
  });

  return {
    messageId: info.messageId,
    response: info.response,
    accepted: info.accepted || [],
    rejected: info.rejected || []
  };
};

export const getSenderEmail = () => ALERT_SENDER_EMAIL;
export const getDefaultCc = () => DEFAULT_CC_EMAIL;

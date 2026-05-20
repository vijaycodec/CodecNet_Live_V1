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

// Escalation-contact block in the alert email footer. All optional —
// any unset value hides its row; if every value is empty the whole
// "Escalation Contacts" box is omitted from the email.
const SOC_HOTLINE = (process.env.SOC_HOTLINE || '').trim();
const SOC_EMAIL = (process.env.SOC_EMAIL || 'soc@codecnetworks.in').trim();
const SOC_INCIDENT_MANAGER = (process.env.SOC_INCIDENT_MANAGER || '').trim();
const SOC_ACCOUNT_SDM = (process.env.SOC_ACCOUNT_SDM || '').trim();

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

const hasValue = (v) => {
  if (v === null || v === undefined) return false;
  const s = String(v).trim();
  return s !== '' && s.toUpperCase() !== 'N/A';
};

// RFC1918 + loopback + link-local + CGNAT — anything else is treated as external
const isExternalIp = (ip) => {
  if (!hasValue(ip)) return false;
  const s = String(ip).trim();
  if (s.includes(':')) return !/^(::1|fc|fd|fe80)/i.test(s);
  const m = s.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const [a, b] = [parseInt(m[1], 10), parseInt(m[2], 10)];
  if (a === 10) return false;
  if (a === 127) return false;
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && b === 168) return false;
  if (a === 169 && b === 254) return false;
  if (a === 100 && b >= 64 && b <= 127) return false;
  return true;
};

// Coarse high-risk-geo list. Adjust as policy evolves.
const HIGH_RISK_COUNTRIES = new Set([
  'ru', 'russia', 'russian federation',
  'cn', 'china', "people's republic of china",
  'kp', 'north korea', "democratic people's republic of korea",
  'ir', 'iran', 'islamic republic of iran',
  'by', 'belarus',
  'sy', 'syria', 'syrian arab republic'
]);

const isHighRiskCountry = (country) => {
  if (!hasValue(country)) return false;
  return HIGH_RISK_COUNTRIES.has(String(country).trim().toLowerCase());
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

  const timeRaw = alert.alert_time || alert.time || alert['@timestamp'] || new Date().toISOString();
  const time = new Date(timeRaw).toLocaleString('en-IN', {
    timeZone: process.env.ALERT_EMAIL_TZ || 'Asia/Kolkata',
    dateStyle: 'medium',
    timeStyle: 'medium'
  });

  const agentName = alert.agent_name || alert.agent?.name || alert.host_name || null;
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
      ? ids.map((id, i) => `${id} — ${techs[i]}`)
      : [...ids, ...techs];
    return pairs.join('<br>') || null;
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

  const ticketId = alert.ticket_id || alert.ticketId || null;
  const sla = alert.sla || null;
  const killChainPhase = alert.kill_chain_phase || alert.killChainPhase || null;
  const assetCriticality = alert.asset_criticality || alert.assetCriticality || null;
  const threatIntelMatch = alert.threat_intel_match || alert.threatIntelMatch || null;

  // LLM-generated (or manually-supplied) narrative sections. All optional.
  const socAnalysis = alert.soc_analysis || alert.socAnalysis || null;
  const recommendedActions = Array.isArray(alert.recommended_actions)
    ? alert.recommended_actions
    : Array.isArray(alert.recommendedActions) ? alert.recommendedActions : [];
  const actionsTaken = Array.isArray(alert.actions_taken)
    ? alert.actions_taken
    : Array.isArray(alert.actionsTaken) ? alert.actionsTaken : [];
  const complianceNote = alert.compliance_note || alert.complianceNote || null;

  const subject = `Critical Alert: ${title}`;

  const greeting = orgName ? `Dear ${orgName},` : 'Dear Customer,';

  // ---------- Plain-text version ----------
  const textSections = [];
  const pushText = (label, value) => { if (hasValue(value)) textSections.push(`  ${label}: ${value}`); };

  textSections.push(greeting, '');
  textSections.push('CodecNet Security Operations Centre (SOC) has detected a Critical severity security event on your monitored infrastructure. Please find the incident details below.');
  textSections.push('');
  if (hasValue(ticketId)) textSections.push(`Ticket ID: ${ticketId}`);
  textSections.push(`Reported At: ${time}`);
  if (hasValue(sla)) textSections.push(`SLA: ${sla}`);
  textSections.push('', 'INCIDENT SUMMARY');
  pushText('Alert Title', title);
  pushText('Severity', severity);
  pushText('Rule Description', ruleDescription);
  pushText('Detected At (IST)', time);
  pushText('MITRE ATT&CK', mitreInfo && mitreInfo.replace(/<br>/g, '; '));
  pushText('Kill Chain Phase', killChainPhase);
  textSections.push('', 'AFFECTED ASSET');
  pushText('Agent / Hostname', agentName);
  pushText('Internal IP', agentIp);
  pushText('Target User Account', targetUserName);
  pushText('Asset Criticality', assetCriticality);
  textSections.push('', 'SOURCE / INDICATORS OF COMPROMISE');
  pushText('Source IP', srcIp && (isExternalIp(srcIp) ? `${srcIp} (external)` : srcIp));
  pushText('Source Country / GeoIP', geoCountry && (isHighRiskCountry(geoCountry) ? `${geoCountry} (high-risk geography)` : geoCountry));
  pushText('Source Port', srcPort);
  pushText('Authentication Package', authPackageName);
  pushText('Logon Type', logonType);
  pushText('Threat Intel Match', threatIntelMatch);

  if (hasValue(socAnalysis)) {
    textSections.push('', 'SOC ANALYSIS', socAnalysis);
  }
  if (recommendedActions.length) {
    textSections.push('', 'RECOMMENDED ACTIONS (CLIENT)');
    recommendedActions.forEach((a, i) => textSections.push(`${i + 1}. ${a}`));
  }
  if (actionsTaken.length) {
    textSections.push('', 'ACTIONS TAKEN BY CODECNET SOC');
    actionsTaken.forEach((a) => textSections.push(`  • ${a}`));
  }
  if (hasValue(complianceNote)) {
    textSections.push('', 'COMPLIANCE & REPORTING', complianceNote);
  }

  // Escalation contacts (plain-text)
  const escalationPairsTop = [
    hasValue(SOC_HOTLINE) && `SOC Hotline: ${SOC_HOTLINE}`,
    hasValue(SOC_EMAIL) && `SOC Email: ${SOC_EMAIL}`
  ].filter(Boolean);
  const escalationPairsBottom = [
    hasValue(SOC_INCIDENT_MANAGER) && `Incident Manager (L3): ${SOC_INCIDENT_MANAGER}`,
    hasValue(SOC_ACCOUNT_SDM) && `Account SDM: ${SOC_ACCOUNT_SDM}`
  ].filter(Boolean);
  const showEscalation = escalationPairsTop.length || escalationPairsBottom.length;
  if (showEscalation) {
    textSections.push('', 'ESCALATION CONTACTS — 24x7');
    if (escalationPairsTop.length) textSections.push(escalationPairsTop.join('  |  '));
    if (escalationPairsBottom.length) textSections.push(escalationPairsBottom.join('  |  '));
  }

  textSections.push('');
  textSections.push('Regards,');
  textSections.push('CodecNet Security Operations Centre  |  24x7 Managed Detection & Response');
  textSections.push('This is a system-generated notification from the CodecNet SOC platform. Please do not share alert details on unsecured channels. Confidential — for intended recipient only.');
  const text = textSections.join('\n');

  // ---------- HTML version ----------
  // Email-safe: table layout, inline styles only.
  const row = (label, valueHtml) => `
    <tr>
      <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;background:#f9fafb;color:#374151;font-size:13px;width:38%;vertical-align:top;">${escapeHtml(label)}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;color:#111827;font-size:13px;vertical-align:top;">${valueHtml}</td>
    </tr>`;

  const sectionHeader = (label) => `
    <tr>
      <td colspan="2" style="padding:14px 14px 8px;font-size:12px;font-weight:700;letter-spacing:0.08em;color:#6b7280;text-transform:uppercase;">${escapeHtml(label)}</td>
    </tr>`;

  const tag = (text, bg, fg) =>
    `<span style="display:inline-block;margin-left:6px;padding:2px 8px;border-radius:10px;background:${bg};color:${fg};font-size:11px;font-weight:600;">${escapeHtml(text)}</span>`;

  const incidentRows = [
    hasValue(title) && row('Alert Title', `<strong>${escapeHtml(title)}</strong>`),
    hasValue(severity) && row('Severity', `<span style="display:inline-block;padding:4px 10px;border-radius:4px;background:#fde2e1;color:#b91c1c;font-size:11px;font-weight:700;letter-spacing:0.05em;">${escapeHtml(severity.toUpperCase())}</span>`),
    hasValue(ruleDescription) && row('Rule Description', escapeHtml(ruleDescription)),
    hasValue(time) && row('Detected At (IST)', escapeHtml(time)),
    hasValue(mitreInfo) && row('MITRE ATT&CK', mitreInfo),
    hasValue(killChainPhase) && row('Kill Chain Phase', escapeHtml(killChainPhase))
  ].filter(Boolean).join('');

  const assetRows = [
    hasValue(agentName) && row('Agent / Hostname', `<code style="font-family:Consolas,Menlo,monospace;font-size:12px;">${escapeHtml(agentName)}</code>`),
    hasValue(agentIp) && row('Internal IP', `<code style="font-family:Consolas,Menlo,monospace;font-size:12px;">${escapeHtml(agentIp)}</code>`),
    hasValue(targetUserName) && row('Target User Account', `<code style="font-family:Consolas,Menlo,monospace;font-size:12px;">${escapeHtml(targetUserName)}</code>`),
    hasValue(assetCriticality) && row('Asset Criticality', escapeHtml(assetCriticality))
  ].filter(Boolean).join('');

  const sourceRows = [
    hasValue(srcIp) && row(
      'Source IP',
      `<code style="font-family:Consolas,Menlo,monospace;font-size:12px;">${escapeHtml(srcIp)}</code>${isExternalIp(srcIp) ? tag('external', '#fee2e2', '#b91c1c') : ''}`
    ),
    hasValue(geoCountry) && row(
      'Source Country / GeoIP',
      `${escapeHtml(geoCountry)}${isHighRiskCountry(geoCountry) ? tag('high-risk geography', '#fef3c7', '#92400e') : ''}`
    ),
    hasValue(srcPort) && row('Source Port', `<code style="font-family:Consolas,Menlo,monospace;font-size:12px;">${escapeHtml(srcPort)}</code>`),
    hasValue(authPackageName) && row('Authentication Package', escapeHtml(authPackageName)),
    hasValue(logonType) && row('Logon Type', escapeHtml(logonType)),
    hasValue(threatIntelMatch) && row('Threat Intel Match', escapeHtml(threatIntelMatch))
  ].filter(Boolean).join('');

  const metaParts = [];
  if (hasValue(ticketId)) metaParts.push(`<strong>Ticket ID:</strong> ${escapeHtml(ticketId)}`);
  metaParts.push(`<strong>Reported At:</strong> ${escapeHtml(time)} IST`);
  if (hasValue(sla)) metaParts.push(`<strong>SLA:</strong> ${escapeHtml(sla)}`);
  const metaLine = metaParts.join('&nbsp;&nbsp;|&nbsp;&nbsp;');

  // Narrative section: bordered card with uppercase header + body content
  const narrativeSection = (label, bodyHtml) => `
    <tr>
      <td style="padding:14px 14px 0;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #e5e7eb;border-radius:4px;">
          <tr>
            <td style="padding:12px 16px 6px;font-size:12px;font-weight:700;letter-spacing:0.08em;color:#6b7280;text-transform:uppercase;">${escapeHtml(label)}</td>
          </tr>
          <tr>
            <td style="padding:0 16px 14px;font-size:13px;line-height:1.6;color:#111827;">${bodyHtml}</td>
          </tr>
        </table>
      </td>
    </tr>`;

  const socAnalysisHtml = hasValue(socAnalysis)
    ? narrativeSection('SOC Analysis', `<p style="margin:0;">${escapeHtml(socAnalysis)}</p>`)
    : '';

  const recommendedActionsHtml = recommendedActions.length
    ? narrativeSection(
        'Recommended Actions (Client)',
        `<ol style="margin:0;padding-left:20px;">${recommendedActions.map((a) => `<li style="margin:4px 0;">${escapeHtml(a)}</li>`).join('')}</ol>`
      )
    : '';

  const actionsTakenHtml = actionsTaken.length
    ? narrativeSection(
        'Actions Taken by CodecNet SOC',
        `<ul style="margin:0;padding-left:20px;list-style-type:disc;">${actionsTaken.map((a) => `<li style="margin:4px 0;">${escapeHtml(a)}</li>`).join('')}</ul>`
      )
    : '';

  const complianceHtml = hasValue(complianceNote)
    ? narrativeSection('Compliance &amp; Reporting', `<p style="margin:0;">${escapeHtml(complianceNote)}</p>`)
    : '';

  const html = `<!DOCTYPE html>
<html>
<body style="margin:0;padding:24px;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;color:#111827;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:720px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;">
    <tr>
      <td style="background:#b91c1c;padding:14px 18px;color:#ffffff;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
          <tr>
            <td style="font-size:15px;font-weight:700;letter-spacing:0.02em;color:#ffffff;">&#9888;&nbsp; CRITICAL SECURITY ALERT</td>
            <td align="right" style="font-size:11px;color:#ffffff;">
              <span style="display:inline-block;padding:4px 10px;background:#7f1d1d;border-radius:4px;font-weight:700;letter-spacing:0.05em;color:#ffffff;">P1 &mdash; IMMEDIATE ACTION</span>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding:20px 22px 8px;font-size:14px;line-height:1.55;color:#111827;">
        <p style="margin:0 0 12px;">${escapeHtml(greeting)}</p>
        <p style="margin:0 0 14px;">CodecNet Security Operations Centre (SOC) has detected a <strong>Critical</strong> severity security event on your monitored infrastructure. Please find the incident details, observed indicators and recommended actions below.</p>
        <p style="margin:0;font-size:12px;color:#4b5563;">${metaLine}</p>
      </td>
    </tr>
    ${incidentRows ? `<tr><td style="padding:8px 14px 0;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #e5e7eb;border-radius:4px;border-collapse:separate;">${sectionHeader('Incident Summary')}${incidentRows}</table></td></tr>` : ''}
    ${assetRows ? `<tr><td style="padding:14px 14px 0;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #e5e7eb;border-radius:4px;border-collapse:separate;">${sectionHeader('Affected Asset')}${assetRows}</table></td></tr>` : ''}
    ${sourceRows ? `<tr><td style="padding:14px 14px 0;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #e5e7eb;border-radius:4px;border-collapse:separate;">${sectionHeader('Source / Indicators of Compromise')}${sourceRows}</table></td></tr>` : ''}
    ${socAnalysisHtml}
    ${recommendedActionsHtml}
    ${actionsTakenHtml}
    ${complianceHtml}
    ${showEscalation ? `<tr>
      <td style="padding:18px 14px 0;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f4f6;border-left:4px solid #b91c1c;border-radius:4px;">
          <tr>
            <td style="padding:14px 16px;font-size:13px;color:#111827;line-height:1.7;">
              <div style="color:#b91c1c;font-weight:700;letter-spacing:0.05em;font-size:12px;margin-bottom:6px;">ESCALATION CONTACTS &mdash; 24x7</div>
              ${escalationPairsTop.length ? `<div>${escalationPairsTop.map((p) => {
                const [label, ...rest] = p.split(': ');
                return `${escapeHtml(label)}: ${escapeHtml(rest.join(': '))}`;
              }).join('&nbsp;&nbsp;|&nbsp;&nbsp;')}</div>` : ''}
              ${escalationPairsBottom.length ? `<div>${escalationPairsBottom.map((p) => {
                const [label, ...rest] = p.split(': ');
                return `${escapeHtml(label)}: ${escapeHtml(rest.join(': '))}`;
              }).join('&nbsp;&nbsp;|&nbsp;&nbsp;')}</div>` : ''}
            </td>
          </tr>
        </table>
      </td>
    </tr>` : ''}
    <tr>
      <td style="padding:18px 22px 22px;font-size:12px;color:#6b7280;border-top:1px solid #e5e7eb;line-height:1.6;">
        Regards,<br>
        <strong style="color:#111827;">CodecNet Security Operations Centre</strong>&nbsp;&nbsp;|&nbsp;&nbsp;24x7 Managed Detection &amp; Response<br>
        This is a system-generated notification from the CodecNet SOC platform. Please do not share alert details on unsecured channels. Confidential &mdash; for intended recipient only.
      </td>
    </tr>
  </table>
</body>
</html>`;

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

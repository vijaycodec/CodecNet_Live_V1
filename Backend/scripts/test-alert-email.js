// Standalone test for the critical-alert email pipeline.
// Run:  node scripts/test-alert-email.js
//
// This does NOT require the API server, JWT, or MongoDB to be reachable
// (it skips EmailLog persistence and just hits SMTP directly so you can
// confirm Hostinger credentials are working).
//
// In addition to sending the email, this script writes the rendered HTML
// to scripts/last-alert-preview.html so you can open it in a browser
// and see the exact production design without opening your inbox.
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  verifySmtpConnection,
  buildCriticalAlertEmail,
  buildCcList,
  sendMail,
  getSenderEmail,
  getDefaultCc
} from '../services/email.service.js';
import { generateAlertNarrative, isLlmEnabled } from '../services/llmAnalysis.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TO = process.argv[2] || process.env.ALERT_FALLBACK_TO || 'seo@codecnetworks.com';
const EXTRA_CC = process.argv.slice(3); // additional CCs from CLI

(async () => {
  console.log('================================================');
  console.log(' Critical-Alert Email — Hostinger SMTP test');
  console.log('================================================');
  console.log('SMTP_HOST          :', process.env.SMTP_HOST || 'smtp.hostinger.com');
  console.log('SMTP_PORT          :', process.env.SMTP_PORT || 465);
  console.log('SMTP_SECURE        :', process.env.SMTP_SECURE ?? '(auto)');
  console.log('Sender             :', getSenderEmail());
  console.log('Sender password set:', process.env.ALERT_SENDER_PASSWORD ? 'YES' : 'NO (will likely fail)');
  console.log('Default CC         :', getDefaultCc());
  console.log('Test TO            :', TO);
  if (EXTRA_CC.length) console.log('Extra CC           :', EXTRA_CC.join(', '));
  console.log('------------------------------------------------');

  // 1. Verify connectivity
  console.log('\n[1/2] Verifying SMTP connection…');
  const verify = await verifySmtpConnection();
  if (!verify.ok) {
    console.error('   FAILED:', verify.error);
    console.error('   → Check SMTP host/port/secure and ALERT_SENDER_PASSWORD in .env');
    process.exit(1);
  }
  console.log('   OK — SMTP server reachable and credentials accepted.');

  // 2. Build and send a synthetic critical alert
  // NOTE: This payload mirrors the real shape of a Wazuh alert as it flows
  // through GET /api/wazuh/alerts -> processAlertsForNotification(). Every
  // fallback path in buildCriticalAlertEmail() is exercised here so what you
  // see in the inbox is the EXACT production design.
  console.log('\n[2/2] Sending synthetic critical alert…');
  const nowIso = new Date().toISOString();
  const fakeAlert = {
    // ID returned by the Wazuh indexer for this hit
    alert_id: `manual-test-${Date.now()}`,
    _id: `manual-test-${Date.now()}`,

    // Convenience top-level fields surfaced by alerts.controller.js
    severity: 13,
    alert_description: 'Multiple failed SSH login attempts followed by a successful login from a new geography. Possible credential brute-force + account takeover.',
    time: nowIso,
    '@timestamp': nowIso,
    host_name: 'web-prod-01',
    agent_name: 'web-prod-01',
    agent_id: '003',
    rule_groups: 'authentication_failed, authentication_success, ssh, attack',
    srcip: '203.0.113.42',
    location: {
      country: 'Unknown',
      city: 'Unknown',
      lat: null,
      lon: null
    },

    // Nested Wazuh structure (the template reads from these as fallbacks)
    rule: {
      level: 13,
      description: 'Possible SSH brute-force attack with successful login from a new geography',
      id: '5712',
      groups: ['authentication_failed', 'authentication_success', 'ssh', 'attack'],
      mitre: {
        id: ['T1110'],
        tactic: ['Credential Access'],
        technique: ['Brute Force']
      }
    },
    agent: {
      id: '003',
      name: 'web-prod-01',
      ip: '10.0.0.21'
    },
    predecoder: {
      hostname: 'web-prod-01',
      program_name: 'sshd',
      timestamp: nowIso
    },
    data: {
      srcip: '203.0.113.42',
      srcuser: 'root',
      dstuser: 'root'
    },
    full_log: 'Failed password for invalid user root from 203.0.113.42 port 52344 ssh2'
  };

  // Exercise the LLM path so the test email matches the real production flow
  // (the live pipeline calls this from alertNotification.service.js).
  if (isLlmEnabled()) {
    console.log('   Calling LLM for SOC ANALYSIS / RECOMMENDED ACTIONS / COMPLIANCE...');
    const started = Date.now();
    const narrative = await generateAlertNarrative({
      alert_title: fakeAlert.rule.description,
      alert_severity: fakeAlert.severity,
      alert_time: fakeAlert.time,
      rule_description: fakeAlert.rule.description,
      agent_name: fakeAlert.agent.name,
      agent_ip: fakeAlert.agent.ip,
      target_user_name: fakeAlert.data?.dstuser,
      mitre: 'T1110 - Brute Force',
      src_ip: fakeAlert.srcip,
      geo_country: fakeAlert.location?.country,
      src_port: 52344,
      auth_package_name: 'OpenSSH',
      logon_type: 'Network'
    });
    const elapsed = Date.now() - started;
    if (narrative.ok) {
      fakeAlert.soc_analysis = narrative.soc_analysis;
      fakeAlert.recommended_actions = narrative.recommended_actions;
      fakeAlert.compliance_note = narrative.compliance_note;
      console.log(`   LLM OK (${elapsed} ms) - three sections injected.`);
    } else {
      console.warn(`   LLM skipped (${narrative.reason})${narrative.error ? ': ' + narrative.error : ''}`);
      console.warn('   Email will go out WITHOUT the three narrative sections.');
    }
  } else {
    console.log('   LLM disabled (LLM_ANALYSIS_ENABLED=false) - email will go out without narrative sections.');
  }

  const { subject, text, html } = buildCriticalAlertEmail(fakeAlert, 'CodecNet Test Organisation');
  const cc = buildCcList([], EXTRA_CC);

  // Write a local preview file so you can see the design without opening the inbox
  const previewPath = path.join(__dirname, 'last-alert-preview.html');
  try {
    fs.writeFileSync(previewPath, html, 'utf8');
    console.log('   Preview written :', previewPath);
    console.log('   Open this file in a browser to view the exact email design.');
  } catch (err) {
    console.warn('   (could not write preview file:', err.message + ')');
  }

  console.log('\n   --- Email summary ---');
  console.log('   Subject :', subject);
  console.log('   From    :', getSenderEmail());
  console.log('   To      :', TO);
  console.log('   CC      :', cc.length ? cc.join(', ') : '(none)');
  console.log('   --- Plain-text body ---');
  console.log(text.split('\n').map(l => '   ' + l).join('\n'));
  console.log('   -----------------------\n');

  try {
    const result = await sendMail({ to: TO, cc, subject, text, html });
    console.log('   OK — email accepted by SMTP server.');
    console.log('   messageId :', result.messageId);
    console.log('   response  :', result.response);
    console.log('   accepted  :', result.accepted);
    console.log('   rejected  :', result.rejected);
    console.log('\nDone. Check the inbox of:', TO);
    if (cc.length) console.log('CC delivered to:', cc.join(', '));
    process.exit(0);
  } catch (err) {
    console.error('   FAILED:', err.message);
    console.error('   → Most common causes:');
    console.error('     • Wrong ALERT_SENDER_PASSWORD (must be the actual Hostinger mailbox password)');
    console.error('     • Mailbox does not exist on Hostinger');
    console.error('     • Outbound port 465 blocked from this machine');
    process.exit(1);
  }
})();

// Standalone test for the LLM (LM Studio) narrative-generation pipeline.
// Run:  node scripts/test-llm-narrative.js
//
// This does NOT send any email and does NOT touch the database. It only
// calls the configured LM Studio endpoint with a synthetic critical alert
// and prints the three narrative sections (SOC ANALYSIS, RECOMMENDED
// ACTIONS, COMPLIANCE) so you can confirm the LLM is reachable and the
// JSON output is well-formed before going live.
import 'dotenv/config';
import { generateAlertNarrative, isLlmEnabled } from '../services/llmAnalysis.service.js';

(async () => {
  console.log('================================================');
  console.log(' LLM Narrative Generation - LM Studio test');
  console.log('================================================');
  console.log('LLM_ANALYSIS_ENABLED :', isLlmEnabled());
  console.log('LLM_BASE_URL         :', process.env.LLM_BASE_URL || 'http://192.168.3.50:1234');
  console.log('LLM_MODEL            :', process.env.LLM_MODEL || '(empty - LM Studio uses loaded model)');
  console.log('LLM_TIMEOUT_MS       :', process.env.LLM_TIMEOUT_MS || 60000);
  console.log('LLM_TEMPERATURE      :', process.env.LLM_TEMPERATURE || 0.3);
  console.log('LLM_MAX_TOKENS       :', process.env.LLM_MAX_TOKENS || 1500);
  console.log('------------------------------------------------');

  const sampleAlert = {
    alert_title: 'Possible SSH brute-force followed by successful login',
    alert_severity: 13,
    alert_time: new Date().toISOString(),
    rule_description: 'Multiple failed SSH login attempts followed by a successful login from an external IP in a high-risk geography',
    agent_name: 'web-prod-01',
    agent_ip: '10.0.0.21',
    target_user_name: 'root',
    mitre: 'T1110 - Brute Force, T1078 - Valid Accounts',
    geo_country: 'Russia',
    src_ip: '203.0.113.42',
    src_port: 52344,
    auth_package_name: 'NTLM',
    logon_type: 3,
    asset_criticality: 'High',
    threat_intel_match: 'Yes',
    kill_chain_phase: 'Credential Access / Initial Access'
  };

  console.log('\nSending synthetic alert to LM Studio...');
  const started = Date.now();
  const result = await generateAlertNarrative(sampleAlert);
  const elapsed = Date.now() - started;
  console.log(`(LLM round-trip: ${elapsed} ms)\n`);

  if (!result.ok) {
    console.error('FAILED to get narrative from LLM');
    console.error('  reason :', result.reason);
    if (result.error) console.error('  error  :', result.error);
    if (result.raw)   console.error('  raw    :', result.raw);
    console.error('\nTroubleshooting:');
    console.error('  - Is LM Studio actually running on', process.env.LLM_BASE_URL || 'http://192.168.3.50:1234', '?');
    console.error('  - Is a model loaded in LM Studio and the "Server" tab started?');
    console.error('  - From this machine, can you reach the LM Studio host? Try:');
    console.error('      curl', (process.env.LLM_BASE_URL || 'http://192.168.3.50:1234') + '/v1/models');
    console.error('  - If your model is slow to start, increase LLM_TIMEOUT_MS.');
    process.exit(1);
  }

  console.log('SOC ANALYSIS');
  console.log('------------');
  console.log(result.soc_analysis || '(empty)');
  console.log('\nRECOMMENDED ACTIONS (CLIENT)');
  console.log('----------------------------');
  if (result.recommended_actions.length === 0) {
    console.log('(empty)');
  } else {
    result.recommended_actions.forEach((a, i) => console.log(`${i + 1}. ${a}`));
  }
  console.log('\nCOMPLIANCE & REPORTING');
  console.log('----------------------');
  console.log(result.compliance_note || '(empty)');
  console.log('\nOK - LLM narrative generated successfully.');
  process.exit(0);
})();

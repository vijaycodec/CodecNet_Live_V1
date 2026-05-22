import axios from 'axios';

// LM Studio (or any OpenAI-compatible) endpoint that generates the three
// narrative sections for the critical-alert email:
//   1. SOC ANALYSIS
//   2. RECOMMENDED ACTIONS (CLIENT)
//   3. COMPLIANCE & REPORTING
//
// On any failure (network, timeout, bad JSON, HTTP error) we return ok:false
// so the caller can still send the email with the structured alert details
// and just omit the LLM-generated sections.

const LLM_BASE_URL = (process.env.LLM_BASE_URL || 'http://192.168.3.50:1234').replace(/\/+$/, '');
const LLM_MODEL = process.env.LLM_MODEL || '';
const LLM_API_KEY = process.env.LLM_API_KEY || '';
const LLM_TIMEOUT_MS = parseInt(process.env.LLM_TIMEOUT_MS, 10) || 60000;
const LLM_TEMPERATURE = parseFloat(process.env.LLM_TEMPERATURE) || 0.3;
const LLM_MAX_TOKENS = parseInt(process.env.LLM_MAX_TOKENS, 10) || 1500;
const LLM_ENABLED = (process.env.LLM_ANALYSIS_ENABLED || 'true').toLowerCase() !== 'false';

const SYSTEM_PROMPT = `You are a senior SOC (Security Operations Centre) analyst at CodecNet, an Indian managed-security-services provider. You analyse critical security alerts and produce client-facing incident narratives.

Given the structured telemetry for one critical alert, return a JSON object with EXACTLY these three keys:

1. "soc_analysis" (string) — 2 to 4 sentences. Explain what happened in plain English, why it matters, and what the attacker likely intended. Reference specific indicators from the telemetry (source IP, geography, account, MITRE technique) where present. No bullet points, no markdown.

2. "recommended_actions" (array of strings) — 5 to 8 concrete, prioritised remediation steps the CLIENT should take, in order of urgency. Each item is one sentence, imperative voice. Be specific to the telemetry (use the actual hostnames, IPs, accounts). Cover: containment, credential rotation, network blocks, MFA, hunting for lateral movement, and confirmation back to SOC. Do NOT include actions CodecNet SOC has already taken.

3. "compliance_note" (string) — 1 to 3 sentences. Discuss applicable Indian regulatory reporting obligations. ALWAYS mention CERT-In Directions, 28.04.2022 (6-hour reporting window for cyber incidents). Where relevant to the alert, also mention DPDP Act, RBI, SEBI, or IRDAI. Close by noting that CodecNet SOC can assist with documentation and CERT-In submission.

CRITICAL OUTPUT RULES:
- Return ONLY the raw JSON object. No markdown fences, no explanatory text, no preamble.
- All three keys must be present.
- recommended_actions must be a JSON array of strings, not a single concatenated string.
- Do not hallucinate IOCs, CVEs, or facts that are not in the supplied telemetry.`;

const buildUserPrompt = (alert) => {
  const fmt = (label, value) => {
    if (value === null || value === undefined) return null;
    const s = String(value).trim();
    if (!s || s.toUpperCase() === 'N/A') return null;
    return `- ${label}: ${s}`;
  };

  const lines = [
    fmt('Alert Title', alert.alert_title),
    fmt('Severity (Wazuh rule.level)', alert.alert_severity),
    fmt('Rule Description', alert.rule_description || alert.alert_description),
    fmt('Detected At', alert.alert_time),
    fmt('MITRE ATT&CK', alert.mitre),
    fmt('Agent / Hostname', alert.agent_name),
    fmt('Internal IP', alert.agent_ip),
    fmt('Target User Account', alert.target_user_name),
    fmt('Source IP', alert.src_ip),
    fmt('Source Country / GeoIP', alert.geo_country),
    fmt('Source Port', alert.src_port),
    fmt('Authentication Package', alert.auth_package_name),
    fmt('Logon Type', alert.logon_type),
    fmt('Asset Criticality', alert.asset_criticality),
    fmt('Threat Intel Match', alert.threat_intel_match),
    fmt('Kill Chain Phase', alert.kill_chain_phase)
  ].filter(Boolean);

  return `Alert telemetry:\n${lines.join('\n')}\n\nReturn the JSON object now.`;
};

const stripJsonFences = (text) => {
  let t = String(text).trim();
  t = t.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '');
  const firstBrace = t.indexOf('{');
  const lastBrace = t.lastIndexOf('}');
  if (firstBrace > 0 && lastBrace > firstBrace) {
    t = t.slice(firstBrace, lastBrace + 1);
  }
  return t.trim();
};

export const isLlmEnabled = () => LLM_ENABLED;

export const generateAlertNarrative = async (alert) => {
  if (!LLM_ENABLED) {
    return { ok: false, reason: 'disabled' };
  }
  if (!alert) {
    return { ok: false, reason: 'no_alert' };
  }

  const url = `${LLM_BASE_URL}/v1/chat/completions`;
  const headers = { 'Content-Type': 'application/json' };
  if (LLM_API_KEY) headers.Authorization = `Bearer ${LLM_API_KEY}`;

  const body = {
    model: LLM_MODEL,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: buildUserPrompt(alert) }
    ],
    temperature: LLM_TEMPERATURE,
    max_tokens: LLM_MAX_TOKENS,
    stream: false,
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'alert_narrative',
        strict: true,
        schema: {
          type: 'object',
          properties: {
            soc_analysis: { type: 'string' },
            recommended_actions: {
              type: 'array',
              items: { type: 'string' }
            },
            compliance_note: { type: 'string' }
          },
          required: ['soc_analysis', 'recommended_actions', 'compliance_note'],
          additionalProperties: false
        }
      }
    }
  };

  let response;
  try {
    response = await axios.post(url, body, {
      headers,
      timeout: LLM_TIMEOUT_MS,
      validateStatus: () => true
    });
  } catch (err) {
    const reason = err.code === 'ECONNABORTED' ? 'timeout' : 'network_error';
    return { ok: false, reason, error: err.message };
  }

  if (response.status < 200 || response.status >= 300) {
    const errText = typeof response.data === 'string'
      ? response.data
      : JSON.stringify(response.data || {});
    return { ok: false, reason: `http_${response.status}`, error: errText.slice(0, 500) };
  }

  // Reasoning-style models (Qwen 3.x, deepseek-r1, etc.) put their final JSON
  // into message.reasoning_content and leave message.content empty. Try
  // content first, fall back to reasoning_content.
  const message = response.data?.choices?.[0]?.message || {};
  const rawContent = (typeof message.content === 'string' && message.content.trim())
    || (typeof message.reasoning_content === 'string' && message.reasoning_content.trim())
    || '';
  if (!rawContent) {
    return { ok: false, reason: 'empty_response' };
  }

  let parsed;
  try {
    parsed = JSON.parse(stripJsonFences(rawContent));
  } catch (err) {
    return { ok: false, reason: 'invalid_json', error: err.message, raw: rawContent.slice(0, 500) };
  }

  const socAnalysis = typeof parsed.soc_analysis === 'string' ? parsed.soc_analysis.trim() : '';
  const recommendedActions = Array.isArray(parsed.recommended_actions)
    ? parsed.recommended_actions
        .filter((a) => typeof a === 'string' && a.trim())
        .map((a) => a.trim())
    : [];
  const complianceNote = typeof parsed.compliance_note === 'string' ? parsed.compliance_note.trim() : '';

  if (!socAnalysis && recommendedActions.length === 0 && !complianceNote) {
    return { ok: false, reason: 'all_sections_empty', raw: content.slice(0, 500) };
  }

  return {
    ok: true,
    soc_analysis: socAnalysis || null,
    recommended_actions: recommendedActions,
    compliance_note: complianceNote || null
  };
};

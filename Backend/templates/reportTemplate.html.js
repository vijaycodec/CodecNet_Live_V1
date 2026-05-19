/**
 * HTML Report Template Generator for SOC Report
 *
 * Layout strategy:
 *  - Simple page layout with proper margins
 *  - No fixed headers/footers to avoid content overlap
 *  - break-inside: avoid on all cards to prevent splitting across pages
 *  - page-break-before/after for explicit page breaks
 */

function generateSeverityBadge(severity) {
    const map = { critical: 'severity-critical', major: 'severity-major', minor: 'severity-minor' };
    const cls = map[severity] || 'severity-minor';
    return `<span class="severity-badge ${cls}">${severity.charAt(0).toUpperCase() + severity.slice(1)}</span>`;
}

function generateTopAlertsTable(topAlerts) {
    if (!topAlerts || topAlerts.length === 0) {
        return '<tr><td colspan="6" style="text-align:center;padding:20px;color:#64748b;">No alerts found</td></tr>';
    }
    return topAlerts.slice(0, 10).map((a, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${generateSeverityBadge(a.severity)}</td>
      <td>${a.description}</td>
      <td>${a.host}</td>
      <td>${a.count}</td>
      <td>${a.last_seen}</td>
    </tr>`).join('');
}

function generateStatCard(label, value) {
    return `
    <div class="stat-card">
      <span class="stat-label">${label}</span>
      <span class="stat-value">${value}</span>
    </div>`;
}

function generateCisItem(label, percentage, passed = 0, failed = 0) {
    const details = (passed || failed) ? ` (${passed} passed, ${failed} failed)` : '';
    return `
    <div class="cis-item">
      <span class="stat-label">${label}${details}</span>
      <div style="display:flex;align-items:center;gap:12px;">
        <span class="stat-value" style="font-size:16px;">${percentage}%</span>
        <div class="progress-bar" style="width:120px;">
          <div class="progress-fill" style="width:${percentage}%;"></div>
        </div>
      </div>
    </div>`;
}

function generateAgentCard(agent) {
    const statusCls = agent.status === 'active' ? 'status-online' : 'status-offline';
    const statusText = agent.status === 'active' ? 'Active'
        : agent.status === 'disconnected' ? 'Disconnected' : 'Never Connected';
    return `
    <div class="agent-card">
      <div class="agent-header">
        <span class="agent-title">${agent.name || 'Unknown'}</span>
        <span class="status-indicator ${statusCls}">${statusText}</span>
      </div>
      <div class="agent-detail">OS: ${agent.os || 'Unknown'}</div>
      <div class="agent-detail">IP: ${agent.ip || 'N/A'}</div>
      <div class="agent-detail">Version: ${agent.version || 'Unknown'}</div>
      ${agent.lastKeepAlive ? `<div class="agent-detail">Last Seen: ${new Date(agent.lastKeepAlive).toLocaleString()}</div>` : ''}
    </div>`;
}

export function generateHtmlReport(clientName, organisationName, statistics, reportName = '', frequency = 'weekly', template = 'executive') {
    const reportPeriod = statistics.report_period || {};
    const severityCounts = statistics.severity_counts || {};
    const severityPct = statistics.severity_percentages || {};
    const topAlerts = statistics.top_alerts || [];
    const dailyTrend = statistics.daily_trend || {};
    const alertTypes = statistics.alert_types || [];
    const agentSummary = statistics.agent_summary || {};
    const agentsList = statistics.agents_list || [];
    const cisData = statistics.cis_compliance || {};

    const periodStr = `${reportPeriod.start_date || 'N/A'} — ${reportPeriod.end_date || 'N/A'}`;
    const now = new Date();
    const generationDate = now.toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric',
        hour: 'numeric', minute: 'numeric', hour12: true
    });

    // ── Top alerts HTML ───────────────────────────────────────────────────────
    const topAlertsHtml = generateTopAlertsTable(topAlerts);

    // ── Alert type stat cards ─────────────────────────────────────────────────
    const alertTypeCards = alertTypes.slice(0, 10)
        .map(at => generateStatCard(at.type, at.count)).join('');

    // ── Agent detail cards (limit 12) ─────────────────────────────────────────
    const agentsCardsHtml = agentsList.slice(0, 100)
        .map(a => generateAgentCard(a)).join('');

    // ── CIS policy rows ───────────────────────────────────────────────────────
    let cisItemsHtml = '';
    if (cisData.policies && cisData.policies.length > 0) {
        cisItemsHtml = cisData.policies
            .map(p => generateCisItem(p.name, p.score, p.passed || 0, p.failed || 0))
            .join('');
    } else {
        cisItemsHtml = generateStatCard('No CIS compliance data available', '—');
    }

    // ── Per-agent CIS scores with proper card class for page break handling ──
    let agentsCisHtml = '';
    if (cisData.agents_sca && cisData.agents_sca.length > 0) {
        agentsCisHtml = cisData.agents_sca.map((a, i) => {
            const col = a.score >= 80 ? '#22c55e' : a.score >= 60 ? '#f97316' : '#ef4444';
            return `
        <div class="stat-card agent-compliance-card">
          <div style="flex:1;">
            <span class="stat-label">${i + 1}. ${a.agent_name}</span>
            <div style="font-size:11px;color:#64748b;margin-top:4px;">
              ${a.total_passed} passed, ${a.total_failed} failed (${a.policies_count} policies)
            </div>
          </div>
          <div style="text-align:right;">
            <div class="stat-value" style="font-size:22px;color:${col};">${a.score}%</div>
            <div class="progress-bar" style="width:90px;margin-top:6px;">
              <div class="progress-fill" style="width:${a.score}%;background:${col};"></div>
            </div>
          </div>
        </div>`;
        }).join('');
    } else {
        agentsCisHtml = generateStatCard('No per-agent CIS data available', '—');
    }

    // ── Text bar-chart helpers ────────────────────────────────────────────────
    const textBar = (val, max) => {
        if (!max) return '░'.repeat(20);
        const fill = Math.round((val / max) * 20);
        return '█'.repeat(fill) + '░'.repeat(20 - fill);
    };

    const maxSev = Math.max(severityCounts.critical || 0, severityCounts.major || 0, severityCounts.minor || 0, 1);
    const severityChartHtml = `
    <div style="font-family:monospace;font-size:12px;line-height:2;">
      <div style="display:flex;align-items:center;margin-bottom:6px;">
        <span style="width:80px;color:#ef4444;">Critical:</span>
        <span style="color:#ef4444;">${textBar(severityCounts.critical || 0, maxSev)}</span>
        <span style="margin-left:10px;color:#e4e7eb;">${severityCounts.critical || 0}</span>
      </div>
      <div style="display:flex;align-items:center;margin-bottom:6px;">
        <span style="width:80px;color:#f97316;">Major:</span>
        <span style="color:#f97316;">${textBar(severityCounts.major || 0, maxSev)}</span>
        <span style="margin-left:10px;color:#e4e7eb;">${severityCounts.major || 0}</span>
      </div>
      <div style="display:flex;align-items:center;">
        <span style="width:80px;color:#eab308;">Minor:</span>
        <span style="color:#eab308;">${textBar(severityCounts.minor || 0, maxSev)}</span>
        <span style="margin-left:10px;color:#e4e7eb;">${severityCounts.minor || 0}</span>
      </div>
    </div>`;

    const sortedDates = Object.keys(dailyTrend).sort();
    const last7Days = sortedDates.slice(-7);
    const maxDaily = Math.max(...last7Days.map(d => dailyTrend[d] || 0), 1);
    const dailyTrendChartHtml = last7Days.length > 0 ? `
    <div style="font-family:monospace;font-size:11px;line-height:2.2;padding:8px 0;">
      ${last7Days.map(date => {
        const count = dailyTrend[date] || 0;
        const label = new Date(date + 'T00:00:00Z')
            .toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric' });
        const fill = Math.round((count / maxDaily) * 40);
        return `
          <div style="display:flex;align-items:center;margin-bottom:4px;">
            <span style="width:70px;color:#94a3b8;">${label}:</span>
            <span style="color:#3b82f6;">${'█'.repeat(fill)}${'░'.repeat(40 - fill)}</span>
            <span style="margin-left:10px;color:#e4e7eb;font-weight:bold;">${count}</span>
          </div>`;
    }).join('')}
    </div>`
        : '<div style="color:#64748b;padding:16px;">No data for the last 7 days</div>';

    const total = agentSummary.total_agents || 0;
    const active = agentSummary.active_agents || 0;
    const disc = agentSummary.disconnected_agents || 0;
    const neverC = agentSummary.never_connected || 0;
    const healthPct = total > 0 ? Math.round((active / total) * 100) : 0;

    const agentHealthChartHtml = total > 0 ? `
    <div style="font-family:monospace;font-size:12px;line-height:2.5;padding:0px;">
      <div style="display:flex;align-items:center;margin-bottom:6px;">
        <span style="width:140px;color:#22c55e;">Active:</span>
        <span style="color:#22c55e;">${textBar(active, total)}</span>
        <span style="margin-left:10px;color:#e4e7eb;font-weight:bold;">${active}</span>
      </div>
      <div style="display:flex;align-items:center;margin-bottom:6px;">
        <span style="width:140px;color:#ef4444;">Disconnected:</span>
        <span style="color:#ef4444;">${textBar(disc, total)}</span>
        <span style="margin-left:10px;color:#e4e7eb;font-weight:bold;">${disc}</span>
      </div>
      <div style="display:flex;align-items:center;margin-bottom:10px;">
        <span style="width:140px;color:#f97316;">Never Connected:</span>
        <span style="color:#f97316;">${textBar(neverC, total)}</span>
        <span style="margin-left:10px;color:#e4e7eb;font-weight:bold;">${neverC}</span>
      </div>
      <div style="border-top:1px solid #334155;padding-top:10px;">
        <div style="color:#94a3b8;font-size:11px;margin-bottom:6px;">OVERALL HEALTH</div>
        <div style="display:flex;align-items:center;">
          <div style="flex:1;height:18px;background:rgba(15,23,42,0.8);border-radius:9px;overflow:hidden;">
            <div style="height:100%;width:${healthPct}%;background:linear-gradient(90deg,#22c55e,#3b82f6);"></div>
          </div>
          <span style="margin-left:12px;color:#22c55e;font-weight:bold;font-size:15px;">${healthPct}%</span>
        </div>
      </div>
    </div>`
        : '<div style="color:#64748b;padding:20px;text-align:center;">No agent data available</div>';

    // ─────────────────────────────────────────────────────────────────────────
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>SOC Report — ${organisationName} (${clientName})</title>
  <style>
    /* ── Reset and Base Styles ─────────────────────────────────────────── */
    * { 
      margin: 0; 
      padding: 0; 
      box-sizing: border-box; 
    }

    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background: #0f172a;
      color: #e4e7eb;
      line-height: 1.5;
    }

    /* ── Print Settings ────────────────────────────────────────────────── */
    @page {
      size: A4;
      margin: 5mm 5mm 5mm 5mm; /* top right bottom left */
    }

    @media print {
      body {
        background: #0f172a;
        padding: 0;
      }
      
      /* Remove any automatic page breaks that might be causing blank pages */
      .page {
        page-break-after: always !important;
        break-after: page !important;
      }
      
      .page:last-child {
        page-break-after: auto !important;
        break-after: auto !important;
      }
    }

    /* ── Page Container ────────────────────────────────────────────────── */
    .page {
      width: 100%;
      max-width: 210mm;
      margin: 0 auto;
      background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
      padding: 0;
      page-break-after: always;
      break-after: page;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    /* Remove page break from last page */
    .page:last-child {
      page-break-after: auto;
      break-after: auto;
    }

    .page-content {
      padding: 5mm 10mm 10mm 10mm;
    }

    /* ── Cover Page ────────────────────────────────────────────────────── */
    .cover-page .page-content {
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      text-align: center;
      min-height: 237mm; /* A4 height minus margins */
      padding: 10mm;
    }

    /* ── Section Headers ───────────────────────────────────────────────── */
    .section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin: 5mm 0 8mm 0;
      padding-bottom: 3mm;
      border-bottom: 2px solid #3b82f6;
      page-break-after: avoid;
    }

    .section-title {
      font-size: 24px;
      font-weight: 600;
      color: #e4e7eb;
    }

    .section-meta {
      font-size: 12px;
      color: #64748b;
    }

    /* ── CRITICAL: Prevent splitting of elements across pages ──────────── */
    .stat-card,
    .agent-card,
    .chart-box,
    .chart-row,
    .cis-section,
    .summary-section,
    .cis-item,
    .recommendation-item,
    .alert-table tr,
    .agent-grid > *,
    .agent-compliance-card {
      break-inside: avoid !important;
      page-break-inside: avoid !important;
    }

    /* ── Chart Layout ──────────────────────────────────────────────────── */
    .chart-row {
      display: flex;
      gap: 8mm;
      margin-bottom: 8mm;
      flex-wrap: wrap;
    }

    .chart-row > .chart-box {
      flex: 1 1 calc(50% - 4mm);
      min-width: 80mm;
    }

    .chart-row.full > .chart-box {
      flex: 1 1 100%;
    }

    .chart-box {
      background: rgba(30, 41, 59, 0.6);
      border: 1px solid #334155;
      border-radius: 8px;
      padding: 6mm;
    }

    .chart-title {
      font-size: 16px;
      font-weight: 600;
      color: #3b82f6;
      margin-bottom: 5mm;
    }

    /* ── Stat Cards ────────────────────────────────────────────────────── */
    .stat-card {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: rgba(15, 23, 42, 0.8);
      padding: 4mm 6mm;
      border-radius: 6px;
      margin-bottom: 3mm;
    }

    .stat-label {
      color: #94a3b8;
      font-size: 13px;
    }

    .stat-value {
      font-size: 22px;
      font-weight: 700;
      color: #3b82f6;
    }

    /* ── Alert Table ───────────────────────────────────────────────────── */
    .alert-table {
      width: 100%;
      border-collapse: collapse;
      margin: 5mm 0;
    }

    .alert-table th {
      background: #1e293b;
      color: #3b82f6;
      padding: 4mm 5mm;
      text-align: left;
      font-weight: 600;
      font-size: 12px;
      border-bottom: 2px solid #3b82f6;
    }

    .alert-table td {
      padding: 4mm 5mm;
      border-bottom: 1px solid #334155;
      font-size: 11px;
    }

    /* ── Severity Badges ───────────────────────────────────────────────── */
    .severity-badge {
      padding: 2mm 4mm;
      border-radius: 4px;
      font-size: 10px;
      font-weight: 600;
      display: inline-block;
    }

    .severity-critical {
      background: rgba(239, 68, 68, 0.2);
      color: #ef4444;
      border: 1px solid #ef4444;
    }

    .severity-major {
      background: rgba(249, 115, 22, 0.2);
      color: #f97316;
      border: 1px solid #f97316;
    }

    .severity-minor {
      background: rgba(234, 179, 8, 0.2);
      color: #eab308;
      border: 1px solid #eab308;
    }

    /* ── Agent Grid ────────────────────────────────────────────────────── */
    .agent-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 5mm;
      margin: 5mm 0;
    }

    .agent-card {
      background: rgba(30, 41, 59, 0.6);
      border: 1px solid #334155;
      border-radius: 8px;
      padding: 5mm;
    }

    .agent-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 4mm;
    }

    .agent-title {
      font-size: 14px;
      font-weight: 600;
      color: #cbd5e1;
    }

    .agent-detail {
      font-size: 11px;
      color: #94a3b8;
      margin-top: 2mm;
    }

    .status-indicator {
      padding: 1mm 3mm;
      border-radius: 12px;
      font-size: 10px;
      font-weight: 600;
    }

    .status-online {
      background: rgba(34, 197, 94, 0.2);
      color: #22c55e;
    }

    .status-offline {
      background: rgba(239, 68, 68, 0.2);
      color: #ef4444;
    }

    /* ── CIS sections ────────────────────────────────────────────────────── */
    .cis-section {
      background: rgba(30, 41, 59, 0.6);
      border: 1px solid #334155;
      border-radius: 8px;
      padding: 6mm;
      margin-bottom: 5mm;
      break-inside: avoid;
      page-break-inside: avoid;
      page-break-before: auto;
      page-break-after: auto;
    }

    .cis-section:last-child {
      margin-bottom: 0;
    }

    .cis-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 4mm;
    }

    .cis-title {
      font-size: 15px;
      font-weight: 600;
      color: #3b82f6;
    }

    .compliance-score {
      font-size: 24px;
      font-weight: 700;
      color: #22c55e;
    }

    .cis-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 3mm 0;
      border-bottom: 1px solid #334155;
    }

    .cis-item:last-child {
      border-bottom: none;
    }

    /* ── Agent Compliance Scores Cards ──────────────────────────── */
    .agent-compliance-card {
      break-inside: avoid !important;
      page-break-inside: avoid !important;
      margin-top: 3mm;
      margin-bottom: 3mm;
      page-break-before: auto;
    }

    .agent-compliance-card:first-of-type {
      margin-top: 0;
    }

    /* Container for agent compliance cards */
    .agent-compliance-container {
      margin-top: 3mm;
      padding-top: 1mm;
    }

    /* Ensure proper spacing when cards break to new page */
    @media print {
      .agent-compliance-card {
        page-break-inside: avoid;
        break-inside: avoid;
        margin-top: 3mm;
      }
      
      /* Add space after section header when content flows to new page */
      .cis-section {
        page-break-inside: avoid;
      }
      
      /* Ensure the first card after a page break has proper margin */
      .agent-compliance-card {
        margin-top: 3mm;
      }
    }

    /* Progress bar inside agent compliance cards */
    .agent-compliance-card .progress-bar {
      width: 90px;
      height: 6px;
      background: rgba(15, 23, 42, 0.8);
      border-radius: 3px;
      overflow: hidden;
      margin-top: 6px;
    }

    .agent-compliance-card .progress-fill {
      height: 100%;
      transition: width 0.3s ease;
    }

    /* ── Progress Bar ──────────────────────────────────────────────────── */
    .progress-bar {
      width: 100%;
      height: 4mm;
      background: rgba(15, 23, 42, 0.8);
      border-radius: 2mm;
      overflow: hidden;
      margin: 3mm 0;
    }

    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #3b82f6 0%, #22c55e 100%);
    }

    /* ── Summary Sections ──────────────────────────────────────────────── */
    .summary-section {
      background: rgba(30, 41, 59, 0.6);
      border: 1px solid #334155;
      border-radius: 8px;
      padding: 6mm;
      margin-bottom: 5mm;
      break-inside: avoid;
      page-break-inside: avoid;
    }

    .summary-section-title {
      font-size: 16px;
      font-weight: 600;
      color: #3b82f6;
      margin-bottom: 4mm;
    }

    .summary-text {
      color: #cbd5e1;
      line-height: 1.6;
      font-size: 12px;
      margin-bottom: 3mm;
    }

    .recommendation-item {
      padding: 2mm 0 2mm 6mm;
      position: relative;
      color: #cbd5e1;
      font-size: 12px;
      line-height: 1.5;
      border-bottom: 1px solid #1e293b;
    }

    .recommendation-item:last-child {
      border-bottom: none;
    }

    .recommendation-item::before {
      content: "▸";
      position: absolute;
      left: 0;
      color: #3b82f6;
      font-weight: bold;
    }

    /* ── Cover Elements ─────────────────────────────────────────────────── */
    .logo {
      font-size: 48px;
      font-weight: bold;
      color: #3b82f6;
      margin-bottom: 15mm;
    }

    .logo span {
      color: #60a5fa;
    }

    .report-title {
      font-size: 36px;
      font-weight: 700;
      color: #e4e7eb;
      margin-bottom: 5mm;
    }

    .report-subtitle {
      font-size: 20px;
      color: #94a3b8;
      margin-bottom: 15mm;
    }

    .client-info {
      background: rgba(30, 41, 59, 0.6);
      padding: 10mm 15mm;
      border-radius: 12px;
      border: 1px solid #334155;
      margin-bottom: 15mm;
    }

    .client-name {
      font-size: 28px;
      font-weight: 600;
      color: #3b82f6;
      margin-bottom: 3mm;
    }

    .report-period {
      font-size: 14px;
      color: #94a3b8;
      margin-top: 10mm;
    }

    /* ── Utility Classes ────────────────────────────────────────────────── */
    .text-center { text-align: center; }
    .mt-4 { margin-top: 4mm; }
    .mb-4 { margin-bottom: 4mm; }
  </style>
</head>
<body>

<!-- ═══════════════════════════════════════════════════════════ -->
<!-- PAGE 1 — Cover                                             -->
<!-- ═══════════════════════════════════════════════════════════ -->
<div class="page cover-page">
  <div class="page-content">
    <div class="logo">CODEC <span>NET</span></div>
    <h1 class="report-title">Security Operations Center</h1>
    <!-- <h2 class="report-subtitle">${frequency.charAt(0).toUpperCase() + frequency.slice(1)} Report</h2> -->

    <div class="client-info">
      <div class="client-name">${organisationName}</div>
      <div style="margin-top:3mm; font-size:14px; color:#94a3b8;">${template.charAt(0).toUpperCase() + template.slice(1)}</div>
    </div>

    <div class="report-period">Report Period: ${periodStr}</div>
    <div style="margin-top:4mm; font-size:11px; color:#475569;">Generated: ${generationDate}</div>
  </div>
</div>

<!-- ═══════════════════════════════════════════════════════════ -->
<!-- PAGE 2 — Top 10 Security Alerts                            -->
<!-- ═══════════════════════════════════════════════════════════ -->
<div class="page">
  <div class="page-content">
    <div class="section-header">
      <h2 class="section-title">Top 10 Security Alerts</h2>
      <span class="section-meta">${periodStr}</span>
    </div>

    <table class="alert-table">
      <thead>
        <tr>
          <th>#</th>
          <th>Severity</th>
          <th>Alert Description</th>
          <th>Host / Agent</th>
          <th>Count</th>
          <th>Last Seen</th>
        </tr>
      </thead>
      <tbody>${topAlertsHtml}</tbody>
    </table>
  </div>
</div>

<!-- ═══════════════════════════════════════════════════════════ -->
<!-- PAGE 3 — Alert Statistics & Trends                         -->
<!-- ═══════════════════════════════════════════════════════════ -->
<div class="page">
  <div class="page-content">
    <div class="section-header">
      <h2 class="section-title">Alert Statistics & Trends</h2>
      <span class="section-meta">${periodStr}</span>
    </div>

    <div class="chart-row">
      <div class="chart-box">
        <h3 class="chart-title">Alert Distribution</h3>
        ${generateStatCard('Critical', severityCounts.critical || 0)}
        ${generateStatCard('Major', severityCounts.major || 0)}
        ${generateStatCard('Minor', severityCounts.minor || 0)}
        ${generateStatCard('Total Alerts', severityCounts.total || 0)}
      </div>
      <div class="chart-box">
        <h3 class="chart-title">Alert Severity Breakdown</h3>
        <div style="padding:3mm 0;">
          ${severityChartHtml}
          <div style="margin-top:4mm; font-size:11px; color:#94a3b8;">
            Critical: ${severityPct.critical || 0}% &nbsp;|&nbsp;
            Major: ${severityPct.major || 0}% &nbsp;|&nbsp;
            Minor: ${severityPct.minor || 0}%
          </div>
        </div>
      </div>
    </div>

    <div class="chart-row full">
      <div class="chart-box">
        <h3 class="chart-title">Daily Alert Trend (Last 7 Days)</h3>
        ${dailyTrendChartHtml}
      </div>
    </div>

    <div class="chart-row full">
      <div class="chart-box">
        <h3 class="chart-title">Top 10 Alert Types</h3>
        ${alertTypeCards || generateStatCard('No alert type data available', '—')}
      </div>
    </div>
  </div>
</div>

<!-- ═══════════════════════════════════════════════════════════ -->
<!-- PAGE 4 — Agent Status Overview                             -->
<!-- ═══════════════════════════════════════════════════════════ -->
<div class="page">
  <div class="page-content">
    <div class="section-header">
      <h2 class="section-title">Agent Status Overview</h2>
      <span class="section-meta">${total} agents total</span>
    </div>

    <div class="chart-row">
      <div class="chart-box">
        <h3 class="chart-title">Agent Summary</h3>
        ${generateStatCard('Total Agents', agentSummary.total_agents || 0)}
        ${generateStatCard('Active', agentSummary.active_agents || 0)}
        ${generateStatCard('Disconnected', agentSummary.disconnected_agents || 0)}
        ${generateStatCard('Never Connected', agentSummary.never_connected || 0)}
      </div>
      <div class="chart-box">
        <h3 class="chart-title">Agent Health Status</h3>
        ${agentHealthChartHtml}
      </div>
    </div>

    ${agentsCardsHtml ? `
    <h3 class="chart-title" style="margin:6mm 0 4mm;">Agent Details</h3>
    <div class="agent-grid">${agentsCardsHtml}</div>` : `
    <div class="chart-box" style="margin-top:5mm;">
      <span class="stat-label">No agent details available</span>
    </div>`}
  </div>
</div>

<!-- ═══════════════════════════════════════════════════════════ -->
<!-- PAGE 5 — CIS Compliance Status                             -->
<!-- ═══════════════════════════════════════════════════════════ -->
<div class="page">
  <div class="page-content">
    <div class="section-header">
      <h2 class="section-title">CIS Compliance Status</h2>
      <span class="section-meta">SCA Score: ${cisData.overall_score || 0}%</span>
    </div>

    <div class="cis-section">
      <div class="cis-header">
        <span class="cis-title">Overall Compliance Score</span>
        <span class="compliance-score">${cisData.overall_score || 0}%</span>
      </div>
      <div class="progress-bar">
        <div class="progress-fill" style="width:${cisData.overall_score || 0}%;"></div>
      </div>
    </div>

    <div class="cis-section">
      <h3 class="cis-title" style="margin-bottom:4mm;">Configuration Findings Summary</h3>
      ${generateStatCard('Total Checks', cisData.total_checks || 0)}
      <div class="stat-card">
        <span class="stat-label">Passed</span>
        <span class="stat-value" style="font-size:18px; color:#22c55e;">${cisData.total_passed || 0}</span>
      </div>
      <div class="stat-card">
        <span class="stat-label">Failed</span>
        <span class="stat-value" style="font-size:18px; color:#ef4444;">${cisData.total_failed || 0}</span>
      </div>
    </div>

    <div class="cis-section">
      <h3 class="cis-title" style="margin-bottom:4mm;">Security Configuration Assessment — Per Policy</h3>
      ${cisItemsHtml}
    </div>

    <div class="cis-section">
      <h3 class="cis-title" style="margin-bottom:4mm;">Agent Compliance Scores</h3>
      <div class="agent-compliance-container">
        ${agentsCisHtml}
      </div>
    </div>
  </div>
</div>

<!-- ═══════════════════════════════════════════════════════════ -->
<!-- PAGE 6 — Executive Summary                                 -->
<!-- ═══════════════════════════════════════════════════════════ -->
<div class="page">
        <div class="page-content">
            <div class="page-header">
                <h2 class="page-title">Executive Summary</h2>
            </div>

            <div class="summary-section">
                <h3 class="section-title">Overview</h3>
                <p class="summary-text">
                    During the reporting period of ${periodStr}, our Security Operations Center monitored
                    and analyzed ${severityCounts.total || 0} security alerts across your infrastructure.
                    The alert distribution shows ${severityCounts.critical || 0} critical alerts,
                    ${severityCounts.major || 0} major alerts, and ${severityCounts.minor || 0} minor alerts.
                </p>
                <p class="summary-text">
                    Our team has been actively monitoring, triaging, and responding to security events in real-time.
                    ${agentSummary.total_agents || 0} agents are deployed across your infrastructure, with
                    ${agentSummary.active_agents || 0} currently active.
                </p>
                ${cisData.overall_score ? `
                <p class="summary-text">
                    Security configuration assessment shows an overall compliance score of ${cisData.overall_score}%
                    with ${cisData.total_failed || 0} failed checks requiring attention.
                </p>
                ` : ''}
            </div>
        </div>
</div>

</body>
</html>`;

return html.replace(/wazuh/gi, 'codecnet');
}
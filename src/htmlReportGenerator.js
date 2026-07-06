const fs = require('fs');
const path = require('path');
const { formatDuration } = require('./kpiCalculator');

/**
 * Gera um relatório HTML autocontido (sem dependência de servidor ou CDN)
 * a partir dos KPIs calculados — mesmo espírito do relatório do projeto
 * playwright-web-vitals-monitor: abre direto no navegador com duplo clique.
 */

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Gera uma lista de barras horizontais em SVG puro, sem libs externas.
function renderBarChart(data, { color = '#22d3ee', maxWidth = 380 } = {}) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
  const max = Math.max(...entries.map(([, v]) => v), 1);
  const total = entries.reduce((sum, [, v]) => sum + v, 0);
  const rowHeight = 34;
  const height = entries.length * rowHeight + 10;
  const viewBoxWidth = 720; // 180 (label) + 380 (barra) + 160 (margem para "N (NN%)")

  const bars = entries
    .map(([label, value], i) => {
      const barWidth = Math.max((value / max) * maxWidth, 2);
      const pct = total > 0 ? Math.round((value / total) * 100) : 0;
      const y = i * rowHeight;
      return `
        <text x="0" y="${y + 15}" class="bar-label">${escapeHtml(label)}</text>
        <rect x="180" y="${y + 4}" width="${barWidth}" height="18" rx="4" fill="${color}" />
        <text x="${180 + barWidth + 10}" y="${y + 17}" class="bar-value">${value} (${pct}%)</text>
      `;
    })
    .join('');

  return `<svg viewBox="0 0 ${viewBoxWidth} ${height}" width="100%" height="${height}" xmlns="http://www.w3.org/2000/svg">${bars}</svg>`;
}

// Cores semânticas por status — Concluído sempre verde (convenção universal),
// independente da ordem em que aparece no gráfico.
const STATUS_COLOR_RULES = [
  { match: /conclu[íi]d/i, color: '#34d399' }, // verde
  { match: /andamento|progress/i, color: '#f59e0b' }, // âmbar
  { match: /an[áa]lise|review/i, color: '#22d3ee' }, // ciano
  { match: /pendente|to.?do/i, color: '#94a3b8' }, // cinza neutro
];

function colorForStatus(status) {
  const rule = STATUS_COLOR_RULES.find((r) => r.match.test(status));
  return rule?.color ?? '#f87171'; // vermelho como fallback p/ status não mapeado
}

function renderStatusBarChart(byStatus) {
  const entries = Object.entries(byStatus).sort((a, b) => b[1] - a[1]);
  const max = Math.max(...entries.map(([, v]) => v), 1);
  const total = entries.reduce((sum, [, v]) => sum + v, 0);
  const rowHeight = 34;
  const height = entries.length * rowHeight + 10;
  const viewBoxWidth = 720;
  const maxWidth = 380;

  const bars = entries
    .map(([label, value], i) => {
      const barWidth = Math.max((value / max) * maxWidth, 2);
      const pct = total > 0 ? Math.round((value / total) * 100) : 0;
      const y = i * rowHeight;
      const color = colorForStatus(label);
      return `
        <text x="0" y="${y + 15}" class="bar-label">${escapeHtml(label)}</text>
        <rect x="180" y="${y + 4}" width="${barWidth}" height="18" rx="4" fill="${color}" />
        <text x="${180 + barWidth + 10}" y="${y + 17}" class="bar-value">${value} (${pct}%)</text>
      `;
    })
    .join('');

  return `<svg viewBox="0 0 ${viewBoxWidth} ${height}" width="100%" height="${height}" xmlns="http://www.w3.org/2000/svg">${bars}</svg>`;
}

function renderResolutionTable(avgResolutionDaysByPriority) {
  const rows = Object.entries(avgResolutionDaysByPriority)
    .map(
      ([priority, days]) => `
      <tr>
        <td>${escapeHtml(priority)}</td>
        <td class="num">${formatDuration(days)}</td>
      </tr>`,
    )
    .join('');

  if (!rows) {
    return `<p class="muted">Nenhuma issue concluída ainda — sem dados de tempo de resolução.</p>`;
  }

  return `
    <table class="resolution-table">
      <thead><tr><th>Prioridade</th><th>Tempo médio</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function generateHtmlReport(kpis, { projectKey = '', generatedAt = new Date() } = {}) {
  const formattedDate = generatedAt.toLocaleString('pt-BR');

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8" />
<title>Relatório de KPIs — Jira ${escapeHtml(projectKey)}</title>
<style>
  :root {
    --bg: #0b0f17;
    --card: #141a24;
    --border: #232b38;
    --text: #e5e7eb;
    --muted: #8b95a5;
    --accent: #22d3ee;
    --accent-2: #f59e0b;
    --accent-3: #34d399;
    --accent-4: #f87171;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    background: var(--bg);
    color: var(--text);
    font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
    padding: 32px;
  }
  header { margin-bottom: 28px; }
  h1 {
    font-size: 24px;
    margin: 0 0 4px 0;
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .subtitle { color: var(--muted); font-size: 14px; }
  .cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    gap: 16px;
    margin-bottom: 32px;
  }
  .card {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 18px;
  }
  .card .number { font-size: 30px; font-weight: 700; font-family: 'Cascadia Code', Consolas, monospace; }
  .card .label { color: var(--muted); font-size: 13px; margin-top: 4px; }
  .card-total { border-color: var(--accent); border-width: 2px; }
  .total-row { margin-top: -12px; }
  .cards-note { color: var(--muted); font-size: 12px; margin: -20px 0 20px 0; }
  .grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
  }
  @media (max-width: 900px) {
    .grid { grid-template-columns: 1fr; }
  }
  .panel {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 20px;
  }
  .panel h2 {
    font-size: 15px;
    margin: 0 0 16px 0;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .bar-label { fill: var(--text); font-size: 12px; }
  .bar-value { fill: var(--muted); font-size: 12px; font-family: Consolas, monospace; }
  table.resolution-table { width: 100%; border-collapse: collapse; font-size: 13px; }
  table.resolution-table th, table.resolution-table td {
    text-align: left; padding: 8px 10px; border-bottom: 1px solid var(--border);
  }
  table.resolution-table th { color: var(--muted); font-weight: 600; }
  td.num { font-family: Consolas, monospace; }
  .muted { color: var(--muted); font-size: 13px; }
</style>
</head>
<body>
  <header>
    <h1>📊 Relatório de KPIs — Jira ${escapeHtml(projectKey)}</h1>
    <div class="subtitle">Gerado em ${escapeHtml(formattedDate)} · ${kpis.total} issues no total</div>
  </header>

  <div class="cards">
    ${Object.entries(kpis.byStatus)
      .sort((a, b) => b[1] - a[1])
      .map(
        ([status, count]) => `
      <div class="card"><div class="number" style="color: ${colorForStatus(status)}">${count}</div><div class="label">${escapeHtml(status)}</div></div>`,
      )
      .join('')}
    <div class="card card-total"><div class="number" style="color: var(--accent)">${kpis.total}</div><div class="label">Total de issues</div></div>
  </div>
  <div class="cards-note">Os 4 primeiros cards somam ${kpis.total} (= o último card) — são os status que compõem o total, cada issue está em exatamente um.</div>

  <div class="cards">
    ${Object.entries(kpis.byTagConcluded)
      .sort((a, b) => b[1] - a[1])
      .map(
        ([tag, count]) => `
      <div class="card"><div class="number" style="color: var(--accent-3)">${count}</div><div class="label">Concluído: ${escapeHtml(tag)}</div></div>`,
      )
      .join('')}
    <div class="card card-total"><div class="number" style="color: var(--accent-3)">${Object.values(kpis.byTagConcluded).reduce((a, b) => a + b, 0)}</div><div class="label">Total concluídas</div></div>
  </div>
  <div class="cards-note">Os cards de categoria somam o total concluídas (= último card) — <strong>não</strong> soma com o total geral de ${kpis.total} acima, é um recorte só das issues já Concluídas.</div>

  <div class="grid">
    <div class="panel">
      <h2>Por categoria</h2>
      ${renderBarChart(kpis.byTag, { color: 'var(--accent)' })}
    </div>
    <div class="panel">
      <h2>Por prioridade</h2>
      ${renderBarChart(kpis.byPriority, { color: 'var(--accent-2)' })}
    </div>
    <div class="panel">
      <h2>Por status</h2>
      ${renderStatusBarChart(kpis.byStatus)}
    </div>
    <div class="panel">
      <h2>Tempo médio de resolução</h2>
      ${renderResolutionTable(kpis.avgResolutionDaysByPriority)}
    </div>
  </div>

</body>
</html>`;

  return html;
}

function saveHtmlReport(kpis, outputDir, options = {}) {
  fs.mkdirSync(outputDir, { recursive: true });
  const filePath = path.join(outputDir, 'jira-kpi-report.html');
  fs.writeFileSync(filePath, generateHtmlReport(kpis, options));
  return filePath;
}

module.exports = { generateHtmlReport, saveHtmlReport };

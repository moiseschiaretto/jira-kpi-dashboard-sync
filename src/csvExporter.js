const { createObjectCsvWriter } = require('csv-writer');
const path = require('path');
const fs = require('fs');
const { extractTags } = require('./kpiCalculator');

async function exportIssuesToCsv(issues, outputDir) {
  fs.mkdirSync(outputDir, { recursive: true });

  const filePath = path.join(outputDir, 'jira-issues.csv');
  const writer = createObjectCsvWriter({
    path: filePath,
    header: [
      { id: 'key', title: 'Chave' },
      { id: 'tag', title: 'Categoria' },
      { id: 'type', title: 'Tipo' },
      { id: 'summary', title: 'Resumo' },
      { id: 'priority', title: 'Prioridade' },
      { id: 'status', title: 'Status' },
      { id: 'created', title: 'Criado em' },
      { id: 'resolutionDate', title: 'Resolvido em' },
    ],
  });

  const rows = issues.map((issue) => {
    const tags = extractTags(issue.fields.summary ?? '');
    return {
      key: issue.key,
      tag: tags[0] ?? 'Sem tag',
      type: issue.fields.issuetype?.name ?? '',
      summary: issue.fields.summary ?? '',
      priority: issue.fields.priority?.name ?? '',
      status: issue.fields.status?.name ?? '',
      created: issue.fields.created ?? '',
      resolutionDate: issue.fields.resolutiondate ?? '',
    };
  });

  await writer.writeRecords(rows);
  return filePath;
}

async function exportKpiSummaryToCsv(kpis, outputDir) {
  fs.mkdirSync(outputDir, { recursive: true });

  const filePath = path.join(outputDir, 'jira-kpi-summary.csv');
  const writer = createObjectCsvWriter({
    path: filePath,
    header: [
      { id: 'dimensao', title: 'Dimensão' },
      { id: 'chave', title: 'Chave' },
      { id: 'valor', title: 'Valor' },
    ],
  });

  const rows = [];
  for (const [tag, count] of Object.entries(kpis.byTag)) {
    rows.push({ dimensao: 'Categoria', chave: tag, valor: count });
  }
  for (const [type, count] of Object.entries(kpis.byType)) {
    rows.push({ dimensao: 'Tipo', chave: type, valor: count });
  }
  for (const [priority, count] of Object.entries(kpis.byPriority)) {
    rows.push({ dimensao: 'Prioridade', chave: priority, valor: count });
  }
  for (const [status, count] of Object.entries(kpis.byStatus)) {
    rows.push({ dimensao: 'Status', chave: status, valor: count });
  }
  for (const [priority, avgDays] of Object.entries(kpis.avgResolutionDaysByPriority)) {
    rows.push({ dimensao: 'Tempo médio de resolução (dias)', chave: priority, valor: avgDays });
  }
  rows.push({ dimensao: 'Total', chave: 'Todas as issues', valor: kpis.total });

  await writer.writeRecords(rows);
  return filePath;
}

module.exports = { exportIssuesToCsv, exportKpiSummaryToCsv };

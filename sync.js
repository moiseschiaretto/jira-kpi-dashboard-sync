require('dotenv').config();
const JiraClient = require('./src/jiraClient');
const { calculateKpis, formatDuration } = require('./src/kpiCalculator');
const { exportIssuesToCsv, exportKpiSummaryToCsv } = require('./src/csvExporter');
const { saveHtmlReport } = require('./src/htmlReportGenerator');

const OUTPUT_DIR = './kpi-results';

async function main() {
  const startTime = Date.now();
  console.log('🎬 Iniciando sincronização de KPIs do Jira\n');

  const client = new JiraClient({
    baseUrl: process.env.JIRA_BASE_URL,
    email: process.env.JIRA_EMAIL,
    apiToken: process.env.JIRA_API_TOKEN,
  });

  const projectKey = process.env.JIRA_PROJECT_KEY;
  if (!projectKey) {
    throw new Error('JIRA_PROJECT_KEY não definido no .env');
  }

  console.log(`🔎 Buscando issues do projeto ${projectKey}...`);
  const issues = await client.searchIssues(`project = ${projectKey} ORDER BY created ASC`);
  console.log(`   ${issues.length} issues encontradas\n`);

  console.log('📊 Calculando KPIs...');
  const kpis = calculateKpis(issues);

  console.log('\n📁 CATEGORIA (tag)');
  for (const [tag, count] of Object.entries(kpis.byTag).sort((a, b) => b[1] - a[1])) {
    console.log(`   ${tag.padEnd(25)} ${count}`);
  }

  console.log('\n🚦 PRIORIDADE');
  for (const [priority, count] of Object.entries(kpis.byPriority).sort((a, b) => b[1] - a[1])) {
    console.log(`   ${priority.padEnd(25)} ${count}`);
  }

  console.log('\n📌 STATUS');
  for (const [status, count] of Object.entries(kpis.byStatus).sort((a, b) => b[1] - a[1])) {
    console.log(`   ${status.padEnd(25)} ${count}`);
  }

  if (Object.keys(kpis.avgResolutionDaysByPriority).length > 0) {
    console.log('\n⏱️  TEMPO MÉDIO DE RESOLUÇÃO (por prioridade)');
    for (const [priority, days] of Object.entries(kpis.avgResolutionDaysByPriority)) {
      console.log(`   ${priority.padEnd(25)} ${formatDuration(days)}`);
    }
  }

  console.log(`\n📦 Exportando arquivos para ${OUTPUT_DIR}/...`);
  const issuesPath = await exportIssuesToCsv(issues, OUTPUT_DIR);
  const kpiPath = await exportKpiSummaryToCsv(kpis, OUTPUT_DIR);
  console.log(`   ✓ ${issuesPath}`);
  console.log(`   ✓ ${kpiPath}`);

  const htmlPath = saveHtmlReport(kpis, OUTPUT_DIR, { projectKey });
  console.log(`   ✓ ${htmlPath}`);

  const totalDuration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n✅ Sincronização concluída em ${totalDuration}s — ${kpis.total} issues processadas\n`);
}

main().catch((error) => {
  console.error('\n❌ Erro durante a sincronização:');
  if (error.response) {
    console.error(`   Status: ${error.response.status}`);
    console.error(`   Resposta: ${JSON.stringify(error.response.data)}`);
  } else {
    console.error(`   ${error.message}`);
  }
  process.exit(1);
});

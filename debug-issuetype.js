require('dotenv').config();
const JiraClient = require('./src/jiraClient');

async function main() {
  const client = new JiraClient({
    baseUrl: process.env.JIRA_BASE_URL,
    email: process.env.JIRA_EMAIL,
    apiToken: process.env.JIRA_API_TOKEN,
  });

  const projectKey = process.env.JIRA_PROJECT_KEY;
  const issues = await client.searchIssues(`project = ${projectKey} ORDER BY created ASC`);

  console.log(`Total de issues: ${issues.length}\n`);
  console.log('Chave       | Tipo (issuetype.name)   | Resumo');
  console.log('-'.repeat(80));
  for (const issue of issues.slice(0, 15)) {
    const key = issue.key.padEnd(11);
    const type = (issue.fields.issuetype?.name ?? 'undefined').padEnd(24);
    const summary = (issue.fields.summary ?? '').slice(0, 40);
    console.log(`${key} | ${type} | ${summary}`);
  }
}

main().catch((e) => console.error(e.response?.data ?? e.message));

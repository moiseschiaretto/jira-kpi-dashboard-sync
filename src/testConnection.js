require('dotenv').config();
const JiraClient = require('./jiraClient');

async function main() {
  const client = new JiraClient({
    baseUrl: process.env.JIRA_BASE_URL,
    email: process.env.JIRA_EMAIL,
    apiToken: process.env.JIRA_API_TOKEN,
  });

  console.log('🔌 Testando conexão com o Jira...\n');

  try {
    const me = await client.testConnection();
    console.log('✅ Conexão bem-sucedida!');
    console.log(`   Autenticado como: ${me.displayName} (${me.emailAddress})`);
  } catch (error) {
    console.error('❌ Falha na conexão.');
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Resposta: ${JSON.stringify(error.response.data)}`);
    } else {
      console.error(`   ${error.message}`);
    }
    process.exit(1);
  }
}

main();

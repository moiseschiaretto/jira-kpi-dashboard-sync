const axios = require('axios');

/**
 * Cliente para a API REST v3 do Jira Cloud.
 *
 * Autenticação: Basic Auth com e-mail + API Token (formato exigido pelo
 * Jira Cloud — https://developer.atlassian.com/cloud/jira/platform/basic-auth-for-rest-apis/).
 *
 * Endpoint usado: /rest/api/3/search/jql — o endpoint /rest/api/3/search
 * antigo foi descontinuado pela Atlassian; o novo exige paginação via
 * nextPageToken em vez de startAt.
 */
class JiraClient {
  constructor({ baseUrl, email, apiToken }) {
    if (!baseUrl || !email || !apiToken) {
      throw new Error(
        'JIRA_BASE_URL, JIRA_EMAIL e JIRA_API_TOKEN precisam estar definidos no .env',
      );
    }

    this.baseUrl = baseUrl.replace(/\/+$/, ''); // remove barra final, se houver
    this.authHeader = `Basic ${Buffer.from(`${email}:${apiToken}`).toString('base64')}`;
  }

  /**
   * Busca todas as issues que casam com a JQL informada, paginando
   * automaticamente até não haver mais páginas.
   *
   * @param {string} jql - ex: 'project = SCRUM ORDER BY created DESC'
   * @param {string[]} fields - campos a retornar (reduz o payload)
   */
  async searchIssues(jql, fields = ['summary', 'issuetype', 'priority', 'status', 'created', 'resolutiondate']) {
    const allIssues = [];
    let nextPageToken;

    do {
      const response = await axios.post(
        `${this.baseUrl}/rest/api/3/search/jql`,
        {
          jql,
          fields,
          maxResults: 100,
          ...(nextPageToken ? { nextPageToken } : {}),
        },
        {
          headers: {
            Authorization: this.authHeader,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
        },
      );

      allIssues.push(...response.data.issues);
      nextPageToken = response.data.nextPageToken;
    } while (nextPageToken);

    return allIssues;
  }

  /** Testa a conexão e autenticação buscando o usuário atual. */
  async testConnection() {
    const response = await axios.get(`${this.baseUrl}/rest/api/3/myself`, {
      headers: { Authorization: this.authHeader, Accept: 'application/json' },
    });
    return response.data; // { accountId, displayName, emailAddress, ... }
  }
}

module.exports = JiraClient;

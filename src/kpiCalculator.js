/**
 * Calcula KPIs a partir da lista bruta de issues retornada pelo Jira.
 *
 * Convenção de tags: cada issue tem uma ou mais tags no início do Resumo,
 * entre colchetes — ex: "[Bug] Erro ao aplicar cupom" ou
 * "[Automação][Back-end] Cobertura de contrato para endpoint /users".
 * extractTags() lê todas as tags encontradas no início do texto.
 */

function extractTags(summary) {
  // Casa o bloco de tags no início do texto, ex: "[Automação][Back-end] Resto..."
  const leadingMatch = summary.match(/^\s*((?:\[[^\]]+\])+)/);
  if (!leadingMatch) return [];

  const tagBlock = leadingMatch[1];
  return [...tagBlock.matchAll(/\[([^\]]+)\]/g)].map((m) => m[1]);
}

function daysBetween(dateA, dateB) {
  const ms = new Date(dateB) - new Date(dateA);
  return ms / (1000 * 60 * 60 * 24);
}

const DONE_STATUS = 'Concluído';

function calculateKpis(issues) {
  const byTag = {};
  const byType = {};
  const byPriority = {};
  const byStatus = {};
  const byTagConcluded = {};
  const resolutionDaysByPriority = {};

  for (const issue of issues) {
    const summary = issue.fields.summary ?? '';
    const type = issue.fields.issuetype?.name ?? 'Desconhecido';
    const priority = issue.fields.priority?.name ?? 'Sem prioridade';
    const status = issue.fields.status?.name ?? 'Desconhecido';
    const created = issue.fields.created;
    const resolutionDate = issue.fields.resolutiondate;

    // Tags (primeira tag encontrada define a categoria principal)
    const tags = extractTags(summary);
    const mainTag = tags[0] ?? 'Sem tag';
    byTag[mainTag] = (byTag[mainTag] ?? 0) + 1;

    byType[type] = (byType[type] ?? 0) + 1;
    byPriority[priority] = (byPriority[priority] ?? 0) + 1;
    byStatus[status] = (byStatus[status] ?? 0) + 1;

    if (status === DONE_STATUS) {
      byTagConcluded[mainTag] = (byTagConcluded[mainTag] ?? 0) + 1;
    }

    if (resolutionDate && created) {
      const days = daysBetween(created, resolutionDate);
      if (!resolutionDaysByPriority[priority]) resolutionDaysByPriority[priority] = [];
      resolutionDaysByPriority[priority].push(days);
    }
  }

  const avgResolutionDaysByPriority = Object.fromEntries(
    Object.entries(resolutionDaysByPriority).map(([priority, days]) => [
      priority,
      Number((days.reduce((sum, d) => sum + d, 0) / days.length).toFixed(2)),
    ]),
  );

  return {
    total: issues.length,
    byTag,
    byType,
    byPriority,
    byStatus,
    byTagConcluded,
    avgResolutionDaysByPriority,
  };
}

/**
 * Converte um número fracionário de dias (ex: 0.06) em texto legível,
 * tipo "1h 26min" ou "2d 3h" — evita mostrar frações de dia cruas,
 * que não dizem nada de útil pra quem está lendo o relatório.
 */
function formatDuration(days) {
  const totalMinutes = Math.round(days * 24 * 60);

  if (totalMinutes < 60) {
    return `${totalMinutes}min`;
  }

  const totalHours = Math.floor(totalMinutes / 60);
  const remainingMinutes = totalMinutes % 60;

  if (totalHours < 24) {
    return remainingMinutes > 0 ? `${totalHours}h ${remainingMinutes}min` : `${totalHours}h`;
  }

  const wholeDays = Math.floor(totalHours / 24);
  const remainingHours = totalHours % 24;

  return remainingHours > 0 ? `${wholeDays}d ${remainingHours}h` : `${wholeDays}d`;
}

module.exports = { calculateKpis, extractTags, formatDuration };

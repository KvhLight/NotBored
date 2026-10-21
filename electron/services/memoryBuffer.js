/**
 * Estima tokens de un string (aprox 4 chars = 1 token)
 */
function estimateTokens(text) {
  return Math.ceil((text || '').length / 4);
}

/**
 * Buffer de Contexto con Resumen Automático
 *
 * En vez de cortar mensajes abruptamente cuando se acerca al límite,
 * comprime los mensajes más antiguos en un bloque de "historia resumida"
 * que mantiene la continuidad narrativa sin gastar tokens.
 *
 * @param {Array}  messages     - Array completo de mensajes de la conv.
 * @param {String} systemPrompt - System prompt del personaje.
 * @param {Number} maxTokens    - Límite de tokens del contexto (ej: 4000).
 * @returns {Array} messages listos para enviar a la API.
 */
function buildContextWindow(messages, systemPrompt, maxTokens = 4000) {
  const systemMsg = { role: 'system', content: systemPrompt };
  const systemTokens = estimateTokens(systemPrompt);

  // Reservamos: sistema + 300 para la respuesta + 200 de margen
  const budgetForHistory = maxTokens - systemTokens - 500;

  if (budgetForHistory <= 0 || messages.length === 0) {
    return [systemMsg];
  }

  // Filtramos el greeting (id: 'greeting') si existe — ya está cubierto
  // por el greetingMsg del personaje en su system prompt,
  // así que no necesita ocupar espacio en el historial.
  const history = messages.filter(m => m.id !== 'greeting');

  // — Fase 1: intentar meter todos los mensajes recientes —
  const contextMessages = [];
  let usedTokens = 0;
  const reversed = [...history].reverse();

  for (const msg of reversed) {
    const msgTokens = estimateTokens(msg.content);
    if (usedTokens + msgTokens > budgetForHistory) break;
    contextMessages.unshift({ role: msg.role, content: msg.content });
    usedTokens += msgTokens;
  }

  // — Fase 2: si hubo mensajes que no cupieron, crear bloque de historia —
  const includedCount = contextMessages.length;
  const olderMessages = history.slice(0, history.length - includedCount);

  if (olderMessages.length > 0) {
    // Construimos un resumen compacto de lo que pasó antes
    const summaryLines = olderMessages.map(m => {
      const speaker = m.role === 'user' ? 'User' : 'Character';
      // Truncamos a 120 chars para que el resumen sea compacto
      const snippet = (m.content || '').slice(0, 120).replace(/\n/g, ' ');
      return `${speaker}: ${snippet}${m.content.length > 120 ? '…' : ''}`;
    });

    const summaryBlock = {
      role: 'system',
      content: `[Earlier in this conversation — summary for context continuity]\n${summaryLines.join('\n')}`,
    };

    // Solo lo añadimos si cabe dentro del presupuesto restante
    const summaryTokens = estimateTokens(summaryBlock.content);
    if (summaryTokens < budgetForHistory - usedTokens) {
      return [systemMsg, summaryBlock, ...contextMessages];
    }
  }

  // Caso base: sin historial antiguo o no cabe el resumen
  if (contextMessages.length === 0 && history.length > 0) {
    const last = history[history.length - 1];
    return [systemMsg, { role: last.role, content: last.content }];
  }

  return [systemMsg, ...contextMessages];
}

module.exports = { buildContextWindow, estimateTokens };

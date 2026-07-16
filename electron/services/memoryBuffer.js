/**
 * Estima tokens de un string (aprox 4 chars = 1 token)
 * Para producción usar tiktoken o el contador real de la API
 */
function estimateTokens(text) {
  return Math.ceil(text.length / 4);
}

/**
 * Buffer Circular de Contexto
 * Mantiene el historial dentro del límite de tokens.
 *
 * @param {Array} messages - Array completo de mensajes de la conv.
 * @param {String} systemPrompt - System prompt del personaje.
 * @param {Number} maxTokens - Límite de tokens del contexto (ej: 4000).
 * @returns {Array} messages listos para enviar a la API.
 */
function buildContextWindow(messages, systemPrompt, maxTokens = 4000) {
  const systemMsg = {
    role: 'system',
    content: systemPrompt,
  };

  const systemTokens = estimateTokens(systemPrompt);
  let availableTokens = maxTokens - systemTokens - 200; // 200 buffer para respuesta

  // Tomar mensajes desde el más reciente hacia atrás
  const contextMessages = [];
  const reversed = [...messages].reverse();

  for (const msg of reversed) {
    const msgTokens = estimateTokens(msg.content);
    
    // Si el mensaje actual supera los tokens disponibles, dejamos de añadir más antiguos
    if (msgTokens > availableTokens) {
      break;
    }
    
    contextMessages.unshift({ role: msg.role, content: msg.content });
    availableTokens -= msgTokens;
  }

  // Asegurarse de que hay al menos 1 mensaje del usuario
  if (contextMessages.length === 0 && messages.length > 0) {
    const last = messages[messages.length - 1];
    contextMessages.push({ role: last.role, content: last.content });
  }

  return [systemMsg, ...contextMessages];
}

module.exports = { 
  buildContextWindow, 
  estimateTokens 
};
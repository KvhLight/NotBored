// ============================================================================
// memoryAnalysis.js
//
// Genera "recuerdos" (hechos importantes o relevantes) a partir de los
// mensajes recientes de una conversación. Se dividen en tres categorías:
// sobre el usuario, sobre el personaje, o sobre ambos.
//
// Se puede disparar de dos formas (ver ChatWindow.jsx):
//   - Automáticamente cada N mensajes (configurable, o desactivable).
//   - A mano, con el botón "Actualizar recuerdos ahora" del panel de Memoria.
// ============================================================================

import { callAIOnce } from './webAdapter.js';

const VALID_CATEGORIES = ['user', 'character', 'both'];

/**
 * Analiza los mensajes NUEVOS (desde el último corte) de una conversación y
 * devuelve los recuerdos nuevos ya guardados. Quien la llama decide CUÁNDO
 * invocarla (automático cada N mensajes, o a mano) — esta función solo hace
 * el trabajo de un disparo.
 */
export async function generateMemories({ conversationId, character, messages, providerId } = {}) {
  const [existingMemories, lastCount] = await Promise.all([
    window.electronAPI.conversations.getMemories(conversationId),
    window.electronAPI.conversations.getLastMemoryMessageCount(conversationId),
  ]);

  const newMessages = messages.slice(lastCount);
  if (newMessages.length === 0) {
    return { success: true, added: [] };
  }

  const transcript = newMessages
    .map(m => `${m.role === 'user' ? 'Usuario' : character.name}: ${m.content}`)
    .join('\n');

  const existingSummary = existingMemories.length > 0
    ? existingMemories.map(m => `- [${m.category}] ${m.text}`).join('\n')
    : '(ninguno todavía)';

  const systemPrompt = `Extraes hechos importantes o relevantes de un fragmento de conversación de rol, para que una IA los recuerde más adelante aunque la conversación se alargue mucho.
Responde SOLO con un JSON válido, sin markdown ni texto extra.
Reglas:
- Solo incluye hechos genuinamente relevantes para el futuro de la conversación (nombres, preferencias, decisiones, sucesos importantes, relaciones, promesas...). Ignora charla trivial.
- Si no hay nada relevante en este fragmento, devuelve una lista vacía — no inventes nada para rellenar.
- No dupliques algo que ya esté en los recuerdos existentes.
- Cada recuerdo debe ser una frase corta y concreta, no un resumen largo.`;

  const userPrompt = `Recuerdos que ya existen:
${existingSummary}

Fragmento nuevo de la conversación (personaje: ${character.name}):
"""
${transcript}
"""

Devuelve exactamente este JSON:
{
  "memories": [
    { "category": "user" | "character" | "both", "text": "hecho concreto y corto" }
  ]
}`;

  const result = await callAIOnce({
    providerId,
    systemPrompt,
    userPrompt,
    temperature: 0.3,
    maxTokens: 500,
  });

  // Actualizamos el contador de mensajes procesados pase lo que pase, para
  // no volver a intentarlo con el mismo tramo si falla por otra razón
  await window.electronAPI.conversations.setLastMemoryMessageCount(conversationId, messages.length);

  if (!result.success) {
    return { success: false, error: result.error, added: [] };
  }

  try {
    const clean = result.text.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(clean);
    const candidates = Array.isArray(parsed.memories) ? parsed.memories : [];

    const added = [];
    for (const m of candidates) {
      const category = VALID_CATEGORIES.includes(m.category) ? m.category : 'both';
      const text = (m.text || '').trim();
      if (!text) continue;
      const saved = await window.electronAPI.conversations.addMemory(conversationId, { category, text, auto: true });
      added.push(saved);
    }
    return { success: true, added };
  } catch {
    return { success: false, error: 'La IA no devolvió recuerdos en un formato válido.', added: [] };
  }
}

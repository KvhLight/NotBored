// ============================================================================
// groupChat.js
//
// El resto de la app (sendMessage, callAIOnce, streaming, proxy...) no
// necesita saber nada de "grupos" — solo entiende personaje + historial +
// mensaje. Este archivo se encarga de traducir "una sala con varios
// personajes" a ese mismo formato, desde el punto de vista de quien vaya a
// hablar en cada momento:
//
//   - Sus propios mensajes anteriores → role 'assistant' (tal cual).
//   - Los de cualquier otro (tú u otro personaje) → role 'user', con el
//     nombre de quien habló delante, para que no se confunda.
// ============================================================================

import { callAIOnce } from './webAdapter.js';

/**
 * Le pregunta a la IA quién tendría más sentido que hablara a continuación,
 * dado el contexto reciente. Se calcula solo cuando abres el selector (no
 * en cada mensaje) para no gastar de más — es una sugerencia opcional, la
 * decisión final siempre la tomas tú.
 */
export async function suggestNextSpeaker({ messages, characters, group }) {
  if (!characters || characters.length === 0) return null;

  const recentTranscript = messages.slice(-8).map(m => {
    const speaker = m.speakerId === 'user' ? 'Usuario' : (characters.find(c => c.id === m.speakerId)?.name || 'Alguien');
    return `${speaker}: ${m.content}`;
  }).join('\n');

  const systemPrompt = 'Sugieres quién debería hablar a continuación en una escena de rol grupal. Responde SOLO con el nombre exacto de un personaje de la lista dada, sin nada más — ni puntuación, ni explicación.';
  const userPrompt = `Personajes disponibles: ${characters.map(c => c.name).join(', ')}

Contexto de la sala: ${group.scenario || '(sin escenario definido)'}

Últimos mensajes:
${recentTranscript || '(todavía no hay mensajes)'}

¿Quién tendría más sentido que hablara a continuación? Responde solo con su nombre exacto, tal cual aparece en la lista.`;

  const result = await callAIOnce({ systemPrompt, userPrompt, temperature: 0.3, maxTokens: 20 });
  if (!result.success) return null;

  const cleaned = result.text.trim().replace(/["'.]/g, '');
  const match = characters.find(c => cleaned.toLowerCase().includes(c.name.toLowerCase()));
  return match?.id || null;
}

export function buildGroupHistory({ messages, currentCharacterId, nameResolver }) {
  return messages.map(msg => {
    if (msg.speakerId === currentCharacterId) {
      return { role: 'assistant', content: msg.content };
    }
    const name = nameResolver(msg.speakerId) || 'Alguien';
    return { role: 'user', content: `${name}: ${msg.content}` };
  });
}

/**
 * Bloque de contexto de la sala: el escenario/situación del grupo, quién más
 * está presente (para que un personaje no hable ni actúe por otro), y el
 * recordatorio de que solo debe responder como sí mismo.
 */
export function buildGroupSystemContext({ group, otherCharacters, currentCharacter }) {
  const lines = [
    '=== GROUP SCENE ===',
    group.scenario || 'No specific scenario was set for this room — just a shared scene.',
    '',
    '=== OTHER CHARACTERS PRESENT IN THIS SCENE ===',
    ...otherCharacters.map(c => `- ${c.name}${c.description ? `: ${c.description.slice(0, 150)}` : ''}`),
    '',
    `You are speaking ONLY as ${currentCharacter.name} right now. Do not write dialogue, actions, or thoughts for any other character — only react to them as ${currentCharacter.name} would.`,
    "Every message from someone else is prefixed with their name so you always know who said what — never confuse them for each other.",
  ];
  return lines.filter(Boolean).join('\n');
}

/**
 * Nombre a mostrar para un speakerId dado. 'user' se resuelve con el nombre
 * de tu persona activa (si hay) o tu alias de Ajustes; cualquier otro id se
 * busca en la lista de personajes del grupo.
 */
export function resolveSpeakerName(speakerId, { characters, userDisplayName }) {
  if (speakerId === 'user') return userDisplayName || 'Usuario';
  return characters.find(c => c.id === speakerId)?.name || 'Alguien';
}

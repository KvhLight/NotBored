// ============================================================================
// wrappedAnalysis.js
//
// Genera un informe tipo "Spotify Wrapped" a partir del historial de chats.
// Para no reventar el límite de contexto de ningún proveedor (ni gastar de
// más), NUNCA se manda el historial completo de una vez. En su lugar:
//
//   1. MAP    — se trocea todo en fragmentos pequeños y seguros, y se le
//                pide a la IA un resumen compacto de cada uno.
//   2. REDUCE — esos resúmenes (ya mucho más cortos que el historial
//                original) se combinan en una única llamada final que
//                genera el informe.
//
// Así, tanto "última semana" como "último mes" escalan solo en NÚMERO de
// llamadas, nunca en tamaño de una sola llamada.
// ============================================================================

import { callAIOnce } from './webAdapter.js';
import { PROVIDERS } from '../config/providers.js';

// ~1500 tokens por trozo — cómodo para cualquier proveedor, incluido el más limitado
const CHUNK_CHAR_LIMIT = 6000;
const SECONDS_PER_CALL_ESTIMATE = 6; // aproximado, para el tiempo estimado en pantalla

export function getRangeSinceTimestamp(range) {
  const days = range === 'month' ? 30 : 7;
  return Date.now() - days * 24 * 60 * 60 * 1000;
}

// Proveedores que tienen API key configurada (o no la necesitan), listos
// para usarse en el análisis. Ollama se excluye: este análisis no depende
// de que estés en casa con el PC encendido.
export async function getAvailableProviders() {
  const settings = await window.electronAPI.settings.get();
  return Object.entries(PROVIDERS)
    .filter(([id]) => id !== 'ollama')
    .map(([id, meta]) => ({
      id,
      label: meta.label,
      isPaid: !!meta.isPaid,
      configured: !meta.requiresApiKey || !!(settings.apiKeys && settings.apiKeys[id]),
    }))
    .filter(p => p.configured);
}

// Divide los mensajes de una conversación en trozos de texto seguros,
// preservando el orden y sin cortar mensajes por la mitad.
function chunkConversationText(conv) {
  const chunks = [];
  let current = '';
  for (const m of conv.messages) {
    const line = `${m.role === 'user' ? 'Usuario' : conv.characterName}: ${m.content}\n`;
    if (current.length + line.length > CHUNK_CHAR_LIMIT && current) {
      chunks.push(current);
      current = '';
    }
    current += line;
  }
  if (current) chunks.push(current);
  return chunks;
}

async function collectChunks(range) {
  const since = getRangeSinceTimestamp(range);
  const convs = await window.electronAPI.conversations.getInRange(since);

  const allChunks = [];
  const messageCounts = {};
  for (const conv of convs) {
    messageCounts[conv.characterName] = (messageCounts[conv.characterName] || 0) + conv.messages.length;
    for (const chunk of chunkConversationText(conv)) {
      allChunks.push({ characterName: conv.characterName, text: chunk });
    }
  }
  const totalMessages = Object.values(messageCounts).reduce((a, b) => a + b, 0);
  return { convs, allChunks, messageCounts, totalMessages, since };
}

/**
 * Calcula un tiempo estimado ANTES de arrancar, para que puedas decidir si
 * merece la pena (y con qué proveedor) sin sorpresas.
 */
export async function estimateWrappedWork(range) {
  const { allChunks, totalMessages, convs } = await collectChunks(range);
  const totalCalls = allChunks.length + (allChunks.length > 0 ? 1 : 0); // +1 = llamada final de combinar
  return {
    chunkCount: allChunks.length,
    totalCalls,
    estimatedSeconds: totalCalls * SECONDS_PER_CALL_ESTIMATE,
    totalMessages,
    totalConversations: convs.length,
  };
}

/**
 * Genera el informe completo. onProgress(step, total, label) se llama en
 * cada paso para poder mostrar una barra de progreso real.
 */
export async function generateWrappedReport({ range, providerId, onProgress }) {
  const { allChunks, messageCounts, totalMessages } = await collectChunks(range);

  if (allChunks.length === 0) {
    return { success: false, error: 'No hay conversaciones en este periodo.' };
  }

  const totalSteps = allChunks.length + 1;
  let step = 0;

  // ---- 1) MAP: resumir cada trozo ----
  const summaries = [];
  for (const chunk of allChunks) {
    step++;
    onProgress?.({ step, total: totalSteps, label: `Resumiendo conversación con ${chunk.characterName}...` });

    const result = await callAIOnce({
      providerId,
      temperature: 0.4,
      maxTokens: 300,
      systemPrompt: 'Resumes fragmentos de conversaciones de rol para un análisis personal del usuario. Responde SOLO con un JSON válido, sin markdown ni texto extra.',
      userPrompt: `Personaje: ${chunk.characterName}

Fragmento de la conversación:
"""
${chunk.text}
"""

Devuelve exactamente este JSON:
{
  "characterName": "${chunk.characterName}",
  "topics": ["tema1", "tema2"],
  "userTone": "cómo se comportó/habló el usuario en este fragmento, en pocas palabras",
  "notableMoment": "un momento o detalle concreto y específico de este fragmento (cadena vacía si no hay nada memorable)"
}`,
    });

    if (result.success) {
      try {
        const clean = result.text.replace(/```json/g, '').replace(/```/g, '').trim();
        summaries.push(JSON.parse(clean));
      } catch {
        // un trozo que falle al parsear simplemente se omite, no bloquea el resto
      }
    }
  }

  if (summaries.length === 0) {
    return { success: false, error: 'No se pudo generar ningún resumen. Revisa tu API key o prueba con otro proveedor.' };
  }

  // ---- 2) REDUCE: combinar todos los resúmenes en el informe final ----
  step++;
  onProgress?.({ step, total: totalSteps, label: 'Generando el informe final...' });

  const reduceSystemPrompt = `Eres un analista que genera un informe estilo "Spotify Wrapped" a partir de resúmenes de conversaciones de rol de un usuario.
Responde SOLO con JSON válido, sin markdown.
Reglas importantes:
- Cada afirmación debe estar justificada por algo concreto de los resúmenes proporcionados — nunca inventes rasgos genéricos o etiquetas que no encajen con los datos reales.
- Si no hay evidencia suficiente para algo vistoso, es preferible una observación concreta y modesta que una etiqueta llamativa pero vacía de contenido.
- El tono puede ser directo y curioso; no hace falta suavizarlo con humor forzado.`;

  const reduceUserPrompt = `Mensajes por personaje: ${JSON.stringify(messageCounts)}
Total de mensajes: ${totalMessages}

Resúmenes de fragmentos de conversación:
${JSON.stringify(summaries, null, 2)}

Genera el informe en este formato JSON exacto (entre 5 y 8 tarjetas en total):
{
  "period": "descripción breve del periodo analizado",
  "totalMessages": ${totalMessages},
  "cards": [
    { "type": "stat", "emoji": "💬", "title": "Mensajes totales", "value": "...", "detail": "..." },
    { "type": "topCharacter", "emoji": "⭐", "title": "Tu personaje principal", "value": "...", "detail": "..." },
    { "type": "archetype", "emoji": "🧭", "title": "Tu perfil en las conversaciones", "value": "...", "detail": "..." },
    { "type": "topic", "emoji": "🪐", "title": "De qué más hablaste", "value": "...", "detail": "..." },
    { "type": "insight", "emoji": "🔍", "title": "Un patrón concreto", "value": "...", "detail": "..." }
  ]
}`;

  const finalResult = await callAIOnce({
    providerId,
    temperature: 0.7,
    maxTokens: 1200,
    systemPrompt: reduceSystemPrompt,
    userPrompt: reduceUserPrompt,
  });

  if (!finalResult.success) {
    return { success: false, error: finalResult.error };
  }

  try {
    const clean = finalResult.text.replace(/```json/g, '').replace(/```/g, '').trim();
    const reportData = JSON.parse(clean);

    const saved = await window.electronAPI.wrappedReports.save({
      range,
      providerId,
      data: reportData,
    });

    return { success: true, report: saved };
  } catch {
    return { success: false, error: 'La IA no devolvió un informe con un formato válido. Prueba con otro proveedor.' };
  }
}

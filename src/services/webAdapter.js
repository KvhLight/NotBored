// ============================================================================
// webAdapter.js
// Reemplaza a window.electronAPI cuando la app se ejecuta en un navegador
// (por ejemplo, instalada como PWA en un iPhone) en lugar de en Electron.
//
// - El almacenamiento (personajes, conversaciones, ajustes) vive en localStorage
//   del propio dispositivo (no se sincroniza con el PC).
// - Las llamadas a la IA se hacen directamente desde el navegador a la API de
//   DeepSeek, usando la API Key que el usuario introduce en Ajustes.
// - No depende de Electron, de Node, ni de que el PC esté encendido.
// ============================================================================

import { PROVIDERS, DEFAULT_PROVIDER } from '../config/providers.js';

function uuid() {
  if (crypto?.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

const DEFAULT_SETTINGS = {
  provider: DEFAULT_PROVIDER,
  apiKey: '', // legacy: key del proveedor activo (compatibilidad con Electron de escritorio)
  apiKeys: {}, // { deepseek: 'sk-...', groq: 'gsk_...', ... } — una key por proveedor
  model: PROVIDERS[DEFAULT_PROVIDER].defaultModel,
  maxContextTokens: 4000,
  temperature: 0.85,
  maxTokens: 1000,
  autoMemoryEnabled: true,
  autoMemoryInterval: 10, // cada cuántos mensajes se generan recuerdos solos
};
const DEFAULT_UI_PREFS = { themeHue: 262, themeMode: 'dark', appWallpaper: null, chatWallpapers: {} };

// ---- IndexedDB: mismo concepto que localStorage pero sin el techo de 5-10MB ----
const DB_NAME = 'proyecto-yo-db';
const STORE_NAME = 'kv';
let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE_NAME)) {
        req.result.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function load(key, fallback) {
  try {
    const db = await openDB();
    const value = await new Promise((resolve, reject) => {
      const req = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return value === undefined ? fallback : value;
  } catch {
    return fallback;
  }
}
async function persist(key, value) {
  const db = await openDB();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// Migración automática y silenciosa: si hay datos antiguos en localStorage
// (versiones previas de la app) y todavía no se han migrado a IndexedDB,
// se copian una vez. No borra localStorage, por si algo saliera mal.
let migrationDone = false;
async function migrateFromLocalStorageIfNeeded() {
  if (migrationDone) return;
  migrationDone = true;
  try {
    const alreadyMigrated = await load('__migratedFromLocalStorage', false);
    if (alreadyMigrated) return;
    for (const key of ['characters', 'conversations', 'settings', 'uiPreferences']) {
      const raw = localStorage.getItem(key);
      if (raw) {
        try { await persist(key, JSON.parse(raw)); } catch { /* dato corrupto, se ignora */ }
      }
    }
    await persist('__migratedFromLocalStorage', true);
  } catch {
    // si algo falla aquí, simplemente se seguirá usando IndexedDB desde cero
  }
}

/* ==========================================================================
   CHARACTERS
   ========================================================================== */
async function getAllCharacters() {
  await migrateFromLocalStorageIfNeeded();
  return load('characters', []);
}
async function getCharacterById(id) {
  return (await getAllCharacters()).find(c => c.id === id) || null;
}
async function createCharacter(data) {
  const chars = await getAllCharacters();
  const newChar = {
    id: uuid(),
    name: data.name || 'Sin nombre',
    avatar: data.avatar || '👤',
    description: data.description || '',
    personality: data.personality || '',
    scenario: data.scenario || '',
    systemPrompt: data.systemPrompt || '',
    greetingMsg: data.greetingMsg || '',
    tags: data.tags || [],
    writingStyle: data.writingStyle || '',
    advancedRules: data.advancedRules || [], // [{ id, trigger, behavior }]
    isNSFW: data.isNSFW || false,
    isFavorite: data.isFavorite || false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  chars.push(newChar);
  await persist('characters', chars);
  return newChar;
}
async function updateCharacter(id, updates) {
  const chars = await getAllCharacters();
  const idx = chars.findIndex(c => c.id === id);
  if (idx === -1) throw new Error(`Character ${id} not found`);
  chars[idx] = { ...chars[idx], ...updates, updatedAt: Date.now() };
  await persist('characters', chars);
  return chars[idx];
}
async function deleteCharacter(id) {
  const chars = await getAllCharacters();
  await persist('characters', chars.filter(c => c.id !== id));
  const convs = await getAllConversations();
  await persist('conversations', convs.filter(c => c.characterId !== id));
  return true;
}

/* ==========================================================================
   CONVERSATIONS
   ========================================================================== */
async function getAllConversations() {
  await migrateFromLocalStorageIfNeeded();
  return load('conversations', []);
}
// Conversaciones de TODOS los personajes con mensajes dentro de un rango de
// fechas — se usa para el análisis Wrapped, que mira a toda la actividad,
// no a un personaje en concreto.
async function getConversationsInRange(sinceTimestamp) {
  const [chars, convs] = await Promise.all([getAllCharacters(), getAllConversations()]);
  const charMap = Object.fromEntries(chars.map(c => [c.id, c]));
  return convs
    .map(conv => ({
      ...conv,
      characterName: charMap[conv.characterId]?.name || 'Desconocido',
      messages: (conv.messages || []).filter(m => m.timestamp >= sinceTimestamp),
    }))
    .filter(conv => conv.messages.length > 0);
}
async function getConversationsByCharacter(characterId) {
  return (await getAllConversations())
    .filter(c => c.characterId === characterId)
    .sort((a, b) => b.lastActivity - a.lastActivity);
}
async function createConversation(characterId) {
  const convs = await getAllConversations();
  const newConv = {
    id: uuid(),
    characterId,
    title: 'New Conversation',
    messages: [],
    // Escenario específico de ESTA conversación. Vacío = usar el escenario
    // por defecto del personaje. Así el mismo personaje puede tener
    // conversaciones distintas con contextos distintos.
    scenarioOverride: '',
    createdAt: Date.now(),
    lastActivity: Date.now(),
  };
  convs.push(newConv);
  await persist('conversations', convs);
  return newConv;
}
// Guarda (o limpia, si se pasa '') el escenario propio de esta conversación,
// sin tocar el escenario del personaje ni el de otras conversaciones.
async function setConversationScenario(conversationId, scenario) {
  const convs = await getAllConversations();
  const idx = convs.findIndex(c => c.id === conversationId);
  if (idx === -1) throw new Error('Conversation not found');
  convs[idx].scenarioOverride = scenario?.trim() || '';
  await persist('conversations', convs);
  return convs[idx];
}
async function appendMessage(conversationId, message) {
  const convs = await getAllConversations();
  const idx = convs.findIndex(c => c.id === conversationId);
  if (idx === -1) throw new Error('Conversation not found');
  const newMsg = {
    id: uuid(),
    role: message.role,
    content: message.content,
    timestamp: Date.now(),
  };
  convs[idx].messages.push(newMsg);
  convs[idx].lastActivity = Date.now();
  if (message.role === 'user' && convs[idx].title === 'New Conversation') {
    convs[idx].title = message.content.slice(0, 40) + '...';
  }
  await persist('conversations', convs);
  return newMsg;
}
async function deleteConversation(id) {
  const convs = await getAllConversations();
  await persist('conversations', convs.filter(c => c.id !== id));
  return true;
}
async function renameConversation(id, newTitle) {
  const convs = await getAllConversations();
  const idx = convs.findIndex(c => c.id === id);
  if (idx === -1) throw new Error('Conversation not found');
  convs[idx].title = newTitle;
  await persist('conversations', convs);
  return convs[idx];
}
async function deleteMessage(conversationId, messageId) {
  const convs = await getAllConversations();
  const idx = convs.findIndex(c => c.id === conversationId);
  if (idx === -1) throw new Error('Conversation not found');
  convs[idx].messages = convs[idx].messages.filter(m => m.id !== messageId);
  await persist('conversations', convs);
  return convs[idx];
}
async function editMessage(conversationId, messageId, newContent) {
  const convs = await getAllConversations();
  const idx = convs.findIndex(c => c.id === conversationId);
  if (idx === -1) throw new Error('Conversation not found');
  const msgIdx = convs[idx].messages.findIndex(m => m.id === messageId);
  if (msgIdx === -1) throw new Error('Message not found');
  convs[idx].messages[msgIdx].content = newContent;
  convs[idx].messages[msgIdx].edited = true;
  await persist('conversations', convs);
  return convs[idx].messages[msgIdx];
}
// Actualización interna (sin marcar 'edited') — se usa para ir guardando la
// respuesta de la IA mientras llega en streaming, y así no perderla entera
// si la app se queda suspendida en segundo plano a mitad de la generación.
async function patchMessage(conversationId, messageId, patch) {
  const convs = await getAllConversations();
  const idx = convs.findIndex(c => c.id === conversationId);
  if (idx === -1) return null;
  const msgIdx = convs[idx].messages.findIndex(m => m.id === messageId);
  if (msgIdx === -1) return null;
  convs[idx].messages[msgIdx] = { ...convs[idx].messages[msgIdx], ...patch };
  await persist('conversations', convs);
  return convs[idx].messages[msgIdx];
}
// Reemplaza el array de mensajes completo — se usa para truncar la
// conversación desde un punto concreto (borrar un mensaje y todo lo
// posterior, o mantener solo hasta un mensaje editado).
async function setConversationMessages(conversationId, newMessages) {
  const convs = await getAllConversations();
  const idx = convs.findIndex(c => c.id === conversationId);
  if (idx === -1) throw new Error('Conversation not found');
  convs[idx].messages = newMessages;
  convs[idx].lastActivity = Date.now();
  await persist('conversations', convs);
  return convs[idx];
}

/* ==========================================================================
   MEMORIA — "recuerdos" de una conversación concreta (se van con el chat,
   no persisten entre conversaciones distintas con el mismo personaje)
   ========================================================================== */
export const MEMORY_CHAR_LIMIT = 4000; // límite aproximado de espacio para recuerdos por conversación

async function getMemories(conversationId) {
  const convs = await getAllConversations();
  const conv = convs.find(c => c.id === conversationId);
  return conv?.memories || [];
}
async function addMemory(conversationId, memory) {
  const convs = await getAllConversations();
  const idx = convs.findIndex(c => c.id === conversationId);
  if (idx === -1) throw new Error('Conversation not found');
  if (!convs[idx].memories) convs[idx].memories = [];
  const newMemory = {
    id: uuid(),
    category: memory.category || 'both', // 'user' | 'character' | 'both'
    text: memory.text || '',
    createdAt: Date.now(),
    auto: !!memory.auto,
  };
  convs[idx].memories.push(newMemory);
  await persist('conversations', convs);
  return newMemory;
}
async function updateMemory(conversationId, memoryId, patch) {
  const convs = await getAllConversations();
  const idx = convs.findIndex(c => c.id === conversationId);
  if (idx === -1) throw new Error('Conversation not found');
  const memIdx = (convs[idx].memories || []).findIndex(m => m.id === memoryId);
  if (memIdx === -1) throw new Error('Memory not found');
  convs[idx].memories[memIdx] = { ...convs[idx].memories[memIdx], ...patch };
  await persist('conversations', convs);
  return convs[idx].memories[memIdx];
}
async function deleteMemory(conversationId, memoryId) {
  const convs = await getAllConversations();
  const idx = convs.findIndex(c => c.id === conversationId);
  if (idx === -1) return false;
  convs[idx].memories = (convs[idx].memories || []).filter(m => m.id !== memoryId);
  await persist('conversations', convs);
  return true;
}
// Cuántos mensajes había la última vez que se generaron recuerdos
// automáticamente — para saber cuándo toca la siguiente tanda
async function getLastMemoryMessageCount(conversationId) {
  const convs = await getAllConversations();
  const conv = convs.find(c => c.id === conversationId);
  return conv?.lastMemoryMessageCount || 0;
}
async function setLastMemoryMessageCount(conversationId, count) {
  const convs = await getAllConversations();
  const idx = convs.findIndex(c => c.id === conversationId);
  if (idx === -1) return;
  convs[idx].lastMemoryMessageCount = count;
  await persist('conversations', convs);
}
// Construye el bloque de texto a inyectar en el prompt a partir de los
// recuerdos guardados — se usa desde ChatWindow.jsx
export function buildMemoriesBlock(memories) {
  if (!memories || memories.length === 0) return '';
  const labelMap = { user: 'About the user', character: 'About the character', both: 'About both' };
  const lines = ['=== REMEMBERED FACTS (from earlier in this conversation) ==='];
  for (const cat of ['user', 'character', 'both']) {
    const items = memories.filter(m => m.category === cat);
    if (items.length === 0) continue;
    lines.push(`${labelMap[cat]}:`);
    items.forEach(m => lines.push(`- ${m.text}`));
  }
  lines.push('Take these into account naturally, without listing them explicitly to the user.');
  return lines.join('\n');
}

/* ==========================================================================
   SETTINGS / UI PREFERENCES
   ========================================================================== */
async function getSettings() {
  await migrateFromLocalStorageIfNeeded();
  const s = { ...DEFAULT_SETTINGS, ...(await load('settings', {})) };
  s.apiKeys = { ...s.apiKeys };
  // Migración: si hay una key legacy suelta y el proveedor activo aún no tiene
  // su propia entrada en apiKeys, la copiamos (así no pierdes la key que ya tenías).
  if (s.apiKey && !s.apiKeys[s.provider]) {
    s.apiKeys[s.provider] = s.apiKey;
  }
  return s;
}
async function updateSettings(updates) {
  const current = await getSettings();
  await persist('settings', { ...current, ...updates });
  return getSettings();
}
async function getUiPreferences() {
  await migrateFromLocalStorageIfNeeded();
  return { ...DEFAULT_UI_PREFS, ...(await load('uiPreferences', {})) };
}
async function updateUiPreferences(updates) {
  const merged = { ...(await getUiPreferences()), ...updates };
  await persist('uiPreferences', merged);
  return merged;
}
async function setChatWallpaper(characterId, value) {
  const current = await getUiPreferences();
  const chatWallpapers = { ...current.chatWallpapers };
  if (value === null) delete chatWallpapers[characterId];
  else chatWallpapers[characterId] = value;
  return updateUiPreferences({ chatWallpapers });
}

/* ==========================================================================
   PERSONAS — perfiles alternativos del usuario, reutilizables entre
   personajes. El perfil de Ajustes es el "por defecto" y no vive aquí.
   ========================================================================== */
async function getAllPersonas() {
  return load('personas', []);
}
async function createPersona({ title, name, description, lore, gender }) {
  const personas = await getAllPersonas();
  const newPersona = {
    id: uuid(),
    title: title?.trim() || 'Sin título',
    name: name?.trim() || '',
    description: description?.trim() || '',
    lore: lore?.trim() || '',
    gender: gender || null,
    createdAt: Date.now(),
  };
  personas.push(newPersona);
  await persist('personas', personas);
  return newPersona;
}
// Edita una persona ya existente (título, nombre, descripción y/o lore).
// Solo se sobreescriben los campos presentes en `patch`.
async function updatePersona(id, patch) {
  const personas = await getAllPersonas();
  const idx = personas.findIndex(p => p.id === id);
  if (idx === -1) throw new Error('Persona not found');
  personas[idx] = { ...personas[idx], ...patch };
  await persist('personas', personas);
  return personas[idx];
}
async function deletePersona(id) {
  await persist('personas', (await getAllPersonas()).filter(p => p.id !== id));
  // Si alguna selección por personaje apuntaba a esta persona borrada,
  // la desactivamos para no dejarla apuntando a algo que ya no existe
  const prefs = await getUiPreferences();
  const sels = { ...(prefs.personaSelections || {}) };
  let changed = false;
  for (const charId of Object.keys(sels)) {
    if (sels[charId]?.personaId === id) {
      sels[charId] = { ...sels[charId], personaId: null };
      changed = true;
    }
  }
  if (changed) await updateUiPreferences({ personaSelections: sels });
  return true;
}

// Qué persona (si alguna) está activa para un personaje concreto.
// { enabled: false } => se usa el perfil por defecto de Ajustes.
async function getPersonaSelection(characterId) {
  const prefs = await getUiPreferences();
  return (prefs.personaSelections && prefs.personaSelections[characterId]) || { enabled: false, personaId: null };
}
async function setPersonaSelection(characterId, selection) {
  const prefs = await getUiPreferences();
  const personaSelections = { ...(prefs.personaSelections || {}), [characterId]: selection };
  await updateUiPreferences({ personaSelections });
  return selection;
}

/* ==========================================================================
   WRAPPED — informes guardados del análisis de conversaciones
   ========================================================================== */
async function getAllWrappedReports() {
  return load('wrappedReports', []);
}
async function saveWrappedReport(report) {
  const reports = await getAllWrappedReports();
  const newReport = { id: uuid(), createdAt: Date.now(), ...report };
  reports.unshift(newReport); // el más reciente primero
  await persist('wrappedReports', reports);
  return newReport;
}
async function deleteWrappedReport(id) {
  await persist('wrappedReports', (await getAllWrappedReports()).filter(r => r.id !== id));
  return true;
}

/* ==========================================================================

   IA — DeepSeek (llamada directa desde el navegador con fetch + streaming)
   ========================================================================== */
function estimateTokens(text) {
  return Math.ceil((text || '').length / 4);
}
function buildContextWindow(messages, systemPrompt, maxTokens = 4000) {
  const systemMsg = { role: 'system', content: systemPrompt };
  let available = maxTokens - estimateTokens(systemPrompt) - 200;
  const ctx = [];
  for (const msg of [...messages].reverse()) {
    const t = estimateTokens(msg.content);
    if (t > available) break;
    ctx.unshift({ role: msg.role, content: msg.content });
    available -= t;
  }
  if (ctx.length === 0 && messages.length > 0) {
    const last = messages[messages.length - 1];
    ctx.push({ role: last.role, content: last.content });
  }
  return [systemMsg, ...ctx];
}
function buildCharacterSystemPrompt(character, userContextBlock, scenarioOverride, memoriesBlock) {
  const effectiveScenario = (scenarioOverride && scenarioOverride.trim()) || character.scenario || '';
  const parts = [
    '=== IDENTITY ===',
    `You are ${character.name}. You are not an AI, you are not an assistant.`,
    `You exist solely and exclusively as ${character.name}.`,
    'You have your own thoughts, emotions, and background history.',
    '',
    '=== PHYSICAL DESCRIPTION & BACKGROUND ===',
    character.description || '',
    '',
    '=== PERSONALITY & BEHAVIOR ===',
    character.personality || '',
    'You speak, think, and react consistently with these traits at ALL times.',
    '',
    '=== SCENARIO & WORLD ===',
    effectiveScenario,
    'You know this world intimately. Act within its logic and rules.',
    '',
    '=== AUTHOR INSTRUCTIONS ===',
    character.systemPrompt || '',
    '',
  ];

  if (character.writingStyle) {
    parts.push(
      '=== WRITING STYLE ===',
      character.writingStyle,
      'Write every response matching this style consistently.',
      ''
    );
  }

  if (character.advancedRules && character.advancedRules.length > 0) {
    parts.push(
      '=== SPECIFIC BEHAVIOR RULES ===',
      'These are exact instructions the author gave for specific situations. Follow them whenever the topic/question matches, even if it seems to contradict the general personality above — these take priority:',
      ...character.advancedRules
        .filter(r => r.trigger && r.behavior)
        .map(r => `- When the topic is "${r.trigger}": ${r.behavior}`),
      ''
    );
  }

  parts.push(
    '=== ROLEPLAY RULES (NON-NEGOTIABLE) ===',
    `1. NEVER say 'As an AI...' or 'I cannot...' — you are ${character.name}.`,
    "2. If you don't know something, IMPROVISE within character, do not admit it.",
    '3. Use *asterisks* to describe actions, gestures, and emotions.',
    '   Example: *Crosses his arms and stares at you intently*',
    "4. Always respond in the user's language automatically (e.g., if they speak Spanish, respond in Spanish).",
    '5. Responses must be immersive: 2-4 paragraphs for narrative, 1 paragraph for casual dialogue.',
    '6. Remember previous events in the conversation and refer back to them.',
    '7. Do not use disclaimers, warnings, or meta-comments.',
  );
  if (userContextBlock) {
    parts.push('', userContextBlock);
  }
  if (memoriesBlock) {
    parts.push('', memoriesBlock);
  }
  return parts.filter(Boolean).join('\n');
}

const listeners = { chunk: [], done: [], error: [] };
let currentAbortController = null;

function stopGeneration() {
  currentAbortController?.abort();
}
function onChunk(cb) { listeners.chunk.push(cb); }
function onDone(cb) { listeners.done.push(cb); }
function onError(cb) { listeners.error.push(cb); }
function removeListeners() { listeners.chunk = []; listeners.done = []; listeners.error = []; }

/**
 * Detecta automáticamente la IP/host de tu PC en la red local.
 * Cuando abres la app en el móvil como http://192.168.1.50:5173,
 * window.location.hostname YA ES esa IP — es la misma máquina donde
 * corre Ollama. Así no hace falta configurar nada a mano.
 *
 * Esto SOLO funciona en la misma WiFi que el PC, con Ollama encendido.
 * Cuando despliegues la app en internet (Vercel, etc.), esta URL
 * simplemente no responderá y Ollama se listará como no disponible,
 * sin romper nada — la app seguirá funcionando con DeepSeek.
 */
function getOllamaBaseURL() {
  const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
  return `http://${host}:11434`;
}

/**
 * Devuelve la config (baseURL + apiKey + metadata) según el proveedor elegido.
 * Genérico: funciona para cualquier entrada del registro PROVIDERS, no solo
 * para deepseek/ollama — así añadir un proveedor nuevo no requiere tocar esto.
 */
function getProviderConfig(settings) {
  const providerId = settings.provider || DEFAULT_PROVIDER;
  const meta = PROVIDERS[providerId] || PROVIDERS[DEFAULT_PROVIDER];

  if (providerId === 'ollama') {
    return { baseURL: `${getOllamaBaseURL()}/v1`, apiKey: 'ollama', meta, providerId };
  }
  const apiKey = (settings.apiKeys && settings.apiKeys[providerId]) || settings.apiKey || '';
  return { baseURL: meta.baseURL, apiKey, meta, providerId };
}

async function getOllamaModels() {
  try {
    const resp = await fetch(`${getOllamaBaseURL()}/api/tags`, { signal: AbortSignal.timeout(2500) });
    if (!resp.ok) return [];
    const data = await resp.json();
    return (data.models || []).map(m => m.name);
  } catch {
    // PC apagado, Ollama no corre, distinta red, o CORS no habilitado (OLLAMA_ORIGINS) — no pasa nada, devolvemos vacío
    return [];
  }
}

async function sendMessage({ character, history, userMessage, userContextBlock, scenarioOverride, memoriesBlock }) {
  const settings = await getSettings();
  const { baseURL, apiKey, meta, providerId } = getProviderConfig(settings);

  if (meta.requiresApiKey && !apiKey) {
    listeners.error.forEach(cb => cb(`Falta la API Key de ${meta.label}. Ve a Ajustes → IA y pégala.`));
    return { success: false };
  }
  const systemPrompt = buildCharacterSystemPrompt(character, userContextBlock, scenarioOverride, memoriesBlock);
  const contextMessages = buildContextWindow(history, systemPrompt, settings.maxContextTokens);
  contextMessages.push({ role: 'user', content: userMessage });

  const model = (meta.models && !meta.models.includes(settings.model)) ? meta.defaultModel : (settings.model || meta.defaultModel);
  let targetURL, targetHeaders, targetBody;

  if (meta.format === 'gemini-native') {
    // Gemini nativo: roles 'user'/'model' (no 'assistant'), el system prompt
    // va aparte en systemInstruction, y la key va en la cabecera x-goog-api-key.
    const contents = contextMessages
      .filter(m => m.role !== 'system')
      .map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }));
    targetURL = `${baseURL}/models/${model}:streamGenerateContent?alt=sse`;
    targetHeaders = { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey };
    targetBody = {
      contents,
      systemInstruction: { parts: [{ text: systemPrompt }] },
      generationConfig: {
        temperature: settings.temperature || 0.85,
        maxOutputTokens: settings.maxTokens || 1000,
        thinkingConfig: { thinkingLevel: 'low' },
      },
    };
  } else {
    // Formato OpenAI (DeepSeek, Ollama, Mistral, Cerebras...)
    targetURL = `${baseURL}/chat/completions`;
    targetHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` };
    targetBody = {
      model,
      messages: contextMessages,
      temperature: settings.temperature || 0.85,
      max_tokens: settings.maxTokens || 1000,
      stream: true,
    };
  }

  currentAbortController = new AbortController();
  const fetchInit = { method: 'POST', signal: currentAbortController.signal };

  // Ollama vive en tu red local: se llama directo, el proxy en la nube no
  // podría alcanzarlo. Los demás proveedores pasan por /api/proxy para
  // evitar bloqueos de CORS (Gemini, por ejemplo, los aplica siempre).
  const fetchTarget = providerId === 'ollama'
    ? [targetURL, { ...fetchInit, headers: targetHeaders, body: JSON.stringify(targetBody) }]
    : ['/api/proxy', {
        ...fetchInit,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: targetURL, headers: targetHeaders, body: targetBody }),
      }];

  try {
    const resp = await fetch(...fetchTarget);

    if (!resp.ok) {
      const bodyText = await resp.text().catch(() => '');
      let detail = '';
      try { detail = JSON.parse(bodyText)?.error?.message || ''; } catch { detail = bodyText.slice(0, 200); }
      if (resp.status === 401) throw new Error(`API Key inválida o expirada.${detail ? ` (${detail})` : ''}`);
      if (resp.status === 404) throw new Error(`Modelo no encontrado en ${meta.label}.${detail ? ` (${detail})` : ''}`);
      if (resp.status === 429) throw new Error('Rate limit alcanzado. Espera un momento.');
      if (resp.status === 503) throw new Error(`El servicio de ${meta.label} no está disponible.`);
      throw new Error(`Error de ${meta.label} (código ${resp.status}).${detail ? ` ${detail}` : ''}`);
    }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        const data = trimmed.slice(5).trim();
        if (data === '[DONE]') continue;
        try {
          const json = JSON.parse(data);
          const delta = meta.format === 'gemini-native'
            ? (json.candidates?.[0]?.content?.parts?.[0]?.text || '')
            : (json.choices?.[0]?.delta?.content || '');
          if (delta) listeners.chunk.forEach(cb => cb(delta));
        } catch {
          // fragmento parcial, se completará en el siguiente chunk
        }
      }
    }

    listeners.done.forEach(cb => cb());
    return { success: true };
  } catch (err) {
    if (err.name === 'AbortError') {
      // El usuario pulsó "Parar" — no es un error, se guarda lo generado hasta ahora
      listeners.done.forEach(cb => cb());
      return { success: true, stopped: true };
    }
    let msg = err.message;
    if (msg === 'Failed to fetch' || msg === 'Load failed') {
      msg = providerId === 'ollama'
        ? 'No se pudo conectar con Ollama. ¿Está tu PC encendido, Ollama corriendo y estás en la misma WiFi?'
        : 'Sin conexión a internet, o el servicio no respondió.';
    }
    listeners.error.forEach(cb => cb(msg));
    return { success: false };
  } finally {
    currentAbortController = null;
  }
}

/* ==========================================================================
   FORGE — generación automática de personajes
   ========================================================================== */
/**
 * Llamada genérica a la IA SIN streaming — devuelve el texto crudo de la
 * respuesta. La usan tanto Forge (generar personajes) como el análisis
 * Wrapped (resumir y combinar conversaciones), para no duplicar la lógica
 * de "qué formato de petición usa cada proveedor" en varios sitios.
 *
 * providerId es opcional: si no se pasa, usa el proveedor activo en Ajustes.
 */
export async function callAIOnce({ systemPrompt, userPrompt, temperature = 0.8, maxTokens = 3000, providerId: forcedProviderId } = {}) {
  const settings = await getSettings();
  if (forcedProviderId) settings.provider = forcedProviderId;
  const { baseURL, apiKey, meta, providerId } = getProviderConfig(settings);

  if (meta.requiresApiKey && !apiKey) {
    return { success: false, error: `Falta la API Key de ${meta.label}. Configúrala en Ajustes.` };
  }

  const model = (meta.models && !meta.models.includes(settings.model)) ? meta.defaultModel : (settings.model || meta.defaultModel);
  let url, headers, body;

  if (meta.format === 'gemini-native') {
    url = `${baseURL}/models/${model}:generateContent`;
    headers = { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey };
    body = {
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      systemInstruction: { parts: [{ text: systemPrompt }] },
      generationConfig: {
        temperature,
        maxOutputTokens: maxTokens,
        // Gemini 3.x no permite desactivar el "pensamiento" del todo, pero
        // con 'low' se reduce al mínimo — así consume menos del mismo
        // límite de tokens que la respuesta visible (maxOutputTokens),
        // dejando más margen para el JSON real antes de cortarse.
        thinkingConfig: { thinkingLevel: 'low' },
      },
    };
  } else {
    url = `${baseURL}/chat/completions`;
    headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` };
    body = {
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature,
      max_tokens: maxTokens,
    };
  }

  const target = providerId === 'ollama'
    ? [url, { method: 'POST', headers, body: JSON.stringify(body) }]
    : ['/api/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, headers, body }),
      }];

  try {
    const resp = await fetch(...target);
    if (!resp.ok) {
      const bodyText = await resp.text().catch(() => '');
      let detail = '';
      try { detail = JSON.parse(bodyText)?.error?.message || ''; } catch { detail = bodyText.slice(0, 200); }
      return { success: false, error: `Error de ${meta.label} (código ${resp.status}).${detail ? ` ${detail}` : ''}`, providerId };
    }
    const data = await resp.json();
    const raw = meta.format === 'gemini-native'
      ? (data.candidates?.[0]?.content?.parts?.[0]?.text || '')
      : (data.choices?.[0]?.message?.content || '');
    return { success: true, text: raw, providerId };
  } catch (err) {
    const msg = (err.message === 'Failed to fetch' || err.message === 'Load failed')
      ? 'Sin conexión, o el servicio no respondió.'
      : err.message;
    return { success: false, error: msg, providerId };
  }
}

// Extrae el primer objeto JSON completo de un texto, ignorando cualquier
// texto que la IA haya añadido antes o después (a veces lo hace pese a que
// se le pide que no lo haga). Cuenta llaves respetando strings, para no
// confundirse con '{' o '}' que aparezcan dentro del propio texto generado.
function extractJsonObject(text) {
  const start = text.indexOf('{');
  if (start === -1) throw new Error('La IA no devolvió ningún JSON reconocible.');
  let depth = 0, inString = false, escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
    } else {
      if (ch === '"') inString = true;
      else if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (depth === 0) return text.slice(start, i + 1);
      }
    }
  }
  // Si llegamos al final del texto sin cerrar todas las llaves, la
  // respuesta se cortó (normalmente por quedarse sin tokens disponibles).
  throw new Error('La respuesta de la IA se cortó a mitad de generación (quedó incompleta). Prueba de nuevo o acorta la idea.');
}

async function forgeGenerateCharacter(idea) {
  const systemPrompt = `You are an expert RPG and video game narrative designer.
Your sole task is to generate deeply detailed NPC lorecards based on vague user ideas.
You must always strictly return a single, valid JSON object.
Do NOT include markdown blocks (like \`\`\`json), no pre-text, no post-text, no conversational filler, no comments about what you're doing. Just raw JSON, nothing else.`;

  const userPrompt = `Generate a full, high-quality NPC lorecard for this idea: "${idea}"
Fill all fields with rich, creative, and immersive content.

You MUST respond using this exact JSON structure:
{
  "name": "Full memorable and immersive name",
  "avatar": "A single representative emoji",
  "description": "Detailed physical description and background history (at least 3 sentences)",
  "personality": "3-5 deeply nuanced personality traits, including flaws or inner contradictions",
  "scenario": "The specific world, era, location or context where this character exists",
  "systemPrompt": "In-depth first-person roleplay instructions for the AI detailing voice, speech patterns, quirks, and constraints (1 paragraphs)",
  "greetingMsg": "First message from the character to initiate the chat, containing immersive actions wrapped in *asterisks*",
  "tags": ["tag1", "tag2", "tag3"],
  "secretMotivation": "A hidden core motivation or dark secret the player could discover over time"
}`;

  // maxTokens generoso: la ficha completa (8 campos, varios de ellos con
  // varias frases) no cabe en 800 tokens — se cortaba a mitad de generación
  // y el JSON quedaba inválido ("unterminated string").
  const result = await callAIOnce({ systemPrompt, userPrompt, temperature: 0.95, maxTokens: 3000 });
  if (!result.success) return { success: false, error: result.error };

  try {
    if (!result.text || !result.text.trim()) throw new Error('La IA devolvió una respuesta vacía.');
    const jsonSlice = extractJsonObject(result.text);
    const parsed = JSON.parse(jsonSlice);
    if (!parsed.name || !parsed.systemPrompt) throw new Error('Estructura de ficha incompleta.');
    return { success: true, character: parsed };
  } catch (err) {
    return { success: false, error: `Error al forjar personaje: ${err.message || 'La IA no devolvió un JSON válido. Reintenta.'}` };
  }
}

/* ==========================================================================
   IMÁGENES — sin sistema de archivos: se leen del dispositivo y se guardan
   directamente como Base64 (no hay disco al que copiar en un navegador).
   ========================================================================== */
let pendingFile = null;

function selectFile() {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/png, image/jpeg, image/webp, image/gif, image/heic, image/heif';
    input.style.display = 'none';
    document.body.appendChild(input);

    let settled = false;
    const cleanup = () => {
      window.removeEventListener('focus', onFocusFallback);
      input.remove();
    };

    input.onchange = () => {
      settled = true;
      const file = input.files?.[0];
      cleanup();
      if (!file) { resolve(null); return; }
      pendingFile = file;
      resolve(`webfile://${file.name}`);
    };

    // Si el usuario cierra el selector sin elegir nada (cancelar), 'change'
    // nunca se dispara y la promesa se quedaría esperando para siempre.
    // Truco estándar: al cerrarse el selector, la ventana recupera el foco;
    // si tras un instante no hubo 'change', asumimos que se canceló.
    function onFocusFallback() {
      setTimeout(() => {
        if (!settled && (!input.files || input.files.length === 0)) {
          settled = true;
          cleanup();
          resolve(null);
        }
      }, 300);
    }
    window.addEventListener('focus', onFocusFallback);

    // Necesario para que iOS Safari permita abrir el selector desde un callback async
    input.click();
  });
}

/**
 * Convierte el archivo a Base64, redimensionándolo antes.
 * Las fotos del iPhone pueden pesar varios MB a resolución completa —
 * sin este paso, convertirlas a Base64 es lentísimo y además podría llenar
 * el almacenamiento del navegador (localStorage tiene muy poco espacio,
 * unos 5-10MB en total para toda la app).
 *
 * Además tiene un límite de tiempo: si por lo que sea el navegador se
 * atasca decodificando la imagen, nunca se queda "cargando" para siempre —
 * a los 20s falla con un error claro en vez de colgarse en silencio.
 */
async function resizeImageToDataURL(file, maxDim = 1024, quality = 0.85) {
  const work = (async () => {
    const bitmap = await createImageBitmap(file);
    let { width, height } = bitmap;
    if (width > maxDim || height > maxDim) {
      const scale = maxDim / Math.max(width, height);
      width = Math.round(width * scale);
      height = Math.round(height * scale);
    }
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvas.getContext('2d').drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();
    return canvas.toDataURL('image/jpeg', quality);
  })();

  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('La imagen ha tardado demasiado en procesarse. Prueba con otra foto o una más ligera.')), 20000)
  );

  return Promise.race([work, timeout]);
}

async function toBase64() {
  if (!pendingFile) throw new Error('No hay imagen seleccionada.');
  return resizeImageToDataURL(pendingFile);
}
async function saveAvatar() {
  // En web no existe disco local: el "guardado" es el mismo Base64 ya redimensionado
  return resizeImageToDataURL(pendingFile);
}
async function deleteAvatar() {
  return true;
}

/* ==========================================================================
   ADAPTADOR FINAL
   ========================================================================== */
/* ==========================================================================
   COPIA DE SEGURIDAD — exporta/importa todo lo guardado en localStorage
   ========================================================================== */
const BACKUP_KEYS = ['characters', 'conversations', 'settings', 'uiPreferences', 'personas', 'wrappedReports'];

async function exportAllData() {
  try {
    const dataEntries = await Promise.all(BACKUP_KEYS.map(async k => [k, await load(k, null)]));
    const payload = {
      app: 'proyecto-yo',
      backupVersion: 1,
      exportedAt: new Date().toISOString(),
      data: Object.fromEntries(dataEntries),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const stamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `proyecto-yo-backup-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

async function importAllData() {
  const file = await new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    // Deliberadamente permisivo: en iOS, un archivo .json recibido por
    // AirDrop/WhatsApp/etc. a veces no lleva la etiqueta MIME
    // "application/json", así que filtrar solo por eso puede dejarlo
    // atenuado/no seleccionable en el picker. Se valida igualmente el
    // contenido real (JSON.parse) más abajo.
    input.accept = '.json,application/json,text/plain,text/json,*/*';
    input.style.display = 'none';
    document.body.appendChild(input);

    let settled = false;
    const cleanup = () => {
      window.removeEventListener('focus', onFocusFallback);
      input.remove();
    };

    input.onchange = () => {
      settled = true;
      const chosen = input.files?.[0] || null;
      cleanup();
      resolve(chosen);
    };

    // Respaldo: en iOS, si el usuario cancela el selector, a veces no dispara
    // 'onchange'. Al volver el foco a la ventana sin haber resuelto ya, damos
    // por hecho que se canceló, para no dejar la promesa colgada para siempre.
    function onFocusFallback() {
      setTimeout(() => {
        if (!settled) {
          settled = true;
          cleanup();
          resolve(null);
        }
      }, 300);
    }
    window.addEventListener('focus', onFocusFallback);

    input.click();
  });

  if (!file) return { success: false, canceled: true };

  try {
    const text = await readFileAsText(file);
    const parsed = JSON.parse(text);
    if (!parsed?.data || parsed.app !== 'proyecto-yo') {
      return { success: false, error: 'El archivo no es una copia de seguridad válida.' };
    }
    for (const key of BACKUP_KEYS) {
      if (parsed.data[key] !== undefined && parsed.data[key] !== null) {
        await persist(key, parsed.data[key]);
      }
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: 'El archivo no se pudo leer como JSON válido.' };
  }
}

/* ==========================================================================
   COMPARTIR UN PERSONAJE — exporta solo la ficha (sin conversaciones, sin
   favoritos, sin fechas locales) para poder pasárselo a alguien. Al
   importarlo se crea como personaje nuevo, con su propio id.
   ========================================================================== */
const CHARACTER_SHARE_FORMAT_VERSION = 1;
// Campos que sí viajan al compartir un personaje (todo lo demás es local:
// id, createdAt, updatedAt, isFavorite no tienen sentido para otra persona)
const SHAREABLE_CHARACTER_FIELDS = [
  'name', 'avatar', 'description', 'personality', 'scenario',
  'systemPrompt', 'greetingMsg', 'tags', 'isNSFW',
  'writingStyle', 'advancedRules',
];

async function exportCharacter(characterId) {
  try {
    const character = await getCharacterById(characterId);
    if (!character) return { success: false, error: 'Personaje no encontrado.' };

    const shareable = {};
    for (const field of SHAREABLE_CHARACTER_FIELDS) {
      if (character[field] !== undefined) shareable[field] = character[field];
    }

    const payload = {
      app: 'notbored-character',
      formatVersion: CHARACTER_SHARE_FORMAT_VERSION,
      exportedAt: new Date().toISOString(),
      character: shareable,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safeName = (character.name || 'personaje').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40);
    a.href = url;
    a.download = `${safeName}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function importCharacter() {
  const file = await new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    // Mismo motivo que en importAllData: en iOS un .json recibido por
    // AirDrop/WhatsApp a veces no lleva el MIME "application/json"
    input.accept = '.json,application/json,text/plain,text/json,*/*';
    input.style.display = 'none';
    document.body.appendChild(input);

    let settled = false;
    const cleanup = () => {
      window.removeEventListener('focus', onFocusFallback);
      input.remove();
    };
    input.onchange = () => {
      settled = true;
      const chosen = input.files?.[0] || null;
      cleanup();
      resolve(chosen);
    };
    function onFocusFallback() {
      setTimeout(() => {
        if (!settled) {
          settled = true;
          cleanup();
          resolve(null);
        }
      }, 300);
    }
    window.addEventListener('focus', onFocusFallback);
    input.click();
  });

  if (!file) return { success: false, canceled: true };

  try {
    const text = await readFileAsText(file);
    const parsed = JSON.parse(text);

    // Permisivo a propósito: mientras tenga un objeto "character" con al
    // menos un nombre, se acepta — así versiones futuras (o de otra app
    // compatible) con campos de más o de menos no rompen la importación.
    if (!parsed?.character?.name) {
      return { success: false, error: 'El archivo no es una ficha de personaje válida.' };
    }

    const data = {};
    for (const field of SHAREABLE_CHARACTER_FIELDS) {
      if (parsed.character[field] !== undefined) data[field] = parsed.character[field];
    }

    const newCharacter = await createCharacter(data);
    return { success: true, character: newCharacter };
  } catch {
    return { success: false, error: 'El archivo no se pudo leer como JSON válido.' };
  }
}

const webAdapter = {
  characters: {
    getAll: async () => getAllCharacters(),
    getById: async (id) => getCharacterById(id),
    create: async (data) => createCharacter(data),
    update: async (id, data) => updateCharacter(id, data),
    delete: async (id) => deleteCharacter(id),
    export: async (id) => exportCharacter(id),
    import: async () => importCharacter(),
  },
  window: {
    minimize() {},
    maximize() {},
    close() {},
  },
  conversations: {
    byCharacter: async (charId) => getConversationsByCharacter(charId),
    getInRange: async (since) => getConversationsInRange(since),
    create: async (charId) => createConversation(charId),
    appendMessage: async (convId, msg) => appendMessage(convId, msg),
    delete: async (id) => deleteConversation(id),
    rename: async (id, title) => renameConversation(id, title),
    deleteMessage: async (convId, msgId) => deleteMessage(convId, msgId),
    editMessage: async (convId, msgId, content) => editMessage(convId, msgId, content),
    patchMessage: async (convId, msgId, patch) => patchMessage(convId, msgId, patch),
    setMessages: async (convId, msgs) => setConversationMessages(convId, msgs),
    getMemories: async (convId) => getMemories(convId),
    addMemory: async (convId, memory) => addMemory(convId, memory),
    updateMemory: async (convId, memId, patch) => updateMemory(convId, memId, patch),
    deleteMemory: async (convId, memId) => deleteMemory(convId, memId),
    getLastMemoryMessageCount: async (convId) => getLastMemoryMessageCount(convId),
    setLastMemoryMessageCount: async (convId, count) => setLastMemoryMessageCount(convId, count),
    setScenario: async (convId, scenario) => setConversationScenario(convId, scenario),
  },
  ai: { sendMessage, onChunk, onDone, onError, removeListeners, stopGeneration },
  settings: {
    get: async () => getSettings(),
    update: async (updates) => updateSettings(updates),
  },
  uiPrefs: {
    get: async () => getUiPreferences(),
    update: async (updates) => updateUiPreferences(updates),
    setChatWallpaper: async (charId, value) => setChatWallpaper(charId, value),
  },
  image: { selectFile, saveAvatar, toBase64, deleteAvatar },
  forge: { generateCharacter: forgeGenerateCharacter },
  ollama: { getModels: async () => getOllamaModels() },
  personas: {
    getAll: async () => getAllPersonas(),
    create: async (data) => createPersona(data),
    update: async (id, patch) => updatePersona(id, patch),
    delete: async (id) => deletePersona(id),
    getSelection: async (charId) => getPersonaSelection(charId),
    setSelection: async (charId, sel) => setPersonaSelection(charId, sel),
  },
  wrappedReports: {
    getAll: async () => getAllWrappedReports(),
    save: async (report) => saveWrappedReport(report),
    delete: async (id) => deleteWrappedReport(id),
  },
  data: { exportAll: exportAllData, importAll: importAllData },
};

export function installWebAdapterIfNeeded() {
  // Si Electron ya definió window.electronAPI (vía preload.js), no lo tocamos.
  if (typeof window !== 'undefined' && !window.electronAPI) {
    window.electronAPI = webAdapter;
  }
}

export default webAdapter;
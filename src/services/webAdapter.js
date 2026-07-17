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
    createdAt: Date.now(),
    lastActivity: Date.now(),
  };
  convs.push(newConv);
  await persist('conversations', convs);
  return newConv;
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
function buildCharacterSystemPrompt(character) {
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
    character.scenario || '',
    'You know this world intimately. Act within its logic and rules.',
    '',
    '=== AUTHOR INSTRUCTIONS ===',
    character.systemPrompt || '',
    '',
    '=== ROLEPLAY RULES (NON-NEGOTIABLE) ===',
    `1. NEVER say 'As an AI...' or 'I cannot...' — you are ${character.name}.`,
    "2. If you don't know something, IMPROVISE within character, do not admit it.",
    '3. Use *asterisks* to describe actions, gestures, and emotions.',
    '   Example: *Crosses his arms and stares at you intently*',
    "4. Always respond in the user's language automatically (e.g., if they speak Spanish, respond in Spanish).",
    '5. Responses must be immersive: 2-4 paragraphs for narrative, 1 paragraph for casual dialogue.',
    '6. Remember previous events in the conversation and refer back to them.',
    '7. Do not use disclaimers, warnings, or meta-comments.',
  ];
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

async function sendMessage({ character, history, userMessage }) {
  const settings = await getSettings();
  const { baseURL, apiKey, meta, providerId } = getProviderConfig(settings);

  if (meta.requiresApiKey && !apiKey) {
    listeners.error.forEach(cb => cb(`Falta la API Key de ${meta.label}. Ve a Ajustes → IA y pégala.`));
    return { success: false };
  }
  const systemPrompt = buildCharacterSystemPrompt(character);
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
async function forgeGenerateCharacter(idea) {
  const settings = await getSettings();
  const { baseURL, apiKey, meta, providerId } = getProviderConfig(settings);
  if (meta.requiresApiKey && !apiKey) {
    return { success: false, error: `Falta la API Key de ${meta.label}. Configúrala en Ajustes.` };
  }

  const systemPrompt = `You are an expert RPG and video game narrative designer.
Your sole task is to generate deeply detailed NPC lorecards based on vague user ideas.
You must always strictly return a single, valid JSON object.
Do NOT include markdown blocks (like \`\`\`json), no pre-text, no post-text, no conversational filler. Just raw JSON.`;

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

  const model = (meta.models && !meta.models.includes(settings.model)) ? meta.defaultModel : (settings.model || meta.defaultModel);
  let forgeURL, forgeHeaders, forgeReqBody;

  if (meta.format === 'gemini-native') {
    forgeURL = `${baseURL}/models/${model}:generateContent`;
    forgeHeaders = { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey };
    forgeReqBody = {
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      systemInstruction: { parts: [{ text: systemPrompt }] },
      generationConfig: { temperature: 0.95, maxOutputTokens: 800 },
    };
  } else {
    forgeURL = `${baseURL}/chat/completions`;
    forgeHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` };
    forgeReqBody = {
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.95,
      max_tokens: 800,
    };
  }

  const forgeTarget = providerId === 'ollama'
    ? [forgeURL, { method: 'POST', headers: forgeHeaders, body: JSON.stringify(forgeReqBody) }]
    : ['/api/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: forgeURL, headers: forgeHeaders, body: forgeReqBody }),
      }];

  try {
    const resp = await fetch(...forgeTarget);
    if (!resp.ok) {
      const bodyText = await resp.text().catch(() => '');
      let detail = '';
      try { detail = JSON.parse(bodyText)?.error?.message || ''; } catch { detail = bodyText.slice(0, 200); }
      throw new Error(`Error al forjar personaje (código ${resp.status}).${detail ? ` ${detail}` : ''}`);
    }
    const data = await resp.json();
    const raw = meta.format === 'gemini-native'
      ? (data.candidates?.[0]?.content?.parts?.[0]?.text || '')
      : (data.choices?.[0]?.message?.content || '');
    const clean = raw.replace(/```json/g, '').replace(/```/g, '').trim();
    if (!clean) throw new Error('La IA devolvió una respuesta vacía.');
    const parsed = JSON.parse(clean);
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
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) { resolve(null); return; }
      pendingFile = file;
      resolve(`webfile://${file.name}`);
    };
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
 */
async function resizeImageToDataURL(file, maxDim = 1024, quality = 0.85) {
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
const BACKUP_KEYS = ['characters', 'conversations', 'settings', 'uiPreferences'];

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
    input.accept = 'application/json,.json';
    input.onchange = () => resolve(input.files?.[0] || null);
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

const webAdapter = {
  characters: {
    getAll: async () => getAllCharacters(),
    getById: async (id) => getCharacterById(id),
    create: async (data) => createCharacter(data),
    update: async (id, data) => updateCharacter(id, data),
    delete: async (id) => deleteCharacter(id),
  },
  window: {
    minimize() {},
    maximize() {},
    close() {},
  },
  conversations: {
    byCharacter: async (charId) => getConversationsByCharacter(charId),
    create: async (charId) => createConversation(charId),
    appendMessage: async (convId, msg) => appendMessage(convId, msg),
    delete: async (id) => deleteConversation(id),
    rename: async (id, title) => renameConversation(id, title),
    deleteMessage: async (convId, msgId) => deleteMessage(convId, msgId),
    editMessage: async (convId, msgId, content) => editMessage(convId, msgId, content),
    patchMessage: async (convId, msgId, patch) => patchMessage(convId, msgId, patch),
    setMessages: async (convId, msgs) => setConversationMessages(convId, msgs),
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
  data: { exportAll: exportAllData, importAll: importAllData },
};

export function installWebAdapterIfNeeded() {
  // Si Electron ya definió window.electronAPI (vía preload.js), no lo tocamos.
  if (typeof window !== 'undefined' && !window.electronAPI) {
    window.electronAPI = webAdapter;
  }
}

export default webAdapter;

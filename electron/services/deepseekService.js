const OpenAI = require('openai');
const { buildContextWindow } = require('./memoryBuffer');
const storage = require('./storageService');

/**
 * Crea y retorna el cliente OpenAI apuntando a DeepSeek.
 * Se llama en cada request para tomar la API key más reciente.
 */
function getClient() {
  const settings = storage.getSettings();

  switch (settings.provider) {

    case 'ollama':
      return new OpenAI({
        apiKey: 'ollama',
        baseURL: 'http://127.0.0.1:11434/v1',
      });

    case 'deepseek':
      return new OpenAI({
        apiKey: settings.apiKey,
        baseURL: 'https://api.deepseek.com/v1',
      });

    default:
      throw new Error('Proveedor IA no soportado');
  }
}

/**
 * Envía un mensaje y obtiene respuesta completa (no streaming).
 */
async function sendMessage(character, history, userMessage, userContextBlock = '') {
  const client = getClient();
  const settings = storage.getSettings();

  // 1. Construir el system prompt avanzado con el contexto del usuario
  const systemPrompt = buildCharacterSystemPrompt(character, userContextBlock);

  // 2. Aplicar buffer de memoria circular
  const contextMessages = buildContextWindow(
    history,
    systemPrompt,
    settings.maxContextTokens
  );

  // 3. Agregar el mensaje actual del usuario
  contextMessages.push({ role: 'user', content: userMessage });

  // 4. Llamar a la API
  //console.log('SETTINGS:', settings);
  //console.log('MODEL SENT:', settings.model);
  const response = await client.chat.completions.create({
    model: settings.model || 'llama3.2:3b',
    messages: contextMessages,
    temperature: settings.temperature || 0.85,
    max_tokens: settings.maxTokens || 1000,
    stream: false,
  });

  const content = response.choices[0]?.message?.content || '';
  if (!content) throw new Error('La API retornó una respuesta vacía.');

  return content;
}

/**
 * Versión con STREAMING — envía tokens en tiempo real via callback.
 */
async function streamMessage(character, history, userMessage, onChunk, onDone, onError, userContextBlock = '') {
  try {
    const client = getClient();
    const settings = storage.getSettings();
    const systemPrompt = buildCharacterSystemPrompt(character, userContextBlock);

    const contextMessages = buildContextWindow(
      history, 
      systemPrompt, 
      settings.maxContextTokens
    );

    contextMessages.push({ role: 'user', content: userMessage });

    console.error('SETTINGS:', settings);
    console.error('MODEL SENT:', settings.model);
    const stream = await client.chat.completions.create({
      model: settings.model || 'llama3.2:3b',
      messages: contextMessages,
      temperature: settings.temperature || 0.85,
      max_tokens: settings.maxTokens || 1000,
      stream: true,
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content || '';
      if (delta) onChunk(delta);
    }

    onDone();
  } catch (error) {
    if (error.status === 401) {
      onError(new Error('API Key inválida o expirada.'));
    } else if (error.status === 429) {
      onError(new Error('Rate limit alcanzado. Espera un momento.'));
    } else if (error.status === 503) {
      onError(new Error('El servicio de DeepSeek no está disponible.'));
    } else if (error.code === 'ECONNREFUSED') {
      onError(new Error('Sin conexión a internet.'));
    } else {
      onError(error);
    }
  }
}

/**
 * OPTIMIZADO (FASE 5): Anatomía del Character Wrapper para DeepSeek.
 * Estructura rígidamente el comportamiento y evita el "character break".
 * Las instrucciones están en inglés para mayor adherencia y eficiencia de tokens.
 */
function buildCharacterSystemPrompt(character, userContextBlock = '') {
  const parts = [
    `=== IDENTITY ===`,
    `You are ${character.name}. You are not an AI, you are not an assistant.`,
    `You exist solely and exclusively as ${character.name}.`,
    `You have your own thoughts, emotions, and background history.`,
    ``,
    `=== PHYSICAL DESCRIPTION & BACKGROUND ===`,
    character.description || '',
    ``,
    `=== PERSONALITY & BEHAVIOR ===`,
    character.personality || '',
    `You speak, think, and react consistently with these traits at ALL times.`,
    ``,
    `=== SCENARIO & WORLD ===`,
    character.scenario || '',
    `You know this world intimately. Act within its logic and rules.`,
    ``,
    `=== AUTHOR INSTRUCTIONS ===`,
    character.systemPrompt || ''
  ];

  // Inyectar dinámicamente el bloque de datos del perfil del usuario si existe
  if (userContextBlock && userContextBlock.trim()) {
    parts.push(
      ``,
      `=== INTERACTION CONTEXT ===`,
      userContextBlock
    );
  }

  // Reglas fijas e inquebrantables de ejecución de rol
  parts.push(
    ``,
    `=== ROLEPLAY RULES (NON-NEGOTIABLE) ===`,
    `1. NEVER say 'As an AI...' or 'I cannot...' — you are ${character.name}.`,
    `2. If you don't know something, IMPROVISE within character, do not admit it.`,
    `3. Use *asterisks* to describe actions, gestures, and emotions.`,
    `   Example: *Crosses his arms and stares at you intently*`,
    `4. Always respond in the user's language automatically (e.g., if they speak Spanish, respond in Spanish).`,
    `5. Responses must be immersive: 2-4 paragraphs for narrative, 1 paragraph for casual dialogue.`,
    `6. Remember previous events in the conversation and refer back to them.`,
    `7. Do not use disclaimers, warnings, or meta-comments.`
  );

  return parts.filter(Boolean).join('\n');
}

module.exports = { 
  sendMessage, 
  streamMessage 
};
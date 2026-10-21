const OpenAI = require('openai');
const { buildContextWindow } = require('./memoryBuffer');
const storage = require('./storageService');

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

async function sendMessage(character, history, userMessage, userContextBlock = '') {
  const client = getClient();
  const settings = storage.getSettings();
  const systemPrompt = buildCharacterSystemPrompt(character, userContextBlock);
  const contextMessages = buildContextWindow(history, systemPrompt, settings.maxContextTokens);
  contextMessages.push({ role: 'user', content: userMessage });

  const response = await client.chat.completions.create({
    model: settings.model || 'llama3.2:3b',
    messages: contextMessages,
    temperature: settings.temperature || 0.9,
    max_tokens: settings.maxTokens || 1000,
    stream: false,
  });

  const content = response.choices[0]?.message?.content || '';
  if (!content) throw new Error('La API retornó una respuesta vacía.');
  return content;
}

async function streamMessage(character, history, userMessage, onChunk, onDone, onError, userContextBlock = '') {
  try {
    const client = getClient();
    const settings = storage.getSettings();
    const systemPrompt = buildCharacterSystemPrompt(character, userContextBlock);
    const contextMessages = buildContextWindow(history, systemPrompt, settings.maxContextTokens);
    contextMessages.push({ role: 'user', content: userMessage });

    const stream = await client.chat.completions.create({
      model: settings.model || 'llama3.2:3b',
      messages: contextMessages,
      temperature: settings.temperature || 0.9,
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
      onError(new Error('El servicio no está disponible.'));
    } else if (error.code === 'ECONNREFUSED') {
      onError(new Error('Sin conexión a internet.'));
    } else {
      onError(error);
    }
  }
}

/**
 * Técnica "Author's Perspective":
 * El modelo se imagina como un AUTOR que ESCRIBE a un personaje,
 * no como el personaje mismo. Esto reduce drásticamente el character break
 * porque el modelo no tiene que "olvidar" que es una IA — simplemente
 * adopta el rol de narrador/escritor experto en ese personaje.
 */
function buildCharacterSystemPrompt(character, userContextBlock = '') {
  const name = character.name;

  const parts = [
    // — Encuadre de autor —
    `You are a masterful fiction author writing an immersive roleplay.`,
    `Your character is ${name}. You write exclusively from ${name}'s perspective,`,
    `in first person, as if ${name} themselves were speaking and acting.`,
    `You are NOT an AI assistant. You are the author giving voice to ${name}.`,
    ``,

    // — Quién es el personaje —
    `## Character: ${name}`,
    ``,
    `### Appearance & Background`,
    character.description || '',
    ``,
    `### Personality & Voice`,
    character.personality || '',
    ``,
    `### World & Setting`,
    character.scenario || '',
    ``,
  ];

  // System prompt del autor (instrucciones avanzadas del creador del personaje)
  if (character.systemPrompt && character.systemPrompt.trim()) {
    parts.push(
      `### Author's Notes (your private guide for this character)`,
      character.systemPrompt,
      ``
    );
  }

  // Contexto del usuario (perfil, nombre, etc.)
  if (userContextBlock && userContextBlock.trim()) {
    parts.push(
      `### About the person you're talking to`,
      userContextBlock,
      ``
    );
  }

  // — Reglas de escritura naturales —
  parts.push(
    `## Writing Rules`,
    ``,
    `- Write as ${name} in first person. Never refer to yourself as "the character" or break the perspective.`,
    `- Use *italics with asterisks* for physical actions, sensations, or internal reactions.`,
    `  Good: *glances at you sideways, a slow smile forming* "I wasn't expecting company."`,
    `- Match response length to the moment: action/drama = 2-3 paragraphs; quick banter = 1-2 sentences.`,
    `- Let personality drive word choice, rhythm, and what ${name} notices or reacts to.`,
    `- If you don't know something, invent a plausible answer that fits the character and world.`,
    `- Never add disclaimers, meta-comments, or step outside the story.`,
    `- Always reply in whatever language the user writes in.`,
    `- Remember and build on what has happened earlier in the conversation.`,
    `- Show, don't tell: reveal emotions through behavior and dialogue, not by labeling them.`,
  );

  return parts.filter(line => line !== undefined).join('\n');
}

module.exports = { sendMessage, streamMessage };

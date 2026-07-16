// ============================================================================
// Registro de proveedores de IA disponibles en la app.
//
// Para añadir un proveedor NUEVO (gratuito o no):
//   1. Comprueba que sea compatible con el formato de OpenAI en
//      POST {baseURL}/chat/completions con streaming SSE (la mayoría de los
//      gratuitos lo son: Groq, OpenRouter, Together, Cerebras, Fireworks...).
//   2. Añade una entrada abajo con su baseURL, si necesita API Key, y sus
//      modelos. Nada más — sendMessage/forge ya saben usar cualquier entrada
//      de este registro automáticamente.
// ============================================================================

export const PROVIDERS = {
  deepseek: {
    label: 'DeepSeek',
    baseURL: 'https://api.deepseek.com/v1',
    requiresApiKey: true,
    keyPlaceholder: 'sk-...',
    models: ['deepseek-chat', 'deepseek-reasoner'],
    defaultModel: 'deepseek-chat',
  },
  ollama: {
    label: 'Ollama (red local)',
    baseURL: null, // se resuelve en tiempo real según la IP desde la que abres la app
    requiresApiKey: false,
    keyPlaceholder: '',
    models: null, // se obtiene dinámicamente con ollama.getModels()
    defaultModel: null,
  },

  gemini: {
    label: 'Google Gemini',
    // Endpoint compatible con OpenAI que expone Google (nota la barra final, es necesaria)
    baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
    requiresApiKey: true,
    keyPlaceholder: 'AIza...',
    models: ['gemini-2.5-flash', 'gemini-2.5-flash-lite'],
    defaultModel: 'gemini-2.5-flash',
  },

  mistral: {
    label: 'Mistral AI',
    baseURL: 'https://api.mistral.ai/v1',
    requiresApiKey: true,
    keyPlaceholder: '...',
    models: ['mistral-small-latest', 'open-mistral-nemo'],
    defaultModel: 'mistral-small-latest',
  },

  cerebras: {
    label: 'Cerebras',
    baseURL: 'https://api.cerebras.ai/v1',
    requiresApiKey: true,
    keyPlaceholder: 'csk-...',
    models: ['llama-3.3-70b', 'llama3.1-8b'],
    defaultModel: 'llama-3.3-70b',
  },

  // Ejemplo listo para descomentar en cuanto tengas una key gratuita de Groq:
  // groq: {
  //   label: 'Groq',
  //   baseURL: 'https://api.groq.com/openai/v1',
  //   requiresApiKey: true,
  //   keyPlaceholder: 'gsk_...',
  //   models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'],
  //   defaultModel: 'llama-3.3-70b-versatile',
  // },
};

export const DEFAULT_PROVIDER = 'deepseek';

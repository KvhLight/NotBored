// ============================================================================
// netlify/functions/proxy.js
//
// Proxy server-side genérico. Existe por un motivo muy concreto: algunas
// APIs (Gemini es el caso confirmado) NO permiten que un navegador las
// llame directamente (bloquean CORS). Al pasar la petición por aquí, la
// llamada real sale desde el servidor de Netlify, no desde el navegador —
// así que el bloqueo de CORS no aplica nunca.
//
// Es deliberadamente "tonto": el cliente (webAdapter.js) decide la URL
// completa, las cabeceras y el cuerpo exactos según el formato de cada
// proveedor (OpenAI-compatible, Gemini nativo, etc.) — este proxy solo
// reenvía tal cual. Así, soportar un formato nuevo no requiere tocar esto.
//
// Ollama NO pasa por aquí: como corre en tu red local (tu PC), este proxy
// (que vive en la nube) no podría alcanzarlo. Ollama sigue llamándose
// directo desde el navegador.
// ============================================================================

// Solo estos dominios pueden ser destino del proxy — evita que alguien use
// esta función como intermediario anónimo hacia cualquier web. Si añades un
// proveedor nuevo en src/config/providers.js, añade también su dominio aquí.
const ALLOWED_HOSTS = [
  'api.deepseek.com',
  'generativelanguage.googleapis.com',
  'api.mistral.ai',
  'api.cerebras.ai',
];

export default async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const { url, headers, body } = await req.json();

    if (!url || typeof url !== 'string') {
      return new Response(JSON.stringify({ error: 'Falta url.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    let hostname;
    try {
      hostname = new URL(url).hostname;
    } catch {
      return new Response(JSON.stringify({ error: 'URL inválida.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!ALLOWED_HOSTS.includes(hostname)) {
      return new Response(JSON.stringify({ error: 'Dominio no permitido.' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const upstream = await fetch(url, {
      method: 'POST',
      headers: headers || { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    // Reenviamos la respuesta tal cual llega (incluye el streaming SSE)
    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        'Content-Type': upstream.headers.get('content-type') || 'application/json',
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message || 'Error en el proxy.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const config = { path: '/api/proxy' };

// ============================================================================
// netlify/functions/proxy.js
//
// Proxy server-side hacia el proveedor de IA elegido. Existe por un motivo
// muy concreto: algunas APIs (Gemini es el caso confirmado) NO permiten que
// un navegador las llame directamente (bloquean CORS). Al pasar la petición
// por aquí, la llamada real sale desde el servidor de Netlify, no desde el
// navegador — así que el bloqueo de CORS no aplica nunca.
//
// Ollama NO pasa por aquí: como corre en tu red local (tu PC), este proxy
// (que vive en la nube) no podría alcanzarlo. Ollama sigue llamándose
// directo desde el navegador, como hasta ahora.
// ============================================================================

export default async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const { baseURL, apiKey, body } = await req.json();

    if (!baseURL || typeof baseURL !== 'string') {
      return new Response(JSON.stringify({ error: 'Falta baseURL.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const cleanBase = baseURL.replace(/\/+$/, ''); // sin barra final duplicada
    const upstream = await fetch(`${cleanBase}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey || ''}`,
      },
      body: JSON.stringify(body),
    });

    // Reenviamos la respuesta tal cual llega (incluye el streaming SSE si body.stream === true)
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

// Ruta limpia: la función queda accesible en /api/proxy en vez de
// /.netlify/functions/proxy
export const config = { path: '/api/proxy' };

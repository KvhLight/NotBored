// ============================================================================
// api/proxy.js
//
// Equivalente a netlify/functions/proxy.js pero en el formato que espera
// Vercel (Edge Function). Misma lógica exacta, solo cambia la "envoltura":
// Vercel detecta automáticamente cualquier archivo dentro de /api y lo
// expone en esa misma ruta, así que este archivo queda accesible en
// /api/proxy — igual que en Netlify. El frontend (webAdapter.js) no necesita
// ningún cambio porque ya llama a la ruta relativa '/api/proxy'.
// ============================================================================

export const config = { runtime: 'edge' };

const ALLOWED_HOSTS = [
  'api.deepseek.com',
  'generativelanguage.googleapis.com',
  'api.mistral.ai',
  'api.cerebras.ai',
];

export default async function handler(req) {
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
}

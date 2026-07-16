// ============================================================================
// netlify/functions/proxy.js - Versión Universal Inteligente
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

    // Identificamos si es una URL directa de Gemini o un endpoint estándar
    const isGemini = baseURL.includes('googleapis.com');
    
    let targetURL = baseURL;
    let headers = { 'Content-Type': 'application/json' };

    if (isGemini) {
      const cleanBase = baseURL.replace(/\/+$/, '');

      targetURL = cleanBase.endsWith('/chat/completions')
        ? `${cleanBase}?key=${apiKey || ''}`
        : `${cleanBase}/chat/completions?key=${apiKey || ''}`;

      console.log(targetURL);
    } else {
      // Para DeepSeek u otros, construimos la ruta estándar e incluimos la cabecera de autenticación
      const cleanBase = baseURL.replace(/\/+$/, '');
      if (!cleanBase.endsWith('/chat/completions')) {
        targetURL = `${cleanBase}/chat/completions`;
      }
      headers['Authorization'] = `Bearer ${apiKey || ''}`;
    }

    const upstream = await fetch(targetURL, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    const responseText = await upstream.text();

    console.log("URL:", targetURL);
    console.log("STATUS:", upstream.status);
    console.log("BODY:", responseText);

    return new Response(responseText, {
      status: upstream.status,
      headers: {
        'Content-Type': 'application/json',
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
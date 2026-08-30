export async function onRequest(context: {
  request: Request;
  env: { FASTAPI_URL?: string };
}) {
  const { request, env } = context;
  const url = new URL(request.url);
  const backendBase = env.FASTAPI_URL || 'https://cdworkspace-ai-backend.onrender.com';

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization',
      },
    });
  }

  const targetUrl = backendBase + url.pathname + url.search;
  try {
    const resp = await fetch(targetUrl, {
      method: request.method,
      headers: request.headers,
      body: ['GET','HEAD'].includes(request.method) ? undefined : request.body,
      // @ts-ignore
      duplex: 'half',
    });
    const headers = new Headers(resp.headers);
    headers.set('Access-Control-Allow-Origin', '*');
    return new Response(resp.body, { status: resp.status, headers });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 502,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
}

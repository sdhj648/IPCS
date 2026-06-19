export async function onRequest(context) {
  const { request } = context;

  // Handle preflight OPTIONS
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Content-Encoding, X-Requested-With",
        "Access-Control-Max-Age": "86400"
      }
    });
  }

  // Consume the upload stream to accurately register upload bytes on Cloudflare's side
  if (request.body) {
    const reader = request.body.getReader();
    while (true) {
      const { done } = await reader.read();
      if (done) break;
    }
  }

  return new Response("", {
    status: 200,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
      "Connection": "keep-alive"
    }
  });
}

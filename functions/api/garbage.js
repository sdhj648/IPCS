export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  
  // Handle preflight OPTIONS
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Max-Age": "86400"
      }
    });
  }

  // Get chunk size in MB (e.g., ckSize=10 for 10MB chunk download)
  const ckSize = parseInt(url.searchParams.get("ckSize")) || 15;
  const size = Math.min(Math.max(ckSize, 1), 100) * 1024 * 1024; // Limit between 1MB and 100MB

  // Allocate a static buffer to reuse for streaming, saving Cloudflare CPU
  const buffer = new Uint8Array(65536); // 64KB chunks
  for (let i = 0; i < buffer.length; i++) {
    buffer[i] = Math.floor(Math.random() * 256);
  }

  let bytesWritten = 0;
  const stream = new ReadableStream({
    pull(controller) {
      if (bytesWritten >= size) {
        controller.close();
      } else {
        const remaining = size - bytesWritten;
        const chunk = remaining < buffer.length ? buffer.subarray(0, remaining) : buffer;
        controller.enqueue(chunk);
        bytesWritten += chunk.length;
      }
    }
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Length": size.toString(),
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS"
    }
  });
}

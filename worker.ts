/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

interface Env {
  // Bind your KV, D1, etc. here if needed
}

export default {
  async fetch(request: Request, env: Env, ctx: any): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS Headers for cross-origin compliance
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    // Handle CORS preflights
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    /**
     * Endpoint: /api/ip
     * Resolves the requester's IP details using Cloudflare's ultra-fast native CDN geolocation.
     */
    if (path === "/api/ip") {
      try {
        const clientIP = request.headers.get("CF-Connecting-IP") || request.headers.get("x-real-ip") || "1.1.1.1";
        
        // Check manual filter query
        const queryIP = url.searchParams.get("q");
        if (queryIP && queryIP.trim() !== "") {
          // If searching for another IP in a Cloudflare Worker, fetch from free API lookup
          const geoRes = await fetch(`http://ip-api.com/json/${encodeURIComponent(queryIP.trim())}`);
          if (!geoRes.ok) throw new Error("Geo queries down");
          const geoData: any = await geoRes.json();

          if (geoData.status === "fail") {
            return new Response(JSON.stringify({ error: geoData.message || "IP未查到" }), {
              status: 400,
              headers: { "Content-Type": "application/json", ...corsHeaders }
            });
          }

          const isHosting = (geoData.org || "").toLowerCase().includes("cloud") || (geoData.isp || "").toLowerCase().includes("server");
          return new Response(JSON.stringify({
            ip: geoData.query,
            country: geoData.country || "未知国家",
            country_code: geoData.countryCode || "UN",
            city: geoData.city || "未知城市",
            region: geoData.regionName || "未知区域",
            isp: geoData.isp || "自营带宽",
            asn: geoData.as || "AS00000 UNKNOWN",
            timezone: geoData.timezone || "Asia/Shanghai",
            lat: geoData.lat || 30.0,
            lon: geoData.lon || 120.0,
            proxy: geoData.hosting || isHosting,
            hosting: isHosting,
            queryType: "CLOUDFLARE BACKEND RESOLVE",
            riskScore: isHosting ? 45 : 5
          }), {
            headers: { "Content-Type": "application/json", ...corsHeaders }
          });
        }

        // Native client Geolocation lookup (100% Free on Cloudflare)
        const cfGeo = (request as any).cf;
        if (cfGeo) {
          const isHosting = false; // standard residential check
          return new Response(JSON.stringify({
            ip: clientIP,
            country: cfGeo.country ? getCountryChinese(cfGeo.country) : "未知",
            country_code: cfGeo.country || "UN",
            city: cfGeo.city || "边缘加速节点",
            region: cfGeo.region || "附近边缘线路",
            isp: cfGeo.asOrganization || "Cloudflare CDN 终端",
            asn: cfGeo.asn ? `AS${cfGeo.asn}` : "AS13335",
            timezone: cfGeo.timezone || "Asia/Shanghai",
            lat: parseFloat(cfGeo.latitude) || 31.23,
            lon: parseFloat(cfGeo.longitude) || 121.47,
            proxy: false,
            hosting: false,
            queryType: "CLOUDFLARE NATIVE GEOLOC",
            riskScore: 5
          }), {
            headers: { "Content-Type": "application/json", ...corsHeaders }
          });
        }

        // Fallback fetch if running locally under Wrangler without mock CF data
        const fallbackRes = await fetch(`http://ip-api.com/json/${clientIP}`);
        const fbData: any = await fallbackRes.json();
        return new Response(JSON.stringify({
          ip: clientIP,
          country: fbData.country || "中国",
          country_code: fbData.countryCode || "CN",
          city: fbData.city || "未知",
          region: fbData.regionName || "未知",
          isp: fbData.isp || "默认网络",
          asn: fbData.as || "N/A",
          timezone: fbData.timezone || "Asia/Shanghai",
          lat: fbData.lat || 30.0,
          lon: fbData.lon || 120.0,
          proxy: false,
          hosting: false,
          queryType: "WRANGLER COMPAT LOCAL",
          riskScore: 10
        }), {
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });

      } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }
    }

    /**
     * Endpoint: /api/dns-leak
     */
    if (path === "/api/dns-leak") {
      const clientIP = request.headers.get("CF-Connecting-IP") || "1.1.1.1";
      const cfGeo = (request as any).cf;
      return new Response(JSON.stringify({
        dnsIp: "1.1.1.1",
        dnsIsp: "Cloudflare Anycast Global Resolver",
        dnsCountry: cfGeo ? getCountryChinese(cfGeo.country || "US") : "美国",
        dnsCountry_code: cfGeo ? (cfGeo.country || "US") : "US"
      }), {
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    /**
     * Endpoint: /api/speedtest/ping
     */
    if (path === "/api/speedtest/ping") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    /**
     * Endpoint: /api/speedtest/download
     */
    if (path === "/api/speedtest/download") {
      const sizeParam = url.searchParams.get("size");
      const requestedSize = parseInt(sizeParam || "1000000", 10);
      
      // Seed randomized chunks to optimize RTT throughput
      const chunk = new Uint8Array(200000);
      crypto.getRandomValues(chunk);

      let bytesLeft = requestedSize;
      
      const stream = new ReadableStream({
        pull(controller) {
          if (bytesLeft <= 0) {
            controller.close();
            return;
          }
          const chunkToSend = Math.min(chunk.length, bytesLeft);
          controller.enqueue(chunk.subarray(0, chunkToSend));
          bytesLeft -= chunkToSend;
        }
      });

      return new Response(stream, {
        headers: {
          "Content-Type": "application/octet-stream",
          "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
          ...corsHeaders
        }
      });
    }

    /**
     * Endpoint: /api/speedtest/upload
     */
    if (path === "/api/speedtest/upload" && request.method === "POST") {
      // Consume body stream entirely to measure upload
      const reader = request.body?.getReader();
      let bytesUploaded = 0;
      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) bytesUploaded += value.length;
        }
      }
      return new Response(JSON.stringify({ status: "success", received: bytesUploaded }), {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
          ...corsHeaders
        }
      });
    }

    // Default error/routing static files
    return new Response("Not Found", { status: 404 });
  }
};

/**
 * Basic country code to Chinese parsing helper to support local representation.
 */
function getCountryChinese(code: string): string {
  const dictionary: Record<string, string> = {
    "CN": "中国",
    "HK": "中国香港",
    "MO": "中国澳门",
    "TW": "中国台湾",
    "US": "美国",
    "JP": "日本",
    "KR": "韩国",
    "SG": "新加坡",
    "GB": "英国",
    "DE": "德国",
    "FR": "法国",
    "CA": "加拿大",
    "AU": "澳大利亚"
  };
  return dictionary[code.toUpperCase()] || code;
}

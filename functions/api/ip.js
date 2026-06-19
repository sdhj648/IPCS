export async function onRequest(context) {
  const { request } = context;
  
  // 1. 获取访客真实公网IP (Get visitor's real public IP)
  let ip = request.headers.get("cf-connecting-ip") || request.headers.get("x-real-ip");
  
  // Fallbacks if not detected
  if (!ip) {
    const clientAddress = request.headers.get("x-forwarded-for");
    if (clientAddress) {
      ip = clientAddress.split(",")[0].trim();
    } else {
      ip = "127.0.0.1";
    }
  }

  // 2. 读取 request.cf 内置对象 (Read request.cf built-in object)
  const cf = request.cf || {};

  // 3. 自动判断IP是IPv4还是IPv6 (Automatically determine if IP is IPv4 or IPv6)
  const ipType = ip.includes(":") ? "IPv6" : "IPv4";

  // Using standard JS Intl to resolve full country name based on country code
  let countryName = "未知国家";
  if (cf.country) {
    try {
      const regionNames = new Intl.DisplayNames(["zh-CN"], { type: "region" });
      countryName = regionNames.of(cf.country) || cf.country;
    } catch (e) {
      countryName = cf.country;
    }
  }

  // Map to friendly names if needed
  const regionName = cf.region || "未知省份";
  const cityName = cf.city || "未知城市";
  const asnNumber = cf.asn ? `AS${cf.asn}` : "未知ASN";
  const operatorName = cf.asOrganization || "未知运营商";
  const cfColo = cf.colo || "未知节点";
  const latitude = cf.latitude || "未知";
  const longitude = cf.longitude || "未知";
  const timezone = cf.timezone || "未知时区";

  // 4. 返回格式化JSON数据 (Format JSON data response)
  const data = {
    ip: ip,
    ip_type: ipType,
    country_code: cf.country || "Unknown",
    country_name: countryName,
    region: regionName,
    city: cityName,
    asn: asnNumber,
    org: operatorName,
    colo: cfColo,
    latitude: latitude,
    longitude: longitude,
    timezone: timezone,
    user_agent: request.headers.get("user-agent") || ""
  };

  // 5. 头部添加跨域允许、禁止缓存的响应头 (Add CORS and cache headers)
  return new Response(JSON.stringify(data, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      "Pragma": "no-cache",
      "Expires": "0"
    }
  });
}

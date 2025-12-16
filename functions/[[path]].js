export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  // GET /api/data - 读取 XML
  if (url.pathname === '/api/data' && request.method === 'GET') {
    let xml = await env.NAV_DATA.get('nav_data');
    if (!xml) {
      xml = `<?xml version="1.0" encoding="UTF-8"?>
<navigation>
  <admin username="admin" password="pbkdf2:sha256:600000:example:example" />
</navigation>`;
      await env.NAV_DATA.put('nav_data', xml);
    }
    return new Response(xml, {
      headers: { 'Content-Type': 'text/xml;charset=utf-8' }
    });
  }

  // POST /api/save - 保存 XML
  if (url.pathname === '/api/save' && request.method === 'POST') {
    try {
      const body = await request.text();
      await env.NAV_DATA.put('nav_data', body);
      return new Response('OK', { status: 200 });
    } catch (e) {
      return new Response('Error: ' + e.message, { status: 500 });
    }
  }

  // 其他所有请求直接放行给静态文件
  return await context.next();
}

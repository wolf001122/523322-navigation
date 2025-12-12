// functions/[[path]].js  — 必须这个名字！
// 同时支持读取和保存到 KV

export const onRequest = async (context) => {
  const { request, env } = context;
  const url = new URL(request.url);

  // 读取数据：GET /api/data
  if (url.pathname === '/api/data' && request.method === 'GET') {
    let xml = await env.NAV_DATA.get('nav_data');
    if (!xml) {
      // 首次访问自动创建初始数据
      xml = `<?xml version="1.0" encoding="UTF-8"?>
<navigation>
  <admin username="admin" password="pbkdf2:sha256:600000:example:example" />
  <category name="常用工具">
    <link name="语雀" url="https://www.yuque.com" desc="专业的云端知识库"/>
    <link name="GitHub" url="https://github.com" desc="全球最大开源社区"/>
  "/>
  </category>
</navigation>`;
      await env.NAV_DATA.put('nav_data', xml);
    }
    return new Response(xml, {
      headers: { 'Content-Type': 'text/xml; charset=utf-8' }
    });
  }

  // 保存数据：POST /api/save
  if (url.pathname === '/api/save' && request.method === 'POST') {
    try {
      const body = await request.text();
      await env.NAV_DATA.put('nav_data', body);
      return new Response('OK', { status: 200 });
    } catch (e) {
      return new Response('Save failed: ' + e.message, { status: 500 });
    }
  }

  // 其他路径交给静态文件
  return env.ASSETS.fetch(request);
};

// functions/[[path]].js — 必须这个名字！处理 /api/data (GET 读 KV) 和 /api/save (POST 写 KV)

export async function onRequest(context) {
  const { request, next, env } = context;
  const url = new URL(request.url);

  // GET /api/data：从 KV 读数据
  if (url.pathname === '/api/data' && request.method === 'GET') {
    let xml = await env.NAV_DATA.get('nav_data');
    if (!xml) {
      // 首次初始化数据
      xml = `<?xml version="1.0" encoding="UTF-8"?>
<navigation>
  <admin username="admin" password="pbkdf2:sha256:600000:example:example" />
  <category name="常用工具">
    <link name="语雀" url="https://www.yuque.com" desc="专业的云端知识库"/>
    <link name="GitHub" url="https://github.com" desc="全球最大开源社区"/>
  </category>
  <category name="生物信息">
    <link name="NCBI" url="https://www.ncbi.nlm.nih.gov" desc="国家生物技术信息中心"/>
  </category>
</navigation>`;
      await env.NAV_DATA.put('nav_data', xml);
    }
    return new Response(xml, {
      headers: { 'Content-Type': 'text/xml;charset=utf-8' }
    });
  }

  // POST /api/save：写入 KV
  if (url.pathname === '/api/save' && request.method === 'POST') {
    try {
      const body = await request.text();
      await env.NAV_DATA.put('nav_data', body);
      return new Response('保存成功', { status: 200 });
    } catch (e) {
      return new Response('保存失败: ' + e.message, { status: 500 });
    }
  }

  // 其他路径：静态文件
  return next();
}

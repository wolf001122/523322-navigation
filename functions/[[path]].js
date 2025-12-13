// functions/[[path]].js — 添加图片上传接口
export async function onRequest(context) {
  const { request, next, env } = context;
  const url = new URL(request.url);

  // GET /api/data：读 KV
  if (url.pathname === '/api/data' && request.method === 'GET') {
    let xml = await env.NAV_DATA.get('nav_data');
    if (!xml) {
      xml = `<?xml version="1.0" encoding="UTF-8"?>
<navigation>
  <admin username="admin" password="pbkdf2:sha256:600000:example:example" />
  <category name="常用工具">
    <link name="语雀" url="https://www.yuque.com" desc="专业的云端知识库" icon=""/>
  </category>
</navigation>`;
      await env.NAV_DATA.put('nav_data', xml);
    }
    return new Response(xml, { headers: { 'Content-Type': 'text/xml;charset=utf-8' } });
  }

  // POST /api/save：写 KV
  if (url.pathname === '/api/save' && request.method === 'POST') {
    try {
      const body = await request.text();
      await env.NAV_DATA.put('nav_data', body);
      return new Response('保存成功', { status: 200 });
    } catch (e) {
      return new Response('保存失败: ' + e.message, { status: 500 });
    }
  }

  // POST /api/upload：上传图片到 R2，返回 URL
  if (url.pathname === '/api/upload' && request.method === 'POST') {
    try {
      const formData = await request.formData();
      const file = formData.get('file');
      if (!file) return new Response('无文件', { status: 400 });
      const key = `${Date.now()}-${file.name}`; // 唯一文件名
      await env.ICON_BUCKET.put(key, file.stream(), { contentType: file.type });
      const url = `https://pub-您的R2域名.r2.dev/${key}`; // R2 公共 URL（替换您的 R2 域名）
      return new Response(url, { status: 200 });
    } catch (e) {
      return new Response('上传失败: ' + e.message, { status: 500 });
    }
  }

  // 其他路径静态文件
  return next();
}

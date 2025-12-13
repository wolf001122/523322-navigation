export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);

  // GET /api/data
  if (url.pathname === '/api/data' && request.method === 'GET') {
    try {
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
    } catch (e) {
      return new Response('数据加载失败: ' + e.message, { status: 500 });
    }
  }

  // POST /api/save
  if (url.pathname === '/api/save' && request.method === 'POST') {
    try {
      const body = await request.text();
      await env.NAV_DATA.put('nav_data', body);
      return new Response('保存成功', { status: 200 });
    } catch (e) {
      return new Response('保存失败: ' + e.message, { status: 500 });
    }
  }

  // POST /api/upload - 上传到 R2
  if (url.pathname === '/api/upload' && request.method === 'POST') {
    try {
      const formData = await request.formData();
      const file = formData.get('file');
      if (!file) {
        return new Response('无文件上传', { status: 400 });
      }

      const key = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      await env.ICON_BUCKET.put(key, file.stream(), {
        httpMetadata: { contentType: file.type }
      });

      const publicUrl = `https://pub-0bb15820dbcd4d9a9c46bffea3806e50.r2.dev/${key}`;
      return new Response(publicUrl, { status: 200 });
    } catch (e) {
      console.error('上传错误:', e);
      return new Response('上传失败: ' + e.message, { status: 500 });
    }
  }

  // 其他路径交给静态文件
  return next();
}

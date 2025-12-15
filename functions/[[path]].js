export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  // 后台登录检查：宽松放行所有包含 login.html 的路径
  if (url.pathname.includes('login.html')) {
    return context.next();
  }

  // 其他 /admin/ 路径检查登录
  if (url.pathname.startsWith('/admin/')) {
    const cookie = request.headers.get('cookie') || '';
    if (!cookie.includes('admin_logged_in=true')) {
      return Response.redirect(new URL('/admin/login.html', request.url), 302);
    }
  }

  // GET /api/data - 返回正式导航 XML 数据
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

  // POST /api/save - 保存正式导航数据（原有接口保留）
  if (url.pathname === '/api/save' && request.method === 'POST') {
    try {
      const body = await request.text();
      await env.NAV_DATA.put('nav_data', body);
      return new Response('保存成功', { status: 200 });
    } catch (e) {
      return new Response('保存失败: ' + e.message, { status: 500 });
    }
  }

  // 新增：POST /api/save-links - 接收 JSON 链接数组，安全重建 XML
  if (url.pathname === '/api/save-links' && request.method === 'POST') {
    try {
      const links = await request.json(); // 接收 allLinks 数组

      // 读取当前 KV 数据
      let currentData = await env.NAV_DATA.get('nav_data');
      if (!currentData) {
        return new Response('No data found', { status: 404 });
      }

      const parser = new DOMParser();
      const doc = parser.parseFromString(currentData, 'text/xml');

      // 清空所有链接
      doc.querySelectorAll('link').forEach(link => link.remove());

      // 根据接收的 links 数组重建链接
      links.forEach(link => {
        const catElements = doc.querySelectorAll('category');
        const cat = catElements[link.catIdx];
        if (cat) {
          const subElements = cat.querySelectorAll('subcategory');
          const sub = subElements[link.subIdx];
          if (sub) {
            const newLink = doc.createElement('link');
            newLink.setAttribute('name', link.name);
            newLink.setAttribute('url', link.url);
            if (link.desc) newLink.setAttribute('desc', link.desc);
            if (link.icon) newLink.setAttribute('icon', link.icon);
            sub.appendChild(newLink);
          }
        }
      });

      const serializer = new XMLSerializer();
      const newXml = serializer.serializeToString(doc);

      // 保存回 KV
      await env.NAV_DATA.put('nav_data', newXml);

      return new Response('Saved successfully', { status: 200 });
    } catch (e) {
      return new Response('Save failed: ' + e.message, { status: 500 });
    }
  }

  // POST /api/upload - 上传图标到 R2
  if (url.pathname === '/api/upload' && request.method === 'POST') {
    try {
      const formData = await request.formData();
      const file = formData.get('file');
      if (!file) return new Response('无文件', { status: 400 });

      const key = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      await env.ICON_BUCKET.put(key, file.stream(), {
        httpMetadata: { contentType: file.type }
      });

      const publicUrl = `https://pub-0bb15820dbcd4d9a9c46bffea3806e50.r2.dev/${key}`;
      return new Response(publicUrl, { status: 200 });
    } catch (e) {
      return new Response('上传失败: ' + e.message, { status: 500 });
    }
  }

  // 其他路径交给静态文件
  return context.next();
}

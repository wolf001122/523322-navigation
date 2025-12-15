export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  // 放行 login.html
  if (url.pathname.includes('login.html')) {
    return await context.next();
  }

  // 其他 admin 路径检查登录
  if (url.pathname.startsWith('/admin/')) {
    const cookie = request.headers.get('cookie') || '';
    if (!cookie.includes('admin_logged_in=true')) {
      return Response.redirect(new URL('/admin/login.html', request.url).toString(), 302);
    }
  }

  // GET /api/data - 返回 XML 数据
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

  // POST /api/save - 保存完整 XML
  if (url.pathname === '/api/save' && request.method === 'POST') {
    try {
      const body = await request.text();
      await env.NAV_DATA.put('nav_data', body);
      return new Response('保存成功', { status: 200 });
    } catch (e) {
      return new Response('保存失败: ' + e.message, { status: 500 });
    }
  }

  // POST /api/save-links - 新接口：接收链接数组重建 XML
  if (url.pathname === '/api/save-links' && request.method === 'POST') {
    try {
      const links = await request.json();

      let currentData = await env.NAV_DATA.get('nav_data');
      if (!currentData) {
        return new Response('No data found', { status: 404 });
      }

      const parser = new DOMParser();
      const doc = parser.parseFromString(currentData, 'text/xml');

      // 清空所有链接
      doc.querySelectorAll('link').forEach(el => el.remove());

      // 重建链接
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

      await env.NAV_DATA.put('nav_data', newXml);

      return new Response('Saved successfully', { status: 200 });
    } catch (e) {
      return new Response('Save failed: ' + e.message, { status: 500 });
    }
  }

  // POST /api/upload - 上传图标
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
  return await context.next();
}

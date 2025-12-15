export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);

  // 后台登录检查：宽松放行所有包含 login.html 的路径（彻底避免循环）
  if (url.pathname.includes('login.html')) {
    return next();
  }


  // GET /api/data - 返回正式导航 XML 数据
  if (url.pathname === '/api/data' && request.method === 'GET') {
    let xml = await env.NAV_DATA.get('nav_data');
    if (!xml) {
      xml = `<?xml version="1.0" encoding="UTF-8"?>
<navigation>
  <admin username="admin" password="pbkdf2:sha256:600000:b6688978b64829e08a89ef11a0596a36:43b4cb6651f9529b45a68fa81ce54a4f8d1348de36681c39e4bcac00a268ab3f" />
</navigation>`;
      await env.NAV_DATA.put('nav_data', xml);
    }
    return new Response(xml, {
      headers: { 'Content-Type': 'text/xml;charset=utf-8' }
    });
  }

  // POST /api/save - 保存正式导航数据
  if (url.pathname === '/api/save' && request.method === 'POST') {
    try {
      const body = await request.text();
      await env.NAV_DATA.put('nav_data', body);
      return new Response('保存成功', { status: 200 });
    } catch (e) {
      return new Response('保存失败: ' + e.message, { status: 500 });
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

  // GET /api/friendly - 获取友情链接
  if (url.pathname === '/api/friendly' && request.method === 'GET') {
    try {
      let links = await env.NAV_DATA.get('friendly_links');
      links = links ? JSON.parse(links) : [];
      return new Response(JSON.stringify(links), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (e) {
      return new Response(JSON.stringify([]), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  // POST /api/friendly - 保存友情链接
  if (url.pathname === '/api/friendly' && request.method === 'POST') {
    try {
      const body = await request.json();
      await env.NAV_DATA.put('friendly_links', JSON.stringify(body));
      return new Response('友情链接保存成功', { status: 200 });
    } catch (e) {
      return new Response('保存失败: ' + e.message, { status: 500 });
    }
  }

  // GET /api/pending - 获取待审核提交
  if (url.pathname === '/api/pending' && request.method === 'GET') {
    try {
      let pending = await env.NAV_DATA.get('pending_submissions');
      pending = pending ? JSON.parse(pending) : [];
      return new Response(JSON.stringify(pending), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (e) {
      return new Response(JSON.stringify([]), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  // POST /api/pending - 保存待审核提交
  if (url.pathname === '/api/pending' && request.method === 'POST') {
    try {
      const body = await request.json();
      await env.NAV_DATA.put('pending_submissions', JSON.stringify(body));
      return new Response('待审核数据保存成功', { status: 200 });
    } catch (e) {
      return new Response('保存失败: ' + e.message, { status: 500 });
    }
  }

  // 其他路径交给静态文件
  return next();
}



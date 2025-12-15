export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);

  // 后台登录检查：优先放行登录页（宽松匹配，兼容任何尾斜杠或查询）
  if (url.pathname === '/admin/login.html' || url.pathname === '/admin/login.html/' || url.pathname.startsWith('/admin/login.html?')) {
    return next();
  }

  // 对其他 /admin/ 路径检查登录
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
    // 默认初始化 XML，并设置管理员账号
    xml = `<?xml version="1.0" encoding="UTF-8"?>
<navigation>
  <admin username="admin" password="yourpassword123" />
  <!-- 可添加默认分类作为示例 -->
  <category name="常用工具">
    <subcategory name="AI工具">
      <link name="DeepSeek" url="https://deepseek.com" desc="国内顶级AI" icon=""/>
    </subcategory>
  </category>
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


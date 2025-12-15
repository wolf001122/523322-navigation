export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);

  /* ===============================
     一、后台访问控制（仅 Cookie）
     =============================== */

  // 放行登录页，避免死循环
  if (url.pathname.startsWith('/admin/login.html')) {
    return next();
  }

  // 保护所有 /admin/ 页面
  if (url.pathname.startsWith('/admin/')) {
    const cookie = request.headers.get('cookie') || '';
    if (!cookie.includes('admin_logged_in=true')) {
      return Response.redirect(new URL('/admin/login.html', request.url), 302);
    }
  }

  /* ===============================
     二、读取导航数据（XML）
     GET /api/data
     =============================== */
  if (url.pathname === '/api/data' && request.method === 'GET') {
    let xml = await env.NAV_DATA.get('nav_data');

    // KV 为空时，初始化最小可用结构
    if (!xml) {
      xml = `<?xml version="1.0" encoding="UTF-8"?>
<navigation>
  <admin username="admin"
         password="pbkdf2:sha256:600000:example:example" />
</navigation>`;
      await env.NAV_DATA.put('nav_data', xml);
    }

    return new Response(xml, {
      headers: { 'Content-Type': 'text/xml; charset=utf-8' }
    });
  }

  /* ===============================
     三、保存导航数据（XML 原样写入）
     POST /api/save
     =============================== */
  if (url.pathname === '/api/save' && request.method === 'POST') {
    try {
      const body = await request.text();

      // ⚠️ 不解析、不修改、不验证结构
      // links.html 是唯一合法编辑器
      await env.NAV_DATA.put('nav_data', body);

      return new Response('OK', { status: 200 });
    } catch (err) {
      return new Response('保存失败: ' + err.message, { status: 500 });
    }
  }

  /* ===============================
     四、其他请求交给 Pages
     =============================== */
  return next();
}

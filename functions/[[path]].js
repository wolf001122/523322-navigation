export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);

  /* ===============================
     一、后台访问控制（Cookie）
     =============================== */
  if (url.pathname.startsWith('/admin/login.html')) {
    return next();
  }

  if (url.pathname.startsWith('/admin/')) {
    const cookie = request.headers.get('cookie') || '';
    if (!cookie.includes('admin_logged_in=true')) {
      return Response.redirect(
        new URL('/admin/login.html', request.url),
        302
      );
    }
  }

  /* ===============================
     二、读取导航数据（JSON）
     GET /api/data
     =============================== */
  if (url.pathname === '/api/data' && request.method === 'GET') {
    let json = await env.NAV_DATA.get('nav_data');

    // 初始化三层最小结构
    if (!json) {
      json = JSON.stringify({
        categories: []
      });
      await env.NAV_DATA.put('nav_data', json);
    }

    return new Response(json, {
      headers: {
        'Content-Type': 'application/json; charset=utf-8'
      }
    });
  }

  /* ===============================
     三、保存导航数据（JSON）
     POST /api/save
     =============================== */
  if (url.pathname === '/api/save' && request.method === 'POST') {
    try {
      const body = await request.json();

      // 强制结构约束（防止误清空）
      if (!body || !Array.isArray(body.categories)) {
        return new Response('数据结构非法', { status: 400 });
      }

      await env.NAV_DATA.put(
        'nav_data',
        JSON.stringify(body)
      );

      return new Response('OK');
    } catch (err) {
      return new Response(
        '保存失败: ' + err.message,
        { status: 500 }
      );
    }
  }

  /* ===============================
     四、其他请求交给 Pages
     =============================== */
  return next();
}

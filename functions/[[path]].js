export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);

  /* ===============================
     一、后台访问控制
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
     二、GET /api/data → JSON
     =============================== */
  if (url.pathname === '/api/data' && request.method === 'GET') {
    let json = await env.NAV_DATA.get('nav_data');

    if (!json) {
      json = JSON.stringify({ categories: [] });
      await env.NAV_DATA.put('nav_data', json);
    }

    return new Response(json, {
      headers: {
        'Content-Type': 'application/json; charset=utf-8'
      }
    });
  }

  /* ===============================
     三、POST /api/save → JSON
     =============================== */
  if (url.pathname === '/api/save' && request.method === 'POST') {
    const body = await request.json();

    if (!body || !Array.isArray(body.categories)) {
      return new Response('数据结构非法', { status: 400 });
    }

    await env.NAV_DATA.put(
      'nav_data',
      JSON.stringify(body)
    );

    return new Response('OK');
  }

  return next();
}

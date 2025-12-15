export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);

  /* ==================================================
     一、后台访问控制（仅 Cookie）
     ================================================== */

  // 放行登录页
  if (url.pathname.startsWith('/admin/login.html')) {
    return next();
  }

  // 保护所有 /admin/ 页面
  if (url.pathname.startsWith('/admin/')) {
    const cookie = request.headers.get('cookie') || '';
    if (!cookie.includes('admin_logged_in=true')) {
      return Response.redirect(
        new URL('/admin/login.html', request.url),
        302
      );
    }
  }

  /* ==================================================
     二、读取导航数据（XML 原始）
     GET /api/data
     ================================================== */
  if (url.pathname === '/api/data' && request.method === 'GET') {
    let xml = await env.NAV_DATA.get('nav_data');

    // KV 为空时，初始化最小结构
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

  /* ==================================================
     三、保存导航数据（XML 原样写入）
     POST /api/save
     ================================================== */
  if (url.pathname === '/api/save' && request.method === 'POST') {
    try {
      const body = await request.text();

      // ⚠️ 不解析、不修改、不校验
      // links.html 是唯一合法编辑器
      await env.NAV_DATA.put('nav_data', body);

      return new Response('OK', { status: 200 });
    } catch (err) {
      return new Response(
        '保存失败: ' + err.message,
        { status: 500 }
      );
    }
  }

  /* ==================================================
     四、SEO 用：服务端渲染 HTML 片段
     GET /api/render
     ================================================== */
  if (url.pathname === '/api/render' && request.method === 'GET') {
    const xml = await env.NAV_DATA.get('nav_data');
    if (!xml) {
      return new Response('<p>暂无数据</p>', {
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      });
    }

    // 仅做最小、安全解析（字符串级）
    const categories = [];
    const catRegex = /<category name="([^"]+)"[^>]*>([\s\S]*?)<\/category>/g;
    const subRegex = /<subcategory name="([^"]+)"[^>]*>([\s\S]*?)<\/subcategory>/g;
    const linkRegex = /<link\s+([^>]+?)\/>/g;

    let catMatch;
    while ((catMatch = catRegex.exec(xml))) {
      const catName = catMatch[1];
      const catBody = catMatch[2];
      const subs = [];

      let subMatch;
      while ((subMatch = subRegex.exec(catBody))) {
        const subName = subMatch[1];
        const subBody = subMatch[2];
        const links = [];

        let linkMatch;
        while ((linkMatch = linkRegex.exec(subBody))) {
          const attrs = {};
          linkMatch[1].replace(
            /(\w+)="([^"]*)"/g,
            (_, k, v) => (attrs[k] = v)
          );
          links.push(attrs);
        }

        if (links.length) {
          subs.push({ name: subName, links });
        }
      }

      if (subs.length) {
        categories.push({ name: catName, subs });
      }
    }

    // 生成 SEO 友好的 HTML
    let html = '';
    for (const cat of categories) {
      html += `<section class="category">`;
      html += `<h1>${escapeHtml(cat.name)}</h1>`;

      for (const sub of cat.subs) {
        html += `<h2>${escapeHtml(sub.name)}</h2>`;
        html += `<div class="links">`;

        for (const link of sub.links) {
          html += `
<a class="card" href="${escapeAttr(link.url || '#')}" target="_blank" rel="noopener">
  <span class="name">${escapeHtml(link.name || '')}</span>
  <span class="desc">${escapeHtml(link.desc || '')}</span>
</a>`;
        }

        html += `</div>`;
      }

      html += `</section>`;
    }

    return new Response(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
  }

  /* ==================================================
     五、其他请求交给 Pages 静态资源
     ================================================== */
  return next();
}

/* ===============================
   HTML 安全工具
   =============================== */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(str) {
  return escapeHtml(str).replace(/'/g, '&#39;');
}

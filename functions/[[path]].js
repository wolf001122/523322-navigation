export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  // ========= API：读取导航数据 =========
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

  // ========= API：保存导航数据 =========
  if (url.pathname === '/api/save' && request.method === 'POST') {
    try {
      const body = await request.text();
      await env.NAV_DATA.put('nav_data', body);
      return new Response('OK', { status: 200 });
    } catch (err) {
      return new Response('保存失败: ' + err.message, { status: 500 });
    }
  }

  // ========= API：SEO 服务端渲染 =========
  if (url.pathname === '/api/render' && request.method === 'GET') {
    const xml = await env.NAV_DATA.get('nav_data');
    if (!xml) {
      return new Response('<p>暂无数据</p>', {
        headers: { 'Content-Type': 'text/html;charset=utf-8' }
      });
    }

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
          linkMatch[1].replace(/(\w+)="([^"]*)"/g, (_, k, v) => (attrs[k] = v));
          links.push(attrs);
        }
        if (links.length > 0) {
          subs.push({ name: subName, links });
        }
      }
      if (subs.length > 0) {
        categories.push({ name: catName, subs });
      }
    }

    let html = '<div class="seo-render">';
    for (const cat of categories) {
      html += `<section><h1>${escapeHtml(cat.name)}</h1>`;
      for (const sub of cat.subs) {
        html += `<h2>${escapeHtml(sub.name)}</h2><div class="grid">`;
        for (const link of sub.links) {
          const href = link.url || '#';
          const name = link.name || '未命名';
          const desc = link.desc || '';
          html += `<a href="${escapeAttr(href)}" target="_blank" rel="noopener">
            <strong>${escapeHtml(name)}</strong>
            ${desc ? `<span>${escapeHtml(desc)}</span>` : ''}
          </a>`;
        }
        html += `</div>`;
      }
      html += `</section>`;
    }
    html += `</div>`;

    return new Response(html, {
      headers: { 'Content-Type': 'text/html;charset=utf-8' }
    });
  }

  // ========= 其他请求交给静态资源 =========
  return await context.next();
}

// HTML 安全转义工具函数（放在函数内或外均可，这里放外面）
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttr(str) {
  return escapeHtml(str);
}

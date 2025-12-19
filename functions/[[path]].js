export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  /* =====================================================
     后台页面强制登录（保持原有逻辑）
  ===================================================== */
  if (
    url.pathname.startsWith('/admin/') &&
    url.pathname.endsWith('.html') &&
    url.pathname !== '/admin/login.html'
  ) {
    const cookie = request.headers.get('cookie') || '';
    if (!cookie.includes('admin_logged_in=true')) {
      return Response.redirect(
        new URL('/admin/login.html', request.url),
        302
      );
    }
  }

  /* =====================================================
     GET /api/data - 读取 XML
  ===================================================== */
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

  /* =====================================================
     POST /api/save - 保存 XML
  ===================================================== */
  if (url.pathname === '/api/save' && request.method === 'POST') {
    try {
      const body = await request.text();
      await env.NAV_DATA.put('nav_data', body);
      return new Response('OK', { status: 200 });
    } catch (e) {
      return new Response('保存失败: ' + e.message, { status: 500 });
    }
  }

  /* =====================================================
     用户网站提交（待审核）
  ===================================================== */
  if (url.pathname === '/api/submit' && request.method === 'POST') {
    try {
      const site = await request.json();
      const spamWords = ['成人','赌博','贷款','彩票','AV','porn','sex','casino','博彩','黄色','约炮'];
      const text = `${site.name||''}${site.desc||''}${site.url||''}`.toLowerCase();
      if (spamWords.some(w => text.includes(w))) {
        return new Response('包含敏感内容', { status: 400 });
      }

      site.id = Date.now();
      site.time = new Date().toISOString();

      let pending = await env.NAV_DATA.get('pending_sites');
      let list = pending ? JSON.parse(pending) : [];
      list.push(site);

      await env.NAV_DATA.put('pending_sites', JSON.stringify(list));
      return new Response('提交成功', { status: 200 });
    } catch (e) {
      return new Response('提交失败: ' + e.message, { status: 500 });
    }
  }

  /* =====================================================
     GET /api/pending - 获取待审核列表
  ===================================================== */
  if (url.pathname === '/api/pending' && request.method === 'GET') {
    const pending = await env.NAV_DATA.get('pending_sites');
    const list = pending ? JSON.parse(pending) : [];
    return new Response(JSON.stringify(list), {
      headers: { 'Content-Type': 'application/json;charset=utf-8' }
    });
  }

  /* =====================================================
     POST /api/approve - 审核 / 通过并上线
     （完整保留你原有 XML 编辑逻辑）
  ===================================================== */
  if (url.pathname === '/api/approve' && request.method === 'POST') {
    try {
      const { id, action } = await request.json();

      let pending = await env.NAV_DATA.get('pending_sites');
      if (!pending) return new Response('无数据', { status: 404 });

      let list = JSON.parse(pending);
      const index = list.findIndex(s => s.id === id);
      if (index === -1) return new Response('不存在', { status: 404 });

      if (action === 'approve' || action === 'approve_online') {
        const site = list[index];
        let xml = await env.NAV_DATA.get('nav_data');
        if (!xml) return new Response('XML 异常', { status: 500 });

        const linkStr = `  <link name="${site.name}" url="${site.url}"${site.desc ? ` desc="${site.desc}"` : ''} />`;

        const catReg = new RegExp(`<category name="${site.cat1}"[^>]*>([\\s\\S]*?)</category>`);
        const catMatch = xml.match(catReg);

        if (catMatch) {
          const subReg = new RegExp(`<subcategory name="${site.cat2}"[^>]*>([\\s\\S]*?)</subcategory>`);
          if (subReg.test(catMatch[1])) {
            xml = xml.replace(subReg, m => m.replace('</subcategory>', `${linkStr}\n    </subcategory>`));
          } else {
            xml = xml.replace(catReg,
              `<category name="${site.cat1}">${catMatch[1]}
    <subcategory name="${site.cat2}">
${linkStr}
    </subcategory>
  </category>`
            );
          }
        } else {
          xml = xml.replace('</navigation>', `
  <category name="${site.cat1}">
    <subcategory name="${site.cat2}">
${linkStr}
    </subcategory>
  </category>
</navigation>`);
        }

        if (action === 'approve_online') {
          await env.NAV_DATA.put('nav_data', xml);
        }
      }

      list.splice(index, 1);
      await env.NAV_DATA.put('pending_sites', JSON.stringify(list));
      return new Response('OK', { status: 200 });

    } catch (e) {
      return new Response('失败: ' + e.message, { status: 500 });
    }
  }

  /* =====================================================
     POST /api/edit - 修改待审核项
  ===================================================== */
  if (url.pathname === '/api/edit' && request.method === 'POST') {
    try {
      const { id, cat1, cat2, name, url, desc } = await request.json();
      let pending = await env.NAV_DATA.get('pending_sites');
      let list = pending ? JSON.parse(pending) : [];

      const idx = list.findIndex(s => s.id === id);
      if (idx === -1) return new Response('不存在', { status: 404 });

      Object.assign(list[idx], { cat1, cat2, name, url, desc });
      await env.NAV_DATA.put('pending_sites', JSON.stringify(list));

      return new Response('OK');
    } catch (e) {
      return new Response('修改失败', { status: 500 });
    }
  }

  /* =====================================================
     用户反馈：保存
  ===================================================== */
  if (url.pathname === '/api/kv/NAV_DATA/user_feedback' && request.method === 'POST') {
    try {
      const fb = await request.json();
      if (!fb.message) return new Response('空内容', { status: 400 });

      let list = await env.NAV_DATA.get('user_feedback');
      list = list ? JSON.parse(list) : [];
      list.push(fb);

      await env.NAV_DATA.put('user_feedback', JSON.stringify(list));
      return new Response('OK');
    } catch (e) {
      return new Response('保存失败', { status: 500 });
    }
  }

  /* =====================================================
     管理员：获取反馈列表
  ===================================================== */
  if (url.pathname === '/api/feedback/list' && request.method === 'GET') {
    const list = await env.NAV_DATA.get('user_feedback');
    return new Response(list || '[]', {
      headers:{'Content-Type':'application/json;charset=utf-8'}
    });
  }

  /* =====================================================
     管理员：删除反馈
  ===================================================== */
  if (url.pathname === '/api/feedback/delete' && request.method === 'POST') {
    const { index } = await request.json();
    let list = await env.NAV_DATA.get('user_feedback');
    list = list ? JSON.parse(list) : [];
    list.splice(index, 1);
    await env.NAV_DATA.put('user_feedback', JSON.stringify(list));
    return new Response('OK');
  }

  /* =====================================================
     管理员：回复反馈（预留接口）
     ⚠️ 实际发 Gmail 邮件在下一步接入
  ===================================================== */
  if (url.pathname === '/api/feedback/reply' && request.method === 'POST') {
    // 下一步：GAS / Webhook 真正发信
    return new Response('OK');
  }

  return await context.next();
}

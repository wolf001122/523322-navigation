export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  // ================= 后台页面强制登录（稳定版） =================
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

  // ================= GET /api/data - 读取 XML 数据 =================
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

  // ================= POST /api/save - 保存 XML 数据 =================
  if (url.pathname === '/api/save' && request.method === 'POST') {
    try {
      const body = await request.text();
      await env.NAV_DATA.put('nav_data', body);
      return new Response('OK', { status: 200 });
    } catch (e) {
      return new Response('保存失败: ' + e.message, { status: 500 });
    }
  }

  // ================= 用户网站提交（待审核） =================
  if (url.pathname === '/api/submit' && request.method === 'POST') {
    try {
      const site = await request.json();

      // 简单垃圾词过滤
      const spamWords = ['成人', '赌博', '贷款', '彩票', 'AV', 'porn', 'sex', 'casino', '博彩', '黄色', '约炮'];
      const text = `${site.name || ''}${site.desc || ''}${site.url || ''}`.toLowerCase();
      if (spamWords.some(word => text.includes(word))) {
        return new Response('包含敏感内容，提交失败', { status: 400 });
      }

      site.id = Date.now();
      site.time = new Date().toISOString();

      let pending = await env.NAV_DATA.get('pending_sites');
      let list = pending ? JSON.parse(pending) : [];

      list.push(site);
      await env.NAV_DATA.put('pending_sites', JSON.stringify(list));

      return new Response('提交成功，等待管理员审核', { status: 200 });
    } catch (e) {
      return new Response('提交失败: ' + e.message, { status: 500 });
    }
  }

  // ================= 管理员获取待审核列表 =================
  if (url.pathname === '/api/pending' && request.method === 'GET') {
    const pending = await env.NAV_DATA.get('pending_sites');
    const list = pending ? JSON.parse(pending) : [];
    return new Response(JSON.stringify(list), {
      headers: { 'Content-Type': 'application/json;charset=utf-8' }
    });
  }

  // ================= 管理员审核操作（通过/删除） =================
  if (url.pathname === '/api/approve' && request.method === 'POST') {
    try {
      const { id, action } = await request.json();

      let pending = await env.NAV_DATA.get('pending_sites');
      if (!pending) return new Response('无待审核数据', { status: 404 });

      let list = JSON.parse(pending);
      const index = list.findIndex(s => s.id === id);
      if (index === -1) return new Response('提交记录不存在', { status: 404 });

      if (action === 'approve') {
        const site = list[index];

        let xml = await env.NAV_DATA.get('nav_data');
        if (!xml) return new Response('正式数据异常', { status: 500 });

        const catName = site.cat1;
        const subName = site.cat2;
        const linkStr = `  <link name="${site.name}" url="${site.url}"${site.desc ? ` desc="${site.desc}"` : ''} />`;

        const catRegex = new RegExp(`<category name="${catName}"[^>]*>(.*?)</category>`, 's');
        const catMatch = xml.match(catRegex);
        if (catMatch) {
          const catContent = catMatch[1];
          const subRegex = new RegExp(`<subcategory name="${subName}"[^>]*>(.*?)</subcategory>`, 's');
          const subMatch = catContent.match(subRegex);
          if (subMatch) {
            const newCatContent = catContent.replace(subRegex, `<subcategory name="${subName}"${subMatch[0].includes('/>') ? '>' : ''}${subMatch[1]}${linkStr}</subcategory>`);
            xml = xml.replace(catRegex, `<category name="${catName}"${catMatch[0].includes('/>') ? '>' : ''}${newCatContent}</category>`);
          } else {
            const newSub = `<subcategory name="${subName}">${linkStr}\n    </subcategory>`;
            const newCatContent = catContent.trim() ? catContent.trim() + '\n    ' + newSub : newSub;
            xml = xml.replace(catRegex, `<category name="${catName}"${catMatch[0].includes('/>') ? '>' : ''}${newCatContent}\n  </category>`);
          }
        } else {
          const newCat = `<category name="${catName}">
    <subcategory name="${subName}">${linkStr}
    </subcategory>
  </category>`;
          xml = xml.replace('</navigation>', `  ${newCat}\n</navigation>`);
        }

        await env.NAV_DATA.put('nav_data', xml);
      }

      list.splice(index, 1);
      await env.NAV_DATA.put('pending_sites', JSON.stringify(list));

      return new Response('操作成功', { status: 200 });
    } catch (e) {
      return new Response('操作失败: ' + e.message, { status: 500 });
    }
  }

  // ================= 管理员修改待审核项（支持修改分类） =================
  if (url.pathname === '/api/edit' && request.method === 'POST') {
    try {
      const { id, cat1, cat2, name, url, desc } = await request.json();

      let pending = await env.NAV_DATA.get('pending_sites');
      if (!pending) return new Response('无待审核数据', { status: 404 });

      let list = JSON.parse(pending);
      const index = list.findIndex(s => s.id === id);
      if (index === -1) return new Response('提交记录不存在', { status: 404 });

      list[index].cat1 = cat1;
      list[index].cat2 = cat2;
      list[index].name = name.trim();
      list[index].url = url.trim();
      list[index].desc = desc.trim();

      await env.NAV_DATA.put('pending_sites', JSON.stringify(list));

      return new Response('修改成功', { status: 200 });
    } catch (e) {
      return new Response('修改失败: ' + e.message, { status: 500 });
    }
  }

  // ================= 用户反馈保存到 KV =================
  if (url.pathname === '/api/kv/NAV_DATA/user_feedback' && request.method === 'POST') {
    try {
      const feedback = await request.json(); // { message, contact, time }
      if (!feedback.message) return new Response('内容为空', { status: 400 });

      let list = await env.NAV_DATA.get('user_feedback');
      list = list ? JSON.parse(list) : [];

      list.push(feedback);

      await env.NAV_DATA.put('user_feedback', JSON.stringify(list));

      return new Response('OK', { status: 200 });
    } catch (e) {
      return new Response('保存失败: ' + e.message, { status: 500 });
    }
  }

  // ================= 友情链接读取
  if (url.pathname === '/api/friendly' && request.method === 'GET') {
    try {
      let list = await env.NAV_DATA.get('friendly_links');
      list = list ? JSON.parse(list) : [];
      return new Response(JSON.stringify(list), {
        headers: { 'Content-Type': 'application/json;charset=utf-8' }
      });
    } catch (e) {
      return new Response('[]', { headers: { 'Content-Type': 'application/json;charset=utf-8' } });
    }
  }

  // ================= 友情链接保存
  if (url.pathname === '/api/friendly' && request.method === 'POST') {
    try {
      const links = await request.json();
      await env.NAV_DATA.put('friendly_links', JSON.stringify(links));
      return new Response('OK', { status: 200 });
    } catch (e) {
      return new Response('保存失败: ' + e.message, { status: 500 });
    }
  }

  // ================= 其他请求放行 =================
  return await context.next();
}

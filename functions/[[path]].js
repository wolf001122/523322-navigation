export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  // GET /api/data - 读取 XML 数据（原有功能）
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

  // POST /api/save - 保存 XML 数据（原有功能）
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
    // 可选：简单长度或时间戳校验防绕过
  if (!site.time || Date.now() - new Date(site.time).getTime() > 600000) { // 10分钟内有效
    return new Response('提交超时', { status: 400 });
  }
  if (url.pathname === '/api/submit' && request.method === 'POST') {
    try {
      const site = await request.json();

      // 简单垃圾词过滤（可自行扩展）
      const spamWords = ['成人', '赌博', '贷款', '彩票', 'AV', 'porn', 'sex', 'casino', '博彩', '黄色', '约炮'];
      const text = `${site.name || ''}${site.desc || ''}${site.url || ''}`.toLowerCase();
      if (spamWords.some(word => text.includes(word))) {
        return new Response('包含敏感内容，提交失败', { status: 400 });
      }

      // 生成唯一ID和时间
      site.id = Date.now();
      site.time = new Date().toISOString();

      // 读取现有待审核列表
      let pending = await env.NAV_DATA.get('pending_sites');
      let list = pending ? JSON.parse(pending) : [];

      list.push(site);

      // 保存
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
      const { id, action } = await request.json(); // action: 'approve' 或 'delete'

      let pending = await env.NAV_DATA.get('pending_sites');
      if (!pending) return new Response('无待审核数据', { status: 404 });

      let list = JSON.parse(pending);
      const index = list.findIndex(s => s.id === id);
      if (index === -1) return new Response('提交记录不存在', { status: 404 });

      if (action === 'approve') {
        const site = list[index];

        // 读取正式 XML
        let xml = await env.NAV_DATA.get('nav_data');
        if (!xml) return new Response('正式数据异常', { status: 500 });

        const parser = new DOMParser();
        const doc = parser.parseFromString(xml, 'text/xml');

        // 查找或创建一级分类
        let cat = [...doc.querySelectorAll('category')].find(c => c.getAttribute('name') === site.cat1);
        if (!cat) {
          cat = doc.createElement('category');
          cat.setAttribute('name', site.cat1);
          doc.querySelector('navigation').appendChild(cat);
        }

        // 查找或创建二级分类
        let sub = [...cat.querySelectorAll('subcategory')].find(s => s.getAttribute('name') === site.cat2);
        if (!sub) {
          sub = doc.createElement('subcategory');
          sub.setAttribute('name', site.cat2);
          cat.appendChild(sub);
        }

        // 添加链接
        const link = doc.createElement('link');
        link.setAttribute('name', site.name);
        link.setAttribute('url', site.url);
        if (site.desc) link.setAttribute('desc', site.desc);
        sub.appendChild(link);

        // 保存更新后的正式 XML
        const serializer = new XMLSerializer();
        xml = serializer.serializeToString(doc);
        await env.NAV_DATA.put('nav_data', xml);
      }

      // 从待审核列表移除
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

      // 更新所有字段
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

  // 其他请求直接放行给静态资源（原有功能）
  return await context.next();
}

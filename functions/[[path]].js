if (url.pathname === '/api/save-links') {
  if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

  const links = await request.json(); // 接收 allLinks 数组

  // 读取当前 KV 数据
  let currentData = await NAV_DATA.get('nav_data');
  if (!currentData) {
    return new Response('No data found', { status: 404 });
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(currentData, 'text/xml');

  // 清空所有链接
  doc.querySelectorAll('link').forEach(link => link.remove());

  // 根据 links 数组重建链接（使用 catIdx/subIdx 定位）
  links.forEach(link => {
    const catElements = doc.querySelectorAll('category');
    const cat = catElements[link.catIdx];
    if (cat) {
      const subElements = cat.querySelectorAll('subcategory');
      const sub = subElements[link.subIdx];
      if (sub) {
        const newLink = doc.createElement('link');
        newLink.setAttribute('name', link.name);
        newLink.setAttribute('url', link.url);
        if (link.desc) newLink.setAttribute('desc', link.desc);
        if (link.icon) newLink.setAttribute('icon', link.icon);
        sub.appendChild(newLink);
      }
    }
  });

  const serializer = new XMLSerializer();
  const newXml = serializer.serializeToString(doc);

  // 保存回 KV
  await NAV_DATA.put('nav_data', newXml);

  return new Response('Saved successfully', { status: 200 });
}

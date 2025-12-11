// Cloudflare Pages Functions：处理 API 请求，集成 Workers KV
// KV Namespace: 在 Dashboard 创建并绑定为 'NAV_DATA'
// 免费层：处理读/写请求，无额外费用

export async function onRequest(context) {
  const { request, next, env } = context; // 获取上下文（env 包含 KV）
  const url = new URL(request.url); // 解析请求 URL

  // 处理 /api/data：从 KV 读取数据
  if (url.pathname === '/api/data') {
    try {
      let xmlText = await env.NAV_DATA.get('nav_data'); // 从 KV 获取键 'nav_data'
      if (!xmlText) {
        // 首次初始化：硬编码初始 XML 数据（包括 admin）
        xmlText = `<?xml version="1.0" encoding="UTF-8"?>
<navigation>
  <!-- 初始管理员账号：用户名 admin，密码示例（用 PBKDF2 生成工具替换） -->
  <admin username="admin" password="pbkdf2:sha256:600000:exampleSaltHex:exampleHashHex" />
  <!-- 初始分类示例 -->
  <category name="常用工具">
    <link name="语雀" url="https://www.yuque.com" desc="专业的云端知识库"/>
    <link name="GitHub" url="https://github.com" desc="全球最大开源社区"/>
  </category>
  <category name="生物信息">
    <link name="NCBI" url="https://www.ncbi.nlm.nih.gov" desc="美国国家生物技术信息中心"/>
  </category>
</navigation>`;
        await env.NAV_DATA.put('nav_data', xmlText); // 写入 KV
      }
      // 返回 XML 响应
      return new Response(xmlText, {
        headers: { 'Content-Type': 'text/xml;charset=utf-8' }
      });
    } catch (e) {
      // 错误处理
      return new Response('KV 加载错误: ' + e.message, { status: 500 });
    }
  } else if (url.pathname === '/api/save' && request.method === 'POST') {
    // 处理 /api/save：写入 KV（仅 POST）
    try {
      const xmlText = await request.text(); // 获取 POST 体
      await env.NAV_DATA.put('nav_data', xmlText); // 更新 KV
      return new Response('保存成功', { status: 200 });
    } catch (e) {
      return new Response('KV 保存错误: ' + e.message, { status: 500 });
    }
  }

  // 其他路径：回退到静态文件服务
  return next();
}
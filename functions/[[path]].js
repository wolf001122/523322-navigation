export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  // GET /api/data
  if (url.pathname === '/api/data') {
    // 同前读 KV 代码...
  }

  // POST /api/save
  if (url.pathname === '/api/save') {
    // 同前写 KV 代码...
  }

  // POST /api/upload - 新增上传图片
  if (url.pathname === '/api/upload' && request.method === 'POST') {
    try {
      const formData = await request.formData();
      const file = formData.get('file');
      if (!file) return new Response('无文件', { status: 400 });

      const key = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`; // 安全文件名
      await env.ICON_BUCKET.put(key, file.stream(), {
        httpMetadata: { contentType: file.type }
      });

      // 返回公共 URL（替换为您的 R2 公共域名）
      const publicUrl = `https://<您的R2公共域名>.r2.dev/${key}`; // e.g., https://pub-abc123.r2.dev/icon.png
      return new Response(publicUrl, { status: 200 });
    } catch (e) {
      return new Response('上传失败: ' + e.message, { status: 500 });
    }
  }

  return next();
}

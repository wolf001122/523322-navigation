export async function onRequest(context) {
  // 直接放行所有请求给静态文件
  // 因为现在数据从 /data/nav_data.xml 静态文件加载，不再需要 /api/data
  return await context.next();
}

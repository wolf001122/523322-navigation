/**
 * 网址导航管理器类：处理增删改查和 KV 存储操作
 * 与 Cloudflare Pages Functions 集成，零维护后台
 * Access 保护路径，无需前端验证
 */

class NavigationManager {
  constructor() {
    this.categories = [];     // 内存中的分类数据数组
    this.xmlDoc = null;       // 解析后的 XML DOM 对象
    this.modal = document.getElementById('modal'); // 模态框元素
    this.form = document.getElementById('editForm'); // 编辑表单
    this.formFields = document.getElementById('formFields'); // 表单字段容器
    this.navContainer = document.getElementById('navContainer'); // 导航容器
  }

  // 初始化函数：绑定事件并加载数据
  init() {
    this.initEventListeners();
    this.loadData();
  }

  /** 初始化事件监听：模态框关闭等 */
  initEventListeners() {
    // 关闭模态框按钮
    document.querySelector('.close').onclick = () => this.modal.style.display = 'none';
    // 点击模态框外部关闭
    window.onclick = (e) => { if (e.target === this.modal) this.modal.style.display = 'none'; };
  }

  /** 加载数据：从 KV 通过 /api/data 获取 XML */
  loadData() {
    fetch('/api/data?t=' + Date.now()) // 添加时间戳防缓存
      .then(res => res.text())
      .then(str => {
        const parser = new DOMParser();
        this.xmlDoc = parser.parseFromString(str, 'text/xml');
        // 检查解析错误
        if (this.xmlDoc.querySelector('parsererror')) {
          alert('数据格式错误，请检查 KV');
          return;
        }
        this.parseXMLToCategories(); // 解析到数组
        this.render(); // 渲染页面
      })
      .catch(err => {
        alert('加载数据失败，请检查网络或 KV 配置');
        console.error(err);
      });
  }

  /** 解析 XML 到 categories 数组（忽略 admin 节点） */
  parseXMLToCategories() {
    this.categories = Array.from(this.xmlDoc.querySelectorAll('category')).map(cat => ({
      name: cat.getAttribute('name'),
      links: Array.from(cat.querySelectorAll('link')).map(link => ({
        name: link.getAttribute('name'),
        url: link.getAttribute('url'),
        desc: link.getAttribute('desc') || ''
      }))
    }));
  }

  /** 渲染后台导航：包括编辑/删除按钮 */
  render() {
    this.navContainer.innerHTML = '';
    this.categories.forEach((cat, catIdx) => {
      const catDiv = document.createElement('div');
      catDiv.className = 'category';

      catDiv.innerHTML = `
        <h2>
          ${this.escapeHtml(cat.name)}
          <span class="btns">
            <button class="edit" onclick="navMgr.editCategory(${catIdx})">编辑</button>
            <button class="delete" onclick="navMgr.deleteCategory(${catIdx})">删除</button>
          </span>
        </h2>
        <ul class="link-list" id="cat-${catIdx}"></ul>
      `;

      const ul = catDiv.querySelector('.link-list');
      cat.links.forEach((link, linkIdx) => {
        const li = document.createElement('li');
        li.innerHTML = `
          <a href="${this.escapeHtml(link.url)}" target="_blank">${this.escapeHtml(link.name)}</a>
          <span class="desc">${this.escapeHtml(link.desc)}</span>
          <div class="actions">
            <button class="edit" onclick="navMgr.editLink(${catIdx},${linkIdx})">编辑</button>
            <button class="delete" onclick="navMgr.deleteLink(${catIdx},${linkIdx})">删除</button>
          </div>
        `;
        ul.appendChild(li);
      });

      this.navContainer.appendChild(catDiv);
    });
  }

  /** 显示模态框：用于编辑/新增分类或链接 */
  showModal(type, catIdx = -1, linkIdx = -1) {
    this.form.reset(); // 重置表单
    this.formFields.innerHTML = ''; // 清空字段
    document.getElementById('submitBtn').textContent = '保存';

    if (type === 'category') {
      // 分类表单
      this.formFields.innerHTML = `<input type="text" id="catName" placeholder="分类名称" required>`;
      if (linkIdx >= 0) document.getElementById('catName').value = this.categories[catIdx].name;
    } else { // link
      // 链接表单：包括分类选择
      const selectHtml = this.categories.map((c, i) => 
        `<option value="${i}" ${i===catIdx ? 'selected' : ''}>${this.escapeHtml(c.name)}</option>`
      ).join('');
      this.formFields.innerHTML = `
        <select id="catSelect" required>${selectHtml}</select>
        <input type="text" id="linkName" placeholder="链接名称" required>
        <input type="url" id="linkUrl" placeholder="https://example.com" required>
        <textarea id="linkDesc" placeholder="描述（可选）" rows="2"></textarea>
      `;
      if (linkIdx >= 0) {
        const link = this.categories[catIdx].links[linkIdx];
        document.getElementById('linkName').value = link.name;
        document.getElementById('linkUrl').value = link.url;
        document.getElementById('linkDesc').value = link.desc;
      }
    }

    // 绑定表单提交事件
    this.form.onsubmit = (e) => {
      e.preventDefault(); // 防止默认提交
      if (type === 'category') {
        const name = document.getElementById('catName').value.trim();
        if (!name) return alert('分类名称不能为空');
        if (linkIdx >= 0) {
          this.categories[catIdx].name = name; // 修改现有
        } else {
          this.categories.push({ name, links: [] }); // 新增
        }
      } else {
        const catI = parseInt(document.getElementById('catSelect').value);
        const name = document.getElementById('linkName').value.trim();
        const url = document.getElementById('linkUrl').value.trim();
        const desc = document.getElementById('linkDesc').value.trim();
        if (!name || !url) return alert('链接名称和 URL 不能为空');
        const newLink = { name, url, desc };
        if (linkIdx >= 0) {
          this.categories[catIdx].links[linkIdx] = newLink; // 修改
        } else {
          this.categories[catI].links.push(newLink); // 新增
        }
      }
      this.render(); // 重新渲染页面
      this.modal.style.display = 'none'; // 关闭模态框
    };

    this.modal.style.display = 'flex'; // 显示模态框
  }

  /** 编辑分类：调用 showModal */
  editCategory(idx) { this.showModal('category', idx, idx); }

  /** 删除分类：确认后移除 */
  deleteCategory(idx) {
    if (confirm(`确定删除分类「${this.categories[idx].name}」及其下所有链接？`)) {
      this.categories.splice(idx, 1);
      this.render();
    }
  }

  /** 编辑链接：调用 showModal */
  editLink(catIdx, linkIdx) { this.showModal('link', catIdx, linkIdx); }

  /** 删除链接：确认后移除 */
  deleteLink(catIdx, linkIdx) {
    if (confirm('确定删除此链接？')) {
      this.categories[catIdx].links.splice(linkIdx, 1);
      this.render();
    }
  }

  /** 保存到 KV：生成 XML 并 POST 到 /api/save */
  async saveToKV() {
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<navigation>\n';
    // 保留 admin 节点（从原始数据复制，不允许后台修改）
    const admin = this.xmlDoc.querySelector('admin');
    if (admin) {
      xml += `  <admin username="${this.escapeXml(admin.getAttribute('username'))}" password="${this.escapeXml(admin.getAttribute('password'))}" />\n`;
    }
    // 添加分类和链接
    this.categories.forEach(cat => {
      xml += `  <category name="${this.escapeXml(cat.name)}">\n`;
      cat.links.forEach(link => {
        const desc = link.desc ? ` desc="${this.escapeXml(link.desc)}"` : '';
        xml += `    <link name="${this.escapeXml(link.name)}" url="${this.escapeXml(link.url)}"${desc}/>\n`;
      });
      xml += '  </category>\n';
    });
    xml += '</navigation>';

    // 发送 POST 请求到 /api/save
    const saveRes = await fetch('/api/save', {
      method: 'POST',
      headers: { 'Content-Type': 'text/xml' },
      body: xml
    });
    if (saveRes.ok) {
      alert('数据已保存到 Cloudflare KV（全球同步）！');
      this.loadData(); // 刷新数据
    } else {
      alert('保存失败，请检查网络或权限');
    }
  }

  /** HTML 转义：防止 XSS 注入 */
  escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>"']/g, m => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[m]);
  }

  /** XML 属性转义：用于生成 XML 时安全 */
  escapeXml(str) {
    if (!str) return '';
    return str.replace(/[<>&"']/g, m => ({
      '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;'
    })[m]);
  }
}

// 创建全局实例
const navMgr = new NavigationManager();
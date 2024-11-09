class ReaderMode {
  constructor() {
    this.isEnabled = false;
    this.originalStyles = null;
    this.settings = {
      fontSize: 18,
      fontFamily: 'system-ui',
      customFont: '',
      lineHeight: 1.6,
      width: 800,
      theme: 'light',
      fontWeight: 'normal'
    };
    this.isTocVisible = false;
    this.isSettingsVisible = false;
    
    // 初始化时加载存储的设置
    this.loadSettings();
    this.originalContent = null; // 保存原始页面内容
  }

  // 加载存储的设置
  async loadSettings() {
    try {
      const result = await chrome.storage.sync.get('readerSettings');
      if (result.readerSettings) {
        this.settings = { ...this.settings, ...result.readerSettings };
        // 如果已经启用了阅读模式，立即应用设置
        if (this.isEnabled) {
          this.applySettings();
        }
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  }

  // 保存设置到存储
  async saveSettings() {
    try {
      await chrome.storage.sync.set({
        readerSettings: this.settings
      });
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  }

  createControls() {
    // 创目录切换按钮
    const tocButton = document.createElement('button');
    tocButton.id = 'toc-toggle';
    tocButton.innerHTML = '≡';
    tocButton.title = '目录';
    tocButton.onclick = () => this.toggleToc();

    // 创设置按钮
    const settingsButton = document.createElement('button');
    settingsButton.id = 'settings-toggle';
    settingsButton.innerHTML = '⚙️';
    settingsButton.title = '设置';
    settingsButton.onclick = () => this.toggleSettings();

    return [tocButton, settingsButton];
  }

  createSettingsPanel() {
    const overlay = document.createElement('div');
    overlay.id = 'settings-overlay';
    
    const panel = document.createElement('div');
    panel.id = 'settings-panel';
    panel.innerHTML = `
      <h3>阅读设置</h3>
      <div class="settings-item">
        <label>主题模式</label>
        <select id="theme-select">
          <option value="light" ${this.settings.theme === 'light' ? 'selected' : ''}>浅色模式</option>
          <option value="dark" ${this.settings.theme === 'dark' ? 'selected' : ''}>深色模式</option>
          <option value="auto" ${this.settings.theme === 'auto' ? 'selected' : ''}>跟随系统</option>
        </select>
      </div>
      <div class="settings-item">
        <label>文章宽度</label>
        <input type="range" min="600" max="1200" step="50" value="${this.settings.width}" id="width-slider">
        <span id="width-value">${this.settings.width}px</span>
      </div>
      <div class="settings-item">
        <label>字体大小</label>
        <input type="range" min="14" max="32" value="${this.settings.fontSize}" id="font-size-slider">
        <span id="font-size-value">${this.settings.fontSize}px</span>
      </div>
      <div class="settings-item">
        <label>字体粗细</label>
        <select id="font-weight-select">
          <option value="normal" ${this.settings.fontWeight === 'normal' ? 'selected' : ''}>正常</option>
          <option value="500" ${this.settings.fontWeight === '500' ? 'selected' : ''}>中等</option>
          <option value="bold" ${this.settings.fontWeight === 'bold' ? 'selected' : ''}>粗体</option>
        </select>
      </div>
      <div class="settings-item">
        <label>字体</label>
        <select id="font-family-select">
          <optgroup label="系统字体">
            <option value="system-ui">系统默认</option>
          </optgroup>
          <optgroup label="中文字体">
            <option value="Noto Sans SC">思源黑体</option>
            <option value="Noto Serif SC">思源宋体</option>
            <option value="PingFang SC">苹方</option>
            <option value="Microsoft YaHei">微软雅黑</option>
            <option value="SimSun">宋体</option>
            <option value="SimHei">黑体</option>
            <option value="KaiTi">楷体</option>
          </optgroup>
          <optgroup label="英文字体">
            <option value="Georgia">Georgia</option>
            <option value="Times New Roman">Times New Roman</option>
            <option value="Arial">Arial</option>
            <option value="Helvetica">Helvetica</option>
            <option value="Verdana">Verdana</option>
          </optgroup>
          <optgroup label="等宽字体">
            <option value="monospace">等宽字体</option>
            <option value="Consolas">Consolas</option>
            <option value="Monaco">Monaco</option>
          </optgroup>
          <option value="custom">自定义字体</option>
        </select>
        <div id="custom-font-input" style="display: none; margin-top: 8px;">
          <input type="text" 
                 id="custom-font-name" 
                 placeholder="输入字体名称，多个字体用逗号分隔"
                 value="${this.settings.customFont}">
        </div>
      </div>
      <div class="settings-item">
        <label>行高</label>
        <input type="range" min="1.2" max="2" step="0.1" value="${this.settings.lineHeight}" id="line-height-slider">
        <span id="line-height-value">${this.settings.lineHeight}</span>
      </div>
    `;

    this.addSettingsListeners(panel);
    overlay.onclick = () => this.toggleSettings();
    
    return [overlay, panel];
  }

  toggleToc() {
    const sidebar = document.getElementById('reader-sidebar');
    this.isTocVisible = !this.isTocVisible;
    sidebar.classList.toggle('show', this.isTocVisible);
  }

  toggleSettings() {
    const overlay = document.getElementById('settings-overlay');
    const panel = document.getElementById('settings-panel');
    this.isSettingsVisible = !this.isSettingsVisible;
    overlay.classList.toggle('show', this.isSettingsVisible);
    panel.classList.toggle('show', this.isSettingsVisible);
  }

  createSidebar() {
    const sidebar = document.createElement('div');
    sidebar.id = 'reader-sidebar';
    sidebar.classList.add('show');
    
    // 添加目录
    const tocContainer = document.createElement('div');
    tocContainer.className = 'toc-container';
    tocContainer.innerHTML = '<h3>目录</h3>';
    const tocList = document.createElement('ul');
    tocList.className = 'toc-list';
    
    // 获取所有标题并生成目录
    const headings = document.querySelectorAll('#reader-mode-container h1, #reader-mode-container h2, #reader-mode-container h3, #reader-mode-container h4');
    if (headings.length > 0) {
      headings.forEach((heading, index) => {
        const level = parseInt(heading.tagName.charAt(1));
        const li = document.createElement('li');
        li.className = `toc-item level-${level}`;
        li.textContent = heading.textContent;
        heading.id = `heading-${index}`;
        li.onclick = () => {
          heading.scrollIntoView({ behavior: 'smooth' });
          if (window.innerWidth <= 768) {
            this.toggleToc();
          }
        };
        tocList.appendChild(li);
      });
    } else {
      tocList.innerHTML = '<li class="no-headings">未检测到标题</li>';
    }
    
    tocContainer.appendChild(tocList);
    sidebar.appendChild(tocContainer);
    
    return sidebar;
  }

  addSettingsListeners(panel) {
    const container = document.getElementById('reader-mode-container');
    
    // 添加主题切换监听器
    panel.querySelector('#theme-select').addEventListener('change', (e) => {
      const value = e.target.value;
      this.settings.theme = value;
      this.applyTheme(value);
      this.saveSettings();
    });
    
    // 添加宽度设置监听器
    panel.querySelector('#width-slider').addEventListener('input', (e) => {
      const value = e.target.value;
      this.settings.width = value;
      container.style.setProperty('--reader-width', `${value}px`);
      panel.querySelector('#width-value').textContent = `${value}px`;
      this.saveSettings();
    });
    
    panel.querySelector('#font-size-slider').addEventListener('input', (e) => {
      const value = e.target.value;
      this.settings.fontSize = value;
      container.style.fontSize = `${value}px`;
      container.querySelectorAll('p, li').forEach(element => {
        element.style.fontSize = `${value}px`;
      });
      panel.querySelector('#font-size-value').textContent = `${value}px`;
      this.saveSettings();
    });
    
    const fontSelect = panel.querySelector('#font-family-select');
    const customFontInput = panel.querySelector('#custom-font-input');
    const customFontName = panel.querySelector('#custom-font-name');

    fontSelect.addEventListener('change', (e) => {
      const value = e.target.value;
      if (value === 'custom') {
        customFontInput.style.display = 'block';
        if (this.settings.customFont) {
          this.applyFont(this.settings.customFont);
        }
      } else {
        customFontInput.style.display = 'none';
        this.settings.fontFamily = value;
        this.applyFont(value);
      }
      this.saveSettings();
    });

    // 添加自定义字体输入监听
    customFontName.addEventListener('input', (e) => {
      const value = e.target.value;
      this.settings.customFont = value;
      this.applyFont(value);
      this.saveSettings();
    });

    // 设置初始状态
    if (this.settings.fontFamily === 'custom' && this.settings.customFont) {
      fontSelect.value = 'custom';
      customFontInput.style.display = 'block';
      customFontName.value = this.settings.customFont;
    }
    
    panel.querySelector('#line-height-slider').addEventListener('input', (e) => {
      const value = e.target.value;
      this.settings.lineHeight = value;
      container.style.setProperty('--reader-line-height', value);
      panel.querySelector('#line-height-value').textContent = value;
      this.saveSettings();
    });

    // 添加字体粗细监听器
    panel.querySelector('#font-weight-select').addEventListener('change', (e) => {
      const value = e.target.value;
      this.settings.fontWeight = value;
      container.style.fontWeight = value;
      container.querySelectorAll('p, li').forEach(element => {
        element.style.fontWeight = value;
      });
      this.saveSettings();
    });
  }

  applyTheme(theme) {
    const container = document.getElementById('reader-mode-container');
    const sidebar = document.getElementById('reader-sidebar');
    const settingsPanel = document.getElementById('settings-panel');
    
    // 移除现有的主题类
    document.body.classList.remove('theme-light', 'theme-dark');
    
    if (theme === 'auto') {
      // 跟随系统主题
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        document.body.classList.add('theme-dark');
      } else {
        document.body.classList.add('theme-light');
      }
    } else {
      // 手动置主题
      document.body.classList.add(`theme-${theme}`);
    }
  }

  enable() {
    if (!this.originalContent) {
      // 保存原始页面内容
      this.originalContent = document.body.innerHTML;
    }
    
    // 保存原始状态
    this.originalStyles = document.documentElement.getAttribute('style');
    
    // 移除干扰元素
    const elementsToRemove = [
      'header', 'footer', 'nav', 'aside',
      '.advertisement', '.social-share',
      '.related-posts', '.comments'
    ];
    
    elementsToRemove.forEach(selector => {
      document.querySelectorAll(selector).forEach(element => {
        element.style.display = 'none';
      });
    });

    // 提取主要内容
    const mainContent = this.findMainContent();
    if (mainContent) {
      // 创建阅读容器
      const readerContainer = document.createElement('div');
      readerContainer.id = 'reader-mode-container';
      readerContainer.innerHTML = mainContent.innerHTML;
      
      // 清空页面并插入阅读容器
      document.body.innerHTML = '';
      document.body.appendChild(readerContainer);
      
      // 创建侧边栏
      const sidebar = this.createSidebar();
      
      // 创建设置面板
      const [overlay, settingsPanel] = this.createSettingsPanel();
      
      // 创建控制按钮组容器
      const controlButtons = document.createElement('div');
      controlButtons.className = 'control-buttons';
      
      // 创建设置按钮
      const settingsButton = document.createElement('button');
      settingsButton.className = 'control-button';
      settingsButton.innerHTML = '⚙️';
      settingsButton.title = '设置';
      settingsButton.onclick = () => this.toggleSettings();
      
      // 创建 PDF 导出按钮
      const exportPDFButton = document.createElement('button');
      exportPDFButton.className = 'control-button';
      exportPDFButton.innerHTML = '📄';
      exportPDFButton.title = '导出 PDF';
      exportPDFButton.onclick = () => this.exportToPDF();
      
      // 创建 Markdown 导出按钮
      const exportMDButton = document.createElement('button');
      exportMDButton.className = 'control-button';
      exportMDButton.innerHTML = '📝';
      exportMDButton.title = '导出 Markdown';
      exportMDButton.onclick = () => this.showMarkdownPreview();
      
      // 将按钮添加到控制按钮组
      controlButtons.appendChild(settingsButton);
      controlButtons.appendChild(exportPDFButton);
      controlButtons.appendChild(exportMDButton);
      
      // 创建 Markdown 预览弹窗
      this.createMarkdownModal();
      
      // 按顺序插入所有元素
      document.body.appendChild(sidebar);
      document.body.appendChild(controlButtons);
      document.body.appendChild(overlay);
      document.body.appendChild(settingsPanel);
      
      // 应用设置
      this.applySettings();
      this.applyTheme(this.settings.theme);
    }

    this.isEnabled = true;
  }

  disable() {
    if (this.originalContent) {
      // 恢复原始页面内容
      document.body.innerHTML = this.originalContent;
      // 恢复原始样式
      if (this.originalStyles) {
        document.documentElement.setAttribute('style', this.originalStyles);
      }
    }
    this.isEnabled = false;
  }

  toggle() {
    if (this.isEnabled) {
      this.disable();
    } else {
      this.enable();
    }
    return this.isEnabled;
  }

  applySettings() {
    const container = document.getElementById('reader-mode-container');
    if (!container) return;
    
    // 应用主题设置
    this.applyTheme(this.settings.theme);
    
    // 应用宽度设置
    container.style.setProperty('--reader-width', `${this.settings.width}px`);
    
    // 应用其他设置
    container.style.fontSize = `${this.settings.fontSize}px`;
    container.querySelectorAll('p, li').forEach(element => {
      element.style.fontSize = `${this.settings.fontSize}px`;
    });
    
    // 应用字体设置
    if (this.settings.fontFamily === 'custom' && this.settings.customFont) {
      this.applyFont(this.settings.customFont);
    } else {
      this.applyFont(this.settings.fontFamily);
    }
    
    container.style.setProperty('--reader-line-height', this.settings.lineHeight);
    
    // 应用字体粗细
    container.style.fontWeight = this.settings.fontWeight;
    container.querySelectorAll('p, li').forEach(element => {
      element.style.fontWeight = this.settings.fontWeight;
    });
  }

  findMainContent() {
    // 查找可能的主要内容容器
    const possibleSelectors = [
      'article',
      '[role="main"]',
      '.post-content',
      '.article-content',
      '.entry-content',
      'main'
    ];

    for (const selector of possibleSelectors) {
      const element = document.querySelector(selector);
      if (element) return element;
    }

    // 如果没有找到明确的内容容器，尝试分析文本密度
    return this.findContentByTextDensity();
  }

  findContentByTextDensity() {
    // 简单的文本密度分析算法
    let maxTextLength = 0;
    let mainContent = null;

    document.querySelectorAll('div').forEach(div => {
      const textLength = div.innerText.length;
      if (textLength > maxTextLength) {
        maxTextLength = textLength;
        mainContent = div;
      }
    });

    return mainContent;
  }

  applyFont(fontFamily) {
    const container = document.getElementById('reader-mode-container');
    const fallbackFonts = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, sans-serif';
    
    // 如果是系统默认字体，使用系统字体栈
    if (fontFamily === 'system-ui') {
      container.style.fontFamily = fallbackFonts;
    } else {
      // 其他情况添加后备字体
      container.style.fontFamily = `"${fontFamily}", ${fallbackFonts}`;
    }
  }

  // 添加导出 PDF 功能
  exportToPDF() {
    // 保存当前滚动位置
    const scrollPos = window.scrollY;
    
    // 创建打印样式
    const style = document.createElement('style');
    style.textContent = `
      @media print {
        body { padding: 0; margin: 0; }
        #reader-mode-container {
          margin: 0 auto !important;
          padding: 2cm !important;
        }
        #reader-mode-container img {
          max-width: 100% !important;
          page-break-inside: avoid;
        }
        h1, h2, h3, h4 { page-break-after: avoid; }
        p, li { page-break-inside: avoid; }
      }
    `;
    document.head.appendChild(style);

    // 准备打印
    const container = document.getElementById('reader-mode-container');
    const originalMargin = container.style.margin;
    const originalWidth = container.style.width;
    const originalMaxWidth = container.style.maxWidth;

    // 临时调整容器样式以适应打印
    container.style.margin = '0 auto';
    container.style.width = '100%';
    container.style.maxWidth = 'none';

    // 执行打印
    window.print();

    // 恢复原始样式
    container.style.margin = originalMargin;
    container.style.width = originalWidth;
    container.style.maxWidth = originalMaxWidth;
    document.head.removeChild(style);

    // 恢复滚动位置
    window.scrollTo(0, scrollPos);
  }

  // 添加 Markdown 导出功能
  exportToMarkdown() {
    const container = document.getElementById('reader-mode-container');
    let markdown = '';
    
    // 递归处理 DOM 节点
    const processNode = (node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        return node.textContent;
      }
      
      if (node.nodeType !== Node.ELEMENT_NODE) {
        return '';
      }
      
      let result = '';
      
      switch (node.tagName.toLowerCase()) {
        case 'h1':
          result = `# ${node.textContent}\n\n`;
          break;
        case 'h2':
          result = `## ${node.textContent}\n\n`;
          break;
        case 'h3':
          result = `### ${node.textContent}\n\n`;
          break;
        case 'h4':
          result = `#### ${node.textContent}\n\n`;
          break;
        case 'h5':
          result = `##### ${node.textContent}\n\n`;
          break;
        case 'h6':
          result = `###### ${node.textContent}\n\n`;
          break;
        case 'p':
          result = `${node.textContent}\n\n`;
          break;
        case 'strong':
        case 'b':
          result = `**${node.textContent}**`;
          break;
        case 'em':
        case 'i':
          result = `*${node.textContent}*`;
          break;
        case 'a':
          result = `[${node.textContent}](${node.href})`;
          break;
        case 'img':
          result = `![${node.alt || ''}](${node.src})\n\n`;
          break;
        case 'ul':
          result = Array.from(node.children)
            .map(li => `- ${li.textContent}\n`)
            .join('') + '\n';
          break;
        case 'ol':
          result = Array.from(node.children)
            .map((li, index) => `${index + 1}. ${li.textContent}\n`)
            .join('') + '\n';
          break;
        case 'blockquote':
          result = `> ${node.textContent}\n\n`;
          break;
        case 'pre':
        case 'code':
          result = `\`\`\`\n${node.textContent}\n\`\`\`\n\n`;
          break;
        case 'hr':
          result = '---\n\n';
          break;
        default:
          // 递归处理子节点
          Array.from(node.childNodes).forEach(child => {
            result += processNode(child);
          });
      }
      
      return result;
    };
    
    // 处理内容
    markdown = processNode(container);
    
    // 创建 Blob 对象
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
    
    // 创建下载链接
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${document.title || 'article'}.md`;
    
    // 触发下载
    document.body.appendChild(link);
    link.click();
    
    // 清理
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  // 创建 Markdown 预览弹窗
  createMarkdownModal() {
    const modal = document.createElement('div');
    modal.id = 'markdown-modal';
    modal.innerHTML = `
      <div class="modal-header">
        <div class="modal-title">Markdown 编辑</div>
        <button class="modal-close">×</button>
      </div>
      <div class="modal-content">
        <textarea id="markdown-content"></textarea>
      </div>
      <div class="modal-footer">
        <button class="modal-button" id="download-markdown">下载</button>
        <button class="modal-button primary" id="copy-markdown">复制</button>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // 添加事件监听
    modal.querySelector('.modal-close').onclick = () => this.closeMarkdownPreview();
    modal.querySelector('#copy-markdown').onclick = () => this.copyMarkdown();
    modal.querySelector('#download-markdown').onclick = () => this.downloadMarkdown();
    
    // 添加自动保存功能
    const textarea = modal.querySelector('#markdown-content');
    let timeoutId;
    textarea.addEventListener('input', () => {
      // 清除之前的定时器
      clearTimeout(timeoutId);
      // 设置新的定时器，300ms 后保存
      timeoutId = setTimeout(() => {
        try {
          localStorage.setItem('markdown-draft', textarea.value);
        } catch (e) {
          console.error('Failed to save draft:', e);
        }
      }, 300);
    });
  }

  // 显示 Markdown 预览
  showMarkdownPreview() {
    const modal = document.getElementById('markdown-modal');
    const content = document.getElementById('markdown-content');
    
    // 尝试加载上次的草稿
    try {
      const savedDraft = localStorage.getItem('markdown-draft');
      content.value = savedDraft || this.convertToMarkdown();
    } catch (e) {
      content.value = this.convertToMarkdown();
    }
    
    modal.classList.add('show');
    
    // 聚焦到文本框并将光标移到末尾
    content.focus();
    content.setSelectionRange(content.value.length, content.value.length);
  }

  // 关闭 Markdown 预览
  closeMarkdownPreview() {
    const modal = document.getElementById('markdown-modal');
    modal.classList.remove('show');
    
    // 清除草稿
    try {
      localStorage.removeItem('markdown-draft');
    } catch (e) {
      console.error('Failed to clear draft:', e);
    }
  }

  // 复制 Markdown 内容
  copyMarkdown() {
    const content = document.getElementById('markdown-content');
    content.select();
    document.execCommand('copy');
    
    // 保持选中状态，不取消选择
    
    // 显示复制成功提示
    const copyButton = document.getElementById('copy-markdown');
    const originalText = copyButton.textContent;
    copyButton.textContent = '已复制！';
    setTimeout(() => {
      copyButton.textContent = originalText;
    }, 2000);
  }

  // 下载 Markdown 文件
  downloadMarkdown() {
    const content = document.getElementById('markdown-content').value;
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${document.title || 'article'}.md`;
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  // 转换为 Markdown
  convertToMarkdown() {
    const container = document.getElementById('reader-mode-container');
    let markdown = '';
    
    const processNode = (node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        return node.textContent;
      }
      
      if (node.nodeType !== Node.ELEMENT_NODE) {
        return '';
      }
      
      let result = '';
      
      switch (node.tagName.toLowerCase()) {
        case 'h1':
          result = `# ${node.textContent}\n\n`;
          break;
        case 'h2':
          result = `## ${node.textContent}\n\n`;
          break;
        case 'h3':
          result = `### ${node.textContent}\n\n`;
          break;
        case 'h4':
          result = `#### ${node.textContent}\n\n`;
          break;
        case 'h5':
          result = `##### ${node.textContent}\n\n`;
          break;
        case 'h6':
          result = `###### ${node.textContent}\n\n`;
          break;
        case 'p':
          result = `${node.textContent}\n\n`;
          break;
        case 'strong':
        case 'b':
          result = `**${node.textContent}**`;
          break;
        case 'em':
        case 'i':
          result = `*${node.textContent}*`;
          break;
        case 'a':
          result = `[${node.textContent}](${node.href})`;
          break;
        case 'img':
          result = `![${node.alt || ''}](${node.src})\n\n`;
          break;
        case 'ul':
          result = Array.from(node.children)
            .map(li => `- ${li.textContent}\n`)
            .join('') + '\n';
          break;
        case 'ol':
          result = Array.from(node.children)
            .map((li, index) => `${index + 1}. ${li.textContent}\n`)
            .join('') + '\n';
          break;
        case 'blockquote':
          result = `> ${node.textContent}\n\n`;
          break;
        case 'pre':
        case 'code':
          result = `\`\`\`\n${node.textContent}\n\`\`\`\n\n`;
          break;
        case 'hr':
          result = '---\n\n';
          break;
        default:
          // 递归处理子节点
          Array.from(node.childNodes).forEach(child => {
            result += processNode(child);
          });
      }
      
      return result;
    };
    
    return processNode(container);
  }
}

// 初始化阅读模式
const reader = new ReaderMode();

// 监听来自 popup 的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case 'toggle':
      const isEnabled = reader.toggle();
      sendResponse({ success: true, isEnabled });
      break;
    case 'getState':
      sendResponse({ isEnabled: reader.isEnabled });
      break;
    default:
      sendResponse({ success: false });
  }
  return true; // 保持消息通道开启
}); 
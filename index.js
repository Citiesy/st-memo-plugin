(function() {
  'use strict';

  let searchPanel = null;
  let searchResults = [];
  
  // 默认设置
  const DEFAULT_SETTINGS = {
    caseSensitive: false,
    wholeWord: false,
    useRegex: false,
    autoSave: true,
    confirmReplace: true
  };
  
  let settings = { ...DEFAULT_SETTINGS };

  // 初始化插件
  function init() {
    console.log('[Search & Replace] 插件加载中...');
    
    loadSettings();
    addTriggerButton();
    registerSettingsPanel();
    
    console.log('[Search & Replace] 插件加载完成');
  }

  // 加载设置
  function loadSettings() {
    const saved = localStorage.getItem('search_replace_settings');
    if (saved) {
      try {
        settings = { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
      } catch (e) {
        console.error('[Search & Replace] 加载设置失败:', e);
      }
    }
  }

  // 保存设置
  function saveSettings() {
    if (settings.autoSave) {
      localStorage.setItem('search_replace_settings', JSON.stringify(settings));
    }
  }

  // 注册设置面板
  async function registerSettingsPanel() {
    try {
      await ST_API.ui.registerSettingsPanel({
        id: 'search-replace.settings',
        title: '搜索与替换设置',
        target: 'right',
        content: {
          kind: 'render',
          render: renderSettingsPanel
        }
      });
      console.log('[Search & Replace] 设置面板已注册');
    } catch (error) {
      console.error('[Search & Replace] 设置面板注册失败:', error);
    }
  }

  // 渲染设置面板
  function renderSettingsPanel(container) {
    container.className = 'sr-settings-panel';
    
    container.innerHTML = `
      <div class="sr-setting-item">
        <span class="sr-setting-label">默认搜索选项</span>
        <div class="sr-switch-group">
          <div class="sr-switch-item">
            <div class="sr-switch-info">
              <div class="sr-switch-title">区分大小写</div>
              <div class="sr-switch-desc">搜索时区分字母大小写</div>
            </div>
            <label class="sr-switch">
              <input type="checkbox" id="sr-setting-case" ${settings.caseSensitive ? 'checked' : ''}>
              <span class="sr-switch-slider"></span>
            </label>
          </div>
          
          <div class="sr-switch-item">
            <div class="sr-switch-info">
              <div class="sr-switch-title">全词匹配</div>
              <div class="sr-switch-desc">仅匹配完整的单词，不匹配部分内容</div>
            </div>
            <label class="sr-switch">
              <input type="checkbox" id="sr-setting-word" ${settings.wholeWord ? 'checked' : ''}>
              <span class="sr-switch-slider"></span>
            </label>
          </div>
          
          <div class="sr-switch-item">
            <div class="sr-switch-info">
              <div class="sr-switch-title">使用正则表达式</div>
              <div class="sr-switch-desc">启用高级正则表达式搜索</div>
            </div>
            <label class="sr-switch">
              <input type="checkbox" id="sr-setting-regex" ${settings.useRegex ? 'checked' : ''}>
              <span class="sr-switch-slider"></span>
            </label>
          </div>
        </div>
      </div>
      
      <div class="sr-setting-item">
        <span class="sr-setting-label">操作选项</span>
        <div class="sr-switch-group">
          <div class="sr-switch-item">
            <div class="sr-switch-info">
              <div class="sr-switch-title">自动保存设置</div>
              <div class="sr-switch-desc">自动保存您的偏好设置</div>
            </div>
            <label class="sr-switch">
              <input type="checkbox" id="sr-setting-autosave" ${settings.autoSave ? 'checked' : ''}>
              <span class="sr-switch-slider"></span>
            </label>
          </div>
          
          <div class="sr-switch-item">
            <div class="sr-switch-info">
              <div class="sr-switch-title">替换前确认</div>
              <div class="sr-switch-desc">批量替换前显示确认对话框</div>
            </div>
            <label class="sr-switch">
              <input type="checkbox" id="sr-setting-confirm" ${settings.confirmReplace ? 'checked' : ''}>
              <span class="sr-switch-slider"></span>
            </label>
          </div>
        </div>
      </div>
    `;
    
    // 绑定事件
    const handlers = [];
    
    const caseCheckbox = container.querySelector('#sr-setting-case');
    const caseHandler = (e) => {
      settings.caseSensitive = e.target.checked;
      saveSettings();
    };
    caseCheckbox.addEventListener('change', caseHandler);
    handlers.push(() => caseCheckbox.removeEventListener('change', caseHandler));
    
    const wordCheckbox = container.querySelector('#sr-setting-word');
    const wordHandler = (e) => {
      settings.wholeWord = e.target.checked;
      saveSettings();
    };
    wordCheckbox.addEventListener('change', wordHandler);
    handlers.push(() => wordCheckbox.removeEventListener('change', wordHandler));
    
    const regexCheckbox = container.querySelector('#sr-setting-regex');
    const regexHandler = (e) => {
      settings.useRegex = e.target.checked;
      saveSettings();
    };
    regexCheckbox.addEventListener('change', regexHandler);
    handlers.push(() => regexCheckbox.removeEventListener('change', regexHandler));
    
    const autosaveCheckbox = container.querySelector('#sr-setting-autosave');
    const autosaveHandler = (e) => {
      settings.autoSave = e.target.checked;
      saveSettings();
    };
    autosaveCheckbox.addEventListener('change', autosaveHandler);
    handlers.push(() => autosaveCheckbox.removeEventListener('change', autosaveHandler));
    
    const confirmCheckbox = container.querySelector('#sr-setting-confirm');
    const confirmHandler = (e) => {
      settings.confirmReplace = e.target.checked;
      saveSettings();
    };
    confirmCheckbox.addEventListener('change', confirmHandler);
    handlers.push(() => confirmCheckbox.removeEventListener('change', confirmHandler));
    
    // 返回清理函数
    return () => {
      handlers.forEach(cleanup => cleanup());
    };
  }

  // 添加触发按钮
  function addTriggerButton() {
    const sendForm = document.getElementById('send_form');
    if (!sendForm) {
      console.warn('[Search & Replace] 未找到消息输入表单');
      return;
    }

    const btn = document.createElement('div');
    btn.id = 'search-replace-trigger';
    btn.className = 'fa-solid fa-magnifying-glass';
    btn.title = '搜索与替换';
    
    btn.addEventListener('click', togglePanel);
    
    const sendButton = sendForm.querySelector('#send_but');
    if (sendButton) {
      sendButton.parentNode.insertBefore(btn, sendButton);
    } else {
      sendForm.appendChild(btn);
    }
  }

  // 切换面板
  function togglePanel() {
    if (searchPanel) {
      closePanel();
    } else {
      openPanel();
    }
  }

  // 打开搜索面板
  function openPanel() {
    searchPanel = document.createElement('div');
    searchPanel.id = 'search-replace-panel';
    searchPanel.innerHTML = `
      <div class="sr-header">
        <h2>
          <i class="fa-solid fa-magnifying-glass"></i>
          搜索与替换
        </h2>
      </div>
      
      <div class="sr-content">
        <div class="sr-input-group">
          <label for="sr-search-input">搜索内容</label>
          <div class="sr-input-wrapper">
            <i class="fa-solid fa-search"></i>
            <input type="text" id="sr-search-input" placeholder="输入搜索关键词">
          </div>
        </div>
        
        <div class="sr-input-group">
          <label for="sr-replace-input">替换内容</label>
          <div class="sr-input-wrapper">
            <i class="fa-solid fa-pen"></i>
            <input type="text" id="sr-replace-input" placeholder="输入替换文本">
          </div>
        </div>
        
        <div class="sr-options">
          <div class="sr-option">
            <input type="checkbox" id="sr-case-sensitive" ${settings.caseSensitive ? 'checked' : ''}>
            <label for="sr-case-sensitive">区分大小写</label>
          </div>
          <div class="sr-option">
            <input type="checkbox" id="sr-whole-word" ${settings.wholeWord ? 'checked' : ''}>
            <label for="sr-whole-word">全词匹配</label>
          </div>
          <div class="sr-option">
            <input type="checkbox" id="sr-regex" ${settings.useRegex ? 'checked' : ''}>
            <label for="sr-regex">正则表达式</label>
          </div>
        </div>
        
        <div class="sr-actions">
          <button class="sr-btn sr-btn-primary" id="sr-search-btn">
            <i class="fa-solid fa-search"></i>
            搜索
          </button>
          <button class="sr-btn sr-btn-danger" id="sr-replace-all-btn">
            <i class="fa-solid fa-repeat"></i>
            全部替换
          </button>
          <button class="sr-btn sr-btn-secondary" id="sr-close-btn">
            <i class="fa-solid fa-xmark"></i>
            关闭
          </button>
        </div>
        
        <div id="sr-stats-container"></div>
        
        <div id="sr-results-container"></div>
      </div>
    `;
    
    document.body.appendChild(searchPanel);
    
    // 绑定事件
    document.getElementById('sr-search-btn').addEventListener('click', performSearch);
    document.getElementById('sr-replace-all-btn').addEventListener('click', performReplaceAll);
    document.getElementById('sr-close-btn').addEventListener('click', closePanel);
    document.getElementById('sr-search-input').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') performSearch();
    });
    
    // 自动聚焦搜索框
    setTimeout(() => {
      document.getElementById('sr-search-input').focus();
    }, 100);
  }

  // 关闭面板
  function closePanel() {
    if (searchPanel) {
      searchPanel.remove();
      searchPanel = null;
      searchResults = [];
    }
  }

  // 执行搜索
  async function performSearch() {
    const searchText = document.getElementById('sr-search-input').value;
    if (!searchText) {
      showStats('请输入搜索内容', 'warning', 'fa-triangle-exclamation');
      return;
    }

    const caseSensitive = document.getElementById('sr-case-sensitive').checked;
    const wholeWord = document.getElementById('sr-whole-word').checked;
    const useRegex = document.getElementById('sr-regex').checked;

    try {
      showStats('正在搜索...', 'info', 'fa-spinner fa-spin');
      
      const result = await ST_API.chatHistory.list({});
      const messages = result.messages;

      searchResults = [];
      let totalMatches = 0;

      // 构建搜索模式
      let pattern;
      if (useRegex) {
        try {
          pattern = new RegExp(searchText, caseSensitive ? 'g' : 'gi');
        } catch (e) {
          showStats('正则表达式语法错误', 'error', 'fa-circle-exclamation');
          return;
        }
      } else {
        let escapedText = searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        if (wholeWord) {
          escapedText = `\\b${escapedText}\\b`;
        }
        pattern = new RegExp(escapedText, caseSensitive ? 'g' : 'gi');
      }

      // 搜索每条消息
      messages.forEach((msg, index) => {
        if (!('parts' in msg)) return;

        const textParts = msg.parts.filter(p => 'text' in p);
        textParts.forEach(part => {
          const matches = part.text.match(pattern);
          if (matches) {
            searchResults.push({
              index,
              message: msg,
              text: part.text,
              matches: matches.length
            });
            totalMatches += matches.length;
          }
        });
      });

      // 显示结果
      displayResults(pattern, totalMatches);

    } catch (error) {
      console.error('[Search & Replace] 搜索失败:', error);
      showStats('搜索失败，请重试', 'error', 'fa-circle-xmark');
    }
  }

  // 显示搜索结果
  function displayResults(pattern, totalMatches) {
    const container = document.getElementById('sr-results-container');
    
    if (searchResults.length === 0) {
      showStats('未找到匹配结果', 'warning', 'fa-circle-info');
      container.innerHTML = `
        <div class="sr-empty">
          <i class="fa-solid fa-inbox"></i>
          <p>没有找到匹配的消息</p>
        </div>
      `;
      return;
    }

    showStats(
      `找到 ${searchResults.length} 条消息，共 ${totalMatches} 处匹配`, 
      'success', 
      'fa-circle-check'
    );

    let resultsHTML = `
      <div class="sr-results">
        <div class="sr-results-header">
          <span class="sr-results-title">搜索结果</span>
          <span class="sr-results-count">${searchResults.length} 条消息</span>
        </div>
    `;

    searchResults.forEach(result => {
      const highlightedText = result.text.replace(pattern, match => 
        `<span class="sr-highlight">${escapeHtml(match)}</span>`
      );

      let preview = highlightedText;
      if (preview.length > 250) {
        const firstMatch = preview.indexOf('<span class="sr-highlight">');
        const start = Math.max(0, firstMatch - 75);
        const end = Math.min(preview.length, firstMatch + 175);
        preview = (start > 0 ? '...' : '') + 
                  preview.substring(start, end) + 
                  (end < preview.length ? '...' : '');
      }

      resultsHTML += `
        <div class="sr-result-item">
          <div class="sr-result-header">
            <div class="sr-result-meta">
              <span class="sr-result-index">#${result.index}</span>
              <span class="sr-result-role ${result.message.role}">${result.message.role}</span>
            </div>
            <span class="sr-result-matches">${result.matches} 处匹配</span>
          </div>
          <div class="sr-result-preview">${preview}</div>
        </div>
      `;
    });

    resultsHTML += '</div>';
    container.innerHTML = resultsHTML;
  }

  // 执行全部替换
  async function performReplaceAll() {
    const searchText = document.getElementById('sr-search-input').value;
    const replaceText = document.getElementById('sr-replace-input').value;

    if (!searchText) {
      showStats('请先执行搜索', 'warning', 'fa-triangle-exclamation');
      return;
    }

    if (searchResults.length === 0) {
      showStats('没有可替换的内容', 'warning', 'fa-circle-info');
      return;
    }

    if (settings.confirmReplace && !confirm(`确定要替换 ${searchResults.length} 条消息中的内容吗？此操作不可撤销。`)) {
      return;
    }

    const caseSensitive = document.getElementById('sr-case-sensitive').checked;
    const wholeWord = document.getElementById('sr-whole-word').checked;
    const useRegex = document.getElementById('sr-regex').checked;

    try {
      showStats('正在替换...', 'info', 'fa-spinner fa-spin');

      let pattern;
      if (useRegex) {
        pattern = new RegExp(searchText, caseSensitive ? 'g' : 'gi');
      } else {
        let escapedText = searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        if (wholeWord) {
          escapedText = `\\b${escapedText}\\b`;
        }
        pattern = new RegExp(escapedText, caseSensitive ? 'g' : 'gi');
      }

      let replacedCount = 0;

      for (const result of searchResults) {
        const newParts = result.message.parts.map(part => {
          if ('text' in part) {
            return { text: part.text.replace(pattern, replaceText) };
          }
          return part;
        });

        await ST_API.chatHistory.update({
          index: result.index,
          content: newParts
        });

        replacedCount++;
      }

      showStats(
        `成功替换 ${replacedCount} 条消息`, 
        'success', 
        'fa-circle-check'
      );
      
      // 清空结果
      searchResults = [];
      document.getElementById('sr-results-container').innerHTML = '';

    } catch (error) {
      console.error('[Search & Replace] 替换失败:', error);
      showStats('替换失败，请重试', 'error', 'fa-circle-xmark');
    }
  }

  // 显示统计信息
  function showStats(message, type = 'info', icon = 'fa-circle-info') {
    const container = document.getElementById('sr-stats-container');
    container.innerHTML = `
      <div class="sr-stats ${type}">
        <i class="fa-solid ${icon}"></i>
        <span>${message}</span>
      </div>
    `;
  }

  // HTML转义
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // 等待 ST_API 加载
  if (typeof ST_API !== 'undefined') {
    init();
  } else {
    const checkAPI = setInterval(() => {
      if (typeof ST_API !== 'undefined') {
        clearInterval(checkAPI);
        init();
      }
    }, 100);
  }

})();
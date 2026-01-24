(function () {
  const MODULE_NAME = "ChatSearchReplace";
  const PANEL_ID = "chat-search-replace";

  // 状态管理
  const state = {
    searchResults: [],
    currentResultIndex: -1,
    isRegex: false,
    caseSensitive: false,
    isPanelOpen: false,
  };

  const ctx = SillyTavern.getContext();
  const { eventSource, event_types } = ctx;

  function buildPanelHTML() {
    return `
      <div id="${PANEL_ID}" class="csr-floating-panel">
        <div class="csr-header">
          <span class="csr-title">🔍 搜索与替换</span>
          <button id="${PANEL_ID}__close" class="csr-close-btn" title="关闭">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
        
        <div class="csr-body">
          <div class="csr-row">
            <input type="text" id="${PANEL_ID}__search" class="text_pole" placeholder="输入搜索内容..." autocomplete="off" />
            <button id="${PANEL_ID}__btn-search" class="menu_button csr-btn" title="搜索">
              <i class="fa-solid fa-search"></i>
            </button>
          </div>
          
          <div class="csr-row">
            <input type="text" id="${PANEL_ID}__replace" class="text_pole" placeholder="替换为..." autocomplete="off" />
            <button id="${PANEL_ID}__btn-replace-one" class="menu_button csr-btn" title="替换当前">
              <i class="fa-solid fa-arrow-right"></i>
            </button>
            <button id="${PANEL_ID}__btn-replace-all" class="menu_button csr-btn" title="全部替换">
              <i class="fa-solid fa-arrows-rotate"></i>
            </button>
          </div>
          
          <div class="csr-row csr-options">
            <label class="csr-checkbox">
              <input type="checkbox" id="${PANEL_ID}__regex" />
              <span>正则表达式</span>
            </label>
            <label class="csr-checkbox">
              <input type="checkbox" id="${PANEL_ID}__case" />
              <span>区分大小写</span>
            </label>
          </div>
          
          <div class="csr-row csr-nav">
            <button id="${PANEL_ID}__btn-prev" class="menu_button csr-btn" title="上一个">
              <i class="fa-solid fa-chevron-up"></i>
            </button>
            <span id="${PANEL_ID}__result-info" class="csr-result-info">0 / 0</span>
            <button id="${PANEL_ID}__btn-next" class="menu_button csr-btn" title="下一个">
              <i class="fa-solid fa-chevron-down"></i>
            </button>
            <button id="${PANEL_ID}__btn-clear" class="menu_button csr-btn" title="清除结果">
              <i class="fa-solid fa-eraser"></i>
            </button>
          </div>
          
          <div id="${PANEL_ID}__preview" class="csr-preview">
            <p class="csr-placeholder">准备就绪</p>
          </div>
        </div>
      </div>
    `;
  }

  function togglePanel() {
    const $panel = $(`#${PANEL_ID}`);
    
    if ($panel.length === 0) {
      $("body").append(buildPanelHTML());
      const $newPanel = $(`#${PANEL_ID}`);
      
      bindEvents();
      
      // 关键修复：阻止点击事件冒泡到 body，防止输入框失去焦点
      $newPanel.on("mousedown click", function(e) {
        e.stopPropagation();
      });

      // 自动聚焦搜索框
      setTimeout(() => $(`#${PANEL_ID}__search`).focus(), 100);
      
      state.isPanelOpen = true;
    } else {
      if (state.isPanelOpen) {
        $panel.fadeOut(100);
        state.isPanelOpen = false;
      } else {
        $panel.fadeIn(100);
        $(`#${PANEL_ID}__search`).focus();
        state.isPanelOpen = true;
      }
    }
  }

  function closePanel() {
    $(`#${PANEL_ID}`).fadeOut(100);
    state.isPanelOpen = false;
  }

  // ... (中间的 doSearch, replaceOne, replaceAll 等逻辑保持不变，可以直接复用上面的) ...
  // 为了确保代码完整性，这里我把核心逻辑再补全一下：

  async function doSearch() {
    const searchInput = $(`#${PANEL_ID}__search`).val(); // 允许空字符串搜索(虽然没意义)但最好判空
    if (!searchInput) return;

    state.isRegex = $(`#${PANEL_ID}__regex`).prop("checked");
    state.caseSensitive = $(`#${PANEL_ID}__case`).prop("checked");

    let chatData;
    try {
      chatData = await ST_API.chatHistory.list();
    } catch (err) {
      return;
    }

    const messages = chatData.messages;
    state.searchResults = [];

    let regex;
    try {
      if (state.isRegex) {
        const flags = state.caseSensitive ? "g" : "gi";
        regex = new RegExp(searchInput, flags);
      } else {
        const escaped = searchInput.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const flags = state.caseSensitive ? "g" : "gi";
        regex = new RegExp(escaped, flags);
      }
    } catch (err) {
      toastr.error("正则错误");
      return;
    }

    messages.forEach((msg, index) => {
      let textContent = "";
      if (msg.parts && Array.isArray(msg.parts)) {
        textContent = msg.parts.filter((p) => p.text).map((p) => p.text).join("\n");
      } else if (typeof msg.content === "string") {
        textContent = msg.content;
      }
      if (!textContent) return;

      regex.lastIndex = 0;
      const matches = [];
      let match;
      while ((match = regex.exec(textContent)) !== null) {
        matches.push({ start: match.index, end: match.index + match[0].length, text: match[0] });
        if (match[0].length === 0) regex.lastIndex++;
      }
      if (matches.length > 0) {
        state.searchResults.push({
          index,
          role: msg.role,
          name: msg.name || msg.role,
          textContent,
          matches,
        });
      }
    });

    state.currentResultIndex = state.searchResults.length > 0 ? 0 : -1;
    updateResultsUI();
    
    if (state.searchResults.length > 0) {
      toastr.success(`找到 ${state.searchResults.reduce((a,b)=>a+b.matches.length,0)} 处匹配`);
    } else {
      toastr.info("未找到");
    }
  }

  function updateResultsUI() {
    const $preview = $(`#${PANEL_ID}__preview`);
    const $info = $(`#${PANEL_ID}__result-info`);

    if (state.searchResults.length === 0) {
      $preview.html('<p class="csr-placeholder">无结果</p>');
      $info.text("0 / 0");
      return;
    }

    $info.text(`${state.currentResultIndex + 1} / ${state.searchResults.length}`);
    const current = state.searchResults[state.currentResultIndex];
    
    let html = escapeHtml(current.textContent);
    // 反向高亮防止偏移
    [...current.matches].sort((a,b)=>b.start-a.start).forEach(m => {
       const before = html.substring(0, m.start);
       const match = html.substring(m.start, m.end);
       const after = html.substring(m.end);
       html = `${before}<span class="csr-highlight">${match}</span>${after}`;
    });

    $preview.html(`
      <div class="csr-result-header">
        <strong>${current.name}</strong> <span>#${current.index}</span>
      </div>
      <div class="csr-result-text">${html}</div>
    `);
    
    // 滚动聊天
    const $msg = $("#chat .mes").eq(current.index);
    if ($msg.length) {
      $msg[0].scrollIntoView({ behavior: "smooth", block: "center" });
      $msg.addClass("csr-flash");
      setTimeout(()=> $msg.removeClass("csr-flash"), 1000);
    }
  }

  // 辅助函数
  function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }
  
  function replaceText(text, replaceWith) {
     const searchInput = $(`#${PANEL_ID}__search`).val();
     let regex;
     if (state.isRegex) {
       regex = new RegExp(searchInput, state.caseSensitive ? "g" : "gi");
     } else {
       const escaped = searchInput.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
       regex = new RegExp(escaped, state.caseSensitive ? "g" : "gi");
     }
     return text.replace(regex, replaceWith);
  }

  async function replaceOne() {
    if (state.currentResultIndex < 0) return;
    const current = state.searchResults[state.currentResultIndex];
    const replaceWith = $(`#${PANEL_ID}__replace`).val();
    
    const msgData = await ST_API.chatHistory.get({ index: current.index });
    let newContent = msgData.message.parts 
      ? msgData.message.parts.map(p => p.text ? {...p, text: replaceText(p.text, replaceWith)} : p)
      : replaceText(current.textContent, replaceWith);

    await ST_API.chatHistory.update({ index: current.index, content: newContent });
    await ST_API.ui.reloadChat();
    
    // 简单处理：重新搜索一次以更新状态
    doSearch();
  }

  async function replaceAll() {
    if (state.searchResults.length === 0) return;
    const replaceWith = $(`#${PANEL_ID}__replace`).val();
    
    // 简单粗暴：遍历所有结果进行替换（去重消息索引）
    const indices = [...new Set(state.searchResults.map(r => r.index))].sort((a,b)=>b-a);
    
    for (const idx of indices) {
        const msgData = await ST_API.chatHistory.get({ index: idx });
        let newContent = msgData.message.parts 
          ? msgData.message.parts.map(p => p.text ? {...p, text: replaceText(p.text, replaceWith)} : p)
          : replaceText(msgData.message.content || "", replaceWith);
          
        await ST_API.chatHistory.update({ index: idx, content: newContent });
    }
    
    await ST_API.ui.reloadChat();
    toastr.success("替换完成");
    state.searchResults = [];
    updateResultsUI();
  }

  function bindEvents() {
    $(`#${PANEL_ID}__close`).on("click", closePanel);
    $(`#${PANEL_ID}__btn-search`).on("click", doSearch);
    $(`#${PANEL_ID}__search`).on("keydown", (e) => e.key === "Enter" && doSearch());
    $(`#${PANEL_ID}__btn-replace-one`).on("click", replaceOne);
    $(`#${PANEL_ID}__btn-replace-all`).on("click", replaceAll);
    $(`#${PANEL_ID}__btn-prev`).on("click", () => {
        if(state.searchResults.length){
            state.currentResultIndex = (state.currentResultIndex - 1 + state.searchResults.length) % state.searchResults.length;
            updateResultsUI();
        }
    });
    $(`#${PANEL_ID}__btn-next`).on("click", () => {
        if(state.searchResults.length){
            state.currentResultIndex = (state.currentResultIndex + 1) % state.searchResults.length;
            updateResultsUI();
        }
    });
    $(`#${PANEL_ID}__btn-clear`).on("click", () => {
        state.searchResults = [];
        updateResultsUI();
        $(`#${PANEL_ID}__search`).val("").focus();
    });
  }

  function registerMenuItem() {
    ST_API.ui.registerExtensionsMenuItem({
      id: `${PANEL_ID}.menu`,
      label: "搜索替换",
      icon: "fa-solid fa-magnifying-glass-arrow-right",
      onClick: togglePanel,
    });
  }

  eventSource.on(event_types.APP_READY, registerMenuItem);
})();
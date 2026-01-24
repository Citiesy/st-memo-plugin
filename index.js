(function () {
  const MODULE_NAME = "ChatSearchReplace";
  const PANEL_ID = "chat-search-replace";

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
      <div id="${PANEL_ID}" class="csr-floating-panel" tabindex="-1">
        <div class="csr-header">
          <span class="csr-title">🔍 搜索与替换</span>
          <button id="${PANEL_ID}__close" class="csr-close-btn" type="button">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
        
        <div class="csr-body">
          <div class="csr-row">
            <input type="text" id="${PANEL_ID}__search" class="text_pole csr-input" 
                   placeholder="搜索内容..." autocomplete="off" />
            <button id="${PANEL_ID}__btn-search" class="menu_button" type="button" title="搜索">
              <i class="fa-solid fa-search"></i>
            </button>
          </div>
          
          <div class="csr-row">
            <input type="text" id="${PANEL_ID}__replace" class="text_pole csr-input" 
                   placeholder="替换为..." autocomplete="off" />
            <button id="${PANEL_ID}__btn-replace-one" class="menu_button" type="button" title="替换当前">
              <i class="fa-solid fa-arrow-right"></i>
            </button>
            <button id="${PANEL_ID}__btn-replace-all" class="menu_button" type="button" title="全部替换">
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
            <button id="${PANEL_ID}__btn-prev" class="menu_button" type="button" title="上一个">
              <i class="fa-solid fa-chevron-up"></i>
            </button>
            <span id="${PANEL_ID}__result-info" class="csr-result-info">0 / 0</span>
            <button id="${PANEL_ID}__btn-next" class="menu_button" type="button" title="下一个">
              <i class="fa-solid fa-chevron-down"></i>
            </button>
            <button id="${PANEL_ID}__btn-clear" class="menu_button" type="button" title="清除">
              <i class="fa-solid fa-eraser"></i>
            </button>
          </div>
          
          <div id="${PANEL_ID}__preview" class="csr-preview">
            <p class="csr-placeholder">输入关键词后点击搜索</p>
          </div>
        </div>
      </div>
    `;
  }

  function togglePanel() {
    const $panel = $(`#${PANEL_ID}`);
    
    if ($panel.length === 0) {
      $("body").append(buildPanelHTML());
      bindEvents();
      state.isPanelOpen = true;
      // 自动聚焦到搜索框
      setTimeout(() => $(`#${PANEL_ID}__search`).focus(), 100);
    } else {
      if (state.isPanelOpen) {
        $panel.fadeOut(200);
        state.isPanelOpen = false;
      } else {
        $panel.fadeIn(200);
        state.isPanelOpen = true;
        setTimeout(() => $(`#${PANEL_ID}__search`).focus(), 100);
      }
    }
  }

  function closePanel() {
    $(`#${PANEL_ID}`).fadeOut(200);
    state.isPanelOpen = false;
  }

  async function doSearch() {
    const searchInput = $(`#${PANEL_ID}__search`).val().trim();
    if (!searchInput) {
      toastr.warning("请输入搜索内容");
      return;
    }

    state.isRegex = $(`#${PANEL_ID}__regex`).prop("checked");
    state.caseSensitive = $(`#${PANEL_ID}__case`).prop("checked");

    let chatData;
    try {
      chatData = await ST_API.chatHistory.list();
    } catch (err) {
      toastr.error("获取聊天记录失败");
      console.error(`[${MODULE_NAME}]`, err);
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
      toastr.error("正则表达式语法错误");
      return;
    }

    messages.forEach((msg, index) => {
      let textContent = "";

      if (msg.parts && Array.isArray(msg.parts)) {
        textContent = msg.parts
          .filter((p) => p.text)
          .map((p) => p.text)
          .join("\n");
      } else if (typeof msg.content === "string") {
        textContent = msg.content;
      }

      if (!textContent) return;

      regex.lastIndex = 0;
      const matches = [];
      let match;

      while ((match = regex.exec(textContent)) !== null) {
        matches.push({
          start: match.index,
          end: match.index + match[0].length,
          text: match[0],
        });
        if (match[0].length === 0) regex.lastIndex++;
      }

      if (matches.length > 0) {
        state.searchResults.push({
          index,
          role: msg.role,
          name: msg.name || (msg.role === "user" ? "用户" : "角色"),
          textContent,
          matches,
        });
      }
    });

    state.currentResultIndex = state.searchResults.length > 0 ? 0 : -1;
    updateResultsUI();

    const totalMatches = state.searchResults.reduce(
      (sum, r) => sum + r.matches.length,
      0
    );
    if (totalMatches > 0) {
      toastr.success(`找到 ${totalMatches} 处匹配`);
    } else {
      toastr.info("未找到匹配内容");
    }
  }

  function updateResultsUI() {
    const $preview = $(`#${PANEL_ID}__preview`);
    const $info = $(`#${PANEL_ID}__result-info`);

    if (state.searchResults.length === 0) {
      $preview.html('<p class="csr-placeholder">无搜索结果</p>');
      $info.text("0 / 0");
      return;
    }

    $info.text(`${state.currentResultIndex + 1} / ${state.searchResults.length}`);

    const current = state.searchResults[state.currentResultIndex];
    if (!current) return;

    let highlightedText = escapeHtml(current.textContent);
    const sortedMatches = [...current.matches].sort((a, b) => b.start - a.start);

    for (const m of sortedMatches) {
      const before = highlightedText.substring(0, m.start);
      const matched = highlightedText.substring(m.start, m.end);
      const after = highlightedText.substring(m.end);
      highlightedText = `${before}<mark class="csr-highlight">${matched}</mark>${after}`;
    }

    $preview.html(`
      <div class="csr-result-item">
        <div class="csr-result-header">
          <span class="csr-result-role ${current.role}">${current.name}</span>
          <span class="csr-result-index">消息 #${current.index}</span>
        </div>
        <div class="csr-result-text">${highlightedText}</div>
      </div>
    `);

    scrollToMessage(current.index);
  }

  function scrollToMessage(index) {
    const $messages = $("#chat .mes");
    if ($messages.length > index) {
      const $target = $messages.eq(index);
      $target[0].scrollIntoView({ behavior: "smooth", block: "center" });
      $target.addClass("csr-flash");
      setTimeout(() => $target.removeClass("csr-flash"), 1500);
    }
  }

  async function replaceOne() {
    if (state.currentResultIndex < 0) {
      toastr.warning("没有可替换的内容");
      return;
    }

    const replaceWith = $(`#${PANEL_ID}__replace`).val();
    const current = state.searchResults[state.currentResultIndex];

    try {
      const msgData = await ST_API.chatHistory.get({ index: current.index });
      const msg = msgData.message;
      let newContent;

      if (msg.parts && Array.isArray(msg.parts)) {
        newContent = msg.parts.map((p) => {
          if (p.text) return { ...p, text: replaceText(p.text, replaceWith) };
          return p;
        });
      } else {
        newContent = replaceText(current.textContent, replaceWith);
      }

      await ST_API.chatHistory.update({ index: current.index, content: newContent });
      toastr.success(`已替换消息 #${current.index}`);
      await ST_API.ui.reloadChat();

      state.searchResults.splice(state.currentResultIndex, 1);
      if (state.currentResultIndex >= state.searchResults.length) {
        state.currentResultIndex = Math.max(0, state.searchResults.length - 1);
      }
      updateResultsUI();
    } catch (err) {
      toastr.error("替换失败");
    }
  }

  async function replaceAll() {
    if (state.searchResults.length === 0) {
      toastr.warning("没有可替换的内容");
      return;
    }

    const replaceWith = $(`#${PANEL_ID}__replace`).val();
    let count = 0;

    for (const result of [...state.searchResults].sort((a, b) => b.index - a.index)) {
      try {
        const msgData = await ST_API.chatHistory.get({ index: result.index });
        const msg = msgData.message;
        let newContent;

        if (msg.parts && Array.isArray(msg.parts)) {
          newContent = msg.parts.map((p) => {
            if (p.text) return { ...p, text: replaceText(p.text, replaceWith) };
            return p;
          });
        } else {
          newContent = replaceText(result.textContent, replaceWith);
        }

        await ST_API.chatHistory.update({ index: result.index, content: newContent });
        count++;
      } catch (err) {}
    }

    await ST_API.ui.reloadChat();
    clearSearch();
    toastr.success(`成功替换 ${count} 条消息`);
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

  function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  function goToPrev() {
    if (state.searchResults.length === 0) return;
    state.currentResultIndex = (state.currentResultIndex - 1 + state.searchResults.length) % state.searchResults.length;
    updateResultsUI();
  }

  function goToNext() {
    if (state.searchResults.length === 0) return;
    state.currentResultIndex = (state.currentResultIndex + 1) % state.searchResults.length;
    updateResultsUI();
  }

  function clearSearch() {
    state.searchResults = [];
    state.currentResultIndex = -1;
    $(`#${PANEL_ID}__search`).val("");
    $(`#${PANEL_ID}__replace`).val("");
    $(`#${PANEL_ID}__preview`).html('<p class="csr-placeholder">输入关键词后点击搜索</p>');
    $(`#${PANEL_ID}__result-info`).text("0 / 0");
  }

  function bindEvents() {
    const $panel = $(`#${PANEL_ID}`);

    // ★★★ 关键：阻止所有键盘事件冒泡到酒馆 ★★★
    $panel.on("keydown keyup keypress input", (e) => {
      e.stopPropagation();
    });

    // 阻止点击冒泡
    $panel.on("click mousedown mouseup", (e) => {
      e.stopPropagation();
    });

    $(`#${PANEL_ID}__close`).on("click", closePanel);
    $(`#${PANEL_ID}__btn-search`).on("click", doSearch);
    $(`#${PANEL_ID}__search`).on("keydown", (e) => {
      e.stopPropagation();
      if (e.key === "Enter") doSearch();
    });
    $(`#${PANEL_ID}__btn-replace-one`).on("click", replaceOne);
    $(`#${PANEL_ID}__btn-replace-all`).on("click", replaceAll);
    $(`#${PANEL_ID}__btn-prev`).on("click", goToPrev);
    $(`#${PANEL_ID}__btn-next`).on("click", goToNext);
    $(`#${PANEL_ID}__btn-clear`).on("click", clearSearch);
  }

  async function registerMenuItem() {
    try {
      await ST_API.ui.registerExtensionsMenuItem({
        id: `${PANEL_ID}.menu`,
        label: "搜索替换",
        icon: "fa-solid fa-magnifying-glass-arrow-right",
        onClick: togglePanel,
      });
      console.log(`[${MODULE_NAME}] 注册成功`);
    } catch (err) {
      console.error(`[${MODULE_NAME}] 注册失败:`, err);
    }
  }

  eventSource.on(event_types.APP_READY, registerMenuItem);
  eventSource.on(event_types.CHAT_CHANGED, clearSearch);
})();
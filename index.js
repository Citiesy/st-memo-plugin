(function () {
  const MODULE_NAME = "ChatSearchReplace";
  const PANEL_ID = "chat-search-replace";

  // 状态管理
  const state = {
    searchResults: [],      // 搜索结果 [{index, text, matches}]
    currentResultIndex: -1, // 当前高亮的结果索引
    isRegex: false,
    caseSensitive: false,
  };

  // 从酒馆获取 context
  const ctx = SillyTavern.getContext();
  const { eventSource, event_types } = ctx;

  /**
   * 构建搜索面板的 HTML
   */
  function buildPanelHTML() {
    return `
      <div id="${PANEL_ID}" class="csr-container">
        <!-- 搜索输入区 -->
        <div class="csr-row">
          <input type="text" id="${PANEL_ID}__search" class="text_pole" placeholder="搜索内容..." />
          <button id="${PANEL_ID}__btn-search" class="menu_button" title="搜索">
            <i class="fa-solid fa-search"></i>
          </button>
        </div>
        
        <!-- 替换输入区 -->
        <div class="csr-row">
          <input type="text" id="${PANEL_ID}__replace" class="text_pole" placeholder="替换为..." />
          <button id="${PANEL_ID}__btn-replace-one" class="menu_button" title="替换当前">
            <i class="fa-solid fa-arrow-right"></i>
          </button>
          <button id="${PANEL_ID}__btn-replace-all" class="menu_button" title="全部替换">
            <i class="fa-solid fa-arrows-rotate"></i>
          </button>
        </div>
        
        <!-- 选项区 -->
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
        
        <!-- 结果导航 -->
        <div class="csr-row csr-nav">
          <button id="${PANEL_ID}__btn-prev" class="menu_button" title="上一个">
            <i class="fa-solid fa-chevron-up"></i>
          </button>
          <span id="${PANEL_ID}__result-info" class="csr-result-info">0 / 0</span>
          <button id="${PANEL_ID}__btn-next" class="menu_button" title="下一个">
            <i class="fa-solid fa-chevron-down"></i>
          </button>
          <button id="${PANEL_ID}__btn-clear" class="menu_button" title="清除搜索">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
        
        <!-- 结果预览区 -->
        <div id="${PANEL_ID}__preview" class="csr-preview">
          <p class="csr-placeholder">输入关键词后点击搜索</p>
        </div>
      </div>
    `;
  }

  /**
   * 执行搜索
   */
  async function doSearch() {
    const searchInput = $(`#${PANEL_ID}__search`).val().trim();
    if (!searchInput) {
      toastr.warning("请输入搜索内容");
      return;
    }

    state.isRegex = $(`#${PANEL_ID}__regex`).prop("checked");
    state.caseSensitive = $(`#${PANEL_ID}__case`).prop("checked");

    // 获取所有聊天记录
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

    // 构建正则或字符串匹配
    let regex;
    try {
      if (state.isRegex) {
        const flags = state.caseSensitive ? "g" : "gi";
        regex = new RegExp(searchInput, flags);
      } else {
        // 转义特殊字符
        const escaped = searchInput.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const flags = state.caseSensitive ? "g" : "gi";
        regex = new RegExp(escaped, flags);
      }
    } catch (err) {
      toastr.error("正则表达式语法错误");
      return;
    }

    // 遍历消息查找匹配
    messages.forEach((msg, index) => {
      let textContent = "";

      // 提取消息文本 (Gemini 格式)
      if (msg.parts && Array.isArray(msg.parts)) {
        textContent = msg.parts
          .filter((p) => p.text)
          .map((p) => p.text)
          .join("\n");
      } else if (typeof msg.content === "string") {
        // OpenAI 格式兼容
        textContent = msg.content;
      }

      if (!textContent) return;

      // 重置正则状态
      regex.lastIndex = 0;
      const matches = [];
      let match;

      while ((match = regex.exec(textContent)) !== null) {
        matches.push({
          start: match.index,
          end: match.index + match[0].length,
          text: match[0],
        });
        // 防止零宽匹配死循环
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

    // 更新 UI
    state.currentResultIndex = state.searchResults.length > 0 ? 0 : -1;
    updateResultsUI();

    const totalMatches = state.searchResults.reduce(
      (sum, r) => sum + r.matches.length,
      0
    );
    if (totalMatches > 0) {
      toastr.success(
        `找到 ${totalMatches} 处匹配，分布在 ${state.searchResults.length} 条消息中`
      );
    } else {
      toastr.info("未找到匹配内容");
    }
  }

  /**
   * 更新结果显示 UI
   */
  function updateResultsUI() {
    const $preview = $(`#${PANEL_ID}__preview`);
    const $info = $(`#${PANEL_ID}__result-info`);

    if (state.searchResults.length === 0) {
      $preview.html('<p class="csr-placeholder">无搜索结果</p>');
      $info.text("0 / 0");
      return;
    }

    $info.text(
      `${state.currentResultIndex + 1} / ${state.searchResults.length}`
    );

    // 渲染当前结果预览
    const current = state.searchResults[state.currentResultIndex];
    if (!current) return;

    // 高亮匹配文本
    let highlightedText = escapeHtml(current.textContent);
    // 从后往前替换，避免索引偏移问题
    const sortedMatches = [...current.matches].sort((a, b) => b.start - a.start);

    for (const m of sortedMatches) {
      const before = highlightedText.substring(0, m.start);
      const matched = highlightedText.substring(m.start, m.end);
      const after = highlightedText.substring(m.end);
      highlightedText = `${before}<mark class="csr-highlight">${matched}</mark>${after}`;
    }

    // 截取前后内容预览（太长的话）
    const previewHtml = `
      <div class="csr-result-item csr-result-active">
        <div class="csr-result-header">
          <span class="csr-result-role ${current.role}">${current.name}</span>
          <span class="csr-result-index">消息 #${current.index}</span>
        </div>
        <div class="csr-result-text">${highlightedText}</div>
      </div>
    `;

    $preview.html(previewHtml);

    // 滚动到对应消息（可选）
    scrollToMessage(current.index);
  }

  /**
   * 滚动到指定消息
   */
  function scrollToMessage(index) {
    const $chat = $("#chat");
    const $messages = $chat.find(".mes");
    if ($messages.length > index) {
      const $target = $messages.eq(index);
      $target[0].scrollIntoView({ behavior: "smooth", block: "center" });
      // 闪烁高亮
      $target.addClass("csr-flash");
      setTimeout(() => $target.removeClass("csr-flash"), 1500);
    }
  }

  /**
   * 替换当前匹配
   */
  async function replaceOne() {
    if (state.currentResultIndex < 0 || state.searchResults.length === 0) {
      toastr.warning("没有可替换的内容");
      return;
    }

    const replaceWith = $(`#${PANEL_ID}__replace`).val();
    const current = state.searchResults[state.currentResultIndex];

    // 获取原始消息
    let msgData;
    try {
      msgData = await ST_API.chatHistory.get({ index: current.index });
    } catch (err) {
      toastr.error("获取消息失败");
      return;
    }

    const msg = msgData.message;
    let newContent;

    // 构建新内容
    if (msg.parts && Array.isArray(msg.parts)) {
      // Gemini 格式：只替换 text 部分
      newContent = msg.parts.map((p) => {
        if (p.text) {
          return { ...p, text: replaceText(p.text, replaceWith) };
        }
        return p;
      });
    } else {
      // 纯文本
      newContent = replaceText(current.textContent, replaceWith);
    }

    // 更新消息
    try {
      await ST_API.chatHistory.update({
        index: current.index,
        content: newContent,
      });
      toastr.success(`已替换消息 #${current.index} 中的匹配内容`);

      // 刷新聊天界面
      await ST_API.ui.reloadChat();

      // 移除当前结果并继续
      state.searchResults.splice(state.currentResultIndex, 1);
      if (state.currentResultIndex >= state.searchResults.length) {
        state.currentResultIndex = Math.max(0, state.searchResults.length - 1);
      }
      updateResultsUI();
    } catch (err) {
      toastr.error("替换失败");
      console.error(`[${MODULE_NAME}]`, err);
    }
  }

  /**
   * 全部替换
   */
  async function replaceAll() {
    if (state.searchResults.length === 0) {
      toastr.warning("没有可替换的内容");
      return;
    }

    const replaceWith = $(`#${PANEL_ID}__replace`).val();
    let successCount = 0;
    let failCount = 0;

    // 从后往前替换，避免索引变化问题
    const sortedResults = [...state.searchResults].sort(
      (a, b) => b.index - a.index
    );

    for (const result of sortedResults) {
      try {
        const msgData = await ST_API.chatHistory.get({ index: result.index });
        const msg = msgData.message;
        let newContent;

        if (msg.parts && Array.isArray(msg.parts)) {
          newContent = msg.parts.map((p) => {
            if (p.text) {
              return { ...p, text: replaceText(p.text, replaceWith) };
            }
            return p;
          });
        } else {
          newContent = replaceText(result.textContent, replaceWith);
        }

        await ST_API.chatHistory.update({
          index: result.index,
          content: newContent,
        });
        successCount++;
      } catch (err) {
        failCount++;
        console.error(`[${MODULE_NAME}] 替换消息 #${result.index} 失败:`, err);
      }
    }

    // 刷新聊天界面
    await ST_API.ui.reloadChat();

    // 清空结果
    state.searchResults = [];
    state.currentResultIndex = -1;
    updateResultsUI();

    if (failCount === 0) {
      toastr.success(`成功替换 ${successCount} 条消息`);
    } else {
      toastr.warning(`替换完成：成功 ${successCount}，失败 ${failCount}`);
    }
  }

  /**
   * 替换文本工具函数
   */
  function replaceText(text, replaceWith) {
    const searchInput = $(`#${PANEL_ID}__search`).val();
    let regex;

    if (state.isRegex) {
      const flags = state.caseSensitive ? "g" : "gi";
      regex = new RegExp(searchInput, flags);
    } else {
      const escaped = searchInput.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const flags = state.caseSensitive ? "g" : "gi";
      regex = new RegExp(escaped, flags);
    }

    return text.replace(regex, replaceWith);
  }

  /**
   * HTML 转义
   */
  function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * 导航到上一个结果
   */
  function goToPrev() {
    if (state.searchResults.length === 0) return;
    state.currentResultIndex =
      (state.currentResultIndex - 1 + state.searchResults.length) %
      state.searchResults.length;
    updateResultsUI();
  }

  /**
   * 导航到下一个结果
   */
  function goToNext() {
    if (state.searchResults.length === 0) return;
    state.currentResultIndex =
      (state.currentResultIndex + 1) % state.searchResults.length;
    updateResultsUI();
  }

  /**
   * 清除搜索
   */
  function clearSearch() {
    state.searchResults = [];
    state.currentResultIndex = -1;
    $(`#${PANEL_ID}__search`).val("");
    $(`#${PANEL_ID}__replace`).val("");
    $(`#${PANEL_ID}__preview`).html(
      '<p class="csr-placeholder">输入关键词后点击搜索</p>'
    );
    $(`#${PANEL_ID}__result-info`).text("0 / 0");
  }

  /**
   * 绑定事件
   */
  function bindEvents() {
    // 搜索按钮
    $(`#${PANEL_ID}__btn-search`).on("click", doSearch);

    // 回车搜索
    $(`#${PANEL_ID}__search`).on("keydown", (e) => {
      if (e.key === "Enter") doSearch();
    });

    // 替换按钮
    $(`#${PANEL_ID}__btn-replace-one`).on("click", replaceOne);
    $(`#${PANEL_ID}__btn-replace-all`).on("click", replaceAll);

    // 导航按钮
    $(`#${PANEL_ID}__btn-prev`).on("click", goToPrev);
    $(`#${PANEL_ID}__btn-next`).on("click", goToNext);
    $(`#${PANEL_ID}__btn-clear`).on("click", clearSearch);
  }

  /**
   * 注册设置面板
   */
  async function registerPanel() {
    try {
      await ST_API.ui.registerSettingsPanel({
        id: `${PANEL_ID}.settings`,
        title: "🔍 搜索与替换",
        target: "left", // 放在左侧扩展栏
        expanded: false,
        content: {
          kind: "html",
          html: buildPanelHTML(),
        },
      });

      bindEvents();
      console.log(`[${MODULE_NAME}] 面板注册成功`);
    } catch (err) {
      console.error(`[${MODULE_NAME}] 面板注册失败:`, err);
    }
  }

  // 等待 APP_READY 再初始化
  eventSource.on(event_types.APP_READY, () => {
    registerPanel();
  });

  // 聊天切换时清空搜索结果
  eventSource.on(event_types.CHAT_CHANGED, () => {
    clearSearch();
  });
})();
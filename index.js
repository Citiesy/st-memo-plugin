(function () {
  const MODULE_NAME = "st-memo-plugin";
  const PANEL_ID = "st-memo-drawer";
  const STORAGE_KEY = "st_memo_plugin_data";

  const ctx = SillyTavern.getContext();
  const { eventSource, event_types, registerSlashCommand } = ctx;

  // ============ 数据管理 ============
  function normalizeMemos(data) {
    let memos = [];
    if (Array.isArray(data)) {
      memos = data;
    } else if (data && typeof data === "object") {
      if (Array.isArray(data.memos)) {
        memos = data.memos;
      } else {
        memos = Object.values(data);
      }
    }

    return memos
      .map((memo, index) => {
        if (!memo || typeof memo !== "object") return null;
        const title = typeof memo.title === "string" ? memo.title.trim() : String(memo.title ?? "").trim();
        const content = typeof memo.content === "string" ? memo.content.trim() : String(memo.content ?? "").trim();
        if (!title && !content) return null;

        return {
          id: Number.isFinite(memo.id) ? memo.id : Date.now() + index,
          title: title || `未命名-${index + 1}`,
          content,
          updatedAt: typeof memo.updatedAt === "string" ? memo.updatedAt : memo.updatedAt ? String(memo.updatedAt) : "",
        };
      })
      .filter(Boolean);
  }

  function loadMemos() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (!data) return [];
      const parsed = JSON.parse(data);
      const normalized = normalizeMemos(parsed);
      if (!Array.isArray(parsed) || parsed.length !== normalized.length) {
        saveMemos(normalized);
      }
      return normalized;
    } catch (e) {
      console.error(`[${MODULE_NAME}] 加载失败:`, e);
      return [];
    }
  }

  function saveMemos(memos) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(memos));
  }

  function addMemo(title, content) {
    const memos = loadMemos();
    memos.unshift({
      id: Date.now(),
      title: title.trim(),
      content: content.trim(),
      updatedAt: new Date().toLocaleString(),
    });
    saveMemos(memos);
  }

  function updateMemo(id, title, content) {
    const memos = loadMemos();
    const memo = memos.find((m) => m.id === id);
    if (memo) {
      memo.title = title.trim();
      memo.content = content.trim();
      memo.updatedAt = new Date().toLocaleString();
      saveMemos(memos);
    }
  }

  function deleteMemo(id) {
    const memos = loadMemos().filter((m) => m.id !== id);
    saveMemos(memos);
  }

  function getMemoByTitle(title) {
    return loadMemos().find(
      (m) => m.title.toLowerCase() === title.trim().toLowerCase()
    );
  }

  // ============ 斜杠命令 ============
  function registerCommands() {
    registerSlashCommand(
      "memo-open",
      () => {
        openDrawer();
        return "";
      },
      [],
      "- 打开备忘录面板",
      false,
      true
    );

    registerSlashCommand(
      "memo-close",
      () => {
        closeDrawer();
        return "";
      },
      [],
      "- 关闭备忘录面板",
      false,
      true
    );

    registerSlashCommand(
      "memo",
      (args, value) => {
        const title = value?.trim();
        if (!title) {
          toastr.warning("用法: /memo 标题名");
          return "";
        }
        const memo = getMemoByTitle(title);
        if (!memo) {
          toastr.error(`找不到备忘录: ${title}`);
          return "";
        }
        toastr.success(`已插入: ${memo.title}`);
        return memo.content;
      },
      [],
      "<标题> - 插入备忘录内容",
      true,
      true
    );

    registerSlashCommand(
      "memo-list",
      () => {
        const memos = loadMemos();
        if (memos.length === 0) {
          toastr.info("暂无备忘录");
        } else {
          toastr.info(`备忘录列表: ${memos.map((m) => `• ${m.title}`).join(", ")}`, "", { timeOut: 8000 });
        }
        return "";
      },
      [],
      "- 列出所有备忘录",
      false,
      true
    );

    registerSlashCommand(
      "memo-add",
      (args, value) => {
        const parts = value?.split("::");
        if (!parts || parts.length < 2) {
          toastr.warning("用法: /memo-add 标题::内容");
          return "";
        }
        const title = parts[0].trim();
        const content = parts.slice(1).join("::").trim();
        if (!title || !content) {
          toastr.warning("标题和内容不能为空");
          return "";
        }
        if (getMemoByTitle(title)) {
          toastr.warning("已存在同名备忘录");
          return "";
        }
        addMemo(title, content);
        toastr.success(`已添加: ${title}`);
        return "";
      },
      [],
      "<标题::内容> - 添加备忘录",
      false,
      true
    );

    registerSlashCommand(
      "memo-del",
      (args, value) => {
        const title = value?.trim();
        if (!title) {
          toastr.warning("用法: /memo-del 标题");
          return "";
        }
        const memo = getMemoByTitle(title);
        if (!memo) {
          toastr.error(`找不到: ${title}`);
          return "";
        }
        deleteMemo(memo.id);
        toastr.success(`已删除: ${title}`);
        return "";
      },
      [],
      "<标题> - 删除备忘录",
      false,
      true
    );

    console.log(`[${MODULE_NAME}] 命令已注册`);
  }

  // ============ UI ============
  function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  function insertToTextarea(text) {
    const textarea = document.getElementById("send_textarea");
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      textarea.value = textarea.value.substring(0, start) + text + textarea.value.substring(end);
      textarea.selectionStart = textarea.selectionEnd = start + text.length;
      textarea.focus();
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
    }
  }

  function openDrawer() {
    let drawer = document.getElementById(PANEL_ID);
    if (!drawer) {
      createDrawer();
      drawer = document.getElementById(PANEL_ID);
    }
    if (drawer) {
      drawer.style.display = "flex";
      drawer.classList.add("open");
      setTimeout(() => renderMemoList(), 50);
    }
  }

  function closeDrawer() {
    const drawer = document.getElementById(PANEL_ID);
    if (drawer) {
      drawer.classList.remove("open");
      setTimeout(() => { drawer.style.display = "none"; }, 300);
    }
  }

  function renderMemoList() {
    const listEl = document.getElementById("memo-list-container");
    if (!listEl) {
      console.error(`[${MODULE_NAME}] 找不到列表容器`);
      return;
    }

    const memos = loadMemos();
    console.log(`[${MODULE_NAME}] 渲染 ${memos.length} 条备忘录`);

    if (memos.length === 0) {
      listEl.innerHTML = `
        <div style="text-align:center;padding:40px 20px;color:#888;">
          <div style="font-size:2em;margin-bottom:10px;">📝</div>
          <div>暂无备忘录</div>
          <div style="margin-top:8px;font-size:0.85em;opacity:0.7;">
            点击上方「+ 添加」按钮<br>或使用 /memo-add 标题::内容
          </div>
        </div>
      `;
      return;
    }

    let html = "";
    memos.forEach((memo) => {
      const memoContent = memo.content ?? "";
      const preview = memoContent.length > 60 ? memoContent.substring(0, 60) + "..." : memoContent;
      html += `
        <div class="memo-card" data-id="${memo.id}">
          <div class="memo-card-top">
            <span class="memo-card-title">${escapeHtml(memo.title)}</span>
            <div class="memo-card-btns">
              <button class="memo-act-btn act-insert" title="插入">📥</button>
              <button class="memo-act-btn act-edit" title="编辑">✏️</button>
              <button class="memo-act-btn act-copy" title="复制">📋</button>
              <button class="memo-act-btn act-del" title="删除">🗑️</button>
            </div>
          </div>
          <div class="memo-card-body">${escapeHtml(preview)}</div>
          <div class="memo-card-time">${memo.updatedAt || ""}</div>
        </div>
      `;
    });

    listEl.innerHTML = html;

    // 绑定事件
    listEl.querySelectorAll(".memo-card").forEach((card) => {
      const id = parseInt(card.dataset.id, 10);
      const memo = memos.find((m) => m.id === id);
      if (!memo) return;

      card.querySelector(".act-insert")?.addEventListener("click", (e) => {
        e.stopPropagation();
        insertToTextarea(memo.content);
        toastr.success(`已插入: ${memo.title}`);
        closeDrawer();
      });

      card.querySelector(".act-edit")?.addEventListener("click", (e) => {
        e.stopPropagation();
        showEditForm(memo);
      });

      card.querySelector(".act-copy")?.addEventListener("click", (e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(memo.content);
        toastr.success("已复制");
      });

      card.querySelector(".act-del")?.addEventListener("click", (e) => {
        e.stopPropagation();
        if (confirm(`删除「${memo.title}」？`)) {
          deleteMemo(id);
          renderMemoList();
          toastr.info("已删除");
        }
      });

      card.addEventListener("click", () => {
        const body = card.querySelector(".memo-card-body");
        const isExpanded = card.classList.toggle("expanded");
        const memoContent = memo.content ?? "";
        body.textContent = isExpanded ? memoContent : (memoContent.length > 60 ? memoContent.substring(0, 60) + "..." : memoContent);
      });
    });
  }

  function showEditForm(memo = null) {
    const form = document.getElementById("memo-edit-form");
    const titleInput = document.getElementById("memo-input-title");
    const contentInput = document.getElementById("memo-input-content");
    const submitBtn = document.getElementById("memo-submit-btn");

    if (!form) return;

    if (memo) {
      titleInput.value = memo.title;
      contentInput.value = memo.content;
      submitBtn.textContent = "💾 保存";
      submitBtn.dataset.editId = memo.id;
    } else {
      titleInput.value = "";
      contentInput.value = "";
      submitBtn.textContent = "✅ 添加";
      delete submitBtn.dataset.editId;
    }

    form.style.display = "flex";
    titleInput.focus();
  }

  function hideEditForm() {
    const form = document.getElementById("memo-edit-form");
    if (form) form.style.display = "none";
  }

  function createDrawer() {
    if (document.getElementById(PANEL_ID)) return;

    const html = `
      <div id="${PANEL_ID}" class="memo-drawer">
        <div class="memo-header">
          <span>📝 备忘录</span>
          <button id="memo-close-btn">✕</button>
        </div>

        <div id="memo-edit-form" class="memo-form" style="display:none;">
          <input type="text" id="memo-input-title" class="text_pole" placeholder="标题" maxlength="50">
          <textarea id="memo-input-content" class="text_pole" placeholder="内容..." rows="4"></textarea>
          <div class="memo-form-btns">
            <button id="memo-cancel-btn" class="menu_button">取消</button>
            <button id="memo-submit-btn" class="menu_button">✅ 添加</button>
          </div>
        </div>

        <button id="memo-add-btn" class="menu_button" style="width:100%;margin-bottom:10px;">+ 添加备忘录</button>

        <input type="text" id="memo-search" class="text_pole" placeholder="🔍 搜索..." style="margin-bottom:10px;">

        <div id="memo-list-container" class="memo-list"></div>

        <div class="memo-footer">
          <code>/memo 标题</code> 快速插入
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML("beforeend", html);

    // 绑定事件
    document.getElementById("memo-close-btn").addEventListener("click", closeDrawer);
    document.getElementById("memo-add-btn").addEventListener("click", () => showEditForm());
    document.getElementById("memo-cancel-btn").addEventListener("click", hideEditForm);

    document.getElementById("memo-submit-btn").addEventListener("click", () => {
      const titleInput = document.getElementById("memo-input-title");
      const contentInput = document.getElementById("memo-input-content");
      const submitBtn = document.getElementById("memo-submit-btn");

      const title = titleInput.value.trim();
      const content = contentInput.value.trim();

      if (!title || !content) {
        toastr.warning("标题和内容不能为空");
        return;
      }

      const editId = submitBtn.dataset.editId;
      if (editId) {
        updateMemo(parseInt(editId, 10), title, content);
        toastr.success("已更新");
      } else {
        if (getMemoByTitle(title)) {
          toastr.warning("标题已存在");
          return;
        }
        addMemo(title, content);
        toastr.success("已添加");
      }

      hideEditForm();
      renderMemoList();
    });

    // 搜索
    document.getElementById("memo-search").addEventListener("input", (e) => {
      const kw = e.target.value.trim().toLowerCase();
      document.querySelectorAll(".memo-card").forEach((card) => {
        const title = card.querySelector(".memo-card-title")?.textContent.toLowerCase() || "";
        const body = card.querySelector(".memo-card-body")?.textContent.toLowerCase() || "";
        card.style.display = (title.includes(kw) || body.includes(kw)) ? "" : "none";
      });
    });

    console.log(`[${MODULE_NAME}] 面板已创建`);
  }

  // ============ 初始化 ============
  function init() {
    registerCommands();
    console.log(`[${MODULE_NAME}] 已加载，使用 /memo-open 打开面板`);
  }

  if (eventSource && event_types?.APP_READY) {
    eventSource.on(event_types.APP_READY, init);
  } else {
    setTimeout(init, 2000);
  }
})();

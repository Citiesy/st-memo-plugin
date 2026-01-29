(function () {
  const MODULE_NAME = "st-memo-plugin";
  const PANEL_ID = "st-memo-drawer";
  const STORAGE_KEY = "st_memo_plugin_data";

  const ctx = SillyTavern.getContext();
  const { eventSource, event_types, registerSlashCommand } = ctx;

  // ============ 数据管理 ============
  function loadMemos() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : [];
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
    // /memo-open - 打开备忘录面板
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

    // /memo-close - 关闭备忘录面板
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

    // /memo 标题 - 插入备忘录内容
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
          const memos = loadMemos();
          if (memos.length > 0) {
            toastr.info(`可用: ${memos.map((m) => m.title).join(", ")}`);
          }
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

    // /memo-list - 列出所有备忘录
    registerSlashCommand(
      "memo-list",
      () => {
        const memos = loadMemos();
        if (memos.length === 0) {
          toastr.info("暂无备忘录");
        } else {
          toastr.info(
            `备忘录列表:\n${memos.map((m) => `• ${m.title}`).join("\n")}`,
            "",
            { timeOut: 8000 }
          );
        }
        return "";
      },
      [],
      "- 列出所有备忘录标题",
      false,
      true
    );

    // /memo-add 标题::内容 - 快速添加
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
      "<标题::内容> - 快速添加备忘录",
      false,
      true
    );

    // /memo-del 标题 - 删除备忘录
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
          toastr.error(`找不到备忘录: ${title}`);
          return "";
        }

        deleteMemo(memo.id);
        toastr.success(`已删除: ${title}`);
        return "";
      },
      [],
      "<标题> - 删除指定备忘录",
      false,
      true
    );

    console.log(`[${MODULE_NAME}] 命令已注册: /memo-open, /memo-close, /memo, /memo-list, /memo-add, /memo-del`);
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
      textarea.value =
        textarea.value.substring(0, start) +
        text +
        textarea.value.substring(end);
      textarea.selectionStart = textarea.selectionEnd = start + text.length;
      textarea.focus();
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
    }
  }

  function openDrawer() {
    const drawer = document.getElementById(PANEL_ID);
    if (drawer) {
      drawer.classList.add("open");
      renderMemoList();
    }
  }

  function closeDrawer() {
    const drawer = document.getElementById(PANEL_ID);
    if (drawer) {
      drawer.classList.remove("open");
    }
  }

  function renderMemoList() {
    const listEl = document.querySelector(`#${PANEL_ID} .memo-list`);
    if (!listEl) return;

    const memos = loadMemos();

    if (memos.length === 0) {
      listEl.innerHTML = `<div class="memo-empty">暂无备忘录<br><small>/memo-add 标题::内容</small></div>`;
      return;
    }

    listEl.innerHTML = memos
      .map(
        (memo) => `
      <div class="memo-item" data-id="${memo.id}">
        <div class="memo-item-header">
          <span class="memo-title">${escapeHtml(memo.title)}</span>
          <div class="memo-item-actions">
            <button class="memo-btn memo-insert" title="插入"><i class="fa-solid fa-arrow-right-to-bracket"></i></button>
            <button class="memo-btn memo-edit" title="编辑"><i class="fa-solid fa-pen"></i></button>
            <button class="memo-btn memo-copy" title="复制"><i class="fa-solid fa-copy"></i></button>
            <button class="memo-btn memo-delete" title="删除"><i class="fa-solid fa-trash"></i></button>
          </div>
        </div>
        <div class="memo-content-preview">${escapeHtml(
          memo.content.length > 80
            ? memo.content.substring(0, 80) + "..."
            : memo.content
        )}</div>
        <div class="memo-time">${memo.updatedAt}</div>
      </div>
    `
      )
      .join("");

    // 绑定事件
    listEl.querySelectorAll(".memo-item").forEach((item) => {
      const id = parseInt(item.dataset.id, 10);
      const memo = memos.find((m) => m.id === id);

      item.querySelector(".memo-insert")?.addEventListener("click", (e) => {
        e.stopPropagation();
        if (memo) {
          insertToTextarea(memo.content);
          toastr.success(`已插入: ${memo.title}`);
        }
      });

      item.querySelector(".memo-edit")?.addEventListener("click", (e) => {
        e.stopPropagation();
        openEditForm(id);
      });

      item.querySelector(".memo-copy")?.addEventListener("click", (e) => {
        e.stopPropagation();
        if (memo) {
          navigator.clipboard.writeText(memo.content);
          toastr.success("已复制");
        }
      });

      item.querySelector(".memo-delete")?.addEventListener("click", (e) => {
        e.stopPropagation();
        if (confirm(`删除「${memo?.title}」？`)) {
          deleteMemo(id);
          renderMemoList();
          toastr.info("已删除");
        }
      });

      item.addEventListener("click", () => {
        const preview = item.querySelector(".memo-content-preview");
        if (memo && preview) {
          const isExpanded = item.classList.toggle("expanded");
          preview.innerHTML = escapeHtml(
            isExpanded
              ? memo.content
              : memo.content.length > 80
              ? memo.content.substring(0, 80) + "..."
              : memo.content
          );
        }
      });
    });
  }

  function openEditForm(id = null) {
    const formEl = document.querySelector(`#${PANEL_ID} .memo-form`);
    const titleInput = document.querySelector(`#${PANEL_ID} .memo-form-title`);
    const contentInput = document.querySelector(`#${PANEL_ID} .memo-form-content`);
    const submitBtn = document.querySelector(`#${PANEL_ID} .memo-form-submit`);

    if (!formEl) return;

    if (id) {
      const memo = loadMemos().find((m) => m.id === id);
      if (memo) {
        titleInput.value = memo.title;
        contentInput.value = memo.content;
        submitBtn.textContent = "保存";
        submitBtn.dataset.editId = id;
      }
    } else {
      titleInput.value = "";
      contentInput.value = "";
      submitBtn.textContent = "添加";
      delete submitBtn.dataset.editId;
    }

    formEl.classList.add("show");
    titleInput.focus();
  }

  function closeEditForm() {
    const formEl = document.querySelector(`#${PANEL_ID} .memo-form`);
    if (formEl) formEl.classList.remove("show");
  }

  function createDrawer() {
    if (document.getElementById(PANEL_ID)) return;

    const html = `
      <div id="${PANEL_ID}" class="memo-drawer">
        <div class="memo-drawer-header">
          <h3><i class="fa-solid fa-note-sticky"></i> 备忘录</h3>
          <button class="memo-drawer-close"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div class="memo-drawer-body">
          <div class="memo-form">
            <input type="text" class="memo-form-title text_pole" placeholder="标题" maxlength="50">
            <textarea class="memo-form-content text_pole" placeholder="内容..." rows="3"></textarea>
            <div class="memo-form-actions">
              <button class="menu_button memo-form-cancel">取消</button>
              <button class="menu_button memo-form-submit">添加</button>
            </div>
          </div>
          <button class="menu_button memo-add-trigger"><i class="fa-solid fa-plus"></i> 添加</button>
          <input type="text" class="memo-search text_pole" placeholder="搜索...">
          <div class="memo-list"></div>
        </div>
        <div class="memo-drawer-footer">
          <small><code>/memo 标题</code> 快速插入</small>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML("beforeend", html);

    const drawer = document.getElementById(PANEL_ID);
    const closeBtn = drawer.querySelector(".memo-drawer-close");
    const addTrigger = drawer.querySelector(".memo-add-trigger");
    const submitBtn = drawer.querySelector(".memo-form-submit");
    const cancelBtn = drawer.querySelector(".memo-form-cancel");
    const searchInput = drawer.querySelector(".memo-search");
    const titleInput = drawer.querySelector(".memo-form-title");
    const contentInput = drawer.querySelector(".memo-form-content");

    closeBtn.addEventListener("click", closeDrawer);

    addTrigger.addEventListener("click", () => openEditForm());

    cancelBtn.addEventListener("click", closeEditForm);

    submitBtn.addEventListener("click", () => {
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

      closeEditForm();
      renderMemoList();
    });

    let timer;
    searchInput.addEventListener("input", () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const kw = searchInput.value.trim().toLowerCase();
        const items = drawer.querySelectorAll(".memo-item");
        items.forEach((item) => {
          const title = item.querySelector(".memo-title")?.textContent.toLowerCase() || "";
          const content = item.querySelector(".memo-content-preview")?.textContent.toLowerCase() || "";
          item.style.display = title.includes(kw) || content.includes(kw) ? "" : "none";
        });
      }, 200);
    });

    console.log(`[${MODULE_NAME}] 面板已创建`);
  }

  // ============ 初始化 ============
  function init() {
    createDrawer();
    registerCommands();
    console.log(`[${MODULE_NAME}] 已加载，输入 /memo-open 打开面板`);
  }

  if (eventSource && event_types?.APP_READY) {
    eventSource.on(event_types.APP_READY, init);
  } else {
    setTimeout(init, 2000);
  }
})();
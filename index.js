(function () {
  const MODULE_NAME = "st-memo-plugin";
  const PANEL_ID = "st-memo-drawer";
  const TOGGLE_ID = "st-memo-toggle";
  const STORAGE_KEY = "st_memo_plugin_data";

  const ctx = SillyTavern.getContext();
  const { eventSource, event_types, registerSlashCommand } = ctx;

  // ============ 数据管理 ============
  function loadMemos() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error(`[${MODULE_NAME}] 加载备忘录失败:`, e);
      return [];
    }
  }

  function saveMemos(memos) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(memos));
    } catch (e) {
      console.error(`[${MODULE_NAME}] 保存备忘录失败:`, e);
    }
  }

  function addMemo(title, content) {
    const memos = loadMemos();
    const newMemo = {
      id: Date.now(),
      title: title.trim(),
      content: content.trim(),
      createdAt: new Date().toLocaleString(),
      updatedAt: new Date().toLocaleString(),
    };
    memos.unshift(newMemo);
    saveMemos(memos);
    return newMemo;
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
    return memo;
  }

  function deleteMemo(id) {
    let memos = loadMemos();
    memos = memos.filter((m) => m.id !== id);
    saveMemos(memos);
  }

  function getMemoByTitle(title) {
    const memos = loadMemos();
    const searchTitle = title.trim().toLowerCase();
    return memos.find((m) => m.title.toLowerCase() === searchTitle);
  }

  function searchMemos(keyword) {
    const memos = loadMemos();
    const kw = keyword.trim().toLowerCase();
    return memos.filter(
      (m) =>
        m.title.toLowerCase().includes(kw) ||
        m.content.toLowerCase().includes(kw)
    );
  }

  // ============ 打开抽屉 ============
  function openDrawer() {
    const drawer = document.getElementById(PANEL_ID);
    if (drawer) {
      drawer.classList.add("open");
      renderMemoList();
      console.log(`[${MODULE_NAME}] 抽屉已打开`);
    } else {
      console.error(`[${MODULE_NAME}] 找不到抽屉元素`);
      // 尝试重新创建
      createDrawer();
      setTimeout(openDrawer, 100);
    }
  }

  function closeDrawer() {
    const drawer = document.getElementById(PANEL_ID);
    if (drawer) {
      drawer.classList.remove("open");
    }
  }

  // ============ 斜杠命令 ============
  function registerCommands() {
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
            const titles = memos.map((m) => m.title).join(", ");
            toastr.info(`可用备忘录: ${titles}`);
          }
          return "";
        }

        toastr.success(`已插入: ${memo.title}`);
        return memo.content;
      },
      [],
      "<标题> - 插入指定标题的备忘录内容",
      true,
      true
    );

    // /memo-list - 列出所有备忘录标题
    registerSlashCommand(
      "memo-list",
      () => {
        const memos = loadMemos();
        if (memos.length === 0) {
          toastr.info("暂无备忘录");
          return "";
        }
        const list = memos.map((m) => `• ${m.title}`).join("\n");
        toastr.info(`备忘录列表:\n${list}`, "", { timeOut: 5000 });
        return "";
      },
      [],
      "- 列出所有备忘录标题",
      false,
      true
    );

    // /memo-add 标题::内容 - 快速添加备忘录
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

        addMemo(title, content);
        toastr.success(`已添加备忘录: ${title}`);
        return "";
      },
      [],
      "<标题::内容> - 快速添加备忘录",
      false,
      true
    );

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

    console.log(`[${MODULE_NAME}] 斜杠命令已注册`);
  }

  // ============ UI 渲染 ============
  function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  function renderMemoList() {
    const listEl = document.querySelector(`#${PANEL_ID} .memo-list`);
    if (!listEl) return;

    const memos = loadMemos();

    if (memos.length === 0) {
      listEl.innerHTML = `<div class="memo-empty">暂无备忘录<br><small>点击上方添加</small></div>`;
      return;
    }

    listEl.innerHTML = memos
      .map(
        (memo) => `
      <div class="memo-item" data-id="${memo.id}">
        <div class="memo-item-header">
          <span class="memo-title">${escapeHtml(memo.title)}</span>
          <div class="memo-item-actions">
            <button class="memo-btn memo-insert" title="插入到输入框">
              <i class="fa-solid fa-arrow-right-to-bracket"></i>
            </button>
            <button class="memo-btn memo-edit" title="编辑">
              <i class="fa-solid fa-pen"></i>
            </button>
            <button class="memo-btn memo-copy" title="复制内容">
              <i class="fa-solid fa-copy"></i>
            </button>
            <button class="memo-btn memo-delete" title="删除">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
        </div>
        <div class="memo-content-preview">${escapeHtml(
          memo.content.length > 100
            ? memo.content.substring(0, 100) + "..."
            : memo.content
        )}</div>
        <div class="memo-time">${memo.updatedAt}</div>
      </div>
    `
      )
      .join("");

    bindMemoEvents(listEl, memos);
  }

  function bindMemoEvents(listEl, memos) {
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
          toastr.success("已复制内容");
        }
      });

      item.querySelector(".memo-delete")?.addEventListener("click", (e) => {
        e.stopPropagation();
        if (confirm(`确定删除「${memo?.title}」吗？`)) {
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
              : memo.content.length > 100
              ? memo.content.substring(0, 100) + "..."
              : memo.content
          );
        }
      });
    });
  }

  function insertToTextarea(text) {
    const textarea = document.getElementById("send_textarea");
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const before = textarea.value.substring(0, start);
      const after = textarea.value.substring(end);
      textarea.value = before + text + after;
      textarea.selectionStart = textarea.selectionEnd = start + text.length;
      textarea.focus();
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
    }
  }

  function openEditForm(id = null) {
    const formEl = document.querySelector(`#${PANEL_ID} .memo-form`);
    const titleInput = document.querySelector(`#${PANEL_ID} .memo-form-title`);
    const contentInput = document.querySelector(`#${PANEL_ID} .memo-form-content`);
    const submitBtn = document.querySelector(`#${PANEL_ID} .memo-form-submit`);
    const cancelBtn = document.querySelector(`#${PANEL_ID} .memo-form-cancel`);

    if (!formEl || !titleInput || !contentInput || !submitBtn) return;

    if (id) {
      const memos = loadMemos();
      const memo = memos.find((m) => m.id === id);
      if (memo) {
        titleInput.value = memo.title;
        contentInput.value = memo.content;
        submitBtn.textContent = "保存修改";
        submitBtn.dataset.editId = id;
      }
    } else {
      titleInput.value = "";
      contentInput.value = "";
      submitBtn.textContent = "添加备忘";
      delete submitBtn.dataset.editId;
    }

    formEl.classList.add("show");
    cancelBtn.classList.add("show");
    titleInput.focus();
  }

  function closeEditForm() {
    const formEl = document.querySelector(`#${PANEL_ID} .memo-form`);
    const cancelBtn = document.querySelector(`#${PANEL_ID} .memo-form-cancel`);
    if (formEl) formEl.classList.remove("show");
    if (cancelBtn) cancelBtn.classList.remove("show");
  }

  // ============ 创建抽屉面板 ============
  function createDrawer() {
    if (document.getElementById(PANEL_ID)) return;

    const toggleHtml = `
      <div id="${TOGGLE_ID}" class="memo-toggle" title="备忘录">
        <span>备</span>
        <span>忘</span>
        <span>录</span>
      </div>
    `;

    const drawerHtml = `
      <div id="${PANEL_ID}" class="memo-drawer">
        <div class="memo-drawer-header">
          <h3><i class="fa-solid fa-note-sticky"></i> 备忘录</h3>
          <button class="memo-drawer-close" title="关闭">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>

        <div class="memo-drawer-body">
          <div class="memo-form">
            <input type="text" class="memo-form-title text_pole" placeholder="标题（用于 /memo 标题 快速插入）" maxlength="50">
            <textarea class="memo-form-content text_pole" placeholder="内容..." rows="4"></textarea>
            <div class="memo-form-actions">
              <button class="menu_button memo-form-cancel">取消</button>
              <button class="menu_button memo-form-submit">添加备忘</button>
            </div>
          </div>

          <button class="menu_button memo-add-trigger">
            <i class="fa-solid fa-plus"></i> 添加备忘录
          </button>

          <div class="memo-search">
            <input type="text" class="memo-search-input text_pole" placeholder="搜索备忘录...">
          </div>

          <div class="memo-list"></div>
        </div>

        <div class="memo-drawer-footer">
          <small>提示: 输入 <code>/memo 标题</code> 快速插入内容</small>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML("beforeend", toggleHtml);
    document.body.insertAdjacentHTML("beforeend", drawerHtml);

    const toggle = document.getElementById(TOGGLE_ID);
    const drawer = document.getElementById(PANEL_ID);
    const closeBtn = drawer.querySelector(".memo-drawer-close");
    const addTrigger = drawer.querySelector(".memo-add-trigger");
    const submitBtn = drawer.querySelector(".memo-form-submit");
    const cancelBtn = drawer.querySelector(".memo-form-cancel");
    const searchInput = drawer.querySelector(".memo-search-input");

    toggle.addEventListener("click", () => {
      if (drawer.classList.contains("open")) {
        closeDrawer();
      } else {
        openDrawer();
      }
    });

    closeBtn.addEventListener("click", closeDrawer);

    document.addEventListener("click", (e) => {
      if (
        drawer.classList.contains("open") &&
        !drawer.contains(e.target) &&
        !toggle.contains(e.target)
      ) {
        closeDrawer();
      }
    });

    addTrigger.addEventListener("click", () => {
      openEditForm();
    });

    cancelBtn.addEventListener("click", () => {
      closeEditForm();
    });

    submitBtn.addEventListener("click", () => {
      const titleInput = drawer.querySelector(".memo-form-title");
      const contentInput = drawer.querySelector(".memo-form-content");
      const title = titleInput.value.trim();
      const content = contentInput.value.trim();

      if (!title) {
        toastr.warning("请输入标题");
        titleInput.focus();
        return;
      }
      if (!content) {
        toastr.warning("请输入内容");
        contentInput.focus();
        return;
      }

      const editId = submitBtn.dataset.editId;
      if (editId) {
        updateMemo(parseInt(editId, 10), title, content);
        toastr.success("已更新备忘录");
        delete submitBtn.dataset.editId;
      } else {
        if (getMemoByTitle(title)) {
          toastr.warning("已存在同名备忘录，请更换标题");
          titleInput.focus();
          return;
        }
        addMemo(title, content);
        toastr.success("已添加备忘录");
      }

      titleInput.value = "";
      contentInput.value = "";
      closeEditForm();
      renderMemoList();
    });

    let searchTimer;
    searchInput.addEventListener("input", () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        const keyword = searchInput.value.trim();
        if (keyword) {
          renderFilteredList(keyword);
        } else {
          renderMemoList();
        }
      }, 300);
    });

    console.log(`[${MODULE_NAME}] 抽屉面板已创建`);
  }

  function renderFilteredList(keyword) {
    const listEl = document.querySelector(`#${PANEL_ID} .memo-list`);
    if (!listEl) return;

    const filtered = searchMemos(keyword);

    if (filtered.length === 0) {
      listEl.innerHTML = `<div class="memo-empty">未找到匹配的备忘录</div>`;
      return;
    }

    listEl.innerHTML = filtered
      .map(
        (memo) => `
      <div class="memo-item" data-id="${memo.id}">
        <div class="memo-item-header">
          <span class="memo-title">${escapeHtml(memo.title)}</span>
          <div class="memo-item-actions">
            <button class="memo-btn memo-insert" title="插入到输入框">
              <i class="fa-solid fa-arrow-right-to-bracket"></i>
            </button>
            <button class="memo-btn memo-copy" title="复制内容">
              <i class="fa-solid fa-copy"></i>
            </button>
          </div>
        </div>
        <div class="memo-content-preview">${escapeHtml(
          memo.content.length > 100
            ? memo.content.substring(0, 100) + "..."
            : memo.content
        )}</div>
      </div>
    `
      )
      .join("");

    listEl.querySelectorAll(".memo-item").forEach((item) => {
      const id = parseInt(item.dataset.id, 10);
      const memo = filtered.find((m) => m.id === id);

      item.querySelector(".memo-insert")?.addEventListener("click", (e) => {
        e.stopPropagation();
        if (memo) {
          insertToTextarea(memo.content);
          toastr.success(`已插入: ${memo.title}`);
        }
      });

      item.querySelector(".memo-copy")?.addEventListener("click", (e) => {
        e.stopPropagation();
        if (memo) {
          navigator.clipboard.writeText(memo.content);
          toastr.success("已复制内容");
        }
      });
    });
  }

  // ============ 注册扩展菜单（修复版） ============
  function registerMenu() {
    // 方案1：使用 ST_API
    if (window.ST_API?.ui?.registerExtensionsMenuItem) {
      window.ST_API.ui.registerExtensionsMenuItem({
        id: "st-memo-plugin.open",
        label: "备忘录",
        icon: "fa-solid fa-note-sticky",
        onClick: () => {
          console.log(`[${MODULE_NAME}] 魔棒菜单点击`);
          // 先关闭扩展菜单
          const extMenu = document.getElementById("extensionsMenu");
          if (extMenu) {
            extMenu.classList.remove("openDrawer");
          }
          // 延迟打开备忘录
          setTimeout(() => {
            openDrawer();
          }, 100);
        },
      }).then(() => {
        console.log(`[${MODULE_NAME}] ST_API 菜单注册成功`);
      }).catch((e) => {
        console.error(`[${MODULE_NAME}] ST_API 菜单注册失败:`, e);
        fallbackRegister();
      });
    } else {
      // 方案2：直接操作 DOM
      fallbackRegister();
    }
  }

  function fallbackRegister() {
    const menu = document.getElementById("extensionsMenu");
    if (!menu) {
      console.warn(`[${MODULE_NAME}] 找不到扩展菜单，延迟重试`);
      setTimeout(fallbackRegister, 1000);
      return;
    }

    const itemId = "st-memo-plugin-menu-item";
    if (document.getElementById(itemId)) return;

    const menuItem = document.createElement("div");
    menuItem.id = itemId;
    menuItem.className = "list-group-item flex-container flexGap5";
    menuItem.style.cursor = "pointer";
    menuItem.innerHTML = `
      <i class="fa-solid fa-note-sticky extensionsMenuExtensionButton"></i>
      <span>备忘录</span>
    `;

    menuItem.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      console.log(`[${MODULE_NAME}] Fallback 菜单点击`);
      
      // 关闭扩展菜单
      menu.classList.remove("openDrawer");
      
      // 打开备忘录
      setTimeout(() => {
        openDrawer();
      }, 150);
    });

    menu.appendChild(menuItem);
    console.log(`[${MODULE_NAME}] Fallback 菜单注册成功`);
  }

  // ============ 初始化 ============
  function init() {
    console.log(`[${MODULE_NAME}] 开始初始化...`);
    createDrawer();
    registerCommands();
    registerMenu();
    console.log(`[${MODULE_NAME}] 插件已加载`);
    console.log(`[${MODULE_NAME}] 可用命令: /memo, /memo-list, /memo-add, /memo-open`);
  }

  if (eventSource && event_types?.APP_READY) {
    eventSource.on(event_types.APP_READY, init);
  } else {
    setTimeout(init, 2000);
  }
})();
(function () {
  const MODULE_NAME = "st-memo-plugin";
  const PANEL_ID = "st-memo-panel";
  const STORAGE_KEY = "st_memo_plugin_data";

  const ctx = SillyTavern.getContext();
  const { eventSource, event_types } = ctx;

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

  function addMemo(content) {
    const memos = loadMemos();
    const newMemo = {
      id: Date.now(),
      content: content.trim(),
      createdAt: new Date().toLocaleString(),
      updatedAt: new Date().toLocaleString(),
    };
    memos.unshift(newMemo);
    saveMemos(memos);
    return newMemo;
  }

  function updateMemo(id, content) {
    const memos = loadMemos();
    const memo = memos.find((m) => m.id === id);
    if (memo) {
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

  // ============ UI 渲染 ============
  function renderMemoList(container) {
    const memos = loadMemos();
    const listEl = container.querySelector(".memo-list");
    if (!listEl) return;

    if (memos.length === 0) {
      listEl.innerHTML = `<div class="memo-empty">暂无备忘录，点击上方添加</div>`;
      return;
    }

    listEl.innerHTML = memos
      .map(
        (memo) => `
      <div class="memo-item" data-id="${memo.id}">
        <div class="memo-content">${escapeHtml(memo.content)}</div>
        <div class="memo-meta">
          <span class="memo-time">${memo.updatedAt}</span>
          <div class="memo-actions">
            <button class="memo-btn memo-edit" title="编辑">
              <i class="fa-solid fa-pen"></i>
            </button>
            <button class="memo-btn memo-copy" title="复制">
              <i class="fa-solid fa-copy"></i>
            </button>
            <button class="memo-btn memo-delete" title="删除">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
        </div>
      </div>
    `
      )
      .join("");

    // 绑定事件
    listEl.querySelectorAll(".memo-item").forEach((item) => {
      const id = parseInt(item.dataset.id, 10);

      item.querySelector(".memo-edit")?.addEventListener("click", (e) => {
        e.stopPropagation();
        openEditDialog(id, container);
      });

      item.querySelector(".memo-copy")?.addEventListener("click", (e) => {
        e.stopPropagation();
        const memo = loadMemos().find((m) => m.id === id);
        if (memo) {
          navigator.clipboard.writeText(memo.content);
          toastr.success("已复制到剪贴板");
        }
      });

      item.querySelector(".memo-delete")?.addEventListener("click", (e) => {
        e.stopPropagation();
        if (confirm("确定删除这条备忘录吗？")) {
          deleteMemo(id);
          renderMemoList(container);
          toastr.info("已删除");
        }
      });
    });
  }

  function openEditDialog(id, container) {
    const memos = loadMemos();
    const memo = memos.find((m) => m.id === id);
    if (!memo) return;

    const textarea = container.querySelector(".memo-input");
    const addBtn = container.querySelector(".memo-add-btn");

    if (textarea && addBtn) {
      textarea.value = memo.content;
      textarea.focus();
      addBtn.textContent = "保存修改";
      addBtn.dataset.editId = id;
    }
  }

  function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML.replace(/\n/g, "<br>");
  }

  // ============ 弹窗面板 ============
  function createPanel() {
    if (document.getElementById(PANEL_ID)) return;

    const panelHtml = `
      <div id="${PANEL_ID}" class="memo-panel">
        <div class="memo-panel-backdrop"></div>
        <div class="memo-panel-content">
          <div class="memo-panel-header">
            <h3><i class="fa-solid fa-note-sticky"></i> 备忘录</h3>
            <button class="memo-panel-close" title="关闭">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>
          <div class="memo-panel-body">
            <div class="memo-input-area">
              <textarea class="memo-input text_pole" placeholder="输入备忘内容..." rows="3"></textarea>
              <button class="menu_button memo-add-btn">添加备忘</button>
            </div>
            <div class="memo-list"></div>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML("beforeend", panelHtml);

    const panel = document.getElementById(PANEL_ID);
    const backdrop = panel.querySelector(".memo-panel-backdrop");
    const closeBtn = panel.querySelector(".memo-panel-close");
    const addBtn = panel.querySelector(".memo-add-btn");
    const textarea = panel.querySelector(".memo-input");

    // 关闭面板
    const closePanel = () => {
      panel.classList.remove("show");
      textarea.value = "";
      addBtn.textContent = "添加备忘";
      delete addBtn.dataset.editId;
    };

    backdrop.addEventListener("click", closePanel);
    closeBtn.addEventListener("click", closePanel);

    // ESC 关闭
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && panel.classList.contains("show")) {
        closePanel();
      }
    });

    // 添加/编辑备忘
    addBtn.addEventListener("click", () => {
      const content = textarea.value.trim();
      if (!content) {
        toastr.warning("请输入备忘内容");
        return;
      }

      const editId = addBtn.dataset.editId;
      if (editId) {
        updateMemo(parseInt(editId, 10), content);
        toastr.success("已更新备忘");
        delete addBtn.dataset.editId;
        addBtn.textContent = "添加备忘";
      } else {
        addMemo(content);
        toastr.success("已添加备忘");
      }

      textarea.value = "";
      renderMemoList(panel);
    });

    // Ctrl+Enter 快捷添加
    textarea.addEventListener("keydown", (e) => {
      if (e.ctrlKey && e.key === "Enter") {
        addBtn.click();
      }
    });

    console.log(`[${MODULE_NAME}] 面板已创建`);
  }

  function showPanel() {
    const panel = document.getElementById(PANEL_ID);
    if (!panel) {
      createPanel();
    }
    const panelEl = document.getElementById(PANEL_ID);
    panelEl.classList.add("show");
    renderMemoList(panelEl);
  }

  // ============ 注册菜单 ============
  async function registerMenu() {
    if (!window.ST_API?.ui?.registerExtensionsMenuItem) {
      console.warn(`[${MODULE_NAME}] ST_API 未加载，使用备用方案`);
      fallbackRegister();
      return;
    }

    try {
      await window.ST_API.ui.registerExtensionsMenuItem({
        id: "st-memo-plugin.open",
        label: "备忘录",
        icon: "fa-solid fa-note-sticky",
        onClick: () => {
          showPanel();
        },
      });
      console.log(`[${MODULE_NAME}] 菜单项已注册`);
    } catch (e) {
      console.error(`[${MODULE_NAME}] 注册菜单失败:`, e);
      fallbackRegister();
    }
  }

  // 备用方案：直接操作 DOM
  function fallbackRegister() {
    const menu = document.getElementById("extensionsMenu");
    if (!menu) {
      console.warn(`[${MODULE_NAME}] 找不到扩展菜单`);
      return;
    }

    const itemId = "st-memo-plugin-menu-item";
    if (document.getElementById(itemId)) return;

    const menuItem = document.createElement("div");
    menuItem.id = itemId;
    menuItem.className = "list-group-item flex-container flexGap5";
    menuItem.innerHTML = `
      <i class="fa-solid fa-note-sticky extensionsMenuExtensionButton"></i>
      备忘录
    `;
    menuItem.addEventListener("click", () => {
      showPanel();
      // 关闭扩展菜单
      document.getElementById("extensionsMenu")?.classList.remove("openDrawer");
    });

    menu.appendChild(menuItem);
    console.log(`[${MODULE_NAME}] 菜单项已注册 (fallback)`);
  }

  // ============ 初始化 ============
  function init() {
    createPanel();
    registerMenu();
    console.log(`[${MODULE_NAME}] 插件已加载`);
  }

  if (eventSource && event_types?.APP_READY) {
    eventSource.on(event_types.APP_READY, init);
  } else {
    // 备用：延迟加载
    setTimeout(init, 2000);
  }
})();
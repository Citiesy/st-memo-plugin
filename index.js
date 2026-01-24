/**
 * 绑定事件
 */
function bindEvents() {
  // 1. 关键修复：阻止输入框的按键事件冒泡
  // 这样酒馆的全局快捷键就不会拦截你的输入了
  $(`#${PANEL_ID}__search, #${PANEL_ID}__replace`).on("keydown keyup keypress input", (e) => {
    // 允许回车键触发搜索，但依然要阻止冒泡
    if (e.key === "Enter" && e.type === "keydown" && e.target.id.includes("search")) {
      doSearch();
    }
    e.stopPropagation();
  });

  // 关闭按钮
  $(`#${PANEL_ID}__close`).on("click", closePanel);
  
  // 搜索按钮
  $(`#${PANEL_ID}__btn-search`).on("click", doSearch);

  // 替换按钮
  $(`#${PANEL_ID}__btn-replace-one`).on("click", replaceOne);
  $(`#${PANEL_ID}__btn-replace-all`).on("click", replaceAll);

  // 导航按钮
  $(`#${PANEL_ID}__btn-prev`).on("click", goToPrev);
  $(`#${PANEL_ID}__btn-next`).on("click", goToNext);
  $(`#${PANEL_ID}__btn-clear`).on("click", clearSearch);
}
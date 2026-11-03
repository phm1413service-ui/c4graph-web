// ==========================================
// PanelSelectionManager.js
// パネルの選択（クリック）を担当
// ==========================================

window.PanelSelectionManager = (function () {

  function attach(panel, index) {
    if (!panel) return;

    const title = panel.querySelector('.chart-title');
    const settingsIcon = panel.querySelector('.settings-icon');

    // ===== タイトルクリックで選択 =====
    if (title) {
      title.addEventListener('click', e => {
        // 設定アイコンをクリックした場合は選択処理を発火させない
        if (e.target.closest(".settings-icon")) return;

        if (typeof selectChart === 'function') {
          selectChart(index, e);
        }
      });
    }

    // ===== 設定アイコン（⚙️）クリック =====
    if (settingsIcon) {
      settingsIcon.addEventListener('click', e => {
        e.stopPropagation(); // タイトルクリック扱いにしない

        if (typeof openYAxisDialog === 'function') {
          openYAxisDialog(index);
        }
      });
    }
  }

  return { attach };
})();
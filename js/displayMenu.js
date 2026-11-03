// ===============================
// displayMenu.js
// 表示メニュー（Display Menu）
// ===============================

// ▼ 表示メニューの開閉
document.getElementById("btnDisplayMenu").addEventListener("click", (e) => {
  e.stopPropagation();

  const menu = document.getElementById("displayMenuDropdown");
  const saveMenu = document.getElementById("saveMenuDropdown");

  // 表示メニューをトグル
  menu.classList.toggle("hidden");

  // 保存メニューが開いていたら閉じる
  saveMenu.classList.add("hidden");
});

// ▼ メニュー内クリックでは閉じない
document.getElementById("displayMenuDropdown").addEventListener("click", (e) => {
  e.stopPropagation();
});

// ▼ 画面のどこかをクリックしたら閉じる
document.addEventListener("click", () => {
  document.getElementById("displayMenuDropdown").classList.add("hidden");
  document.getElementById("relatedSystemsDropdown").classList.add("hidden");
});

// ▼ 関連システムメニューの開閉
document.getElementById("btnRelatedSystems").addEventListener("click", (e) => {
  e.stopPropagation();

  const menu = document.getElementById("relatedSystemsDropdown");
  const displayMenu = document.getElementById("displayMenuDropdown");
  const saveMenu = document.getElementById("saveMenuDropdown");

  // 関連システムメニューをトグル
  menu.classList.toggle("hidden");

  // 他のメニューが開いていたら閉じる
  displayMenu.classList.add("hidden");
  saveMenu.classList.add("hidden");
});

// ▼ 関連システムメニュー内クリックでは閉じない
document.getElementById("relatedSystemsDropdown").addEventListener("click", (e) => {
  e.stopPropagation();
});

// ------------------------------------------------------
// ★ マーカー表示の適用処理（共通関数として公開）
// ------------------------------------------------------
window.applyMarkerStateToAllCharts = function(show, overlayMode = window.overlayMode) {
  const chartsToUpdate = overlayMode
    ? [window.overlayChart]
    : charts;
  chartsToUpdate.forEach((chart) => {
    if (!chart) return;

    const markerRadius = overlayMode ? 2 : 3;
    const hitRadius = overlayMode ? 5 : (show ? 5 : 0);
    chart.data.datasets.forEach((ds, dsIndex) => {

      // ▼ dataset 側の設定
      ds.pointRadius = show ? markerRadius : 0;
      ds.pointHoverRadius = show ? 5 : 0;
      ds.pointHitRadius = hitRadius;
      ds.pointBorderWidth = show ? 1 : 0;
      ds.pointStyle = show ? 'circle' : false;

      // ▼ meta.data 側の描画設定（Chart.js 4.x の核心）
      const meta = chart.getDatasetMeta(dsIndex);
      meta.data.forEach(pt => {
        pt.options.radius = show ? markerRadius : 0;
        pt.options.hoverRadius = show ? 5 : 0;
        pt.options.hitRadius = hitRadius;
        pt.options.pointStyle = show ? 'circle' : false;
      });
    });

    chart.update();
  });

};

// ------------------------------------------------------
// ▼ マーカー表示の ON/OFF（UI → グラフ）
// ------------------------------------------------------

// ★ click で伝播を止める（これが最重要）
document.getElementById("toggleMarkers").addEventListener("click", (e) => {
  e.stopPropagation();
});

// change はそのまま（反映処理）
document.getElementById("toggleMarkers").addEventListener("change", (e) => {
  const show = e.target.checked;

  const mode = window.overlayMode ? "overlay" : "normal";
  window.markerEnabledByMode[mode] = show;
  window.globalMarkerEnabled = show;

  // 現在のモードのグラフに適用
  window.applyMarkerStateToAllCharts(show, window.overlayMode);

  // ★ 状態を即保存（これが最重要）
  saveStateToLocalStorage();
});

document.getElementById("toggleCrosshairValueLabels")?.addEventListener("click", e => {
  e.stopPropagation();
});
document.getElementById("toggleCrosshairValueLabels")?.addEventListener("change", e => {
  const mode = window.overlayMode ? "overlay" : "normal";
  window.crosshairValueLabelsByMode[mode] = e.target.checked;
  updateCrosshairAll();
  saveStateToLocalStorage();
});
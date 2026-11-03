/* ============================================
   saveMenu.js
============================================ */

// ===== 保存 / 共有 メニュー =====

document.addEventListener("DOMContentLoaded", () => {

  // ★ 不要項目を非表示にする
  const autoSaveItem = document.getElementById("autoSaveToggle")?.closest(".menu-item");
  if (autoSaveItem) autoSaveItem.style.display = "none";

  const saveStateItem = document.getElementById("btnSaveStateJson");
  if (saveStateItem) saveStateItem.style.display = "none";

  const openC4GLabel = document.querySelector("label[for='openC4G']");
  if (openC4GLabel) openC4GLabel.style.display = "none";

  const loadAnotherCSV = document.getElementById("btnLoadAnotherCSV");
  if (loadAnotherCSV) loadAnotherCSV.style.display = "none";

  const openRecentFiles = document.getElementById("btnOpenRecentFilesMenu");
  if (openRecentFiles) openRecentFiles.style.display = "none";

  const exportHTML = document.getElementById("btnExportHTML");
  if (exportHTML) exportHTML.style.display = "none";

  const btnSaveMenu = document.getElementById("btnSaveMenu");
  const saveMenu = document.getElementById("saveMenuDropdown");
  
  // ▼ メニュー開閉（トグル）
  btnSaveMenu.addEventListener("click", (e) => {
    e.stopPropagation();

    const displayMenu = document.getElementById("displayMenuDropdown");

    saveMenu.classList.toggle("hidden");

    // 表示メニューが開いていたら閉じる
    displayMenu.classList.add("hidden");
  });

  // ▼ メニュー外クリックで閉じる
  document.addEventListener("pointerdown", (e) => {
    const menu = document.getElementById("saveMenuDropdown");
    const button = document.getElementById("btnSaveMenu");

    if (menu.classList.contains("hidden")) return;
    if (button.contains(e.target)) return;
    if (menu.contains(e.target)) return;

    menu.classList.add("hidden");

    e.stopPropagation();
    e.preventDefault();
  }, true);

  // ▼ state.json 保存
  document.getElementById("btnSaveStateJson").addEventListener("click", async () => {
    try {
      const json = exportStateToJSON();
      await downloadTextFile(json, "state.json");
    } catch (error) {
      console.error("state.json の保存に失敗しました。", error);
      alert("state.json の保存に失敗しました。\n" + error.message);
    }
  });

  // ▼ C4G 保存
  document.getElementById("btnSaveC4G").addEventListener("click", () => {
    exportC4G();
  });

  // ▼ C4G 読み込み
  document.getElementById("openC4G").addEventListener("change", e => {
    const file = e.target.files[0];
    if (file) loadSupportedFile(file);
    e.target.value = "";
  });

  // ▼ メニュー項目クリックで file input を開く
  document.querySelector("label[for='openC4G']").addEventListener("click", () => {
    document.getElementById("openC4G").click();
  });

  // ▼ 別の CSV を読み込む
  document.getElementById("btnLoadAnotherCSV").addEventListener("click", () => {
    document.getElementById("fileInput").click();
  });

  // ▼ 共有用 HTML エクスポート
  document.getElementById("btnExportHTML").addEventListener("click", () => {
    saveMenu.classList.add("hidden");
    openStandaloneHtmlDialog();
  });

  // ▼ テキスト形式で出力（FlyingGraph用.txt）
  document.getElementById("btnExportFlyingGraphTxt").addEventListener("click", () => {
    saveMenu.classList.add("hidden");
    openFlyingGraphTxtDialog();
  });

  // ▼ グラフ全体を PNG 画像として保存
  document.getElementById("btnExportGraphScreenshot").addEventListener("click", () => {
    saveMenu.classList.add("hidden");
    openGraphScreenshotDialog();
  });

  // ▼ C3P の場合はテキスト出力ボタンを無効化
  const btnExportTxt = document.getElementById("btnExportFlyingGraphTxt");

  function updateExportTxtButton() {
    if (window.__isC3P) {
      btnExportTxt.disabled = true;
      btnExportTxt.style.opacity = "0.4";
      btnExportTxt.style.pointerEvents = "none";
    } else {
      btnExportTxt.disabled = false;
      btnExportTxt.style.opacity = "1.0";
      btnExportTxt.style.pointerEvents = "auto";
    }
  }

  // 他ファイルから呼べるように公開
  window.updateExportTxtButton = updateExportTxtButton;

  // 初期状態（ページ読み込み直後）
  updateExportTxtButton();

});
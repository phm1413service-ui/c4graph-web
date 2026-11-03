/* ============================================
   events.js
============================================ */

// ===== DOM構築後に初期化 =====
document.addEventListener("DOMContentLoaded", () => {
  const graphsEl = document.getElementById('graphs');
  const scrollEl = document.getElementById('graphsContainer');

  // ===== 共有時間更新 =====
  function getLastChart() {
    const panels = document.querySelectorAll('#graphs .chart-panel');
    if (panels.length === 0) return null;
    const lastPanel = panels[panels.length - 1];
    const lastIndex = parseInt(lastPanel.id.replace('panel',''), 10);
    return charts[lastIndex] || null;
  }

  function updateSharedTime(e, targetCanvas) {
    const rect = targetCanvas.getBoundingClientRect();
    const relX = e.clientX - rect.left;

    let chart = charts.find(c => c && c.canvas === targetCanvas);
    if (!chart) chart = getLastChart();
    if (!chart) return;

    const xScale = chart.scales.x;
    sharedTimeValue = xScale.getValueForPixel(relX);

    updateCrosshairAll();
  }

  // ===== グラフ領域でのマウスイベント =====
  graphsEl.addEventListener('mousemove', e => {
    if (e.target.tagName.toLowerCase() === 'canvas') {

      // ★ 左右固定線ドラッグ中は中央クロスヘアを動かさない
      if (!isLeftDrag && !isRightDrag) {
        updateSharedTime(e, e.target);
      }
    }
  });

  graphsEl.addEventListener('mouseleave', () => {
    // ★ 中央クロスヘアだけを消す（固定線は消さない）
    if (!isLeftDrag && !isRightDrag) {
      sharedTimeValue = null;
      updateCrosshairAll();
    }
  });

  // ===== マウス位置でスクロール対象を決定 =====
  let currentScrollTarget = null;

  document.addEventListener("mousemove", e => {
    const sidebar = document.getElementById("sidebar");
    const controls = document.querySelector("#sidebar #controls");
    const graphs = document.getElementById("graphsContainer");

    if (sidebar && sidebar.contains(e.target)) {
      currentScrollTarget = controls;
    } else if (graphs && graphs.contains(e.target)) {
      currentScrollTarget = graphs;
    } else {
      currentScrollTarget = null;
    }
  });

  // ===== キーボード操作でスクロール =====
  function handleScrollKey(e) {
    if (!currentScrollTarget) return;

    switch (e.key) {
      case 'ArrowUp':   currentScrollTarget.scrollTop -= 40; break;
      case 'ArrowDown': currentScrollTarget.scrollTop += 40; break;
      case 'PageUp':    currentScrollTarget.scrollTop -= currentScrollTarget.clientHeight; break;
      case 'PageDown':  currentScrollTarget.scrollTop += currentScrollTarget.clientHeight; break;
      case 'Home':      currentScrollTarget.scrollTop = 0; break;
      case 'End':       currentScrollTarget.scrollTop = currentScrollTarget.scrollHeight; break;
    }
  }

  document.addEventListener('keydown', handleScrollKey);

  // ===== グラフ高さ調整イベント =====
  window.addEventListener('resize', fixChartHeights);
  document.getElementById('minHeightInput').addEventListener('change', fixChartHeights);
  setTimeout(() => {
    refreshAxes();
    fixChartHeights();
    // ★★★ 高さ変更後に自動保存 ★★★
    saveStateToLocalStorage();
  }, 0);

  // ===== controlsContainer の高さ変化に追随（CSS変数へ反映） =====
  const controlsContainerEl = document.getElementById('controlsContainer');
  function updateControlsMarginVar(){
    const h = controlsContainerEl ? controlsContainerEl.offsetHeight : 0;
    document.documentElement.style.setProperty('--controls-height', `${h}px`);
  }
  updateControlsMarginVar();

  if (controlsContainerEl && 'ResizeObserver' in window) {
    const ro = new ResizeObserver(() => {
      updateControlsMarginVar();
      fixChartHeights();
    });
    ro.observe(controlsContainerEl);
  }
});

/* ============================
   印刷用 DOM 切り替え（完成版）
============================ */

window.onbeforeprint = () => {
  const printWrapper = document.getElementById("printWrapper");
  printWrapper.innerHTML = "";

  // グラフパネルを順番に処理
  const panels = document.querySelectorAll("#graphs .chart-panel");

  panels.forEach(panel => {
    const canvas = panel.querySelector("canvas");
    const titleEl = panel.querySelector(".chart-title");

    if (!canvas || !titleEl) return;

    const block = document.createElement("div");
    block.style.pageBreakInside = "avoid";
    block.style.marginBottom = "24px";

    const titleText = document.createElement("div");
    titleText.textContent = titleEl.textContent.trim();
    titleText.style.fontSize = "13px";
    titleText.style.fontWeight = "normal";
    titleText.style.margin = "10px 0 4px 0";
    block.appendChild(titleText);

    const img = document.createElement("img");
    img.src = canvas.toDataURL("image/png");
    img.style.width = "100%";
    img.style.marginBottom = "4px";
    block.appendChild(img);

    printWrapper.appendChild(block);
  });

  // スライダーを画像化して追加
  const sliderEl = document.getElementById("xRangeSlider");
  if (sliderEl) {

    // 印刷用に複製
    const sliderClone = sliderEl.cloneNode(true);
    sliderClone.style.paddingTop = "25px";  // ← 吹き出しが切れないように余白追加
    sliderClone.style.position = "relative";
    sliderClone.style.top = "0";

    // 一時的に DOM に追加（画面には見えない）
    sliderClone.style.visibility = "hidden";
    document.body.appendChild(sliderClone);

    html2canvas(sliderClone).then(canvas => {
      const sliderImg = document.createElement("img");
      sliderImg.src = canvas.toDataURL("image/png");
      sliderImg.style.width = "100%";
      sliderImg.style.marginTop = "30px";
      sliderImg.style.pageBreakInside = "avoid";
      printWrapper.appendChild(sliderImg);

      // 複製を削除
      document.body.removeChild(sliderClone);
    });
  }

  document.getElementById("main").style.display = "none";
  document.getElementById("sidebar").style.display = "none";
  printWrapper.style.display = "block";
};

window.onafterprint = () => {
  document.getElementById("main").style.display = "";
  document.getElementById("sidebar").style.display = "";
  document.getElementById("printWrapper").style.display = "none";
};
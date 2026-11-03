// ==========================================
// toggleChart.js（安全版）
// ==========================================

// ★ update() を1フレームに1回だけ実行するデバウンス
let __pendingLayout = false;

function requestSafeLayout() {
  if (__pendingLayout) return;   // すでに予約済みなら何もしない
  __pendingLayout = true;

  requestAnimationFrame(() => {
    __pendingLayout = false;

    refreshAxes();       // X軸表示制御
    fixChartHeights();   // パネル高さ調整

    // ★ Y軸幅同期のための再描画（安全）
    charts.forEach(c => { if (c) c.update(); });
    if (window.refreshDisplayFeatures) window.refreshDisplayFeatures();
  });
}

function toggleChart(index, visible) {
  if (window.overlayMode) {
    window.setOverlaySeriesVisible(index, visible);
    return;
  }

  const graphs = document.getElementById('graphs');
  const graphsContainer = document.getElementById('graphsContainer');
  const slider = document.getElementById('xRangeSlider');

  if (visible) {

    const sidebar = document.getElementById('sidebar');
    if (sidebar) sidebar.classList.add('open');

    if (charts[index]) return;

    const { panel, title, controls, handle, canvas } = createChartPanel(index);

    if (!document.body.classList.contains("select-all-mode") &&
        !window.__isRestoringState) {

      panel.classList.add("moved");
      panel.addEventListener("animationend", () => {
        panel.classList.remove("moved");
      }, { once: true });
    }

    const chart = createChart(index, canvas);
    charts[index] = chart;

    // ★ 保存していた Y軸設定を復元
    if (window.savedYAxis && window.savedYAxis[index]) {
      const { min, max } = window.savedYAxis[index];
      YAxisLogic.apply(chart, min, max, "restore");
    }

    attachCanvasEvents(chart, canvas);

    if (!window.__isSidebarDrag) {
      setTimeout(() => {
        graphsContainer.scrollTop = graphsContainer.scrollHeight;
      }, 0);
    }

    const visibleCount = charts.filter(c => !!c).length;

    if (visibleCount === 1) {
      slider.style.display = "block";

      if (!window.__isRestoringState) {
        const { globalXMin, globalXMax } = computeGlobalXRange();
        const savedMinX = window.userMinX;
        const savedMaxX = window.userMaxX;
        initXRangeSlider(globalXMin, globalXMax, savedMinX, savedMaxX);
        if (savedMinX != null && savedMaxX != null && typeof window.applyXRange === "function") {
          window.applyXRange({ force: true, skipSave: true });
        }
      }
    }

    if (visibleCount > 1 && !window.__isRestoringState) {
      if (typeof window.applyXRange === "function") {
        window.applyXRange();
      }
    }

  } else {

    const panel = document.getElementById('panel' + index);
    if (panel) panel.remove();

    if (charts[index]) {

      // ★ Y軸設定を保存
      if (!window.savedYAxis) window.savedYAxis = {};
      const y = charts[index].options.scales.y;
      window.savedYAxis[index] = {
        min: y.min ?? y.suggestedMin ?? charts[index].$initialMin,
        max: y.max ?? y.suggestedMax ?? charts[index].$initialMax
      };

      charts[index].destroy();
      charts[index] = null;
    }

    const sidebar = document.getElementById('sidebar');
    if (sidebar) sidebar.classList.add('open');

    const pos = selectedChartIndices.indexOf(index);
    if (pos !== -1) selectedChartIndices.splice(pos, 1);

    const chip = document.querySelector(`#controls .chip input[data-index="${index}"]`)?.parentElement;
    if (chip) chip.classList.remove("selected");

    const ecuName = seriesData[index].meta.ecu;
    const parentChk = document.getElementById("parent-" + ecuName);
    if (parentChk) {
      const children = seriesData
        .map((s, i) => ({ ...s, index: i }))
        .filter(s => s.meta.ecu === ecuName);
      updateParentState(parentChk, children);
    }

    const anyVisible = charts.some(c => !!c);
    if (!anyVisible) {
      slider.style.display = "block";
      if (window.refreshDisplayFeatures) window.refreshDisplayFeatures();
      return;
    }
  }

  // ★★★ ここが最大の改善点 ★★★
  // update() を連打せず、1フレームに1回だけ安全に実行
  if (!suppressChartUpdates && !window.__isDraggingChart) {
    requestSafeLayout();
  }

  saveStateToLocalStorage();
}
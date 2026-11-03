/* ============================================
   chartLayout.js（トリガー基準 ±秒軸 対応版）
============================================ */

// ===== 軸制御 =====
function refreshAxes() {

  const panels = document.querySelectorAll('#graphs .chart-panel');
  if (panels.length === 0) {
    if (window.updateHairlineValuesPanel) window.updateHairlineValuesPanel();
    return;
  }

  const lastPanel = panels[panels.length - 1];
  const lastIndex = parseInt(lastPanel.id.replace('panel',''), 10);

  charts.forEach((c, i) => {
    if (!c) return;

    const showX = (i === lastIndex);

    c.options.scales.x.display = showX;
    c.options.scales.x.title = { display: false };
    c.options.scales.x.afterFit = axis => {
      axis.height = showX ? 30 : 0;
    };

    // X軸表示側は最右ラベルを空にしていても ticks.padding(3px) 分だけ
    // プロット右端が内側に寄るため、非表示側に同じ余白を付けて右端を揃える
    const layout = c.options.layout || (c.options.layout = {});
    const padding = (typeof layout.padding === 'object' && layout.padding !== null)
      ? layout.padding
      : (layout.padding = {});
    padding.right = showX ? 0 : 3;
  });

  charts.forEach((c) => {
    if (c) c.update();
  });
  if (window.updateHairlineValuesPanel) window.updateHairlineValuesPanel();
}


// ===== グラフ高さ調整 =====
function fixChartHeights() {
  const panels = document.querySelectorAll('#graphs .chart-panel');
  if (panels.length === 0) return;

  const graphsContainer = document.getElementById('graphsContainer');
  const minHeightRaw = Number(document.getElementById('minHeightInput').value) || 200;
  const minHeight = Math.max(minHeightRaw, 50);
  const xAxisExtra = 20;

  graphsContainer.style.overflowY = 'auto';

  panels.forEach((p, i) => {
    const isLast = i === panels.length - 1;
    const isCompact = p.classList.contains('compact-mode');

    if (isCompact) {
      // コンパクトモード: タイトルバー分を減算
      // minHeightは通常モードの値を保持し、表示上のみ減算
      const compactHeight = Math.max(100, minHeight - 28);
      p.style.setProperty('height', (compactHeight + (isLast ? xAxisExtra : 0)) + 'px', 'important');
    } else {
      // 通常モード
      p.style.setProperty('height', (minHeight + (isLast ? xAxisExtra : 0)) + 'px', 'important');
    }
  });
}


// ===== ユーザー調整値を保持（shiftedX の min/max） =====
window.userMinX = null;
window.userMaxX = null;


// ===== X軸範囲統一（トリガー基準 ±秒） =====
function unifyXAxisRange() {
  const visibleIndices = Array.from(document.querySelectorAll('#graphs .chart-panel'))
    .map(p => parseInt(p.id.replace('panel',''), 10))
    .filter(i => charts[i]);

  if (visibleIndices.length === 0) return;

  const allX = visibleIndices.flatMap(i => {
    const ds = charts[i].data.datasets[0];
    return ds.rawData.map(p => p.x);
  });

  const autoMinX = Math.min(...allX);
  const autoMaxX = Math.max(...allX);

  initXRangeSlider(autoMinX, autoMaxX);

  const effectiveMinX = window.userMinX ?? autoMinX;
  const effectiveMaxX = window.userMaxX ?? autoMaxX;

  charts.forEach(c => {
    if (!c) return;

    delete c.options.scales.x.min;
    delete c.options.scales.x.max;

    c.options.scales.x.suggestedMin = effectiveMinX;
    c.options.scales.x.suggestedMax = effectiveMaxX;

    c.update();
  });

  refreshXRangeSlider();
}


// ===== クロスヘア更新 =====
window.updateCrosshair = function() {
  const panels = document.querySelectorAll('#graphs .chart-panel');
  if (panels.length > 0) {
    const lastPanel = panels[panels.length - 1];
    const lastIndex = parseInt(lastPanel.id.replace('panel',''), 10);
    const lastChart = charts[lastIndex];
    if (lastChart) lastChart.draw();
  }
  if (window.updateHairlineValuesPanel) window.updateHairlineValuesPanel();
};

window.updateCrosshairAll = function() {
  charts.forEach(c => { if (c) c.draw(); });
  if (window.overlayChart) window.overlayChart.draw();
  if (window.updateHairlineValuesPanel) window.updateHairlineValuesPanel();
};


// ===== 幅同期ユーティリティ =====
function requestYAxisResync() {
  charts.forEach(c => { if (c) c.update(); });
  setTimeout(() => {
    charts.forEach(c => { if (c) c.update(); });
  }, 0);
}


// ===== ウインドウリサイズ時のスライダー追従 =====
window.addEventListener("resize", () => {
  refreshXRangeSlider();
});


// ===== スライダーのリアルタイム追従（ResizeObserver） =====
const slider = document.getElementById("xRangeSlider");
if (slider) {
  const ro = new ResizeObserver(() => {
    refreshXRangeSlider();
  });
  ro.observe(slider);
}
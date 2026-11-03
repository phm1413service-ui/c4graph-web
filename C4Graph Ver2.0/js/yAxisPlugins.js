/* ============================================
   yAxisPlugins.js
   Y軸関連の数学ロジック + Chart.js プラグイン
============================================ */

/* --------------------------------------------
   刻み幅(step) 自動推定
-------------------------------------------- */
function detectStep(ticks) {
  if (!ticks || ticks.length < 2) return 1;

  const diffs = [];
  for (let i = 1; i < ticks.length; i++) {
    const prev = ticks[i - 1].value;
    const curr = ticks[i].value;
    const d = curr - prev;
    if (d > 0 && Number.isFinite(d)) diffs.push(d);
  }

  if (diffs.length === 0) return 1;
  return Math.min(...diffs);
}

/* --------------------------------------------
   小数点桁数推定
-------------------------------------------- */
function detectDecimalPlaces(values) {
  let maxDecimals = 0;
  for (const v of values) {
    if (Number.isFinite(v)) {
      const s = v.toString();
      if (s.includes('.')) {
        const d = s.split('.')[1].length;
        if (d > maxDecimals) maxDecimals = d;
      }
    }
  }
  return maxDecimals;
}

/* --------------------------------------------
   安全な小数点桁数推定
-------------------------------------------- */
function detectSafeDecimalPlaces(values) {
  const diffs = [];
  for (let i = 1; i < values.length; i++) {
    const d = Math.abs(values[i] - values[i - 1]);
    if (d > 0 && Number.isFinite(d)) diffs.push(d);
  }
  if (diffs.length === 0) return 3;

  const minDiff = Math.min(...diffs);
  const decimals = -Math.floor(Math.log10(minDiff));
  return Math.max(decimals, 3);
}

/* --------------------------------------------
   0 ラベル強調プラグイン（zeroLine 完全対応版）
-------------------------------------------- */
const zeroTickPlugin = {
  id: 'zeroTick',

  beforeDatasetsDraw(chart) {
    const yScale = chart.scales.y;
    if (!yScale) return;

    // OFF の場合は描かない
    if (chart._zeroLine === false) {
      return;
    }

    const dataset = chart.data.datasets[0];
    if (!dataset) return;
    if (dataset.unitMap) {
      return;
    }

    const min = yScale.min;
    const max = yScale.max;

    // 0 が範囲外なら描かない
    if (min > 0 || max < 0) return;

    // アニメーション中は描かない
    if (chart._animationsActive) return;

    const ctx = chart.ctx;
    const y = yScale.getPixelForValue(0);

    const grid = yScale.options.grid;
    const tick = yScale.options.ticks;

    const left = chart.chartArea.left;
    const right = chart.chartArea.right;

    ctx.save();

    /* ===== 0 の水平線 ===== */
    ctx.strokeStyle = 'rgba(0,0,0,0.65)';
    ctx.lineWidth = (grid.lineWidth || 1) * 1.5;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(left, y);
    ctx.lineTo(right, y);
    ctx.stroke();

    /* ===== 目盛り ===== */
    const axisX = left;
    const tickLen = grid.tickLength || 6;
    const tickEndX = axisX - tickLen;

    ctx.beginPath();
    ctx.moveTo(axisX, y);
    ctx.lineTo(tickEndX, y);
    ctx.stroke();

    /* ===== ラベル ===== */
    const labelX = tickEndX - (tick.padding || 3);
    const fontObj = Chart.helpers.toFont(tick.font || Chart.defaults.font);

    ctx.font = fontObj.string;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = tick.color || '#666';
    ctx.fillText('0', labelX, y);

    ctx.restore();
  }
};

/* --------------------------------------------
   任意Yライン描画プラグイン
-------------------------------------------- */
const customYLinesPlugin = {
  id: 'customYLines',

  afterDraw(chart) {
    const lines = chart._customYLines;
    if (!lines || lines.length === 0) return;

    const yScale = chart.scales?.y;
    const area = chart.chartArea;
    if (!yScale || !area) return;

    const ctx = chart.ctx;
    ctx.save();
    ctx.font = '12px sans-serif';

    lines.forEach(line => {
      const y = yScale.getPixelForValue(line.value);
      if (y < area.top || y > area.bottom) return;

      // ===== 水平線 =====
      ctx.strokeStyle = line.color || 'rgba(0,0,0,0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(area.left, y);
      ctx.lineTo(area.right, y);
      ctx.stroke();

      // ===== ラベル =====
      const text = line.label ?? String(line.value);
      ctx.fillStyle = line.color || 'black';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      ctx.fillText(text, area.left + 4, y - 2);
    });

    ctx.restore();
  }
};

/* --------------------------------------------
   プラグイン登録（1回だけ）
-------------------------------------------- */
Chart.register(
  customYLinesPlugin,
  zeroTickPlugin
);

/* --------------------------------------------
   グローバル公開（1回だけ）
-------------------------------------------- */
window.customYLinesPlugin = customYLinesPlugin;
window.zeroTickPlugin = zeroTickPlugin;
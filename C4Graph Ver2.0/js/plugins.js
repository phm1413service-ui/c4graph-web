// ==========================================
// plugins.js
// ==========================================

function drawCrosshairValueLabel(ctx, area, anchorX, anchorY, text, color, occupiedRects, hairlineXs) {
  const boxHeight = 18;
  const padding = 4;
  const safeLeft = area.left + 2;
  const safeRight = area.right - 2;
  const safeTop = area.top + 2;
  const safeBottom = area.bottom - 2;
  const textWidth = ctx.measureText(text).width;
  const width = Math.min(textWidth + padding * 2, safeRight - safeLeft);
  if (width <= 0 || safeBottom - safeTop < boxHeight) return;

  const rightX = anchorX + 7;
  const leftX = anchorX - width - 7;
  const horizontalCandidates = (rightX + width <= safeRight)
    ? [rightX, leftX]
    : [leftX, rightX];
  const verticalCandidates = [];
  for (let distance = 0; distance <= safeBottom - safeTop; distance += boxHeight + 4) {
    verticalCandidates.push(anchorY - boxHeight - 5 - distance);
    if (distance > 0) verticalCandidates.push(anchorY + 5 + distance);
    else verticalCandidates.push(anchorY + 5);
  }

  let best = null;
  let bestScore = Infinity;
  const seen = new Set();
  for (let horizontalIndex = 0; horizontalIndex < horizontalCandidates.length; horizontalIndex++) {
    const x = Math.min(Math.max(horizontalCandidates[horizontalIndex], safeLeft), safeRight - width);
    for (const candidateY of verticalCandidates) {
      const y = Math.min(Math.max(candidateY, safeTop), safeBottom - boxHeight);
      const key = `${Math.round(x)}:${Math.round(y)}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const rect = { x, y, width, height: boxHeight };
      let overlapCount = 0;
      for (const other of occupiedRects) {
        if (
          rect.x < other.x + other.width + 3 &&
          rect.x + rect.width + 3 > other.x &&
          rect.y < other.y + other.height + 2 &&
          rect.y + rect.height + 2 > other.y
        ) overlapCount++;
      }

      let hairlineCount = 0;
      for (const lineX of hairlineXs) {
        if (lineX >= rect.x - 3 && lineX <= rect.x + rect.width + 3) hairlineCount++;
      }

      const distance = Math.abs((x + width / 2) - anchorX) +
        Math.abs((y + boxHeight / 2) - anchorY);
      const score = overlapCount * 100000 + hairlineCount * 10000 +
        distance + horizontalIndex * 0.1;
      if (score < bestScore) {
        best = rect;
        bestScore = score;
      }
      if (overlapCount === 0 && hairlineCount === 0) break;
    }
    if (bestScore < 10000) break;
  }

  if (!best) return;
  occupiedRects.push(best);
  ctx.fillStyle = "rgba(255,255,255,0.82)";
  ctx.fillRect(best.x, best.y, best.width, best.height);
  ctx.fillStyle = color;
  ctx.textAlign = "left";
  ctx.fillText(text, best.x + padding, best.y + 13);
}

// ===== クロスヘア同期プラグイン（衝突回避＋端切れ対策＋2分探索高速化） =====
const crosshairPlugin = {
  id: 'crosshair',
  afterDraw(chart) {
    const ctx = chart.ctx;
    const xScale = chart.scales?.x;
    const area = chart.chartArea;
    if (!xScale || !area) return;

    function findNearestY(dataset, xValue) {
      const data = dataset.crosshairData || dataset.data;
      let lo = 0, hi = data.length - 1;

      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (data[mid].x < xValue) lo = mid + 1;
        else hi = mid - 1;
      }

      const before = data[hi];
      if (before && Number.isFinite(before.y)) return before.y;
      const after = data[lo];
      if (
        after &&
        Number.isFinite(after.y) &&
        Math.abs(xScale.getPixelForValue(after.x) - xScale.getPixelForValue(xValue)) <= 15
      ) return after.y;
      return null;
    }

    if (chart.$isOverlayChart) {
      const lines = [
        [sharedTimeValueLeft, 'rgba(200,0,0,0.85)'],
        [sharedTimeValueRight, 'rgba(0,0,200,0.85)'],
        [!isLeftDrag && !isRightDrag ? sharedTimeValue : null, 'rgba(0,0,0,0.3)']
      ];
      const hairlineXs = [];
      lines.forEach(([value, color]) => {
        if (value == null || value < xScale.min || value > xScale.max) return;
        const x = Math.round(xScale.getPixelForValue(value)) + 0.5;
        hairlineXs.push(x);
        ctx.save();
        ctx.strokeStyle = color;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, chart.height);
        ctx.stroke();
        ctx.restore();
      });
      if (window.getCrosshairValueLabelsEnabled(true)) {
        const labelRects = [];
        ctx.save();
        ctx.font = "12px sans-serif";
        lines.forEach(([value, color], lineIndex) => {
          if (value == null || value < xScale.min || value > xScale.max) return;
          const x = xScale.getPixelForValue(value);

          chart.data.datasets.forEach((dataset, datasetIndex) => {
            const yScale = chart.scales?.[dataset.yAxisID];
            if (!yScale || !Array.isArray(dataset.data)) return;

            let rawY = null;
            const fixedSnap = lineIndex === 0
              ? chart._fixedLeftSnap
              : lineIndex === 1 ? chart._fixedRightSnap : null;
            const hoverSnap = lineIndex === 2 ? chart._hoverSnap : null;
            const snap = fixedSnap && Math.abs(fixedSnap.x - value) < 1e-6
              && (fixedSnap.datasetIndex == null || fixedSnap.datasetIndex === datasetIndex)
              ? fixedSnap
              : hoverSnap && Math.abs(hoverSnap.x - value) < 1e-6
                && hoverSnap.datasetIndex === datasetIndex
                ? hoverSnap
                : null;
            rawY = snap ? snap.y : findNearestY(dataset, value);
            if (!Number.isFinite(rawY)) return;

            const y = yScale.getPixelForValue(rawY);
            if (!Number.isFinite(y) || y < area.top || y > area.bottom) return;
            const unitMap = dataset.unitMap;
            const displayValue = unitMap && Number.isInteger(rawY) && unitMap.has(rawY)
              ? unitMap.get(rawY)
              : rawY;
            const labelText = `${value.toFixed(2)}s / ${String(displayValue)}${dataset.unit ? ` ${dataset.unit}` : ""}`;
            const labelColor = typeof dataset.borderColor === "string" ? dataset.borderColor : color;
            drawCrosshairValueLabel(
              ctx, area, x, y, labelText, labelColor, labelRects, hairlineXs
            );
          });
        });
        ctx.restore();
      }
      return;
    }

    const yScale = chart.scales?.y;
    if (!yScale) return;

    const fixedLabelRects = [];

    function drawLineAndLabels(xValue, color, isFreeLine = false) {

      let xPixel = xScale.getPixelForValue(xValue);
      if (xPixel < area.left || xPixel > area.right) return;
      xPixel = Math.round(xPixel) + 0.5;

      ctx.save();

      // 縦線（キャンバス全体を貫通）
      ctx.strokeStyle = color;
      ctx.beginPath();
      ctx.moveTo(xPixel, 0);
      ctx.lineTo(xPixel, chart.height);
      ctx.stroke();

      if (!window.getCrosshairValueLabelsEnabled(false)) {
        ctx.restore();
        return;
      }

      // ラベル値決定
      const dataset = chart.data.datasets?.[0];
      let rawY = null, displayVal = null, unit = '';

      if (dataset && Array.isArray(dataset.data)) {

        // ★ 固定線（青・赤）は専用の snap 値を使う
        if (!isFreeLine) {

          // 左固定線
          if (chart._fixedLeftSnap && Math.abs(chart._fixedLeftSnap.x - xValue) < 1e-6) {
            rawY = chart._fixedLeftSnap.y;
          }

          // 右固定線
          else if (chart._fixedRightSnap && Math.abs(chart._fixedRightSnap.x - xValue) < 1e-6) {
            rawY = chart._fixedRightSnap.y;
          }

          // どちらも該当しない → stepped nearest
          else {
            rawY = findNearestY(dataset, xValue);
          }
        }

        // ★ 中央クロスヘア（黒）は hoverSnap を優先
        else if (isFreeLine && chart._hoverSnap && Math.abs(chart._hoverSnap.x - xValue) < 1e-6) {
          rawY = chart._hoverSnap.y;
        }

        // ★ それ以外は stepped の nearest 値
        else {
          rawY = findNearestY(dataset, xValue);
        }

        const unitMap = dataset.unitMap;
        if (rawY !== null) {
          displayVal = (unitMap && Number.isInteger(rawY) && unitMap.has(rawY))
            ? unitMap.get(rawY)
            : rawY;
        }
        unit = dataset.unit || '';
      }

      if (rawY !== null && displayVal !== null) {
        const labelText = `${xValue.toFixed(2)}s / ${String(displayVal)}${unit ? ' ' + unit : ''}`;
        ctx.font = '12px sans-serif';
        const baseY = yScale.getPixelForValue(rawY);
        const hairlineXs = [
          sharedTimeValueLeft,
          sharedTimeValueRight,
          !isLeftDrag && !isRightDrag ? sharedTimeValue : null
        ]
          .filter(value => value != null && value >= xScale.min && value <= xScale.max)
          .map(value => Math.round(xScale.getPixelForValue(value)) + 0.5);
        drawCrosshairValueLabel(
          ctx, area, xPixel, baseY, labelText, color, fixedLabelRects, hairlineXs
        );
      }

      ctx.restore();
    }

    if (sharedTimeValueLeft !== null) {
      drawLineAndLabels(sharedTimeValueLeft, 'rgba(200,0,0,0.85)', false);
    }
    if (sharedTimeValueRight !== null) {
      drawLineAndLabels(sharedTimeValueRight, 'rgba(0,0,200,0.85)', false);
    }
    if (sharedTimeValue !== null && !isLeftDrag && !isRightDrag) {
      drawLineAndLabels(sharedTimeValue, 'rgba(0,0,0,0.3)', true);
    }
  }
};

// ===== 範囲外補完（Xスライダー操作時に呼び出す関数） =====
function drawOutOfRangeLines(chart) {
  const xScale = chart.scales?.x;
  const yScale = chart.scales?.y;
  const area = chart.chartArea;
  if (!xScale || !yScale || !area) return;

  const dataset = chart.data.datasets?.[0];
  if (!dataset || !Array.isArray(dataset.data) || dataset.data.length === 0) return;

  const xMin = xScale.min;
  const xMax = xScale.max;
  if (xMin === xMax) return;

  const beforePoints = dataset.data.filter(d => d && typeof d.x === 'number' && d.x < xMin && d.y != null);
  const afterPoints  = dataset.data.filter(d => d && typeof d.x === 'number' && d.x > xMax && d.y != null);

  const lastBefore = beforePoints.length ? beforePoints[beforePoints.length - 1] : null;
  const firstAfter = afterPoints.length ? afterPoints[0] : null;

  const ctx = chart.ctx;
  ctx.save();

  ctx.beginPath();
  ctx.rect(area.left, area.top, area.right - area.left, area.bottom - area.top);
  ctx.clip();

  ctx.strokeStyle = dataset.borderColor || '#000';
  ctx.lineWidth = 2;

  if (lastBefore) {
    ctx.beginPath();
    const y0 = yScale.getPixelForValue(lastBefore.y);
    const x0 = xScale.getPixelForValue(xMin);
    const xPrev = xScale.getPixelForValue(lastBefore.x);
    ctx.moveTo(xPrev, y0);
    ctx.lineTo(x0, y0);
    ctx.stroke();
  }

  if (firstAfter) {
    ctx.beginPath();
    const y1 = yScale.getPixelForValue(firstAfter.y);
    const x1 = xScale.getPixelForValue(xMax);
    const xAfter = xScale.getPixelForValue(firstAfter.x);
    ctx.moveTo(x1, y1);
    ctx.lineTo(xAfter, y1);
    ctx.stroke();
  }

  ctx.restore();
}

// ===== スナップエフェクト関数（円アニメーション開始） =====
function animateSnapEffect(chart, pos, color) {
  if (!chart._snapEffects) chart._snapEffects = [];
  chart._snapEffects.push({
    x: pos.x,
    y: pos.y,
    start: Date.now(),
    color
  });

  chart.draw();
}

// ===== スナップエフェクトプラグイン（クリック等の円エフェクト） =====
const snapEffectPlugin = {
  id: 'snapEffect',
  afterDraw(chart) {
    const ctx = chart.ctx;
    const now = Date.now();
    const effects = chart._snapEffects;
    if (!effects || !Array.isArray(effects) || effects.length === 0) return;

    let needsRedraw = false;

    effects.forEach(effect => {
      const elapsed = (now - effect.start) / 1000;
      const duration = 1.0;
      if (elapsed > duration) return;

      needsRedraw = true;

      const progress = elapsed / duration;
      const alpha = 1 - progress;
      const radius = 6 + progress * 20;

      const c = effect.color || { r: 0, g: 0, b: 0 };
      ctx.save();
      ctx.strokeStyle = `rgba(${c.r},${c.g},${c.b},${alpha})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(effect.x, effect.y, radius, 0, 2 * Math.PI);
      ctx.stroke();
      ctx.restore();
    });

    chart._snapEffects = effects.filter(e => (now - e.start) < 1000);

    if (needsRedraw) {
      requestAnimationFrame(() => chart.draw());
    }
  }
};

const logoWatermarkImage = new Image();
logoWatermarkImage.src = window.hamamatsuNissanWatermarkSource;

const logoWatermarkPlugin = {
  id: "hamamatsuNissanWatermark",
  beforeDatasetsDraw(chart) {
    const area = chart.chartArea;
    if (!logoWatermarkImage.complete || !logoWatermarkImage.naturalWidth || !area) return;

    const aspectRatio = logoWatermarkImage.naturalWidth / logoWatermarkImage.naturalHeight;
    const width = Math.min(area.width / 4.5, area.height * 0.55 * aspectRatio);
    const height = width / aspectRatio;
    const columns = Math.max(1, Math.ceil(area.width / (width * 1.8)));
    const rows = Math.max(1, Math.ceil(area.height / (height * 1.65)));

    const ctx = chart.ctx;
    ctx.save();
    ctx.beginPath();
    ctx.rect(area.left, area.top, area.width, area.height);
    ctx.clip();
    ctx.globalAlpha = 0.12;
    for (let row = 0; row < rows; row++) {
      for (let column = 0; column < columns; column++) {
        const centerX = area.left + ((column + 0.5) / columns) * area.width;
        const centerY = area.top + ((row + 0.5) / rows) * area.height;
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(-Math.PI / 10);
        ctx.drawImage(logoWatermarkImage, -width / 2, -height / 2, width, height);
        ctx.restore();
      }
    }
    ctx.restore();
  }
};

// ===== プラグイン登録（重複登録防止のため一括） =====
Chart.register(
  logoWatermarkPlugin,
  crosshairPlugin,
  snapEffectPlugin,
);

logoWatermarkImage.addEventListener("load", () => {
  charts.forEach(chart => chart?.draw());
  window.overlayChart?.draw();
});

// 必要なら他ファイルから使えるように export
// export { drawOutOfRangeLines, animateSnapEffect };
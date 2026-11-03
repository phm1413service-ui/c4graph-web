/* ============================================
   xAxisUtils.js
   X軸の共通ユーティリティ
============================================ */

// ===== X軸の全体範囲を計算 =====
function computeGlobalXRange() {
  if (!Array.isArray(seriesData) || seriesData.length === 0) {
    return { globalXMin: 0, globalXMax: 100 };
  }

  const allX = [];

  seriesData.forEach(s => {
    if (!s || !Array.isArray(s.x)) return;
    s.x.forEach(v => {
      if (typeof v === "number" && isFinite(v)) allX.push(v);
    });
  });

  if (allX.length === 0) {
    return { globalXMin: 0, globalXMax: 100 };
  }

  // ★ Math.min(...allX) / Math.max(...allX) をやめる
  let minX = allX[0];
  let maxX = allX[0];

  for (let i = 1; i < allX.length; i++) {
    const v = allX[i];
    if (v < minX) minX = v;
    if (v > maxX) maxX = v;
  }


  // ★ range=0 対策（Chart.js が嫌うパターン）
  if (minX === maxX) {
    const pad = 0.001; // 1ms だけ広げる
    minX -= pad;
    maxX += pad;
  }

  return {
    globalXMin: minX,
    globalXMax: maxX
  };
}

// グローバル公開
window.computeGlobalXRange = computeGlobalXRange;
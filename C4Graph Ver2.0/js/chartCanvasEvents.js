/* ============================================
   chartCanvasEvents.js
   各チャートの <canvas> にマウスイベントを付与し、
   クロスヘア同期・スナップ・ドラッグ操作を制御する
============================================ */

window.attachCanvasEvents = function(chart, canvas) {
  function getDatasetYScale(datasetIndex) {
    const dataset = chart.data.datasets[datasetIndex];
    return chart.scales[dataset?.yAxisID] || chart.scales.y;
  }

  /* --------------------------------------------
     マウス移動（クロスヘア位置の更新）
     - マウス位置 → 時間値へ変換
     - 左右ドラッグ中なら固定線も更新
     - 近いデータ点があれば hoverSnap をセット
     - 全チャートのクロスヘアを再描画
  -------------------------------------------- */
  canvas.addEventListener('mousemove', e => {

    // canvas 内での相対座標
    const rect = canvas.getBoundingClientRect();
    const relX = e.clientX - rect.left;

    // X座標 → 時間値へ変換
    const xScale = chart.scales.x;
    const timeValue = xScale.getValueForPixel(relX);

    // 中央クロスヘア更新
    sharedTimeValue = timeValue;

    // 左右ドラッグ中なら固定線も更新
    if (isLeftDrag)  sharedTimeValueLeft  = timeValue;
    if (isRightDrag) sharedTimeValueRight = timeValue;

    // マウスに最も近いデータ点を取得（スナップ用）
    const active = chart.getElementsAtEventForMode(
      e,
      'nearest',
      { intersect: true },
      false
    );

    if (active.length > 0) {
      // 近い点がある → hoverSnap に保存
      const idx = active[0].index;
      const datasetIndex = active[0].datasetIndex ?? 0;
      const d = chart.data.datasets[datasetIndex].data[idx];
      chart._hoverSnap = { x: d.x, y: d.y, datasetIndex };
      // ★ スナップ中は中央クロスヘアもスナップ先に合わせる
      sharedTimeValue = d.x;
    } else {
      // 近い点がない → hoverSnap 無効
      chart._hoverSnap = null;
    }

    // 全チャートのクロスヘアを更新
    updateCrosshairAll();
  });



  /* --------------------------------------------
     マウス押下（スナップ確定・固定線の開始）
     - クリック位置に最も近いデータ点を探す
     - 左クリック → 左固定線
     - 右クリック → 右固定線
     - スナップ位置に円アニメーションを発生
  -------------------------------------------- */
  canvas.addEventListener('mousedown', e => {

    const rect = canvas.getBoundingClientRect();
    const relX = e.clientX - rect.left;
    const relY = e.clientY - rect.top;

    const xScale = chart.scales.x;

    // マウス位置の時間値
    const timeValue = xScale.getValueForPixel(relX);

    // スナップ候補
    let snapX = timeValue;
    let snapY = null;
    let snapDatasetIndex = 0;

    // すでに hoverSnap がある場合 → それを優先
    if (chart._hoverSnap) {
      snapX = chart._hoverSnap.x;
      snapY = chart._hoverSnap.y;
      snapDatasetIndex = chart._hoverSnap.datasetIndex ?? 0;
    }

    // hoverSnap が無い場合 → 手動で最も近い点を探索
    else {
      let nearest = null;
      let nearestDist = Infinity;
      const datasets = chart.$isOverlayChart
        ? chart.data.datasets
        : chart.data.datasets.slice(0, 1);

      datasets.forEach((dataset, datasetIndex) => {
        const actualDatasetIndex = chart.$isOverlayChart ? datasetIndex : 0;
        const yScale = getDatasetYScale(actualDatasetIndex);
        if (!yScale) return;
        dataset.data.forEach(d => {
          if (!d || !Number.isFinite(d.x) || !Number.isFinite(d.y)) return;
          const px = xScale.getPixelForValue(d.x);
          const py = yScale.getPixelForValue(d.y);

          const dx = relX - px;
          const dy = relY - py;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < nearestDist) {
            nearestDist = dist;
            nearest = d;
            snapDatasetIndex = actualDatasetIndex;
          }
        });
      });

      // 15px 以内ならスナップとみなす
      if (nearest && nearestDist < 15) {
        snapX = nearest.x;
        snapY = nearest.y;
      }
    }

    // 左クリック → 左固定線
    if (e.button === 0) {
      isLeftDrag = true;
      sharedTimeValueLeft = snapX;

      // ★ 固定線の snap を保存
      if (snapY !== null) {
        chart._fixedLeftSnap = { x: snapX, y: snapY, datasetIndex: snapDatasetIndex };
      }
    }

    // 右クリック → 右固定線
    else if (e.button === 2) {
      isRightDrag = true;
      sharedTimeValueRight = snapX;

      // ★ 固定線の snap を保存
      if (snapY !== null) {
        chart._fixedRightSnap = { x: snapX, y: snapY, datasetIndex: snapDatasetIndex };
      }
    }

    // スナップ位置が確定している場合 → 円アニメーション
    if (snapY !== null) {
      const px = xScale.getPixelForValue(snapX);
      const yScale = getDatasetYScale(snapDatasetIndex);
      const py = yScale?.getPixelForValue(snapY);

      // ★ 表示に使う X 値もスナップ先に合わせる（重要）
      sharedTimeValue = snapX;

      // 左クリック＝赤、右クリック＝青
      let color = { r: 255, g: 0, b: 0 };
      if (e.button === 2) color = { r: 0, g: 0, b: 255 };

      if (Number.isFinite(py)) animateSnapEffect(chart, { x: px, y: py }, color);
    }

    // 状態保存 & 全チャート更新
    saveStateToLocalStorage();
    updateCrosshairAll();
  });


  /* --------------------------------------------
     マウス離し（ドラッグ終了）
     - 左右ドラッグ状態を解除
     - クロスヘアを再描画
  -------------------------------------------- */
  canvas.addEventListener('mouseup', e => {

    if (e.button === 0) isLeftDrag = false;
    if (e.button === 2) isRightDrag = false;

    saveStateToLocalStorage();
    updateCrosshairAll();
  });



  /* --------------------------------------------
     右クリックメニューを無効化
  -------------------------------------------- */
  canvas.addEventListener('contextmenu', e => e.preventDefault());
};
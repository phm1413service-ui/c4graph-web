// ==========================================
// xRangeSlider.js（完全整合版）
// ==========================================

(function() {

  const slider = document.getElementById("xRangeSlider");
  if (!slider) return;

  const track  = slider.querySelector(".track");
  const range  = slider.querySelector(".range");
  const leftH  = slider.querySelector(".handle-left");
  const rightH = slider.querySelector(".handle-right");

  const leftInput  = leftH.querySelector("input");
  const rightInput = rightH.querySelector("input");

  // グラフ描画用（トリガー基準 ±秒）
  let globalMinX = 0;
  let globalMaxX = 0;

  // 現在の絞り込み範囲
  let minX = 0;
  let maxX = 0;

  // UI レール範囲（保存された最大値を保持）
  window.sliderMinForUI = 0;
  window.sliderMaxForUI = 1;

  // ドラッグ状態
  let dragging = null;
  let startX = 0;
  let startMin = 0;
  let startMax = 0;

  function hasVisibleCharts() {
    return (Array.isArray(window.charts) && window.charts.some(c => !!c)) ||
      window.overlayMode === true;
  }

  function getSliderWidth() {
    const style = getComputedStyle(slider);
    const padLeft = parseFloat(style.paddingLeft) || 0;
    const padRight = parseFloat(style.paddingRight) || 0;
    return {
      width: slider.clientWidth - padLeft - padRight,
      padLeft
    };
  }

  // ------------------------------------------
  // ① 初期化（復元 or 全開）
  // ------------------------------------------
  window.initXRangeSlider = function(xMinRaw, xMaxRaw, savedMin, savedMax) {

    // ★ prepareSeriesData / handleC3PFile の結果をそのまま使う
    const isC3P = window.__isC3P === true;

    // ==========================================================
    // ★ C3P の場合：補正なし（prepareSeriesData が相対秒を作っている）
    // ==========================================================
    if (isC3P) {

      globalMinX = xMinRaw;
      globalMaxX = xMaxRaw;

      window.sliderMinForUI = globalMinX;
      window.sliderMaxForUI = globalMaxX;

      minX = (savedMin != null) ? savedMin : globalMinX;
      maxX = (savedMax != null) ? savedMax : globalMaxX;

      updateUI();
      return;
    }

    // ==========================================================
    // ★ C4（CSV）の場合：Trigger Rate に基づきトリガー基準へ補正
    // ==========================================================
    const rateRaw = window.metaInfo?.["Trigger Rate"]?.[0] || "";
    const preMatch = rateRaw.match(/pre:\s*([0-9.]+)%/);
    const prePercent = preMatch ? Number(preMatch[1]) : 50;

    const totalRangeRaw = xMaxRaw - xMinRaw;
    const triggerTimeRaw = xMinRaw + totalRangeRaw * (prePercent / 100);

    globalMinX = xMinRaw - triggerTimeRaw;
    globalMaxX = xMaxRaw - triggerTimeRaw;

    window.sliderMinForUI = globalMinX;
    window.sliderMaxForUI = globalMaxX;

    minX = (savedMin != null) ? savedMin : globalMinX;
    maxX = (savedMax != null) ? savedMax : globalMaxX;

    updateUI();
  };

  // ------------------------------------------
  // ② UI 更新（value-box 衝突回避付き）
  // ------------------------------------------
  function updateUI() {

    const uiMin = window.sliderMinForUI;
    const uiMax = window.sliderMaxForUI;

    const { width, padLeft } = getSliderWidth();
    const total = uiMax - uiMin;
    if (width <= 0 || total <= 0) return;

    // ★ UI レール基準で描画（global を使わない）
    const leftRatio  = (minX - uiMin) / total;
    const rightRatio = (maxX - uiMin) / total;

    const leftPos  = leftRatio  * width + padLeft;
    const rightPos = rightRatio * width + padLeft;

    leftH.style.left  = `${leftPos}px`;
    rightH.style.left = `${rightPos}px`;

    range.style.left  = `${leftPos}px`;
    range.style.width = `${rightPos - leftPos}px`;

    leftInput.value  = minX.toFixed(3);
    rightInput.value = maxX.toFixed(3);

    const triggerLine = slider.querySelector(".trigger-line");
    if (triggerLine) {
      const ratio = (0 - uiMin) / total;
      const pos = ratio * width + padLeft;
      triggerLine.style.left = `${pos}px`;
    }

    // value-box 衝突回避
    const leftBox  = slider.querySelector(".value-box-left");
    const rightBox = slider.querySelector(".value-box-right");
    if (!leftBox || !rightBox) return;

    leftBox.style.transform  = "translateX(-50%)";
    rightBox.style.transform = "translateX(-50%)";

    const leftRect  = leftBox.getBoundingClientRect();
    const rightRect = rightBox.getBoundingClientRect();

    const gap = rightRect.left - leftRect.right;

    if (gap < 6) {
      const overlap = 6 - gap;
      leftBox.style.transform  = `translateX(calc(-50% - ${overlap / 2}px))`;
      rightBox.style.transform = `translateX(calc(-50% + ${overlap / 2}px))`;
    }
  }

  // ------------------------------------------
  // ③ X軸反映（force / skipSave 対応版）
  // ------------------------------------------
  function applyXRange(options) {
    const opt = options || {};
    const force = !!opt.force;
    const skipSave = !!opt.skipSave;

    if (!hasVisibleCharts()) return;
    if (!force && window.__isRestoringState) return;

    window.charts.forEach((c) => {
      if (!c) return;

      c.data.datasets.forEach((ds) => {
        const raw = ds.rawData;
        if (!raw || !Array.isArray(raw)) return;

        const inside = raw.filter(p => p.x >= minX && p.x <= maxX);
        const before = raw.filter(p => p.x < minX).pop();
        const after  = raw.find(p => p.x > maxX);

        const result = [];
        if (before) result.push(before);
        result.push(...inside);
        if (after) result.push(after);

        ds.data = result;
      });

      c.options.scales.x.min = minX;
      c.options.scales.x.max = maxX;
      c.update();

      // ★★★ 追加：補完線をここで描く（スライダー操作時だけ） ★★★
      drawOutOfRangeLines(c);
    });
    if (typeof window.updateOverlayChartRange === "function") {
      window.updateOverlayChartRange(minX, maxX);
    }

    window.userMinX = minX;
    window.userMaxX = maxX;
    if (typeof window.updateHairlineValuesPanel === "function") {
      window.updateHairlineValuesPanel();
    }

    if (!skipSave) {
      const autoSave = document.getElementById('autoSaveToggle');
      if (!autoSave || autoSave.checked) {
        saveStateToLocalStorage();
      }
    }
  }

  // ------------------------------------------
  // ④ ドラッグ処理（global 基準）
  // ------------------------------------------
  function onPointerDown(e) {
    const target = e.target;

    if (target === leftH)        dragging = "left";
    else if (target === rightH)  dragging = "right";
    else if (target === range)   dragging = "range";
    else return;

    startX = e.clientX;
    startMin = minX;
    startMax = maxX;

    e.preventDefault();
  }

  function onPointerMove(e) {
    if (!dragging) return;

    const dx = e.clientX - startX;

    const { width } = getSliderWidth();
    const total = globalMaxX - globalMinX;
    if (width <= 0 || total <= 0) return;

    const scale = total / width;

    if (dragging === "left") {
      minX = startMin + dx * scale;
      if (minX < globalMinX) minX = globalMinX;
      if (minX > maxX - 0.001) minX = maxX - 0.001;
    }

    if (dragging === "right") {
      maxX = startMax + dx * scale;
      if (maxX > globalMaxX) maxX = globalMaxX;
      if (maxX < minX + 0.001) maxX = minX + 0.001;
    }

    if (dragging === "range") {
      const delta = dx * scale;
      let newMin = startMin + delta;
      let newMax = startMax + delta;

      const span = startMax - startMin;

      if (newMin < globalMinX) {
        newMin = globalMinX;
        newMax = globalMinX + span;
      }
      if (newMax > globalMaxX) {
        newMax = globalMaxX;
        newMin = globalMaxX - span;
      }

      minX = newMin;
      maxX = newMax;
    }

    updateUI();

    if (hasVisibleCharts()) {
      applyXRange();
    }
  }

  function onPointerUp() {
    dragging = null;
  }

  slider.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);

  // ------------------------------------------
  // ⑤ 入力ボックス → スライダー反映
  // ------------------------------------------
  leftInput.addEventListener("focus", e => e.target.select());
  rightInput.addEventListener("focus", e => e.target.select());

  leftInput.addEventListener("change", () => {
    let v = parseFloat(leftInput.value);
    if (isNaN(v)) return;

    if (v < globalMinX) v = globalMinX;
    if (v > maxX - 0.001) v = maxX - 0.001;

    minX = v;
    updateUI();

    if (hasVisibleCharts()) applyXRange();
  });

  rightInput.addEventListener("change", () => {
    let v = parseFloat(rightInput.value);
    if (isNaN(v)) return;

    if (v > globalMaxX) v = globalMaxX;
    if (v < minX + 0.001) v = minX + 0.001;

    maxX = v;
    updateUI();

    if (hasVisibleCharts()) applyXRange();
  });

  // ------------------------------------------
  // ⑥ 外部からのレイアウト変更時に再描画
  // ------------------------------------------
  window.refreshXRangeSlider = function() {
    updateUI();
  };

  // 外部公開
  window.applyXRange = applyXRange;

})();
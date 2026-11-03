/* ============================================
   yAxisEditor.js
   インライン Y軸編集 UI（ロジック非依存）
============================================ */

window.YAxisEditor = {

  /* --------------------------------------------
     共通：UI 表示用の丸め関数
  -------------------------------------------- */
  _format(chart, value) {
    const values = chart.data.datasets[0].data.map(p => p.y);
    const safeDecimals = YAxisLogic.detectSafeDecimalPlaces(values);
    return Number(value.toFixed(safeDecimals));
  },

  /* --------------------------------------------
     インライン編集 UI を表示（ダブルクリック時）
  -------------------------------------------- */
  show(chart) {
    const yScale = chart.scales.y;
    const area = chart.chartArea;

    const panel = chart.canvas.closest(".chart-panel");
    const panelRect = panel.getBoundingClientRect();
    const canvasRect = chart.canvas.getBoundingClientRect();

    const canvasLeftInPanel = canvasRect.left - panelRect.left;
    const canvasTopInPanel  = canvasRect.top  - panelRect.top;

    const topY    = canvasTopInPanel + area.top - 9;
    const bottomY = canvasTopInPanel + area.bottom + 9;

    const labelWidth = yScale.width;
    const inputWidth = labelWidth;

    const rawLeftX =
      canvasLeftInPanel +
      yScale.left +
      (labelWidth / 2) -
      (inputWidth / 2);

    const leftX = Math.max(0, rawLeftX);

    // 既存を削除してから生成
    this.remove();
    this.create(leftX, topY, chart, "max", inputWidth);
    this.create(leftX, bottomY - 20, chart, "min", inputWidth);

    // ★ ダブルクリック時だけ value を入れて編集モードにする
    setTimeout(() => {
      const inputs = document.querySelectorAll(".y-inline-editor");
      if (inputs.length < 2) return;

      const maxInput = inputs[0];
      const minInput = inputs[1];

      // ★ 実値を丸めてセット（黒文字）
      maxInput.value = this._format(chart, (yScale.max ?? chart.$initialMax));
      minInput.value = this._format(chart, (yScale.min ?? chart.$initialMin));

      // 最大値側を編集状態にする
      maxInput.focus();
      maxInput.select();
    }, 0);
  },

  /* --------------------------------------------
     インライン入力ボックス生成（マウスオーバー時）
  -------------------------------------------- */
  create(x, y, chart, type, inputWidth) {
    const input = document.createElement("input");
    input.type = "text";
    input.className = "y-inline-editor";
    input.style.position = "absolute";
    input.style.left = x + "px";
    input.style.top = y + "px";
    input.style.width = inputWidth + "px";
    input.style.height = "20px";
    input.style.zIndex = 99999;

    input.style.background = "#fff";
    input.style.border = "1px solid #888";
    input.style.borderRadius = "3px";
    input.style.padding = "0 4px";
    input.style.textAlign = "right";
    input.tabIndex = type === "max" ? 1 : 2;

    const yFont = chart.options.scales.y.ticks.font;
    if (yFont?.size) {
      input.style.fontSize = yFont.size + "px";
    }

    const yScale = chart.options.scales.y;

    // ★ placeholder を丸めてセット（灰色）
    const rawPlaceholder =
      type === "min"
        ? (yScale.min ?? chart.$initialMin)
        : (yScale.max ?? chart.$initialMax);

    input.placeholder = this._format(chart, rawPlaceholder);

    // ★ value は空 → グレーの placeholder が表示される
    input.value = "";

    const panel = chart.canvas.closest(".chart-panel");
    panel.appendChild(input);

    // ★ クリックしたら固定モードに移行
    input.addEventListener("mousedown", e => {
      if (YAxisEditorState.lockedChart === chart) return;

      YAxisEditorState.lockedChart = chart;

      // ★ 実値を丸めてセット（黒文字）
      const rawValue =
        type === "min"
          ? (yScale.min ?? chart.$initialMin)
          : (yScale.max ?? chart.$initialMax);

      input.value = this._format(chart, rawValue);

      setTimeout(() => {
        input.focus();
        input.select();
      }, 0);
    });

    // Enter / Escape は従来通り
    input.addEventListener("keydown", e => {
      if (e.key === "Enter") {
        const inputs = document.querySelectorAll(".y-inline-editor");
        const maxInput = inputs[0];
        const minInput = inputs[1];

        const maxVal = maxInput.value.trim();
        const minVal = minInput.value.trim();

        YAxisLogic.apply(chart, minVal, maxVal, "inline");
        saveStateToLocalStorage();

        YAxisEditorState.lockedChart = null;
        this.remove();
      }

      if (e.key === "Escape") {
        YAxisEditorState.lockedChart = null;
        this.remove();
      }
    });
  },

  /* --------------------------------------------
     既存のインライン編集 UI を削除
  -------------------------------------------- */
  remove() {
    document.querySelectorAll(".y-inline-editor").forEach(el => el.remove());
  }
};
/* ============================================
   yAxisLogic.js
   Y軸ロジック専用（UI 依存なし）
============================================ */

window.YAxisLogic = {
  
  /* --------------------------------------------
      状態名 → 状態キーの逆引き
  -------------------------------------------- */
  resolveStateValue(input, unitMap) {
    if (input === "") return null;

    const num = Number(input);
    const isNumeric = !isNaN(num);

    // 状態モード（unitMap がある）
    if (unitMap) {
      // ① 状態キーとして存在する
      if (unitMap.has(num)) return num;

      // ② 状態名として一致する
      for (const [key, label] of unitMap.entries()) {
        if (label === input) return key;
      }

      // ③ ★ 拡張：unitMap にない数値でも受け入れる
      if (isNumeric) return num;

      // ④ それ以外は不正
      return null;
    }

    // 数値モード
    return isNumeric ? num : null;
  },

  /* --------------------------------------------
     小数点桁数の安全な検出（placeholder 用）
  -------------------------------------------- */
  detectSafeDecimalPlaces(values) {
    if (!values || values.length < 2) return 3;

    const diffs = [];
    for (let i = 1; i < values.length; i++) {
      const d = Math.abs(values[i] - values[i - 1]);
      if (d > 0 && isFinite(d)) diffs.push(d);
    }
    if (diffs.length === 0) return 3;

    const minDiff = Math.min(...diffs);
    const decimals = (minDiff.toString().split(".")[1] || "").length;
    return Math.min(decimals, 6);
  },

  /* --------------------------------------------
     placeholder 用の丸め処理（UI から利用）
  -------------------------------------------- */
  formatYAxisValueForPlaceholder(chart, value) {
    const dataset = chart.data.datasets[0];
    const values = dataset.data.map(p => p.y);

    const safeDecimals = this.detectSafeDecimalPlaces(values);
    return Number(value.toFixed(safeDecimals));
  },

  /* --------------------------------------------
      Y軸の min/max を適用（chart を直接受け取る）
  -------------------------------------------- */
  apply(chart, minVal, maxVal, mode = "dialog") {
    if (!chart) return;

    const dataset = chart.data.datasets[0];
    const unitMap = dataset.unitMap;
    const yScale = chart.options.scales.y;

    const initialMin = chart.$initialMin;
    const initialMax = chart.$initialMax;

    const currentMin = yScale.min ?? initialMin;
    const currentMax = yScale.max ?? initialMax;

    /* --------------------------------------------
        ★ ダイアログの場合は placeholder を使って補完
    -------------------------------------------- */
    if (mode === "dialog") {
      if (minVal === "") minVal = String(currentMin);
      if (maxVal === "") maxVal = String(currentMax);
    }

    /* --------------------------------------------
        ★ 状態 or 数値の判定（逆引き対応）
    -------------------------------------------- */
    const resolve = (value) => {
      const num = Number(value);
      if (unitMap && unitMap.has(num)) return num;

      if (unitMap) {
        for (const [key, label] of unitMap.entries()) {
          if (label === value) return key;
        }
      }

      if (!isNaN(num)) return num;

      return null;
    };

    /* --------------------------------------------
        ★ min/max の判定（状態モード or 数値モード）
    -------------------------------------------- */
    let minNum, maxNum;

    if (unitMap && unitMap.size > 0) {
      // ★ 状態モード
      minNum = resolve(minVal);
      maxNum = resolve(maxVal);

      if (minNum === null) {
        if (mode === "dialog") DialogsUI.showError("最小値が状態名としても数値としても不正です。");
        else alert("最小値が状態名としても数値としても不正です。");
        return;
      }

      if (maxNum === null) {
        if (mode === "dialog") DialogsUI.showError("最大値が状態名としても数値としても不正です。");
        else alert("最大値が状態名としても数値としても不正です。");
        return;
      }

    } else {
      // ★ 数値モード
      minNum = Number(minVal);
      maxNum = Number(maxVal);

      if (isNaN(minNum) || isNaN(maxNum)) {
        if (mode === "dialog") DialogsUI.showError("数値を入力してください。");
        else alert("数値を入力してください。");
        return;
      }
    }

    /* --------------------------------------------
        ★ min / max の大小チェック
    -------------------------------------------- */
    if (minNum === maxNum) {
      if (mode === "dialog") DialogsUI.showError("Y最小とY最大が同じ値です。");
      else alert("Y最小とY最大が同じ値です。");
      return;
    }

    if (minNum > maxNum) {
      if (mode === "dialog") DialogsUI.showError("Y最小はY最大より小さい値を入力してください。");
      else alert("Y最小はY最大より小さい値を入力してください。");
      return;
    }

    /* --------------------------------------------
        ★ ここから実際に Y軸を適用
    -------------------------------------------- */
    chart._manualY = true;

    delete yScale.min;
    delete yScale.max;
    delete yScale.suggestedMin;
    delete yScale.suggestedMax;

    if (chart.scales.y) {
      chart.scales.y._userMin = undefined;
      chart.scales.y._userMax = undefined;
    }

    /* --------------------------------------------
        ★ 状態系（unitMap あり）
        → ラベル変更を Chart.js に反映する処理を追加
    -------------------------------------------- */
    if (unitMap && unitMap.size > 0) {

      console.log("===== [apply][STATE MODE] START =====");
      console.log("[apply] minVal =", minVal, "maxVal =", maxVal);
      console.log("[apply] resolved minNum =", minNum, "resolved maxNum =", maxNum);
      console.log("[apply] initialMin =", initialMin, "initialMax =", initialMax);

      console.log("[apply] BEFORE unitMap keys =", [...unitMap.keys()]);

      /* --------------------------------------------
          ★ 1) minNum〜maxNum の全整数を unitMap に追加
            ラベル名は数値そのものにする
      -------------------------------------------- */
      for (let v = minNum; v <= maxNum; v++) {
        if (unitMap.has(v)) {
          console.log(`[apply] unitMap already has key ${v}`);
          continue;
        }
        console.log(`[apply] unitMap add key ${v}`);
        unitMap.set(v, String(v));
      }

      console.log("[apply] AFTER ADD unitMap keys =", [...unitMap.keys()]);

      /* --------------------------------------------
          ★ 3) ticks.values を unitMap に合わせて更新
      -------------------------------------------- */
      const yKeys = Array.from(unitMap.keys()).sort((a, b) => b - a);
      chart.options.scales.y.ticks.values = [...yKeys];

      console.log("[apply] ticks.values =", chart.options.scales.y.ticks.values);

      /* --------------------------------------------
          min/max の適用
      -------------------------------------------- */
      if (minNum === initialMin) {
        console.log("[apply] using suggestedMin =", minNum);
        yScale.suggestedMin = minNum;
      } else {
        console.log("[apply] using min =", minNum);
        yScale.min = minNum;
      }

      if (maxNum === initialMax) {
        console.log("[apply] using suggestedMax =", maxNum);
        yScale.suggestedMax = maxNum;
      } else {
        console.log("[apply] using max =", maxNum);
        yScale.max = maxNum;
      }

      console.log("[apply] yScale.min =", yScale.min, "yScale.max =", yScale.max);
      console.log("[apply] yScale.suggestedMin =", yScale.suggestedMin, "yScale.suggestedMax =", yScale.suggestedMax);

      console.log("[apply] calling chart.update()");
      chart.update();

      /* --------------------------------------------
          他のチャートにも update をかけて Y軸幅を同期
      -------------------------------------------- */
      charts.forEach(c => {
        if (c && c !== chart) {
          console.log("[apply] updating other chart");
          c.update();
        }
      });

      console.log("===== [apply][STATE MODE] END =====");
      return;
    }

    /* --------------------------------------------
        ★ 数値系（unitMap なし）
    -------------------------------------------- */
    if (minNum === initialMin) yScale.suggestedMin = minNum;
    else yScale.min = minNum;

    if (maxNum === initialMax) yScale.suggestedMax = maxNum;
    else yScale.max = maxNum;

    chart.update();

    // ★ 他のチャートにも update をかけて Y軸幅を同期
    charts.forEach(c => {
      if (c && c !== chart) c.update();
    });
  },

  /* --------------------------------------------
     Y軸リセット（chart を直接受け取る）
     ※ ラベル幅や tick 設定は壊さずに、スケールだけ自動に戻す
  -------------------------------------------- */
  reset(chart) {
    if (!chart) return;

    const yScale = chart.options.scales.y;

    // 手動設定をクリア
    delete yScale.min;
    delete yScale.max;
    delete yScale.suggestedMin;
    delete yScale.suggestedMax;

    if (chart.scales.y) {
      chart.scales.y._userMin = undefined;
      chart.scales.y._userMax = undefined;
    }

    chart._manualY = false;

    // ★★★ 状態モードの visibleYLabels を初期状態に戻す
    const dataset = chart.data.datasets[0];
    const unitMap = dataset.unitMap;

    if (unitMap) {
      const keys = [...unitMap.keys()];
      const min = Math.min(...keys);
      const max = Math.max(...keys);

      const allInts = [];
      for (let v = min; v <= max; v++) {
        allInts.push(v);
      }

      chart._visibleYLabels = new Set(allInts);
    }

    // Chart.js に再計算させる
    chart.update();
  },

  /* --------------------------------------------
    Chart.js: unitMap ありの afterBuildTicks（チェックボックス対応版）
  -------------------------------------------- */
  afterBuildTicks_unit(axis) {
    const chart = axis.chart;
    const dataset = chart.data.datasets[0];
    const unitMap = dataset.unitMap;

    if (!unitMap) return;

    const visible = chart._visibleYLabels;

    const visibleKeys = visible
      ? [...visible].sort((a, b) => b - a)
      : [...unitMap.keys()].sort((a, b) => b - a);

    // manual / auto 共通で「visibleKeys をそのまま ticks にする」
    const ticks = visibleKeys.map(v => ({ value: v }));
    axis.ticks = ticks;
    axis._labelMode = 'full';

    const ctx = axis.ctx || axis.chart.ctx;
    const font = Chart.defaults.font;
    ctx.save();
    ctx.font = `${font.size}px ${font.family}`;

    const labels = axis.ticks.map(t =>
      unitMap.has(t.value) ? unitMap.get(t.value) : String(t.value)
    );

    const maxLabelPx = Math.max(...labels.map(text => ctx.measureText(text).width)) + 12;
    ctx.restore();
    axis._requiredWidth = maxLabelPx;
  },

  /* --------------------------------------------
     Chart.js: afterFit（unitMap あり / なし共通）
  -------------------------------------------- */
  afterFit(axis) {
    const required = Math.max(axis._requiredWidth || 0, globalYAxisWidth || 0);

    if (required > axis.width) {
      axis.width = required;
    }

    if (axis.width > globalYAxisWidth) {
      const was = globalYAxisWidth;
      globalYAxisWidth = axis.width;
    }
  },

  /* --------------------------------------------
    Chart.js: ticks.filter
  -------------------------------------------- */
  filterTick(scale, tick) {
    const chart = scale.chart;
    if (!chart) return true;

    const dataset = chart.data.datasets[0];
    const unitMap = dataset.unitMap;

    /* --------------------------------------------
      ★ 状態モード（unitMap あり）
      → チェックされたラベルだけ表示
    -------------------------------------------- */
    if (unitMap) {
      const visible = chart._visibleYLabels;

      // 可視セットが無ければ全表示
      if (!visible) return true;

      const result = visible.has(tick.value);

      return result;
    }

    /* --------------------------------------------
      ★ 数値モード（unitMap なし）
      → これまでの zeroLine ロジック
    -------------------------------------------- */
    // zeroLine OFF のときは 0 を表示する
    if (chart._zeroLine === false) return true;

    // zeroLine ON のときは 0 を消す
    const result = tick.value !== 0;
    return result;
  },

  /* --------------------------------------------
     Chart.js: ticks.callback
  -------------------------------------------- */
  tickCallback(scale, v, i, ticks, yScale) {
    const chart = scale.chart;
    if (!chart) return v;

    const dataset = chart.data.datasets[0];
    const unitMap = dataset.unitMap;

    // ★ 状態系はここで完結（options.callback に委譲しない）
    if (unitMap) {
      if (unitMap.has(v)) return unitMap.get(v);
      if (Number.isInteger(v)) return v;
      return "";
    }

    // ★ 数値系（zeroLine の ON/OFF）
    if (chart._zeroLine === false) return v;
    if (v === 0) return '';

    if (typeof yScale.ticks?.callback === 'function') {
      return yScale.ticks.callback.call(scale, v, i, ticks);
    }

    return v;
  }
};

/* --------------------------------------------
   グローバル公開
-------------------------------------------- */
window.formatYAxisValueForPlaceholder = YAxisLogic.formatYAxisValueForPlaceholder;
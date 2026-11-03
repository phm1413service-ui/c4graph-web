/* ============================================
   dialogs.events.js
   Y軸ダイアログ：イベント処理（UI と状態管理）
============================================ */

(function () {

  const State = window.DialogsState;
  const UI = window.DialogsUI;

  /* --------------------------------------------
      任意Yライン一覧の描画
  -------------------------------------------- */
  function renderCustomYLinesList(chart, index) {
    const list = document.getElementById("dialogYCustomList");
    list.innerHTML = "";

    const lines = chart._customYLines || [];

    lines.forEach((line, i) => {
      const li = document.createElement("div");
      li.className = "custom-y-line-item";
      li.textContent = `${line.value} (${line.label || ""})`;

      const del = document.createElement("button");
      del.textContent = "削除";
      del.onclick = () => {
        chart._customYLines.splice(i, 1);
        chart.update();
        renderCustomYLinesList(chart, index);
      };

      li.appendChild(del);
      list.appendChild(li);
    });
  }

  /* --------------------------------------------
        ダイアログを開く（完全初期化版）
  -------------------------------------------- */
  window.openYAxisDialog = function (index) {

    /* --------------------------------------------
        ★ UI 初期化（前回の状態を完全リセット）
    -------------------------------------------- */
    UI.clearError();                 // エラー消去
    UI.setApplyEnabled(true);        // 適用ボタンを有効化
    UI.updateStateLabels("", "");    // 状態名ラベル消去

    const minInput = document.getElementById("dialogYMin");
    const maxInput = document.getElementById("dialogYMax");

    minInput.value = "";                    // 入力欄リセット
    maxInput.value = "";

    /* --------------------------------------------
        パネルの状態変更
    -------------------------------------------- */
    const panel = document.getElementById("panel" + index);
    if (panel) panel.classList.add("configuring");

    /* --------------------------------------------
        ダイアログ表示
    -------------------------------------------- */
    const dialog = document.getElementById("yAxisDialog");
    dialog.dataset.index = index;
    dialog.style.display = "block";

    const chart = charts[index];
    if (!chart) return;

    /* --------------------------------------------
        任意Yラインのバックアップ
    -------------------------------------------- */
    chart._backupCustomYLines = chart._customYLines
      ? chart._customYLines.map(l => ({ ...l }))
      : [];
    chart._manualY = true;


    /* --------------------------------------------
        状態モード判定
    -------------------------------------------- */
    const dataset = chart.data.datasets[0];
    const unitMap = dataset.unitMap;
    const isStateMode = !!unitMap;

    State.isStateMode = isStateMode;
    State.unitMap = unitMap;
    /* --------------------------------------------
        ★ ここに input.type 切り替えを入れる！
    -------------------------------------------- */
    if (isStateMode) {
      minInput.type = "text";
      maxInput.type = "text";
    } else {
      minInput.type = "number";
      maxInput.type = "number";
    }

    /* --------------------------------------------
        現在の Y軸 min/max を取得
    -------------------------------------------- */
    const axis = chart.scales.y;
    let axisMin = axis?.min;
    let axisMax = axis?.max;

    if (isStateMode) {
      const keys = [...unitMap.keys()].sort((a, b) => b - a);
      State.autoMax = keys[0];
      State.autoMin = keys[keys.length - 1];
    } else {
      const values = dataset.data.map(p => p.y);
      State.autoMin = Math.min(...values);
      State.autoMax = Math.max(...values);
    }

    if (axisMin == null) axisMin = State.autoMin;
    if (axisMax == null) axisMax = State.autoMax;

    /* --------------------------------------------
        placeholder 設定
    -------------------------------------------- */
    UI.setPlaceholders(
      YAxisLogic.formatYAxisValueForPlaceholder(chart, axisMin),
      YAxisLogic.formatYAxisValueForPlaceholder(chart, axisMax)
    );

    /* --------------------------------------------
        状態名ラベル（UI 専用の表示変換）
    -------------------------------------------- */
    if (isStateMode) {

      const rawMinLabel = unitMap.has(axisMin)
        ? unitMap.get(axisMin)
        : null;

      const rawMaxLabel = unitMap.has(axisMax)
        ? unitMap.get(axisMax)
        : null;

      // ★ UI 専用の「状態名なし」判定
      const minLabel =
        rawMinLabel == null ||
        rawMinLabel === "" ||
        rawMinLabel === String(axisMin)
          ? "（状態名なし）"
          : rawMinLabel;

      const maxLabel =
        rawMaxLabel == null ||
        rawMaxLabel === "" ||
        rawMaxLabel === String(axisMax)
          ? "（状態名なし）"
          : rawMaxLabel;

      UI.updateStateLabels("🛈 " + minLabel, "🛈 " + maxLabel);
    } else {
      UI.updateStateLabels("", "");
    }

    /* --------------------------------------------
        ★ 状態モードのバックアップ（Cancel 用）
    -------------------------------------------- */
    if (isStateMode) {

      // 1) unitMap の完全バックアップ（キー＋ラベル）
      chart._backupUnitMap = new Map(unitMap);

      // 2) visibleYLabels のバックアップ（必ず Set にする）
      chart._backupVisibleYLabels = chart._visibleYLabels
        ? new Set(chart._visibleYLabels)
        : new Set();
    }

    /* --------------------------------------------
        状態一覧の描画
    -------------------------------------------- */
    if (isStateMode) {

      UI.renderUnitTable(unitMap);
      UI.showUnitTable();
      UI.highlightStateRows(axisMin, axisMax);

    } else {
      UI.hideUnitTable();
    }

    /* --------------------------------------------
        step 設定
    -------------------------------------------- */
    if (!isStateMode) {
      const values = dataset.data.map(p => p.y);
      const step = UI.detectSafeStep(values);
      minInput.step = step;
      maxInput.step = step;
    } else {
      minInput.step = 1;
      maxInput.step = 1;
    }

    UI.prepareNumberInput(minInput);
    UI.prepareNumberInput(maxInput);
    UI.updateUnitTableInteractivity();

    /* --------------------------------------------
            0 ラインスイッチ（完全プレビュー対応版）
    -------------------------------------------- */
    const zeroLineGroup = document.querySelector(".y-input-group.zero-line-group");
    const zeroLineInput = document.getElementById("yAxisZeroLine");
    const switchElem = zeroLineGroup.querySelector(".switch");

    if (isStateMode) {
      zeroLineGroup.style.display = "none";
    } else {
      zeroLineGroup.style.display = "";
      zeroLineInput.checked = (chart._zeroLine !== false);
      zeroLineInput.disabled = false;

      if (!zeroLineGroup._boundClickForZeroLine) {

        switchElem.addEventListener("click", () => {

          // ① 状態を反転
          zeroLineInput.checked = !zeroLineInput.checked;

          // ② プレビュー用に chart._zeroLine を更新
          chart._zeroLine = zeroLineInput.checked;

          // ③ 即時プレビュー
          chart.update();

          // ④ change イベントも発火（適用ボタン用）
          zeroLineInput.dispatchEvent(new Event("change", { bubbles: true }));
        });

        zeroLineGroup._boundClickForZeroLine = true;
      }
    }

    /* --------------------------------------------
        バックアップ（Cancel 用）
    -------------------------------------------- */

    // ★ ここに追加（manualY のバックアップ）
    chart._backupManualY = chart._manualY;

    const yScale = chart.options.scales.y;

    chart._backupActualMin = axis.min;
    chart._backupActualMax = axis.max;

    chart._backupHadMin = (yScale.min !== undefined && yScale.min !== null);
    chart._backupHadMax = (yScale.max !== undefined && yScale.max !== null);

    chart._backupSuggestedMin = yScale.suggestedMin;
    chart._backupSuggestedMax = yScale.suggestedMax;

    chart._backupTicksValues = yScale.ticks?.values
      ? [...yScale.ticks.values]
      : null;

    chart._backupZeroLine = chart._zeroLine;

    /* --------------------------------------------
              任意Yライン UI 初期化
    -------------------------------------------- */
    const customLineInput = document.getElementById("dialogYCustomLine");
    const customLineAddBtn = document.getElementById("dialogYCustomAdd");
    const customYError = document.getElementById("customYError");

    customLineInput.value = "";
    renderCustomYLinesList(chart, index);

    // ★ Enter キーで追加
    customLineInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        customLineAddBtn.click();
      }
    });

    // ★★★ 入力が変わった瞬間にエラーを消す（重要） ★★★
    customLineInput.addEventListener("input", () => {
      customYError.textContent = "";
      customYError.classList.remove("show");
    });

    customLineAddBtn.onclick = () => {

      customYError.textContent = "";
      customYError.classList.remove("show");

      const raw = customLineInput.value.trim();

      // ① 空欄チェック
      if (raw === "") {
        customYError.textContent = "Yラインの値を入力してください。";
        customYError.classList.add("show");
        return;
      }

      // ② 数値チェック
      const v = Number(raw);
      if (!isFinite(v)) {
        customYError.textContent = "数値を入力してください。";
        customYError.classList.add("show");
        return;
      }

      // ★★★ ③ 0 を禁止する（ここが重要） ★★★
      if (v === 0) {
        customYError.textContent = "0 は追加できません。";
        customYError.classList.add("show");
        return;
      }

      if (!chart._customYLines) chart._customYLines = [];

      // ④ 重複チェック
      const exists = chart._customYLines.some(line => line.value === v);
      if (exists) {
        customYError.textContent = `Y=${v} はすでに追加されています。`;
        customYError.classList.add("show");
        return;
      }

      // ⑤ 正常追加
      chart._customYLines.push({
        value: v,
        label: `Y=${v}`,
        color: null
      });

      chart.update();
      renderCustomYLinesList(chart, index);

      customLineInput.value = "";
    };
  };

  /* --------------------------------------------
      ダイアログを閉じる
  -------------------------------------------- */
  window.closeYAxisDialog = function () {
    const dialog = document.getElementById("yAxisDialog");
    dialog.style.display = "none";

    const idx = Number(dialog.dataset.index);
    const panel = document.getElementById("panel" + idx);
    if (panel) panel.classList.remove("configuring");

    State.clearFocusedField();
  };

  /* --------------------------------------------
      キャンセル（元に戻す）
  -------------------------------------------- */
  window.cancelYAxisDialog = function () {
    const dialog = document.getElementById("yAxisDialog");
    const idx = Number(dialog.dataset.index);
    const chart = charts[idx];
    if (!chart) return;

    const yScale = chart.options.scales.y;

    const hadMin = chart._backupHadMin;
    const hadMax = chart._backupHadMax;

    /* ① min/max の復元 */
    if (!hadMin && !hadMax) {
      delete yScale.min;
      delete yScale.max;

      if (chart._backupSuggestedMin != null) yScale.suggestedMin = chart._backupSuggestedMin;
      else delete yScale.suggestedMin;

      if (chart._backupSuggestedMax != null) yScale.suggestedMax = chart._backupSuggestedMax;
      else delete yScale.suggestedMax;

    } else if (hadMin && hadMax) {
      yScale.min = chart._backupActualMin;
      yScale.max = chart._backupActualMax;

    } else if (hadMax && !hadMin) {
      yScale.max = chart._backupActualMax;
      delete yScale.min;

      if (chart._backupSuggestedMin != null) yScale.suggestedMin = chart._backupSuggestedMin;
      else delete yScale.suggestedMin;

    } else if (hadMin && !hadMax) {
      yScale.min = chart._backupActualMin;
      delete yScale.max;

      if (chart._backupSuggestedMax != null) yScale.suggestedMax = chart._backupSuggestedMax;
      else delete yScale.suggestedMax;
    }

    /* ③ 任意Yライン */
    chart._customYLines = chart._backupCustomYLines
      ? chart._backupCustomYLines.map(l => ({ ...l }))
      : [];

    /* ★★★ unitMap の復元（最重要） ★★★ */
    const dataset = chart.data.datasets[0];
    if (chart._backupUnitMap) {
      dataset.unitMap.clear();
      for (const [k, v] of chart._backupUnitMap.entries()) {
        dataset.unitMap.set(k, v);
      }
    }

    /* ★ チェックボックス（可視ラベル）の復元 */
    if (chart._backupVisibleYLabels) {
      chart._visibleYLabels = new Set(chart._backupVisibleYLabels);
    }

    /* ★ ticks.values を削除（これが重要） */
    if (yScale.ticks && yScale.ticks.values) {
      delete yScale.ticks.values;
    }

    /* ④ zeroLine */
    chart._zeroLine = chart._backupZeroLine;

    /* ⑤ 内部フラグクリア */
    const scale = chart.scales.y;
    if (scale) {
      scale._userMin = undefined;
      scale._userMax = undefined;
    }

    chart._manualY = chart._backupManualY;
    chart.update();
    closeYAxisDialog();
  };

  /* --------------------------------------------
        適用ボタン
  -------------------------------------------- */
  window.applyYAxisRangeFromDialog = function () {
    const dialog = document.getElementById("yAxisDialog");
    const idx = Number(dialog.dataset.index);
    const chart = charts[idx];
    if (!chart) return;

    const dataset = chart.data.datasets[0];
    const unitMap = dataset.unitMap;
    const minVal = document.getElementById("dialogYMin").value;
    const maxVal = document.getElementById("dialogYMax").value;
    /* ★★★ 状態モードでも apply() を必ず呼ぶ ★★★ */
    YAxisLogic.apply(chart, minVal, maxVal);
    
    const zeroLineInput = document.getElementById("yAxisZeroLine");

    /* --------------------------------------------
          ★ 状態モードなら apply() を呼ばない
    -------------------------------------------- */
    if (!unitMap) {
      // 数値モードのみ apply を実行
      YAxisLogic.apply(chart, minVal, maxVal);

      // ゼロラインも数値モードのみ
      chart._zeroLine = zeroLineInput.checked;
    }

    /* --------------------------------------------
          ★ 状態一覧 UI を apply 後に更新
    -------------------------------------------- */
    if (unitMap) {
      UI.renderUnitTable(unitMap);
      UI.showUnitTable();
    }

    /* --------------------------------------------
          ★ グラフ更新（visibleYLabels を使って描画）
    -------------------------------------------- */
    chart.update();

    /* --------------------------------------------
          ★ バックアップ更新
    -------------------------------------------- */
    const scale = chart.scales.y;
    const yScale = chart.options.scales.y;

    chart._backupActualMin = scale.min;
    chart._backupActualMax = scale.max;

    chart._backupHadMin = (yScale.min !== undefined && yScale.min !== null);
    chart._backupHadMax = (yScale.max !== undefined && yScale.max !== null);

    chart._backupCustomYLines = chart._customYLines
      ? chart._customYLines.map(l => ({ ...l }))
      : [];

    /* --------------------------------------------
          ★ ダイアログを閉じる & 状態保存
    -------------------------------------------- */
    closeYAxisDialog();
    saveStateToLocalStorage();
  };

  /* --------------------------------------------
      自動に戻す（プレビュー＋反映）
  -------------------------------------------- */
  document.getElementById("yResetBtn").onclick = () => {

    const dialog = document.getElementById("yAxisDialog");
    const idx = Number(dialog.dataset.index);
    const chart = charts[idx];
    if (!chart) return;

    const dataset = chart.data.datasets[0];
    const unitMap = dataset.unitMap;
    const yScale = chart.options.scales.y;

    if (unitMap) {

      /* ★★★ unitMap を初期状態に戻す ★★★ */
      const original = chart._originalUnitMap;
      if (original) {

        // いったん全部削除
        unitMap.clear();

        /* ★★★ unitMap を初期状態に戻す ★★★ */
        const original = chart._originalUnitMap;
        const originalLabels = chart._originalUnitMapLabels;

        if (original && originalLabels) {

          // いったん全部削除
          unitMap.clear();

          // 初期状態を復元（ラベルは元の unitMap の値を使う）
          for (const key of original) {
            const originalLabel = originalLabels.get(key);  // ← 修正ポイント
            unitMap.set(key, originalLabel);
          }
        }
      }

/* ★ ticks.values を初期状態に戻す（全キー） */
const keys = [...unitMap.keys()].sort((a, b) => b - a);

yScale.ticks.values = keys;

/* ★ visibleYLabels も初期状態に戻す */
chart._visibleYLabels = new Set(keys);

      /* ★ min/max を初期状態に戻す */
      const minKey = Math.min(...keys);
      const maxKey = Math.max(...keys);

      yScale.suggestedMin = minKey;
      yScale.suggestedMax = maxKey;

      delete yScale.min;
      delete yScale.max;

      if (chart.scales.y) {
        chart.scales.y._userMin = undefined;
        chart.scales.y._userMax = undefined;
      }

      /* ★ visibleYLabels も初期状態に戻す */
      chart._visibleYLabels = new Set(keys);

      chart._manualY = false;
      chart.update();

      /* ★★★ 状態一覧 UI を初期状態に戻す（プレビュー） ★★★ */
      UI.renderUnitTable(unitMap);
      UI.showUnitTable();
      /* ★★★ 色付けも初期状態に戻す ★★★ */
      UI.highlightStateRows(minKey, maxKey);
      /* ★★★ 状態名ラベルも初期状態に戻す（これが必要） ★★★ */
      const minLabel = unitMap.get(minKey) || "（状態名なし）";
      const maxLabel = unitMap.get(maxKey) || "（状態名なし）";
      UI.updateStateLabels("🛈 " + minLabel, "🛈 " + maxLabel);

    } else {
      /* 数値系：完全初期化 */
      delete yScale.min;
      delete yScale.max;
      delete yScale.suggestedMin;
      delete yScale.suggestedMax;

      if (chart.scales.y) {
        chart.scales.y._userMin = undefined;
        chart.scales.y._userMax = undefined;
      }

      chart._manualY = false;
      chart.update();
    }

    /* UI の placeholder を初期値に戻す */
    const minInput = document.getElementById("dialogYMin");
    const maxInput = document.getElementById("dialogYMax");

    const safeMin = formatYAxisValueForPlaceholder(chart, chart.$initialMin);
    const safeMax = formatYAxisValueForPlaceholder(chart, chart.$initialMax);

    minInput.placeholder = safeMin;
    maxInput.placeholder = safeMax;

    minInput.value = "";
    maxInput.value = "";
  };

  /* --------------------------------------------
      フォーカス管理
  -------------------------------------------- */
  const minInput = document.getElementById("dialogYMin");
  const maxInput = document.getElementById("dialogYMax");

  minInput.addEventListener("focus", () => {
    State.setFocusedField("min");
    UI.updateUnitTableInteractivity();
  });

  maxInput.addEventListener("focus", () => {
    State.setFocusedField("max");
    UI.updateUnitTableInteractivity();
  });

  /* --------------------------------------------
      入力時：UI 更新（エラー表示など）
  -------------------------------------------- */
  const liveHandler = () => {
    const dialog = document.getElementById("yAxisDialog");
    const idx = Number(dialog.dataset.index);
    const chart = charts[idx];
    if (!chart) return;

    const dataset = chart.data.datasets[0];
    const unitMap = dataset.unitMap;
    const isStateMode = State.isStateMode;

    // ★ placeholder を値として扱う（A仕様）
    const rawMin = minInput.value === "" ? minInput.placeholder : minInput.value;
    const rawMax = maxInput.value === "" ? maxInput.placeholder : maxInput.value;

    // 毎回最初にエラーを消す
    UI.clearError();

    /* --------------------------------------------
        ★ 状態名表示（状態モードのみ）
    -------------------------------------------- */
    if (isStateMode) {

      const minKey = YAxisLogic.resolveStateValue(rawMin, unitMap);
      const maxKey = YAxisLogic.resolveStateValue(rawMax, unitMap);

      // ★ unitMap から取得（存在しない or 数値そのものなら「状態名なし」）
      const rawMinLabel = (minKey !== null && unitMap.has(minKey))
        ? unitMap.get(minKey)
        : null;

      const rawMaxLabel = (maxKey !== null && unitMap.has(maxKey))
        ? unitMap.get(maxKey)
        : null;

      // ★ UI 専用の表示変換（グラフには影響しない）
      const minLabel =
        rawMinLabel == null || rawMinLabel === "" || rawMinLabel === String(minKey)
          ? "（状態名なし）"
          : rawMinLabel;

      const maxLabel =
        rawMaxLabel == null || rawMaxLabel === "" || rawMaxLabel === String(maxKey)
          ? "（状態名なし）"
          : rawMaxLabel;
      UI.updateStateLabels("🛈 " + minLabel, "🛈 " + maxLabel);
    }

    /* --------------------------------------------
        バリデーション
    -------------------------------------------- */
    let hasError = false;

    let minKey, maxKey;

    if (isStateMode) {
      // ★ 状態モード：状態名 or 状態キー or 数値
      minKey = YAxisLogic.resolveStateValue(rawMin, unitMap);
      maxKey = YAxisLogic.resolveStateValue(rawMax, unitMap);

      if (minKey === null) {
        UI.showError("最小値が状態名でも数値でもありません。");
        hasError = true;
      }
      if (maxKey === null) {
        UI.showError("最大値が状態名でも数値でもありません。");
        hasError = true;
      }

    } else {
      // ★ 数値モードでも resolveStateValue を使う
      const minResolved = YAxisLogic.resolveStateValue(rawMin, null);
      const maxResolved = YAxisLogic.resolveStateValue(rawMax, null);

      if (minResolved === null) {
        UI.showError("最小値が数値として不正です。");
        hasError = true;
      }
      if (!hasError && maxResolved === null) {
        UI.showError("最大値が数値として不正です。");
        hasError = true;
      }

      minKey = minResolved;
      maxKey = maxResolved;
    }

    /* --------------------------------------------
        min / max の大小チェック（共通）
    -------------------------------------------- */
    if (!hasError) {
      if (minKey === maxKey) {
        UI.showError("Y最小とY最大が同じ値です。");
        hasError = true;
      } else if (minKey > maxKey) {
        UI.showError("Y最小はY最大より小さい値を入力してください。");
        hasError = true;
      }
    }

    /* --------------------------------------------
        ★ 状態一覧にない数字を一時的に追加（プレビュー）
    -------------------------------------------- */
    if (isStateMode && minKey !== null && maxKey !== null) {

      for (let v = minKey; v <= maxKey; v++) {
        if (!unitMap.has(v)) {
          unitMap.set(v, String(v)); // ラベルは数値

          // ★★★ これが必要：visibleYLabels にも追加する
          if (chart._visibleYLabels) chart._visibleYLabels.add(v);
        }
      }

      UI.renderUnitTable(unitMap);
      UI.highlightStateRows(minKey, maxKey);
    }

    /* --------------------------------------------
        ★ 状態名なしの削除（動的追加された状態の整理）
    -------------------------------------------- */
    if (isStateMode) {
      const visible = chart._visibleYLabels || new Set();
      const original = chart._originalUnitMap || new Set();

      for (const key of [...unitMap.keys()]) {
        const isOriginal = original.has(key);

        // 元からある状態は絶対に消さない
        if (isOriginal) continue;

        // ★★★ minKey〜maxKey の範囲内は絶対に残す
        if (key >= minKey && key <= maxKey) continue;

        // ★★★ 範囲外だけ削除
        unitMap.delete(key);
      }

      UI.renderUnitTable(unitMap);
    }

    /* ★★★ 追加：削除後に色を塗り直す ★★★ */
    if (isStateMode && !hasError && minKey !== null && maxKey !== null) {
      UI.highlightStateRows(minKey, maxKey);
    }

    UI.setApplyEnabled(!hasError);
  };

  minInput.addEventListener("input", liveHandler);
  maxInput.addEventListener("input", liveHandler);

  /* --------------------------------------------
      Enter キーの挙動
  -------------------------------------------- */
  maxInput.addEventListener("keydown", e => {
    if (e.key === "Enter") {
      e.preventDefault();
      minInput.focus();
      minInput.select();
    }
  });

  minInput.addEventListener("keydown", e => {
    if (e.key === "Enter") {
      e.preventDefault();
      document.querySelector(".y-apply-btn").click();
    }
  });

/* --------------------------------------------
    blur 時にだけ Y 軸を反映
-------------------------------------------- */
minInput.addEventListener("blur", () => {
  const dialog = document.getElementById("yAxisDialog");
  const idx = Number(dialog.dataset.index);
  const chart = charts[idx];
  if (!chart) return;

  const dataset = chart.data.datasets[0];
  const unitMap = dataset.unitMap;   // ★ これが必要

  const minVal = minInput.value;
  const maxVal = maxInput.value;

  // ★ 数値モードだけ apply を実行
  if (!unitMap) {
    YAxisLogic.apply(chart, minVal, maxVal, "dialog");
    chart.update();
  }
});

maxInput.addEventListener("blur", () => {
  const dialog = document.getElementById("yAxisDialog");
  const idx = Number(dialog.dataset.index);
  const chart = charts[idx];
  if (!chart) return;

  const minVal = minInput.value;
  const maxVal = maxInput.value;

  if (!isNaN(Number(maxVal)) || maxVal === "") {
    YAxisLogic.apply(chart, minVal, maxVal, "dialog");  // ★ ここが重要
    chart.update();
  }
});

})();
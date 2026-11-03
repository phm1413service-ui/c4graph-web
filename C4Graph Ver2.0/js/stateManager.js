// stateManager.js
// C4Graph：完全再生成方式の状態保存・復元（X軸スライダー方式・最終版）

// ===============================
//  保存（状態収集）
// ===============================

function getCurrentPanelOrder() {
  return Array.from(document.querySelectorAll('#graphs .chart-panel'))
    .map(p => parseInt(p.id.replace('panel', ''), 10));
}

function getVisibleChartsState() {
  const max = seriesData?.length ?? 0;
  const arr = [];
  for (let i = 0; i < max; i++) {
    arr[i] = !!charts[i];
  }
  return arr;
}

function collectSelectedCharts() {
  return Array.isArray(selectedChartIndices)
    ? [...selectedChartIndices]
    : [];
}

function collectChartsState() {
  const max = seriesData?.length ?? 0;
  const arr = [];

  for (let i = 0; i < max; i++) {
    const chart = charts[i];
    if (!chart) {
      arr[i] = null;
      continue;
    }

    const ys = chart.options.scales.y;
    const xs = chart.options.scales.x;
    const dataset = chart.data.datasets[0];
    const unitMap = dataset.unitMap;

    // ★ 動的追加された状態キー（元の unitMap との差分）
    let dynamicUnitKeys = null;
    if (unitMap && chart._originalUnitMap) {
      dynamicUnitKeys = [];
      for (const key of unitMap.keys()) {
        if (!chart._originalUnitMap.has(key)) {
          dynamicUnitKeys.push(key);
        }
      }
    }

    // ★ 可視ラベルセット
    const visibleYLabels = chart._visibleYLabels
      ? Array.from(chart._visibleYLabels)
      : null;

    arr[i] = {
      manualY: !!chart._manualY,

      // ★ min / max / suggestedMin / suggestedMax をすべて保存
      yMin: ys.min ?? null,
      yMax: ys.max ?? null,
      ySuggestedMin: ys.suggestedMin ?? null,
      ySuggestedMax: ys.suggestedMax ?? null,

      zeroLine: ys.zeroLine !== false,

      xMin: xs.min ?? null,
      xMax: xs.max ?? null,

      userLines: chart._userLines ? [...chart._userLines] : null,

      // ★ 任意Yライン
      customYLines: chart._customYLines ? [...chart._customYLines] : null,

      // ★ 追加：動的に追加された状態キー
      dynamicUnitKeys,

      // ★ 追加：可視ラベル
      visibleYLabels
    };
  }
  return arr;
}

function collectCurrentState() {
  const minHeight = Number(document.getElementById('minHeightInput')?.value) || 200;

  const uiMinRaw = document.getElementById("xRangeMin")?.value;
  const uiMaxRaw = document.getElementById("xRangeMax")?.value;

  const uiMin = (uiMinRaw !== "" && !isNaN(Number(uiMinRaw))) ? Number(uiMinRaw) : null;
  const uiMax = (uiMaxRaw !== "" && !isNaN(Number(uiMaxRaw))) ? Number(uiMaxRaw) : null;

  // ★ UI優先
  let sliderMin = (uiMin != null) ? uiMin : window.userMinX;
  let sliderMax = (uiMax != null) ? uiMax : window.userMaxX;

  // ★ フォールバック
  if (sliderMin == null || sliderMax == null) {
    let xMin = Infinity;
    let xMax = -Infinity;

    charts.forEach(c => {
      if (!c) return;
      const xs = c.scales?.x;
      if (!xs) return;
      if (xs.min != null && xs.min < xMin) xMin = xs.min;
      if (xs.max != null && xs.max > xMax) xMax = xs.max;
    });

    if (isFinite(xMin) && isFinite(xMax)) {
      if (sliderMin == null) sliderMin = xMin;
      if (sliderMax == null) sliderMax = xMax;
    } else {
      if (sliderMin == null) sliderMin = 0;
      if (sliderMax == null) sliderMax = 1;
    }
  }

  return {
      panelOrder: getCurrentPanelOrder(),
      visibleCharts: getVisibleChartsState(),
      selectedCharts: collectSelectedCharts(),
      charts: collectChartsState(),
      minHeightInput: minHeight,

      crosshairLeft: sharedTimeValueLeft ?? null,
      crosshairRight: sharedTimeValueRight ?? null,
      fixedLinesByMode: {
        normal: { ...(window.fixedLinesByMode?.normal || {}) },
        overlay: { ...(window.fixedLinesByMode?.overlay || {}) },
        [window.overlayMode ? "overlay" : "normal"]: {
          left: sharedTimeValueLeft,
          right: sharedTimeValueRight
        }
      },

      sliderMinX: sliderMin,
      sliderMaxX: sliderMax,

      triggerRate: window.metaInfo?.["Trigger Rate"]?.[0] ?? null,

      markerEnabled: window.globalMarkerEnabled,
      markerEnabledByMode: {
        ...window.markerEnabledByMode,
        [window.overlayMode ? "overlay" : "normal"]: window.globalMarkerEnabled
      },
      hairlineValuesEnabledByMode: {
        ...window.hairlineValuesEnabledByMode,
        [window.overlayMode ? "overlay" : "normal"]:
          document.getElementById("toggleHairlineValues")?.checked !== false
      },
      crosshairValueLabels: {
        normal: window.crosshairValueLabelsByMode?.normal !== false,
        overlay: window.crosshairValueLabelsByMode?.overlay !== false
      },
      overlayMode: !!window.overlayMode,
      overlayVisibleCharts: window.overlayVisibleSeries instanceof Set
        ? Array.from(window.overlayVisibleSeries)
        : null,
      overlaySelectedCharts: window.overlaySelectedSeries instanceof Set
        ? Array.from(window.overlaySelectedSeries)
        : [],
      overlayYAxisSettings: Object.fromEntries(
        Object.entries(window.overlayYAxisSettings || {})
          .filter(([, settings]) => settings && typeof settings === "object")
          .map(([index, settings]) => [index, {
            min: Number.isFinite(settings.min) ? settings.min : null,
            max: Number.isFinite(settings.max) ? settings.max : null
          }])
      ),
      overlayHeightInput: Number(document.getElementById("overlayHeightInput")?.value) || 350,
      overlayHeightAuto: window.overlayHeightAuto !== false,

      // ★ 追加：C3P フラグを保存
      isC3P: window.__isC3P,

      // ★ コンパクトモードの状態を保存
      compactMode: window.CompactMode ? {
        isActive: CompactMode.isActive,
        panelSettings: CompactMode.getPanelSettings()
      } : null
  };
}

function exportStateToJSON() {
  const state = collectCurrentState();
  return JSON.stringify(state, null, 2);
}


// ===============================
//  復元（完全再生成方式）
// ===============================

function destroyAllCharts() {
  const max = charts.length;
  for (let i = 0; i < max; i++) {
    if (charts[i]) toggleChart(i, false);
  }
}

function recreateSingleChart(idx, state) {
  const visible = state.visibleCharts ?? [];
  if (!visible[idx]) return;

  // グラフ追加
  toggleChart(idx, true);

  // ★ 子チェックボックスを ON
  const chk = document.querySelector(`input[data-index="${idx}"]`);
  if (chk) chk.checked = true;

  // ★ 親ECUの状態を更新（全選択と同じ動作）
  const ecuName = seriesData[idx].meta.ecu;
  const parentChk = document.getElementById("parent-" + ecuName);
  if (parentChk) {
    const children = seriesData
      .map((s, i) => ({ ...s, index: i }))
      .filter(s => s.meta.ecu === ecuName);
    updateParentState(parentChk, children);
  }
}

function restoreYAxis(chart, saved) {
  if (!chart || !saved) return;

  const yScale = chart.options.scales.y;

  chart._manualY = !!saved.manualY;

  // ★ 自動モードなら完全リセット
  if (!chart._manualY) {
    resetYAxis(chart);
    return;
  }

  // ★ 手動モード：min / suggestedMin のどちらを使うか判定
  if (saved.yMin != null) {
    // 手動設定された min
    yScale.min = saved.yMin;
  } else if (saved.ySuggestedMin != null) {
    // 初期値に戻した状態（suggestedMin を使う）
    yScale.suggestedMin = saved.ySuggestedMin;
  }

  if (saved.yMax != null) {
    yScale.max = saved.yMax;
  } else if (saved.ySuggestedMax != null) {
    yScale.suggestedMax = saved.ySuggestedMax;
  }
}

function restoreSelectedCharts(selected) {
  selectedChartIndices = Array.isArray(selected) ? [...selected] : [];

  document.querySelectorAll('.chart-panel.selected')
    .forEach(p => p.classList.remove('selected'));
  document.querySelectorAll('#controls .chip.selected')
    .forEach(c => c.classList.remove('selected'));

  selectedChartIndices.forEach(idx => {
    const p = document.getElementById('panel' + idx);
    if (p) p.classList.add('selected');

    const chip = document.querySelector(`#controls .chip input[data-index="${idx}"]`)?.parentElement;
    if (chip) chip.classList.add('selected');
  });
}

function restorePanelOrder(order) {
  const graphs = document.getElementById('graphs');
  if (!graphs || !Array.isArray(order)) return;

  order.forEach(idx => {
    const p = document.getElementById('panel' + idx);
    if (p) graphs.appendChild(p);
  });
}

function restoreMinHeightInput(v) {
  const el = document.getElementById('minHeightInput');
  if (el && typeof v === 'number') el.value = v;
}

async function applyStateFromObject(state, updateProgress = null) {
  if (!state || !Array.isArray(seriesData) || seriesData.length === 0) {
    console.warn("applyStateFromObject: CSV 読み込み後に呼び出してください。");
    return;
  }

  if (typeof window.setOverlayMode === "function") {
    window.setOverlayMode(false, { save: false });
  }
  if (state.fixedLinesByMode && typeof state.fixedLinesByMode === "object") {
    for (const mode of ["normal", "overlay"]) {
      const saved = state.fixedLinesByMode[mode];
      window.fixedLinesByMode[mode] = {
        left: Number.isFinite(saved?.left) ? saved.left : null,
        right: Number.isFinite(saved?.right) ? saved.right : null
      };
    }
  } else {
    const legacyMode = state.overlayMode ? "overlay" : "normal";
    window.fixedLinesByMode = {
      normal: { left: null, right: null },
      overlay: { left: null, right: null }
    };
    window.fixedLinesByMode[legacyMode] = {
      left: Number.isFinite(state.crosshairLeft) ? state.crosshairLeft : null,
      right: Number.isFinite(state.crosshairRight) ? state.crosshairRight : null
    };
  }
  window.activateFixedLinesForMode(false);
  if (typeof window.restoreOverlaySeriesSelection === "function") {
    window.restoreOverlaySeriesSelection(state.overlayVisibleCharts);
  }
  window.overlaySelectedSeries = new Set(
    Array.isArray(state.overlaySelectedCharts)
      ? state.overlaySelectedCharts.filter(index =>
        Number.isInteger(index) && index >= 0 && index < seriesData.length
      )
      : []
  );
  window.overlayYAxisSettings = {};
  if (state.overlayYAxisSettings && typeof state.overlayYAxisSettings === "object") {
    Object.entries(state.overlayYAxisSettings).forEach(([index, settings]) => {
      const seriesIndex = Number(index);
      if (
        !Number.isInteger(seriesIndex) ||
        seriesIndex < 0 ||
        seriesIndex >= seriesData.length ||
        !settings ||
        typeof settings !== "object"
      ) return;

      const min = Number.isFinite(settings.min) ? settings.min : null;
      const max = Number.isFinite(settings.max) ? settings.max : null;
      if (min === null && max === null) return;
      if (min !== null && max !== null && min >= max) {
        console.warn(`状態復元: 重ねグラフのY軸範囲が不正なため信号 ${seriesIndex} の設定を無視します。`);
        return;
      }
      window.overlayYAxisSettings[seriesIndex] = { min, max };
    });
  }
  const overlayHeightInput = document.getElementById("overlayHeightInput");
  window.overlayHeightAuto = state.overlayHeightAuto !== false;
  document.getElementById("overlayHeightAutoButton")
    ?.setAttribute("aria-pressed", String(window.overlayHeightAuto));
  if (overlayHeightInput && Number.isFinite(Number(state.overlayHeightInput))) {
    overlayHeightInput.value = String(Math.min(3000, Math.max(150, Number(state.overlayHeightInput))));
  }

  // 1. モード別表示設定の復元
  const savedMarkerSettings = state.markerEnabledByMode;
  const legacyMarkerSetting = state.markerEnabled !== false;
  window.markerEnabledByMode = {
    normal: typeof savedMarkerSettings?.normal === "boolean"
      ? savedMarkerSettings.normal
      : legacyMarkerSetting,
    overlay: typeof savedMarkerSettings?.overlay === "boolean"
      ? savedMarkerSettings.overlay
      : legacyMarkerSetting
  };
  const savedHairlineSettings = state.hairlineValuesEnabledByMode;
  const legacyHairlineSetting =
    document.getElementById("toggleHairlineValues")?.checked !== false;
  window.hairlineValuesEnabledByMode = {
    normal: typeof savedHairlineSettings?.normal === "boolean"
      ? savedHairlineSettings.normal
      : legacyHairlineSetting,
    overlay: typeof savedHairlineSettings?.overlay === "boolean"
      ? savedHairlineSettings.overlay
      : legacyHairlineSetting
  };
  const activeMode = window.overlayMode ? "overlay" : "normal";
  window.globalMarkerEnabled = window.markerEnabledByMode[activeMode];
  const markerToggle = document.getElementById("toggleMarkers");
  if (markerToggle) markerToggle.checked = window.globalMarkerEnabled;
  const hairlineToggle = document.getElementById("toggleHairlineValues");
  if (hairlineToggle) {
    hairlineToggle.checked = window.hairlineValuesEnabledByMode[activeMode];
  }
  const savedCrosshairLabels = state.crosshairValueLabels;
  if (savedCrosshairLabels && typeof savedCrosshairLabels === "object") {
    window.crosshairValueLabelsByMode = {
      normal: savedCrosshairLabels.normal !== false,
      overlay: savedCrosshairLabels.overlay !== false
    };
  } else {
    const legacyValue = savedCrosshairLabels !== false;
    window.crosshairValueLabelsByMode = {
      normal: legacyValue,
      overlay: legacyValue
    };
  }
  const crosshairValueToggle = document.getElementById("toggleCrosshairValueLabels");
  if (crosshairValueToggle) {
    crosshairValueToggle.checked = window.getCrosshairValueLabelsEnabled(false);
  }

  // 2. Trigger Rate の復元
  if (state.triggerRate != null) {
    if (!window.metaInfo) window.metaInfo = {};
    window.metaInfo["Trigger Rate"] = [state.triggerRate];
  }

  // 3. 破棄 → 最低高さ
  await new Promise(r => setTimeout(r));   // ★★★ これを追加
  destroyAllCharts();
  restoreMinHeightInput(state.minHeightInput);

  // ★★★★★ 全選択と同じ「1チャートずつ生成」方式にする ★★★★★
  const order = state.panelOrder ?? [];
  const visible = state.visibleCharts ?? [];
  const total = order.length;

  suppressChartUpdates = true;

  for (let i = 0; i < total; i++) {

    // 中断判定
    if (window.__cancelLoading) {
      console.warn("状態復元：ユーザーが中断しました");
      suppressChartUpdates = false;
      refreshAxes();
      fixChartHeights();
      return;
    }

    const idx = order[i];

    if (visible[idx]) {
      recreateSingleChart(idx, state);  // ← panelOrder に従って生成
    }

    // プログレス更新
    if (updateProgress) {
      updateProgress(Math.floor((i + 1) / total * 100));
    }

    // UI に制御を返す
    await new Promise(r => setTimeout(r));
  }

  suppressChartUpdates = false;

  // パネル順復元
  restorePanelOrder(state.panelOrder);

  // 4. Y軸・0ライン復元
  const chartsState = state.charts ?? [];
  for (let i = 0; i < charts.length; i++) {
    const chart = charts[i];
    const saved = chartsState[i];
    if (!chart || !saved) continue;

    if (saved.manualY) restoreYAxis(chart, saved);

    const yScale = chart.options.scales.y;
    const dataset = chart.data.datasets[0];

    if (!dataset.unitMap && saved.zeroLine !== undefined) {
      yScale.zeroLine = saved.zeroLine !== false;
    }

    if (saved.userLines) chart._userLines = [...saved.userLines];
    if (saved.customYLines) chart._customYLines = [...saved.customYLines];
  }

  // ★★★★★ 状態モードの動的復元 ★★★★★
  for (let i = 0; i < charts.length; i++) {
    const chart = charts[i];
    const saved = chartsState[i];
    if (!chart || !saved) continue;

    const dataset = chart.data.datasets[0];
    const unitMap = dataset.unitMap;

    // 状態モードでなければスキップ
    if (!unitMap) continue;

    /* --------------------------------------------
        1) 動的追加された状態キーを復元
    -------------------------------------------- */
    if (Array.isArray(saved.dynamicUnitKeys)) {
      for (const key of saved.dynamicUnitKeys) {
        if (!unitMap.has(key)) {
          unitMap.set(key, String(key)); // ラベル名は数値
        }
      }
    }

    /* --------------------------------------------
        2) visibleYLabels を復元
    -------------------------------------------- */
    if (Array.isArray(saved.visibleYLabels)) {
      chart._visibleYLabels = new Set(saved.visibleYLabels);
    } else {
      chart._visibleYLabels = new Set(unitMap.keys());
    }

    /* --------------------------------------------
        3) ticks.values を unitMap に合わせて再構築
    -------------------------------------------- */
    const yKeys = Array.from(unitMap.keys()).sort((a, b) => b - a);
    chart.options.scales.y.ticks.values = yKeys;

    chart.update();
  }

  // 5. 選択状態復元＋Y軸幅再同期
  restoreSelectedCharts(state.selectedCharts);
  syncSeriesSelectionUI();
  requestYAxisResync();
  refreshAxes();
  fixChartHeights();

  // 6. チェックボックス復元＋ECU グループ状態
  state.visibleCharts.forEach((v, i) => {
    const chk = document.getElementById('chk' + i);
    if (chk) chk.checked = !!v;
  });

  document.querySelectorAll('.ecu-group').forEach(group => {
    const parentChk = group.querySelector('.ecu-title input[type="checkbox"]');
    if (!parentChk) return;

    const children = Array.from(
      group.querySelectorAll('.chip input[type="checkbox"][data-index]')
    );
    if (children.length === 0) return;

    const states = children.map(c => c.checked);
    const allChecked = states.every(v => v);
    const noneChecked = states.every(v => !v);

    parentChk.checked = allChecked;
    parentChk.indeterminate = !allChecked && !noneChecked;
  });

  // 7. X 範囲（スライダー）の復元
  const savedMin = state.sliderMinX ?? null;
  const savedMax = state.sliderMaxX ?? null;

  let railMin = Infinity;
  let railMax = -Infinity;

  seriesData.forEach(series => {
    if (!series || !Array.isArray(series.x)) return;

    series.x.forEach(v => {
      if (typeof v !== "number") return;
      if (v < railMin) railMin = v;
      if (v > railMax) railMax = v;
    });
  });

  if (!isFinite(railMin) || !isFinite(railMax)) {
    railMin = 0;
    railMax = 1;
  }

  initXRangeSlider(railMin, railMax, savedMin, savedMax);
  if (!charts.some(chart => !!chart) && savedMin != null && savedMax != null) {
    window.userMinX = savedMin;
    window.userMaxX = savedMax;
  }

  if (typeof window.applyXRange === "function") {
    window.applyXRange({ force: true, skipSave: true });
  }

  if (typeof window.setOverlayMode === "function") {
    window.setOverlayMode(!!state.overlayMode, { save: false });
  }

  // 9. 固定線のモード別状態を反映
  updateCrosshairAll();

  // 10. マーカー表示状態の仕上げ適用
  setTimeout(() => {
    if (typeof window.applyMarkerStateToAllCharts === "function") {
      window.applyMarkerStateToAllCharts(
        window.globalMarkerEnabled,
        window.overlayMode
      );
    }
    if (window.updateHairlineValuesPanel) window.updateHairlineValuesPanel();
  }, 0);

  // 11. コンパクトモードの復元
  if (state.compactMode && window.CompactMode) {
    const compactState = state.compactMode;
    const toggleCheckbox = document.getElementById('toggleCompactMode');

    if (compactState.isActive) {
      CompactMode.isActive = true;
      if (toggleCheckbox) toggleCheckbox.checked = true;

      // コンパクトモードを有効化（オーバーレイを作成）
      setTimeout(() => {
        CompactMode.enable();

        // オーバーレイ作成後に位置を復元
        setTimeout(() => {
          if (compactState.panelSettings) {
            CompactMode.restorePanelSettings(compactState.panelSettings);
          }
        }, 50);
      }, 100);
    } else {
      CompactMode.isActive = false;
      if (toggleCheckbox) toggleCheckbox.checked = false;
    }
  }

  // 12. 保存
  try {
    saveStateToLocalStorage();
  } catch (e) {
    console.error("applyStateFromObject: final auto-save failed", e);
  }
}

// ===============================
//  JSON 読み込み
// ===============================

function applyStateFromJSON(json) {
  try {
    window.__isRestoringState = true;
    applyStateFromObject(JSON.parse(json));
  } catch (e) {
    console.error("applyStateFromJSON: JSON パース失敗", e);
  } finally {
    window.__isRestoringState = false;
  }
}

// ===============================
//  ローカルストレージ
// ===============================

function getStateStorageKey() {
  const isC3P =
    window.metaInfo?.["データ保存日時"] ||
    window.metaInfo?.["車系"];

  if (isC3P) {
    let date = window.metaInfo["データ保存日時"]?.[0] || "nodate";
    const car  = window.metaInfo["車系"]?.[0] || "nocar";

    date = date
      .replace(/:/g, "-")
      .replace(/\s+/g, "_")
      .replace(/[^0-9A-Za-z_\-]/g, "");

    const key = `c4graph_state_c3p_${date}_${car}`;
    return key;
  }

  const saved = window.metaInfo?.["Saved Date"]?.[0] || "nosaved";
  const vid   = window.metaInfo?.["Vehicle ID"]?.[0] || "no_vid";

  const key = `c4graph_state_${saved}_${vid}`;
  return key;
}

function saveStateToLocalStorage() {
  try {
    // CSV 未読込なら保存しない（空状態の保存を防ぐ）
    if (!window.seriesData || !Array.isArray(window.seriesData) || window.seriesData.length === 0) {
      console.warn("saveStateToLocalStorage: CSV 未読込のため保存スキップ");
      return;
    }

    const key = getStateStorageKey();
    localStorage.setItem(key, exportStateToJSON());
  } catch (e) {
    console.error("saveStateToLocalStorage: 保存失敗", e);
  }
}

function loadStateFromLocalStorage() {
  const key = getStateStorageKey();
  const saved = localStorage.getItem(key);
  if (!saved) return;

  const stateObj = JSON.parse(saved);

  runWithLoading(async (updateProgress) => {
    await applyStateFromObject(stateObj, updateProgress);
  });
}
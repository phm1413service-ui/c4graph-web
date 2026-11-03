const vehicleInfoFields = [
  ["車名 / 車種", ["Vehicle Model", "車名"]],
  ["車台番号", ["Vehicle ID"]],
  ["車系", ["車系"]],
  ["車台番号", ["車台番号"]],
  ["記録日時", ["Saved Date", "データ保存日時"]],
  ["記録時間", ["Recording Time", "記録時間"]],
  ["サンプリング速度", ["Sampling Rate", "記録速度"]],
  ["トリガタイプ", ["Trigger Type", "トリガタイプ"]],
  ["トリガ比率", ["Trigger Rate", "トリガ比率"]],
  ["説明", ["Description"]],
  ["年式", ["年式"]]
];

function getMetaInfoValue(keys) {
  for (const key of keys) {
    const raw = window.metaInfo?.[key];
    const values = Array.isArray(raw) ? raw : [raw];
    const value = values
      .map(item => String(item ?? "").trim())
      .map(item => key === "Saved Date" ? formatUtcAsJapanTime(item) : item)
      .filter(Boolean)
      .join(" / ");
    if (value) return value;
  }
  return "";
}

function formatUtcAsJapanTime(value) {
  const match = value.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})[ T](\d{1,2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?$/);
  if (!match) return value;

  const [, yearText, monthText, dayText, hourText, minuteText, secondText, millisecondText = "0"] = match;
  const parts = [yearText, monthText, dayText, hourText, minuteText, secondText].map(Number);
  const [year, month, day, hour, minute, second] = parts;
  const timestamp = Date.UTC(year, month - 1, day, hour, minute, second, Number(millisecondText.padEnd(3, "0")));
  const utcDate = new Date(timestamp);

  if (
    utcDate.getUTCFullYear() !== year ||
    utcDate.getUTCMonth() !== month - 1 ||
    utcDate.getUTCDate() !== day ||
    utcDate.getUTCHours() !== hour ||
    utcDate.getUTCMinutes() !== minute ||
    utcDate.getUTCSeconds() !== second
  ) {
    return value;
  }

  const japanDate = new Date(timestamp + 9 * 60 * 60 * 1000);
  const pad = number => String(number).padStart(2, "0");
  return `${japanDate.getUTCFullYear()}/${pad(japanDate.getUTCMonth() + 1)}/${pad(japanDate.getUTCDate())} ${pad(japanDate.getUTCHours())}:${pad(japanDate.getUTCMinutes())}:${pad(japanDate.getUTCSeconds())}`;
}

window.renderVehicleInfo = function() {
  const list = document.getElementById("vehicleInfoList");
  if (!list) return;

  list.replaceChildren();
  vehicleInfoFields.forEach(([label, keys]) => {
    const value = getMetaInfoValue(keys);
    if (!value) return;

    const term = document.createElement("dt");
    term.textContent = label;
    const description = document.createElement("dd");

    // 車台番号の場合はコピーボタンを追加
    if (label === "車台番号" && value) {
      const textSpan = document.createElement("span");
      textSpan.textContent = value;
      description.appendChild(textSpan);

      const copyBtn = document.createElement("button");
      copyBtn.type = "button";
      copyBtn.className = "copy-vin-btn";
      copyBtn.title = "車台番号をコピー";
      copyBtn.textContent = "📋";
      copyBtn.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(value);
          copyBtn.textContent = "✓";
          copyBtn.classList.add("copied");
          setTimeout(() => {
            copyBtn.textContent = "📋";
            copyBtn.classList.remove("copied");
          }, 1500);
        } catch (err) {
          console.error("コピーに失敗しました:", err);
          alert("コピーに失敗しました");
        }
      });
      description.appendChild(copyBtn);
    } else {
      description.textContent = value;
    }

    list.append(term, description);
  });
};


const vehicleInfoPanel = document.getElementById("vehicleInfoPanel");
const vehicleInfoToggle = document.getElementById("vehicleInfoToggle");
const vehicleInfoList = document.getElementById("vehicleInfoList");

function closeVehicleInfo() {
  vehicleInfoList.hidden = true;
  vehicleInfoToggle.setAttribute("aria-expanded", "false");
}

vehicleInfoToggle.addEventListener("click", event => {
  event.stopPropagation();
  const isExpanded = vehicleInfoToggle.getAttribute("aria-expanded") === "true";
  vehicleInfoList.hidden = isExpanded;
  vehicleInfoToggle.setAttribute("aria-expanded", String(!isExpanded));
});

document.addEventListener("pointerdown", event => {
  if (!vehicleInfoPanel.contains(event.target)) closeVehicleInfo();
});

document.addEventListener("keydown", event => {
  if (event.key !== "Escape" || vehicleInfoList.hidden) return;
  closeVehicleInfo();
  vehicleInfoToggle.focus();
});

// トップに戻るボタン
const backToTopBtn = document.getElementById("backToTopBtn");
if (backToTopBtn) {
  backToTopBtn.addEventListener("click", () => {
    const confirmed = confirm("トップページに戻りますか？");
    if (confirmed) {
      location.reload();
    }
  });
}

function getVisibleSeriesIndices() {
  if (window.overlayMode && window.overlayVisibleSeries instanceof Set) {
    return Array.from(window.overlayVisibleSeries).sort((a, b) => a - b);
  }
  return Array.from({ length: seriesData?.length ?? 0 }, (_, index) => index)
    .filter(index => !!charts[index]);
}

function syncSeriesSelectionUI() {
  const selected = new Set(getVisibleSeriesIndices());
  document.querySelectorAll('#controls input[type="checkbox"][data-index]').forEach(checkbox => {
    checkbox.checked = selected.has(Number(checkbox.dataset.index));
  });
  document.querySelectorAll(".ecu-group").forEach(group => {
    const parent = group.querySelector(".ecu-title input[type='checkbox']");
    if (!parent) return;
    const children = Array.from(group.querySelectorAll(".chip input[data-index]"))
      .map(checkbox => ({ index: Number(checkbox.dataset.index) }));
    updateParentState(parent, children);
  });
  document.querySelectorAll("#controls .chip").forEach(chip => {
    const checkbox = chip.querySelector("input[data-index]");
    const index = Number(checkbox?.dataset.index);
    const isSelected = window.overlayMode
      ? window.overlaySelectedSeries.has(index)
      : selectedChartIndices.includes(index);
    chip.classList.toggle("selected", isSelected);
  });
}

function getOverlayHeight() {
  const input = document.getElementById("overlayHeightInput");
  const value = Number(input?.value);
  return Math.min(3000, Math.max(150, Number.isFinite(value) && value > 0 ? value : 350));
}

function updateAutomaticOverlayHeight() {
  const container = document.getElementById("overlayChartContainer");
  const input = document.getElementById("overlayHeightInput");
  if (!container || !input || !window.overlayHeightAuto || !window.overlayMode) return;

  const height = Math.round(container.getBoundingClientRect().height);
  if (height <= 0) return;
  input.value = String(height);
}

function applyOverlayHeight() {
  const container = document.getElementById("overlayChartContainer");
  const input = document.getElementById("overlayHeightInput");
  const autoButton = document.getElementById("overlayHeightAutoButton");
  if (!container || !input) return;

  if (autoButton) autoButton.setAttribute("aria-pressed", String(window.overlayHeightAuto));
  if (window.overlayHeightAuto) {
    container.style.height = "";
    container.style.flex = "1 1 auto";
    requestAnimationFrame(updateAutomaticOverlayHeight);
    return;
  }

  const height = getOverlayHeight();
  input.value = String(height);
  container.style.height = `${height}px`;
  container.style.flex = "0 0 auto";
  if (window.overlayChart) window.overlayChart.resize();
}

window.getSeriesTimePoints = function(index) {
  const series = seriesData[index];
  if (!series) return [];

  let shiftedX = series.x;
  if (window.__isC3P !== true && series.x.length > 0) {
    const rateRaw = window.metaInfo?.["Trigger Rate"]?.[0] || "";
    const preMatch = rateRaw.match(/pre:\s*([0-9.]+)%/);
    const prePercent = preMatch ? Number(preMatch[1]) : 50;
    const { min, max } = series.x.reduce(
      (range, value) => ({
        min: Math.min(range.min, value),
        max: Math.max(range.max, value)
      }),
      { min: Infinity, max: -Infinity }
    );
    const triggerTime = min + (max - min) * (prePercent / 100);
    shiftedX = series.x.map(value => value - triggerTime);
  }

  return shiftedX
    .map((x, pointIndex) => ({ x, y: series.y[pointIndex] }))
    .filter(point => Number.isFinite(point.x));
};

window.getOverlaySeriesChart = function(index) {
  const series = seriesData[index];
  if (!series) return null;

  const points = window.getSeriesTimePoints(index);
  const range = points.reduce(
    (result, point) => ({
      min: Math.min(result.min, point.x),
      max: Math.max(result.max, point.x)
    }),
    { min: Infinity, max: -Infinity }
  );
  const unitMap = buildUnitMap(series.meta.unit);
  const unit = unitMap ? "" : (series.meta.unit || "").replace(/^"+|"+$/g, "");
  const data = points.filter(point => Number.isFinite(point.y));
  return {
    data: {
      datasets: [{
        label: series.meta.label,
        data,
        rawData: data,
        unitMap,
        unit
      }]
    },
    scales: {
      x: {
        min: window.userMinX ?? range.min,
        max: window.userMaxX ?? range.max
      }
    }
  };
};

function renderOverlayLegend(indices) {
  const legend = document.getElementById("overlayLegend");
  if (!legend) return;

  legend.replaceChildren();
  if (indices.length === 0) {
    legend.textContent = "表示項目を選択してください。";
    return;
  }

  indices.forEach(index => {
    const series = seriesData[index];
    if (!series) return;

    const rawValues = series.y
      .filter(Number.isFinite);
    const rawRange = rawValues.reduce(
      (range, value) => ({
        min: Math.min(range.min, value),
        max: Math.max(range.max, value)
      }),
      { min: Infinity, max: -Infinity }
    );
    const rawMin = rawValues.length ? rawRange.min : null;
    const rawMax = rawValues.length ? rawRange.max : null;
    const entry = document.createElement("span");
    entry.className = "overlay-legend-entry";
    entry.dataset.seriesIndex = String(index);
    entry.classList.toggle("selected", window.overlaySelectedSeries.has(index));
    entry.classList.toggle("hovered", window.hoveredSeriesIndex === index);
    entry.setAttribute("role", "button");
    entry.setAttribute("tabindex", "0");
    entry.setAttribute("aria-pressed", String(window.overlaySelectedSeries.has(index)));
    entry.title = rawMin == null
      ? `${series.meta.label}: 数値データなし`
      : `${series.meta.label}: ${rawMin} ～ ${rawMax}${series.meta.unit ? ` ${series.meta.unit}` : ""}`;
    entry.addEventListener("mouseenter", () => window.setHoveredSeries(index));
    entry.addEventListener("mouseleave", () => window.clearHoveredSeries(index));
    entry.addEventListener("click", event => {
      if (event.target.closest("button")) return;
      window.selectOverlaySeries(index, event);
    });
    entry.addEventListener("keydown", event => {
      if ((event.key === "Enter" || event.key === " ") && !event.target.closest("button")) {
        event.preventDefault();
        window.selectOverlaySeries(index, event);
      }
    });

    const swatch = document.createElement("span");
    swatch.className = "overlay-legend-swatch";
    swatch.style.backgroundColor = chartColors[index % chartColors.length];

    const label = document.createElement("span");
    label.textContent = `${series.meta.ecu} - ${series.meta.label}${series.meta.unit ? ` (${series.meta.unit})` : ""}`;
    const settingsButton = document.createElement("button");
    settingsButton.type = "button";
    settingsButton.textContent = "⚙";
    settingsButton.title = `Y軸設定: ${series.meta.label}`;
    settingsButton.setAttribute("aria-label", `Y軸設定: ${series.meta.label}`);
    settingsButton.addEventListener("click", event => {
      event.stopPropagation();
      window.openOverlayYAxisDialog(index);
    });
    entry.append(swatch, label, settingsButton);
    legend.appendChild(entry);
  });
}

function clearOverlayChartData() {
  if (window.overlayChart) {
    window.overlayChart.data.datasets = [];
    Object.entries(window.overlayChart.config.options.scales || {}).forEach(([id, axis]) => {
      if (id !== "x") axis.display = false;
    });
    window.overlayChart.clear();
  }
}

window.clearGraphsForDataLoad = function() {
  window.setOverlayMode(false, { save: false });
  const sidebarLogo = document.getElementById("sidebarCompanyLogo");
  if (sidebarLogo) sidebarLogo.hidden = true;
  window.resetOverlaySeriesSelection();
  window.overlaySelectedSeries = new Set();
  window.overlayYAxisSettings = {};
  charts.forEach(chart => {
    if (chart) chart.destroy();
  });
  charts.length = 0;
  document.getElementById("graphs")?.replaceChildren();
  if (typeof selectedChartIndices !== "undefined") selectedChartIndices.length = 0;
  if (window.savedYAxis) window.savedYAxis = {};
  window.userMinX = null;
  window.userMaxX = null;
  window.sharedTimeValue = null;
  window.sharedTimeValueLeft = null;
  window.sharedTimeValueRight = null;
  window.fixedLinesByMode = {
    normal: { left: null, right: null },
    overlay: { left: null, right: null }
  };
  const slider = document.getElementById("xRangeSlider");
  if (slider) slider.style.display = "none";
  if (window.updateHairlineValuesPanel) window.updateHairlineValuesPanel();
};

function renderOverlayChart() {
  const canvas = document.getElementById("overlayChartCanvas");
  if (!canvas) return;

  const indices = getVisibleSeriesIndices();
  renderOverlayLegend(indices);

  const scales = {
    x: {
      type: "linear",
      display: true,
      min: window.userMinX ?? undefined,
      max: window.userMaxX ?? undefined,
      title: { display: true, text: "時間 (s)" }
    }
  };
  const datasets = indices.map((index, visibleIndex) => {
    const series = seriesData[index];
    if (!series) return null;

    const data = window.getSeriesTimePoints(index);
    const numericValues = data
      .map(point => point.y)
      .filter(Number.isFinite);
    if (numericValues.length === 0) return null;

    const unitMap = buildUnitMap(series.meta.unit);
    if (unitMap) {
      const stateMin = Math.min(...unitMap.keys());
      const stateMax = Math.max(...unitMap.keys());
      for (let value = stateMin; value <= stateMax; value++) {
        if (!unitMap.has(value)) unitMap.set(value, String(value));
      }
    }

    const color = chartColors[index % chartColors.length];
    const axisId = `overlayY${index}`;
    const settings = window.overlayYAxisSettings?.[index] || {};
    const axis = {
      type: "linear",
      axis: "y",
      display: true,
      position: "left",
      min: Number.isFinite(settings.min) ? settings.min : undefined,
      max: Number.isFinite(settings.max) ? settings.max : undefined,
      grid: {
        drawOnChartArea: visibleIndex === 0,
        color: "rgba(0, 0, 0, 0.12)"
      },
      border: {
        color,
        width: window.hoveredSeriesIndex === index || window.overlaySelectedSeries.has(index) ? 3 : 1
      },
      ticks: {
        color,
        font: {
          weight: window.hoveredSeriesIndex === index || window.overlaySelectedSeries.has(index)
            ? "bold"
            : "normal"
        },
        stepSize: unitMap ? 1 : undefined,
        callback(value) {
          if (unitMap && Number.isInteger(value) && unitMap.has(value)) {
            return unitMap.get(value);
          }
          const decimals = detectSafeDecimalPlaces(numericValues);
          return Number(Number(value).toFixed(decimals));
        }
      }
    };
    if (unitMap) {
      axis.suggestedMin = Math.min(...unitMap.keys());
      axis.suggestedMax = Math.max(...unitMap.keys());
    }
    scales[axisId] = axis;

    return {
      label: series.meta.label,
      seriesIndex: index,
      data,
      crosshairData: data.filter(point => Number.isFinite(point.y)),
      yAxisID: axisId,
      unitMap,
      unit: unitMap ? "" : (series.meta.unit || "").replace(/^"+|"+$/g, ""),
      borderColor: color,
      backgroundColor: color,
      borderWidth: window.hoveredSeriesIndex === index ? 3.5 : 1.5,
      pointRadius: window.globalMarkerEnabled ? 2 : 0,
      pointHoverRadius: window.globalMarkerEnabled ? 5 : 0,
      hoverRadius: window.globalMarkerEnabled ? 5 : 0,
      pointHitRadius: window.globalMarkerEnabled ? 5 : 0,
      pointBorderWidth: window.globalMarkerEnabled ? 1 : 0,
      pointStyle: window.globalMarkerEnabled ? "circle" : false,
      showLine: true,
      spanGaps: true,
      stepped: true
    };
  }).filter(dataset => dataset && dataset.data.length > 0);

  if (datasets.length === 0) {
    clearOverlayChartData();
    return;
  }

  let dataMinX = Infinity;
  let dataMaxX = -Infinity;
  datasets.forEach(dataset => dataset.data.forEach(point => {
    dataMinX = Math.min(dataMinX, point.x);
    dataMaxX = Math.max(dataMaxX, point.x);
  }));
  scales.x.min = window.userMinX ?? dataMinX;
  scales.x.max = window.userMaxX ?? dataMaxX;

  if (!window.overlayChart) {
    Chart.register(window["chartjs-plugin-annotation"]);
    window.overlayChart = new Chart(canvas.getContext("2d"), {
      type: "line",
      data: { datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        interaction: { mode: "nearest", intersect: true },
        plugins: {
          legend: { display: false },
          tooltip: { enabled: false },
          annotation: {
            annotations: {
              triggerLine: {
                type: "line",
                scaleID: "x",
                value: 0,
                borderColor: "orange",
                borderWidth: 1
              }
            }
          }
        },
        scales
      }
    });
    window.overlayChart.$isOverlayChart = true;
    attachCanvasEvents(window.overlayChart, canvas);
  } else {
    window.overlayChart.data.datasets = datasets;
    window.overlayChart.options.scales = scales;
    window.overlayChart.update("none");
  }
}

window.setHoveredSeries = function(index) {
  if (window.hoveredSeriesIndex === index) return;

  if (window.overlayMode) {
    if (!window.overlayChart) return;
    if (!window.overlayChart.data.datasets.some(dataset => dataset.seriesIndex === index)) return;
    window.hoveredSeriesIndex = index;
    document.querySelector(`#controls .chip input[data-index="${index}"]`)
      ?.parentElement?.classList.add("hovered");
    window.overlayChart.data.datasets.forEach(dataset => {
      const hovered = dataset.seriesIndex === index;
      dataset.borderWidth = hovered ? 3.5 : 1.5;
      const axis = window.overlayChart.options.scales[dataset.yAxisID];
      if (axis) {
        const selected = window.overlaySelectedSeries.has(dataset.seriesIndex);
        axis.border.width = hovered || selected ? 3 : 1;
        axis.ticks.font = { weight: hovered || selected ? "bold" : "normal" };
      }
    });
    window.overlayChart.update("none");
    document.querySelectorAll(".overlay-legend-entry").forEach(entry => {
      entry.classList.toggle("hovered", Number(entry.dataset.seriesIndex) === index);
    });
    return;
  }

  const chart = charts[index];
  if (!chart?.data.datasets?.[0]) return;
  window.hoveredSeriesIndex = index;
  document.querySelector(`#controls .chip input[data-index="${index}"]`)
    ?.parentElement?.classList.add("hovered");
};

window.clearHoveredSeries = function(index) {
  if (window.hoveredSeriesIndex !== index) return;
  window.hoveredSeriesIndex = null;
  document.querySelector(`#controls .chip input[data-index="${index}"]`)
    ?.parentElement?.classList.remove("hovered");

  if (window.overlayMode) {
    if (!window.overlayChart) return;
    window.overlayChart.data.datasets.forEach(dataset => {
      dataset.borderWidth = 1.5;
      const axis = window.overlayChart.options.scales[dataset.yAxisID];
      if (axis) {
        const selected = window.overlaySelectedSeries.has(dataset.seriesIndex);
        axis.border.width = selected ? 3 : 1;
        axis.ticks.font = { weight: selected ? "bold" : "normal" };
      }
    });
    window.overlayChart.update("none");
    document.querySelectorAll(".overlay-legend-entry").forEach(entry => {
      entry.classList.remove("hovered");
    });
    return;
  }
};

window.updateOverlayChartRange = function(minX, maxX) {
  const chart = window.overlayChart;
  const xScale = chart?.options?.scales?.x;
  if (!chart || !xScale) return;
  xScale.min = minX;
  xScale.max = maxX;
  chart.update("none");
};

window.setOverlayMode = function(enabled, options = {}) {
  const modeChanged = window.overlayMode !== !!enabled;
  if (modeChanged) {
    window.storeActiveFixedLines();
    window.activateFixedLinesForMode(!!enabled);
  }
  if (window.hoveredSeriesIndex != null) {
    window.clearHoveredSeries(window.hoveredSeriesIndex);
  }
  if (modeChanged && enabled && !(window.overlayVisibleSeries instanceof Set)) {
    window.overlayVisibleSeries = new Set();
  }

  window.overlayMode = !!enabled;
  const mode = window.overlayMode ? "overlay" : "normal";
  window.globalMarkerEnabled = window.markerEnabledByMode[mode];
  const markerToggle = document.getElementById("toggleMarkers");
  if (markerToggle) markerToggle.checked = window.globalMarkerEnabled;
  const hairlineToggle = document.getElementById("toggleHairlineValues");
  if (hairlineToggle) {
    hairlineToggle.checked = window.hairlineValuesEnabledByMode[mode];
  }
  const normalButton = document.getElementById("normalGraphModeButton");
  const overlayButton = document.getElementById("overlayModeToggle");
  const normalHeightControl = document.getElementById("normalHeightControl");
  const heightControl = document.getElementById("overlayHeightControl");
  const crosshairValueToggle = document.getElementById("toggleCrosshairValueLabels");
  const graphList = document.getElementById("graphs");
  const overlay = document.getElementById("overlayChartContainer");
  const slider = document.getElementById("xRangeSlider");
  if (normalButton) normalButton.setAttribute("aria-pressed", String(!window.overlayMode));
  if (overlayButton) overlayButton.setAttribute("aria-pressed", String(window.overlayMode));
  if (normalHeightControl) normalHeightControl.hidden = window.overlayMode;
  if (heightControl) heightControl.hidden = !window.overlayMode;
  if (crosshairValueToggle) {
    crosshairValueToggle.checked = window.getCrosshairValueLabelsEnabled(window.overlayMode);
  }
  if (graphList) graphList.hidden = window.overlayMode;
  if (overlay) overlay.hidden = !window.overlayMode;

  if (window.overlayMode && slider) {
    slider.style.display = "block";
    if (!charts.some(chart => !!chart)) {
      const { globalXMin, globalXMax } = computeGlobalXRange();
      initXRangeSlider(globalXMin, globalXMax, window.userMinX, window.userMaxX);
    }
  } else if (slider && seriesData?.length) {
    slider.style.display = "block";
  }

  if (window.overlayMode) renderOverlayChart();
  else clearOverlayChartData();
  if (typeof window.applyMarkerStateToAllCharts === "function") {
    window.applyMarkerStateToAllCharts(window.globalMarkerEnabled, window.overlayMode);
  }

  if (window.overlayMode) applyOverlayHeight();
  if (window.overlayMode && typeof window.applyXRange === "function") {
    window.applyXRange({ force: true, skipSave: true });
  }
  syncSeriesSelectionUI();
  if (typeof window.updateCrosshairAll === "function") window.updateCrosshairAll();
  if (window.refreshDisplayFeatures) window.refreshDisplayFeatures();
  if (window.updateHairlineValuesPanel) window.updateHairlineValuesPanel();
  if (options.save !== false && typeof saveStateToLocalStorage === "function") {
    saveStateToLocalStorage();
  }
};

window.setOverlaySeriesVisible = function(index, visible, options = {}) {
  if (!(window.overlayVisibleSeries instanceof Set)) {
    window.overlayVisibleSeries = new Set();
  }
  if (visible) window.overlayVisibleSeries.add(index);
  else {
    window.overlayVisibleSeries.delete(index);
    window.overlaySelectedSeries.delete(index);
  }
  const updatesDeferred = typeof suppressChartUpdates !== "undefined" && suppressChartUpdates;
  if (window.overlayMode && !updatesDeferred) renderOverlayChart();
  if (!updatesDeferred) {
    syncSeriesSelectionUI();
    if (window.refreshDisplayFeatures) window.refreshDisplayFeatures();
    if (window.updateHairlineValuesPanel) window.updateHairlineValuesPanel();
  }
  if (options.save !== false && typeof saveStateToLocalStorage === "function") {
    saveStateToLocalStorage();
  }
};

window.restoreOverlaySeriesSelection = function(indices) {
  window.overlayVisibleSeries = Array.isArray(indices)
    ? new Set(indices.filter(index => Number.isInteger(index) && index >= 0 && index < (seriesData?.length ?? 0)))
    : null;
};

window.resetOverlaySeriesSelection = function() {
  window.overlayVisibleSeries = null;
};

window.selectOverlaySeries = function(index, event) {
  if (!(window.overlaySelectedSeries instanceof Set)) {
    window.overlaySelectedSeries = new Set();
  }

  if (event?.ctrlKey) {
    if (window.overlaySelectedSeries.has(index)) {
      window.overlaySelectedSeries.delete(index);
    } else {
      window.overlaySelectedSeries.add(index);
    }
  } else if (window.overlaySelectedSeries.size === 1 && window.overlaySelectedSeries.has(index)) {
    window.overlaySelectedSeries.clear();
  } else {
    window.overlaySelectedSeries = new Set([index]);
  }
  if (window.overlayMode) renderOverlayChart();
  syncSeriesSelectionUI();
  if (window.updateHairlineValuesPanel) window.updateHairlineValuesPanel();
  if (typeof saveStateToLocalStorage === "function") saveStateToLocalStorage();
};

window.refreshDisplayFeatures = function() {
  const toolbar = document.getElementById("graphDisplayToolbar");
  const count = document.getElementById("visibleSeriesCount");
  if (toolbar) toolbar.hidden = !document.getElementById("main")?.classList.contains("loaded");
  if (count) {
    count.textContent = `表示項目: ${getVisibleSeriesIndices().length} / ${seriesData?.length ?? 0}`;
  }
  window.renderVehicleInfo();
  if (window.overlayMode) renderOverlayChart();
};

document.getElementById("normalGraphModeButton")?.addEventListener("click", () => {
  window.setOverlayMode(false);
});
document.getElementById("overlayModeToggle")?.addEventListener("click", () => {
  window.setOverlayMode(true);
});
document.getElementById("overlayHeightInput")?.addEventListener("change", () => {
  window.overlayHeightAuto = false;
  applyOverlayHeight();
  if (typeof saveStateToLocalStorage === "function") saveStateToLocalStorage();
});
document.getElementById("overlayHeightAutoButton")?.addEventListener("click", () => {
  window.overlayHeightAuto = true;
  applyOverlayHeight();
  if (typeof saveStateToLocalStorage === "function") saveStateToLocalStorage();
});

const overlayContainerForResize = document.getElementById("graphsContainer");
if (overlayContainerForResize && "ResizeObserver" in window) {
  const overlayHeightObserver = new ResizeObserver(() => {
    if (window.overlayHeightAuto && window.overlayMode) updateAutomaticOverlayHeight();
  });
  overlayHeightObserver.observe(overlayContainerForResize);
}
window.addEventListener("resize", () => {
  if (window.overlayHeightAuto && window.overlayMode) updateAutomaticOverlayHeight();
});

window.openOverlayYAxisDialog = function(index) {
  const series = seriesData[index];
  const chart = window.overlayChart;
  const dialog = document.getElementById("overlayYAxisDialog");
  const axis = chart?.scales?.[`overlayY${index}`];
  if (!series || !dialog || !axis) return;

  const settings = window.overlayYAxisSettings?.[index] || {};
  const minimum = document.getElementById("overlayYAxisMin");
  const maximum = document.getElementById("overlayYAxisMax");
  document.getElementById("overlayYAxisSeriesName").textContent =
    `${series.meta.ecu} - ${series.meta.label}${series.meta.unit ? ` (${series.meta.unit})` : ""}`;
  minimum.value = Number.isFinite(settings.min) ? String(settings.min) : "";
  maximum.value = Number.isFinite(settings.max) ? String(settings.max) : "";
  minimum.placeholder = String(axis.min);
  maximum.placeholder = String(axis.max);
  document.getElementById("overlayYAxisError").textContent = "";
  dialog.dataset.seriesIndex = String(index);
  dialog.style.display = "flex";
  minimum.focus();
};

function closeOverlayYAxisDialog() {
  document.getElementById("overlayYAxisDialog").style.display = "none";
}

document.getElementById("overlayYAxisCancel")?.addEventListener("click", closeOverlayYAxisDialog);
document.getElementById("overlayYAxisApply")?.addEventListener("click", () => {
  const dialog = document.getElementById("overlayYAxisDialog");
  const index = Number(dialog.dataset.seriesIndex);
  const minimumInput = document.getElementById("overlayYAxisMin");
  const maximumInput = document.getElementById("overlayYAxisMax");
  const error = document.getElementById("overlayYAxisError");
  const min = minimumInput.value.trim() === "" ? null : Number(minimumInput.value);
  const max = maximumInput.value.trim() === "" ? null : Number(maximumInput.value);
  const axis = window.overlayChart?.scales?.[`overlayY${index}`];
  const effectiveMin = min ?? axis?.min;
  const effectiveMax = max ?? axis?.max;

  error.textContent = "";
  if ((min !== null && !Number.isFinite(min)) || (max !== null && !Number.isFinite(max))) {
    error.textContent = "最小値と最大値は数値で入力してください。";
    return;
  }
  if (effectiveMin == null || effectiveMax == null || effectiveMin >= effectiveMax) {
    error.textContent = "最小値は最大値より小さい値にしてください。";
    return;
  }

  const settings = {};
  if (min !== null) settings.min = min;
  if (max !== null) settings.max = max;
  if (min === null && max === null) {
    delete window.overlayYAxisSettings[index];
  } else {
    window.overlayYAxisSettings[index] = settings;
  }
  closeOverlayYAxisDialog();
  renderOverlayChart();
  if (typeof saveStateToLocalStorage === "function") saveStateToLocalStorage();
});
document.getElementById("overlayYAxisReset")?.addEventListener("click", () => {
  const dialog = document.getElementById("overlayYAxisDialog");
  const index = Number(dialog.dataset.seriesIndex);
  delete window.overlayYAxisSettings[index];
  closeOverlayYAxisDialog();
  renderOverlayChart();
  if (typeof saveStateToLocalStorage === "function") saveStateToLocalStorage();
});
document.getElementById("overlayYAxisDialog")?.addEventListener("click", event => {
  if (event.target === event.currentTarget) closeOverlayYAxisDialog();
});

const hairlineDecimalPlaces = new WeakMap();

function getHairlineValue(chart, xValue, side) {
  const dataset = chart.data.datasets?.[0];
  if (!dataset || !Array.isArray(dataset.data) || dataset.data.length === 0) return null;

  const snap = side === "left"
    ? chart._fixedLeftSnap
    : side === "right"
      ? chart._fixedRightSnap
      : chart._hoverSnap;
  if (snap && Math.abs(snap.x - xValue) < 1e-6) return snap.y;

  const data = dataset.data;
  let low = 0;
  let high = data.length;
  while (low < high) {
    const middle = (low + high) >> 1;
    if (data[middle].x < xValue) low = middle + 1;
    else high = middle;
  }

  const before = data[low - 1];
  const after = data[low];
  const point = before && before.y != null ? before : after;
  return point && point.y != null ? point.y : null;
}

function formatHairlineTime(value) {
  return value == null ? "—" : `${Number(value).toFixed(3)} s`;
}

function formatHairlineValue(chart, value) {
  if (value == null) return "—";

  const dataset = chart.data.datasets[0];
  const unitMap = dataset.unitMap;
  if (!hairlineDecimalPlaces.has(dataset)) {
    hairlineDecimalPlaces.set(
      dataset,
      detectSafeDecimalPlaces(dataset.data.map(point => point.y))
    );
  }
  const label = unitMap && Number.isInteger(value) && unitMap.has(value)
    ? unitMap.get(value)
    : String(Number(Number(value).toFixed(
      Math.min(15, hairlineDecimalPlaces.get(dataset))
    )));
  const unit = dataset.unit || "";
  return `${label}${unit ? ` ${unit}` : ""}`;
}

function formatHairlineDifference(chart, leftValue, rightValue) {
  const difference = leftValue == null || rightValue == null
    ? null
    : rightValue - leftValue;
  const dataset = chart.data.datasets[0];
  if (!hairlineDecimalPlaces.has(dataset)) {
    hairlineDecimalPlaces.set(
      dataset,
      detectSafeDecimalPlaces(dataset.data.map(point => point.y))
    );
  }

  return difference == null
    ? "—"
    : `${Number(difference.toFixed(Math.min(15, hairlineDecimalPlaces.get(dataset))))}${dataset.unit ? ` ${dataset.unit}` : ""}`;
}

function formatHairlineStatistics(chart) {
  const dataset = chart.data.datasets[0];
  const rangeMin = chart.scales.x.min;
  const rangeMax = chart.scales.x.max;
  const values = (dataset.rawData || dataset.data)
    .filter(point =>
      Number.isFinite(point.x) &&
      point.x >= rangeMin &&
      point.x <= rangeMax &&
      Number.isFinite(point.y)
    )
    .map(point => point.y);
  if (values.length === 0) return ["—", "—", "—"];

  let minimum = values[0];
  let maximum = values[0];
  let sum = 0;
  values.forEach(value => {
    minimum = Math.min(minimum, value);
    maximum = Math.max(maximum, value);
    sum += value;
  });
  const average = dataset.unitMap ? null : sum / values.length;
  return [
    formatHairlineValue(chart, minimum),
    formatHairlineValue(chart, maximum),
    average == null ? "—" : formatHairlineValue(chart, average)
  ];
}

function createHairlineCell(text, className) {
  const cell = document.createElement("td");
  cell.textContent = text;
  if (className) cell.className = className;
  return cell;
}

function getHairlineColumns(table) {
  return Array.from(table.querySelectorAll("colgroup col"));
}

function setHairlineColumnWidths(table, widths) {
  const columns = getHairlineColumns(table);
  columns.forEach((column, index) => {
    column.style.width = `${widths[index]}px`;
  });
  table.style.width = `${widths.reduce((sum, width) => sum + width, 0)}px`;
  table.style.setProperty("--hairline-ecu-column-width", `${widths[0]}px`);
}

function getHairlineContentHeight(panel, table, titleBar, scrollArea) {
  const panelStyle = getComputedStyle(panel);
  const scrollStyle = getComputedStyle(scrollArea);
  const verticalMargins =
    (parseFloat(scrollStyle.marginTop) || 0) +
    (parseFloat(scrollStyle.marginBottom) || 0);
  const panelBorders =
    (parseFloat(panelStyle.borderTopWidth) || 0) +
    (parseFloat(panelStyle.borderBottomWidth) || 0);
  const horizontalScrollbarHeight = table.scrollWidth > scrollArea.clientWidth
    ? scrollArea.offsetHeight - scrollArea.clientHeight
    : 0;
  return titleBar.offsetHeight +
    table.scrollHeight +
    horizontalScrollbarHeight +
    verticalMargins +
    panelBorders;
}

function growHairlineWindowForRows(panel, table, titleBar, scrollArea) {
  if (panel.dataset.autoHeightDisabled === "true") return;

  const desiredHeight = getHairlineContentHeight(panel, table, titleBar, scrollArea);
  if (panel.classList.contains("is-minimized")) {
    const restoredHeight = parseFloat(panel.dataset.minimizedHeight) || panel.offsetHeight;
    const maxHeight = Math.min(
      parseFloat(getComputedStyle(panel).maxHeight),
      window.innerHeight - 24
    );
    panel.dataset.minimizedHeight = `${Math.min(
      maxHeight,
      Math.max(restoredHeight, desiredHeight)
    )}px`;
    return;
  }
  if (panel.classList.contains("is-maximized")) return;

  const rect = panel.getBoundingClientRect();
  const maxHeight = Math.min(
    parseFloat(getComputedStyle(panel).maxHeight),
    window.innerHeight - Math.max(8, rect.top) - 8
  );
  const height = Math.min(maxHeight, Math.max(rect.height, desiredHeight));
  if (height > rect.height + 1) {
    panel.style.height = `${height}px`;
  }
}

function measureHairlineColumn(table, columnIndex) {
  const cells = Array.from(table.rows)
    .map(row => row.cells[columnIndex])
    .filter(Boolean);
  if (cells.length === 0) return 80;

  const measurement = document.createElement("span");
  const style = getComputedStyle(cells[0]);
  measurement.style.position = "fixed";
  measurement.style.visibility = "hidden";
  measurement.style.whiteSpace = "nowrap";
  measurement.style.font = style.font;
  document.body.appendChild(measurement);

  const widest = cells.reduce((width, cell) => {
    measurement.textContent = cell.textContent;
    return Math.max(width, measurement.getBoundingClientRect().width);
  }, 0);
  measurement.remove();

  return Math.max(56, Math.ceil(widest + 22));
}

window.updateHairlineValuesPanel = function() {
  const panel = document.getElementById("hairlineValuesPanel");
  const table = document.getElementById("hairlineValuesTable");
  if (!panel || !table) return;

  const cursorTime = window.sharedTimeValue;
  const leftTime = window.sharedTimeValueLeft;
  const rightTime = window.sharedTimeValueRight;
  const visibilityToggle = document.getElementById("toggleHairlineValues");
  const overlayMode = window.overlayMode === true;
  const hasCharts = overlayMode
    ? window.overlayVisibleSeries instanceof Set && window.overlayVisibleSeries.size > 0
    : document.querySelector("#graphs .chart-panel") !== null;
  panel.hidden = !visibilityToggle?.checked || !hasCharts;

  document.getElementById("hairlineCursorHeading").textContent =
    `カーソル (${formatHairlineTime(cursorTime)})`;
  document.getElementById("hairlineLeftHeading").textContent =
    `左固定線 (${formatHairlineTime(leftTime)})`;
  document.getElementById("hairlineRightHeading").textContent =
    `右固定線 (${formatHairlineTime(rightTime)})`;
  const timeDifference = leftTime == null || rightTime == null
    ? null
    : rightTime - leftTime;
  const differenceHeading = document.getElementById("hairlineDifferenceHeading");
  differenceHeading.textContent =
    `差分 (Δt: ${timeDifference == null ? "—" : `${Number(timeDifference).toFixed(3)} s`})`;
  differenceHeading.title =
    "値の差は右固定線 − 左固定線、時間差は右固定線時刻 − 左固定線時刻です。";

  const body = table.tBodies[0];
  const entries = overlayMode
    ? Array.from(window.overlayVisibleSeries || [])
      .sort((a, b) => a - b)
      .map(index => ({
        index,
        chart: window.getOverlaySeriesChart?.(index),
        series: seriesData[index]
      }))
      .filter(entry => entry.chart && entry.series)
    : Array.from(document.querySelectorAll("#graphs .chart-panel"))
      .map(chartPanel => {
        const index = Number.parseInt(chartPanel.id.replace("panel", ""), 10);
        return { index, chart: charts[index], series: seriesData[index] };
      })
      .filter(entry => entry.chart && entry.series);

  const rowsMatch = body.rows.length === entries.length &&
    entries.every((entry, rowIndex) => body.rows[rowIndex].dataset.chartIndex === String(entry.index));
  if (!rowsMatch) {
    body.replaceChildren();
    entries.forEach(entry => {
      const row = document.createElement("tr");
      row.dataset.chartIndex = String(entry.index);
      row.addEventListener("click", event => {
        if (window.overlayMode) window.selectOverlaySeries(entry.index, event);
        else selectChart(entry.index, event);
      });
      row.addEventListener("mouseenter", () => window.setHoveredSeries(entry.index));
      row.addEventListener("mouseleave", () => window.clearHoveredSeries(entry.index));
      row.appendChild(createHairlineCell(entry.series.meta.ecu || "", "hairline-ecu"));
      row.appendChild(createHairlineCell(entry.series.meta.label || "", "hairline-signal"));
      for (let i = 0; i < 7; i++) row.appendChild(createHairlineCell("", ""));
      body.appendChild(row);
    });
  }

  entries.forEach((entry, rowIndex) => {
    const { chart, series } = entry;
    const row = body.rows[rowIndex];
    const chartPanel = document.getElementById(`panel${entry.index}`);
    row.classList.toggle(
      "selected",
      overlayMode
        ? window.overlaySelectedSeries.has(entry.index)
        : chartPanel?.classList.contains("selected") || false
    );
    row.cells[0].textContent = series.meta.ecu || "";
    row.cells[1].textContent = series.meta.label || "";
    row.cells[2].textContent =
      cursorTime == null
        ? "—"
        : formatHairlineValue(chart, getHairlineValue(chart, cursorTime, "cursor"));
    row.cells[3].textContent =
      leftTime == null
        ? "—"
        : formatHairlineValue(chart, getHairlineValue(chart, leftTime, "left"));
    row.cells[4].textContent =
      rightTime == null
        ? "—"
        : formatHairlineValue(chart, getHairlineValue(chart, rightTime, "right"));
    row.cells[5].textContent = formatHairlineDifference(
      chart,
      leftTime == null ? null : getHairlineValue(chart, leftTime, "left"),
      rightTime == null ? null : getHairlineValue(chart, rightTime, "right")
    );
    formatHairlineStatistics(chart).forEach((value, index) => {
      row.cells[6 + index].textContent = value;
    });
  });

  if (!table.dataset.columnWidthsInitialized && !panel.hidden) {
    const widths = [100, 180, 125, 125, 125, 140, 100, 100, 100];
    if (widths.length) {
      setHairlineColumnWidths(table, widths);
      table.dataset.columnWidthsInitialized = "true";
    }
  }

  if (!panel.hidden && !panel.classList.contains("is-minimized")) {
    const previousRowCount = Number(panel.dataset.autoHeightRowCount);
    if (Number.isFinite(previousRowCount) && entries.length > previousRowCount) {
      growHairlineWindowForRows(
        panel,
        table,
        document.getElementById("hairlineValuesTitleBar"),
        panel.querySelector(".hairline-values-scroll")
      );
    }
    panel.dataset.autoHeightRowCount = String(entries.length);
  }
};

function setHairlineWindowMaximized(maximized) {
  const panel = document.getElementById("hairlineValuesPanel");
  const button = document.getElementById("hairlineMaximizeBtn");
  if (!panel || !button) return;

  if (maximized) {
    const rect = panel.getBoundingClientRect();
    panel.dataset.restoreLeft = `${rect.left}px`;
    panel.dataset.restoreTop = `${rect.top}px`;
    panel.dataset.restoreWidth = panel.style.width;
    panel.dataset.restoreHeight = panel.style.height;
    panel.style.width = "";
    panel.style.height = "";
    panel.classList.add("is-maximized");
    button.textContent = "❐";
    button.setAttribute("aria-label", "元のサイズに戻す");
    button.title = "元のサイズに戻す";
  } else {
    panel.classList.remove("is-maximized");
    panel.style.left = panel.dataset.restoreLeft || "";
    panel.style.top = panel.dataset.restoreTop || "";
    panel.style.width = panel.dataset.restoreWidth || "";
    panel.style.height = panel.dataset.restoreHeight || "";
    button.textContent = "□";
    button.setAttribute("aria-label", "最大化");
    button.title = "最大化";
  }
}

function setHairlineWindowMinimized(panel, button, minimized) {
  if (minimized) {
    if (panel.classList.contains("is-maximized")) {
      setHairlineWindowMaximized(false);
    }
    const rect = panel.getBoundingClientRect();
    const titleBar = document.getElementById("hairlineValuesTitleBar");
    panel.dataset.minimizedLeft = `${rect.left}px`;
    panel.dataset.minimizedTop = `${rect.top}px`;
    panel.dataset.minimizedWidth = `${rect.width}px`;
    panel.dataset.minimizedHeight = `${rect.height}px`;
    panel.style.right = "auto";
    panel.style.bottom = "auto";
    panel.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - rect.width - 8))}px`;
    panel.style.top = `${Math.max(8, window.innerHeight - titleBar.offsetHeight - 8)}px`;
    panel.classList.add("is-minimized");
  } else {
    panel.classList.remove("is-minimized");
    panel.style.left = panel.dataset.minimizedLeft || "";
    panel.style.top = panel.dataset.minimizedTop || "";
    panel.style.width = panel.dataset.minimizedWidth || "";
    panel.style.height = panel.dataset.minimizedHeight || "";
    growHairlineWindowForRows(
      panel,
      document.getElementById("hairlineValuesTable"),
      document.getElementById("hairlineValuesTitleBar"),
      panel.querySelector(".hairline-values-scroll")
    );
  }

  button.textContent = minimized ? "❐" : "_";
  button.setAttribute("aria-label", minimized ? "元のサイズに戻す" : "最小化");
  button.title = minimized ? "元のサイズに戻す" : "最小化";
}

function fitHairlineWindowToTable(panel, table, scrollArea, titleBar, edge) {
  const currentRect = panel.getBoundingClientRect();
  const scrollStyle = getComputedStyle(scrollArea);
  const panelStyle = getComputedStyle(panel);
  const fitWidth = edge === "e" || edge === "w";
  const fitHeight = edge === "n" || edge === "s";
  if (!fitWidth && !fitHeight) return;

  let width = currentRect.width;
  let height = currentRect.height;
  let left = currentRect.left;
  let top = currentRect.top;

  if (fitWidth) {
    const horizontalMargins =
      (parseFloat(scrollStyle.marginLeft) || 0) +
      (parseFloat(scrollStyle.marginRight) || 0);
    const scrollbarWidth = scrollArea.offsetWidth - scrollArea.clientWidth;
    const panelBorders =
      (parseFloat(panelStyle.borderLeftWidth) || 0) +
      (parseFloat(panelStyle.borderRightWidth) || 0);
    const desiredWidth =
      table.scrollWidth + horizontalMargins + scrollbarWidth + panelBorders;
    const savedWidth = panel.style.width;
    panel.style.width = "max-content";
    const maxWidth = panel.getBoundingClientRect().width;
    panel.style.width = savedWidth;
    width = Math.min(desiredWidth, maxWidth, window.innerWidth - 16);
    left = Math.max(8, Math.min(currentRect.right - width, window.innerWidth - width - 8));
  }

  if (fitHeight) {
    const desiredHeight =
      getHairlineContentHeight(panel, table, titleBar, scrollArea);
    const maxHeight = parseFloat(panelStyle.maxHeight);
    const minHeight = parseFloat(panelStyle.minHeight) || 100;
    height = Math.max(
      minHeight,
      Math.min(desiredHeight, maxHeight, window.innerHeight - 24)
    );
    top = Math.max(8, Math.min(currentRect.top, window.innerHeight - height - 8));
  }

  panel.style.right = "auto";
  panel.style.bottom = "auto";
  panel.style.left = `${left}px`;
  panel.style.top = `${top}px`;
  if (fitWidth) panel.style.width = `${width}px`;
  if (fitHeight) panel.style.height = `${height}px`;
}

document.addEventListener("DOMContentLoaded", () => {
  const panel = document.getElementById("hairlineValuesPanel");
  const titleBar = document.getElementById("hairlineValuesTitleBar");
  const minimizeButton = document.getElementById("hairlineMinimizeBtn");
  const maximizeButton = document.getElementById("hairlineMaximizeBtn");
  const closeButton = document.getElementById("hairlineCloseBtn");
  if (!panel || !titleBar) return;

  let suppressMinimizeClick = false;
  minimizeButton.addEventListener("click", () => {
    if (suppressMinimizeClick) {
      suppressMinimizeClick = false;
      return;
    }
    const minimized = !panel.classList.contains("is-minimized");
    setHairlineWindowMinimized(panel, minimizeButton, minimized);
  });

  maximizeButton.addEventListener("click", () => {
    if (panel.classList.contains("is-minimized")) {
      setHairlineWindowMinimized(panel, minimizeButton, false);
    }
    setHairlineWindowMaximized(!panel.classList.contains("is-maximized"));
  });

  closeButton.addEventListener("click", () => {
    const visibilityToggle = document.getElementById("toggleHairlineValues");
    visibilityToggle.checked = false;
    const mode = window.overlayMode ? "overlay" : "normal";
    window.hairlineValuesEnabledByMode[mode] = false;
    if (panel.classList.contains("is-minimized")) {
      setHairlineWindowMinimized(panel, minimizeButton, false);
    }
    if (panel.classList.contains("is-maximized")) {
      setHairlineWindowMaximized(false);
    }
    panel.hidden = true;
    saveStateToLocalStorage();
  });

  const visibilityToggle = document.getElementById("toggleHairlineValues");
  visibilityToggle.addEventListener("click", event => event.stopPropagation());
  visibilityToggle.addEventListener("change", () => {
    const mode = window.overlayMode ? "overlay" : "normal";
    window.hairlineValuesEnabledByMode[mode] = visibilityToggle.checked;
    if (visibilityToggle.checked) {
      if (panel.classList.contains("is-minimized")) {
        setHairlineWindowMinimized(panel, minimizeButton, false);
      }
    }
    window.updateHairlineValuesPanel();
    saveStateToLocalStorage();
  });

  const table = document.getElementById("hairlineValuesTable");
  const scrollArea = panel.querySelector(".hairline-values-scroll");
  table.querySelectorAll("thead th").forEach(header => {
    header.title = "列境界をドラッグして幅を変更、ダブルクリックで自動調整";
  });
  let columnResizeState = null;
  table.addEventListener("pointerdown", event => {
    const header = event.target.closest("th");
    if (!header || event.clientX < header.getBoundingClientRect().right - 7) return;

    const columnIndex = header.cellIndex;
    const widths = getHairlineColumns(table).map(column =>
      Number.parseFloat(column.style.width) || column.getBoundingClientRect().width
    );
    columnResizeState = {
      pointerId: event.pointerId,
      columnIndex,
      startX: event.clientX,
      startWidth: widths[columnIndex],
      widths,
      header
    };
    header.classList.add("column-resizing");
    header.setPointerCapture(event.pointerId);
    event.preventDefault();
  });

  table.addEventListener("dblclick", event => {
    const header = event.target.closest("th");
    if (!header || event.clientX < header.getBoundingClientRect().right - 7) return;

    const widths = getHairlineColumns(table).map(column =>
      Number.parseFloat(column.style.width) || column.getBoundingClientRect().width
    );
    widths[header.cellIndex] = measureHairlineColumn(table, header.cellIndex);
    setHairlineColumnWidths(table, widths);
    event.preventDefault();
  });

  document.addEventListener("pointermove", event => {
    if (!columnResizeState || columnResizeState.pointerId !== event.pointerId) return;
    const widths = [...columnResizeState.widths];
    widths[columnResizeState.columnIndex] = Math.max(
      56,
      columnResizeState.startWidth + event.clientX - columnResizeState.startX
    );
    setHairlineColumnWidths(table, widths);
  });

  const finishColumnResize = event => {
    if (!columnResizeState || columnResizeState.pointerId !== event.pointerId) return;
    columnResizeState.header.classList.remove("column-resizing");
    columnResizeState = null;
  };
  document.addEventListener("pointerup", finishColumnResize);
  document.addEventListener("pointercancel", finishColumnResize);

  let resizeState = null;
  panel.querySelectorAll(".hairline-resize-handle").forEach(resizeHandle => {
    resizeHandle.title = `${resizeHandle.title}、ダブルクリックで表に合わせる`;
    resizeHandle.addEventListener("dblclick", event => {
      if (panel.classList.contains("is-maximized") || panel.classList.contains("is-minimized")) return;
      event.preventDefault();
      event.stopPropagation();
      if (resizeHandle.dataset.resizeEdge === "n" ||
          resizeHandle.dataset.resizeEdge === "s") {
        delete panel.dataset.autoHeightDisabled;
      }
      fitHairlineWindowToTable(
        panel,
        table,
        scrollArea,
        titleBar,
        resizeHandle.dataset.resizeEdge
      );
    });
    resizeHandle.addEventListener("pointerdown", event => {
      if (panel.classList.contains("is-maximized") || panel.classList.contains("is-minimized")) return;
      const rect = panel.getBoundingClientRect();
      resizeState = {
        pointerId: event.pointerId,
        edge: resizeHandle.dataset.resizeEdge,
        startX: event.clientX,
        startY: event.clientY,
        startWidth: rect.width,
        startHeight: rect.height,
        left: rect.left,
        top: rect.top
      };
      panel.style.right = "auto";
      panel.style.bottom = "auto";
      panel.style.left = `${rect.left}px`;
      panel.style.top = `${rect.top}px`;
      resizeHandle.setPointerCapture(event.pointerId);
      event.preventDefault();
      event.stopPropagation();
    });
  });

  let dragState = null;
  titleBar.addEventListener("pointerdown", event => {
    if (panel.classList.contains("is-maximized")) return;
    if (panel.classList.contains("is-minimized")) {
      dragState = {
        pointerId: event.pointerId,
        offsetX: event.clientX - panel.getBoundingClientRect().left,
        offsetY: event.clientY - panel.getBoundingClientRect().top,
        startX: event.clientX,
        startY: event.clientY,
        minimized: true,
        moved: false
      };
      event.target.setPointerCapture(event.pointerId);
      event.preventDefault();
      return;
    }
    if (event.target.closest("button")) return;
    const rect = panel.getBoundingClientRect();
    dragState = {
      pointerId: event.pointerId,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      minimized: false,
      moved: false
    };
    event.preventDefault();
  });

  document.addEventListener("pointermove", event => {
    if (resizeState && resizeState.pointerId === event.pointerId) {
      const dx = event.clientX - resizeState.startX;
      const dy = event.clientY - resizeState.startY;
      if ((resizeState.edge === "n" || resizeState.edge === "s") && dy !== 0) {
        panel.dataset.autoHeightDisabled = "true";
      }
      const minWidth = Math.min(320, window.innerWidth - 32);
      const minHeight = Math.min(100, window.innerHeight - 24);
      let left = resizeState.left;
      let top = resizeState.top;
      let width = resizeState.startWidth;
      let height = resizeState.startHeight;

      if (resizeState.edge === "e") width += dx;
      if (resizeState.edge === "w") {
        left += dx;
        width -= dx;
      }
      if (resizeState.edge === "s") height += dy;
      if (resizeState.edge === "n") {
        top += dy;
        height -= dy;
      }

      width = Math.max(minWidth, Math.min(width, window.innerWidth - left - 8));
      height = Math.max(minHeight, Math.min(height, window.innerHeight - top - 8));
      if (resizeState.edge === "w") left = resizeState.left + resizeState.startWidth - width;
      if (resizeState.edge === "n") top = resizeState.top + resizeState.startHeight - height;

      panel.style.left = `${Math.max(8, left)}px`;
      panel.style.top = `${Math.max(8, top)}px`;
      panel.style.width = `${width}px`;
      panel.style.height = `${height}px`;
      return;
    }
    if (dragState && dragState.pointerId === event.pointerId) {
      if (dragState.minimized) {
        if (Math.hypot(
          event.clientX - dragState.startX,
          event.clientY - dragState.startY
        ) > 3) {
          dragState.moved = true;
        }
        if (!dragState.moved) return;
      }
      const maxLeft = Math.max(0, window.innerWidth - panel.offsetWidth);
      const maxTop = Math.max(0, window.innerHeight - titleBar.offsetHeight);
      panel.style.right = "auto";
      panel.style.left = `${Math.max(0, Math.min(event.clientX - dragState.offsetX, maxLeft))}px`;
      panel.style.top = `${Math.max(0, Math.min(event.clientY - dragState.offsetY, maxTop))}px`;
    }
  });

  const finishDrag = event => {
    if (dragState && dragState.pointerId === event.pointerId) {
      suppressMinimizeClick = event.type === "pointerup" &&
        dragState.minimized &&
        dragState.moved;
      dragState = null;
    }
    if (resizeState && resizeState.pointerId === event.pointerId) resizeState = null;
  };
  document.addEventListener("pointerup", finishDrag);
  document.addEventListener("pointercancel", finishDrag);
  titleBar.addEventListener("dblclick", event => {
    if (event.target.closest("button")) return;
    if (panel.classList.contains("is-minimized")) {
      setHairlineWindowMinimized(panel, minimizeButton, false);
    }
    setHairlineWindowMaximized(!panel.classList.contains("is-maximized"));
  });

  window.updateHairlineValuesPanel();

  const graphs = document.getElementById("graphs");
  if (graphs) {
    const selectionObserver = new MutationObserver(() => {
      window.updateHairlineValuesPanel();
    });
    selectionObserver.observe(graphs, {
      subtree: true,
      attributes: true,
      attributeFilter: ["class"]
    });
  }
});

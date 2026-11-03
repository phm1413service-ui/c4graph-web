function openGraphScreenshotDialog() {
  const hasGraphs = window.overlayMode
    ? window.overlayChart?.data.datasets.length > 0
    : document.querySelector("#graphs .chart-panel") !== null;
  if (!hasGraphs) {
    alert("保存できるグラフがありません");
    return;
  }

  const overlay = document.getElementById("graphScreenshotDialogOverlay");
  const input = document.getElementById("graphScreenshotFilenameInput");
  if (!overlay || !input) {
    throw new Error("グラフのスクリーンショット保存ダイアログが見つかりません");
  }

  input.value = getDefaultC4GFilename().replace(/\.c4g$/i, "");
  overlay.style.display = "flex";
  input.focus();
  input.select();
}

function closeGraphScreenshotDialog() {
  const overlay = document.getElementById("graphScreenshotDialogOverlay");
  if (overlay) overlay.style.display = "none";
}

async function handleGraphScreenshotDialogOk() {
  const input = document.getElementById("graphScreenshotFilenameInput");
  if (!input) return;

  let filename = input.value.trim();
  if (!filename) {
    alert("ファイル名を入力してください。");
    return;
  }

  if (!filename.toLowerCase().endsWith(".png")) {
    filename += ".png";
  }

  closeGraphScreenshotDialog();
  try {
    await exportGraphScreenshot(filename);
  } catch (error) {
    console.error("グラフのスクリーンショット保存に失敗しました", error);
    alert("グラフのスクリーンショット保存に失敗しました。\n" + error.message);
  }
}

async function exportGraphScreenshot(filename) {
  const graphs = document.getElementById("graphs");
  const rangeSlider = document.getElementById("xRangeSlider");
  const graphCanvas = window.overlayMode
    ? captureOverlayGraph()
    : captureNormalGraphs(graphs);
  if (!graphCanvas) {
    alert("保存できるグラフがありません");
    return;
  }

  if (typeof html2canvas !== "function") {
    throw new Error("html2canvas が読み込まれていません");
  }

  const options = {
    backgroundColor: "#ffffff",
    scale: window.devicePixelRatio || 1,
    useCORS: true
  };
  const sliderVisible = rangeSlider &&
    rangeSlider.getClientRects().length > 0 &&
    getComputedStyle(rangeSlider).visibility !== "hidden";
  const graphRect = graphCanvas.bounds;
  const scale = window.devicePixelRatio || 1;
  const sliderCapture = sliderVisible
    ? createRangeSliderCapture(rangeSlider)
    : null;
  let sliderCanvas = null;
  try {
    sliderCanvas = await Promise.all([
      sliderCapture ? html2canvas(sliderCapture.wrapper, options) : Promise.resolve(null)
    ]).then(([canvas]) => canvas);
  } finally {
    sliderCapture?.wrapper.remove();
  }

  const sliderLeft = sliderCapture
    ? sliderCapture.sliderRect.left - sliderCapture.paddingLeft
    : graphRect.left;
  const sliderRight = sliderCapture
    ? sliderCapture.sliderRect.right + sliderCapture.paddingRight
    : graphRect.right;
  const canvasLeft = Math.min(graphRect.left, sliderLeft);
  const canvasRight = Math.max(graphRect.right, sliderRight);
  const graphOffsetX = Math.round((graphRect.left - canvasLeft) * scale);
  const sliderOffsetX = sliderCapture
    ? Math.round((sliderLeft - canvasLeft) * scale)
    : 0;
  const gap = sliderCanvas ? Math.round(16 * scale) : 0;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(
    Math.round((canvasRight - canvasLeft) * scale),
    graphOffsetX + graphCanvas.canvas.width,
    sliderOffsetX + (sliderCanvas?.width || 0)
  );
  canvas.height = graphCanvas.canvas.height + gap + (sliderCanvas?.height || 0);

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("PNG画像の描画領域を作成できませんでした");
  }
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(graphCanvas.canvas, graphOffsetX, 0);
  if (sliderCanvas) {
    const sliderTop = graphCanvas.canvas.height + gap;
    context.drawImage(sliderCanvas, sliderOffsetX, sliderTop);
    drawRangeValueBoxes(
      context,
      sliderCapture,
      sliderOffsetX,
      sliderTop,
      scale
    );
  }

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob(result => {
      if (result) {
        resolve(result);
      } else {
        reject(new Error("PNG画像を作成できませんでした"));
      }
    }, "image/png");
  });

  await downloadBlob(blob, filename);
}

function captureNormalGraphs(graphs) {
  if (!graphs) return null;
  const panels = [...graphs.querySelectorAll(".chart-panel")];
  if (panels.length === 0) return null;

  const scale = window.devicePixelRatio || 1;
  const width = Math.max(...panels.map(panel => panel.clientWidth));
  const height = panels.reduce((sum, panel) => sum + panel.offsetHeight, 0) +
    Math.max(0, panels.length - 1) * 5;
  const canvas = createScreenshotCanvas(width, height, scale);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("PNG画像の描画領域を作成できませんでした");
  context.scale(scale, scale);
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);

  let top = 0;
  panels.forEach(panel => {
    const chartCanvas = panel.querySelector("canvas");
    const chart = chartCanvas && Chart.getChart(chartCanvas);
    if (!chart) {
      throw new Error(`グラフ ${panel.id} を画像化できません`);
    }

    const panelWidth = panel.clientWidth;
    const panelHeight = panel.offsetHeight;
    const isCompact = panel.classList.contains("compact-mode");

    if (isCompact) {
      // コンパクトモード: タイトルバーなしで描画
      const overlayTitle = panel.querySelector(".compact-title-overlay");
      const titleText = overlayTitle?.textContent?.trim() || "";

      // 背景
      context.fillStyle = "#ffffff";
      context.fillRect(0, top, panelWidth, panelHeight);

      // グラフ本体
      context.drawImage(chart.canvas, 0, top, panelWidth, panelHeight);

      // タイトルテキスト（オーバーレイの実際の位置に描画）
      if (titleText && overlayTitle) {
        const overlayRect = overlayTitle.getBoundingClientRect();
        const panelRect = panel.getBoundingClientRect();
        const overlayX = overlayRect.left - panelRect.left;
        const overlayY = overlayRect.top - panelRect.top;

        context.fillStyle = "rgba(255, 255, 255, 0.95)";
        context.fillRect(overlayX, top + overlayY, overlayRect.width, overlayRect.height);
        context.fillStyle = "#333333";
        context.font = "600 12px sans-serif";
        context.textBaseline = "middle";
        context.fillText(titleText, overlayX + 8, top + overlayY + overlayRect.height / 2, overlayRect.width - 16);
      }
    } else {
      // 通常モード: タイトルバーありで描画
      const title = panel.querySelector(".chart-title > span:not(.drag-handle):not(.settings-icon):not(.chart-controls)");
      context.fillStyle = "#f0f0f0";
      context.fillRect(0, top, panelWidth, 28);
      context.fillStyle = "#222222";
      context.font = "600 13px sans-serif";
      context.textBaseline = "middle";
      context.fillText(title?.textContent?.trim() || "", 8, top + 14, panelWidth - 16);
      context.fillStyle = "#ffffff";
      context.fillRect(0, top + 28, panelWidth, Math.max(0, panelHeight - 28));
      context.drawImage(chart.canvas, 0, top + 28, panelWidth, Math.max(0, panelHeight - 28));
    }
    top += panelHeight + 5;
  });

  return {
    canvas,
    bounds: { left: graphs.getBoundingClientRect().left, right: graphs.getBoundingClientRect().right }
  };
}

function captureOverlayGraph() {
  const chart = window.overlayChart;
  const legend = document.getElementById("overlayLegend");
  if (!chart || chart.data.datasets.length === 0 || !legend) return null;

  const scale = window.devicePixelRatio || 1;
  const width = Math.max(chart.canvas.clientWidth, legend.clientWidth);
  const entries = [...legend.querySelectorAll(".overlay-legend-entry")];
  const items = entries.map(entry => {
    const label = [...entry.childNodes]
      .filter(node => node.nodeType === Node.TEXT_NODE)
      .map(node => node.textContent.trim())
      .filter(Boolean)
      .join(" ");
    const dataset = chart.data.datasets.find(item =>
      item.seriesIndex === Number(entry.dataset.seriesIndex)
    );
    return {
      label,
      dataset,
      width: label ? contextTextWidth(label) + 26 : 0
    };
  }).filter(item => item.label && item.dataset);
  let legendRows = 1;
  let rowWidth = 10;
  items.forEach(item => {
    if (rowWidth + item.width > width - 8 && rowWidth > 10) {
      legendRows++;
      rowWidth = 10;
    }
    rowWidth += item.width + 12;
  });
  const legendHeight = items.length === 0 ? 24 : Math.max(30, legendRows * 18 + 8);
  const canvas = createScreenshotCanvas(width, legendHeight + chart.canvas.clientHeight, scale);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("PNG画像の描画領域を作成できませんでした");
  context.scale(scale, scale);
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, legendHeight + chart.canvas.clientHeight);

  context.font = "12px sans-serif";
  context.textBaseline = "middle";
  let x = 10;
  let y = 16;
  items.forEach(({ label, dataset, width: itemWidth }) => {
    if (x + itemWidth > width - 8 && x > 10) {
      x = 10;
      y += 18;
    }
    context.strokeStyle = dataset.borderColor;
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(x, y);
    context.lineTo(x + 14, y);
    context.stroke();
    context.fillStyle = "#222222";
    context.fillText(label, x + 19, y);
    x += itemWidth + 12;
  });

  context.drawImage(
    chart.canvas,
    0,
    legendHeight,
    chart.canvas.clientWidth,
    chart.canvas.clientHeight
  );
  const rect = document.getElementById("overlayChartContainer").getBoundingClientRect();
  return { canvas, bounds: { left: rect.left, right: rect.right } };
}

function contextTextWidth(text) {
  const context = document.createElement("canvas").getContext("2d");
  if (!context) return text.length * 12;
  context.font = "12px sans-serif";
  return context.measureText(text).width;
}

function createScreenshotCanvas(width, height, scale) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.ceil(width * scale));
  canvas.height = Math.max(1, Math.ceil(height * scale));
  return canvas;
}

function createRangeSliderCapture(rangeSlider) {
  const sliderRect = rangeSlider.getBoundingClientRect();
  const valueBoxElements = [...rangeSlider.querySelectorAll(".value-box")];
  const valueBoxRects = valueBoxElements.map(element => element.getBoundingClientRect());
  const paddingLeft = Math.ceil(Math.max(
    0,
    ...valueBoxRects.map(rect => sliderRect.left - rect.left)
  )) + 4;
  const paddingRight = Math.ceil(Math.max(
    0,
    ...valueBoxRects.map(rect => rect.right - sliderRect.right)
  )) + 4;
  const paddingTop = Math.ceil(Math.max(
    0,
    ...valueBoxRects.map(rect => sliderRect.top - rect.top)
  )) + 4;
  const paddingBottom = Math.ceil(Math.max(
    0,
    ...valueBoxRects.map(rect => rect.bottom - sliderRect.bottom)
  )) + 4;
  const wrapper = document.createElement("div");
  wrapper.style.cssText = [
    "position:fixed",
    "left:-10000px",
    "top:0",
    `width:${sliderRect.width + paddingLeft + paddingRight}px`,
    `height:${sliderRect.height + paddingTop + paddingBottom}px`
  ].join(";");

  const sliderClone = rangeSlider.cloneNode(true);
  sliderClone.style.cssText += [
    "position:absolute",
    `left:${paddingLeft}px`,
    `top:${paddingTop}px`,
    `width:${sliderRect.width}px`,
    `height:${sliderRect.height}px`,
    "margin:0",
    "display:block"
  ].join(";");
  const valueBoxes = valueBoxElements.map((element, index) => {
    const input = element.querySelector("input");
    const inputStyle = input ? getComputedStyle(input) : null;
    const boxStyle = getComputedStyle(element);
    const clonedBox = sliderClone.querySelectorAll(".value-box")[index];
    if (clonedBox) clonedBox.style.visibility = "hidden";

    return {
      rect: valueBoxRects[index],
      value: input?.value || "",
      font: inputStyle?.font || boxStyle.font,
      color: inputStyle?.color || boxStyle.color,
      borderColor: boxStyle.borderTopColor
    };
  });
  wrapper.appendChild(sliderClone);
  document.body.appendChild(wrapper);

  return {
    wrapper,
    sliderRect,
    paddingLeft,
    paddingRight,
    paddingTop,
    valueBoxes
  };
}

function drawRangeValueBoxes(context, sliderCapture, sliderOffsetX, sliderTop, scale) {
  sliderCapture.valueBoxes.forEach(({ rect, value, font, color, borderColor }) => {
    const x = sliderOffsetX +
      (rect.left - sliderCapture.sliderRect.left) * scale;
    const y = sliderTop + (
      sliderCapture.paddingTop +
      rect.top -
      sliderCapture.sliderRect.top
    ) * scale;
    const width = rect.width * scale;
    const height = rect.height * scale;
    const radius = 4 * scale;

    context.save();
    createRoundedRectanglePath(context, x, y, width, height, radius);
    context.fillStyle = "#ffffff";
    context.fill();
    context.lineWidth = scale;
    context.strokeStyle = borderColor;
    context.stroke();
    context.beginPath();
    context.rect(x + 2 * scale, y + scale, width - 4 * scale, height - 2 * scale);
    context.clip();
    context.font = font;
    context.fillStyle = color;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(value, x + width / 2, y + height / 2, width - 12 * scale);
    context.restore();
  });
}

function createRoundedRectanglePath(context, x, y, width, height, radius) {
  const cornerRadius = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + cornerRadius, y);
  context.lineTo(x + width - cornerRadius, y);
  context.arcTo(x + width, y, x + width, y + cornerRadius, cornerRadius);
  context.lineTo(x + width, y + height - cornerRadius);
  context.arcTo(x + width, y + height, x + width - cornerRadius, y + height, cornerRadius);
  context.lineTo(x + cornerRadius, y + height);
  context.arcTo(x, y + height, x, y + height - cornerRadius, cornerRadius);
  context.lineTo(x, y + cornerRadius);
  context.arcTo(x, y, x + cornerRadius, y, cornerRadius);
  context.closePath();
}

document.addEventListener("DOMContentLoaded", () => {
  const cancelButton = document.getElementById("graphScreenshotDialogCancelBtn");
  const okButton = document.getElementById("graphScreenshotDialogOkBtn");
  const input = document.getElementById("graphScreenshotFilenameInput");

  if (cancelButton) {
    cancelButton.addEventListener("click", closeGraphScreenshotDialog);
  }

  if (okButton) {
    okButton.addEventListener("click", handleGraphScreenshotDialogOk);
  }

  if (input) {
    input.addEventListener("keydown", event => {
      if (event.key === "Enter") {
        event.preventDefault();
        handleGraphScreenshotDialogOk();
      } else if (event.key === "Escape") {
        event.preventDefault();
        closeGraphScreenshotDialog();
      }
    });
  }
});

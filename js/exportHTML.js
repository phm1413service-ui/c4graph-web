const standaloneChartLibraries = [
  "https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js",
  "https://cdn.jsdelivr.net/npm/chartjs-plugin-annotation@3.0.1/dist/chartjs-plugin-annotation.min.js"
];

function openStandaloneHtmlDialog() {
  const panels = document.querySelectorAll("#graphs .chart-panel");
  if (panels.length === 0) {
    alert("共有用に保存できるグラフがありません");
    return;
  }

  const overlay = document.getElementById("standaloneHtmlDialogOverlay");
  const input = document.getElementById("standaloneHtmlFilenameInput");
  if (!overlay || !input) {
    throw new Error("共有用HTMLの保存ダイアログが見つかりません");
  }

  input.value = getDefaultC4GFilename().replace(/\.c4g$/i, "") + "_viewer";
  overlay.style.display = "flex";
  input.focus();
  input.select();
}

function closeStandaloneHtmlDialog() {
  const overlay = document.getElementById("standaloneHtmlDialogOverlay");
  if (overlay) overlay.style.display = "none";
}

async function handleStandaloneHtmlDialogOk() {
  const input = document.getElementById("standaloneHtmlFilenameInput");
  if (!input) return;

  let filename = input.value.trim();
  if (!filename) {
    alert("ファイル名を入力してください。");
    return;
  }
  if (!filename.toLowerCase().endsWith(".html")) filename += ".html";

  closeStandaloneHtmlDialog();
  try {
    await exportAsStandaloneHTML(filename);
  } catch (error) {
    console.error("共有用HTMLの保存に失敗しました", error);
    alert("共有用HTMLの保存に失敗しました。\n" + error.message);
  }
}

async function loadStandaloneChartLibraries() {
  const sources = await Promise.all(standaloneChartLibraries.map(async url => {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error("グラフ表示ライブラリを取得できませんでした: " + response.status);
    }
    return response.text();
  }));
  return sources.map(source => source.replace(/<\/script/gi, "<\\/script"));
}

function getStandaloneChartData() {
  const panels = Array.from(document.querySelectorAll("#graphs .chart-panel"));
  const graphs = panels.map((panel, panelOrder) => {
    const index = Number.parseInt(panel.id.replace("panel", ""), 10);
    const chart = charts[index];
    const series = seriesData[index];
    const dataset = chart?.data?.datasets?.[0];
    if (!chart || !series || !dataset) {
      throw new Error("グラフ " + (panelOrder + 1) + " のデータを取得できませんでした");
    }

    return {
      title: [series.meta.ecu, series.meta.label].filter(Boolean).join(" - "),
      unit: (dataset.unit || "").replace(/^"+|"+$/g, ""),
      data: dataset.data.map(point => ({
        x: point.x,
        y: point.y
      })),
      color: dataset.borderColor,
      stepped: dataset.stepped,
      pointRadius: dataset.pointRadius,
      xMin: chart.scales.x.min,
      xMax: chart.scales.x.max,
      yMin: chart.scales.y.min,
      yMax: chart.scales.y.max,
      xAxisVisible: chart.options.scales.x.display !== false,
      height: Math.max(180, Math.round(panel.getBoundingClientRect().height)),
      unitMap: dataset.unitMap ? Array.from(dataset.unitMap.entries()) : [],
      visibleYLabels: chart._visibleYLabels
        ? Array.from(chart._visibleYLabels)
        : null,
      zeroLine: chart._zeroLine !== false && !dataset.unitMap,
      customYLines: chart._customYLines ? chart._customYLines.map(line => ({ ...line })) : []
    };
  });

  return {
    title: [window.originalVehicleID, window.originalDescription].filter(Boolean).join(" - ") || "C4Graph Viewer",
    graphs,
    csv: typeof window.originalCSVText === "string" ? window.originalCSVText : null
  };
}

function createStandaloneHtml(libraries, data) {
  const embeddedData = JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
  const template = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>__TITLE__</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; color: #222; background: #f5f6f7; font-family: sans-serif; }
    header { position: sticky; top: 0; z-index: 1; padding: 12px 18px; background: #fff; border-bottom: 1px solid #ccc; }
    h1 { margin: 0; font-size: 18px; }
    #graphs { max-width: 1400px; margin: 0 auto; padding: 12px; }
    .chart-panel { margin: 0 0 12px; padding: 10px 12px; border: 1px solid #ddd; border-radius: 6px; background: #fff; }
    .chart-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 6px; font-weight: 600; }
    .chart-controls { display: flex; flex-wrap: wrap; gap: 6px; }
    button { padding: 5px 10px; cursor: pointer; }
    .chart-canvas { position: relative; width: 100%; }
    .chart-canvas canvas { display: block; width: 100%; }
    #downloadCsv { margin-left: 12px; }
    .empty { padding: 30px; text-align: center; }
    @media (max-width: 600px) {
      header { position: static; }
      .chart-heading { align-items: flex-start; flex-direction: column; }
      #graphs { padding: 8px; }
    }
  </style>
</head>
<body>
  <header>
    <h1 id="viewerTitle"></h1>
    <button id="downloadCsv" type="button" hidden>元CSVを保存</button>
  </header>
  <main id="graphs"></main>
  <script>__CHART_JS__</script>
  <script>__ANNOTATION_JS__</script>
  <script>
    Chart.register(window["chartjs-plugin-annotation"]);
    const exportData = __DATA__;
    const graphsRoot = document.getElementById("graphs");
    document.title = exportData.title;
    document.getElementById("viewerTitle").textContent = exportData.title;

    if (exportData.csv !== null) {
      const csvButton = document.getElementById("downloadCsv");
      csvButton.hidden = false;
      csvButton.addEventListener("click", () => {
        const url = URL.createObjectURL(new Blob([exportData.csv], { type: "text/csv;charset=utf-8" }));
        const link = document.createElement("a");
        link.href = url;
        link.download = "data.csv";
        link.click();
        URL.revokeObjectURL(url);
      });
    }

    if (exportData.graphs.length === 0) {
      graphsRoot.className = "empty";
      graphsRoot.textContent = "表示できるグラフがありません。";
    }

    exportData.graphs.forEach((graph, index) => {
      const panel = document.createElement("section");
      panel.className = "chart-panel";

      const heading = document.createElement("div");
      heading.className = "chart-heading";
      const title = document.createElement("span");
      title.textContent = graph.title;

      const controls = document.createElement("div");
      controls.className = "chart-controls";
      const zoomIn = document.createElement("button");
      zoomIn.type = "button";
      zoomIn.textContent = "拡大";
      const zoomOut = document.createElement("button");
      zoomOut.type = "button";
      zoomOut.textContent = "縮小";
      const reset = document.createElement("button");
      reset.type = "button";
      reset.textContent = "範囲リセット";
      controls.append(zoomIn, zoomOut, reset);
      heading.append(title, controls);

      const canvasWrapper = document.createElement("div");
      canvasWrapper.className = "chart-canvas";
      canvasWrapper.style.height = graph.height + "px";
      const canvas = document.createElement("canvas");
      canvasWrapper.appendChild(canvas);
      panel.append(heading, canvasWrapper);
      graphsRoot.appendChild(panel);

      const unitLabels = new Map(graph.unitMap);
      const xInitial = { min: graph.xMin, max: graph.xMax };
      const yInitial = { min: graph.yMin, max: graph.yMax };
      const annotations = {
        triggerLine: {
          type: "line",
          scaleID: "x",
          value: 0,
          borderColor: "orange",
          borderWidth: 1
        }
      };
      if (graph.zeroLine && graph.yMin <= 0 && graph.yMax >= 0) {
        annotations.zeroLine = {
          type: "line",
          scaleID: "y",
          value: 0,
          borderColor: "rgba(0,0,0,0.65)",
          borderWidth: 1.5
        };
      }
      graph.customYLines.forEach((line, lineIndex) => {
        annotations["customY" + lineIndex] = {
          type: "line",
          scaleID: "y",
          value: line.value,
          borderColor: line.color || "rgba(0,0,0,0.5)",
          borderWidth: 1,
          label: {
            display: true,
            content: line.label || String(line.value),
            position: "start"
          }
        };
      });
      const chart = new Chart(canvas, {
        type: "line",
        data: {
          datasets: [{
            label: graph.title,
            data: graph.data,
            borderColor: graph.color,
            backgroundColor: graph.color,
            borderWidth: 1,
            pointRadius: graph.pointRadius,
            pointHoverRadius: 5,
            fill: false,
            stepped: graph.stepped,
            spanGaps: true
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: false,
          interaction: { mode: "nearest", intersect: false },
          plugins: {
            legend: { display: false },
            tooltip: {
              enabled: true,
              callbacks: {
                title(items) {
                  return items.length ? Number(items[0].parsed.x).toFixed(3) + " s" : "";
                },
                label(context) {
                  const value = context.parsed.y;
                  const displayValue = unitLabels.get(value) ?? value;
                  return String(displayValue) + (graph.unit ? " " + graph.unit : "");
                }
              }
            },
            annotation: { annotations }
          },
          scales: {
            x: {
              type: "linear",
              display: graph.xAxisVisible,
              min: graph.xMin,
              max: graph.xMax,
              title: { display: graph.xAxisVisible, text: "時間 (s)" },
              ticks: { callback: value => Number(value).toFixed(2) }
            },
            y: {
              type: "linear",
              min: graph.yMin,
              max: graph.yMax,
              afterBuildTicks(axis) {
                if (!graph.visibleYLabels) return;
                axis.ticks = graph.visibleYLabels.map(value => ({ value }));
              },
              ticks: {
                stepSize: unitLabels.size ? 1 : undefined,
                callback(value) {
                  if (graph.visibleYLabels && !graph.visibleYLabels.includes(value)) return "";
                  if (unitLabels.has(value)) return unitLabels.get(value);
                  return Number(value).toPrecision(6).replace(/(?:\\.0+|(?:(\\.\\d*?)0+))$/, "$1");
                }
              }
            }
          }
        }
      });

      function changeRange(factor) {
        const xScale = chart.scales.x;
        const center = (xScale.min + xScale.max) / 2;
        const halfRange = (xScale.max - xScale.min) * factor / 2;
        chart.options.scales.x.min = center - halfRange;
        chart.options.scales.x.max = center + halfRange;
        chart.update();
      }

      zoomIn.addEventListener("click", () => changeRange(0.7));
      zoomOut.addEventListener("click", () => changeRange(1 / 0.7));
      reset.addEventListener("click", () => {
        chart.options.scales.x.min = xInitial.min;
        chart.options.scales.x.max = xInitial.max;
        chart.options.scales.y.min = yInitial.min;
        chart.options.scales.y.max = yInitial.max;
        chart.update();
      });
    });
  </script>
</body>
</html>`;

  return template
    .replace("__TITLE__", data.title.replace(/[&<>"]/g, character => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;"
    })[character]))
    .replace("__CHART_JS__", libraries[0])
    .replace("__ANNOTATION_JS__", libraries[1])
    .replace("__DATA__", embeddedData);
}

async function exportAsStandaloneHTML(filename) {
  const data = getStandaloneChartData();
  const libraries = await loadStandaloneChartLibraries();
  const html = createStandaloneHtml(libraries, data);
  await downloadBlob(new Blob([html], { type: "text/html;charset=utf-8" }), filename);
}

document.addEventListener("DOMContentLoaded", () => {
  const cancelButton = document.getElementById("standaloneHtmlDialogCancelBtn");
  const okButton = document.getElementById("standaloneHtmlDialogOkBtn");
  const input = document.getElementById("standaloneHtmlFilenameInput");

  if (cancelButton) cancelButton.addEventListener("click", closeStandaloneHtmlDialog);
  if (okButton) okButton.addEventListener("click", handleStandaloneHtmlDialogOk);
  if (input) {
    input.addEventListener("keydown", event => {
      if (event.key === "Enter") {
        event.preventDefault();
        handleStandaloneHtmlDialogOk();
      } else if (event.key === "Escape") {
        event.preventDefault();
        closeStandaloneHtmlDialog();
      }
    });
  }
});

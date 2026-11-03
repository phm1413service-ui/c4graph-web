// ===== グラフ生成・削除 =====
function toggleChart(index, visible) {
  const graphs = document.getElementById('graphs');

  if (visible) {
    if (charts[index]) return;

    const panel = document.createElement('div');
    panel.className = "chart-panel";
    panel.id = "panel" + index;

    const title = document.createElement('div');
    title.className = "chart-title";

    const controls = document.createElement('span');
    controls.className = "chart-controls";

    function highlightMoved(targetPanel) {
      if (!targetPanel) return;
      targetPanel.classList.add("moved");
      targetPanel.addEventListener("animationend", () => {
        targetPanel.classList.remove("moved");
      }, { once: true });
    }

    // 上下移動ボタン群
    const btnTop = document.createElement('button');
    btnTop.textContent = "⇑";
    btnTop.title = "一番上へ";
    btnTop.addEventListener('click', e => {
      e.stopPropagation();
      const p = document.getElementById("panel" + index);
      if (!p) return;
      graphs.insertBefore(p, graphs.firstChild);
      refreshAxes(); fixChartHeights();
      p.scrollIntoView({ behavior: "smooth", block: "center" });
      highlightMoved(p);
    });

    const btnUp = document.createElement('button');
    btnUp.textContent = "↑";
    btnUp.title = "一つ上へ";
    btnUp.addEventListener('click', e => {
      e.stopPropagation();
      const p = document.getElementById("panel" + index);
      if (!p) return;
      const prev = p.previousElementSibling;
      if (!prev) return;
      graphs.insertBefore(p, prev);
      refreshAxes(); fixChartHeights();
      highlightMoved(p);
    });

    const btnDown = document.createElement('button');
    btnDown.textContent = "↓";
    btnDown.title = "一つ下へ";
    btnDown.addEventListener('click', e => {
      e.stopPropagation();
      const p = document.getElementById("panel" + index);
      if (!p) return;
      const next = p.nextElementSibling;
      if (!next) return;
      graphs.insertBefore(p, next.nextSibling);
      refreshAxes(); fixChartHeights();
      highlightMoved(p);
    });

    const btnBottom = document.createElement('button');
    btnBottom.textContent = "⇓";
    btnBottom.title = "一番下へ";
    btnBottom.addEventListener('click', e => {
      e.stopPropagation();
      const p = document.getElementById("panel" + index);
      if (!p) return;
      graphs.appendChild(p);
      refreshAxes(); fixChartHeights();
      p.scrollIntoView({ behavior: "smooth", block: "center" });
      highlightMoved(p);
    });

    const btnClose = document.createElement('button');
    btnClose.textContent = "✖";
    btnClose.title = "閉じる";
    btnClose.addEventListener('click', e => {
      e.stopPropagation();
      panel.remove();
      refreshAxes(); fixChartHeights();
      const chk = document.getElementById("chk" + index);
      if (chk) {
        chk.checked = false;
        toggleChart(index, false);
        const ecuName = seriesData[index].meta.ecu;
        const parentChk = document.getElementById("parent-" + ecuName);
        if (parentChk) {
          const children = seriesData.map((s, i) => ({ ...s, index: i }))
            .filter(s => s.meta.ecu === ecuName);
          updateParentState(parentChk, children);
        }
      }
    });

    controls.appendChild(btnTop);
    controls.appendChild(btnUp);
    controls.appendChild(btnDown);
    controls.appendChild(btnBottom);
    controls.appendChild(btnClose);

    // ハンバーガーメニュー
    const handle = document.createElement('span');
    handle.textContent = "≡";
    handle.className = "drag-handle";
    handle.draggable = true;

    // ===== ドラッグ状態管理変数 =====
    let dragStartedSelected = false;
    let dragMoved = false;
    let movedIds = [];
    const scrollEl = document.getElementById('graphsContainer');
    const graphsEl = document.getElementById('graphs');

    // ===== ドラッグ開始 =====
    handle.addEventListener('dragstart', e => {
      const thisId = "panel" + index;
      const panel = document.getElementById(thisId);

      dragStartedSelected = selectedChartIndices.includes(index);
      dragMoved = false;
      movedIds = [];

      let ids;
      let useMultiple = false;

      if (dragStartedSelected) {
        ids = selectedChartIndices.map(i => "panel" + i).join(",");
        useMultiple = (selectedChartIndices.length > 1);
      } else {
        ids = thisId;
        useMultiple = false;
        selectedChartIndices = [index];
        if (panel) panel.classList.add("selected");
      }

      e.dataTransfer.setData('text/plain', ids);

      // ゴーストコンテナ
      const ghostContainer = document.createElement('div');
      ghostContainer.style.display = 'flex';
      ghostContainer.style.flexDirection = 'column';
      ghostContainer.style.opacity = '0.8';
      ghostContainer.style.position = 'absolute';
      ghostContainer.style.top = '-9999px';

      if (useMultiple) {
        selectedChartIndices.forEach(i => {
          const clone = document.getElementById("panel" + i).cloneNode(true);
          clone.style.transform = "scale(0.5)";
          clone.style.marginBottom = "2px";
          clone.style.width = panel.offsetWidth / 2 + "px";
          clone.style.height = panel.offsetHeight / 2 + "px";
          ghostContainer.appendChild(clone);
        });
      } else {
        const clone = panel.cloneNode(true);
        clone.style.width = panel.offsetWidth + "px";
        clone.style.height = panel.offsetHeight + "px";
        ghostContainer.appendChild(clone);
      }

      document.body.appendChild(ghostContainer);
      e.dataTransfer.setDragImage(ghostContainer, 10, 10);
      setTimeout(() => document.body.removeChild(ghostContainer), 0);

      document.body.classList.add("grabbing");
    });

    // ===== ドラッグ中スクロール調整 =====
    graphsEl.addEventListener('dragover', e => {
    e.preventDefault();

    // スクロール調整（既存）
    const rect = scrollEl.getBoundingClientRect();
    const margin = 120;
    const maxSpeed = 4;
    if (e.clientY < rect.top + margin) {
        const dist = rect.top + margin - e.clientY;
        const ratio = 1 - dist / margin;
        const speed = maxSpeed * Math.pow(ratio, 3);
        scrollEl.scrollTop -= Math.max(0, speed);
    } else if (e.clientY > rect.bottom - margin) {
        const dist = e.clientY - (rect.bottom - margin);
        const ratio = 1 - dist / margin;
        const speed = maxSpeed * Math.pow(ratio, 4);
        scrollEl.scrollTop += Math.max(0, speed);
    }

    // ===== インジケーターバー表示 =====
    document.querySelectorAll('.drop-target-top, .drop-target-bottom')
        .forEach(el => el.classList.remove('drop-target-top','drop-target-bottom'));

    const target = e.target.closest('.chart-panel');
    if (target) {
        const rectTarget = target.getBoundingClientRect();
        const before = (e.clientY - rectTarget.top) < rectTarget.height / 2;
        if (before) {
        target.classList.add('drop-target-top');
        } else {
        target.classList.add('drop-target-bottom');
        }
    }
    });

    // ===== ドロップ並べ替え =====
    graphsEl.addEventListener('drop', e => {
    e.preventDefault();

    // インジケータ削除
    document.querySelectorAll('.drop-target-top, .drop-target-bottom')
        .forEach(el => el.classList.remove('drop-target-top','drop-target-bottom'));

    const ids = e.dataTransfer.getData('text/plain').split(",");
    const target = e.target.closest('.chart-panel');
    if (!target) return;

    const rect = target.getBoundingClientRect();
    const before = (e.clientY - rect.top) < rect.height / 2;

    ids.forEach(id => {
        const dragged = document.getElementById(id);
        if (!dragged || dragged === target) return;
        if (before) {
        graphsEl.insertBefore(dragged, target);
        } else {
        graphsEl.insertBefore(dragged, target.nextSibling);
        }
    });

    // 移動したことを記録
    dragMoved = true;
    movedIds = ids.slice();

    setTimeout(() => {
        refreshAxes();
        fixChartHeights();
    }, 0);
    });

    // ===== ドラッグ終了 =====
    handle.addEventListener('dragend', () => {
      document.body.classList.remove("grabbing");
      const panel = document.getElementById("panel" + index);

      if (dragStartedSelected) {
        // 選択維持
      } else {
        if (dragMoved) {
          selectedChartIndices.forEach(i => {
            const p = document.getElementById("panel" + i);
            if (p) p.classList.remove("selected");
          });
          selectedChartIndices = [];
        } else {
          if (panel) {
            selectedChartIndices.forEach(i => {
              const p = document.getElementById("panel" + i);
              if (p) p.classList.remove("selected");
            });
            selectedChartIndices = [index];
            panel.classList.add("selected");
          }
        }
      }

      movedIds.forEach(id => {
        const p = document.getElementById(id);
        if (p) {
          p.classList.add("moved");
          p.addEventListener("animationend", () => {
            p.classList.remove("moved");
          }, { once: true });
        }
      });
    });

    // タイトルテキスト
    const titleText = document.createElement('span');
    titleText.textContent = seriesData[index]
      ? `${seriesData[index].meta.ecu} - ${seriesData[index].meta.label}`
      : ("Series " + index);
    title.addEventListener('click', e => {
      if (e.target.closest(".settings-icon")) return;
      selectChart(index, e);
    });

    // 設定アイコン
    const settingsIcon = document.createElement('span');
    settingsIcon.textContent = "⚙️";
    settingsIcon.className = "settings-icon";
    settingsIcon.addEventListener('click', e => {
      e.stopPropagation();
      openYAxisDialog(index);
    });

    // タイトルバー構成
    title.appendChild(handle);
    title.appendChild(titleText);
    title.appendChild(settingsIcon);
    title.appendChild(controls);

    const body = document.createElement('div');
    body.className = "chart-body";
    const canvas = document.createElement('canvas');
    canvas.id = "cv" + index;
    body.appendChild(canvas);
    panel.appendChild(title);
    panel.appendChild(body);
    graphs.appendChild(panel);

    // ===== パネルごとのドラッグインジケータ処理 =====
    panel.addEventListener('dragover', e => {
    if (selectedChartIndices.includes(index)) return;
    e.preventDefault();
    const rect = panel.getBoundingClientRect();
    const offsetY = e.clientY - rect.top;
    const half = rect.height / 2;
    panel.classList.remove('drop-target-top', 'drop-target-bottom');
    if (offsetY < half) {
        panel.classList.add('drop-target-top');
    } else {
        panel.classList.add('drop-target-bottom');
    }
    });

    panel.addEventListener('dragleave', () => {
    panel.classList.remove('drop-target-top', 'drop-target-bottom');
    });

    panel.addEventListener('drop', e => {
    panel.classList.remove('drop-target-top', 'drop-target-bottom');
    if (selectedChartIndices.includes(index)) return;

    const ids = e.dataTransfer.getData('text/plain').split(",");
    const before = (e.clientY - panel.getBoundingClientRect().top) < panel.offsetHeight / 2;

    ids.forEach(id => {
        const dragged = document.getElementById(id);
        if (!dragged || dragged === panel) return;
        if (before) {
        graphs.insertBefore(dragged, panel);
        } else {
        graphs.insertBefore(dragged, panel.nextSibling);
        }
    });

    dragMoved = true;
    movedIds = ids.slice();

    setTimeout(() => {
        refreshAxes();
        fixChartHeights();
    }, 0);
    });

    panel.scrollIntoView({ behavior: 'smooth' });

    // Chart.js 初期化準備
    const ctx = canvas.getContext('2d');
    const s = seriesData[index];
    if (!s) return;

    const unitRaw = s.meta.unit || '';
    const unitClean = unitRaw.replace(/^"+|"+$/g, '');
    const unitMap = buildUnitMap(s.meta.unit);
    const isMapping = !!unitMap;
    const color = chartColors[index % chartColors.length];

    // ===== Chart.js 初期化 =====
    const chart = new Chart(ctx, {
      type: 'line',
      data: {
        datasets: [{
          label: s.meta.label,
          data: s.x.map((xVal, i) => ({ x: xVal, y: s.y[i] })),
          borderColor: color,
          backgroundColor: color,
          fill: false,
          pointRadius: 2.5,
          showLine: true,
          spanGaps: true,
          stepped: true,
          unitMap: unitMap,
          unit: isMapping ? '' : unitClean
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            type: 'linear',
            display: false,
            grid: { drawOnChartArea: false },
            ticks: {
              callback: function (v, index, ticks) {
                if (!Number.isInteger(v)) return '';
                if (index === ticks.length - 1) return '';
                return v;
              }
            }
          },
          y: {
            type: 'linear',
            display: true,
            grid: { drawOnChartArea: true }
          }
        },
        plugins: { legend: { display: false }, tooltip: { enabled: false } }
      }
    });

    // ===== 起動時設定保存と紐付け =====
    chart.$originalYScale = JSON.parse(JSON.stringify(chart.options.scales.y));
    chart.$seriesIndex = index;
    charts[index] = chart;
    applyGlobalYAxisWidth();

    // ===== Canvas イベント =====
    canvas.addEventListener('mousemove', e => {
      const rect = canvas.getBoundingClientRect();
      const relX = e.clientX - rect.left;
      const xScale = chart.scales.x;
      const timeValue = xScale.getValueForPixel(relX);

      sharedTimeValue = timeValue;
      if (isLeftDrag)  sharedTimeValueLeft  = timeValue;
      if (isRightDrag) sharedTimeValueRight = timeValue;

      updateCrosshair(); // 最後のグラフだけ更新
    });

    canvas.addEventListener('mousedown', e => {
      const rect = canvas.getBoundingClientRect();
      const relX = e.clientX - rect.left;
      const relY = e.clientY - rect.top;

      const xScale = chart.scales.x;
      const yScale = chart.scales.y;
      const timeValue = xScale.getValueForPixel(relX);

      let snapX = timeValue;
      let snapY = null;

      const dataset = chart.data.datasets[0];
      if (dataset && dataset.data.length > 0) {
        const thresholdX = 10;
        const thresholdY = 10;
        dataset.data.forEach(d => {
          const px = xScale.getPixelForValue(d.x);
          const py = yScale.getPixelForValue(d.y);
          if (Math.abs(relX - px) < thresholdX && Math.abs(relY - py) < thresholdY) {
            snapX = d.x;
            snapY = d.y;
          }
        });
      }

      if (e.button === 0) { // 左クリック
        isLeftDrag = true;
        sharedTimeValueLeft = snapX;
      } else if (e.button === 2) { // 右クリック
        isRightDrag = true;
        sharedTimeValueRight = snapX;
      }

      if (snapY !== null) {
        const px = xScale.getPixelForValue(snapX);
        const py = yScale.getPixelForValue(snapY);
        let color = { r: 255, g: 0, b: 0 };
        if (e.button === 2) color = { r: 0, g: 0, b: 255 };
        animateSnapEffect(chart, { x: px, y: py }, color);
      }

      updateCrosshairAll();
    });

    canvas.addEventListener('mouseup', e => {
      if (e.button === 0) isLeftDrag = false;
      if (e.button === 2) isRightDrag = false;
    });

    canvas.addEventListener('contextmenu', e => e.preventDefault());
  } else {
    // ★ここが「visible=false」の処理（削除）
    const panel = document.getElementById('panel' + index);
    if (panel) panel.remove();
    if (charts[index]) { charts[index].destroy(); charts[index] = null; }

    // サイドバーを開いて「戻った」ことを明示
    const sidebar = document.getElementById('sidebar');
    if (sidebar) sidebar.classList.add('open');

    // ★選択解除処理（存在すれば削除）
    if (typeof selectedChartIndices !== 'undefined' && Array.isArray(selectedChartIndices)) {
      const pos = selectedChartIndices.indexOf(index);
      if (pos !== -1) selectedChartIndices.splice(pos, 1);
    }
    if (panel) panel.classList.remove("selected");

    const chip = document.querySelector(`#controls .chip input[data-index="${index}"]`)?.parentElement;
    if (chip) chip.classList.remove("selected");
  }

  // レイアウト調整（非同期で重複呼び出しも許容）
  setTimeout(refreshAxes, 0);
  setTimeout(() => {
    refreshAxes();
    fixChartHeights();
  }, 0);
}

// ===== 軸制御 =====
function refreshAxes(){
  const panels = document.querySelectorAll('#graphs .chart-panel');
  if (panels.length === 0) return;

  const lastPanel = panels[panels.length - 1];
  const lastIndex = parseInt(lastPanel.id.replace('panel',''), 10);
  const lastChart = charts[lastIndex];
  if (!lastChart) return;

  charts.forEach((c, i) => {
    if (!c) return;
    c.options.scales.x.display = (i === lastIndex);
    c.options.scales.x.title = { display:false };
    c.options.scales.x.afterFit = axis => {
      axis.height = (i === lastIndex) ? 30 : 0;
    };
  });

  charts.forEach(c => { if (c) c.update(); });
}

// ===== グラフ高さ調整 =====
function fixChartHeights(){
  const panels = document.querySelectorAll('#graphs .chart-panel');
  if (panels.length === 0) return;

  const graphsContainer = document.getElementById('graphsContainer');
  const minHeightRaw = Number(document.getElementById('minHeightInput').value) || 200;
  const minHeight = Math.max(minHeightRaw, 50);
  const xAxisExtra = 20;

  graphsContainer.style.overflowY = 'auto';

  panels.forEach((p, i) => {
    const isLast = i === panels.length - 1;
    p.style.height = (minHeight + (isLast ? xAxisExtra : 0)) + 'px';
  });
}

// ===== X軸範囲統一 =====
function unifyXAxisRange(){
  const visibleIndices = Array.from(document.querySelectorAll('#graphs .chart-panel'))
    .map(p => parseInt(p.id.replace('panel',''), 10))
    .filter(i => charts[i]);

  if (visibleIndices.length === 0) return;

  const allX = visibleIndices.flatMap(i => seriesData[i].x);
  const minX = Math.min(...allX);
  const maxX = Math.max(...allX);

  charts.forEach(c => {
    if (!c) return;
    c.options.scales.x.min = minX;
    c.options.scales.x.max = maxX;
    c.update();
  });

  document.getElementById('xMin').value = minX;
  document.getElementById('xMax').value = maxX;
}

// ===== クロスヘア更新 =====
function updateCrosshair() {
  const panels = document.querySelectorAll('#graphs .chart-panel');
  if (panels.length > 0) {
    const lastPanel = panels[panels.length - 1];
    const lastIndex = parseInt(lastPanel.id.replace('panel',''), 10);
    const lastChart = charts[lastIndex];
    if (lastChart) lastChart.draw();
  }
}
function updateCrosshairAll() {
  charts.forEach(c => { if (c) c.draw(); });
}

// 幅同期を要求するユーティリティ（短いディレイで二段更新）
function requestYAxisResync() {
  charts.forEach(c => { if (c) c.update(); });
  setTimeout(() => {
    charts.forEach(c => { if (c) c.update(); });
  }, 0);
}

// applyGlobalYAxisWidth は更新トリガーのみ
function applyGlobalYAxisWidth() {
  charts.forEach(c => {
    if (!c) return;
    c.update();
  });
}
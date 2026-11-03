/* ============================================
   chartFactory.js
   Chart.js の設定と createChart() だけを担当
============================================ */

window.createChart = function(index, canvas) {
  const ctx = canvas.getContext('2d');

  // Chart.js annotation プラグインを登録（v4 正式対応）
  Chart.register(window['chartjs-plugin-annotation']);

  const s = seriesData[index];
  if (!s) return null;

  /* --------------------------------------------
    C3P なら絶対時間をそのまま使う
    C4 ならトリガー基準の X 軸を作る
  -------------------------------------------- */

  const isC3P = window.__isC3P === true;
  let shiftedX;

  if (isC3P) {
    shiftedX = s.x.slice();
  } else {
    const rateRaw = window.metaInfo?.["Trigger Rate"]?.[0] || "";
    const preMatch = rateRaw.match(/pre:\s*([0-9.]+)%/);
    const prePercent = preMatch ? Number(preMatch[1]) : 50;

    const xMin = Math.min(...s.x);
    const xMax = Math.max(...s.x);
    const totalRange = xMax - xMin;

    const triggerTime = xMin + totalRange * (prePercent / 100);

    shiftedX = s.x.map(v => v - triggerTime);
  }

  const shiftedMin = Math.min(...shiftedX);
  const shiftedMax = Math.max(...shiftedX);

  /* --------------------------------------------
     Y 値処理
  -------------------------------------------- */
  function fillMissingValues(arr) {
    let last = null;
    return arr.map(v => {
      if (v === null || v === undefined || v === "") return last;
      last = v;
      return v;
    });
  }

  const filledY = fillMissingValues(s.y);
  const rawY = s.y.map(v => (v === null || v === "") ? null : v);

  const pointData = shiftedX
    .map((xVal, i) => rawY[i] == null ? null : { x: xVal, y: rawY[i] })
    .filter(p => p !== null);

  const unitRaw = s.meta.unit || '';
  const unitClean = unitRaw.replace(/^"+|"+$/g, '');
  const unitMap = buildUnitMap(s.meta.unit);
  const isMapping = !!unitMap;
  const color = chartColors[index % chartColors.length];

  /* --------------------------------------------
      Y軸スケール設定（ログ追加版）
  -------------------------------------------- */
  const yKeys = unitMap ? Array.from(unitMap.keys()) : null;

  const yScale = unitMap ? {
    title: { display: false },
    alignToPixels: true,
    suggestedMin: Math.min(...yKeys),
    suggestedMax: Math.max(...yKeys),

    ticks: {
      stepSize: 1,
      values: yKeys,
      autoSkip: false,
      callback(value) {
        const dataset = this.chart.data.datasets[0];
        const unitMap = dataset.unitMap;

        // ★ 状態名がある場合は状態名を返す
        if (unitMap.has(value)) {
          return unitMap.get(value);
        }

        // ★ 状態名がない整数は数字を表示
        if (Number.isInteger(value)) {
          return value;
        }

        // ★ 小数などは非表示（従来どおり）
        return "";
      }
    },

    afterBuildTicks(axis) {
      YAxisLogic.afterBuildTicks_unit(axis);
    },

    afterFit(axis) {
      YAxisLogic.afterFit(axis);
    }

  } : {

    title: { display: false },
    alignToPixels: true,

    ticks: {
      callback(value) {
        const dataset = this.chart.data.datasets[0];
        const values = dataset.data.map(p => p.y);
        const safeDecimals = detectSafeDecimalPlaces(values);
        return Number(value.toFixed(safeDecimals));
      }
    },

    afterFit(axis) {
      if (globalYAxisWidth > axis.width) axis.width = globalYAxisWidth;
      if (axis.width > globalYAxisWidth) globalYAxisWidth = axis.width;
    }
  };

  /* --------------------------------------------
          Chart.js インスタンス生成
  -------------------------------------------- */
  const chart = new Chart(ctx, {
    type: 'line',
    data: {
      datasets: [{
        label: s.meta.label,

        originalData: shiftedX.map((xVal, i) => ({ x: xVal, y: filledY[i] })),
        data: pointData,
        rawData: pointData,

        borderColor: color,
        backgroundColor: color,
        fill: false,

        pointRadius: window.globalMarkerEnabled ? 2.5 : 0,
        pointHoverRadius: window.globalMarkerEnabled ? 6 : 0,
        hoverRadius: window.globalMarkerEnabled ? 6 : 0,
        pointHitRadius: window.globalMarkerEnabled ? 5 : 0,
        pointBorderWidth: window.globalMarkerEnabled ? 1 : 0,
        pointStyle: window.globalMarkerEnabled ? 'circle' : false,

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
      animation: false,

      plugins: {
        legend: { display: false },
        tooltip: { enabled: false },

        annotation: {
          annotations: {
            triggerLine: {
              type: 'line',
              scaleID: 'x',
              value: 0,
              borderColor: 'orange',
              borderWidth: 1,
              label: { display: false }
            }
          }
        }
      },

      scales: {
        x: {
          type: 'linear',
          display: false,
          grid: { drawOnChartArea: false },

          min: shiftedMin,
          max: shiftedMax,

          ticks: {
            callback(v, index, ticks) {
              if (index === ticks.length - 1) return '';
              return Number.isInteger(v) ? v : '';
            }
          }
        },

        y: {
          ...yScale,
          zeroLine: true,
          ticks: {
            ...yScale.ticks,
            filter(tick) { return YAxisLogic.filterTick(this, tick); },
            callback(v, i, ticks) {
              return YAxisLogic.tickCallback(this, v, i, ticks, yScale);
            }
          }
        }
      }
    }
  });

  chart.$initialMin = chart.scales.y.min;
  chart.$initialMax = chart.scales.y.max;
  chart.$originalYScale = JSON.parse(JSON.stringify(chart.options.scales.y));
  chart.$seriesIndex = index;

  /* --------------------------------------------
      Y軸マウスオーバー（クリック不要）
  -------------------------------------------- */
  YAxisEditorEvents.attach(chart, canvas);
  attachCanvasEvents(chart, canvas);

  /* --------------------------------------------
      ★ 状態モードなら visibleYLabels を初期化
  -------------------------------------------- */
  if (unitMap) {

    const namedKeys = [...unitMap.keys()];
    const min = Math.min(...namedKeys);
    const max = Math.max(...namedKeys);

    // min〜max の全整数を作る
    const allInts = [];
    for (let v = min; v <= max; v++) {
      allInts.push(v);

      // ★ unitMap にも全整数を追加（状態名なしは数値ラベル）
      if (!unitMap.has(v)) {
        unitMap.set(v, String(v));
      }
    }

    // visibleYLabels 初期化
    chart._visibleYLabels = new Set(allInts);

    // ★★★ ここで初めて originalUnitMap を保存する（全整数が揃った後）
    chart._originalUnitMap = new Set(unitMap.keys());
    chart._originalUnitMapLabels = new Map(unitMap);
  }

  return chart;
};
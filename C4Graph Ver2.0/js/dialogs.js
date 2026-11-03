// ===== Y軸範囲適用 =====
function applyYAxisRange(minVal, maxVal) {
  const idx = Number(document.getElementById('yAxisDialog').dataset.index);
  const chart = charts[idx];
  if (!chart) return;

  const minNum = minVal ? Number(minVal) : null;
  const maxNum = maxVal ? Number(maxVal) : null;

  if (minNum !== null && maxNum !== null && minNum >= maxNum) {
    alert("Y最小はY最大より小さい値を入力してください。");
    return;
  }

  chart.options.scales.y.suggestedMin = minNum ?? undefined;
  chart.options.scales.y.suggestedMax = maxNum ?? undefined;
  chart.update();
}

// ===== ダイアログから適用 =====
function applyYAxisFromDialog() {
  const minVal = document.getElementById('dialogYMin').value;
  const maxVal = document.getElementById('dialogYMax').value;
  applyYAxisRange(minVal, maxVal);
  closeYAxisDialog();
}

// ===== ダイアログを開く =====
function openYAxisDialog(index) {
  const dialog = document.getElementById('yAxisDialog');
  dialog.style.display = 'block';
  dialog.dataset.index = index;

  const chart = charts[index];
  if (chart) {
    const yMin = chart.options.scales.y.min ?? '';
    const yMax = chart.options.scales.y.max ?? '';
    document.getElementById('dialogYMin').value = yMin;
    document.getElementById('dialogYMax').value = yMax;
  }

  const panel = document.getElementById('panel' + index);
  if (panel) panel.classList.add("configuring");
}

// ===== ダイアログを閉じる =====
function closeYAxisDialog() {
  const dialog = document.getElementById('yAxisDialog');
  dialog.style.display = 'none';

  const idx = Number(dialog.dataset.index);
  const panel = document.getElementById('panel' + idx);
  if (panel) panel.classList.remove("configuring");
}
/* ============================================
   exportFlyingGraphTxt.js
   FlyingGraph 用 TXT 出力（完全互換版）
   Encoding.js による Shift-JIS 変換対応
============================================ */

function openFlyingGraphTxtDialog() {
  if (!window.metaLines || !window.parsedData) {
    alert("データが読み込まれていません");
    return;
  }

  const overlay = document.getElementById("flyingGraphTxtDialogOverlay");
  const input = document.getElementById("flyingGraphTxtFilenameInput");
  if (!overlay || !input) {
    throw new Error("テキスト保存ダイアログが見つかりません");
  }

  input.value = getDefaultC4GFilename().replace(/\.c4g$/i, "");
  overlay.style.display = "flex";
  input.focus();
  input.select();
}

function closeFlyingGraphTxtDialog() {
  const overlay = document.getElementById("flyingGraphTxtDialogOverlay");
  if (overlay) overlay.style.display = "none";
}

async function handleFlyingGraphTxtDialogOk() {
  const input = document.getElementById("flyingGraphTxtFilenameInput");
  if (!input) return;

  let filename = input.value.trim();
  if (!filename) {
    alert("ファイル名を入力してください。");
    return;
  }

  if (!filename.toLowerCase().endsWith(".txt")) {
    filename += ".txt";
  }

  closeFlyingGraphTxtDialog();
  try {
    await exportFlyingGraphTxt(filename);
  } catch (error) {
    console.error("FlyingGraph 用テキストの保存に失敗しました", error);
    alert("テキストの保存に失敗しました。\n" + error.message);
  }
}

async function exportFlyingGraphTxt(filename = "FlyingGraph用.txt") {
  if (!window.metaLines || !window.parsedData) {
    alert("データが読み込まれていません");
    return;
  }

  const seriesList = window.parsedData.map(series => ({
    ...series,
    x: series.x.slice(),
    y: series.y.slice()
  }));
  if (seriesList.length === 0 || seriesList[0].x.length === 0) {
    alert("FlyingGraph 用に出力できるデータがありません");
    return;
  }
  const meta = window.metaInfo || {};
  const metaLines = window.metaLines.map(row => row.slice());

  let output = "";
  let currentLine = 1;

  /* --------------------------------------------
     ★ TimeStamp を取得
  -------------------------------------------- */
  let x = seriesList[0].x.slice();
  const xMin = Math.min(...x);
  const xMax = Math.max(...x);

  /* --------------------------------------------
     ★ Trigger Rate によるシフト
  -------------------------------------------- */
  const rateRaw = meta["Trigger Rate"] ? meta["Trigger Rate"][0] : "";
  const preMatch = rateRaw.match(/pre:\s*([0-9.]+)%/);
  const prePercent = preMatch ? Number(preMatch[1]) : 50;

  const totalRange = xMax - xMin;
  const triggerTime = xMin + totalRange * (prePercent / 100);

  let shiftedX = x.map(v => v - triggerTime);

  /* --------------------------------------------
     ★ shiftedX に 0 が無い場合は 0 秒行を追加
  -------------------------------------------- */

  let hasZero = shiftedX.includes(0);

  if (!hasZero) {
    let insertIndex = -1;

    for (let i = 1; i < shiftedX.length; i++) {
      if (shiftedX[i - 1] < 0 && shiftedX[i] > 0) {
        insertIndex = i;
        break;
      }
    }

    if (insertIndex !== -1) {
      shiftedX.splice(insertIndex, 0, 0);
      x.splice(insertIndex, 0, x[insertIndex - 1]);

      seriesList.forEach(s => {
        const prev = s.y[insertIndex - 1];
        s.y.splice(insertIndex, 0, prev);
      });
    }
  }

  /* --------------------------------------------
     ★ Sampling Rate を TimeStamp と行数から自動計算
     - SamplingRate = 実時間 / (行数 - 1)
     - 四捨五入しない（生の計算値）
  -------------------------------------------- */

  const newRowCount = x.length;
  const durationSec = xMax - xMin;

  let samplingMs = (durationSec / (newRowCount - 1)) * 1000;

  if (metaLines[2]) {
    const originalSamplingRate = metaLines[2][1];
    metaLines[2][1] = samplingMs + "ms";     // B列：生値そのまま
    metaLines[2][2] = originalSamplingRate;  // C列：元の値（msは付けない）
  }

  /* --------------------------------------------
     ① 第1テーブル（元CSVの行をそのまま出力）
  -------------------------------------------- */
  metaLines.forEach(row => {
    output += row.join("\t") + "\n";
    currentLine++;
  });

  /* --------------------------------------------
     ② Text Label EN（25行目）
  -------------------------------------------- */
  while (currentLine < 25) {
    output += "\n";
    currentLine++;
  }

  output += "Text Label EN";
  for (const s of seriesList) {
    output += "\t" + s.meta.label;
  }
  output += "\t\n";
  currentLine++;

  /* --------------------------------------------
     ③ Unit（26行目）
  -------------------------------------------- */
  output += "Unit";
  for (const s of seriesList) {
    const unit = (s.meta.unit || "").replace(/^"+|"+$/g, "");
    output += "\t" + unit;
  }
  output += "\t\n";
  currentLine++;

  /* --------------------------------------------
     ④ データ行（27行目〜）
  -------------------------------------------- */

  let lastValues = new Array(seriesList.length).fill(null);

  for (let i = 0; i < shiftedX.length; i++) {
    let row = shiftedX[i];

    seriesList.forEach((s, idx) => {
      let v = s.y[i];

      if (v == null || v === "") {
        v = lastValues[idx];
      } else {
        lastValues[idx] = v;
      }

      row += "\t" + (v == null ? "" : v);
    });

    output += row + "\t\n";
  }

  /* --------------------------------------------
     ⑤ Shift-JIS で保存（NULL 除去）
  -------------------------------------------- */
  let sjisArray = Encoding.convert(output, {
    to: "SJIS",
    from: "UNICODE",
    type: "array"
  });

  // ★ NULL（0x00）を除去 → 末尾欠け問題の完全対策
  sjisArray = sjisArray.filter(byte => byte !== 0x00);

  const blob = new Blob([new Uint8Array(sjisArray)], { type: "text/plain" });
  await downloadBlob(blob, filename);
}

document.addEventListener("DOMContentLoaded", () => {
  const cancelButton = document.getElementById("flyingGraphTxtDialogCancelBtn");
  const okButton = document.getElementById("flyingGraphTxtDialogOkBtn");
  const input = document.getElementById("flyingGraphTxtFilenameInput");

  if (cancelButton) {
    cancelButton.addEventListener("click", closeFlyingGraphTxtDialog);
  }

  if (okButton) {
    okButton.addEventListener("click", handleFlyingGraphTxtDialogOk);
  }

  if (input) {
    input.addEventListener("keydown", event => {
      if (event.key === "Enter") {
        event.preventDefault();
        handleFlyingGraphTxtDialogOk();
      } else if (event.key === "Escape") {
        event.preventDefault();
        closeFlyingGraphTxtDialog();
      }
    });
  }
});
/* ============================================
   utils.js
============================================ */

// ===== 検索用ユーティリティ =====
function normalizeText(str) {
  if (!str) return "";
  let s = str.normalize("NFKC"); // 全角→半角
  s = s.replace(/[ぁ-ん]/g, ch => String.fromCharCode(ch.charCodeAt(0) + 0x60)); // ひらがな→カタカナ
  return s.toLowerCase(); // 大文字小文字統一
}

function highlightMatch(text, query) {
  const normText = normalizeText(text);
  const normQuery = normalizeText(query);

  const idx = normText.indexOf(normQuery);
  if (idx < 0) return text;

  const start = idx;
  const end = idx + query.length;
  return (
    text.slice(0, start) +
    `<span class="highlight">` +
    text.slice(start, end) +
    `</span>` +
    text.slice(end)
  );
}

// ===== CSV処理 =====
function parseCSV(text) {
  const result = Papa.parse(text, {
    skipEmptyLines: true
  });
  return result.data;
}

// Saved Date の B列を抽出
function extractSavedDate(rows) {
  for (const row of rows) {
    if (row[0] && row[0].trim() === "Saved Date") {
      return row[1] ? row[1].trim() : "";
    }
  }
  return "";
}

// Vehicle ID の B列を抽出
function extractVehicleID(rows) {
  for (const row of rows) {
    if (row[0] && row[0].trim() === "Vehicle ID") {
      return row[1] ? row[1].trim() : "";
    }
  }
  return "";
}

// Description の B列を抽出
function extractDescription(rows) {
  for (const row of rows) {
    if (row[0] && row[0].trim() === "Description") {
      return row[1] ? row[1].trim() : "";
    }
  }
  return "";
}

function extractThirdTableRows(rows) {
  const ecuIndices = [];
  rows.forEach((r, i) => {
    if (r[0] && r[0].includes("ECU Name")) ecuIndices.push(i);
  });
  if (ecuIndices.length === 0) throw new Error("ECU Name 行が見つかりません");

  const start = ecuIndices.length >= 2 ? ecuIndices[1] : ecuIndices[0];
  const headerEcu = rows[start];

  let textLabelRow, unitRow;
  for (let i = start + 1; i < start + 20 && i < rows.length; i++) {
    if (rows[i][0] && rows[i][0].includes("Text Label EN")) textLabelRow = rows[i];
    if (rows[i][0] && rows[i][0].includes("Unit")) unitRow = rows[i];
  }
  if (!textLabelRow || !unitRow)
    throw new Error("Text Label EN または Unit 行が見つかりません");

  const dataStart = rows.indexOf(unitRow) + 1;
  const dataRows = rows.slice(dataStart);
  return { headerEcu, textLabelRow, unitRow, dataRows };
}

function buildSeriesMeta(headerEcu, textLabelRow, unitRow) {
  const series = [];
  for (let c = 1; c < textLabelRow.length; c++) {
    if (textLabelRow[c]) {
      const cleanLabel = textLabelRow[c].replace(/^"+|"+$/g, "");
      const cleanEcu = (headerEcu[c] || "").replace(/^"+|"+$/g, "");
      series.push({ col: c, label: cleanLabel, unit: unitRow[c], ecu: cleanEcu });
    }
  }
  return series;
}

function toNumberOrNull(s) {
  if (!s) return null;
  const n = Number(s);
  return isNaN(n) ? null : n;
}

function prepareSeriesData(seriesMeta, dataRows) {
  const dataRowsWithTs = dataRows.filter(r => toNumberOrNull(r[0]) != null);

  if (dataRowsWithTs.length === 0) {
    console.warn("★ dataRowsWithTs が空です（タイムスタンプ列が全て null）");
    return [];
  }

  const firstTsRaw = toNumberOrNull(dataRowsWithTs[0][0]);
  if (firstTsRaw == null) {
    console.warn("★ firstTsRaw が null → 時間軸を構成できない");
    return [];
  }

  const isC3P = window.__isC3P === true;
  window.__isC3P = isC3P;

  let xSeconds;

  if (isC3P) {
    xSeconds = dataRowsWithTs.map(r => toNumberOrNull(r[0]));
  } else {
    const t0 = firstTsRaw / 1e6;
    xSeconds = dataRowsWithTs.map(r => toNumberOrNull(r[0]) / 1e6 - t0);
  }

  if (!xSeconds || !Array.isArray(xSeconds)) {
    throw new Error("xSeconds が未定義または配列ではありません");
  }

  const result = seriesMeta.map(s => {
    const y = dataRowsWithTs.map(r => toNumberOrNull(r[s.col]));
    return { meta: s, x: xSeconds, y };
  });

  return result;
}

function buildUnitMap(unitDefRaw) {
  if (!unitDefRaw) return null;

  const cleaned = unitDefRaw.replace(/^"+|"+$/g, "");
  const map = new Map();

  cleaned.split("/").forEach(pair => {
    const idx = pair.indexOf(":");
    if (idx === -1) return;

    const key = pair.slice(0, idx).trim();
    const val = pair.slice(idx + 1).trim();

    const numKey = Number(key);
    if (!Number.isNaN(numKey)) {
      map.set(numKey, val.replace(/^"+|"+$/g, ""));
    }
  });

  return map.size > 0 ? map : null;
}

// ===== Blob をダウンロードするユーティリティ =====
async function downloadBlob(blob, filename) {
  // File System Access API が利用可能な場合は保存ダイアログを表示
  if (window.showSaveFilePicker) {
    try {
      const extension = filename.split('.').pop().toLowerCase();
      const mimeTypes = {
        'png': 'image/png',
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'gif': 'image/gif',
        'txt': 'text/plain',
        'csv': 'text/csv',
        'html': 'text/html',
        'c4g': 'application/zip',
        'json': 'application/json'
      };
      const handle = await window.showSaveFilePicker({
        suggestedName: filename,
        types: [{
          description: 'ファイル',
          accept: { [mimeTypes[extension] || 'application/octet-stream']: ['.' + extension] }
        }]
      });

      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return;
    } catch (err) {
      // ユーザーがキャンセルした場合は何もしない
      if (err.name === 'AbortError') {
        return;
      }
      console.warn('File System Access API で保存できませんでした。従来の方法で保存します。', err);
    }
  }

  // 従来の方法（フォールバック）
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ===== テキストをダウンロードするユーティリティ =====
async function downloadTextFile(text, filename) {
  const blob = new Blob([text], { type: "text/plain" });
  await downloadBlob(blob, filename);
}
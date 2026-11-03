/* ============================================
   c3pParser.js
   Consult III Plus（C3P）テキスト → CSV変換 → C4Graphへ合流
============================================ */

async function handleC3PFile(text, fileName = "") {
  try {
    window.__isC3P = true;

    const csvString = convertC3PToCSV(text);

    const c3pMeta = { ...window.metaInfo };

    window.markerEnabledByMode = {
      ...window.markerEnabledByMode,
      normal: false,
      overlay: false
    };
    window.globalMarkerEnabled = false;

    const loaded = await handleCSVFile(csvString);
    if (!loaded) return false;

    window.metaInfo = { ...window.metaInfo, ...c3pMeta };
    if (window.refreshDisplayFeatures) window.refreshDisplayFeatures();
    if (!window.originalDescription && fileName) {
      window.originalDescription = fileName.replace(/\.[^.]+$/, "");
    }

    const key = getStateStorageKey();
    const savedState = localStorage.getItem(key);

    if (savedState) {
      const ok = confirm("前回の状態を復元しますか？");
      if (ok) loadStateFromLocalStorage();
    }

    if (window.updateExportTxtButton) {
      window.updateExportTxtButton();
    }

    return true;
  } catch (err) {
    alert("C3P テキスト処理中にエラー: " + err.message);
    return false;
  }
}


/**
 * C3P テキスト → CSV 変換（TAB専用・空欄セル完全対応）
 */
function convertC3PToCSV(text) {

  const lines = text.split(/\r?\n/);

  // ★ C3P は必ずタブ区切り
  const delimiter = "\t";
  const parseRow = line => line.split(delimiter).map(cell => cell.trim());
  const toCSVRow = row => row.map(cell => {
    const value = String(cell ?? "");
    return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
  }).join(",");

  // ---- メタ情報抽出 ----
  window.metaInfo = window.metaInfo || {};

  const c3pMetaKeys = [
    "データ保存日時",
    "記録時間",
    "記録速度",
    "トリガ比率",
    "車名",
    "車系",
    "年式",
    "車台番号",
    "トリガタイプ"
  ];

  for (let i = 0; i < lines.length; i++) {
    const cols = parseRow(lines[i]);
    const key = cols[0];
    const val = cols[1];

    if (!key) continue;
    if (key.replace(/\s/g, "") === "システム") break;

    if (c3pMetaKeys.includes(key) && val) {
      window.metaInfo[key] = [val];
    }
  }

  // ---- システム行検出 ----
  const systemLines = [];
  for (let i = 0; i < lines.length; i++) {
    const cols = parseRow(lines[i]);
    const head = (cols[0] || "").replace(/\s/g, "");
    if (head === "システム") {
      systemLines.push({ index: i, cols });
    }
  }

  if (systemLines.length === 0) {
    throw new Error("C3P形式の解析に失敗しました（システム行が見つかりません）");
  }

  const last = systemLines[systemLines.length - 1];

  const headerSystem = last.cols;
  const headerLabel = lines[last.index + 1] === undefined
    ? null
    : parseRow(lines[last.index + 1]);

  // ★★★ 単位行は TAB の連続で空欄セルが存在するため、必ず列数補正する
  const rawUnitLine = lines[last.index + 2] === undefined
    ? null
    : parseRow(lines[last.index + 2]);

  if (!headerLabel || !rawUnitLine) {
    throw new Error("C3P形式の解析に失敗しました（項目名・単位行が見つかりません）");
  }

  const expectedCols = headerLabel.length;
  // Read by index so empty cells retain their position instead of shifting later units left.
  const unitLine = Array.from(
    { length: expectedCols },
    (_, index) => rawUnitLine[index] ?? ""
  );

  const dataStart = last.index + 3;

  // ---- CSV 行生成 ----
  const csvRows = [];
  csvRows.push(toCSVRow(headerSystem));
  csvRows.push(toCSVRow(headerLabel));
  csvRows.push(toCSVRow(unitLine));

  // ---- データ行 ----
  for (let i = dataStart; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const cols = parseRow(lines[i]);
    if (cols.length > expectedCols) continue;
    while (cols.length < expectedCols) cols.push("");
    csvRows.push(toCSVRow(cols));
  }

  // ---- C4互換ラベル ----
  csvRows[0] = csvRows[0].replace(/^システム/, "ECU Name");
  csvRows[1] = csvRows[1].replace(/^モニタ項目/, "Text Label EN");
  csvRows[2] = csvRows[2].replace(/^単位/, "Unit");

  return csvRows.join("\n");
}

/* ============================================
   c3pParser.js
   Consult III Plus（C3P）テキスト → CSV変換 → C4Graphへ合流
============================================ */

/**
 * C3P テキストを読み込み、CSV形式に変換して既存の CSV パイプラインへ流す
 */
function handleC3PFile(text) {
  try {
    // ★ C3P は初回ロード時にマーカー OFF
    window.globalMarkerEnabled = false;

    // ★ C3P モードフラグ ON
    window.__isC3P = true;

    const csvString = convertC3PToCSV(text);  // C3P → CSV

    // C3P メタ情報を退避
    const c3pMeta = { ...window.metaInfo };

    // 既存 CSV パイプラインへ
    handleCSVFile(csvString);

    // CSV 側で上書きされた metaInfo に C3P メタをマージ
    window.metaInfo = { ...window.metaInfo, ...c3pMeta };

    // ★ C3P 用キーで復元チェック
    const key = getStateStorageKey();
    const savedState = localStorage.getItem(key);

    if (savedState) {
      const ok = confirm("前回の状態を復元しますか？");
      if (ok) {
        loadStateFromLocalStorage();
      }
    }

    // ★★★ ここに追加する ★★★
    if (window.updateExportTxtButton) {
      window.updateExportTxtButton();
    }

  } catch (err) {
    alert("C3P テキスト処理中にエラー: " + err.message);
  } finally {
  }
}


/**
 * C3P テキスト → CSV 変換
 */
function convertC3PToCSV(text) {

  const lines = text.split(/\r?\n/);

  // ---- 区切り文字推定 ----
  function detectDelimiter(line) {
    const candidates = ["\t", ",", ";", " "];
    let best = { delimiter: "\t", count: 1 };

    for (const d of candidates) {
      const parts = line.split(d);
      if (parts.length > best.count) {
        best = { delimiter: d, count: parts.length };
      }
    }
    return best.delimiter;
  }

  const firstSystemLine = lines.find(l => l.replace(/\s/g, "") === "システム");
  if (!firstSystemLine) {
    throw new Error("C3P形式の解析に失敗しました（システム行が見つかりません）");
  }

  const delimiter = detectDelimiter(firstSystemLine);

  // ============================================================
  // ★★★ C3P メタ情報抽出（システム行に到達するまで）★★★
  // ============================================================
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
    const cols = lines[i].split(delimiter).map(s => s.trim());
    const key = cols[0];
    const val = cols[1];

    if (!key) continue;

    // システム行に到達したらメタ情報領域終了
    if (key.replace(/\s/g, "") === "システム") break;

    if (c3pMetaKeys.includes(key) && val) {
      window.metaInfo[key] = [val];
    }
  }

  // ---- システム行をすべて検出 ----
  const systemLines = [];

  for (let i = 0; i < lines.length; i++) {
    const cols = lines[i].split(delimiter).map(s => s.trim());
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
  const headerLabel = lines[last.index + 1]?.split(delimiter).map(s => s.trim());
  const unitLine = lines[last.index + 2]?.split(delimiter).map(s => s.trim());
  const dataStart = last.index + 3;

  if (!headerLabel || !unitLine) {
    throw new Error("C3P形式の解析に失敗しました（項目名・単位行が見つかりません）");
  }

  const csvRows = [];
  csvRows.push(headerSystem.join(","));
  csvRows.push(headerLabel.join(","));
  csvRows.push(unitLine.join(","));

  const expectedCols = headerLabel.length;

  for (let i = dataStart; i < lines.length; i++) {
    const cols = lines[i].split(delimiter).map(s => s.trim());
    if (cols.length !== expectedCols) continue;
    csvRows.push(cols.join(","));
  }

  // ---- C4互換ラベルに変換 ----
  csvRows[0] = csvRows[0].replace(/^システム/, "ECU Name");
  csvRows[1] = csvRows[1].replace(/^モニタ項目/, "Text Label EN");
  csvRows[2] = csvRows[2].replace(/^単位/, "Unit");

  return csvRows.join("\n");
}
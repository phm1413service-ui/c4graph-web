/* ============================================
   c4gManager.js
============================================ */

// ===============================
//  デフォルトファイル名生成
// ===============================
function getDefaultC4GFilename() {
  const vid = window.originalVehicleID || "";
  const desc = window.originalDescription || "";

  if (vid && desc) return `${vid}_${desc}.c4g`;
  if (vid) return `${vid}.c4g`;
  if (desc) return `${desc}.c4g`;
  return "project.c4g";
}

// ★ 他ファイルから使えるように公開
window.getDefaultC4GFilename = getDefaultC4GFilename;

// ===============================
//  C4G 保存（ダイアログ起動用）
// ===============================
function exportC4G() {
  openSaveDialog();
}

// ===============================
//  C4G 保存（ファイル名指定版）
// ===============================
async function exportC4GWithFilename(filename) {
  try {
    if (!window.originalCSVText) {
      alert("元の CSV データが存在しません。CSV を読み込んでから保存してください。");
      return;
    }

    if (!filename.toLowerCase().endsWith(".c4g")) {
      filename += ".c4g";
    }

    const vid = window.originalVehicleID || "";
    const desc = window.originalDescription || "";

    const stateJson = exportStateToJSON();

    const metaObj = {
      c4g_version: 1,
      saved_at: new Date().toISOString(),
      vehicle_id: vid,
      description: desc
    };
    const metaJson = JSON.stringify(metaObj, null, 2);

    const blob = await buildC4GZip(
      window.originalCSVText,
      stateJson,
      metaJson
    );

    await downloadBlob(blob, filename);

    console.log("C4G 保存完了:", filename);

  } catch (e) {
    console.error("exportC4GWithFilename: 保存失敗", e);
    alert("C4G の保存に失敗しました。\n" + e.message);
  }
}

// ★ 他ファイルから使えるように公開
window.exportC4GWithFilename = exportC4GWithFilename;

// ===============================
//  C4G ZIP 生成（buildC4GZip）
// ===============================
async function buildC4GZip(csvText, stateJson, metaJson) {
  const zip = new JSZip();

  // --- data.csv ---
  zip.file("data.csv", csvText, {
    compression: "DEFLATE",
    compressionOptions: { level: 6 }
  });

  // --- state.json ---
  zip.file("state.json", stateJson, {
    compression: "DEFLATE",
    compressionOptions: { level: 6 }
  });

  // --- meta.json ---
  zip.file("meta.json", metaJson, {
    compression: "DEFLATE",
    compressionOptions: { level: 6 }
  });

  // ZIP を Blob として生成
  const blob = await zip.generateAsync({
    type: "blob",
    compression: "DEFLATE",
    compressionOptions: { level: 6 }
  });

  return blob;
}

// ===============================
//  C4G ZIP 展開（unzipC4G）
// ===============================
async function unzipC4G(file) {
  const zip = await JSZip.loadAsync(file);

  // 必須ファイルの存在チェック
  if (!zip.file("data.csv") || !zip.file("state.json") || !zip.file("meta.json")) {
    throw new Error("C4G ファイルが不完全です（必要なファイルがありません）");
  }

  // 各ファイルを読み込み
  const csvText  = await zip.file("data.csv").async("string");
  const stateJson = await zip.file("state.json").async("string");
  const metaJson  = await zip.file("meta.json").async("string");

  // JSON をパース
  let stateObj, metaObj;
  try {
    stateObj = JSON.parse(stateJson);
    metaObj  = JSON.parse(metaJson);
  } catch (e) {
    throw new Error("C4G 内の JSON が壊れています");
  }

  return { csvText, stateObj, metaObj };
}

// ===============================
//  C4G 読み込み（importC4G）
// ===============================
async function importC4G(file) {
  let loaded = false;
  await runWithLoading(async (updateProgress) => {
    try {
      updateProgress(5);

      // 1. ZIP 展開
      const { csvText, stateObj, metaObj } = await unzipC4G(file);
      updateProgress(15);

      // 2. meta.json チェック
      window.__isC3P = !!stateObj.isC3P;
      window.originalCSVText = csvText;

      // 3. CSV パース
      const rows = parseCSV(csvText);
      updateProgress(25);
      await new Promise(r => setTimeout(r));

      // 4. メタ情報復元
      window.metaInfo = extractMetaInfo(rows);
      window.originalVehicleID = extractVehicleID(rows);
      window.originalDescription = metaObj.filename || extractDescription(rows);
      if (window.renderVehicleInfo) window.renderVehicleInfo();

      // 5. SeriesMeta 構築
      const { headerEcu, textLabelRow, unitRow, dataRows } = extractThirdTableRows(rows);
      const seriesMeta = buildSeriesMeta(headerEcu, textLabelRow, unitRow);
      updateProgress(40);
      await new Promise(r => setTimeout(r));

      // 6. データ構築
      const preparedSeriesData = prepareSeriesData(seriesMeta, dataRows);
      if (window.clearGraphsForDataLoad) window.clearGraphsForDataLoad();
      seriesData = preparedSeriesData;
      document.getElementById("sidebarCompanyLogo").hidden = false;
      updateProgress(55);
      await new Promise(r => setTimeout(r));

      // 7. UI 再生成
      renderControls(seriesMeta);
      document.getElementById('main').classList.add('loaded');
      if (window.refreshDisplayFeatures) window.refreshDisplayFeatures();
      updateProgress(70);
      await new Promise(r => setTimeout(r));

      // 8. 状態復元
      await applyStateFromObject(stateObj, updateProgress);
      updateProgress(85);
      await new Promise(r => setTimeout(r));

      // 9. 軸・高さ調整
      refreshAxes();
      fixChartHeights();
      updateProgress(100);
      loaded = true;

    } catch (e) {
      console.error("importC4G: 読み込み失敗", e);
      alert("C4G の読み込みに失敗しました。\n" + e.message);
    }
  }, true);
  return loaded;
}
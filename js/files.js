// ============================================
// files.js
// ============================================

// ===== CSV処理メイン =====
async function handleCSVFile(text) {
  try {
    window.originalCSVText = text;

    const rows = parseCSV(text);

    // CSV から Vehicle ID / Description を抽出して保存
    window.originalVehicleID = extractVehicleID(rows);
    window.originalDescription = extractDescription(rows);

    // メタ情報抽出（※C3P の場合は後でマージされる）
    window.metaInfo = extractMetaInfo(rows);
    if (window.renderVehicleInfo) window.renderVehicleInfo();

    // ★ 第1テーブルの行をそのまま保存（FlyingGraph用）
    let metaEndIndex = 0;
    for (let i = 0; i < rows.length; i++) {
      if (String(rows[i][0]).trim() === "Text Label EN") {
        metaEndIndex = i;
        break;
      }
    }
    window.metaLines = rows.slice(0, metaEndIndex);

    const { headerEcu, textLabelRow, unitRow, dataRows } = extractThirdTableRows(rows);

    const seriesMeta = buildSeriesMeta(headerEcu, textLabelRow, unitRow);
    const preparedSeriesData = prepareSeriesData(seriesMeta, dataRows);
    if (window.clearGraphsForDataLoad) window.clearGraphsForDataLoad();
    seriesData = preparedSeriesData;

    // ★★★ ここで parsedData をセットする必要がある ★★★
    window.parsedData = seriesData;
    document.getElementById("sidebarCompanyLogo").hidden = false;
    const { globalXMin, globalXMax } = computeGlobalXRange();
    initXRangeSlider(globalXMin, globalXMax, window.userMinX, window.userMaxX);
    document.getElementById("xRangeSlider").style.display = "block";

    renderControls(seriesMeta);
    document.getElementById('main').classList.add('loaded');
    if (window.refreshDisplayFeatures) window.refreshDisplayFeatures();

    // ★ マーカー UI を現在の状態に同期
    const markerToggle = document.getElementById("toggleMarkers");
    if (markerToggle) {
      markerToggle.checked = window.globalMarkerEnabled;
    }

    const sidebar = document.getElementById('sidebar');
    if (sidebar) sidebar.classList.add('open');

    if (window.updateExportTxtButton) {
      window.updateExportTxtButton();
    }

    // ★ C3P の場合はここでは復元チェックしない
    if (!window.__isC3P) {
      const key = getStateStorageKey();
      const savedState = localStorage.getItem(key);

      if (savedState) {
        const ok = confirm("前回の状態を復元しますか？");
        if (ok) {
          loadStateFromLocalStorage();
        }
      }
    }

    setTimeout(() => {
      refreshAxes();
      fixChartHeights();
    }, 0);

    return true;
  } catch (err) {
    alert("CSV 処理中にエラーが発生しました: " + err.message);
    return false;
  }
}


// ===== メタ情報抽出（ECU Name 2回目まで） =====
function extractMetaInfo(rows) {
  const meta = {};
  let ecuNameCount = 0;

  for (const row of rows) {
    if (!row || row.length === 0) continue;

    const key = String(row[0]).trim();
    if (!key) continue;

    // ECU Name の出現回数で境界判定
    if (key === "ECU Name") {
      ecuNameCount++;
      if (ecuNameCount === 2) break;
    }

    // B列以降の値を抽出
    const values = row.slice(1)
      .map(v => String(v).trim())
      .filter(v => v !== "");

    meta[key] = values;
  }

  return meta;
}


async function readShiftJisFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error("TXTファイルを読み込めませんでした。"));
    reader.readAsText(file, "shift-jis");
  });
}

async function loadSupportedFile(file, remember = true) {
  const name = file.name.toLowerCase();
  let loaded = false;

  try {
    if (name.endsWith(".c4g")) {
      loaded = await importC4G(file);
    } else if (name.endsWith(".csv")) {
      const previousC3PState = window.__isC3P;
      window.__isC3P = false;
      loaded = await handleCSVFile(await file.text());
      if (!loaded) window.__isC3P = previousC3PState;
    } else if (name.endsWith(".txt")) {
      loaded = await handleC3PFile(await readShiftJisFile(file), file.name);
    } else {
      alert("対応していないファイル形式です (.csv / .txt / .c4g を選択してください)");
      return false;
    }

    if (loaded && remember) {
      try {
        await saveRecentFile(file);
        await renderRecentFiles();
      } catch (error) {
        console.error("最近使ったデータを保存できませんでした。", error);
        alert("データは読み込みましたが、最近使った一覧への保存に失敗しました。\n" + error.message);
      }
    }
    return loaded;
  } catch (error) {
    console.error("データファイルを読み込めませんでした。", error);
    alert("データファイルを読み込めませんでした。\n" + error.message);
    return false;
  }
}

// ===== ファイル選択イベント (.csv / .c4g / .txt 対応) =====
document.getElementById('fileInput').addEventListener('change', async e => {
  const file = e.target.files[0];
  if (file) await loadSupportedFile(file);
  e.target.value = "";
});

// ===== ドロップイベント (.csv / .c4g / .txt 対応) =====
document.getElementById('dropzone').addEventListener('drop', async e => {
  e.preventDefault();
  const file = e.dataTransfer.files[0];
  if (file) await loadSupportedFile(file);
});

document.getElementById('dropzone').addEventListener('dragover', e => e.preventDefault());
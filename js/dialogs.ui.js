/* ============================================
   dialogs.ui.js
   UI 専用モジュール（DOM 操作のみ）
============================================ */

window.DialogsUI = {

  /* --------------------------------------------
     数値入力欄の補助処理
  -------------------------------------------- */
  prepareNumberInput(input) {
    input.addEventListener("focus", () => {
      if (input.value === "") input.value = input.placeholder;
      input.select();
    });

    input.addEventListener("click", () => {
      if (input.value === "") input.value = input.placeholder;
      input.select();
    });
  },


  /* --------------------------------------------
     数値系：データの粒度に合わせて step を決める
  -------------------------------------------- */
  detectSafeStep(values) {
    if (!values || values.length < 2) return 1;

    const diffs = [];
    for (let i = 1; i < values.length; i++) {
      const d = Math.abs(values[i] - values[i - 1]);
      if (d > 0 && isFinite(d)) diffs.push(d);
    }
    if (diffs.length === 0) return 1;

    let minDiff = Math.min(...diffs);
    const decimals = Math.min((minDiff.toString().split(".")[1] || "").length, 6);
    return Number(minDiff.toFixed(decimals)) || 1;
  },


  /* --------------------------------------------
     placeholder の設定
  -------------------------------------------- */
  setPlaceholders(min, max) {
    document.getElementById("dialogYMin").placeholder = min;
    document.getElementById("dialogYMax").placeholder = max;
  },


  /* --------------------------------------------
     状態一覧の現在値ハイライト
  -------------------------------------------- */
  highlightStateRows(currentMin, currentMax) {
    const rows = document.querySelectorAll("#yUnitTable tr");

    rows.forEach(row => {
      row.classList.remove("y-unit-row-current");

      const key = Number(row.querySelector(".y-unit-key").textContent);
      if (key === Number(currentMin) || key === Number(currentMax)) {
        row.classList.add("y-unit-row-current");
      }
    });
  },


  /* --------------------------------------------
     状態一覧の選択可能/不可を切り替え
  -------------------------------------------- */
  updateUnitTableInteractivity() {
    const rows = document.querySelectorAll("#yUnitTable tr");
    const focused = window.DialogsState.getFocusedField();

    rows.forEach(row => {
      if (focused === "min" || focused === "max") {
        row.style.cursor = "pointer";
        row.classList.add("y-unit-hover-enabled");
      } else {
        row.style.cursor = "default";
        row.classList.remove("y-unit-hover-enabled");
      }
    });
  },


  /* --------------------------------------------
     状態名（🛈）の表示
  -------------------------------------------- */
  updateStateLabels(minLabel, maxLabel) {
    document.getElementById("yMinState").textContent = minLabel;
    document.getElementById("yMaxState").textContent = maxLabel;
  },

  /* --------------------------------------------
        状態一覧の描画（整数も ON/OFF 可能・範囲は visibleYLabels 基準）
  -------------------------------------------- */
  renderUnitTable(unitMap) {
    const table = document.getElementById("yUnitTable");
    table.innerHTML = ""; // 既存クリア

    if (!unitMap || typeof unitMap.forEach !== "function") return;

    // ★ thead を作成
    const thead = document.createElement("thead");
    const headRow = document.createElement("tr");

    const thCheck = document.createElement("th");
    thCheck.style.width = "32px";

    const thKey = document.createElement("th");
    thKey.classList.add("y-unit-key");
    thKey.textContent = "値";

    const thLabel = document.createElement("th");
    thLabel.classList.add("y-unit-label");
    thLabel.textContent = "状態名";

    headRow.appendChild(thCheck);
    headRow.appendChild(thKey);
    headRow.appendChild(thLabel);
    thead.appendChild(headRow);

    // ★ tbody を作成
    const tbody = document.createElement("tbody");

    // ★ チャート取得
    const chartIndex = Number(document.getElementById("yAxisDialog").dataset.index);
    const chart = window.charts[chartIndex];

    // ★ 現在の可視ラベルセット（チェック状態の判定用）
    const visible = chart._visibleYLabels || new Set();

    // ★ 状態一覧の範囲は unitMap の min/max（←ここを基準にする）
    const unitKeys = [...unitMap.keys()];
    const minKey = Math.min(...unitKeys);
    const maxKey = Math.max(...unitKeys);

    // ★ ダイアログに表示するキーは minKey〜maxKey の全整数
    const keys = [];
    for (let v = maxKey; v >= minKey; v--) {
      keys.push(v);
    }

    // ★ 行生成
    for (const key of keys) {
      const label = unitMap.get(key);

      const row = document.createElement("tr");
      row.classList.add("y-unit-row");
      row.dataset.yValue = key;

      // 状態名の有無（ラベル表示用）
      const isNamed = (label !== String(key) && label !== "" && label != null);

      // ① チェックボックス列
      const checkCell = document.createElement("td");

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.classList.add("y-unit-visible-toggle");

      // ★ 初期状態：visibleYLabels に入っていれば ON
      checkbox.checked = chart._visibleYLabels.has(key);

      // ★ 状態名の有無に関係なく ON/OFF 可能
      checkbox.addEventListener("change", () => {
        if (checkbox.checked) {
          chart._visibleYLabels.add(key);
        } else {
          chart._visibleYLabels.delete(key);
        }
        chart.update();
      });

      checkCell.appendChild(checkbox);

      // ② 値
      const keyCell = document.createElement("td");
      keyCell.classList.add("y-unit-key");
      keyCell.textContent = key;

      // ③ 状態名
      const labelCell = document.createElement("td");
      labelCell.classList.add("y-unit-label");

      labelCell.textContent =
        (label == null || label === "" || label === String(key))
          ? "（状態名なし）"
          : label;

      row.appendChild(checkCell);
      row.appendChild(keyCell);
      row.appendChild(labelCell);

      tbody.appendChild(row);
    }

    // ★ table に thead と tbody を追加
    table.appendChild(thead);
    table.appendChild(tbody);
  },


  /* --------------------------------------------
    エラー表示
  -------------------------------------------- */
  showError(message) {
    const box = document.getElementById("yErrorMessage");
    box.textContent = message;
    box.classList.add("show");
  },

  clearError() {
    const box = document.getElementById("yErrorMessage");
    box.textContent = "";
    box.classList.remove("show");
  },

  /* --------------------------------------------
     適用ボタンの有効/無効
  -------------------------------------------- */
  setApplyEnabled(enabled) {
    const dialog = document.getElementById("yAxisDialog");
    if (!dialog || dialog.style.display === "none") return;

    const chartIndex = Number(dialog.dataset.index);
    if (!Number.isFinite(chartIndex)) return;

    const chart = window.charts[chartIndex];
    if (!chart) return;
  },


  /* --------------------------------------------
     状態一覧の表示/非表示
  -------------------------------------------- */
  showUnitTable() {
    document.getElementById("yUnitTable").style.display = "table";
    const heading = document.getElementById("yUnitHeading");
    if (heading) heading.style.display = "block";
  },

  hideUnitTable() {
    document.getElementById("yUnitTable").style.display = "none";
    const heading = document.getElementById("yUnitHeading");
    if (heading) heading.style.display = "none";
  }
};
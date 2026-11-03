// ===============================
// PanelFactory.js
// パネルの DOM 生成を担当
// ===============================

window.PanelFactory = {
  create(index) {
    const graphs = document.getElementById('graphs');

    // ===== パネル本体 =====
    const panel = document.createElement('div');
    panel.className = "chart-panel";
    panel.id = "panel" + index;

    // ===== タイトルバー =====
    const title = document.createElement('div');
    title.className = "chart-title";

    // ===== コントロールボタン群 =====
    const controls = document.createElement('span');
    controls.className = "chart-controls";

    // ===== 上下移動ボタン =====
    const btnTop = this._createMoveButton("⇑", "一番上へ", () => {
      const p = document.getElementById("panel" + index);
      if (!p) return;
      graphs.insertBefore(p, graphs.firstChild);
      refreshAxes();
      fixChartHeights();
      p.scrollIntoView({ behavior: "smooth", block: "center" });
      highlightMoved(p);
      saveStateToLocalStorage();
    });

    const btnUp = this._createMoveButton("↑", "一つ上へ", () => {
      const p = document.getElementById("panel" + index);
      if (!p) return;
      const prev = p.previousElementSibling;
      if (!prev) return;
      graphs.insertBefore(p, prev);
      refreshAxes();
      fixChartHeights();
      highlightMoved(p);
      saveStateToLocalStorage();
    });

    const btnDown = this._createMoveButton("↓", "一つ下へ", () => {
      const p = document.getElementById("panel" + index);
      if (!p) return;
      const next = p.nextElementSibling;
      if (!next) return;
      graphs.insertBefore(p, next.nextSibling);
      refreshAxes();
      fixChartHeights();
      highlightMoved(p);
      saveStateToLocalStorage();
    });

    const btnBottom = this._createMoveButton("⇓", "一番下へ", () => {
      const p = document.getElementById("panel" + index);
      if (!p) return;
      graphs.appendChild(p);
      refreshAxes();
      fixChartHeights();
      p.scrollIntoView({ behavior: "smooth", block: "center" });
      highlightMoved(p);
      saveStateToLocalStorage();
    });

    // ===== ✖ ボタン =====
    const btnClose = this._createMoveButton("✖", "閉じる", () => {
      panel.remove();
      refreshAxes();
      fixChartHeights();

      const chk = document.getElementById("chk" + index);
      if (chk) {
        chk.checked = false;
        toggleChart(index, false);

        const ecuName = seriesData[index].meta.ecu;
        const parentChk = document.getElementById("parent-" + ecuName);
        if (parentChk) {
          const children = seriesData
            .map((s, i) => ({ ...s, index: i }))
            .filter(s => s.meta.ecu === ecuName);
          updateParentState(parentChk, children);
        }
      }

      saveStateToLocalStorage();
    });

    controls.appendChild(btnTop);
    controls.appendChild(btnUp);
    controls.appendChild(btnDown);
    controls.appendChild(btnBottom);
    controls.appendChild(btnClose);

    // ===== ハンバーガーメニュー（ドラッグハンドル） =====
    const handle = document.createElement('span');
    handle.textContent = "≡";
    handle.className = "drag-handle";
    handle.draggable = true;

    // ===== タイトルテキスト =====
    const titleText = document.createElement('span');
    titleText.textContent = seriesData[index]
      ? `${seriesData[index].meta.ecu} - ${seriesData[index].meta.label}`
      : ("Series " + index);

    // ===== 設定アイコン =====
    const settingsIcon = document.createElement('span');
    settingsIcon.textContent = "⚙️";
    settingsIcon.className = "settings-icon";

    // ===== タイトルバー構成 =====
    title.appendChild(handle);
    title.appendChild(titleText);
    title.appendChild(settingsIcon);
    title.appendChild(controls);

    // ===== ボディ（キャンバス） =====
    const body = document.createElement('div');
    body.className = "chart-body";

    const canvas = document.createElement('canvas');
    canvas.id = "cv" + index;
    body.appendChild(canvas);

    panel.appendChild(title);
    panel.appendChild(body);
    graphs.appendChild(panel);

    // ===== パネルを返す（互換性維持） =====
    return { panel, title, controls, handle, canvas };
  },

  // ===== ボタン生成の共通関数 =====
  _createMoveButton(label, title, onClick) {
    const btn = document.createElement('button');
    btn.textContent = label;
    btn.title = title;
    btn.addEventListener('click', e => {
      e.stopPropagation();
      onClick();
    });
    return btn;
  }
};
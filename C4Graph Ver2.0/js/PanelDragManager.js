// ==========================================
// PanelDragManager.js（選択状態を維持しつつ、ドラッグ中は選択扱い）
// ==========================================

window.PanelDragManager = (function () {

  let dragMoved = false;
  let movedIds = [];

  let graphsEl = null;
  let scrollEl = null;
  let globalHandlersInitialized = false;

  function ensureBaseElements() {
    if (!graphsEl) graphsEl = document.getElementById('graphs');
    if (!scrollEl) scrollEl = document.getElementById('graphsContainer');
  }

  function initGlobalHandlers() {
    if (globalHandlersInitialized) return;
    globalHandlersInitialized = true;

    ensureBaseElements();
    if (!graphsEl || !scrollEl) return;

    graphsEl.addEventListener('dragover', e => {
      e.preventDefault();

      const rect = scrollEl.getBoundingClientRect();
      const margin = 120;
      const maxSpeed = 4;

      if (e.clientY < rect.top + margin) {
        const dist = rect.top + margin - e.clientY;
        const ratio = 1 - dist / margin;
        const speed = maxSpeed * Math.pow(ratio, 3);
        scrollEl.scrollTop -= Math.max(0, speed);
      } else if (e.clientY > rect.bottom - margin) {
        const dist = e.clientY - (rect.bottom - margin);
        const ratio = 1 - dist / margin;
        const speed = maxSpeed * Math.pow(ratio, 4);
        scrollEl.scrollTop += Math.max(0, speed);
      }

      document.querySelectorAll('.drop-target-top, .drop-target-bottom')
        .forEach(el => el.classList.remove('drop-target-top', 'drop-target-bottom'));

      const target = resolveDropTarget(e);
      if (!target) return;

      const rectTarget = target.getBoundingClientRect();
      const before = (e.clientY - rectTarget.top) < rectTarget.height / 2;
      target.classList.add(before ? 'drop-target-top' : 'drop-target-bottom');
    });

    graphsEl.addEventListener('drop', e => {
      e.preventDefault();

      document.querySelectorAll('.drop-target-top, .drop-target-bottom')
        .forEach(el => el.classList.remove('drop-target-top', 'drop-target-bottom'));

      const ids = e.dataTransfer.getData('text/plain').split(",");
      const target = resolveDropTarget(e);
      if (!target) return;

      const rect = target.getBoundingClientRect();
      const before = (e.clientY - rect.top) < rect.height / 2;

      ids.forEach(id => {
        const dragged = document.getElementById(id);
        if (!dragged || dragged === target) return;

        if (before) {
          graphsEl.insertBefore(dragged, target);
        } else {
          graphsEl.insertBefore(dragged, target.nextSibling);
        }
      });

      dragMoved = true;
      movedIds = ids.slice();

      setTimeout(() => {
        refreshAxes();
        fixChartHeights();
      }, 0);
    });
  }

  function resolveDropTarget(e) {
    let target = e.target.closest('.chart-panel');
    if (target) return target;

    const panels = [...document.querySelectorAll('.chart-panel')];
    if (panels.length === 0) return null;

    const y = e.clientY;
    const margin = 8;

    const byBottom = panels.find(p => {
      const r = p.getBoundingClientRect();
      return y < r.bottom + margin;
    });

    return byBottom || panels[panels.length - 1];
  }

  function attach(panel, index) {
    ensureBaseElements();
    initGlobalHandlers();

    if (!panel) return;

    const handle = panel.querySelector('.drag-handle');
    if (!handle) return;

    // ===== ドラッグ開始 =====
    handle.addEventListener('dragstart', e => {
      const thisId = "panel" + index;
      const currentPanel = document.getElementById(thisId);

      dragMoved = false;
      movedIds = [];

      let ids;
      let useMultiple = false;

      // すでに複数選択されている場合
      if (Array.isArray(selectedChartIndices) &&
          selectedChartIndices.length > 0 &&
          selectedChartIndices.includes(index)) {

        ids = selectedChartIndices.map(i => "panel" + i).join(",");
        useMultiple = selectedChartIndices.length > 1;

      } else {
        // 単独ドラッグ → ここで選択状態にする
        ids = thisId;
        useMultiple = false;

        selectedChartIndices = [index];

        if (currentPanel) {
          currentPanel.classList.add("selected");
          currentPanel.classList.add("active");
        }
      }

      e.dataTransfer.setData('text/plain', ids);

      // ===== ゴースト画像 =====
      const ghostContainer = document.createElement('div');
      ghostContainer.style.display = 'flex';
      ghostContainer.style.flexDirection = 'column';
      ghostContainer.style.opacity = '0.8';
      ghostContainer.style.position = 'absolute';
      ghostContainer.style.top = '-9999px';

      if (useMultiple) {
        selectedChartIndices.forEach(i => {
          const p = document.getElementById("panel" + i);
          if (!p) return;
          const clone = p.cloneNode(true);
          clone.style.transform = "scale(0.5)";
          clone.style.marginBottom = "2px";
          clone.style.width = p.offsetWidth / 2 + "px";
          clone.style.height = p.offsetHeight / 2 + "px";
          ghostContainer.appendChild(clone);
        });
      } else if (currentPanel) {
        const clone = currentPanel.cloneNode(true);
        clone.style.width = currentPanel.offsetWidth + "px";
        clone.style.height = currentPanel.offsetHeight + "px";
        ghostContainer.appendChild(clone);
      }

      document.body.appendChild(ghostContainer);
      e.dataTransfer.setDragImage(ghostContainer, 10, 10);
      setTimeout(() => document.body.removeChild(ghostContainer), 0);

      panel.classList.add("dragging");
      document.body.classList.add("grabbing");
    });

    // ===== ドラッグ終了 =====
    handle.addEventListener('dragend', () => {
        document.body.classList.remove("grabbing");
        panel.classList.remove("dragging");

        // ★ 複数選択して移動した場合は選択維持
        if (selectedChartIndices.length > 1) {
            // 何もしない
        } else {
            // ★ 単独ドラッグ → 選択解除
            selectedChartIndices.forEach(i => {
            const p = document.getElementById("panel" + i);
            if (p) {
                p.classList.remove("selected");
                p.classList.remove("active");
                p.classList.remove("highlight");
            }
            });
            selectedChartIndices = [];
        }

        // ★★★ サイドバーの chip と選択状態を同期 ★★★
        document.querySelectorAll('#controls .chip').forEach(chip => {
            const chk = chip.querySelector('input[type=checkbox]');
            if (!chk) return;
            const chipIndex = parseInt(chk.dataset.index, 10);

            chip.classList.toggle('selected', selectedChartIndices.includes(chipIndex));
        });

        // moved アニメーション
        movedIds.forEach(id => {
            const p = document.getElementById(id);
            if (p) {
            p.classList.add("moved");
            p.addEventListener("animationend", () => {
                p.classList.remove("moved");
            }, { once: true });
            }
        });

        saveStateToLocalStorage();
    });
  }

  return { attach };
})();
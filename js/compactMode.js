// ===============================
// compactMode.js
// コンパクト表示モードの切り替えと管理
// ===============================

window.CompactMode = {
  isActive: false,

  init() {
    const toggleCheckbox = document.getElementById('toggleCompactMode');
    if (!toggleCheckbox) return;

    toggleCheckbox.addEventListener('change', (e) => {
      this.isActive = e.target.checked;
      if (this.isActive) {
        this.enable();
      } else {
        this.disable();
      }
      // 状態を保存
      if (typeof saveStateToLocalStorage === 'function') {
        saveStateToLocalStorage();
      }
    });
  },

  // パネル設定を取得
  getPanelSettings() {
    const settings = {};
    document.querySelectorAll('.chart-panel.compact-mode').forEach(panel => {
      const overlayTitle = panel.querySelector('.compact-title-overlay');
      const controlsOverlay = panel.querySelector('.compact-controls-overlay');

      if (overlayTitle) {
        settings[panel.id] = {
          title: {
            left: overlayTitle.style.left,
            top: overlayTitle.style.top
          },
          controls: controlsOverlay ? {
            left: controlsOverlay.style.left,
            top: controlsOverlay.style.top,
            right: controlsOverlay.style.right
          } : null
        };
      }
    });
    return settings;
  },

  // パネル設定を復元
  restorePanelSettings(settings) {
    if (!settings) return;

    Object.entries(settings).forEach(([panelId, setting]) => {
      const panel = document.getElementById(panelId);
      if (!panel) return;

      const overlayTitle = panel.querySelector('.compact-title-overlay');
      const controlsOverlay = panel.querySelector('.compact-controls-overlay');

      if (overlayTitle && setting.title) {
        if (setting.title.left) overlayTitle.style.left = setting.title.left;
        if (setting.title.top) overlayTitle.style.top = setting.title.top;
      }

      if (controlsOverlay && setting.controls) {
        if (setting.controls.left) controlsOverlay.style.left = setting.controls.left;
        if (setting.controls.top) controlsOverlay.style.top = setting.controls.top;
        if (setting.controls.right) controlsOverlay.style.right = setting.controls.right;
      }
    });
  },

  enable() {
    document.querySelectorAll('.chart-panel').forEach(panel => {
      this.applyToPanel(panel);
    });
  },

  disable() {
    document.querySelectorAll('.chart-panel').forEach(panel => {
      this.removeFromPanel(panel);
    });
  },

  enable() {
    document.querySelectorAll('.chart-panel').forEach(panel => {
      this.applyToPanel(panel);
    });
  },

  disable() {
    document.querySelectorAll('.chart-panel').forEach(panel => {
      this.removeFromPanel(panel);
    });
  },

  applyToPanel(panel) {
    if (panel.classList.contains('compact-mode')) return;

    panel.classList.add('compact-mode');

    // 高さはfixChartHeightsで調整するため、ここでは変更しない
    // タイトルバー非表示による高さ調整はfixChartHeightsに任せる

    // タイトルテキストを取得
    const titleText = panel.querySelector('.chart-title span:nth-child(2)');
    const titleContent = titleText ? titleText.textContent : 'Unknown';

    // オーバーレイタイトルを作成（Y軸の右側に配置）
    const overlayTitle = document.createElement('div');
    overlayTitle.className = 'compact-title-overlay';
    overlayTitle.style.left = '60px'; // Y軸の右側
    overlayTitle.style.top = '4px';

    // タイトルテキスト
    const titleSpan = document.createElement('span');
    titleSpan.textContent = titleContent;
    overlayTitle.appendChild(titleSpan);

    // 設定ボタンを項目名の右に追加
    const settingsBtn = document.createElement('button');
    settingsBtn.textContent = '⚙️';
    settingsBtn.title = '設定';
    settingsBtn.style.marginLeft = '6px';
    settingsBtn.style.border = 'none';
    settingsBtn.style.background = 'transparent';
    settingsBtn.style.cursor = 'pointer';
    settingsBtn.style.fontSize = '12px';
    // mousedownで伝播停止（ドラッグを開始させない）
    settingsBtn.addEventListener('mousedown', (e) => {
      e.stopPropagation();
    });
    settingsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const originalSettings = panel.querySelector('.settings-icon');
      if (originalSettings) originalSettings.click();
    });
    overlayTitle.appendChild(settingsBtn);

    // ドラッグ機能
    this._makeDraggable(overlayTitle, panel);

    // コントロールオーバーレイを作成（ドラッグ可能）
    const controlsOverlay = this._createControlsOverlay(panel);

    // パネルに追加
    panel.style.position = 'relative';
    panel.appendChild(overlayTitle);
    panel.appendChild(controlsOverlay);

    // ドラッグ終了時に状態を保存
    this._addSaveOnDragEnd(overlayTitle);
    this._addSaveOnDragEnd(controlsOverlay);
  },

  removeFromPanel(panel) {
    panel.classList.remove('compact-mode');

    const overlayTitle = panel.querySelector('.compact-title-overlay');
    const controlsOverlay = panel.querySelector('.compact-controls-overlay');

    if (overlayTitle) overlayTitle.remove();
    if (controlsOverlay) controlsOverlay.remove();
  },

  _createControlsOverlay(panel) {
    const overlay = document.createElement('div');
    overlay.className = 'compact-controls-overlay';
    overlay.style.right = '8px';
    overlay.style.top = '4px';

    // ドラッグハンドル（つまみ）を追加
    const dragHandle = document.createElement('span');
    dragHandle.className = 'compact-drag-handle';
    dragHandle.textContent = '⋮⋮';
    dragHandle.title = 'ドラッグして移動';
    overlay.appendChild(dragHandle);

    // 元のコントロールボタンを複製
    const originalControls = panel.querySelector('.chart-controls');
    if (originalControls) {
      const buttons = originalControls.querySelectorAll('button');
      buttons.forEach(btn => {
        const clone = btn.cloneNode(true);
        clone.addEventListener('click', (e) => {
          e.stopPropagation();
          btn.click();
        });
        overlay.appendChild(clone);
      });
    }

    // ドラッグ機能はハンドルのみに適用
    this._makeDraggableByHandle(overlay, dragHandle, panel);

    return overlay;
  },

  _makeDraggable(element, container) {
    let isDragging = false;
    let startX, startY, initialX, initialY;

    element.addEventListener('mousedown', (e) => {
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      initialX = element.offsetLeft;
      initialY = element.offsetTop;
      element.style.cursor = 'grabbing';
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;

      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      let newX = initialX + dx;
      let newY = initialY + dy;

      // コンテナ内に制限
      const maxX = container.offsetWidth - element.offsetWidth;
      const maxY = container.offsetHeight - element.offsetHeight;

      newX = Math.max(0, Math.min(newX, maxX));
      newY = Math.max(0, Math.min(newY, maxY));

      element.style.left = newX + 'px';
      element.style.top = newY + 'px';
    });

    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        element.style.cursor = 'grab';
        // ドラッグ終了時に保存
        if (typeof saveStateToLocalStorage === 'function') {
          saveStateToLocalStorage();
        }
      }
    });
  },

  _makeDraggableByHandle(element, handle, container) {
    let isDragging = false;
    let startX, startY, initialX, initialY;

    handle.addEventListener('mousedown', (e) => {
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      initialX = element.offsetLeft;
      initialY = element.offsetTop;
      handle.style.cursor = 'grabbing';
      e.preventDefault();
      e.stopPropagation();
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;

      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      let newX = initialX + dx;
      let newY = initialY + dy;

      // コンテナ内に制限
      const maxX = container.offsetWidth - element.offsetWidth;
      const maxY = container.offsetHeight - element.offsetHeight;

      newX = Math.max(0, Math.min(newX, maxX));
      newY = Math.max(0, Math.min(newY, maxY));

      element.style.left = newX + 'px';
      element.style.top = newY + 'px';
      element.style.right = 'auto';
    });

    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        handle.style.cursor = 'grab';
        // ドラッグ終了時に保存
        if (typeof saveStateToLocalStorage === 'function') {
          saveStateToLocalStorage();
        }
      }
    });
  },

  _addSaveOnDragEnd(element) {
    if (!element) return;

    // ドラッグ終了を検知するために、mouseupイベントをリッスン
    const saveHandler = () => {
      if (typeof saveStateToLocalStorage === 'function') {
        saveStateToLocalStorage();
      }
    };

    // 要素自体のmouseupと、ドキュメントのmouseup（ドラッグ中の場合）の両方をリッスン
    element.addEventListener('mouseup', saveHandler);

    // ドラッグ中にドキュメント上でmouseupが発生した場合も保存
    const docMouseUpHandler = () => {
      // 少し遅延させて、スタイル変更が完了してから保存
      setTimeout(saveHandler, 100);
    };

    // 要素がドラッグ可能な場合のみ、ドキュメントのmouseupをリッスン
    if (element.classList.contains('compact-title-overlay') ||
        element.classList.contains('compact-controls-overlay')) {
      document.addEventListener('mouseup', docMouseUpHandler);
    }
  }
};

// 初期化
document.addEventListener('DOMContentLoaded', () => {
  CompactMode.init();
});

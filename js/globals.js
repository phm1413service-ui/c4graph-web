// ===============================
//  globals.js（C4Graph 全体の基盤）
// ===============================

// ===== グラフ・データ関連 =====
window.charts = [];              // 各チャートの Chart.js インスタンス
window.seriesData = [];          // CSV から読み込んだ全データ
window.globalYAxisWidth = 0;     // Y軸幅の最大値（全チャート共通）

// ===== マーカーの全体設定（表示メニューで変更される） =====
window.globalMarkerEnabled = true;   // 初期値は ON
window.markerEnabledByMode = { normal: true, overlay: true };
window.hairlineValuesEnabledByMode = { normal: true, overlay: true };
window.overlayMode = false;
window.overlayChart = null;
window.overlayYAxisSettings = {};
window.overlayHeightAuto = true;
window.crosshairValueLabelsByMode = { normal: true, overlay: true };
window.overlaySelectedSeries = new Set();
window.hoveredSeriesIndex = null;

window.getCrosshairValueLabelsEnabled = function(overlayMode = window.overlayMode) {
  const mode = overlayMode ? "overlay" : "normal";
  return window.crosshairValueLabelsByMode?.[mode] !== false;
};

// ===== 0 ラインの全体設定（Y軸ダイアログで変更される） =====
window.globalZeroLineEnabled = true;   // 初期値は ON

// ===== X軸・クロスヘア関連 =====
window.sharedTimeValue = null;        // クロスヘア（中央）
window.sharedTimeValueLeft = null;    // 左クロスヘア
window.sharedTimeValueRight = null;   // 右クロスヘア
window.fixedLinesByMode = {
  normal: { left: null, right: null },
  overlay: { left: null, right: null }
};
window.isLeftDrag = false;
window.isRightDrag = false;

window.storeActiveFixedLines = function() {
  const mode = window.overlayMode ? "overlay" : "normal";
  window.fixedLinesByMode[mode] = {
    left: window.sharedTimeValueLeft,
    right: window.sharedTimeValueRight
  };
};

window.activateFixedLinesForMode = function(overlayMode) {
  const mode = overlayMode ? "overlay" : "normal";
  const lines = window.fixedLinesByMode[mode];
  window.sharedTimeValueLeft = lines?.left ?? null;
  window.sharedTimeValueRight = lines?.right ?? null;
};

// ===== X軸のユーザー指定範囲 =====
window.userMinX = null;
window.userMaxX = null;

// ===== グラフ用の色配列 =====
window.chartColors = [
  "#0078D4", // 青
  "#E81123", // 赤
  "#107C10", // 緑
  "#FF8C00", // オレンジ
  "#5C2D91", // 紫
  "#D83B01", // 濃いオレンジ
  "#0099BC", // 水色
  "#8E562E"  // 茶色
];

// ===== DOM参照（どこからでも使えるように） =====
window.graphsEl = document.getElementById('graphs');

// ===== 起動時の背景画像ランダム設定 =====
const defaultBackgroundImages = [
    'images/画像1.png',
    'images/NISSAN-Note-e-power-2024-36.jpg',
    'images/img_b6e110c9253dd5d05ee336fdd5007c6f923942.jpg',
    'images/img_23889db757bd64c6f4aa65e2223e1864253557.jpg',
    'images/Gemini_Generated_Image_s6shn7s6shn7s6sh.png',
    'images/Gemini_Generated_Image_rfp4arfp4arfp4ar.png',
    'images/Gemini_Generated_Image_hc0u67hc0u67hc0u.png',
    'images/Gemini_Generated_Image_d3nuzid3nuzid3nu.png',
    'images/Gemini_Generated_Image_b693zsb693zsb693.png',
    'images/2022020701_02.jpg',
    'images/1763377783687.jpg'
];

function openBackgroundImageDatabase() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error('このブラウザーでは背景画像を保存できません。'));
      return;
    }

    const request = indexedDB.open('C4GraphBackgroundImages', 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore('images', { keyPath: 'name' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('背景画像の保存領域を開けませんでした。'));
  });
}

function saveBackgroundImages(files) {
  return openBackgroundImageDatabase().then(database => new Promise((resolve, reject) => {
    const transaction = database.transaction('images', 'readwrite');
    const store = transaction.objectStore('images');
    files.forEach(file => store.put({ name: file.name, blob: file }));
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error || new Error('背景画像を保存できませんでした。'));
    };
    transaction.onabort = () => {
      database.close();
      reject(transaction.error || new Error('背景画像の保存が中断されました。'));
    };
  }));
}

function deleteBackgroundImage(name) {
  return openBackgroundImageDatabase().then(database => new Promise((resolve, reject) => {
    const transaction = database.transaction('images', 'readwrite');
    transaction.objectStore('images').delete(name);
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error || new Error('追加画像を削除できませんでした。'));
    };
    transaction.onabort = () => {
      database.close();
      reject(transaction.error || new Error('追加画像の削除が中断されました。'));
    };
  }));
}

function loadBackgroundImages() {
  return openBackgroundImageDatabase().then(database => new Promise((resolve, reject) => {
    const transaction = database.transaction('images', 'readonly');
    const request = transaction.objectStore('images').getAll();
    request.onsuccess = () => {
      const images = request.result.map(image => ({
        name: image.name,
        url: URL.createObjectURL(image.blob)
      }));
      database.close();
      resolve(images);
    };
    request.onerror = () => {
      database.close();
      reject(request.error || new Error('保存済みの背景画像を読み込めませんでした。'));
    };
  }));
}

const backgroundSelectionStorageKey = 'C4GraphBackgroundImageSelection';

function getBackgroundSelection() {
  try {
    return JSON.parse(localStorage.getItem(backgroundSelectionStorageKey) || '{}');
  } catch (error) {
    console.error('背景画像の選択設定を読み込めませんでした。', error);
    return {};
  }
}

function setRandomDropzoneBackground(images) {
  const dropzone = document.getElementById('dropzone');
  if (!dropzone || images.length === 0) {
    if (dropzone) dropzone.style.backgroundImage = 'none';
    return;
  }
  const randomIndex = Math.floor(Math.random() * images.length);
  dropzone.style.backgroundImage = `url("${images[randomIndex].url}")`;
}

window.addEventListener('load', async () => {
  let customImages = [];
  try {
    customImages = await loadBackgroundImages();
  } catch (error) {
    console.error('保存済み背景画像の読み込みに失敗しました。', error);
  }
  const imageItems = [
    ...defaultBackgroundImages.map(path => ({
      id: `default:${path}`,
      name: path.split('/').pop(),
      url: path,
      group: 'default'
    })),
    ...customImages.map(image => ({
      id: `custom:${image.name}`,
      name: image.name,
      url: image.url,
      group: 'custom'
    }))
  ];
  let selection = getBackgroundSelection();
  const savedSelectionExists = Object.keys(selection).length > 0;
  imageItems.forEach(image => {
    if (!(image.id in selection)) selection[image.id] = !savedSelectionExists || image.group === 'custom';
  });

  const defaultGrid = document.getElementById('defaultBackgroundImages');
  const customGrid = document.getElementById('customBackgroundImages');
  const dialog = document.getElementById('backgroundSettingsDialog');
  const addButton = document.getElementById('addBackgroundImages');
  const imageInput = document.getElementById('backgroundImageInput');
  const openButton = document.getElementById('openBackgroundSettings');
  const saveButton = document.getElementById('saveBackgroundSettings');
  const closeButton = document.getElementById('closeBackgroundSettings');
  const imageDropzone = document.getElementById('backgroundImageDropzone');

  async function removeCustomImage(image) {
    if (!confirm('この追加画像を削除しますか？')) return;

    try {
      await deleteBackgroundImage(image.name);
      URL.revokeObjectURL(image.url);
      const imageIndex = imageItems.findIndex(item => item.id === image.id);
      if (imageIndex >= 0) imageItems.splice(imageIndex, 1);
      delete selection[image.id];

      const savedSelection = getBackgroundSelection();
      delete savedSelection[image.id];
      if (!imageItems.some(item => savedSelection[item.id])) {
        const fallbackImage = imageItems.find(item => item.group === 'default');
        if (fallbackImage) savedSelection[fallbackImage.id] = true;
      }
      if (!imageItems.some(item => selection[item.id])) {
        const fallbackImage = imageItems.find(item => item.group === 'default');
        if (fallbackImage) selection[fallbackImage.id] = true;
      }
      renderImageGroups();
      applySavedSelection();

      try {
        localStorage.setItem(backgroundSelectionStorageKey, JSON.stringify(savedSelection));
      } catch (error) {
        console.error('削除した画像の選択設定を保存できませんでした。', error);
        alert(`画像は削除されましたが、選択設定を保存できませんでした。\n${error.message}`);
      }
    } catch (error) {
      console.error('追加画像の削除に失敗しました。', error);
      alert(`追加画像を削除できませんでした。\n${error.message}`);
    }
  }

  function renderImageGroups() {
    defaultGrid.replaceChildren();
    customGrid.replaceChildren();
    document.querySelectorAll('[data-image-count]').forEach(count => {
      const group = count.dataset.imageCount;
      const total = imageItems.filter(image => image.group === group).length;
      const selected = imageItems.filter(image => image.group === group && selection[image.id]).length;
      count.textContent = `${selected}/${total} 選択中`;
    });
    imageItems.forEach(image => {
      const card = document.createElement('div');
      card.className = 'background-image-card';
      if (selection[image.id]) card.classList.add('selected');
      const thumbnail = document.createElement('img');
      thumbnail.src = image.url;
      thumbnail.alt = '';
      const label = document.createElement('label');
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = Boolean(selection[image.id]);
      checkbox.dataset.imageId = image.id;
      checkbox.setAttribute('aria-label', `ランダム候補にする: ${image.name}`);
      checkbox.addEventListener('change', () => {
        card.classList.toggle('selected', checkbox.checked);
        const count = document.querySelector(`[data-image-count="${image.group}"]`);
        const groupImages = imageItems.filter(item => item.group === image.group);
        const groupGrid = image.group === 'default' ? defaultGrid : customGrid;
        const selectedCount = groupGrid.querySelectorAll('input[data-image-id]:checked').length;
        count.textContent = `${selectedCount}/${groupImages.length} 選択中`;
      });
      const state = document.createElement('span');
      state.textContent = 'ランダム候補';
      label.append(checkbox, state);
      card.append(thumbnail, label);
      if (image.group === 'custom') {
        const removeButton = document.createElement('button');
        removeButton.type = 'button';
        removeButton.className = 'background-image-delete';
        removeButton.textContent = '×';
        removeButton.setAttribute('aria-label', '追加画像を削除');
        removeButton.title = 'この画像を削除';
        removeButton.addEventListener('click', () => removeCustomImage(image));
        card.append(removeButton);
      }
      (image.group === 'default' ? defaultGrid : customGrid).append(card);
    });
  }

  function applySavedSelection() {
    const selectedImages = imageItems.filter(image => selection[image.id]);
    setRandomDropzoneBackground(selectedImages);
  }

  renderImageGroups();
  applySavedSelection();

  openButton?.addEventListener('click', () => {
    renderImageGroups();
    dialog.style.display = 'flex';
  });
  closeButton?.addEventListener('click', () => {
    dialog.style.display = 'none';
    renderImageGroups();
  });
  dialog?.addEventListener('click', event => {
    if (event.target === dialog) dialog.style.display = 'none';
  });

  dialog?.querySelectorAll('[data-select-group]').forEach(button => {
    button.addEventListener('click', () => {
      const group = button.dataset.selectGroup;
      const selected = button.dataset.selected === 'true';
      const grid = group === 'default' ? defaultGrid : customGrid;
      grid.querySelectorAll('input[data-image-id]').forEach(checkbox => {
        checkbox.checked = selected;
        checkbox.dispatchEvent(new Event('change'));
      });
    });
  });

  saveButton?.addEventListener('click', () => {
    const nextSelection = { ...selection };
    dialog.querySelectorAll('input[data-image-id]').forEach(checkbox => {
      nextSelection[checkbox.dataset.imageId] = checkbox.checked;
    });
    if (!imageItems.some(image => nextSelection[image.id])) {
      alert('ランダム候補にする画像を1枚以上選択してください。');
      return;
    }
    try {
      localStorage.setItem(backgroundSelectionStorageKey, JSON.stringify(nextSelection));
      selection = nextSelection;
      applySavedSelection();
      dialog.style.display = 'none';
      renderImageGroups();
    } catch (error) {
      console.error('背景画像の選択設定を保存できませんでした。', error);
      alert(`背景画像の選択設定を保存できませんでした。\n${error.message}`);
    }
  });

  async function addBackgroundFiles(files) {
    const imageFiles = Array.from(files).filter(file => file.type.startsWith('image/'));
    if (imageFiles.length === 0) {
      alert('画像ファイルをドロップしてください。');
      return;
    }

    try {
      await saveBackgroundImages(imageFiles);
      customImages.forEach(image => URL.revokeObjectURL(image.url));
      customImages = await loadBackgroundImages();
      customImages.forEach(image => {
        const id = `custom:${image.name}`;
        const existingIndex = imageItems.findIndex(existing => existing.id === id);
        const item = { id, name: image.name, url: image.url, group: 'custom' };
        if (existingIndex >= 0) imageItems[existingIndex] = item;
        else imageItems.push(item);
        selection[id] = true;
      });
      renderImageGroups();
    } catch (error) {
      console.error('背景画像の追加に失敗しました。', error);
      alert(`背景画像を保存できませんでした。\n${error.message}`);
    }
  }

  addButton?.addEventListener('click', () => imageInput.click());
  imageInput?.addEventListener('change', async () => {
    const files = Array.from(imageInput.files || []);
    imageInput.value = '';
    if (files.length === 0) return;
    await addBackgroundFiles(files);
  });

  imageDropzone?.addEventListener('click', () => imageInput.click());
  imageDropzone?.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      imageInput.click();
    }
  });
  ['dragenter', 'dragover'].forEach(eventName => {
    imageDropzone?.addEventListener(eventName, event => {
      event.preventDefault();
      event.stopPropagation();
      imageDropzone.classList.add('drag-over');
    });
  });
  ['dragleave', 'dragend'].forEach(eventName => {
    imageDropzone?.addEventListener(eventName, event => {
      event.preventDefault();
      event.stopPropagation();
      if (event.relatedTarget instanceof Node && imageDropzone.contains(event.relatedTarget)) return;
      imageDropzone.classList.remove('drag-over');
    });
  });
  imageDropzone?.addEventListener('drop', async event => {
    event.preventDefault();
    event.stopPropagation();
    imageDropzone.classList.remove('drag-over');
    await addBackgroundFiles(event.dataTransfer.files);
  });

  dialog?.addEventListener('dragover', event => {
    if (event.dataTransfer?.types.includes('Files')) {
      event.preventDefault();
      event.stopPropagation();
    }
  });
  dialog?.addEventListener('drop', event => {
    if (event.dataTransfer?.types.includes('Files')) {
      event.preventDefault();
      event.stopPropagation();
    }
  });
});

// ===== controls 初期化 =====
document.addEventListener("DOMContentLoaded", () => {
  const controls = document.getElementById('controls');
  if (controls) controls.innerHTML = "";
});

// ★★★★★ ここから下に追加（DOMContentLoaded の外） ★★★★★

// ===== ローディング中断フラグ =====
window.__cancelLoading = false;

// ★ ローディング表示制御
function showLoading() {
  window.__cancelLoading = false;   // ← 開始時にリセット
  const el = document.getElementById("loadingOverlay");
  if (el) el.style.display = "flex";
}

function hideLoading() {
  const el = document.getElementById("loadingOverlay");
  if (el) el.style.display = "none";
}

function updateProgress(percent) {
  const circle = document.getElementById("loadingCircleProgress");
  const text = document.getElementById("loadingText");

  if (circle) {
    const total = 314; // 2πr = 2 * 3.14 * 50
    const offset = total - (total * percent / 100);
    circle.style.strokeDashoffset = offset;
  }

  if (text) {
    text.textContent = percent + "%";
  }
}

// ★ 中断ボタンのイベント
document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("cancelLoadingBtn");
  if (btn) {
    btn.onclick = () => {
      window.__cancelLoading = true;
    };
  }
});

// ★ 重い処理をローディング付きで実行する共通関数
async function runWithLoading(task, showProgress = false) {
  showLoading();
  updateProgress(0);

  // UI 更新
  await new Promise(r => setTimeout(r));

  // task は async 関数
  await task(updateProgress);

  hideLoading();
}
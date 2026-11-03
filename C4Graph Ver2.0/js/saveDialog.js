/* ============================================
   saveDialog.js
============================================ */

// ===== C4G 保存ダイアログ制御 =====

// ダイアログを開く
function openSaveDialog() {
  const overlay = document.getElementById('saveDialogOverlay');
  const input = document.getElementById('saveFilenameInput');
  if (!overlay || !input) return;

  // デフォルト名を取得
  const defaultName = getDefaultC4GFilename();
  input.value = defaultName.replace(/\.c4g$/i, "");

  overlay.style.display = 'flex';
  input.focus();
  input.select();
}

// ダイアログを閉じる
function closeSaveDialog() {
  const overlay = document.getElementById('saveDialogOverlay');
  if (!overlay) return;
  overlay.style.display = 'none';
}

// 保存ボタン処理
function handleSaveDialogOk() {
  const input = document.getElementById('saveFilenameInput');
  if (!input) return;

  let name = input.value.trim();
  if (!name) {
    alert("ファイル名を入力してください。");
    return;
  }

  if (!name.toLowerCase().endsWith(".c4g")) {
    name += ".c4g";
  }

  closeSaveDialog();
  exportC4GWithFilename(name);
}

// 初期化（イベント設定）
document.addEventListener('DOMContentLoaded', () => {
  const cancelBtn = document.getElementById('saveDialogCancelBtn');
  const okBtn = document.getElementById('saveDialogOkBtn');
  const input = document.getElementById('saveFilenameInput');

  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => closeSaveDialog());
  }

  if (okBtn) {
    okBtn.addEventListener('click', () => handleSaveDialogOk());
  }

  if (input) {
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSaveDialogOk();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        closeSaveDialog();
      }
    });
  }
});
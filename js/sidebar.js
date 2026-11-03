document.addEventListener("DOMContentLoaded", () => {
  const sidebar = document.getElementById('sidebar');
  const closeSidebar = document.getElementById('closeSidebar');
  const sidebarBand = document.getElementById('sidebar-band');
  const resizer = document.getElementById('sidebar-resizer');

  // ★ サイドバー開閉アニメーション終了時にスライダー更新
  sidebar.addEventListener("transitionend", () => {
    refreshXRangeSlider();
  });

  // 閉じるボタン
  if (closeSidebar) {
    closeSidebar.onclick = () => {
      sidebar.classList.remove('open');
    };
  }

  // 開く
  if (sidebarBand) {
    sidebarBand.onclick = () => {
      sidebar.classList.add('open');
    };
  }

  // リサイズ処理
  let isResizing = false;
  if (resizer) {
    resizer.addEventListener('mousedown', () => {
      isResizing = true;
      document.body.style.cursor = 'col-resize';
    });
  }

  document.addEventListener('mousemove', e => {
    if (!isResizing) return;
    const newWidth = Math.min(Math.max(e.clientX, 150), 600);
    sidebar.style.width = newWidth + 'px';
    document.documentElement.style.setProperty('--sidebar-width', newWidth + 'px');
  });

  document.addEventListener('mouseup', () => {
    if (isResizing) {
      isResizing = false;
      document.body.style.cursor = '';

      // ★ リサイズ終了後にレイアウト確定 → スライダー更新
      setTimeout(() => refreshXRangeSlider(), 0);
    }
  });
});
// ==========================================
// chartUI.js
// パネル生成の窓口（責務ゼロの薄いファイル）
// ==========================================

// createChartPanel(index)
// PanelFactory で DOM を作り、
// DragManager / SelectionManager をアタッチして返すだけ。
function createChartPanel(index) {
  // PanelFactory が DOM を生成
  const { panel, title, controls, handle, canvas } = PanelFactory.create(index);

  // ドラッグ＆ドロップ機能を付与
  PanelDragManager.attach(panel, index);

  // 選択（クリック）機能を付与
  PanelSelectionManager.attach(panel, index);

  // コンパクトモードが有効な場合は適用
  if (window.CompactMode && CompactMode.isActive) {
    CompactMode.applyToPanel(panel);
  }

  // toggleChart.js との互換性のため、従来の返り値形式を維持
  return { panel, title, controls, handle, canvas };
}

// highlightMoved(panel)
// パネル移動時のアニメーション（従来どおり）
function highlightMoved(panel) {
  if (!panel) return;
  panel.classList.add("moved");
  panel.addEventListener("animationend", () => {
    panel.classList.remove("moved");
  }, { once: true });
}
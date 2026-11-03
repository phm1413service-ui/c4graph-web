/* ============================================
   YAxisEditorEvents.js
============================================ */

window.YAxisEditorState = {
  lockedChart: null   // グローバルに1つだけ固定状態を持つ
};

window.YAxisEditorEvents = {
  attach(chart, canvas) {

    // --------------------------------------------
    // ダブルクリックで固定モード切り替え
    // --------------------------------------------
    canvas.addEventListener("dblclick", e => {
      const { x, y } = this._getMousePos(canvas, e);
      if (!this._insideYAxis(chart, x, y)) return;

      // 他のチャートが固定されていたら解除
      if (YAxisEditorState.lockedChart && YAxisEditorState.lockedChart !== chart) {
        YAxisEditor.remove();
      }

      // トグル動作
      if (YAxisEditorState.lockedChart === chart) {
      // 自分を解除
      YAxisEditorState.lockedChart = null;
      YAxisEditor.remove();
      } else {
        // 自分を固定
        YAxisEditorState.lockedChart = chart;
        YAxisEditor.show(chart);
      }
    });


    // --------------------------------------------
    // マウスオーバーで表示（固定中でも他のグラフは反応）
    // --------------------------------------------
    canvas.addEventListener("mousemove", e => {
      const { x, y } = this._getMousePos(canvas, e);
      const inside = this._insideYAxis(chart, x, y);

      // 固定中でも「固定されている chart 以外」は反応させる
      if (YAxisEditorState.lockedChart && YAxisEditorState.lockedChart !== chart) {
        if (inside && !document.querySelector(".y-inline-editor")) {
          YAxisEditor.show(chart);
        }
        return;
      }

      // 通常モード（どのチャートも固定されていない）
      if (!YAxisEditorState.lockedChart) {
        if (inside) {
          if (!document.querySelector(".y-inline-editor")) {
            YAxisEditor.show(chart);
          }
        } else {
          YAxisEditor.remove();
        }
      }
    });


    // --------------------------------------------
    // canvas から離れたときの処理
    // → 入力ボックスに向かうときは消さない
    // --------------------------------------------
    canvas.addEventListener("mouseleave", e => {
      // 固定中なら何もしない
      if (YAxisEditorState.lockedChart !== null) return;

      const to = e.relatedTarget; // マウスが移動した先の要素

      // relatedTarget が null のとき（ウィンドウ外など）は消す
      if (!to) {
        YAxisEditor.remove();
        return;
      }

      // 入力ボックス上に移動した場合は消さない
      if (to.closest(".y-inline-editor")) {
        return;
      }

      // それ以外（サイドバー・他のUIなど）に出た場合だけ消す
      YAxisEditor.remove();
    });

    // ★ window の mousemove 監視は一旦やめる
    //   ここが過剰に remove を呼んでいたので、いったん排除して
    //   「canvas 内のロジック」と「mouseleave のみ」で制御する。
  },


  // --------------------------------------------
  // マウス座標取得
  // --------------------------------------------
  _getMousePos(canvas, e) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  },


  // --------------------------------------------
  // Y軸ラベル領域判定（入力ボックスも含めて少し広めに）
  // --------------------------------------------
  _insideYAxis(chart, x, y) {
    const yScale = chart.scales.y;
    if (!yScale) return false;

    const area = chart.chartArea;

    // 入力ボックスは area.top - 9 / area.bottom + 9 にある想定
    const marginY = 12;

    const top = area.top - marginY;
    const bottom = area.bottom + marginY;

    return (
      x >= yScale.left &&
      x <= yScale.right &&
      y >= top &&
      y <= bottom
    );
  }
};

// --------------------------------------------
// 固定中 → Y軸以外をクリックしたら解除
// --------------------------------------------
window.addEventListener("click", e => {
  const locked = YAxisEditorState.lockedChart;
  if (!locked) return; // 固定されていないなら何もしない

  // マウス座標を取得
  const canvas = locked.canvas;
  const { x, y } = YAxisEditorEvents._getMousePos(canvas, e);

  // Y軸領域内なら解除しない（固定を維持）
  if (YAxisEditorEvents._insideYAxis(locked, x, y)) {
    return;
  }

  // それ以外 → 固定解除
  YAxisEditorState.lockedChart = null;
  YAxisEditor.remove();
});
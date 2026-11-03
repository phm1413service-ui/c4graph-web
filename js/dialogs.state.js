/* ============================================
   dialogs.state.js
   Y軸ダイアログの状態管理（ロジックなし）
============================================ */

window.DialogsState = {

  /* --------------------------------------------
     どのフィールドがフォーカスされているか
     "min" / "max" / null
  -------------------------------------------- */
  focusedField: null,

  setFocusedField(field) {
    if (field === "min" || field === "max" || field === null) {
      this.focusedField = field;
    }
  },

  clearFocusedField() {
    this.focusedField = null;
  },

  getFocusedField() {
    return this.focusedField;
  },


  /* --------------------------------------------
     状態モードかどうか（unitMap があるか）
     true = 状態モード
     false = 数値モード
  -------------------------------------------- */
  isStateMode: false,

  /* ★★★ ここに追加 ★★★ */
  unitMap: null,


  /* --------------------------------------------
     自動スケール時の min/max（初期値）
     openYAxisDialog() でセットされる
  -------------------------------------------- */
  autoMin: null,
  autoMax: null,


  /* --------------------------------------------
     現在の Y 軸の min/max（placeholder の元）
     openYAxisDialog() でセットされる
  -------------------------------------------- */
  currentMin: null,
  currentMax: null,


  /* --------------------------------------------
     状態をまとめてセットする（任意）
     ※ events.js から使うとコードがスッキリする
  -------------------------------------------- */
  setAutoRange(min, max) {
    this.autoMin = min;
    this.autoMax = max;
  },

  setCurrentRange(min, max) {
    this.currentMin = min;
    this.currentMax = max;
  }
};
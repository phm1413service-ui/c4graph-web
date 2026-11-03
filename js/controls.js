/* ============================================
   controls.js
============================================ */

// 選択中のグラフインデックスを保持する配列
let selectedChartIndices = [];
let suppressChartUpdates = false;

// ===== UI生成 =====
function renderControls(seriesMeta) {
  const controls = document.getElementById('controls');
  if (!controls) return;
  controls.innerHTML = "";

  const grouped = {};
  seriesMeta.forEach((s, i) => {
    if (!grouped[s.ecu]) grouped[s.ecu] = [];
    grouped[s.ecu].push({ ...s, index: i });
  });

  Object.keys(grouped).forEach(ecuName => {
    const groupDiv = document.createElement('div');
    groupDiv.className = "ecu-group";

    // ECUタイトル＋親チェックボックス
    const titleDiv = document.createElement('div');
    titleDiv.className = "ecu-title";

    const parentChk = document.createElement('input');
    parentChk.type = "checkbox";
    parentChk.id = "parent-" + ecuName;

    const titleLbl = document.createElement('label');
    titleLbl.htmlFor = parentChk.id;
    titleLbl.textContent = ecuName.replace(/^"+|"+$/g, '');

    titleDiv.appendChild(parentChk);
    titleDiv.appendChild(titleLbl);
    groupDiv.appendChild(titleDiv);

    // 子項目リスト
    grouped[ecuName].forEach(s => {
      const div = document.createElement('div');
      div.className = "chip";
      div.draggable = true;

      const chk = document.createElement('input');
      chk.type = "checkbox";
      chk.id = "chk" + s.index;
      chk.dataset.index = s.index;
      chk.checked = false;

      const color = chartColors[s.index % chartColors.length];
      chk.style.accentColor = color;
      div.style.setProperty("--series-color", color);

      chk.onchange = () => {
        toggleChart(s.index, chk.checked);
        updateParentState(parentChk, grouped[ecuName]);
      };

      const lbl = document.createElement('span');
      lbl.textContent = s.label.replace(/^"+|"+$/g, '');
      lbl.dataset.originalText = lbl.textContent; // ★検索用に保存
      div.addEventListener('mouseenter', () => window.setHoveredSeries(s.index));
      div.addEventListener('mouseleave', () => window.clearHoveredSeries(s.index));

      div.appendChild(chk);
      div.appendChild(lbl);

      // chipクリックで選択状態切替
      div.addEventListener('click', e => {
        if (e.target === chk) return;
        if (window.overlayMode) {
          if (chk.checked) {
            window.selectOverlaySeries(s.index, e);
          } else {
            chk.checked = true;
            toggleChart(s.index, true);
            updateParentState(parentChk, grouped[ecuName]);
          }
          return;
        }
        if (!chk.checked) {
          chk.checked = true;
          toggleChart(s.index, true);
          updateParentState(parentChk, grouped[ecuName]);
        } else {
          selectChart(s.index, e);
        }
      });

      // chipダブルクリックでチェック解除
      div.addEventListener('dblclick', () => {
        if (chk.checked) {
          chk.checked = false;
          toggleChart(s.index, false);
          updateParentState(parentChk, grouped[ecuName]);
          div.classList.remove("selected");
          if (!window.overlayMode) {
            const idx = selectedChartIndices.indexOf(s.index);
            if (idx !== -1) selectedChartIndices.splice(idx, 1);
          } else {
            window.overlaySelectedSeries.delete(s.index);
          }
        }
      });

      // ドラッグ開始（サイドバー → グラフ用）
      div.addEventListener('dragstart', e => {
        e.dataTransfer.setData("text/plain", s.index);
      });

      groupDiv.appendChild(div);
    });

    // 親チェックボックスの挙動
    parentChk.onchange = () => {

      const checked = parentChk.checked;

      // ============================
      // OFF のときは即時処理（ローディングなし）
      // ============================
      if (!checked) {

        const indicesToToggle = [];
        grouped[ecuName].forEach(s => {
          const child = document.getElementById("chk" + s.index);
          if (child && child.checked !== checked) {
            child.checked = false;
            indicesToToggle.push(s.index);
          }
        });

        suppressChartUpdates = true;
        indicesToToggle.forEach(idx => toggleChart(idx, false));
        suppressChartUpdates = false;

        // ★★★ 親ECU OFF 後にレイアウトを強制更新 ★★★
        requestSafeLayout();

        updateParentState(parentChk, grouped[ecuName]);
        saveStateToLocalStorage();
        return;
      }

      // ============================
      // ON のとき：まず対象 index を集める（チェックはまだ付けない）
      // ============================
      const indicesToToggle = [];
      grouped[ecuName].forEach(s => {
        const child = document.getElementById("chk" + s.index);
        if (child && child.checked !== checked) {
          indicesToToggle.push(s.index);
        }
      });

      // ============================
      // 軽い処理（5個以下） → ローディングなし
      // ============================
      if (indicesToToggle.length <= 5) {

        suppressChartUpdates = true;

        indicesToToggle.forEach(idx => {
          toggleChart(idx, true);
          const child = document.getElementById("chk" + idx);
          if (child) child.checked = true;
        });

        suppressChartUpdates = false;

        // ★★★ 親ECU ON（軽い処理）後にレイアウトを強制更新 ★★★
        requestSafeLayout();

        updateParentState(parentChk, grouped[ecuName]);
        saveStateToLocalStorage();
        return;
      }

      // ============================
      // 重い処理 → ローディング＋1つずつ処理
      // ============================
      runWithLoading(async (updateProgress) => {

        suppressChartUpdates = true;

        for (let i = 0; i < indicesToToggle.length; i++) {

          // ★ 中断ボタンが押されたら即停止
          if (window.__cancelLoading) {
            console.warn("親ECU：ユーザーが中断しました");
            suppressChartUpdates = false;
            saveStateToLocalStorage();

            // suppressChartUpdates が false なのでここでは呼ばない
            // （toggleChart の requestSafeLayout に任せる）
            return;
          }

          const idx = indicesToToggle[i];

          toggleChart(idx, true);

          const child = document.getElementById("chk" + idx);
          if (child) child.checked = true;

          updateParentState(parentChk, grouped[ecuName]);

          updateProgress(Math.floor((i + 1) / indicesToToggle.length * 100));

          await new Promise(r => setTimeout(r)); // UI に制御を返す
        }

        suppressChartUpdates = false;

        // ★★★ 親ECU ON（重い処理）後にレイアウトを強制更新 ★★★
        requestSafeLayout();
        saveStateToLocalStorage();
      });
    };

    controls.appendChild(groupDiv);
  });

  // ===== ドロップ先（グラフ領域） =====
  const graphs = document.getElementById('graphs');
  if (graphs) {

    // ドラッグ中のデフォルト動作を抑制
    graphs.addEventListener('dragover', e => { e.preventDefault(); });

    // ★★★ インジケータを消す共通関数 ★★★
    function clearDropIndicators() {
      document.querySelectorAll('.drop-target-top, .drop-target-bottom')
        .forEach(el => el.classList.remove('drop-target-top', 'drop-target-bottom'));
    }

    // ★★★ ドラッグキャンセル時（ドロップしなかった場合）に確実に消す ★★★
    graphs.addEventListener('dragend', clearDropIndicators);

    // ★★★ グラフ領域からカーソルが離れた場合も消す（安全策） ★★★
    graphs.addEventListener('dragleave', e => {
      // 子要素への移動ではなく、本当に領域外に出たときだけ消す
      if (!graphs.contains(e.relatedTarget)) {
        clearDropIndicators();
      }
    });

    // ===== サイドバー → グラフ領域 ドロップ（並べ替え対応版） =====
    graphs.addEventListener('drop', e => {
      e.preventDefault();

      // ★★★ ドロップ時にも必ず消す（既存処理） ★★★
      clearDropIndicators();

      const ids = e.dataTransfer.getData("text/plain").split(",");
      const isSidebarDrag = ids.every(id => !id.startsWith("panel"));

      if (isSidebarDrag) {
        ids.forEach(id => {
          const idx = Number(id);
          const chk = document.getElementById("chk" + idx);
          if (chk && !chk.checked) {
            chk.checked = true;

            window.__isSidebarDrag = true;
            toggleChart(idx, true);
            window.__isSidebarDrag = false;
          }
        });

        const ecuName = Object.keys(grouped).find(name =>
          grouped[name].some(s => s.index === Number(ids[0]))
        );
        if (ecuName) {
          const parentChk = document.getElementById("parent-" + ecuName);
          updateParentState(parentChk, grouped[ecuName]);
        }

        saveStateToLocalStorage();
      }

      const target = e.target.closest('.chart-panel');

      if (!target) {
        ids.forEach(id => {
          const panelId = id.startsWith("panel") ? id : "panel" + id;
          const dragged = document.getElementById(panelId);
          if (dragged) graphs.appendChild(dragged);
        });
        refreshAxes();
        fixChartHeights();
        animateMovedPanels(ids);
        return;
      }

      const rect = target.getBoundingClientRect();
      const before = (e.clientY - rect.top) < rect.height / 2;

      ids.forEach(id => {
        const panelId = id.startsWith("panel") ? id : "panel" + id;
        const dragged = document.getElementById(panelId);
        if (!dragged || dragged === target) return;

        if (before) {
          graphs.insertBefore(dragged, target);
        } else {
          graphs.insertBefore(dragged, target.nextSibling);
        }
      });

      dragMoved = true;
      movedIds = ids.slice();

      setTimeout(() => {
        refreshAxes();
        fixChartHeights();
        animateMovedPanels(ids);
      }, 0);
    });
  }

  // ===== 全選択 =====
  const selectAllBtn = document.getElementById("selectAll");
  if (selectAllBtn) {
    selectAllBtn.onclick = () => {

      runWithLoading(async (updateProgress) => {

        document.body.classList.add("select-all-mode");

        const checkboxes = controls.querySelectorAll('input[type="checkbox"][data-index]');

        // ① 追加すべき index を集める
        const indicesToAdd = [];
        checkboxes.forEach((chk) => {
          const idx = parseInt(chk.dataset.index, 10);
          if (!chk.checked) indicesToAdd.push(idx);
        });

        suppressChartUpdates = true;

        // ② 1つずつ追加
        for (let i = 0; i < indicesToAdd.length; i++) {

          // ★ 中断ボタンが押されたら即停止
          if (window.__cancelLoading) {
            console.warn("全選択：ユーザーが中断しました");
            suppressChartUpdates = false;
            // ★★★ 全選択後にレイアウトを強制更新 ★★★
            requestSafeLayout();
            document.body.classList.remove("select-all-mode");

            return;
          }

          const idx = indicesToAdd[i];

          // グラフ追加
          toggleChart(idx, true);

          // 子チェック ON
          const chk = document.querySelector(`input[data-index="${idx}"]`);
          if (chk) chk.checked = true;

          // ★ 親ECU更新
          const ecuName = seriesData[idx].meta.ecu;
          const parentChk = document.getElementById("parent-" + ecuName);
          if (parentChk) {
            const children = seriesData
              .map((s, i) => ({ ...s, index: i }))
              .filter(s => s.meta.ecu === ecuName);
            updateParentState(parentChk, children);
          }

          // プログレス更新
          updateProgress(Math.floor((i + 1) / indicesToAdd.length * 100));

          await new Promise(r => setTimeout(r)); // UI に制御を返す
        }

        suppressChartUpdates = false;

        // ★★★ 全選択後にレイアウトを強制更新（ここが正しい位置） ★★★
        requestSafeLayout();

        document.body.classList.remove("select-all-mode");

        saveStateToLocalStorage();
      });

    };
  }

  // ===== 全解除 =====
  const deselectAllBtn = document.getElementById("deselectAll");
  if (deselectAllBtn) {
    deselectAllBtn.onclick = () => {
      if (window.overlayMode) {
        suppressChartUpdates = true;
        controls.querySelectorAll('input[type="checkbox"][data-index]').forEach(chk => {
          const idx = parseInt(chk.dataset.index, 10);
          if (!chk.checked) return;
          chk.checked = false;
          toggleChart(idx, false);
        });
        suppressChartUpdates = false;
        Object.keys(grouped).forEach(ecuName => {
          const parentChk = document.getElementById("parent-" + ecuName);
          if (parentChk) {
            parentChk.checked = false;
            parentChk.indeterminate = false;
          }
        });
        requestSafeLayout();
        saveStateToLocalStorage();
        return;
      }

      controls.querySelectorAll('input[type="checkbox"][data-index]').forEach(chk => {
        const idx = parseInt(chk.dataset.index, 10);
        if (chk.checked) {
          chk.checked = false;
          toggleChart(idx, false);
          const pos = selectedChartIndices.indexOf(idx);
          if (pos !== -1) selectedChartIndices.splice(pos, 1);
        }
      });
      Object.keys(grouped).forEach(ecuName => {
        const parentChk = document.getElementById("parent-" + ecuName);
        if (parentChk) {
          parentChk.checked = false;
          parentChk.indeterminate = false;
        }
      });
      saveStateToLocalStorage();
    };
  }

  // =====================================
  // ① 検索ヒットのスクロール制御（ここに追加）
  // =====================================
  let searchHits = [];
  let searchHitIndex = -1;

  function updateSearchHits() {
    searchHits = Array.from(document.querySelectorAll("#controls .highlight"));
    searchHitIndex = -1;
  }

  function scrollToNextHit(reverse = false) {
    if (searchHits.length === 0) return;

    if (reverse) {
      searchHitIndex = (searchHitIndex - 1 + searchHits.length) % searchHits.length;
    } else {
      searchHitIndex = (searchHitIndex + 1) % searchHits.length;
    }

    const el = searchHits[searchHitIndex];
    el.scrollIntoView({ behavior: "smooth", block: "center" });
  }



  // =====================================
  // ② サイドバー検索（既存コード）
  // =====================================
  const filterBox = document.getElementById('filterBox');
  if (filterBox) {

    // 入力時のフィルタ処理
    filterBox.addEventListener('input', e => {
      const query = normalizeText(e.target.value.trim());
      const chips = document.querySelectorAll('#controls .chip');

      chips.forEach(chip => {
        const labelEl = chip.querySelector('span');
        const originalText = labelEl.dataset.originalText;

        const match = normalizeText(originalText).includes(query);

        chip.classList.toggle('dimmed', !match);

        if (query && match) {
          labelEl.innerHTML = highlightMatch(originalText, e.target.value);
        } else {
          labelEl.textContent = originalText;
        }
      });

      updateSearchHits();
    });

    // Enter で次のヒットへ移動
    filterBox.addEventListener('keydown', e => {
      if (e.key === "Enter") {
        e.preventDefault();
        const reverse = e.shiftKey;
        scrollToNextHit(reverse);
      }
    });
  }


  // ===== ドラッグ終了時のアニメーション =====
  function animateMovedPanels(ids) {
    ids.forEach(id => {
      const panelId = id.startsWith("panel") ? id : "panel" + id;
      const p = document.getElementById(panelId);
      if (!p) return;

      p.classList.add("moved");
      p.addEventListener("animationend", () => {
        p.classList.remove("moved");
      }, { once: true });
    });
  }


  // ===== 検索クリアボタン（★ animateMovedPanels の外に置く） =====
  const clearBtn = document.getElementById("filterBox-clear");

  if (filterBox && clearBtn) {

    filterBox.addEventListener("input", () => {
      clearBtn.style.display = filterBox.value ? "block" : "none";
    });

    clearBtn.addEventListener("click", () => {
      filterBox.value = "";
      clearBtn.style.display = "none";

      const chips = document.querySelectorAll('#controls .chip');
      chips.forEach(chip => {
        const labelEl = chip.querySelector('span');
        const originalText = labelEl.dataset.originalText;

        chip.classList.remove('dimmed');
        labelEl.textContent = originalText;
      });

      updateSearchHits();
    });
  }  
}

// ===== 親チェックボックスの状態更新 =====
function updateParentState(parentChk, children) {
  const states = children.map(s => {
    const child = document.getElementById("chk" + s.index);
    return child?.checked;
  });

  const allChecked = states.every(v => v);
  const noneChecked = states.every(v => !v);

  parentChk.checked = allChecked;
  parentChk.indeterminate = !allChecked && !noneChecked;
}

// ===== 選択状態にする関数（複数選択対応） =====
function selectChart(index, e) {
  if (e && typeof e.stopPropagation === "function") e.stopPropagation();

  const panel = document.getElementById("panel" + index);
  if (!panel) return;

  // Ctrl + クリック → 複数選択
  if (e && e.ctrlKey) {
    const idx = selectedChartIndices.indexOf(index);

    if (idx === -1) {
      // 追加
      selectedChartIndices.push(index);
    } else {
      // 除外
      selectedChartIndices.splice(idx, 1);
    }

  } else {
    // 通常クリック
    if (selectedChartIndices.length === 1 && selectedChartIndices[0] === index) {
      // すでに単独選択 → 解除
      selectedChartIndices = [];
    } else {
      // 他の選択を解除して単独選択にする
      selectedChartIndices = [index];
    }
  }

  // ★★★ 単独も複数も同じ見た目に統一 ★★★
  // まず全パネルの選択系クラスを外す
  document.querySelectorAll('.chart-panel').forEach(p => {
    p.classList.remove("selected");
    p.classList.remove("active");
    p.classList.remove("highlight");
  });

  // 選択されているパネルすべてに selected + active を付ける
  selectedChartIndices.forEach(i => {
    const p = document.getElementById("panel" + i);
    if (p) {
      p.classList.add("selected"); // 青枠
      p.classList.add("active");   // 青帯＋青背景
    }
  });

  // サイドバー項目にも反映
  document.querySelectorAll('#controls .chip').forEach(chip => {
    const chk = chip.querySelector('input[type=checkbox]');
    if (!chk) return;
    const chipIndex = parseInt(chk.dataset.index, 10);

    chip.classList.toggle('selected', selectedChartIndices.includes(chipIndex));
  });
}

// ===== Escキーで選択全解除 =====
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if (window.overlayMode) return;
    selectedChartIndices.forEach(i => {
      const panel = document.getElementById("panel" + i);
      if (panel) panel.classList.remove("selected");
    });
    selectedChartIndices = [];
    document.querySelectorAll('#controls .chip').forEach(chip => {
      chip.classList.remove('selected');
    });
  }
});
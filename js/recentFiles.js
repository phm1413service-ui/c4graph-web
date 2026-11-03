const RECENT_FILES_DB_NAME = "C4GraphRecentFiles";
const RECENT_FILES_STORE_NAME = "files";
const RECENT_FILES_LIMIT = 10;

function openRecentFilesDatabase() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error("このブラウザーでは最近使ったデータを保存できません。"));
      return;
    }

    const request = indexedDB.open(RECENT_FILES_DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(RECENT_FILES_STORE_NAME, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("最近使ったデータの保存領域を開けませんでした。"));
  });
}

function createRecentFileId(file) {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

async function saveRecentFile(file) {
  const database = await openRecentFilesDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(RECENT_FILES_STORE_NAME, "readwrite");
    const store = transaction.objectStore(RECENT_FILES_STORE_NAME);
    const now = Date.now();
    const id = createRecentFileId(file);

    store.put({
      id,
      name: file.name,
      size: file.size,
      type: file.type,
      lastModified: file.lastModified,
      blob: file.slice(0, file.size, file.type),
      openedAt: now
    });

    const request = store.getAll();
    request.onsuccess = () => {
      const remaining = request.result
        .filter(item => item.id !== id)
        .sort((a, b) => b.openedAt - a.openedAt)
        .slice(RECENT_FILES_LIMIT - 1);
      remaining.forEach(item => store.delete(item.id));
    };

    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error || new Error("データを最近使った一覧に保存できませんでした。"));
    };
    transaction.onabort = () => {
      database.close();
      reject(transaction.error || new Error("最近使ったデータの保存が中断されました。"));
    };
  });
}

async function getRecentFiles() {
  const database = await openRecentFilesDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(RECENT_FILES_STORE_NAME, "readonly");
    const request = transaction.objectStore(RECENT_FILES_STORE_NAME).getAll();
    request.onsuccess = () => {
      resolve(request.result.sort((a, b) => b.openedAt - a.openedAt));
    };
    request.onerror = () => {
      reject(request.error || new Error("最近使ったデータを読み込めませんでした。"));
    };
    transaction.oncomplete = () => database.close();
    transaction.onerror = () => {
      database.close();
      reject(transaction.error || new Error("最近使ったデータを読み込めませんでした。"));
    };
  });
}

function updateRecentFileAccess(id) {
  return changeRecentFile(id, null);
}

function removeRecentFile(id) {
  return changeRecentFile(id, "remove");
}

function changeRecentFile(id, action) {
  return openRecentFilesDatabase().then(database => new Promise((resolve, reject) => {
    const transaction = database.transaction(RECENT_FILES_STORE_NAME, "readwrite");
    const store = transaction.objectStore(RECENT_FILES_STORE_NAME);

    if (action === "remove") {
      store.delete(id);
    } else {
      const request = store.get(id);
      request.onsuccess = () => {
        if (request.result) {
          request.result.openedAt = Date.now();
          store.put(request.result);
        }
      };
    }

    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error || new Error("最近使ったデータを更新できませんでした。"));
    };
    transaction.onabort = () => {
      database.close();
      reject(transaction.error || new Error("最近使ったデータの更新が中断されました。"));
    };
  }));
}

async function clearRecentFiles() {
  const database = await openRecentFilesDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(RECENT_FILES_STORE_NAME, "readwrite");
    transaction.objectStore(RECENT_FILES_STORE_NAME).clear();
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error || new Error("最近使ったデータを削除できませんでした。"));
    };
    transaction.onabort = () => {
      database.close();
      reject(transaction.error || new Error("最近使ったデータの削除が中断されました。"));
    };
  });
}

function closeRecentFilesDialog() {
  const dialog = document.getElementById("recentFilesDialogOverlay");
  if (dialog) dialog.style.display = "none";
}

function formatRecentFileSize(size) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

async function renderRecentFiles() {
  const list = document.getElementById("recentFilesList");
  const clearButton = document.getElementById("clearRecentFilesBtn");
  if (!list || !clearButton) return;

  list.replaceChildren();
  const records = await getRecentFiles();
  clearButton.disabled = records.length === 0;

  if (records.length === 0) {
    const emptyMessage = document.createElement("p");
    emptyMessage.className = "recent-files-empty";
    emptyMessage.textContent = "最近使ったデータはありません。";
    list.appendChild(emptyMessage);
    return;
  }

  records.forEach(record => {
    const item = document.createElement("div");
    item.className = "recent-file-item";

    const openButton = document.createElement("button");
    openButton.type = "button";
    openButton.className = "recent-file-open";
    const name = document.createElement("strong");
    name.textContent = record.name;
    const details = document.createElement("span");
    details.textContent = `${formatRecentFileSize(record.size)} ・ ${new Date(record.openedAt).toLocaleString()}`;
    openButton.append(name, details);
    openButton.addEventListener("click", async () => {
      closeRecentFilesDialog();
      const file = new File([record.blob], record.name, {
        type: record.type || record.blob.type,
        lastModified: record.lastModified || record.openedAt
      });
      const loaded = await loadSupportedFile(file, false);
      if (loaded) {
        try {
          await updateRecentFileAccess(record.id);
          await renderRecentFiles();
        } catch (error) {
          console.error("最近使ったデータの使用日時を更新できませんでした。", error);
          alert("データは読み込みましたが、最近使った日時を更新できませんでした。\n" + error.message);
        }
      }
    });

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "recent-file-remove";
    removeButton.textContent = "削除";
    removeButton.addEventListener("click", async () => {
      try {
        await removeRecentFile(record.id);
        await renderRecentFiles();
      } catch (error) {
        console.error("最近使ったデータを削除できませんでした。", error);
        alert("データを削除できませんでした。\n" + error.message);
      }
    });

    item.append(openButton, removeButton);
    list.appendChild(item);
  });
}

async function openRecentFilesDialog() {
  const dialog = document.getElementById("recentFilesDialogOverlay");
  if (!dialog) throw new Error("最近使ったデータの画面が見つかりません。");

  try {
    await renderRecentFiles();
    dialog.style.display = "flex";
  } catch (error) {
    console.error("最近使ったデータを表示できませんでした。", error);
    alert("最近使ったデータを表示できませんでした。\n" + error.message);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const openButton = document.getElementById("openRecentFiles");
  const menuOpenButton = document.getElementById("btnOpenRecentFilesMenu");
  const cancelButton = document.getElementById("closeRecentFilesBtn");
  const clearButton = document.getElementById("clearRecentFilesBtn");

  if (openButton) openButton.addEventListener("click", openRecentFilesDialog);
  if (menuOpenButton) {
    menuOpenButton.addEventListener("click", () => {
      document.getElementById("saveMenuDropdown").classList.add("hidden");
      openRecentFilesDialog();
    });
  }
  if (cancelButton) cancelButton.addEventListener("click", closeRecentFilesDialog);
  if (clearButton) {
    clearButton.addEventListener("click", async () => {
      try {
        await clearRecentFiles();
        await renderRecentFiles();
      } catch (error) {
        console.error("最近使ったデータを削除できませんでした。", error);
        alert("最近使ったデータを削除できませんでした。\n" + error.message);
      }
    });
  }
});

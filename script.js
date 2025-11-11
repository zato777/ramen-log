// Firebase 初期化
const firebaseConfig = {
    apiKey: "AIzaSyAvsjD4dsX9g-H9Hd7bAHUIYNAGLapMTj0",
    authDomain: "ramen-log-b811d.firebaseapp.com",
    projectId: "ramen-log-b811d",
    storageBucket: "ramen-log-b811d.appspot.com",
    messagingSenderId: "715408643600",
    appId: "1:715408643600:web:24adef805672ebf0169c95",
    measurementId: "G-JHDWG2BPFJ"
  };
  
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const storage = firebase.storage();

// --- グローバル変数 ---
let currentUser = localStorage.getItem('currentUser') || null;
let editIndex = -1; // 編集対象のインデックス
let userRamenList = []; // ★ 現在のユーザーのラーメン記録のみを保持
let lastDeleted = null;
let sortOrder = 'desc'; // ★ ソート順（'desc' または 'asc'）

// --- イベントリスナー ---
window.addEventListener('DOMContentLoaded', () => {
  if (currentUser) {
    document.querySelector(".login").style.display = "none";
    document.getElementById("app").style.display = "block";
    loadRamenList(); // ログイン中のユーザーのデータを読み込む
  }
  updateCurrentUserDisplay();
  
  document.getElementById("ramenForm").addEventListener("submit", handleFormSubmit);
  document.getElementById("searchInput").addEventListener("input", applyFiltersAndSort);
  document.getElementById("sortSelect").addEventListener("change", applyFiltersAndSort);
  
  addMenuItem(); // ページ読み込み時に最初のメニュー項目を追加
});

// --- 認証関連 ---
function login() {
  const username = document.getElementById("username").value.trim();
  if (!username) return alert("ユーザー名を入力してください");

  currentUser = username;
  localStorage.setItem('currentUser', currentUser);

  document.querySelector(".login").style.display = "none";
  document.getElementById("app").style.display = "block";
  loadRamenList();
  updateCurrentUserDisplay();
}

function logout() {
  currentUser = null;
  localStorage.removeItem('currentUser');
  userRamenList = []; // ユーザーデータをクリア
  
  document.getElementById("app").style.display = "none";
  document.querySelector(".login").style.display = "block";
  document.getElementById("username").value = "";
  
  resetForm();
  updateCurrentUserDisplay();
  renderRamenList([]); // 表示をクリア
}

function updateCurrentUserDisplay() {
  document.getElementById("currentUserDisplay").textContent = currentUser || "未ログイン";
}

async function changeUsername() {
  const newUsername = document.getElementById("newUsername").value.trim();
  if (!newUsername) return alert("新しいユーザー名を入力してください");
  if (newUsername === currentUser) return alert("現在のユーザー名と同じです");
  if (!currentUser) return;

  if (!confirm(`ユーザー名を「${currentUser}」から「${newUsername}」に変更しますか？\n（注意：現在の記録が新しい名前に引き継がれます）`)) {
    return;
  }
  try {
    const oldUserRef = db.collection("ramenLogs").doc(currentUser);
    const doc = await oldUserRef.get();
    if (doc.exists) {
      const data = doc.data();
      await db.collection("ramenLogs").doc(newUsername).set(data);
      await oldUserRef.delete();
    }
    currentUser = newUsername;
    localStorage.setItem('currentUser', currentUser);
    updateCurrentUserDisplay();
    loadRamenList();
    document.getElementById("newUsername").value = "";
    alert("ユーザー名を変更しました。");
  } catch (error) {
    console.error("ユーザー名変更エラー:", error);
    alert("ユーザー名の変更に失敗しました。");
  }
}

async function deleteAccount() {
  if (!currentUser) return;
  if (confirm("本当にこのアカウントと全ての記録を削除しますか？\nこの操作は取り消せません。")) {
    try {
      await db.collection("ramenLogs").doc(currentUser).delete();
      alert("アカウントを削除しました。");
      logout();
    } catch (error) {
      console.error("アカウント削除エラー:", error);
      alert("アカウントの削除に失敗しました。");
    }
  }
}

// --- データ読み込み (★修正点①：ログインユーザー専用) ---
async function loadRamenList() {
  if (!currentUser) return;

  const userRef = db.collection("ramenLogs").doc(currentUser);
  const doc = await userRef.get();

  if (doc.exists) {
    // 取得したリストをグローバル変数に保存
    userRamenList = doc.data().list || [];
  } else {
    // ユーザーが初めてログインした場合
    userRamenList = [];
  }
  applyFiltersAndSort(); // フィルターとソートを適用して描画
}

// --- データ描画 (★修正点①：シンプル化) ---
// 【差し替え】この関数を丸ごと置き換えてください
function renderRamenList(list) {
  const container = document.getElementById("ramenList");
  container.innerHTML = "";
  if (list.length === 0) {
    container.innerHTML = "<p>記録はまだありません。</p>";
    return;
  }

  list.forEach((ramen) => {
    const originalIndex = userRamenList.findIndex(
      item => item.shopName === ramen.shopName && item.date === ramen.date && item.memo === ramen.memo
    );
    
    const totalPrice = calculateTotal(ramen.menuItems);
    
    const updatedAt = (ramen.updatedAt && ramen.updatedAt.toDate) 
      ? new Date(ramen.updatedAt.toDate()).toLocaleString('ja-JP') 
      : "N/A";

    // ★ 修正点 (画像クリックで「変なページ」に行く問題)
    // onclickをやめ、画像をリンク(<a>)で囲む
    const photoHTML = ramen.photo
      ? `<a href="${ramen.photo}" target="_blank" title="画像を新しいタブで開く">
           <img src="${ramen.photo}" alt="${escapeHTML(ramen.shopName)}の写真" style="max-width: 100%; max-height: 200px; object-fit: cover; border-radius: 8px; margin-top: 10px; cursor: pointer;">
         </a>`
      : ""; // 写真がない場合は何も表示しない

    container.innerHTML += `
      <div class="card">
        <h3>${escapeHTML(ramen.shopName)}</h3>
        <p><strong>日付:</strong> ${ramen.date}</p>
        <p><strong>種類:</strong> ${escapeHTML(ramen.type) || '未入力'}</p>
        <p><strong>評価:</strong> ${'★'.repeat(ramen.rating || 0)}${'☆'.repeat(5 - (ramen.rating || 0))} (${ramen.rating || 'N/A'})</p>
        <p><strong>メモ:</strong> ${escapeHTML(ramen.memo) || 'なし'}</p>
        
        ${ramen.menuItems && ramen.menuItems.length > 0 ? 
          `<strong>メニュー:</strong><ul>${ramen.menuItems.map(item => 
            `<li>${escapeHTML(item.name)}：${Number(item.price) || 0}円</li>`
          ).join('')}</ul>` 
        : ''}
        
        ${photoHTML} 

        <p class="timestamp">更新日時: ${updatedAt}</p>
        
        <div class="card-footer">
          <p><strong>合計金額:</strong> ${totalPrice}円</p>
          <div class="card-actions">
            <button onclick="editRamen(${originalIndex})">編集</button>
            <button onclick="deleteRamen(${originalIndex})">削除</button>
          </div>
        </div>
      </div>
    `;
  });
}

// --- フォーム送信 (★修正点③：写真の保持) ---
// 【差し替え】この関数を丸ごと置き換えてください
async function handleFormSubmit(e) {
  e.preventDefault();
  const shopName = document.getElementById("shopName").value;
  if (!shopName) return alert("店名を入力してください");

  const submitButton = document.querySelector("#ramenForm button[type='submit']");
  submitButton.disabled = true;
  submitButton.textContent = "送信中...";

  try {
    const menuItems = [];
    let menuInputError = false; // メニュー入力エラーのフラグ

    document.querySelectorAll(".menu-item").forEach(item => {
      const name = item.querySelector(".menu-name").value.trim();
      const priceStr = item.querySelector(".menu-price").value;
      
      if (!name && !priceStr) {
        return;
      }

      const price = parseInt(priceStr);

      if (name && !isNaN(price) && price >= 0) {
        menuItems.push({ name, price });
      } else {
        menuInputError = true;
      }
    });

    if (menuInputError) {
      throw new Error("メニュー名と値段（半角数字）を正しくペアで入力してください。");
    }

    const photoFile = document.getElementById("photo").files[0];
    let photoURL = "";

    if (editIndex !== -1 && userRamenList[editIndex] && userRamenList[editIndex].photo) {
      photoURL = userRamenList[editIndex].photo;
    }

    if (photoFile) {
      photoURL = await uploadPhoto(photoFile);
    }
    
    const ramenData = {
      shopName,
      date: document.getElementById("date").value,
      type: document.getElementById("type").value,
      rating: document.getElementById("rating").value,
      memo: document.getElementById("memo").value,
      menuItems,
      photo: photoURL,
      // ★★★ ここが修正点です ★★★
      // serverTimestamp() の代わりに、クライアントの現在時刻 new Date() を使います
      updatedAt: new Date() 
    };

    if (editIndex === -1) {
      userRamenList.push(ramenData);
    } else {
      userRamenList[editIndex] = ramenData;
    }

    const userRef = db.collection("ramenLogs").doc(currentUser);
    await userRef.set({ list: userRamenList });

    alert(editIndex === -1 ? "記録しました！" : "更新しました！");
    resetForm();
    applyFiltersAndSort();

  } catch (error) {
    console.error("Error saving ramen log:", error);
    alert("エラー： " + error.message || "記録に失敗しました。");
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = (editIndex === -1) ? "記録する" : "更新する";
  }
}

// --- フィルター & ソート (★修正点②：昇順/降順) ---
function applyFiltersAndSort() {
  let filteredList = [...userRamenList]; // ログイン中のユーザーのリストをコピー
  const searchTerm = document.getElementById("searchInput").value.toLowerCase();
  const sortValue = document.getElementById("sortSelect").value;

  if (searchTerm) {
    filteredList = filteredList.filter(r => 
      r.shopName.toLowerCase().includes(searchTerm) ||
      (r.type && r.type.toLowerCase().includes(searchTerm)) ||
      (r.memo && r.memo.toLowerCase().includes(searchTerm))
    );
  }

  // ソート関数を決定
  let sortFn;
  switch (sortValue) {
    case "rating":
      sortFn = (a, b) => (a.rating || 0) - (b.rating || 0);
      break;
    case "price":
      sortFn = (a, b) => calculateTotal(a.menuItems) - calculateTotal(b.menuItems);
      break;
    case "date":
    default:
      sortFn = (a, b) => new Date(a.date) - new Date(b.date);
      break;
  }

  // ソートを実行
  filteredList.sort(sortFn);

  // ★ 昇順(asc)でなければ（＝降順(desc)なら）配列を反転
  if (sortOrder === 'desc') {
    filteredList.reverse();
  }
  
  renderRamenList(filteredList);
}

// ★修正点②：ソート順を切り替える関数
function toggleSortOrder() {
  sortOrder = (sortOrder === 'desc') ? 'asc' : 'desc';
  document.getElementById('sortOrderToggle').textContent = (sortOrder === 'desc') ? '降順' : '昇順';
  applyFiltersAndSort(); // ソート順を再適用
}


// --- CRUD操作 (★修正点①：引数からuserを削除) ---

function editRamen(index) {
  const ramen = userRamenList[index];
  if (!ramen) return;

  document.getElementById("shopName").value = ramen.shopName;
  document.getElementById("date").value = ramen.date;
  document.getElementById("type").value = ramen.type;
  document.getElementById("rating").value = ramen.rating;
  document.getElementById("memo").value = ramen.memo;

  const menuList = document.getElementById("menuList");
  menuList.innerHTML = '';
  if (ramen.menuItems && ramen.menuItems.length > 0) {
    ramen.menuItems.forEach(item => addMenuItem(item.name, item.price));
  } else {
    addMenuItem();
  }
  updateTotalPrice();
  
  // ★修正点③：既存の写真をプレビュー表示
  const preview = document.getElementById("photoPreview");
  if (ramen.photo) {
    preview.innerHTML = `<p>現在の写真 (変更しない場合はこのまま):</p><img src="${ramen.photo}" style="max-height: 100px; max-width: 100px; border-radius: 4px;">`;
  } else {
    preview.innerHTML = "";
  }
  document.getElementById("photo").value = "";

  editIndex = index; // 編集対象としてインデックスをセット
  document.querySelector("#ramenForm button[type='submit']").textContent = "更新する";
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function deleteRamen(index) {
  const deletedItem = userRamenList[index];
  if (!deletedItem) return;

  if (confirm(`「${deletedItem.shopName}」の記録を削除しますか？`)) {
    lastDeleted = { ...deletedItem, originalIndex: index }; // 削除取り消し用に保存
    userRamenList.splice(index, 1); // グローバル変数から削除

    // DBに反映
    const userRef = db.collection("ramenLogs").doc(currentUser);
    await userRef.set({ list: userRamenList });
    
    applyFiltersAndSort(); // 再描画
    showUndo();
  }
}

function showUndo() {
  let undoBox = document.getElementById("undoBox");
  if(undoBox) undoBox.remove();
  undoBox = document.createElement("div");
  // ... (showUndoのスタイル設定は省略 - 前回のコードと同じ)
  undoBox.id = "undoBox";
  undoBox.style.position = "fixed";
  undoBox.style.bottom = "20px";
  undoBox.style.left = "50%";
  undoBox.style.transform = "translateX(-50%)";
  undoBox.style.backgroundColor = "#2c3e50";
  undoBox.style.color = "white";
  undoBox.style.padding = "15px 25px";
  undoBox.style.borderRadius = "8px";
  undoBox.style.boxShadow = "0 4px 15px rgba(0,0,0,0.2)";
  undoBox.style.zIndex = "1000";
  undoBox.innerHTML = `削除を取り消す <button id="undoBtn" style="background-color: #3498db; color: white; border: none; padding: 5px 10px; margin-left: 10px; cursor: pointer;">復元</button>`;
  document.body.appendChild(undoBox);
  document.getElementById("undoBtn").onclick = undoDelete;

  setTimeout(() => {
    if (document.getElementById("undoBox")) {
      document.body.removeChild(undoBox);
    }
  }, 5000);
}

async function undoDelete() {
  if (!lastDeleted) return;

  // 元の位置に復元
  userRamenList.splice(lastDeleted.originalIndex, 0, lastDeleted);
  
  // DBに反映
  const userRef = db.collection("ramenLogs").doc(currentUser);
  await userRef.set({ list: userRamenList });

  alert("復元しました。");
  applyFiltersAndSort(); // 再描画
  lastDeleted = null;

  let undoBox = document.getElementById("undoBox");
  if(undoBox) undoBox.remove();
}


// --- ヘルパー関数 ---
function resetForm() {
  document.getElementById("ramenForm").reset();
  document.getElementById("menuList").innerHTML = '';
  document.getElementById("photoPreview").innerHTML = ''; // ★プレビューもリセット
  addMenuItem();
  updateTotalPrice();
  document.querySelector("#ramenForm button[type='submit']").textContent = "記録する";
  editIndex = -1; // 編集モードを解除
}

function addMenuItem(name = '', price = '') {
  const menuList = document.getElementById("menuList");
  const div = document.createElement("div");
  div.className = "menu-item";
  div.innerHTML = `
    <input type="text" class="menu-name" placeholder="メニュー名" value="${escapeHTML(name)}">
    <input type="number" class="menu-price" placeholder="値段（円）" value="${price}" oninput="updateTotalPrice()">
    <button type="button" class="remove-btn" onclick="this.parentNode.remove(); updateTotalPrice()">×</button>
  `;
  menuList.appendChild(div);
}

function updateTotalPrice() {
  const prices = document.querySelectorAll(".menu-price");
  let total = 0;
  prices.forEach(input => {
    total += Number(input.value) || 0;
  });
  document.getElementById("totalPrice").textContent = total;
}

function calculateTotal(menuItems) {
  if (!menuItems) return 0;
  return menuItems.reduce((sum, item) => sum + (Number(item.price) || 0), 0);
}

async function uploadPhoto(file) {
  if (!currentUser) throw new Error("User not logged in");
  const filePath = `ramen_photos/${currentUser}/${Date.now()}_${file.name}`;
  const fileRef = storage.ref(filePath);
  await fileRef.put(file);
  const url = await fileRef.getDownloadURL();
  return url;
}

function escapeHTML(str) {
  if (!str) return '';
  return String(str).replace(/[&<>"']/g, function(match) {
    return {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[match];
  });
}

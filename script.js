// Firebase 初期化
const firebaseConfig = {
    apiKey: "AIzaSyAvsjD4dsX9g-H9Hd7bAHUIYNAGLapMTj0",
    authDomain: "ramen-log-b811d.firebaseapp.com",
    projectId: "ramen-log-b811d",
    storageBucket: "ramen-log-b811d.appspot.com", // Corrected for Storage
    messagingSenderId: "715408643600",
    appId: "1:715408643600:web:24adef805672ebf0169c95",
    measurementId: "G-JHDWG2BPFJ"
  };
  
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const storage = firebase.storage(); // Firebase Storageの初期化

// --- グローバル変数 ---
let currentUser = localStorage.getItem('currentUser') || null;
let editData = { user: null, index: -1 }; // 編集対象のデータを保持
let allRamenList = []; // 全員のラーメン記録
let lastDeleted = null; // 最後に削除されたアイテム

// --- イベントリスナー ---

// ページ読み込み完了時
window.addEventListener('DOMContentLoaded', () => {
  if (currentUser) {
    document.querySelector(".login").style.display = "none";
    document.getElementById("app").style.display = "block";
    loadRamenList();
  }
  updateCurrentUserDisplay();
});

// フォーム送信時（記録・更新）
document.getElementById("ramenForm").addEventListener("submit", async (e) => {
  e.preventDefault(); // デフォルトの送信をキャンセル

  const shopName = document.getElementById("shopName").value;
  if (!shopName) return alert("店名を入力してください");

  const submitButton = document.querySelector("#ramenForm button[type='submit']");
  submitButton.disabled = true;
  submitButton.textContent = "送信中...";

  try {
    // メニューアイテムの取得
    const menuItems = [];
    document.querySelectorAll(".menu-item").forEach(item => {
      const name = item.querySelector(".menu-name").value;
      const price = item.querySelector(".menu-price").value;
      if (name && price) {
        menuItems.push({ name, price: parseInt(price) });
      }
    });

    // 写真のアップロード処理
    const photoFile = document.getElementById("photo").files[0];
    let photoURL = editData.index !== -1 
      ? (allRamenList.find(r => r.user === editData.user && r.index === editData.index)?.photo || "") 
      : "";

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
      updatedAt: firebase.firestore.FieldValue.serverTimestamp() // 更新日時
    };

    const userRef = db.collection("ramenLogs").doc(currentUser);
    const doc = await userRef.get();
    let ramenList = doc.exists ? doc.data().list : [];

    if (editData.index === -1) { // 新規作成
      ramenList.push(ramenData);
    } else { // 更新
      ramenList[editData.index] = ramenData;
    }

    await userRef.set({ list: ramenList }, { merge: true });

    alert(editData.index === -1 ? "記録しました！" : "更新しました！");
    resetForm();
    loadRamenList();

  } catch (error) {
    console.error("Error saving ramen log:", error);
    alert("エラーが発生しました。記録に失敗しました。");
  } finally {
    submitButton.disabled = false;
  }
});

// 検索入力時
document.getElementById("searchInput").addEventListener("input", applyFiltersAndSort);
// ソート順変更時
document.getElementById("sortSelect").addEventListener("change", applyFiltersAndSort);


// --- 認証関連の関数 ---

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

  document.getElementById("app").style.display = "none";
  document.querySelector(".login").style.display = "block";
  document.getElementById("username").value = "";
  
  resetForm();
  updateCurrentUserDisplay();
}

function updateCurrentUserDisplay() {
  document.getElementById("currentUserDisplay").textContent = currentUser || "未ログイン";
}

// --- データ操作関連の関数 ---

function loadRamenList() {
  db.collection("ramenLogs").get().then((querySnapshot) => {
    allRamenList = [];
    querySnapshot.forEach((doc) => {
      const user = doc.id;
      const list = doc.data().list || [];
      list.forEach((ramen, index) => {
        allRamenList.push({ ...ramen, user, index }); // 元のindexとuserをデータに含める
      });
    });
    applyFiltersAndSort();
  });
}

function renderRamenList(list) {
  const container = document.getElementById("ramenList");
  container.innerHTML = "";
  if (list.length === 0) {
    container.innerHTML = "<p>記録はまだありません。</p>";
    return;
  }
  list.forEach((ramen) => {
    const totalPrice = calculateTotal(ramen.menuItems);
    const isOwner = (ramen.user === currentUser);
    const updatedAt = ramen.updatedAt ? new Date(ramen.updatedAt.toDate()).toLocaleString('ja-JP') : "N/A";

    container.innerHTML += `
      <div class="card">
        <h3>${ramen.shopName}</h3>
        <p><strong>記録者:</strong> ${ramen.user}</p>
        <p><strong>日付:</strong> ${ramen.date}</p>
        <p><strong>種類:</strong> ${ramen.type || '未入力'}</p>
        <p><strong>評価:</strong> ${'★'.repeat(ramen.rating)}${'☆'.repeat(5 - ramen.rating)} (${ramen.rating || 'N/A'})</p>
        <p><strong>メモ:</strong> ${ramen.memo || 'なし'}</p>
        ${ramen.menuItems && ramen.menuItems.length > 0 ? `<strong>メニュー:</strong><ul>${ramen.menuItems.map(item => `<li>${item.name}：${item.price}円</li>`).join('')}</ul>` : ''}
        ${ramen.photo ? `<img src="${ramen.photo}" alt="${ramen.shopName}の写真" style="cursor:pointer;" onclick="window.open('${ramen.photo}', '_blank')">` : ""}
        <p class="timestamp">更新日時: ${updatedAt}</p>
        <div class="card-footer">
          <p><strong>合計金額:</strong> ${totalPrice}円</p>
          <div class="card-actions">
          ${isOwner ? `
            <button onclick="editRamen('${ramen.user}', ${ramen.index})">編集</button>
            <button onclick="deleteRamen('${ramen.user}', ${ramen.index})">削除</button>
          ` : ""}
          </div>
        </div>
      </div>
    `;
  });
}

function applyFiltersAndSort() {
  let filteredList = [...allRamenList];
  const searchTerm = document.getElementById("searchInput").value.toLowerCase();
  const sortValue = document.getElementById("sortSelect").value;

  // フィルター
  if (searchTerm) {
    filteredList = filteredList.filter(r => 
      r.shopName.toLowerCase().includes(searchTerm) ||
      (r.type && r.type.toLowerCase().includes(searchTerm)) ||
      (r.memo && r.memo.toLowerCase().includes(searchTerm))
    );
  }

  // ソート
  switch (sortValue) {
    case "date":
      filteredList.sort((a, b) => new Date(b.date) - new Date(a.date));
      break;
    case "rating":
      filteredList.sort((a, b) => (b.rating || 0) - (a.rating || 0));
      break;
    case "price":
      filteredList.sort((a, b) => calculateTotal(b.menuItems) - calculateTotal(a.menuItems));
      break;
  }
  
  renderRamenList(filteredList);
}


// --- CRUD操作 ---

function editRamen(user, index) {
  if (user !== currentUser) return; // 自分の記録以外は編集不可

  const ramen = allRamenList.find(r => r.user === user && r.index === index);
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
    addMenuItem(); //メニューがなければ空の項目を追加
  }
  
  updateTotalPrice();

  editData = { user, index }; // 編集対象としてセット
  document.querySelector("#ramenForm button[type='submit']").textContent = "更新する";
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function deleteRamen(user, index) {
  if (user !== currentUser) return; // 自分の記録以外は削除不可
  
  const ramenRef = db.collection("ramenLogs").doc(user);
  const doc = await ramenRef.get();

  if (doc.exists) {
    const ramenList = doc.data().list;
    const deletedItem = { ...ramenList[index], user, originalIndex: index };

    if (confirm(`「${deletedItem.shopName}」の記録を削除しますか？`)) {
      lastDeleted = deletedItem; // 削除取り消し用に保存
      ramenList.splice(index, 1);
      await ramenRef.set({ list: ramenList });
      loadRamenList();
      showUndo();
    }
  }
}

function showUndo() {
    let undoBox = document.getElementById("undoBox");
    if(undoBox) undoBox.remove();

    undoBox = document.createElement("div");
    undoBox.id = "undoBox";
    undoBox.innerHTML = `削除を取り消す <button onclick="undoDelete()">復元</button>`;
    document.body.appendChild(undoBox);

    setTimeout(() => {
      if (document.getElementById("undoBox")) {
        document.body.removeChild(undoBox);
      }
    }, 5000);
}

async function undoDelete() {
    if (!lastDeleted) return;

    const userRef = db.collection("ramenLogs").doc(lastDeleted.user);
    const doc = await userRef.get();
    const ramenList = doc.exists ? doc.data().list : [];
    
    // 元の位置に復元
    ramenList.splice(lastDeleted.originalIndex, 0, lastDeleted);

    await userRef.set({ list: ramenList });
    
    alert("復元しました。");
    loadRamenList();
    lastDeleted = null;

    let undoBox = document.getElementById("undoBox");
    if(undoBox) undoBox.remove();
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

// --- ヘルパー関数 ---

function resetForm() {
  document.getElementById("ramenForm").reset();
  document.getElementById("menuList").innerHTML = '';
  addMenuItem(); // 空のメニュー項目を1つ追加
  updateTotalPrice();
  document.querySelector("#ramenForm button[type='submit']").textContent = "記録する";
  editData = { user: null, index: -1 }; // 編集モードを解除
}

function addMenuItem(name = '', price = '') {
  const menuList = document.getElementById("menuList");
  const div = document.createElement("div");
  div.className = "menu-item";
  div.innerHTML = `
    <input type="text" class="menu-name" placeholder="メニュー名" value="${name}">
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

// Firebase Storageへ写真をアップロードする関数
async function uploadPhoto(file) {
  if (!currentUser) throw new Error("User not logged in");
  const filePath = `ramen_photos/${currentUser}/${Date.now()}_${file.name}`;
  const fileRef = storage.ref(filePath);
  await fileRef.put(file);
  const url = await fileRef.getDownloadURL();
  return url;
}

// ページ読み込み時に最初のメニュー項目を追加
addMenuItem();

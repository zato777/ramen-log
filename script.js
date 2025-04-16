const firebaseConfig = {
  apiKey: "AIzaSyAvsjD4dsX9g-H9Hd7bAHUIYNAGLapMTj0",
  authDomain: "ramen-log-b811d.firebaseapp.com",
  projectId: "ramen-log-b811d",
  storageBucket: "ramen-log-b811d.firebasestorage.app",
  messagingSenderId: "715408643600",
  appId: "1:715408643600:web:24adef805672ebf0169c95",
  measurementId: "G-JHDWG2BPFJ"
};

// Firebase 初期化
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

let currentUser = localStorage.getItem('currentUser') || null;
let editIndex = -1;

// ログイン処理
function login() {
  const username = document.getElementById("username").value.trim();
  if (!username) return alert("ユーザー名を入力してください");

  // ログインユーザーをlocalStorageに保存
  localStorage.setItem('currentUser', username);

  currentUser = username;
  document.getElementById("app").style.display = "block";
  loadRamenList();  // ラーメンリストを読み込む
}

// ログアウト処理
function logout() {
  localStorage.removeItem('currentUser');  // ログアウト時にユーザー名を削除
  currentUser = null;
  document.getElementById("app").style.display = "none";
  document.getElementById("ramenList").innerHTML = "";
  document.getElementById("username").value = "";
}

// ラーメンリストをリアルタイムで読み込む処理（onSnapshot使用）
function loadRamenList() {
  if (!currentUser) {
    return;  // ユーザーがログインしていない場合は何もしない
  }

  const ramenRef = db.collection("ramenLogs").doc(currentUser);

  ramenRef.onSnapshot((doc) => {
    const container = document.getElementById("ramenList");
    container.innerHTML = "";  // 既存のリストをクリア

    if (doc.exists) {
      const list = doc.data().list || [];  // リストが存在しない場合は空配列

      list.forEach((ramen, index) => {
        container.innerHTML += `
          <div class="card">
            <h3>${ramen.shopName}</h3>
            <p>日付: ${ramen.date}</p>
            <p>種類: ${ramen.type}</p>
            <p>評価: ${ramen.rating}</p>
            <p>メモ: ${ramen.memo}</p>
            ${ramen.photo ? `<img src="${ramen.photo}" alt="写真">` : ""}
            <div style="margin-top: 10px;">
              <button onclick="editRamen(${index})">編集</button>
              <button onclick="deleteRamen(${index})">削除</button>
            </div>
          </div>
        `;
      });
    }
  });
}

// 編集処理
function editRamen(index) {
  const ramenRef = db.collection("ramenLogs").doc(currentUser);

  ramenRef.get().then((doc) => {
    if (doc.exists) {
      const ramenList = doc.data().list;
      const ramen = ramenList[index];

      document.getElementById("shopName").value = ramen.shopName;
      document.getElementById("date").value = ramen.date;
      document.getElementById("type").value = ramen.type;
      document.getElementById("rating").value = ramen.rating;
      document.getElementById("memo").value = ramen.memo;

      editIndex = index;
      document.querySelector("#ramenForm button").textContent = "更新する";
    }
  });
}

// 削除処理
function deleteRamen(index) {
  if (!confirm("本当に削除しますか？")) return;

  const ramenRef = db.collection("ramenLogs").doc(currentUser);

  ramenRef.get().then((doc) => {
    if (doc.exists) {
      let ramenList = doc.data().list;
      ramenList.splice(index, 1);  // リストから削除

      ramenRef.set({ list: ramenList }).then(() => {
        loadRamenList();  // リストを再読み込み
      });
    }
  });
}
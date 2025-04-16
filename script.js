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

let currentUser = null;
let editIndex = -1;

// ログイン処理
function login() {
  const username = document.getElementById("username").value.trim();
  if (!username) return alert("ユーザー名を入力してください");
  currentUser = username;
  document.getElementById("app").style.display = "block";
  loadRamenList();  // ラーメンリストを読み込む
}

// ログアウト処理
function logout() {
  currentUser = null;
  document.getElementById("app").style.display = "none";
  document.getElementById("ramenList").innerHTML = "";
  document.getElementById("username").value = "";
}

// 登録処理
document.getElementById("ramenForm").addEventListener("submit", function(e) {
  e.preventDefault();

  const reader = new FileReader();
  const file = document.getElementById("photo").files[0];

  reader.onload = function(event) {
    const ramen = {
      shopName: document.getElementById("shopName").value,
      date: document.getElementById("date").value,
      type: document.getElementById("type").value,
      rating: document.getElementById("rating").value,
      memo: document.getElementById("memo").value,
      photo: event.target.result || null
    };

    const ramenRef = db.collection("ramenLogs").doc(currentUser);  // ユーザーごとにドキュメントを作成

    ramenRef.get().then((doc) => {
      let ramenList = doc.exists ? doc.data().list : [];

      if (editIndex >= 0) {
        // 編集中なら上書き
        if (!ramen.photo) {
          ramen.photo = ramenList[editIndex].photo;  // 画像変更しなかったら前のまま
        }
        ramenList[editIndex] = ramen;
        editIndex = -1;
        document.querySelector("#ramenForm button").textContent = "記録する";
      } else {
        // 新規追加
        ramenList.push(ramen);
      }

      ramenRef.set({ list: ramenList }).then(() => {
        loadRamenList();  // リストを再読み込み
        e.target.reset();  // フォームをリセット
      });
    });
  };

  if (file) {
    reader.readAsDataURL(file);  // ファイルがあれば画像を読み込む
  } else {
    reader.onload({ target: { result: null } });
  }
});

// ラーメンリストを読み込む処理
function loadRamenList() {
  const ramenRef = db.collection("ramenLogs").doc(currentUser);

  ramenRef.get().then((doc) => {
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
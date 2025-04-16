const firebaseConfig = {
  apiKey: "AIzaSyAvsjD4dsX9g-H9Hd7bAHUIYNAGLapMTj0",
  authDomain: "ramen-log-b811d.firebaseapp.com",
  projectId: "ramen-log-b811d",
  storageBucket: "ramen-log-b811d.firebasestorage.app",
  messagingSenderId: "715408643600",
  appId: "1:715408643600:web:24adef805672ebf0169c95",
  measurementId: "G-JHDWG2BPFJ"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

let currentUser = localStorage.getItem('currentUser') || null;
let editIndex = -1;

// ページ読み込み時にログイン状態を復元
window.addEventListener('DOMContentLoaded', () => {
  if (currentUser) {
    document.querySelector(".login").style.display = "none";
    document.getElementById("app").style.display = "block";
    loadRamenList();
  }
  updateCurrentUserDisplay();  // ユーザー名表示を更新
});

// ログイン処理
function login() {
  const username = document.getElementById("username").value.trim();
  if (!username) return alert("ユーザー名を入力してください");

  currentUser = username;
  localStorage.setItem('currentUser', currentUser);

  document.querySelector(".login").style.display = "none";
  document.getElementById("app").style.display = "block";

  loadRamenList();
  updateCurrentUserDisplay();  // ユーザー名表示を更新
}

// ログアウト処理
function logout() {
  currentUser = null;
  localStorage.removeItem('currentUser');

  document.getElementById("app").style.display = "none";
  document.querySelector(".login").style.display = "block";
  document.getElementById("ramenList").innerHTML = "";
  document.getElementById("username").value = "";

  updateCurrentUserDisplay();  // ユーザー名表示を更新
}

// 登録処理
// ファイル読み込み＆縮小してから保存
document.getElementById("ramenForm").addEventListener("submit", function(e) {
  e.preventDefault();

  const file = document.getElementById("photo").files[0];

  if (file) {
    const reader = new FileReader();
    reader.onload = function(event) {
      const img = new Image();
      img.onload = function() {
        const canvas = document.createElement("canvas");

        const maxSize = 800;  // 最大幅または高さ（必要に応じて調整）
        let width = img.width;
        let height = img.height;

        // サイズを調整（比率を保ったまま）
        if (width > height) {
          if (width > maxSize) {
            height *= maxSize / width;
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width *= maxSize / height;
            height = maxSize;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);

        const base64 = canvas.toDataURL("image/jpeg", 0.7);  // 画質調整（0.0〜1.0）

        saveRamen(base64);  // 画像付きで保存
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  } else {
    saveRamen(null);  // 画像なしで保存
  }
});


// ラーメンリストの読み込み
function loadRamenList() {
  const container = document.getElementById("ramenList");
  container.innerHTML = "";

  if (!currentUser) return;

  const ramenRef = db.collection("ramenLogs").doc(currentUser);
  ramenRef.get().then((doc) => {
    if (doc.exists) {
      const list = doc.data().list || [];

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
      ramenList.splice(index, 1);

      ramenRef.set({ list: ramenList }).then(() => {
        loadRamenList();
      });
    }
  });
}

//ユーザー表示更新関数を追加
function updateCurrentUserDisplay() {
  document.getElementById("currentUserDisplay").textContent = currentUser || "";
}

function changeUsername() {
  const newUsername = document.getElementById("newUsername").value.trim();
  if (!newUsername) return alert("新しいユーザー名を入力してください");
  if (newUsername === currentUser) return alert("同じ名前です");

  const oldRef = db.collection("ramenLogs").doc(currentUser);
  const newRef = db.collection("ramenLogs").doc(newUsername);

  // まず、新しいユーザー名がすでに使われていないか確認
  newRef.get().then((newDoc) => {
    if (newDoc.exists) {
      alert("そのユーザー名はすでに使われています");
      return;
    }

    // 新しい名前が空いている → データ移行開始
    oldRef.get().then(doc => {
      if (doc.exists) {
        const data = doc.data();
        newRef.set(data).then(() => {
          oldRef.delete().then(() => {
            currentUser = newUsername;
            localStorage.setItem("currentUser", currentUser);
            updateCurrentUserDisplay();
            document.getElementById("newUsername").value = "";
            loadRamenList();
            alert("ユーザー名を変更しました");
          });
        });
      } else {
        alert("元のデータが見つかりませんでした");
      }
    });
  });
}

function saveRamen(photoDataUrl) {
  const ramen = {
    shopName: document.getElementById("shopName").value,
    date: document.getElementById("date").value,
    type: document.getElementById("type").value,
    rating: document.getElementById("rating").value,
    memo: document.getElementById("memo").value,
    photo: photoDataUrl
  };

  const ramenRef = db.collection("ramenLogs").doc(currentUser);

  ramenRef.get().then((doc) => {
    let ramenList = doc.exists ? doc.data().list : [];

    if (editIndex >= 0) {
      if (!ramen.photo) {
        ramen.photo = ramenList[editIndex].photo;
      }
      ramenList[editIndex] = ramen;
      editIndex = -1;
      document.querySelector("#ramenForm button").textContent = "記録する";
    } else {
      ramenList.push(ramen);
    }

    ramenRef.set({ list: ramenList }).then(() => {
      loadRamenList();
      document.getElementById("ramenForm").reset();
    });
  });
}

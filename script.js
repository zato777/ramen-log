let currentUser = null;

function login() {
  const username = document.getElementById("username").value.trim();
  if (!username) return alert("ユーザー名を入力してください");
  currentUser = username;
  document.getElementById("app").style.display = "block";
  loadRamenList();
}

function logout() {
  currentUser = null;
  document.getElementById("app").style.display = "none";
  document.getElementById("ramenList").innerHTML = "";
  document.getElementById("username").value = "";
}

let editIndex = -1;

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

    const key = `ramenList_${currentUser}`;
    let ramenList = JSON.parse(localStorage.getItem(key)) || [];

    if (editIndex >= 0) {
      // 編集中なら上書き
      if (!ramen.photo) {
        ramen.photo = ramenList[editIndex].photo; // 画像変更しなかったら前のまま
      }
      ramenList[editIndex] = ramen;
      editIndex = -1;
      document.querySelector("#ramenForm button").textContent = "記録する";
    } else {
      // 新規追加
      ramenList.push(ramen);
    }

    localStorage.setItem(key, JSON.stringify(ramenList));
    loadRamenList();
    e.target.reset();
  };

  if (file) {
    reader.readAsDataURL(file);
  } else {
    reader.onload({ target: { result: null } });
  }
});


function editRamen(index) {
  const key = `ramenList_${currentUser}`;
  const ramenList = JSON.parse(localStorage.getItem(key));
  const ramen = ramenList[index];

  document.getElementById("shopName").value = ramen.shopName;
  document.getElementById("date").value = ramen.date;
  document.getElementById("type").value = ramen.type;
  document.getElementById("rating").value = ramen.rating;
  document.getElementById("memo").value = ramen.memo;

  editIndex = index;
  document.querySelector("#ramenForm button").textContent = "更新する";
}


function deleteRamen(index) {
  if (!confirm("本当に削除しますか？")) return;

  const key = `ramenList_${currentUser}`;
  let ramenList = JSON.parse(localStorage.getItem(key));
  ramenList.splice(index, 1);
  localStorage.setItem(key, JSON.stringify(ramenList));
  loadRamenList();
}


function loadRamenList() {
  const key = `ramenList_${currentUser}`;
  const list = JSON.parse(localStorage.getItem(key)) || [];
  const container = document.getElementById("ramenList");
  container.innerHTML = "";

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

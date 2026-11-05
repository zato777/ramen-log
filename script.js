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
const auth = firebase.auth();
const db = firebase.firestore();

// --- グローバル変数 ---
let authUser = null;
let currentUser = null;
let currentDisplayName = "";
let registrationInProgress = false;
let editIndex = -1; // 編集対象のインデックス
let userRamenList = []; // ★ 現在のユーザーのラーメン記録のみを保持
let ramenListLoaded = false;
let lastDeleted = null;
let sortOrder = 'desc'; // ★ ソート順（'desc' または 'asc'）

// --- イベントリスナー ---
window.addEventListener('DOMContentLoaded', () => {
  auth.onAuthStateChanged(async user => {
    if (user && registrationInProgress) return;

    if (user) {
      try {
        await user.reload();
        if (user.emailVerified) await user.getIdToken(true);
      } catch (error) {
        console.error("認証状態の確認エラー:", error);
      }

      if (!user.emailVerified) {
        try {
          await user.sendEmailVerification();
          setAuthMessage("メールアドレスの確認が必要です。確認メールを再送しました。受信箱をご確認ください。");
        } catch (error) {
          console.error("確認メール送信エラー:", error);
          setAuthMessage("メールアドレスの確認が必要です。確認メールを再送できませんでした。時間をおいて再度ログインしてください。");
        }
        await auth.signOut();
        return;
      }
    }

    authUser = user;
    currentUser = user ? user.uid : null;
    currentDisplayName = user ? (user.displayName || user.email) : "";
    document.querySelector(".login").style.display = user ? "none" : "block";
    document.getElementById("app").style.display = user ? "block" : "none";
    if (user) loadRamenList();
    else {
      userRamenList = [];
      ramenListLoaded = false;
      applyFiltersAndSort();
    }
    updateCurrentUserDisplay();
  });
  updateCurrentUserDisplay();

  document.getElementById("authForm").addEventListener("submit", event => {
    event.preventDefault();
    login();
  });
  document.getElementById("personalTab").addEventListener("click", () => switchAppView("personal"));
  document.getElementById("timelineTab").addEventListener("click", () => switchAppView("timeline"));
  document.getElementById("refreshTimeline").addEventListener("click", loadTimeline);
  document.querySelectorAll(".password-reveal").forEach(button => {
    const passwordInput = document.getElementById(button.dataset.passwordTarget);
    const setVisibility = visible => {
      passwordInput.type = visible ? "text" : "password";
      button.setAttribute("aria-pressed", String(visible));
    };

    button.addEventListener("pointerdown", event => {
      event.preventDefault();
      setVisibility(true);
      button.setPointerCapture(event.pointerId);
    });
    ["pointerup", "pointercancel", "lostpointercapture", "pointerleave", "blur"].forEach(eventName => {
      button.addEventListener(eventName, () => setVisibility(false));
    });
    button.addEventListener("keydown", event => {
      if ((event.key === " " || event.key === "Enter") && !event.repeat) {
        event.preventDefault();
        setVisibility(true);
      }
    });
    button.addEventListener("keyup", event => {
      if (event.key === " " || event.key === "Enter") setVisibility(false);
    });
  });
  document.getElementById("ramenForm").addEventListener("submit", handleFormSubmit);
  document.getElementById("searchInput").addEventListener("input", applyFiltersAndSort);
  document.getElementById("sortSelect").addEventListener("change", applyFiltersAndSort);
  
  addMenuItem(); // ページ読み込み時に最初のメニュー項目を追加
});

// --- 認証関連 ---
async function login() {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  try {
    await auth.signInWithEmailAndPassword(email, password);
    setAuthMessage("");
  } catch (error) {
    console.error("ログインエラー:", error);
    setAuthMessage("ログインできませんでした。メールアドレスとパスワードを確認してください。");
  }
}

async function register() {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const passwordConfirm = document.getElementById("passwordConfirm").value;
  const displayName = document.getElementById("displayName").value.trim();
  if (!displayName) return alert("新規登録時は表示名を入力してください。");
  if (password.length < 6) return alert("パスワードは6文字以上で入力してください。");
  if (password !== passwordConfirm) return alert("パスワードが一致しません。");

  registrationInProgress = true;
  try {
    const credential = await auth.createUserWithEmailAndPassword(email, password);
    await credential.user.updateProfile({ displayName });
    await credential.user.sendEmailVerification();
    setAuthMessage(`確認メールを${email}に送りました。メール内のリンクを開いてからログインしてください。`);
    document.getElementById("password").value = "";
    document.getElementById("passwordConfirm").value = "";
  } catch (error) {
    console.error("新規登録エラー:", error);
    setAuthMessage("登録または確認メールの送信に失敗しました。入力内容とFirebase Authenticationの設定を確認してください。");
  } finally {
    registrationInProgress = false;
    if (auth.currentUser && !auth.currentUser.emailVerified) await auth.signOut();
  }
}

async function resetPassword() {
  const email = document.getElementById("email").value.trim();
  if (!email) return setAuthMessage("再設定メールを送るメールアドレスを入力してください。");

  try {
    await auth.sendPasswordResetEmail(email);
    setAuthMessage("パスワード再設定メールを送信しました。受信箱と迷惑メールをご確認ください。");
  } catch (error) {
    console.error("パスワード再設定メール送信エラー:", error);
    setAuthMessage("再設定メールを送信できませんでした。メールアドレスとFirebase Authenticationの設定を確認してください。");
  }
}

function setAuthMessage(message) {
  document.getElementById("authMessage").textContent = message;
}

async function logout() {
  try {
    await auth.signOut();
  } catch (error) {
    console.error("ログアウトエラー:", error);
    alert("ログアウトできませんでした。");
  }
}

function updateCurrentUserDisplay() {
  document.getElementById("currentUserDisplay").textContent = currentDisplayName || "未ログイン";
}

async function changeUsername() {
  const newUsername = document.getElementById("newUsername").value.trim();
  if (!newUsername) return alert("新しいユーザー名を入力してください");
  if (newUsername === currentDisplayName) return alert("現在のユーザー名と同じです");
  if (!currentUser || !authUser) return;

  if (!confirm(`表示名を「${currentDisplayName}」から「${newUsername}」に変更しますか？`)) {
    return;
  }
  try {
    const userRef = db.collection("ramenLogs").doc(currentUser);
    await authUser.updateProfile({ displayName: newUsername });
    await userRef.set({ ownerUid: currentUser, username: newUsername, list: userRamenList });
    currentDisplayName = newUsername;
    updateCurrentUserDisplay();
    loadRamenList();
    document.getElementById("newUsername").value = "";
    alert("表示名を変更しました。");
  } catch (error) {
    console.error("ユーザー名変更エラー:", error);
    alert("ユーザー名の変更に失敗しました。");
  }
}

async function deleteAccount() {
  if (!currentUser || !authUser) return;
  if (!confirm("本当にこのアカウントと全ての記録を削除しますか？\nこの操作は取り消せません。")) return;
  const password = prompt("確認のため、パスワードを入力してください。");
  if (!password) return;

  try {
    const credential = firebase.auth.EmailAuthProvider.credential(authUser.email, password);
    await authUser.reauthenticateWithCredential(credential);
    await deletePublicPostsForUser(currentUser);
    await db.collection("ramenLogs").doc(currentUser).delete();
    await authUser.delete();
    alert("アカウントを削除しました。");
  } catch (error) {
    console.error("アカウント削除エラー:", error);
    alert("アカウントの削除に失敗しました。パスワードや通信状態を確認してください。");
  }
}

async function deletePublicPostsForUser(ownerUid) {
  while (true) {
    const snapshot = await db.collection("publicRamenPosts")
      .where("ownerUid", "==", ownerUid)
      .limit(400)
      .get();
    if (snapshot.empty) return;

    const batch = db.batch();
    snapshot.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    if (snapshot.size < 400) return;
  }
}

// --- データ読み込み (★修正点①：ログインユーザー専用) ---
async function loadRamenList() {
  if (!currentUser) return;

  ramenListLoaded = false;
  try {
    const userRef = db.collection("ramenLogs").doc(currentUser);
    const doc = await userRef.get();

    if (doc.exists) {
      userRamenList = doc.data().list || [];
        currentDisplayName = doc.data().username || authUser.displayName || authUser.email || "";
    } else {
      userRamenList = [];
      await userRef.set({
        ownerUid: currentUser,
        username: authUser.displayName || authUser.email,
        list: []
      });
    }
    ramenListLoaded = true;
    updateCurrentUserDisplay();
    applyFiltersAndSort();
  } catch (error) {
    console.error("記録の読み込みエラー:", error);
    userRamenList = [];
    document.getElementById("ramenList").innerHTML =
      "<p>記録を読み込めませんでした。Firestoreのアクセス権限や接続を確認してください。既存の記録は変更していません。</p>";
  }
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

function switchAppView(view) {
  const isTimeline = view === "timeline";
  document.getElementById("personalView").hidden = isTimeline;
  document.getElementById("timelineView").hidden = !isTimeline;
  document.getElementById("personalTab").setAttribute("aria-selected", String(!isTimeline));
  document.getElementById("timelineTab").setAttribute("aria-selected", String(isTimeline));
  if (isTimeline) loadTimeline();
}

async function loadTimeline() {
  const status = document.getElementById("timelineStatus");
  status.textContent = "読み込み中...";
  try {
    const snapshot = await db.collection("publicRamenPosts")
      .orderBy("createdAt", "desc")
      .limit(50)
      .get();
    renderTimeline(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    status.textContent = snapshot.empty ? "公開投稿はまだありません。" : `最新${snapshot.size}件を表示中`;
  } catch (error) {
    console.error("タイムライン読み込みエラー:", error);
    status.textContent = "タイムラインを読み込めませんでした。接続またはFirestoreルールを確認してください。";
    document.getElementById("timelineList").innerHTML = "";
  }
}

function renderTimeline(posts) {
  const container = document.getElementById("timelineList");
  if (posts.length === 0) {
    container.innerHTML = "";
    return;
  }

  container.innerHTML = posts.map(post => {
    const ratingValue = Number(post.rating);
    const rating = Math.min(5, Math.max(0, Math.round(ratingValue) || 0));
    const ratingLabel = Number.isFinite(ratingValue) && ratingValue > 0 ? ratingValue : "未評価";
    const menuItems = Array.isArray(post.menuItems) ? post.menuItems : [];
    const menuHTML = menuItems.length
      ? `<strong>メニュー:</strong><ul>${menuItems.map(item => `<li>${escapeHTML(item.name)}：${Number(item.price) || 0}円</li>`).join("")}</ul>`
      : "";
    const photo = typeof post.photo === "string" && (post.photo.startsWith("data:image/") || post.photo.startsWith("https://"))
      ? `<a href="${escapeHTML(post.photo)}" target="_blank" rel="noopener" title="画像を新しいタブで開く"><img src="${escapeHTML(post.photo)}" alt="${escapeHTML(post.shopName)}の写真" style="max-width: 100%; max-height: 240px; object-fit: cover; border-radius: 8px; margin-top: 10px;"></a>`
      : "";
    const createdAt = post.createdAt && typeof post.createdAt.toDate === "function"
      ? post.createdAt.toDate().toLocaleString("ja-JP")
      : "";

    return `<article class="card timeline-card">
      <div class="timeline-author">${escapeHTML(post.authorName || "ユーザー")}</div>
      <h3>${escapeHTML(post.shopName)}</h3>
      <p><strong>日付:</strong> ${escapeHTML(post.date)}</p>
      <p><strong>種類:</strong> ${escapeHTML(post.type) || "未入力"}</p>
      <p><strong>評価:</strong> ${"★".repeat(rating)}${"☆".repeat(5 - rating)} (${ratingLabel})</p>
      <p><strong>メモ:</strong> ${escapeHTML(post.memo) || "なし"}</p>
      ${menuHTML}
      ${photo}
      <p class="timestamp">投稿日: ${escapeHTML(createdAt)}</p>
    </article>`;
  }).join("");
}

function createPublicPost(ramen) {
  const authorName = currentDisplayName && !currentDisplayName.includes("@")
    ? currentDisplayName
    : "ラーメン好き";
  return {
    ownerUid: currentUser,
    authorName,
    shopName: ramen.shopName,
    date: ramen.date,
    type: ramen.type,
    rating: ramen.rating,
    memo: ramen.memo,
    menuItems: ramen.menuItems,
    photo: ramen.photo,
    createdAt: ramen.updatedAt || firebase.firestore.FieldValue.serverTimestamp()
  };
}

// --- フォーム送信 (★修正点③：写真の保持) ---
// 【差し替え】この関数を丸ごと置き換えてください
async function handleFormSubmit(e) {
  e.preventDefault();
  if (!ramenListLoaded) {
    return alert("記録を読み込めていないため保存できません。Firestoreのアクセス権限や接続を確認してください。");
  }

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
      photoURL = await photoToDataURL(photoFile);
    }

    const existingRamen = editIndex !== -1 ? userRamenList[editIndex] : null;
    const shareToTimeline = document.getElementById("shareToTimeline").checked;
    const publicPostId = shareToTimeline
      ? (existingRamen && existingRamen.publicPostId) || db.collection("publicRamenPosts").doc().id
      : "";
    
    const ramenData = {
      shopName,
      date: document.getElementById("date").value,
      type: document.getElementById("type").value,
      rating: document.getElementById("rating").value,
      memo: document.getElementById("memo").value,
      menuItems,
      photo: photoURL,
      publicPostId,
      // ★★★ ここが修正点です ★★★
      // serverTimestamp() の代わりに、クライアントの現在時刻 new Date() を使います
      updatedAt: new Date() 
    };

    const nextRamenList = [...userRamenList];
    if (editIndex === -1) {
      nextRamenList.push(ramenData);
    } else {
      nextRamenList[editIndex] = ramenData;
    }

    const documentSize = new TextEncoder().encode(JSON.stringify({ list: nextRamenList })).length;
    if (documentSize > 900 * 1024) {
      throw new Error("写真を含む記録がFirestoreの保存上限に近づいています。写真を小さくするか、不要な記録を削除してください。");
    }

    const userRef = db.collection("ramenLogs").doc(currentUser);
    const batch = db.batch();
    batch.set(userRef, { ownerUid: currentUser, username: currentDisplayName, list: nextRamenList });
    if (shareToTimeline) {
      const postRef = db.collection("publicRamenPosts").doc(publicPostId);
      batch.set(postRef, createPublicPost(ramenData));
    } else if (existingRamen && existingRamen.publicPostId) {
      const postRef = db.collection("publicRamenPosts").doc(existingRamen.publicPostId);
      batch.delete(postRef);
    }
    await batch.commit();
    userRamenList = nextRamenList;

    alert(editIndex === -1 ? "記録しました！" : "更新しました！");
    resetForm();
    applyFiltersAndSort();
    if (document.getElementById("timelineView").hidden === false) loadTimeline();

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
  document.getElementById("shareToTimeline").checked = Boolean(ramen.publicPostId);
  document.getElementById("photo").value = "";

  editIndex = index; // 編集対象としてインデックスをセット
  document.querySelector("#ramenForm button[type='submit']").textContent = "更新する";
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function deleteRamen(index) {
  const deletedItem = userRamenList[index];
  if (!deletedItem) return;

  if (confirm(`「${deletedItem.shopName}」の記録を削除しますか？`)) {
    const nextRamenList = [...userRamenList];
    nextRamenList.splice(index, 1);
    try {
      const batch = db.batch();
      batch.set(db.collection("ramenLogs").doc(currentUser), {
        ownerUid: currentUser,
        username: currentDisplayName,
        list: nextRamenList
      });
      if (deletedItem.publicPostId) {
        batch.delete(db.collection("publicRamenPosts").doc(deletedItem.publicPostId));
      }
      await batch.commit();
      lastDeleted = { ...deletedItem, originalIndex: index };
      userRamenList = nextRamenList;
      applyFiltersAndSort();
      if (!document.getElementById("timelineView").hidden) loadTimeline();
      showUndo();
    } catch (error) {
      console.error("記録削除エラー:", error);
      alert("記録を削除できませんでした。");
    }
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

  const nextRamenList = [...userRamenList];
  nextRamenList.splice(lastDeleted.originalIndex, 0, lastDeleted);
  try {
    const batch = db.batch();
    batch.set(db.collection("ramenLogs").doc(currentUser), {
      ownerUid: currentUser,
      username: currentDisplayName,
      list: nextRamenList
    });
    if (lastDeleted.publicPostId) {
      batch.set(
        db.collection("publicRamenPosts").doc(lastDeleted.publicPostId),
        createPublicPost(lastDeleted)
      );
    }
    await batch.commit();
    userRamenList = nextRamenList;
    alert("復元しました。");
    applyFiltersAndSort();
    if (!document.getElementById("timelineView").hidden) loadTimeline();
    lastDeleted = null;
  } catch (error) {
    console.error("記録復元エラー:", error);
    alert("記録を復元できませんでした。");
  }

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

async function photoToDataURL(file) {
  const compressedFile = await compressPhoto(file);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("写真を読み込めませんでした。"));
    reader.readAsDataURL(compressedFile);
  });
}

async function compressPhoto(file) {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) return file;

  const imageURL = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = imageURL;
    await image.decode();

    const maxDimension = 1200;
    const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(image.width * scale);
    canvas.height = Math.round(image.height * scale);
    canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/jpeg", 0.75));
    if (!blob || blob.size >= file.size) return file;

    const filename = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], filename, { type: "image/jpeg" });
  } finally {
    URL.revokeObjectURL(imageURL);
  }
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

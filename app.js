/**
 * My To-Do List - 多人協作待辦清單主程式
 * 支援：
 * 1. Firebase v10 Modular SDK (Google Auth + Cloud Firestore)
 * 2. 免設定即時展示模式 (支援跨分頁/跨視窗 BroadcastChannel 多人即時同步)
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  addDoc, 
  getDoc, 
  getDocs, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  serverTimestamp, 
  arrayUnion, 
  arrayRemove,
  limit
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

import { 
  getActiveFirebaseConfig, 
  saveFirebaseConfig, 
  clearSavedFirebaseConfig 
} from "./firebase-config.js";

// ==================== 全域狀態 ====================
let app = null;
let auth = null;
let db = null;
let isDemoMode = false;
let currentUser = null;
let activeListId = null;
let activeListDoc = null;
let ownedLists = [];
let sharedLists = [];
let tasks = [];
let activities = [];

// 篩選與搜尋狀態
let currentFilter = "all"; // all, active, completed
let searchKeyword = "";
let filterOnlyAssignedToMe = false;

// 監聽器與廣播通道 (用於展示模式跨分頁即時同步)
let unsubscribeLists = null;
let unsubscribeTasks = null;
let unsubscribeActivities = null;
const broadcastChannel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("my_todo_collab_channel") : null;

// 展示模式使用者資料
const DEMO_USERS = {
  user1: {
    uid: "demo-user-1",
    displayName: "王小明",
    email: "wang.demo@example.com",
    photoURL: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop&crop=face",
    role: "owner"
  },
  user2: {
    uid: "demo-user-2",
    displayName: "林專案經理",
    email: "lin.pm@example.com",
    photoURL: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=face",
    role: "editor"
  },
  user3: {
    uid: "demo-user-3",
    displayName: "陳工程師",
    email: "chen.dev@example.com",
    photoURL: "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=100&h=100&fit=crop&crop=face",
    role: "editor"
  }
};

// ==================== DOM 元素快取 ====================
const el = {
  navProjectId: document.getElementById("nav-project-id"),
  syncStatusBadge: document.getElementById("sync-status-badge"),
  syncStatusText: document.getElementById("sync-status-text"),
  missingApiKeyBanner: document.getElementById("missing-api-key-banner"),
  btnBannerDemo: document.getElementById("btn-banner-demo"),
  btnFixConfigBanner: document.getElementById("btn-fix-config-banner"),
  configWarningDot: document.getElementById("config-warning-dot"),
  btnOpenConfigModal: document.getElementById("btn-open-config-modal"),
  demoUserSwitcher: document.getElementById("demo-user-switcher"),
  selectDemoUser: document.getElementById("select-demo-user"),

  // 驗證
  authLoggedOut: document.getElementById("auth-logged-out"),
  authLoggedIn: document.getElementById("auth-logged-in"),
  btnGoogleLogin: document.getElementById("btn-google-login"),
  heroBtnLogin: document.getElementById("hero-btn-login"),
  heroBtnDemo: document.getElementById("hero-btn-demo"),
  heroBtnConfig: document.getElementById("hero-btn-config"),
  btnLogout: document.getElementById("btn-logout"),
  userAvatar: document.getElementById("user-avatar"),
  userName: document.getElementById("user-name"),
  userEmail: document.getElementById("user-email"),
  guestWelcomeBanner: document.getElementById("guest-welcome-banner"),

  // 清單導航
  ownedListsContainer: document.getElementById("owned-lists-container"),
  sharedListsContainer: document.getElementById("shared-lists-container"),
  ownedCountBadge: document.getElementById("owned-count-badge"),
  sharedCountBadge: document.getElementById("shared-count-badge"),
  btnCreateListModal: document.getElementById("btn-create-list-modal"),
  btnJoinListModal: document.getElementById("btn-join-list-modal"),

  // 待辦工作區 Header
  activeListEmoji: document.getElementById("active-list-emoji"),
  activeListTitle: document.getElementById("active-list-title"),
  activeListDesc: document.getElementById("active-list-desc"),
  activeListRoleBadge: document.getElementById("active-list-role-badge"),
  listActionsBar: document.getElementById("list-actions-bar"),
  collaboratorAvatars: document.getElementById("collaborator-avatars"),
  btnShareList: document.getElementById("btn-share-list"),
  btnDeleteList: document.getElementById("btn-delete-list"),
  listProgressSection: document.getElementById("list-progress-section"),
  progressText: document.getElementById("progress-text"),
  progressBarFill: document.getElementById("progress-bar-fill"),

  // 待辦工作區 操作與任務
  addTaskCard: document.getElementById("add-task-card"),
  formAddTask: document.getElementById("form-add-task"),
  inputTaskTitle: document.getElementById("input-task-title"),
  selectPriority: document.getElementById("select-priority"),
  inputDueDate: document.getElementById("input-due-date"),
  selectAssignee: document.getElementById("select-assignee"),
  taskFilterBar: document.getElementById("task-filter-bar"),
  taskSearchInput: document.getElementById("task-search-input"),
  btnFilterAssignedMe: document.getElementById("btn-filter-assigned-me"),
  tasksContainer: document.getElementById("tasks-container"),
  tasksEmptyState: document.getElementById("tasks-empty-state"),

  // 協作動態
  activityFeedList: document.getElementById("activity-feed-list"),

  // 彈跳視窗
  modalFirebaseConfig: document.getElementById("modal-firebase-config"),
  formFirebaseConfig: document.getElementById("form-firebase-config"),
  cfgApiKey: document.getElementById("cfg-api-key"),
  cfgProjectId: document.getElementById("cfg-project-id"),
  cfgAuthDomain: document.getElementById("cfg-auth-domain"),
  cfgStorageBucket: document.getElementById("cfg-storage-bucket"),
  cfgAppId: document.getElementById("cfg-app-id"),
  btnResetConfig: document.getElementById("btn-reset-config"),

  modalCreateList: document.getElementById("modal-create-list"),
  formCreateList: document.getElementById("form-create-list"),
  newListTitle: document.getElementById("new-list-title"),
  newListDesc: document.getElementById("new-list-desc"),
  newListEmoji: document.getElementById("new-list-emoji"),

  modalShareList: document.getElementById("modal-share-list"),
  shareModalCode: document.getElementById("share-modal-code"),
  shareModalUrl: document.getElementById("share-modal-url"),
  btnCopyShareCode: document.getElementById("btn-copy-share-code"),
  btnCopyShareUrl: document.getElementById("btn-copy-share-url"),
  formInviteEmail: document.getElementById("form-invite-email"),
  inputInviteEmail: document.getElementById("input-invite-email"),
  modalMemberCount: document.getElementById("modal-member-count"),
  modalMemberList: document.getElementById("modal-member-list"),

  modalJoinList: document.getElementById("modal-join-list"),
  formJoinList: document.getElementById("form-join-list"),
  inputJoinCode: document.getElementById("input-join-code"),

  toastContainer: document.getElementById("toast-container")
};

// ==================== 初始化 ====================
function initApp() {
  const config = getActiveFirebaseConfig();
  if (config.projectId) {
    el.navProjectId.textContent = config.projectId;
  }

  // 檢查是否已設定有效的 API Key
  const hasValidApiKey = config.apiKey && config.apiKey.trim() !== "" && !config.apiKey.includes("AIzaSy...");

  if (hasValidApiKey) {
    try {
      app = initializeApp(config);
      auth = getAuth(app);
      db = getFirestore(app);

      isDemoMode = false;
      el.demoUserSwitcher?.classList.add("hidden");
      el.demoUserSwitcher?.classList.remove("flex");
      hideMissingConfigUI();
      setSyncStatus(true, "雲端已連線 (my-to-do-list-c081d)");
      bindAuthListener();
      return;
    } catch (e) {
      console.warn("Firebase 初始化異常，進入引導狀態:", e);
    }
  }

  // 若尚未填入 API Key，先顯示設定提示，但預設啟動展示體驗模式讓使用者能馬上體驗！
  showMissingConfigUI(config);
  startDemoMode();
}

function showMissingConfigUI(config) {
  el.missingApiKeyBanner.classList.remove("hidden");
  el.configWarningDot.classList.remove("hidden");
  setSyncStatus(false, "等待填入 Firebase API Key");

  el.cfgApiKey.value = config.apiKey || "";
  el.cfgProjectId.value = config.projectId || "my-to-do-list-c081d";
  el.cfgAuthDomain.value = config.authDomain || "my-to-do-list-c081d.firebaseapp.com";
  el.cfgStorageBucket.value = config.storageBucket || "my-to-do-list-c081d.firebasestorage.app";
  el.cfgAppId.value = config.appId || "";
}

function hideMissingConfigUI() {
  el.missingApiKeyBanner.classList.add("hidden");
  el.configWarningDot.classList.add("hidden");
}

function setSyncStatus(isOnline, text) {
  if (!el.syncStatusBadge) return;
  if (isOnline) {
    el.syncStatusBadge.className = "hidden sm:flex items-center space-x-2 text-xs px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200";
    el.syncStatusText.textContent = text || "雲端即時同步中";
  } else {
    el.syncStatusBadge.className = "hidden sm:flex items-center space-x-2 text-xs px-3 py-1.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200";
    el.syncStatusText.textContent = text || "體驗展示模式";
  }
}

// ==================== 展示體驗模式 (Demo Mode) ====================
function startDemoMode() {
  isDemoMode = true;
  el.demoUserSwitcher?.classList.remove("hidden");
  el.demoUserSwitcher?.classList.add("flex");
  setSyncStatus(false, "本地協作體驗中 (跨分頁即時同步)");

  // 預設為王小明
  const selectedUserKey = el.selectDemoUser?.value || "user1";
  currentUser = { ...DEMO_USERS[selectedUserKey] };

  initDemoData();
  onUserLoggedIn(currentUser);
  showToast("已啟動多人協作體驗模式！您可切換右上角體驗身分，或開啟多個分頁即時測試同步。", "info");

  // 監聽跨分頁廣播
  if (broadcastChannel) {
    broadcastChannel.onmessage = (event) => {
      if (isDemoMode && event.data && event.data.type === "SYNC") {
        reloadDemoData();
      }
    };
  }
}

function initDemoData() {
  let demoStore = localStorage.getItem("my_todo_demo_store");
  if (!demoStore) {
    const initialLists = [
      {
        id: "demo-list-1",
        title: "🚀 團隊專案衝刺 (多人協作示範)",
        desc: "支援多成員指派、優先級、即時狀態同步",
        emoji: "🚀",
        ownerId: "demo-user-1",
        ownerName: "王小明",
        ownerEmail: "wang.demo@example.com",
        ownerPhoto: DEMO_USERS.user1.photoURL,
        members: ["demo-user-1", "demo-user-2", "demo-user-3"],
        memberDetails: {
          "demo-user-1": DEMO_USERS.user1,
          "demo-user-2": DEMO_USERS.user2,
          "demo-user-3": DEMO_USERS.user3
        },
        shareCode: "TD-DEMO01",
        createdAt: Date.now() - 3600000
      },
      {
        id: "demo-list-2",
        title: "🛒 辦公室採買與下午茶清單",
        desc: "零食咖啡補給",
        emoji: "🛒",
        ownerId: "demo-user-2",
        ownerName: "林專案經理",
        ownerEmail: "lin.pm@example.com",
        ownerPhoto: DEMO_USERS.user2.photoURL,
        members: ["demo-user-1", "demo-user-2"],
        memberDetails: {
          "demo-user-1": DEMO_USERS.user1,
          "demo-user-2": DEMO_USERS.user2
        },
        shareCode: "TD-DEMO02",
        createdAt: Date.now() - 7200000
      }
    ];

    const initialTasks = {
      "demo-list-1": [
        {
          id: "task-1",
          title: "串接 Firebase Google 登入驗證",
          priority: "high",
          dueDate: "2026-11-15",
          completed: true,
          completedBy: { uid: "demo-user-1", displayName: "王小明" },
          assignedTo: DEMO_USERS.user1,
          createdBy: DEMO_USERS.user1,
          createdAt: Date.now() - 3000000
        },
        {
          id: "task-2",
          title: "配置 Cloud Firestore 集合結構與安全性規則",
          priority: "high",
          dueDate: "2026-11-16",
          completed: false,
          assignedTo: DEMO_USERS.user3,
          createdBy: DEMO_USERS.user2,
          createdAt: Date.now() - 2500000
        },
        {
          id: "task-3",
          title: "設計多人協作邀請機制與專屬邀請碼",
          priority: "medium",
          dueDate: "2026-11-18",
          completed: false,
          assignedTo: DEMO_USERS.user2,
          createdBy: DEMO_USERS.user1,
          createdAt: Date.now() - 2000000
        },
        {
          id: "task-4",
          title: "進行跨分頁即時廣播測試與進度條驗證",
          priority: "low",
          dueDate: "2026-11-20",
          completed: false,
          assignedTo: DEMO_USERS.user1,
          createdBy: DEMO_USERS.user2,
          createdAt: Date.now() - 1000000
        }
      ],
      "demo-list-2": [
        {
          id: "task-5",
          title: "採購精品美式與淺焙拿鐵咖啡豆",
          priority: "high",
          dueDate: "2026-11-14",
          completed: true,
          completedBy: { uid: "demo-user-2", displayName: "林專案經理" },
          assignedTo: DEMO_USERS.user2,
          createdBy: DEMO_USERS.user2,
          createdAt: Date.now() - 5000000
        },
        {
          id: "task-6",
          title: "訂購週五下午茶點心",
          priority: "medium",
          dueDate: "2026-11-14",
          completed: false,
          assignedTo: DEMO_USERS.user1,
          createdBy: DEMO_USERS.user2,
          createdAt: Date.now() - 4000000
        }
      ]
    };

    const initialActivities = {
      "demo-list-1": [
        { text: "王小明 完成了「串接 Firebase Google 登入驗證」", timestamp: Date.now() - 150000 },
        { text: "林專案經理 新增了事項「進行跨分頁即時廣播測試與進度條驗證」", timestamp: Date.now() - 300000 },
        { text: "陳工程師 加入了此協作清單", timestamp: Date.now() - 500000 }
      ],
      "demo-list-2": [
        { text: "林專案經理 完成了「採購精品美式與淺焙拿鐵咖啡豆」", timestamp: Date.now() - 600000 }
      ]
    };

    saveDemoStore({ lists: initialLists, tasks: initialTasks, activities: initialActivities });
  }
}

function getDemoStore() {
  const raw = localStorage.getItem("my_todo_demo_store");
  return raw ? JSON.parse(raw) : { lists: [], tasks: {}, activities: {} };
}

function saveDemoStore(data) {
  localStorage.setItem("my_todo_demo_store", JSON.stringify(data));
  if (broadcastChannel) {
    broadcastChannel.postMessage({ type: "SYNC" });
  }
}

function reloadDemoData() {
  if (!isDemoMode || !currentUser) return;
  const store = getDemoStore();
  
  ownedLists = store.lists.filter(l => l.ownerId === currentUser.uid);
  sharedLists = store.lists.filter(l => l.ownerId !== currentUser.uid && l.members.includes(currentUser.uid));
  renderListsUI();

  if (activeListId) {
    const list = store.lists.find(l => l.id === activeListId);
    if (list) {
      activeListDoc = list;
      updateActiveListHeader(list);
      tasks = store.tasks[activeListId] || [];
      activities = store.activities[activeListId] || [];
      renderTasksUI();
      updateProgressUI();
      renderActivitiesUI();
    }
  }
}

// ==================== Firebase 驗證 (Google Auth) ====================
function bindAuthListener() {
  if (!auth) return;

  onAuthStateChanged(auth, async (user) => {
    if (user) {
      isDemoMode = false;
      el.demoUserSwitcher?.classList.add("hidden");
      currentUser = user;
      onUserLoggedIn(user);
    } else {
      currentUser = null;
      onUserLoggedOut();
    }
  });
}

async function handleGoogleLogin() {
  if (isDemoMode) {
    // 提示切換至 Firebase 雲端模式
    openModal(el.modalFirebaseConfig);
    showToast("請填入 Firebase Web API Key 以啟用正式 Google 帳號登入", "warning");
    return;
  }

  if (!auth) {
    openModal(el.modalFirebaseConfig);
    showToast("請先填入 Firebase API Key 才能使用 Google 登入", "warning");
    return;
  }

  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });

  try {
    const result = await signInWithPopup(auth, provider);
    showToast(`歡迎回來，${result.user.displayName || "使用者"}！`, "success");
  } catch (error) {
    console.error("Google 登入失敗:", error);
    if (error.code === "auth/popup-closed-by-user") {
      showToast("登入視窗已關閉", "info");
    } else if (error.code === "auth/popup-blocked") {
      alert("⚠️ 瀏覽器封鎖了 Google 登入彈出視窗！請在網址列右側點擊並選擇「一律允許彈出視窗」，然後重新點選登入。");
    } else if (error.code === "auth/operation-not-allowed") {
      alert("⚠️ Google 登入尚未在 Firebase Console 啟用！\n\n請前往 Firebase 控制台：\nAuthentication -> Sign-in method -> 點選「Google」切換為「啟用」後按儲存。");
      openModal(el.modalFirebaseConfig);
    } else {
      showToast(`登入失敗: ${error.message}`, "error");
    }
  }
}

async function handleLogout() {
  if (isDemoMode) {
    showToast("體驗模式重置中...", "info");
    startDemoMode();
    return;
  }

  if (!auth) return;
  try {
    await signOut(auth);
    showToast("已成功登出", "info");
  } catch (error) {
    showToast(`登出失敗: ${error.message}`, "error");
  }
}

async function onUserLoggedIn(user) {
  el.authLoggedOut.classList.add("hidden");
  el.authLoggedIn.classList.remove("hidden");
  el.guestWelcomeBanner.classList.add("hidden");

  el.userAvatar.src = user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || "User")}&background=6366f1&color=fff`;
  el.userName.textContent = user.displayName || "使用者";
  el.userEmail.textContent = user.email || "";

  if (isDemoMode) {
    reloadDemoData();
    const store = getDemoStore();
    const allLists = store.lists.filter(l => l.members.includes(user.uid));
    if (allLists.length > 0 && !activeListId) {
      selectList(allLists[0].id);
    }
    return;
  }

  // 雲端模式：同步至 Firestore
  try {
    const userDocRef = doc(db, "users", user.uid);
    await setDoc(userDocRef, {
      displayName: user.displayName || "未知使用者",
      email: user.email || "",
      photoURL: user.photoURL || "",
      lastLoginAt: serverTimestamp()
    }, { merge: true });
  } catch (e) {
    console.warn("同步至 users 集合提示:", e);
  }

  listenToUserLists();
  checkUrlInviteParam();
}

function onUserLoggedOut() {
  el.authLoggedOut.classList.remove("hidden");
  el.authLoggedIn.classList.add("hidden");
  el.guestWelcomeBanner.classList.remove("hidden");

  if (unsubscribeLists) unsubscribeLists();
  if (unsubscribeTasks) unsubscribeTasks();
  if (unsubscribeActivities) unsubscribeActivities();

  ownedLists = [];
  sharedLists = [];
  tasks = [];
  activities = [];
  activeListId = null;
  activeListDoc = null;

  renderListsUI();
  renderTasksUI();
  resetActiveListHeader();
}

// ==================== 待辦清單 (Lists) 管理 ====================
function listenToUserLists() {
  if (!db || !currentUser || isDemoMode) return;
  if (unsubscribeLists) unsubscribeLists();

  const q = query(collection(db, "lists"), where("members", "array-contains", currentUser.uid));

  unsubscribeLists = onSnapshot(q, (snapshot) => {
    ownedLists = [];
    sharedLists = [];

    snapshot.forEach((docSnap) => {
      const data = { id: docSnap.id, ...docSnap.data() };
      if (data.ownerId === currentUser.uid) {
        ownedLists.push(data);
      } else {
        sharedLists.push(data);
      }
    });

    ownedLists.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
    sharedLists.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));

    renderListsUI();

    const allLists = [...ownedLists, ...sharedLists];
    if (allLists.length > 0) {
      if (!activeListId || !allLists.some(l => l.id === activeListId)) {
        selectList(allLists[0].id);
      } else {
        const updatedActive = allLists.find(l => l.id === activeListId);
        if (updatedActive) {
          activeListDoc = updatedActive;
          updateActiveListHeader(updatedActive);
        }
      }
    } else {
      activeListId = null;
      activeListDoc = null;
      resetActiveListHeader();
      renderTasksUI();
    }
  }, (error) => {
    console.error("監聽待辦清單失敗:", error);
    el.ownedListsContainer.innerHTML = `
      <div class="p-3 text-center text-xs text-amber-700 bg-amber-50 rounded-xl border border-amber-200 space-y-1.5">
        <p class="font-bold">⚠️ Firestore 規則尚未開放</p>
        <p class="text-[11px] text-slate-500">請至 Firebase Console 發布規則，或點擊下方立即切換體驗模式：</p>
        <button id="btn-err-fallback-demo" class="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-xs transition shadow-sm">🎮 切換至免設定體驗模式</button>
      </div>
    `;
    document.getElementById("btn-err-fallback-demo")?.addEventListener("click", startDemoMode);
    showToast("無法載入待辦清單，請確認 Firebase Console Firestore 規則已發佈", "warning");
  });
}

function renderListsUI() {
  el.ownedCountBadge.textContent = ownedLists.length;
  el.sharedCountBadge.textContent = sharedLists.length;

  if (ownedLists.length === 0) {
    el.ownedListsContainer.innerHTML = `
      <div class="px-3 py-4 text-center text-xs text-slate-400 bg-slate-50/60 rounded-xl border border-dashed border-slate-200">
        點擊上方「+ 新增」建立第一個清單
      </div>
    `;
  } else {
    el.ownedListsContainer.innerHTML = ownedLists.map(list => createListNavButton(list, true)).join("");
  }

  if (sharedLists.length === 0) {
    el.sharedListsContainer.innerHTML = `
      <div class="px-3 py-3 text-center text-xs text-slate-400 bg-slate-50/60 rounded-xl">
        尚無其他協作清單
      </div>
    `;
  } else {
    el.sharedListsContainer.innerHTML = sharedLists.map(list => createListNavButton(list, false)).join("");
  }

  document.querySelectorAll(".btn-select-list").forEach(btn => {
    btn.addEventListener("click", () => {
      const listId = btn.getAttribute("data-list-id");
      selectList(listId);
    });
  });
}

function createListNavButton(list, isOwned) {
  const isActive = list.id === activeListId;
  const activeClass = isActive 
    ? "bg-brand-50 text-brand-700 font-semibold border-brand-200 shadow-sm" 
    : "text-slate-600 hover:bg-slate-100/80 border-transparent";

  const memberCount = list.members ? list.members.length : 1;

  return `
    <button class="btn-select-list w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs border transition ${activeClass}" data-list-id="${list.id}">
      <div class="flex items-center space-x-2 truncate">
        <span class="text-base flex-shrink-0">${list.emoji || "📋"}</span>
        <span class="truncate">${escapeHtml(list.title || "未命名清單")}</span>
      </div>
      <div class="flex items-center space-x-1 flex-shrink-0 ml-2">
        ${memberCount > 1 ? `
          <span class="inline-flex items-center space-x-0.5 text-[10px] bg-indigo-100 text-brand-700 px-1.5 py-0.5 rounded-full font-medium" title="${memberCount} 位協作者">
            <svg class="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
            <span>${memberCount}</span>
          </span>
        ` : ""}
      </div>
    </button>
  `;
}

function selectList(listId) {
  activeListId = listId;

  if (isDemoMode) {
    const store = getDemoStore();
    activeListDoc = store.lists.find(l => l.id === listId);
    if (activeListDoc) {
      renderListsUI();
      updateActiveListHeader(activeListDoc);
      tasks = store.tasks[listId] || [];
      activities = store.activities[listId] || [];
      renderTasksUI();
      updateProgressUI();
      renderActivitiesUI();
      populateAssigneeDropdown(activeListDoc);
    }
    return;
  }

  const allLists = [...ownedLists, ...sharedLists];
  activeListDoc = allLists.find(l => l.id === listId);

  renderListsUI();

  if (activeListDoc) {
    updateActiveListHeader(activeListDoc);
    listenToTasks(listId);
    listenToActivities(listId);
    populateAssigneeDropdown(activeListDoc);
  }
}

function updateActiveListHeader(list) {
  el.activeListEmoji.textContent = list.emoji || "📋";
  el.activeListTitle.textContent = list.title || "未命名清單";
  el.activeListDesc.textContent = list.desc || "即時多人協作待辦清單";

  const isOwner = currentUser && list.ownerId === currentUser.uid;
  el.activeListRoleBadge.classList.remove("hidden");
  if (isOwner) {
    el.activeListRoleBadge.textContent = "擁有者";
    el.activeListRoleBadge.className = "text-xs px-2 py-0.5 rounded-full font-medium bg-emerald-50 text-emerald-700 border border-emerald-200";
    el.btnDeleteList.title = "刪除清單";
  } else {
    el.activeListRoleBadge.textContent = "協作者";
    el.activeListRoleBadge.className = "text-xs px-2 py-0.5 rounded-full font-medium bg-indigo-50 text-brand-600 border border-brand-200";
    el.btnDeleteList.title = "退出協作清單";
  }

  renderCollaboratorAvatars(list);

  el.listActionsBar.classList.remove("hidden");
  el.listProgressSection.classList.remove("hidden");
  el.addTaskCard.classList.remove("hidden");
  el.taskFilterBar.classList.remove("hidden");
}

function resetActiveListHeader() {
  el.activeListEmoji.textContent = "📋";
  el.activeListTitle.textContent = "請先選擇或建立清單";
  el.activeListDesc.textContent = "登入後建立或加入多人協作清單";
  el.activeListRoleBadge.classList.add("hidden");
  el.listActionsBar.classList.add("hidden");
  el.listProgressSection.classList.add("hidden");
  el.addTaskCard.classList.add("hidden");
  el.taskFilterBar.classList.add("hidden");
  el.collaboratorAvatars.innerHTML = "";
}

function renderCollaboratorAvatars(list) {
  const membersMap = list.memberDetails || {};
  const memberList = Object.values(membersMap);

  if (memberList.length === 0) {
    el.collaboratorAvatars.innerHTML = `
      <img class="inline-block h-7 w-7 rounded-full ring-2 ring-white object-cover" 
        src="${list.ownerPhoto || `https://ui-avatars.com/api/?name=${encodeURIComponent(list.ownerName || "Owner")}&background=6366f1&color=fff`}" 
        title="${escapeHtml(list.ownerName || "擁有者")}">
    `;
    return;
  }

  el.collaboratorAvatars.innerHTML = memberList.slice(0, 5).map(m => {
    const avatar = m.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(m.displayName || "User")}&background=random&color=fff`;
    return `
      <img class="inline-block h-7 w-7 rounded-full ring-2 ring-white object-cover cursor-pointer" 
        src="${avatar}" 
        title="${escapeHtml(m.displayName || m.email || "成員")} (${m.role === 'owner' ? '擁有者' : '協作者'})">
    `;
  }).join("");

  if (memberList.length > 5) {
    el.collaboratorAvatars.innerHTML += `
      <span class="inline-flex items-center justify-center h-7 w-7 rounded-full ring-2 ring-white bg-slate-200 text-[10px] font-bold text-slate-600">
        +${memberList.length - 5}
      </span>
    `;
  }
}

function populateAssigneeDropdown(list) {
  const members = list.memberDetails ? Object.values(list.memberDetails) : [];
  let html = `<option value="">👤 未指派</option>`;
  
  if (currentUser) {
    html += `<option value="${currentUser.uid}">🙋 指派給我 (${escapeHtml(currentUser.displayName || "我")})</option>`;
  }

  members.forEach(m => {
    if (currentUser && m.uid === currentUser.uid) return;
    html += `<option value="${m.uid}">👤 ${escapeHtml(m.displayName || m.email || "成員")}</option>`;
  });

  el.selectAssignee.innerHTML = html;
}

// 建立新清單
async function handleCreateList(e) {
  e.preventDefault();
  if (!currentUser) {
    showToast("請先登入或選擇體驗身分", "warning");
    return;
  }

  const title = el.newListTitle.value.trim();
  const desc = el.newListDesc.value.trim();
  const emoji = el.newListEmoji.value || "📋";
  if (!title) return;

  const shareCode = generateShareCode();

  const newListData = {
    title,
    desc,
    emoji,
    ownerId: currentUser.uid,
    ownerName: currentUser.displayName || "使用者",
    ownerEmail: currentUser.email || "",
    ownerPhoto: currentUser.photoURL || "",
    members: [currentUser.uid],
    memberDetails: {
      [currentUser.uid]: {
        uid: currentUser.uid,
        displayName: currentUser.displayName || "使用者",
        email: currentUser.email || "",
        photoURL: currentUser.photoURL || "",
        role: "owner"
      }
    },
    shareCode,
    createdAt: Date.now()
  };

  if (isDemoMode) {
    const store = getDemoStore();
    const newId = `demo-list-${Date.now()}`;
    newListData.id = newId;
    store.lists.unshift(newListData);
    store.tasks[newId] = [];
    store.activities[newId] = [{ text: `${currentUser.displayName} 建立了此清單`, timestamp: Date.now() }];
    saveDemoStore(store);

    closeAllModals();
    el.formCreateList.reset();
    showToast(`清單「${title}」建立成功！`, "success");
    reloadDemoData();
    selectList(newId);
    return;
  }

  try {
    const docRef = await addDoc(collection(db, "lists"), {
      ...newListData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    closeAllModals();
    el.formCreateList.reset();
    showToast(`清單「${title}」建立成功！`, "success");
    selectList(docRef.id);
  } catch (error) {
    showToast(`建立失敗: ${error.message}`, "error");
  }
}

// 刪除或退出清單
async function handleDeleteOrLeaveList() {
  if (!activeListDoc || !currentUser) return;
  const isOwner = activeListDoc.ownerId === currentUser.uid;

  if (isOwner) {
    if (!confirm(`確定要刪除清單「${activeListDoc.title}」嗎？所有協作者事項將一併移除。`)) return;

    if (isDemoMode) {
      const store = getDemoStore();
      store.lists = store.lists.filter(l => l.id !== activeListDoc.id);
      delete store.tasks[activeListDoc.id];
      delete store.activities[activeListDoc.id];
      saveDemoStore(store);
      showToast("清單已刪除", "info");
      reloadDemoData();
      return;
    }

    try {
      await deleteDoc(doc(db, "lists", activeListDoc.id));
      showToast("清單已刪除", "info");
    } catch (e) {
      showToast(`刪除失敗: ${e.message}`, "error");
    }
  } else {
    if (!confirm(`確定要退出「${activeListDoc.title}」協作清單嗎？`)) return;

    if (isDemoMode) {
      const store = getDemoStore();
      const list = store.lists.find(l => l.id === activeListDoc.id);
      if (list) {
        list.members = list.members.filter(m => m !== currentUser.uid);
        delete list.memberDetails[currentUser.uid];
        store.activities[activeListDoc.id].unshift({
          text: `${currentUser.displayName} 退出此清單`,
          timestamp: Date.now()
        });
        saveDemoStore(store);
      }
      showToast("已退出協作清單", "info");
      reloadDemoData();
      return;
    }

    try {
      const listRef = doc(db, "lists", activeListDoc.id);
      await updateDoc(listRef, {
        members: arrayRemove(currentUser.uid),
        [`memberDetails.${currentUser.uid}`]: null
      });
      await logActivity(activeListDoc.id, `${currentUser.displayName || "協作者"} 退出此清單`);
      showToast("已退出協作清單", "info");
    } catch (e) {
      showToast(`退出失敗: ${e.message}`, "error");
    }
  }
}

// ==================== 待辦事項 (Tasks) 操作 ====================
function listenToTasks(listId) {
  if (!db || isDemoMode) return;
  if (unsubscribeTasks) unsubscribeTasks();

  const tasksRef = collection(db, "lists", listId, "tasks");
  const q = query(tasksRef, orderBy("createdAt", "desc"));

  unsubscribeTasks = onSnapshot(q, (snapshot) => {
    tasks = [];
    snapshot.forEach(docSnap => {
      tasks.push({ id: docSnap.id, ...docSnap.data() });
    });
    renderTasksUI();
    updateProgressUI();
  }, (error) => {
    console.warn("載入待辦事項失敗:", error);
  });
}

function renderTasksUI() {
  if (!activeListDoc) {
    el.tasksContainer.innerHTML = "";
    el.tasksEmptyState.classList.remove("hidden");
    return;
  }

  el.tasksEmptyState.classList.add("hidden");

  let filtered = tasks.filter(task => {
    if (currentFilter === "active" && task.completed) return false;
    if (currentFilter === "completed" && !task.completed) return false;

    if (filterOnlyAssignedToMe && currentUser) {
      if (!task.assignedTo || task.assignedTo.uid !== currentUser.uid) return false;
    }

    if (searchKeyword) {
      const kw = searchKeyword.toLowerCase();
      const matchTitle = (task.title || "").toLowerCase().includes(kw);
      const matchAssignee = (task.assignedTo?.displayName || "").toLowerCase().includes(kw);
      if (!matchTitle && !matchAssignee) return false;
    }

    return true;
  });

  filtered.sort((a, b) => {
    if (a.completed === b.completed) {
      const timeA = typeof a.createdAt === "number" ? a.createdAt : (a.createdAt?.toMillis ? a.createdAt.toMillis() : 0);
      const timeB = typeof b.createdAt === "number" ? b.createdAt : (b.createdAt?.toMillis ? b.createdAt.toMillis() : 0);
      return timeB - timeA;
    }
    return a.completed ? 1 : -1;
  });

  if (filtered.length === 0) {
    el.tasksContainer.innerHTML = `
      <div class="bg-white rounded-2xl border border-slate-200/80 p-8 text-center shadow-sm">
        <p class="text-xs text-slate-400">目前沒有符合條件的待辦事項</p>
      </div>
    `;
    return;
  }

  el.tasksContainer.innerHTML = filtered.map(task => renderTaskItemHTML(task)).join("");

  document.querySelectorAll(".btn-toggle-task").forEach(btn => {
    btn.addEventListener("click", () => {
      const taskId = btn.getAttribute("data-task-id");
      toggleTaskCompletion(taskId);
    });
  });

  document.querySelectorAll(".btn-delete-task").forEach(btn => {
    btn.addEventListener("click", () => {
      const taskId = btn.getAttribute("data-task-id");
      deleteTask(taskId);
    });
  });
}

function renderTaskItemHTML(task) {
  const isCompleted = !!task.completed;
  const priorityClass = `priority-${task.priority || "medium"}`;
  const priorityText = {
    high: "🔥 緊急重要",
    medium: "⚡ 普通",
    low: "☕ 較不急"
  }[task.priority || "medium"];

  let dueDateBadge = "";
  if (task.dueDate) {
    const today = new Date().toISOString().split("T")[0];
    const isOverdue = !isCompleted && task.dueDate < today;
    const isToday = task.dueDate === today;
    const badgeColor = isOverdue 
      ? "bg-red-50 text-red-600 border-red-200" 
      : (isToday ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-slate-100 text-slate-600 border-slate-200");
    
    dueDateBadge = `
      <span class="inline-flex items-center space-x-1 text-[11px] px-2 py-0.5 rounded-full border ${badgeColor}">
        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
        <span>${escapeHtml(task.dueDate)} ${isOverdue ? "(逾期)" : (isToday ? "(今天)" : "")}</span>
      </span>
    `;
  }

  let assigneeBadge = "";
  if (task.assignedTo) {
    const avatar = task.assignedTo.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(task.assignedTo.displayName || "User")}&background=random&color=fff`;
    assigneeBadge = `
      <div class="inline-flex items-center space-x-1 bg-slate-100 px-2 py-0.5 rounded-full text-[11px] text-slate-700">
        <img src="${avatar}" class="w-3.5 h-3.5 rounded-full object-cover">
        <span>${escapeHtml(task.assignedTo.displayName || "未具名")}</span>
      </div>
    `;
  }

  return `
    <div class="task-item bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm flex items-start justify-between gap-3 ${isCompleted ? "task-completed bg-slate-50/70" : ""}">
      
      <button class="btn-toggle-task mt-0.5 w-5 h-5 rounded-lg border-2 flex items-center justify-center transition flex-shrink-0 ${isCompleted ? "bg-emerald-500 border-emerald-500 text-white" : "border-slate-300 hover:border-brand-500"}" 
        data-task-id="${task.id}" title="${isCompleted ? "標記為未完成" : "標記為完成"}">
        ${isCompleted ? `<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"/></svg>` : ""}
      </button>

      <div class="flex-1 min-w-0 space-y-1.5">
        <p class="task-text text-sm font-medium text-slate-800 break-words leading-snug">
          ${escapeHtml(task.title || "")}
        </p>

        <div class="flex flex-wrap items-center gap-2 pt-0.5">
          <span class="text-[10px] font-semibold px-2 py-0.5 rounded-md ${priorityClass}">
            ${priorityText}
          </span>
          ${dueDateBadge}
          ${assigneeBadge}
          <span class="text-[10px] text-slate-400">
            由 ${escapeHtml(task.createdBy?.displayName || "成員")} 建立
          </span>
        </div>
      </div>

      <div class="flex items-center space-x-1 flex-shrink-0">
        <button class="btn-delete-task p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition" 
          data-task-id="${task.id}" title="刪除事項">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>

    </div>
  `;
}

function updateProgressUI() {
  const total = tasks.length;
  const completed = tasks.filter(t => t.completed).length;
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

  el.progressText.textContent = `${completed} / ${total} 已完成 (${percent}%)`;
  el.progressBarFill.style.width = `${percent}%`;
}

// 新增事項
async function handleAddTask(e) {
  e.preventDefault();
  if (!activeListId || !currentUser) {
    showToast("請先選擇清單", "warning");
    return;
  }

  const title = el.inputTaskTitle.value.trim();
  if (!title) return;

  const priority = el.selectPriority.value || "medium";
  const dueDate = el.inputDueDate.value || null;
  const assigneeUid = el.selectAssignee.value || null;

  let assignedTo = null;
  if (assigneeUid && activeListDoc?.memberDetails?.[assigneeUid]) {
    const m = activeListDoc.memberDetails[assigneeUid];
    assignedTo = {
      uid: m.uid,
      displayName: m.displayName || m.email || "成員",
      photoURL: m.photoURL || ""
    };
  } else if (assigneeUid === currentUser.uid) {
    assignedTo = {
      uid: currentUser.uid,
      displayName: currentUser.displayName || "我",
      photoURL: currentUser.photoURL || ""
    };
  }

  const newTask = {
    title,
    priority,
    dueDate,
    assignedTo,
    completed: false,
    completedAt: null,
    completedBy: null,
    createdBy: {
      uid: currentUser.uid,
      displayName: currentUser.displayName || "使用者",
      photoURL: currentUser.photoURL || ""
    },
    createdAt: Date.now()
  };

  if (isDemoMode) {
    const store = getDemoStore();
    const taskId = `task-${Date.now()}`;
    newTask.id = taskId;
    if (!store.tasks[activeListId]) store.tasks[activeListId] = [];
    store.tasks[activeListId].unshift(newTask);

    if (!store.activities[activeListId]) store.activities[activeListId] = [];
    store.activities[activeListId].unshift({
      text: `${currentUser.displayName} 新增了待辦事項「${title}」`,
      timestamp: Date.now()
    });

    saveDemoStore(store);
    el.formAddTask.reset();
    el.selectPriority.value = "medium";
    showToast("事項新增成功 (展示模式已跨分頁廣播)", "success");
    reloadDemoData();
    return;
  }

  try {
    await addDoc(collection(db, "lists", activeListId, "tasks"), {
      ...newTask,
      createdAt: serverTimestamp()
    });
    el.formAddTask.reset();
    el.selectPriority.value = "medium";
    await logActivity(activeListId, `${currentUser.displayName || "成員"} 新增了待辦事項「${title}」`);
    showToast("事項新增成功", "success");
  } catch (error) {
    showToast(`新增失敗: ${error.message}`, "error");
  }
}

// 完成切換
async function toggleTaskCompletion(taskId) {
  if (!activeListId || !currentUser) return;
  const task = tasks.find(t => t.id === taskId);
  if (!task) return;

  const newStatus = !task.completed;

  if (isDemoMode) {
    const store = getDemoStore();
    const t = store.tasks[activeListId]?.find(item => item.id === taskId);
    if (t) {
      t.completed = newStatus;
      t.completedBy = newStatus ? { uid: currentUser.uid, displayName: currentUser.displayName } : null;
      store.activities[activeListId].unshift({
        text: `${currentUser.displayName} ${newStatus ? "完成了" : "取消完成了"}「${t.title}」`,
        timestamp: Date.now()
      });
      saveDemoStore(store);
      reloadDemoData();
    }
    return;
  }

  try {
    const taskRef = doc(db, "lists", activeListId, "tasks", taskId);
    await updateDoc(taskRef, {
      completed: newStatus,
      completedAt: newStatus ? serverTimestamp() : null,
      completedBy: newStatus ? { uid: currentUser.uid, displayName: currentUser.displayName || "使用者" } : null
    });
    const actionText = newStatus ? "完成了" : "取消完成了";
    await logActivity(activeListId, `${currentUser.displayName || "成員"} ${actionText}「${task.title}」`);
  } catch (error) {
    showToast(`更新失敗: ${error.message}`, "error");
  }
}

// 刪除事項
async function deleteTask(taskId) {
  if (!activeListId) return;
  const task = tasks.find(t => t.id === taskId);
  if (!task) return;

  if (isDemoMode) {
    const store = getDemoStore();
    if (store.tasks[activeListId]) {
      store.tasks[activeListId] = store.tasks[activeListId].filter(t => t.id !== taskId);
      store.activities[activeListId].unshift({
        text: `${currentUser.displayName} 刪除了事項「${task.title}」`,
        timestamp: Date.now()
      });
      saveDemoStore(store);
      reloadDemoData();
      showToast("已刪除該事項", "info");
    }
    return;
  }

  try {
    await deleteDoc(doc(db, "lists", activeListId, "tasks", taskId));
    await logActivity(activeListId, `${currentUser.displayName || "成員"} 刪除了事項「${task.title}」`);
    showToast("已刪除該事項", "info");
  } catch (error) {
    showToast(`刪除失敗: ${error.message}`, "error");
  }
}

// ==================== 協作動態 ====================
function listenToActivities(listId) {
  if (!db || isDemoMode) return;
  if (unsubscribeActivities) unsubscribeActivities();

  const actRef = collection(db, "lists", listId, "activities");
  const q = query(actRef, orderBy("timestamp", "desc"), limit(20));

  unsubscribeActivities = onSnapshot(q, (snapshot) => {
    activities = [];
    snapshot.forEach(docSnap => {
      activities.push({ id: docSnap.id, ...docSnap.data() });
    });
    renderActivitiesUI();
  });
}

function renderActivitiesUI() {
  if (!el.activityFeedList) return;

  if (activities.length === 0) {
    el.activityFeedList.innerHTML = `<p class="text-slate-400 text-center py-6 text-xs">尚無最近協作動態</p>`;
    return;
  }

  el.activityFeedList.innerHTML = activities.map(act => {
    let date = new Date();
    if (typeof act.timestamp === "number") {
      date = new Date(act.timestamp);
    } else if (act.timestamp?.toDate) {
      date = act.timestamp.toDate();
    }
    const timeStr = formatRelativeTime(date);
    return `
      <div class="flex items-start space-x-2 text-xs">
        <span class="w-1.5 h-1.5 rounded-full bg-brand-500 mt-1.5 flex-shrink-0"></span>
        <div class="flex-1">
          <p class="text-slate-700 leading-tight">${escapeHtml(act.text || "")}</p>
          <span class="text-[10px] text-slate-400">${timeStr}</span>
        </div>
      </div>
    `;
  }).join("");
}

async function logActivity(listId, text) {
  if (!db || !listId || isDemoMode) return;
  try {
    await addDoc(collection(db, "lists", listId, "activities"), {
      text,
      timestamp: serverTimestamp()
    });
  } catch (e) {
    console.warn("寫入活動日誌提示:", e);
  }
}

// ==================== 邀請與加入 ====================
function openShareModal() {
  if (!activeListDoc) return;
  const code = activeListDoc.shareCode || "TD-000000";
  el.shareModalCode.textContent = code;

  const shareUrl = `${window.location.origin}${window.location.pathname}?invite=${encodeURIComponent(code)}`;
  el.shareModalUrl.value = shareUrl;

  renderShareModalMemberList(activeListDoc);
  openModal(el.modalShareList);
}

function renderShareModalMemberList(list) {
  const members = list.memberDetails ? Object.values(list.memberDetails) : [];
  el.modalMemberCount.textContent = members.length;

  el.modalMemberList.innerHTML = members.map(m => {
    const isOwner = m.role === "owner" || m.uid === list.ownerId;
    const isMe = currentUser && m.uid === currentUser.uid;
    const canRemove = currentUser && list.ownerId === currentUser.uid && !isOwner;

    return `
      <div class="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-100">
        <div class="flex items-center space-x-2 truncate">
          <img class="w-6 h-6 rounded-full object-cover" src="${m.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(m.displayName || "User")}&background=random`}">
          <div class="truncate">
            <span class="font-medium text-slate-800">${escapeHtml(m.displayName || "成員")} ${isMe ? "(您)" : ""}</span>
            <span class="text-[10px] text-slate-400 block">${escapeHtml(m.email || "")}</span>
          </div>
        </div>
        <div class="flex items-center space-x-1.5 flex-shrink-0">
          <span class="text-[10px] px-2 py-0.5 rounded-full font-medium ${isOwner ? "bg-amber-50 text-amber-700 border border-amber-200" : "bg-slate-200 text-slate-600"}">
            ${isOwner ? "擁有者" : "協作者"}
          </span>
          ${canRemove ? `
            <button class="btn-remove-member text-slate-400 hover:text-red-500 p-1" data-uid="${m.uid}" title="移除成員">✕</button>
          ` : ""}
        </div>
      </div>
    `;
  }).join("");

  document.querySelectorAll(".btn-remove-member").forEach(btn => {
    btn.addEventListener("click", () => {
      const uidToRemove = btn.getAttribute("data-uid");
      removeCollaborator(uidToRemove);
    });
  });
}

async function handleInviteByEmail(e) {
  e.preventDefault();
  if (!activeListDoc || !currentUser) return;
  const email = el.inputInviteEmail.value.trim().toLowerCase();
  if (!email) return;

  if (isDemoMode) {
    const store = getDemoStore();
    const list = store.lists.find(l => l.id === activeListDoc.id);
    if (list) {
      const fakeUid = `demo-invited-${Date.now()}`;
      list.members.push(fakeUid);
      list.memberDetails[fakeUid] = {
        uid: fakeUid,
        displayName: email.split("@")[0],
        email: email,
        photoURL: "",
        role: "editor"
      };
      store.activities[activeListDoc.id].unshift({
        text: `${email} 已被加入此協作清單`,
        timestamp: Date.now()
      });
      saveDemoStore(store);
      showToast(`已成功邀請 ${email}！`, "success");
      el.formInviteEmail.reset();
      reloadDemoData();
      renderShareModalMemberList(list);
    }
    return;
  }

  try {
    const usersQuery = query(collection(db, "users"), where("email", "==", email), limit(1));
    const userSnapshot = await getDocs(usersQuery);

    if (userSnapshot.empty) {
      showToast(`未找到 ${email}。請請對方先登入過一次本應用，或直接將 6 位數邀請碼分享給對方！`, "warning");
      return;
    }

    const targetDoc = userSnapshot.docs[0];
    const targetData = targetDoc.data();
    const targetUid = targetDoc.id;

    const listRef = doc(db, "lists", activeListDoc.id);
    await updateDoc(listRef, {
      members: arrayUnion(targetUid),
      [`memberDetails.${targetUid}`]: {
        uid: targetUid,
        displayName: targetData.displayName || email,
        email: email,
        photoURL: targetData.photoURL || "",
        role: "editor"
      }
    });

    await logActivity(activeListDoc.id, `${targetData.displayName || email} 已被加入此協作清單`);
    showToast(`成功邀請 ${email} 加入清單！`, "success");
    el.formInviteEmail.reset();
  } catch (error) {
    showToast(`邀請失敗: ${error.message}`, "error");
  }
}

async function removeCollaborator(uid) {
  if (!activeListDoc) return;
  if (!confirm("確定要將該協作者從此清單移除嗎？")) return;

  if (isDemoMode) {
    const store = getDemoStore();
    const list = store.lists.find(l => l.id === activeListDoc.id);
    if (list) {
      list.members = list.members.filter(m => m !== uid);
      delete list.memberDetails[uid];
      saveDemoStore(store);
      reloadDemoData();
      renderShareModalMemberList(list);
      showToast("已移除該協作者", "info");
    }
    return;
  }

  try {
    const listRef = doc(db, "lists", activeListDoc.id);
    await updateDoc(listRef, {
      members: arrayRemove(uid),
      [`memberDetails.${uid}`]: null
    });
    showToast("已移除該協作者", "info");
  } catch (e) {
    showToast(`移除失敗: ${e.message}`, "error");
  }
}

async function handleJoinList(e) {
  e.preventDefault();
  if (!currentUser) return;
  const rawCode = el.inputJoinCode.value.trim().toUpperCase();
  if (!rawCode) return;
  await joinListByCode(rawCode);
}

async function joinListByCode(code) {
  if (isDemoMode) {
    const store = getDemoStore();
    const list = store.lists.find(l => l.shareCode === code || l.id === code);
    if (!list) {
      showToast("找不到此邀請碼對應的清單，請確認代碼是否正確 (例如 TD-DEMO01)", "error");
      return;
    }
    if (list.members.includes(currentUser.uid)) {
      showToast("您已在此清單中！", "info");
      closeAllModals();
      selectList(list.id);
      return;
    }

    list.members.push(currentUser.uid);
    list.memberDetails[currentUser.uid] = {
      uid: currentUser.uid,
      displayName: currentUser.displayName,
      email: currentUser.email,
      photoURL: currentUser.photoURL,
      role: "editor"
    };
    store.activities[list.id].unshift({
      text: `${currentUser.displayName} 透過邀請碼加入了清單`,
      timestamp: Date.now()
    });
    saveDemoStore(store);
    showToast(`成功加入協作清單「${list.title}」！`, "success");
    closeAllModals();
    reloadDemoData();
    selectList(list.id);
    return;
  }

  try {
    const q = query(collection(db, "lists"), where("shareCode", "==", code), limit(1));
    const snap = await getDocs(q);

    if (snap.empty) {
      showToast("找不到此邀請碼對應的待辦清單", "error");
      return;
    }

    const listDoc = snap.docs[0];
    const listData = listDoc.data();

    if (listData.members?.includes(currentUser.uid)) {
      showToast("您已經在此清單中！", "info");
      closeAllModals();
      selectList(listDoc.id);
      return;
    }

    const listRef = doc(db, "lists", listDoc.id);
    await updateDoc(listRef, {
      members: arrayUnion(currentUser.uid),
      [`memberDetails.${currentUser.uid}`]: {
        uid: currentUser.uid,
        displayName: currentUser.displayName || "使用者",
        email: currentUser.email || "",
        photoURL: currentUser.photoURL || "",
        role: "editor"
      }
    });

    await logActivity(listDoc.id, `${currentUser.displayName || "新成員"} 透過邀請碼加入了清單`);
    showToast(`成功加入協作清單「${listData.title}」！`, "success");
    closeAllModals();
    selectList(listDoc.id);
  } catch (error) {
    showToast(`加入失敗: ${error.message}`, "error");
  }
}

function checkUrlInviteParam() {
  const params = new URLSearchParams(window.location.search);
  const inviteCode = params.get("invite");
  if (inviteCode && currentUser) {
    showToast(`偵測到邀請碼: ${inviteCode}，正在加入...`, "info");
    joinListByCode(inviteCode.trim().toUpperCase());
    window.history.replaceState({}, document.title, window.location.pathname);
  }
}

// ==================== 工具函式 ====================
function generateShareCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let result = "TD-";
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function escapeHtml(str) {
  if (!str) return "";
  return str.replace(/[&<>'"]/g, 
    tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
  );
}

function formatRelativeTime(date) {
  const now = new Date();
  const diffSec = Math.floor((now - date) / 1000);
  if (diffSec < 60) return "剛剛";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)} 分鐘前`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} 小時前`;
  return `${Math.floor(diffSec / 86400)} 天前`;
}

function showToast(message, type = "info") {
  const toast = document.createElement("div");
  const colors = {
    success: "bg-emerald-600 text-white shadow-emerald-500/20",
    error: "bg-red-600 text-white shadow-red-500/20",
    warning: "bg-amber-600 text-white shadow-amber-500/20",
    info: "bg-slate-900 text-white shadow-slate-900/20"
  }[type] || "bg-slate-900 text-white";

  toast.className = `toast-animate pointer-events-auto px-4 py-3 rounded-xl text-xs font-medium shadow-lg flex items-center space-x-2 ${colors}`;
  toast.innerHTML = `<span>${escapeHtml(message)}</span>`;

  el.toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(10px)";
    toast.style.transition = "all 0.3s ease";
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

function openModal(modal) {
  modal.classList.remove("hidden");
}

function closeAllModals() {
  document.querySelectorAll("[id^='modal-']").forEach(m => m.classList.add("hidden"));
}

// ==================== 事件監聽綁定 ====================
function initEventListeners() {
  el.btnGoogleLogin?.addEventListener("click", handleGoogleLogin);
  el.heroBtnLogin?.addEventListener("click", handleGoogleLogin);
  el.btnLogout?.addEventListener("click", handleLogout);

  // 體驗按鈕
  el.heroBtnDemo?.addEventListener("click", startDemoMode);
  el.btnBannerDemo?.addEventListener("click", startDemoMode);

  // 切換展示使用者
  el.selectDemoUser?.addEventListener("change", (e) => {
    const userKey = e.target.value;
    if (DEMO_USERS[userKey]) {
      currentUser = { ...DEMO_USERS[userKey] };
      onUserLoggedIn(currentUser);
      showToast(`已切換為：${currentUser.displayName} (${currentUser.role === 'owner' ? '擁有者' : '協作者'})`, "info");
    }
  });

  // Firebase 設定視窗
  el.btnOpenConfigModal?.addEventListener("click", () => openModal(el.modalFirebaseConfig));
  el.heroBtnConfig?.addEventListener("click", () => openModal(el.modalFirebaseConfig));
  el.btnFixConfigBanner?.addEventListener("click", () => openModal(el.modalFirebaseConfig));

  el.formFirebaseConfig?.addEventListener("submit", (e) => {
    e.preventDefault();
    const newConfig = {
      apiKey: el.cfgApiKey.value.trim(),
      projectId: el.cfgProjectId.value.trim(),
      authDomain: el.cfgAuthDomain.value.trim(),
      storageBucket: el.cfgStorageBucket.value.trim(),
      appId: el.cfgAppId.value.trim()
    };
    saveFirebaseConfig(newConfig);
    showToast("Firebase 設定已儲存，正在連接雲端專案...", "success");
    setTimeout(() => window.location.reload(), 800);
  });

  el.btnResetConfig?.addEventListener("click", () => {
    if (confirm("確定要清除本機儲存的 Firebase 設定嗎？")) {
      clearSavedFirebaseConfig();
      showToast("已清除設定", "info");
      setTimeout(() => window.location.reload(), 600);
    }
  });

  document.querySelectorAll(".btn-close-modal, .modal-backdrop").forEach(btn => {
    btn.addEventListener("click", closeAllModals);
  });

  // 清單建立
  el.btnCreateListModal?.addEventListener("click", () => {
    if (!currentUser) {
      showToast("請先登入或選擇體驗身分", "warning");
      return;
    }
    openModal(el.modalCreateList);
  });
  el.formCreateList?.addEventListener("submit", handleCreateList);

  // Emoji 選擇
  document.querySelectorAll(".emoji-opt").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".emoji-opt").forEach(b => {
        b.classList.remove("border-brand-500", "bg-indigo-50", "border-2");
        b.classList.add("border", "border-slate-200");
      });
      btn.classList.remove("border", "border-slate-200");
      btn.classList.add("border-brand-500", "bg-indigo-50", "border-2");
      el.newListEmoji.value = btn.getAttribute("data-emoji");
    });
  });

  // 加入清單
  el.btnJoinListModal?.addEventListener("click", () => {
    if (!currentUser) {
      showToast("請先登入或選擇體驗身分", "warning");
      return;
    }
    openModal(el.modalJoinList);
  });
  el.formJoinList?.addEventListener("submit", handleJoinList);

  // 分享清單
  el.btnShareList?.addEventListener("click", openShareModal);
  el.btnCopyShareCode?.addEventListener("click", () => {
    if (!activeListDoc) return;
    navigator.clipboard.writeText(activeListDoc.shareCode || "");
    showToast("邀請碼已複製到剪貼簿！", "success");
  });
  el.btnCopyShareUrl?.addEventListener("click", () => {
    el.shareModalUrl.select();
    navigator.clipboard.writeText(el.shareModalUrl.value);
    showToast("分享連結已複製到剪貼簿！", "success");
  });
  el.formInviteEmail?.addEventListener("submit", handleInviteByEmail);

  // 刪除 / 退出清單
  el.btnDeleteList?.addEventListener("click", handleDeleteOrLeaveList);

  // 新增事項
  el.formAddTask?.addEventListener("submit", handleAddTask);

  // 待辦篩選按鈕
  document.querySelectorAll(".task-filter-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".task-filter-btn").forEach(b => {
        b.classList.remove("bg-white", "text-slate-800", "shadow-sm");
        b.classList.add("text-slate-500");
      });
      btn.classList.add("bg-white", "text-slate-800", "shadow-sm");
      btn.classList.remove("text-slate-500");
      currentFilter = btn.getAttribute("data-filter");
      renderTasksUI();
    });
  });

  // 只看指派給我開關
  el.btnFilterAssignedMe?.addEventListener("click", () => {
    filterOnlyAssignedToMe = !filterOnlyAssignedToMe;
    if (filterOnlyAssignedToMe) {
      el.btnFilterAssignedMe.className = "px-2.5 py-1.5 bg-brand-50 border border-brand-200 rounded-xl font-bold text-brand-700 transition flex items-center space-x-1";
    } else {
      el.btnFilterAssignedMe.className = "px-2.5 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-600 transition flex items-center space-x-1";
    }
    renderTasksUI();
  });

  // 關鍵字搜尋
  el.taskSearchInput?.addEventListener("input", (e) => {
    searchKeyword = e.target.value.trim();
    renderTasksUI();
  });
}

// ==================== 啟動 ====================
document.addEventListener("DOMContentLoaded", () => {
  initEventListeners();
  initApp();
});

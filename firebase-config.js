/**
 * Firebase 專案設定
 * 專案 ID: my-to-do-list-c081d
 */

export const defaultFirebaseConfig = {
  apiKey: "AIzaSyBhhDuh0rz81x_bIk2jEtKS-fS7er0Mudk",
  authDomain: "my-to-do-list-c081d.firebaseapp.com",
  projectId: "my-to-do-list-c081d",
  storageBucket: "my-to-do-list-c081d.firebasestorage.app",
  messagingSenderId: "711961847012",
  appId: "1:711961847012:web:c1ef35296cbe804c6e78f1",
  measurementId: "G-R66CRBM48X"
};

/**
 * 取得當前有效的 Firebase 設定（優先讀取有效設定，預設為 defaultFirebaseConfig）
 */
export function getActiveFirebaseConfig() {
  const saved = localStorage.getItem("my_todo_firebase_config");
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (parsed && parsed.apiKey && parsed.apiKey.length > 20 && parsed.projectId === defaultFirebaseConfig.projectId) {
        return parsed;
      }
    } catch (e) {
      console.warn("無法解析儲存的 Firebase 設定:", e);
    }
  }
  return defaultFirebaseConfig;
}

/**
 * 儲存 Firebase 設定至 localStorage
 */
export function saveFirebaseConfig(config) {
  localStorage.setItem("my_todo_firebase_config", JSON.stringify(config));
}

/**
 * 清除已儲存的 Firebase 設定（還原為預設）
 */
export function clearSavedFirebaseConfig() {
  localStorage.removeItem("my_todo_firebase_config");
}

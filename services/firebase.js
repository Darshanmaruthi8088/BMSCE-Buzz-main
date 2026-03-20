import Constants from "expo-constants";
import * as FileSystem from "expo-file-system";
import * as Device from "expo-device";
import { Platform } from "react-native";
import { initializeApp, getApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getDownloadURL, getStorage, ref, uploadBytes, uploadString } from "firebase/storage";

const extraConfig =
  Constants?.expoConfig?.extra ||
  Constants?.manifest2?.extra ||
  Constants?.manifest?.extra ||
  {};

const readEnv = (...keys) => {
  for (const key of keys) {
    if (typeof process !== "undefined" && process?.env?.[key]) return process.env[key];
    if (extraConfig?.[key]) return extraConfig[key];
  }
  return "";
};

const firebaseConfig = {
  apiKey: readEnv("REACT_APP_FIREBASE_API_KEY", "EXPO_PUBLIC_FIREBASE_API_KEY"),
  authDomain: readEnv("REACT_APP_FIREBASE_AUTH_DOMAIN", "EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN"),
  projectId: readEnv("REACT_APP_FIREBASE_PROJECT_ID", "EXPO_PUBLIC_FIREBASE_PROJECT_ID"),
  storageBucket: readEnv("REACT_APP_FIREBASE_STORAGE_BUCKET", "EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET"),
  messagingSenderId: readEnv("REACT_APP_FIREBASE_MESSAGING_SENDER_ID", "EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID"),
  appId: readEnv("REACT_APP_FIREBASE_APP_ID", "EXPO_PUBLIC_FIREBASE_APP_ID"),
};

export const isFirebaseConfigured = Object.values(firebaseConfig).every(Boolean);

let app = null;
let auth = null;
let db = null;
let storage = null;

if (isFirebaseConfigured) {
  app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  storage = getStorage(app);
}

export { app, auth, db, storage, firebaseConfig };

const getImageExtension = (value = "") => {
  const normalized = String(value || "").split("?")[0];
  const extension = normalized.includes(".") ? normalized.split(".").pop()?.toLowerCase() : "";
  return extension || "jpg";
};

const IMAGE_CONTENT_TYPES = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
  gif: "image/gif",
};

const getContentType = (extension = "", blobType = "") =>
  blobType && blobType.startsWith("image/")
    ? blobType
    : IMAGE_CONTENT_TYPES[extension] || "image/jpeg";

const blobFromXhr = (uri) =>
  new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.onload = () => resolve(xhr.response);
    xhr.onerror = () => reject(new Error("Failed to read image file from URI."));
    xhr.responseType = "blob";
    xhr.open("GET", uri, true);
    xhr.send(null);
  });

const getBlobFromUri = async (uri) => {
  try {
    const response = await fetch(uri);
    const blob = await response.blob();
    if (blob && typeof blob.size === "number" && blob.size > 0) return blob;
  } catch {
    // Fall through to XHR method for content:// or platform-specific fetch failures.
  }
  return blobFromXhr(uri);
};

const persistLocalImageUri = async (uri, sourceName = "") => {
  if (!uri || !/^(file|content):\/\//i.test(uri)) return uri || "";
  try {
    const ext = getImageExtension(sourceName || uri);
    const baseDir = `${FileSystem.documentDirectory || FileSystem.cacheDirectory || ""}local-media`;
    if (!baseDir) return uri;
    await FileSystem.makeDirectoryAsync(baseDir, { intermediates: true });
    const target = `${baseDir}/${Date.now()}-${Math.round(Math.random() * 1_000_000)}.${ext}`;
    await FileSystem.copyAsync({ from: uri, to: target });
    return target;
  } catch {
    return uri;
  }
};

export const uploadImageAsync = async ({ uri, pathPrefix = "uploads", fileName = "" } = {}) => {
  if (!uri) return "";
  if (!storage) return persistLocalImageUri(uri, fileName || uri);
  if (/^https?:\/\//i.test(uri)) return uri;

  const ext = getImageExtension(fileName || uri);
  const finalName = fileName || `${Date.now()}.${ext}`;
  const cleanName = finalName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storageRef = ref(storage, `${pathPrefix}/${cleanName}`);

  try {
    const blob = await getBlobFromUri(uri);
    const contentType = getContentType(ext, blob?.type || "");
    await uploadBytes(storageRef, blob, { contentType });
    if (typeof blob?.close === "function") blob.close();
    return await getDownloadURL(storageRef);
  } catch (error) {
    try {
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      if (!base64) throw new Error("Image file is empty.");
      const contentType = getContentType(ext, "");
      await uploadString(storageRef, base64, "base64", { contentType });
      return await getDownloadURL(storageRef);
    } catch (fallbackError) {
      const code = fallbackError?.code || error?.code || "unknown";
      const message = fallbackError?.message || error?.message || "Image upload failed.";
      console.warn(`Image upload failed (${code}): ${message}`);
      if (/^(file|content):\/\//i.test(uri)) {
        return persistLocalImageUri(uri, fileName || uri);
      }
      return uri;
    }
  }
};

const isExpoGoClient =
  Constants?.executionEnvironment === "storeClient" ||
  Constants?.appOwnership === "expo";

let notificationsModule = null;
let isNotificationHandlerConfigured = false;
let didLogNotificationModuleError = false;

const getNotificationsModule = () => {
  if (isExpoGoClient) return null;
  if (!notificationsModule) {
    try {
      notificationsModule = require("expo-notifications");
    } catch (error) {
      if (!didLogNotificationModuleError) {
        console.error("Failed to load expo-notifications module:", error);
        didLogNotificationModuleError = true;
      }
      return null;
    }
  }

  if (!isNotificationHandlerConfigured) {
    notificationsModule.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });
    isNotificationHandlerConfigured = true;
  }

  return notificationsModule;
};

export const requestFcmToken = async () => {
  if (!Device.isDevice || isExpoGoClient) return null;

  const Notifications = getNotificationsModule();
  if (!Notifications) return null;

  try {
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.MAX,
      });
    }
    const permission = await Notifications.getPermissionsAsync();
    let finalStatus = permission.status;
    if (finalStatus !== "granted") {
      const requested = await Notifications.requestPermissionsAsync();
      finalStatus = requested.status;
    }
    if (finalStatus !== "granted") return null;
    const token = await Notifications.getDevicePushTokenAsync();
    return token?.data || null;
  } catch (error) {
    console.error("Failed to get native push token:", error);
    return null;
  }
};

export const subscribeToForegroundMessages = async (handler) => {
  if (typeof handler !== "function" || isExpoGoClient) return () => {};

  const Notifications = getNotificationsModule();
  if (!Notifications) return () => {};

  const listener = Notifications.addNotificationReceivedListener((notification) => {
    const payload = {
      notification: {
        title: notification?.request?.content?.title || "New update",
        body: notification?.request?.content?.body || "You received a new notification.",
      },
      data: notification?.request?.content?.data || {},
    };
    try {
      handler(payload);
    } catch (error) {
      console.error("Foreground notification handler failed:", error);
    }
  });
  return () => {
    try {
      listener.remove();
    } catch (error) {
      console.error("Failed to remove foreground listener:", error);
    }
  };
};

export const subscribeToMessages = subscribeToForegroundMessages;

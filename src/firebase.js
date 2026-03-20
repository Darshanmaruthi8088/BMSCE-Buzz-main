import { initializeApp, getApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";
import { getMessaging, getToken, isSupported, onMessage } from "firebase/messaging";
import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
};

export const isFirebaseConfigured = Object.values(firebaseConfig).every(Boolean);

let app = null;
let db = null;
let auth = null;
let storage = null;

if (isFirebaseConfigured) {
  app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  db = getFirestore(app);
  auth = getAuth(app);
  storage = getStorage(app);
}

export { app, db, auth, storage };

const isNativePushRuntime = () =>
  typeof window !== "undefined" &&
  Capacitor.isNativePlatform() &&
  ["android", "ios"].includes(Capacitor.getPlatform());
const isNativePushEnabled = () => process.env.REACT_APP_ENABLE_NATIVE_PUSH === "true";

const normalizeNativeNotificationPayload = (notification = {}) => ({
  notification: {
    title: notification?.title || "New update",
    body: notification?.body || "You received a new notification.",
  },
  data: notification?.data && typeof notification.data === "object" ? notification.data : {},
});

const nativeForegroundHandlers = new Set();
let nativePushListenersAttached = false;
let cachedNativePushToken = null;
let nativeTokenPromise = null;

const ensureNativePushListeners = async () => {
  if (!isNativePushRuntime() || nativePushListenersAttached) return;

  await PushNotifications.addListener("pushNotificationReceived", (notification) => {
    const payload = normalizeNativeNotificationPayload(notification);
    nativeForegroundHandlers.forEach((handler) => {
      try {
        handler(payload);
      } catch (err) {
        console.error("Native push foreground handler failed:", err);
      }
    });
  });

  await PushNotifications.addListener("pushNotificationActionPerformed", () => {});
  nativePushListenersAttached = true;
};

const ensureNativePushPermission = async () => {
  let permission = await PushNotifications.checkPermissions();
  if (permission.receive === "prompt" || permission.receive === "prompt-with-rationale") {
    permission = await PushNotifications.requestPermissions();
  }
  return permission.receive === "granted";
};

const waitForNativeRegistrationToken = async () => {
  let settled = false;
  let registrationHandle = null;
  let registrationErrorHandle = null;

  return new Promise(async (resolve) => {
    const cleanup = () => {
      if (registrationHandle?.remove) registrationHandle.remove();
      if (registrationErrorHandle?.remove) registrationErrorHandle.remove();
    };

    const finish = (value) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(value);
    };

    try {
      registrationHandle = await PushNotifications.addListener("registration", (token) => {
        cachedNativePushToken = token?.value || null;
        finish(cachedNativePushToken);
      });

      registrationErrorHandle = await PushNotifications.addListener("registrationError", (error) => {
        console.error("Native push registration error:", error);
        finish(null);
      });

      await PushNotifications.register();
      setTimeout(() => finish(cachedNativePushToken), 15_000);
    } catch (err) {
      console.error("Failed during native push token registration flow:", err);
      finish(null);
    }
  });
};

const requestNativeFcmToken = async () => {
  if (!isNativePushEnabled()) return null;
  if (!isFirebaseConfigured || !app || !isNativePushRuntime()) return null;
  if (cachedNativePushToken) return cachedNativePushToken;

  const granted = await ensureNativePushPermission();
  if (!granted) return null;

  await ensureNativePushListeners();

  if (!nativeTokenPromise) {
    nativeTokenPromise = waitForNativeRegistrationToken().finally(() => {
      nativeTokenPromise = null;
    });
  }
  return nativeTokenPromise;
};

const baseSwPath = "/firebase-messaging-sw.js";

const buildMessagingSwUrl = () => {
  const params = new URLSearchParams({
    apiKey: firebaseConfig.apiKey || "",
    authDomain: firebaseConfig.authDomain || "",
    projectId: firebaseConfig.projectId || "",
    storageBucket: firebaseConfig.storageBucket || "",
    messagingSenderId: firebaseConfig.messagingSenderId || "",
    appId: firebaseConfig.appId || "",
  });
  return `${baseSwPath}?${params.toString()}`;
};

const canUseBrowserNotifications = () =>
  typeof window !== "undefined" &&
  typeof navigator !== "undefined" &&
  "Notification" in window &&
  "serviceWorker" in navigator;

const getMessagingInstance = async () => {
  if (!isFirebaseConfigured || !app || !canUseBrowserNotifications()) return null;
  const supported = await isSupported().catch(() => false);
  if (!supported) return null;
  return getMessaging(app);
};

export const requestFcmToken = async () => {
  if (isNativePushRuntime()) {
    return requestNativeFcmToken();
  }

  const messaging = await getMessagingInstance();
  if (!messaging) return null;

  const swRegistration = await navigator.serviceWorker.register(buildMessagingSwUrl());
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return null;

  const vapidKey = process.env.REACT_APP_FIREBASE_VAPID_KEY;
  if (!vapidKey) {
    console.warn("REACT_APP_FIREBASE_VAPID_KEY is missing. Push token cannot be generated.");
    return null;
  }

  return getToken(messaging, { vapidKey, serviceWorkerRegistration: swRegistration }).catch((err) => {
    console.error("Failed to get FCM token:", err);
    return null;
  });
};

export const subscribeToForegroundMessages = async (handler) => {
  if (isNativePushRuntime()) {
    if (!isNativePushEnabled()) return () => {};
    await ensureNativePushListeners();
    if (typeof handler === "function") nativeForegroundHandlers.add(handler);
    return () => {
      if (typeof handler === "function") nativeForegroundHandlers.delete(handler);
    };
  }

  const messaging = await getMessagingInstance();
  if (!messaging) return () => {};
  return onMessage(messaging, handler);
};

// Backward-compatible alias for older imports.
export const subscribeToMessages = subscribeToForegroundMessages;

// Optional compatibility export for legacy modules.
export const messaging = null;

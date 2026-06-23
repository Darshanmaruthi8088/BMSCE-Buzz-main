import Constants from "expo-constants";
import * as FileSystem from "expo-file-system/legacy";
import * as Device from "expo-device";
import { Platform } from "react-native";
import { initializeApp, getApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFunctions } from "firebase/functions";
import { getFirestore } from "firebase/firestore";
import { getDownloadURL, getStorage, ref, uploadBytes, uploadString } from "firebase/storage";

const extraConfig =
  Constants?.expoConfig?.extra ||
  Constants?.manifest2?.extra ||
  Constants?.manifest?.extra ||
  {};

const readEnv = (...keys) => {
  for (const key of keys) {
    const fromExtra = extraConfig?.[key];
    if (fromExtra !== undefined && fromExtra !== null && String(fromExtra).trim() !== "") {
      return fromExtra;
    }
    if (typeof process !== "undefined" && process?.env?.[key]) return process.env[key];
  }
  return "";
};

const isNativePushEnabled = () =>
  String(readEnv("REACT_APP_ENABLE_NATIVE_PUSH", "EXPO_PUBLIC_ENABLE_NATIVE_PUSH") || "")
    .trim()
    .toLowerCase() === "true";

const firebaseConfig = {
  apiKey: readEnv("REACT_APP_FIREBASE_API_KEY", "EXPO_PUBLIC_FIREBASE_API_KEY"),
  authDomain: readEnv("REACT_APP_FIREBASE_AUTH_DOMAIN", "EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN"),
  projectId: readEnv("REACT_APP_FIREBASE_PROJECT_ID", "EXPO_PUBLIC_FIREBASE_PROJECT_ID"),
  storageBucket: readEnv("REACT_APP_FIREBASE_STORAGE_BUCKET", "EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET"),
  messagingSenderId: readEnv("REACT_APP_FIREBASE_MESSAGING_SENDER_ID", "EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID"),
  appId: readEnv("REACT_APP_FIREBASE_APP_ID", "EXPO_PUBLIC_FIREBASE_APP_ID"),
};

export const isFirebaseConfigured = Object.values(firebaseConfig).every(Boolean);

const initAuthForCurrentPlatform = (firebaseApp) => {
  if (Platform.OS === "web") {
    return getAuth(firebaseApp);
  }
  try {
    const { initializeAuth, getReactNativePersistence } = require("firebase/auth");
    const AsyncStorage = require("@react-native-async-storage/async-storage").default;
    return initializeAuth(firebaseApp, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch (error) {
    const code = String(error?.code || "").trim();
    if (code === "auth/already-initialized") {
      return getAuth(firebaseApp);
    }
    console.warn("Firebase Auth: falling back to getAuth without explicit persistence:", error?.message || error);
    return getAuth(firebaseApp);
  }
};

const normalizeStorageBucketName = (value = "") => {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";
  const noProtocol = trimmed.replace(/^gs:\/\//i, "");
  const noQuery = noProtocol.split("?")[0];
  return noQuery.split("/")[0];
};

let app = null;
let auth = null;
let db = null;
let functions = null;
let storage = null;
let uploadStorageTargets = [];

if (isFirebaseConfigured) {
  app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  auth = initAuthForCurrentPlatform(app);
  db = getFirestore(app);
  functions = getFunctions(app);
  storage = getStorage(app);

  const configuredBucket = normalizeStorageBucketName(
    firebaseConfig.storageBucket || storage?.app?.options?.storageBucket || ""
  );
  const projectId = String(firebaseConfig.projectId || "").trim();
  const bucketCandidates = [configuredBucket];
  if (projectId) {
    bucketCandidates.push(`${projectId}.appspot.com`);
    bucketCandidates.push(`${projectId}.firebasestorage.app`);
  }

  const seenBuckets = new Set();
  uploadStorageTargets = bucketCandidates
    .map(normalizeStorageBucketName)
    .filter((bucket) => {
      if (!bucket || seenBuckets.has(bucket)) return false;
      seenBuckets.add(bucket);
      return true;
    })
    .map((bucket) => {
      try {
        return { bucket, instance: getStorage(app, `gs://${bucket}`) };
      } catch {
        return null;
      }
    })
    .filter(Boolean);

  if (!uploadStorageTargets.length && storage) {
    uploadStorageTargets = [{ bucket: configuredBucket || "default", instance: storage }];
  }
}

export { app, auth, db, functions, storage, firebaseConfig };

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

const isHttpUri = (value = "") => /^https?:\/\//i.test(String(value || ""));
const isFirebaseStorageUri = (value = "") => /^gs:\/\//i.test(String(value || ""));
const hasUriScheme = (value = "") => /^[a-z][a-z0-9+.-]*:/i.test(String(value || ""));
const FILESYSTEM_BASE64_ENCODING = FileSystem?.EncodingType?.Base64 || "base64";

const getLocalMediaBaseDir = () =>
  `${FileSystem.documentDirectory || FileSystem.cacheDirectory || ""}local-media`;

const isPersistedLocalMediaUri = (value = "") => {
  const baseDir = getLocalMediaBaseDir();
  if (!baseDir) return false;
  return /^file:\/\//i.test(String(value || "")) && String(value || "").startsWith(`${baseDir}/`);
};

const isLikelyLocalMediaUri = (value = "") => {
  if (!value || !hasUriScheme(value)) return false;
  if (isHttpUri(value) || isFirebaseStorageUri(value)) return false;
  return true;
};

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

const blobToBase64 = (blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to convert image blob to base64."));
    reader.onloadend = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      const base64 = result.includes(",") ? result.split(",").pop() : "";
      if (!base64) {
        reject(new Error("Image blob conversion produced empty data."));
        return;
      }
      resolve(base64);
    };
    reader.readAsDataURL(blob);
  });

const persistLocalImageUri = async (uri, sourceName = "") => {
  if (!uri || !isLikelyLocalMediaUri(uri)) return uri || "";
  const baseDir = getLocalMediaBaseDir();
  if (!baseDir) return uri;
  if (isPersistedLocalMediaUri(uri)) return uri;

  const ext = getImageExtension(sourceName || uri);
  const target = `${baseDir}/${Date.now()}-${Math.round(Math.random() * 1_000_000)}.${ext}`;

  try {
    await FileSystem.makeDirectoryAsync(baseDir, { intermediates: true });
  } catch {
    return uri;
  }

  try {
    await FileSystem.copyAsync({ from: uri, to: target });
    return target;
  } catch {
    // Fall through to Base64 backup if direct copy from URI fails.
  }

  try {
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FILESYSTEM_BASE64_ENCODING,
    });
    if (!base64) throw new Error("Image file is empty.");
    await FileSystem.writeAsStringAsync(target, base64, {
      encoding: FILESYSTEM_BASE64_ENCODING,
    });
    return target;
  } catch {
    // Fall through to blob conversion for platform URIs like ph://.
  }

  try {
    const blob = await getBlobFromUri(uri);
    const base64 = await blobToBase64(blob);
    await FileSystem.writeAsStringAsync(target, base64, {
      encoding: FILESYSTEM_BASE64_ENCODING,
    });
    if (typeof blob?.close === "function") blob.close();
    return target;
  } catch {
    // Could not persist as a stable local file.
  }
  return uri;
};

export const uploadImageAsync = async ({
  uri,
  pathPrefix = "uploads",
  fileName = "",
  allowLocalFallback = true,
  throwOnFailure = false,
} = {}) => {
  if (!uri) return "";
  if (isHttpUri(uri)) return uri;
  if (isFirebaseStorageUri(uri)) return uri;

  const persistedSourceUri = await persistLocalImageUri(uri, fileName || uri);
  const sourceUri = persistedSourceUri || uri;
  const localFallbackUri =
    isPersistedLocalMediaUri(sourceUri) || (allowLocalFallback && isLikelyLocalMediaUri(sourceUri))
      ? sourceUri
      : "";

  const storageTargets = uploadStorageTargets.length
    ? uploadStorageTargets
    : storage
      ? [{ bucket: "default", instance: storage }]
      : [];
  if (!storageTargets.length) {
    if (throwOnFailure) {
      throw new Error("Firebase Storage is not configured.");
    }
    return allowLocalFallback ? localFallbackUri : "";
  }

  const ext = getImageExtension(fileName || sourceUri || uri);
  const finalName = fileName || `${Date.now()}.${ext}`;
  const cleanName = finalName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const objectPath = `${pathPrefix}/${cleanName}`;
  let lastError = null;

  for (const target of storageTargets) {
    const storageRef = ref(target.instance, objectPath);
    try {
      let blob = null;
      try {
        blob = await getBlobFromUri(sourceUri);
        const contentType = getContentType(ext, blob?.type || "");
        await uploadBytes(storageRef, blob, { contentType });
      } finally {
        if (typeof blob?.close === "function") blob.close();
      }
      return await getDownloadURL(storageRef);
      } catch (error) {
        lastError = error;
        try {
          const contentType = getContentType(ext, "");
          const idToken = auth?.currentUser ? await auth.currentUser.getIdToken() : "";
          const uploadUrl = `https://firebasestorage.googleapis.com/v0/b/${target.bucket}/o?name=${encodeURIComponent(objectPath)}`;
          
          let dataBlob = null;
          try {
            dataBlob = await getBlobFromUri(sourceUri);
            const response = await fetch(uploadUrl, {
              method: "POST",
              headers: {
                "Content-Type": contentType,
                ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
              },
              body: dataBlob,
            });
            
            if (!response.ok) {
              const text = await response.text();
              throw new Error(`REST upload failed (${response.status}): ${text}`);
            }
            
            try {
              const metadata = await response.json();
              if (metadata?.downloadTokens) {
                const token = metadata.downloadTokens.split(',')[0];
                return `https://firebasestorage.googleapis.com/v0/b/${target.bucket}/o/${encodeURIComponent(objectPath)}?alt=media&token=${token}`;
              }
            } catch (e) {
              // Ignore JSON parse error
            }
          } finally {
            if (typeof dataBlob?.close === "function") dataBlob.close();
          }
          
          return await getDownloadURL(storageRef);
        } catch (fallbackError) {
          lastError = fallbackError || error;
        }
      }
  }

  const code = lastError?.code || "unknown";
  const message = lastError?.message || "Image upload failed.";
  const buckets = storageTargets.map((target) => target.bucket).join(", ");
  console.warn(`Image upload failed (${code}): ${message}. Buckets tried: ${buckets}`);
  if (allowLocalFallback && localFallbackUri) return localFallbackUri;
  if (throwOnFailure) {
    const uploadError = lastError instanceof Error ? lastError : new Error(message);
    if (!uploadError.code && code !== "unknown") uploadError.code = code;
    throw uploadError;
  }
  return "";
};

const isExpoGoClient =
  Constants?.executionEnvironment === "storeClient" ||
  Constants?.appOwnership === "expo";

let notificationsModule = null;
let isNotificationHandlerConfigured = false;
let didLogNotificationModuleError = false;

const isMissingNativeFirebaseAppError = (error) => {
  const message = String(error?.message || error || "");
  return (
    /default firebaseapp is not initialized/i.test(message) ||
    /firebaseapp\.initializeapp/i.test(message) ||
    /push-notifications\/fcm-credentials/i.test(message)
  );
};

const getNotificationsModule = () => {
  if (isExpoGoClient) return null;
  if (!notificationsModule) {
    try {
      notificationsModule = require("expo-notifications");
    } catch (error) {
      if (!didLogNotificationModuleError) {
        console.warn("Failed to load expo-notifications module:", error);
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
  if (!isNativePushEnabled()) return null;
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
    if (isMissingNativeFirebaseAppError(error)) {
      console.warn(
        "Native push token unavailable: Android Firebase app is not initialized. Add FCM native config or keep REACT_APP_ENABLE_NATIVE_PUSH=false."
      );
      return null;
    }
    console.warn("Failed to get native push token:", error);
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

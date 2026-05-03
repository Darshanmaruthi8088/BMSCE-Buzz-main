const fs = require("fs");
const path = require("path");

const normalizeBooleanString = (value = "false") =>
  String(value || "")
    .trim()
    .toLowerCase() === "true";

const loadDotEnv = () => {
  try {
    const envPath = path.resolve(__dirname, ".env");
    if (!fs.existsSync(envPath)) return;
    const raw = fs.readFileSync(envPath, "utf8");
    raw.split(/\r?\n/).forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return;
      const [key, ...valueParts] = trimmed.split("=");
      if (!key) return;
      const value = valueParts.join("=").trim();
      if (typeof process.env[key] === "undefined") {
        process.env[key] = value;
      }
    });
  } catch {
    // Ignore parse errors and continue using existing env values.
  }
};

const loadGoogleServicesConfig = () => {
  try {
    const servicesPath = path.resolve(__dirname, "google-services.json");
    if (!fs.existsSync(servicesPath)) return {};
    const raw = fs.readFileSync(servicesPath, "utf8");
    const config = JSON.parse(raw);
    const projectInfo = config.project_info || {};
    const client = Array.isArray(config.client) ? config.client[0] : null;
    const apiKey = client?.api_key?.[0]?.current_key || "";
    const appId = client?.client_info?.mobilesdk_app_id || "";
    const projectId = projectInfo.project_id || "";
    return {
      REACT_APP_FIREBASE_API_KEY: apiKey,
      REACT_APP_FIREBASE_AUTH_DOMAIN: projectId ? `${projectId}.firebaseapp.com` : "",
      REACT_APP_FIREBASE_PROJECT_ID: projectId,
      REACT_APP_FIREBASE_STORAGE_BUCKET: projectInfo.storage_bucket || "",
      REACT_APP_FIREBASE_MESSAGING_SENDER_ID: projectInfo.project_number || "",
      REACT_APP_FIREBASE_APP_ID: appId,
    };
  } catch {
    return {};
  }
};

loadDotEnv();

const trimOrEmpty = (value) => String(value ?? "").trim();

/** Prefer google-services.json when present so native builds match the Android Firebase app (API keys / app id). */
const mergeFirebaseExtra = (googleServicesValues, envKeys) => {
  const out = {};
  for (const { envKey, googleKey } of envKeys) {
    const fromGoogle = trimOrEmpty(googleServicesValues[googleKey]);
    const fromEnv = trimOrEmpty(process.env[envKey]);
    out[envKey] = fromGoogle || fromEnv || "";
  }
  return out;
};

export default ({ config }) => {
  const googleServicesValues = loadGoogleServicesConfig();
  const firebaseFromNativeFile = mergeFirebaseExtra(googleServicesValues, [
    { envKey: "REACT_APP_FIREBASE_API_KEY", googleKey: "REACT_APP_FIREBASE_API_KEY" },
    { envKey: "REACT_APP_FIREBASE_AUTH_DOMAIN", googleKey: "REACT_APP_FIREBASE_AUTH_DOMAIN" },
    { envKey: "REACT_APP_FIREBASE_PROJECT_ID", googleKey: "REACT_APP_FIREBASE_PROJECT_ID" },
    { envKey: "REACT_APP_FIREBASE_STORAGE_BUCKET", googleKey: "REACT_APP_FIREBASE_STORAGE_BUCKET" },
    { envKey: "REACT_APP_FIREBASE_MESSAGING_SENDER_ID", googleKey: "REACT_APP_FIREBASE_MESSAGING_SENDER_ID" },
    { envKey: "REACT_APP_FIREBASE_APP_ID", googleKey: "REACT_APP_FIREBASE_APP_ID" },
  ]);
  const nativePushFlag =
    process.env.REACT_APP_ENABLE_NATIVE_PUSH ||
    config?.extra?.REACT_APP_ENABLE_NATIVE_PUSH ||
    "true";
  const nativePushEnabled = normalizeBooleanString(nativePushFlag);

  return {
    ...config,
    name: "BMSCE Buzz",
    owner: "darshan18",
    slug: "bmsce-buzz",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon-square.png",
    userInterfaceStyle: "automatic",
    splash: {
      image: "./assets/app-logo.png",
      resizeMode: "contain",
      backgroundColor: "#0A0F1E",
    },
    assetBundlePatterns: ["**/*"],
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.bmsce.buzz",
    },
    android: {
      package: "com.bmsce.buzz",
      googleServicesFile: "./google-services.json",
      adaptiveIcon: {
        foregroundImage: "./assets/icon-square.png",
        backgroundColor: "#0A0F1E",
      },
      permissions: ["POST_NOTIFICATIONS"],
    },
    web: {
      bundler: "metro",
      favicon: "./assets/app-logo.png",
    },
    plugins: ["expo-font", "@react-native-community/datetimepicker", "expo-notifications"],
    extra: {
      REACT_APP_FIREBASE_API_KEY: firebaseFromNativeFile.REACT_APP_FIREBASE_API_KEY,
      REACT_APP_FIREBASE_AUTH_DOMAIN: firebaseFromNativeFile.REACT_APP_FIREBASE_AUTH_DOMAIN,
      REACT_APP_FIREBASE_PROJECT_ID: firebaseFromNativeFile.REACT_APP_FIREBASE_PROJECT_ID,
      REACT_APP_FIREBASE_STORAGE_BUCKET: firebaseFromNativeFile.REACT_APP_FIREBASE_STORAGE_BUCKET,
      REACT_APP_FIREBASE_MESSAGING_SENDER_ID: firebaseFromNativeFile.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
      REACT_APP_FIREBASE_APP_ID: firebaseFromNativeFile.REACT_APP_FIREBASE_APP_ID,
      REACT_APP_FIREBASE_VAPID_KEY: process.env.REACT_APP_FIREBASE_VAPID_KEY || "",
      REACT_APP_ENABLE_NATIVE_PUSH: nativePushEnabled ? "true" : "false",
      eas: {
        projectId: "884a51e1-32de-4ff9-b940-4c5258cdb41f",
      },
    },
  };
};

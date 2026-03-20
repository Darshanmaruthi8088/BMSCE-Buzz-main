export default ({ config }) => ({
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
  plugins: ["expo-font", "@react-native-community/datetimepicker"],
  extra: {
    REACT_APP_FIREBASE_API_KEY: process.env.REACT_APP_FIREBASE_API_KEY || "",
    REACT_APP_FIREBASE_AUTH_DOMAIN: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || "",
    REACT_APP_FIREBASE_PROJECT_ID: process.env.REACT_APP_FIREBASE_PROJECT_ID || "",
    REACT_APP_FIREBASE_STORAGE_BUCKET: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || "",
    REACT_APP_FIREBASE_MESSAGING_SENDER_ID: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || "",
    REACT_APP_FIREBASE_APP_ID: process.env.REACT_APP_FIREBASE_APP_ID || "",
    REACT_APP_FIREBASE_VAPID_KEY: process.env.REACT_APP_FIREBASE_VAPID_KEY || "",
    REACT_APP_ENABLE_NATIVE_PUSH: process.env.REACT_APP_ENABLE_NATIVE_PUSH || "false",
    eas: {
      projectId: "884a51e1-32de-4ff9-b940-4c5258cdb41f",
    },
  },
});

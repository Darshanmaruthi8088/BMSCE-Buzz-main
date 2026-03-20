import { requestFcmToken } from "./firebase";

export const requestPermission = async () => {
  try {
    const token = await requestFcmToken();
    if (token) {
      console.log("FCM TOKEN:", token);
      return token;
    }
    return null;
  } catch (error) {
    console.error("Failed to request push permission:", error);
    return null;
  }
};

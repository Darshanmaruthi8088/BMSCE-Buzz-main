import { requestFcmToken } from "./firebase";

export const requestPermission = async () => {
  try {
    const token = await requestFcmToken();
    if (token) {
      console.log("TOKEN:", token);
      return token;
    }
    console.log("Push permission denied or token unavailable");
    return null;
  } catch (error) {
    console.error(error);
    return null;
  }
};

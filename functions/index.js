const admin = require("firebase-admin");
const { HttpsError, onCall } = require("firebase-functions/v2/https");

admin.initializeApp();

const PRIMARY_ADMIN_EMAIL = "dd7085646@gmail.com";

const normalizeEmail = (value = "") => String(value || "").trim().toLowerCase();

const assertPrimaryAdmin = (request) => {
  const callerEmail = normalizeEmail(request.auth?.token?.email || "");
  if (!request.auth || callerEmail !== PRIMARY_ADMIN_EMAIL) {
    throw new HttpsError("permission-denied", "Only the primary admin can delete users.");
  }
};

const deleteAuthUser = async (userId) => {
  try {
    await admin.auth().deleteUser(userId);
    return true;
  } catch (error) {
    if (error?.code === "auth/user-not-found") return false;
    throw error;
  }
};

exports.deleteUserAccount = onCall(async (request) => {
  assertPrimaryAdmin(request);

  const userId = typeof request.data?.userId === "string" ? request.data.userId.trim() : "";
  if (!userId) {
    throw new HttpsError("invalid-argument", "A valid userId is required.");
  }
  if (userId === request.auth.uid) {
    throw new HttpsError("failed-precondition", "The primary admin account cannot delete itself.");
  }

  const userRef = admin.firestore().collection("users").doc(userId);
  const userSnap = await userRef.get();
  const userData = userSnap.exists ? userSnap.data() || {} : {};
  const targetEmail = normalizeEmail(userData.email || "");

  if (targetEmail === PRIMARY_ADMIN_EMAIL || userData.role === "admin") {
    throw new HttpsError("permission-denied", "Admin accounts cannot be deleted from this screen.");
  }

  await deleteAuthUser(userId);

  const batch = admin.firestore().batch();
  let hasFirestoreDeletes = false;
  if (userSnap.exists) {
    batch.delete(userRef);
    hasFirestoreDeletes = true;
  }

  const fcmTokensSnap = await admin.firestore().collection("fcmTokens").where("userId", "==", userId).get();
  fcmTokensSnap.docs.forEach((tokenDoc) => {
    batch.delete(tokenDoc.ref);
    hasFirestoreDeletes = true;
  });

  if (hasFirestoreDeletes) {
    await batch.commit();
  }

  return { ok: true };
});

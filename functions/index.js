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

const getAuthUserByEmail = async (email) => {
  try {
    return await admin.auth().getUserByEmail(email);
  } catch (error) {
    if (error?.code === "auth/user-not-found") return null;
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

  const firestore = admin.firestore();
  const userRef = firestore.collection("users").doc(userId);
  const userSnap = await userRef.get();
  const userData = userSnap.exists ? userSnap.data() || {} : {};
  let authUser = null;
  try {
    authUser = await admin.auth().getUser(userId);
  } catch (error) {
    if (error?.code !== "auth/user-not-found") throw error;
  }
  const targetEmail = normalizeEmail(userData.email || authUser?.email || "");

  if (targetEmail === PRIMARY_ADMIN_EMAIL || userData.role === "admin") {
    throw new HttpsError("permission-denied", "Admin accounts cannot be deleted from this screen.");
  }

  const fcmTokensSnap = await firestore.collection("fcmTokens").where("userId", "==", userId).get();
  const personalEventsSnap = await userRef.collection("personalEvents").get();
  const authDeleted = await deleteAuthUser(userId);

  const batch = firestore.batch();
  batch.set(
    firestore.collection("deletedUsers").doc(userId),
    {
      userId,
      email: targetEmail,
      name: userData.name || authUser?.displayName || "User",
      role: userData.role || "user",
      userType: userData.userType || null,
      dept: userData.dept || "",
      year: userData.year || null,
      usn: userData.usn || null,
      deletedBy: request.auth.uid,
      deletedByEmail: normalizeEmail(request.auth.token?.email || ""),
      deletedAt: admin.firestore.FieldValue.serverTimestamp(),
      authDeleted,
    },
    { merge: true }
  );
  personalEventsSnap.docs.forEach((eventDoc) => {
    batch.delete(eventDoc.ref);
  });
  fcmTokensSnap.docs.forEach((tokenDoc) => {
    batch.delete(tokenDoc.ref);
  });
  if (userSnap.exists) {
    batch.delete(userRef);
  }

  await batch.commit();

  return { ok: true, authDeleted };
});

exports.cleanupDeletedUserAuthForSignup = onCall(async (request) => {
  const email = normalizeEmail(request.data?.email || "");
  if (!email || !email.includes("@")) {
    throw new HttpsError("invalid-argument", "A valid email is required.");
  }
  if (email === PRIMARY_ADMIN_EMAIL) {
    throw new HttpsError("permission-denied", "The primary admin account cannot be cleaned up.");
  }

  const firestore = admin.firestore();
  const authUser = await getAuthUserByEmail(email);
  if (!authUser) {
    return { ok: true, authDeleted: false };
  }

  const userRef = firestore.collection("users").doc(authUser.uid);
  const [activeUserSnap, deletedUserSnap, activeEmailSnap] = await Promise.all([
    userRef.get(),
    firestore.collection("deletedUsers").doc(authUser.uid).get(),
    firestore.collection("users").where("email", "==", email).limit(1).get(),
  ]);

  if (activeUserSnap.exists || !activeEmailSnap.empty) {
    throw new HttpsError("failed-precondition", "This email belongs to an active user.");
  }

  let deletedMarkers = deletedUserSnap.exists ? [deletedUserSnap] : [];
  if (!deletedMarkers.length) {
    const deletedEmailSnap = await firestore
      .collection("deletedUsers")
      .where("email", "==", email)
      .limit(10)
      .get();
    deletedMarkers = deletedEmailSnap.docs;
  }

  if (!deletedMarkers.length) {
    throw new HttpsError("failed-precondition", "This email is not marked as deleted.");
  }

  const authDeleted = await deleteAuthUser(authUser.uid);
  const batch = firestore.batch();
  const cleanupPatch = {
    userId: authUser.uid,
    email,
    authDeleted,
    authCleanupAt: admin.firestore.FieldValue.serverTimestamp(),
    authCleanupReason: "signup-email-reuse",
  };

  batch.set(firestore.collection("deletedUsers").doc(authUser.uid), cleanupPatch, { merge: true });
  deletedMarkers.forEach((marker) => {
    batch.set(marker.ref, cleanupPatch, { merge: true });
  });
  await batch.commit();

  return { ok: true, authDeleted };
});

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import * as FileSystem from "expo-file-system";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import {
  auth,
  db,
  isFirebaseConfigured,
  requestFcmToken,
  subscribeToForegroundMessages,
  uploadImageAsync,
} from "../services/firebase";
import {
  BRANCHES,
  LOCAL_NEWS,
  LOCAL_NOTIFS,
  PRIMARY_ADMIN,
  ROLE_LABELS,
  STUDY_YEARS,
  USERS,
} from "../services/constants";
import {
  deriveNameFromEmail,
  getInitials,
  mapFirestoreNews,
  mapFirestoreNotif,
  normalizeAudienceRoles,
  normalizeAudienceUserIds,
} from "../services/utils";

const AppContext = createContext(null);
const useFirebaseBackend = isFirebaseConfigured && !!db;
const STRONG_PASSWORD_REGEX = /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,10}$/;
const USN_REGEX = /^\dBM\d{2}[A-Z]{2}\d{3}$/;
const normalizeRecoveryAnswer = (value = "") => value.trim().toLowerCase();
const normalizeEmail = (value = "") => value.trim().toLowerCase();
const PRIMARY_ADMIN_EMAIL = normalizeEmail(PRIMARY_ADMIN.email);
const PRIMARY_ADMIN_NAME = PRIMARY_ADMIN.name.trim().toLowerCase();
const normalizeRole = (role = "user", email = "") =>
  role === "admin" && normalizeEmail(email) === PRIMARY_ADMIN_EMAIL ? "admin" : "user";
const normalizeUserType = (role, userType = "student") =>
  role === "user" ? (userType === "faculty" ? "faculty" : "student") : null;
const isPrimaryAdminSession = (profile) =>
  normalizeRole(profile?.role, profile?.email) === "admin";
const AVATAR_CACHE_FILE =
  FileSystem.documentDirectory || FileSystem.cacheDirectory
    ? `${FileSystem.documentDirectory || FileSystem.cacheDirectory}avatar-cache.json`
    : "";

const readAvatarCacheMap = async () => {
  if (!AVATAR_CACHE_FILE) return {};
  try {
    const info = await FileSystem.getInfoAsync(AVATAR_CACHE_FILE);
    if (!info.exists) return {};
    const raw = await FileSystem.readAsStringAsync(AVATAR_CACHE_FILE);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return parsed;
  } catch {
    return {};
  }
};

const writeAvatarCacheMap = async (cache = {}) => {
  if (!AVATAR_CACHE_FILE) return false;
  try {
    await FileSystem.writeAsStringAsync(AVATAR_CACHE_FILE, JSON.stringify(cache));
    return true;
  } catch {
    return false;
  }
};

const cacheAvatarUrlForUser = async (userId = "", avatarUrl = "") => {
  if (!userId || !avatarUrl) return false;
  const cache = await readAvatarCacheMap();
  cache[userId] = avatarUrl;
  return writeAvatarCacheMap(cache);
};

const resolveCachedAvatarForUser = async (userId = "") => {
  if (!userId) return "";
  const cache = await readAvatarCacheMap();
  const value = typeof cache[userId] === "string" ? cache[userId] : "";
  if (!value) return "";
  if (!/^file:\/\//i.test(value)) return value;

  try {
    const info = await FileSystem.getInfoAsync(value);
    if (info.exists) return value;
    delete cache[userId];
    await writeAvatarCacheMap(cache);
  } catch {
    // Ignore cache validation failures; fallback to default avatar behavior.
  }
  return "";
};

const isHttpImageUri = (value = "") => /^https?:\/\//i.test(String(value || ""));
const isFirebaseStorageUri = (value = "") => /^gs:\/\//i.test(String(value || ""));
const isNonRemoteImageUri = (value = "") => {
  const trimmed = String(value || "").trim();
  if (!trimmed) return false;
  if (isHttpImageUri(trimmed) || isFirebaseStorageUri(trimmed)) return false;
  return /^[a-z][a-z0-9+.-]*:/i.test(trimmed);
};

const toDateValue = (value) => {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value?.toDate === "function") {
    const converted = value.toDate();
    return Number.isNaN(converted.getTime()) ? null : converted;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatEventTimeRange = (startIso, endIso) => {
  const start = toDateValue(startIso);
  const end = toDateValue(endIso);
  if (!start) return "All Day";
  const formatDateTime = (value) =>
    value.toLocaleString([], {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  if (!end || end <= start) return formatDateTime(start);
  return `${formatDateTime(start)} - ${formatDateTime(end)}`;
};

const normalizeReadNotificationIds = (value) =>
  value && typeof value === "object"
    ? Object.fromEntries(
        Object.entries(value).filter(
          ([id, isRead]) => typeof id === "string" && id.trim() && !!isRead
        )
      )
    : {};

const MAX_AVATAR_BASE64_LENGTH = 750_000;
const AVATAR_MIME_BY_EXT = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  heic: "image/heic",
  heif: "image/heif",
};

const getAvatarExtension = (value = "") => {
  const normalized = String(value || "").split("?")[0];
  if (!normalized.includes(".")) return "";
  const ext = normalized.split(".").pop()?.toLowerCase().trim() || "";
  return /^[a-z0-9]+$/.test(ext) ? ext : "";
};

const buildAvatarDataUri = async (uri = "", fileName = "") => {
  if (!uri) return "";
  try {
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    if (!base64 || base64.length > MAX_AVATAR_BASE64_LENGTH) return "";
    const ext = getAvatarExtension(fileName) || getAvatarExtension(uri) || "jpg";
    const mimeType = AVATAR_MIME_BY_EXT[ext] || "image/jpeg";
    return `data:${mimeType};base64,${base64}`;
  } catch {
    return "";
  }
};

const getAuthErrorMessage = (err) => {
  const code = err?.code || "";
  if (code === "auth/email-already-in-use") return "This email is already registered. Please sign in.";
  if (code === "auth/invalid-email") return "Enter a valid email address.";
  if (code === "auth/weak-password") {
    return "Use a stronger password: 8-10 chars with 1 uppercase, 1 number, and 1 special character.";
  }
  if (code === "auth/invalid-credential") return "Invalid email or password.";
  if (code === "auth/user-not-found") return "No account found with this email.";
  if (code === "auth/wrong-password") return "Incorrect password.";
  if (code === "auth/operation-not-allowed") {
    return "Email/Password sign-in is disabled in Firebase Authentication.";
  }
  if (code === "auth/configuration-not-found") {
    return "Firebase Authentication is not configured for this project.";
  }
  if (code === "auth/unauthorized-domain") {
    return "This domain is not authorized for Firebase Auth.";
  }
  if (code === "permission-denied" || code === "firestore/permission-denied") {
    return "Firestore write failed due to permission denied.";
  }
  if (code === "failed-precondition") {
    return "Firestore is not fully enabled for this project.";
  }
  return err?.message || "Authentication failed. Please try again.";
};

const getAvatarUploadErrorMessage = (err) => {
  const code = err?.code || "";
  if (
    code === "storage/unauthorized" ||
    code === "storage/unauthenticated" ||
    code === "permission-denied" ||
    code === "firestore/permission-denied"
  ) {
    return "Avatar upload is blocked by Firebase rules. Allow authenticated users to write their own avatars in Storage and users collection.";
  }
  if (code === "storage/quota-exceeded") {
    return "Firebase Storage quota exceeded. Upgrade plan or clean up storage to continue uploads.";
  }
  if (code === "storage/retry-limit-exceeded" || code === "network-request-failed") {
    return "Network was unstable during upload. Please retry on a stable internet connection.";
  }
  if (code === "storage/object-not-found") {
    return "Upload target bucket was not found. Verify Firebase Storage bucket configuration.";
  }
  if (code === "firestore/unavailable") {
    return "Firestore is currently unavailable. Please try again in a moment.";
  }
  if (code === "invalid-argument" && /too large/i.test(String(err?.message || ""))) {
    return "Selected image is too large to store in Firestore. Choose a smaller image and try again.";
  }
  if (err?.message) return err.message;
  return "Could not upload avatar to cloud storage. Please verify Firebase configuration and retry.";
};

export const AppProvider = ({ children }) => {
  const [dark, setDark] = useState(true);
  const [user, setUser] = useState(null);
  const [news, setNews] = useState(LOCAL_NEWS);
  const [notifs, setNotifs] = useState(LOCAL_NOTIFS);
  const [users, setUsers] = useState([]);
  const viewedArticleLocksRef = useRef(new Set());
  const repairedAvatarUrisRef = useRef(new Set());
  const repairedPostImageUrisRef = useRef(new Set());

  const isAdmin = isPrimaryAdminSession(user);

  useEffect(() => {
    viewedArticleLocksRef.current = new Set();
  }, [user?.id]);

  useEffect(() => {
    let mounted = true;
    if (!user?.id) return undefined;

    resolveCachedAvatarForUser(user.id).then((cachedAvatarUrl) => {
      if (!mounted || !cachedAvatarUrl) return;
      setUser((prev) => {
        if (!prev || prev.id !== user.id) return prev;
        if (prev.avatarUrl === cachedAvatarUrl) return prev;
        if (prev.avatarUrl && /^https?:\/\//i.test(prev.avatarUrl)) return prev;
        return { ...prev, avatarUrl: cachedAvatarUrl };
      });
    });

    return () => {
      mounted = false;
    };
  }, [user?.id]);

  useEffect(() => {
    if (!useFirebaseBackend || !db || !user?.id || !isNonRemoteImageUri(user?.avatarUrl)) {
      return undefined;
    }

    const repairKey = `${user.id}:${user.avatarUrl}`;
    if (repairedAvatarUrisRef.current.has(repairKey)) return undefined;
    repairedAvatarUrisRef.current.add(repairKey);

    let cancelled = false;
    const repairAvatar = async () => {
      try {
        const repairedUrl = await uploadImageAsync({
          uri: user.avatarUrl,
          pathPrefix: `avatars/${user.id}`,
          fileName: `${Date.now()}-${user.id}.jpg`,
          allowLocalFallback: false,
        });
        if (!repairedUrl || cancelled || repairedUrl === user.avatarUrl) return;

        await setDoc(doc(db, "users", user.id), { avatarUrl: repairedUrl, updatedAt: serverTimestamp() }, { merge: true });
        if (cancelled) return;

        cacheAvatarUrlForUser(user.id, repairedUrl);
        setUser((prev) => (prev && prev.id === user.id ? { ...prev, avatarUrl: repairedUrl } : prev));
        setUsers((prev) => prev.map((item) => (item.id === user.id ? { ...item, avatarUrl: repairedUrl } : item)));
      } catch (error) {
        console.error("Failed to repair avatar image URL:", error);
      }
    };

    repairAvatar();
    return () => {
      cancelled = true;
    };
  }, [user?.id, user?.avatarUrl]);

  useEffect(() => {
    if (!useFirebaseBackend || !db || !user?.id || !Array.isArray(news) || !news.length) {
      return undefined;
    }

    const ownPostsWithLocalUris = news.filter(
      (item) =>
        item?.id &&
        item.authorId === user.id &&
        typeof item.coverImage === "string" &&
        isNonRemoteImageUri(item.coverImage)
    );
    if (!ownPostsWithLocalUris.length) return undefined;

    let cancelled = false;
    const repairPostImages = async () => {
      for (const post of ownPostsWithLocalUris) {
        if (cancelled) return;
        const repairKey = `${post.id}:${post.coverImage}`;
        if (repairedPostImageUrisRef.current.has(repairKey)) continue;
        repairedPostImageUrisRef.current.add(repairKey);

        try {
          const repairedUrl = await uploadImageAsync({
            uri: post.coverImage,
            pathPrefix: `posts/${user.id}`,
            fileName: `${Date.now()}-${post.id}.jpg`,
            allowLocalFallback: false,
          });
          if (!repairedUrl || repairedUrl === post.coverImage || cancelled) continue;

          await updateDoc(doc(db, "news", post.id), {
            coverImage: repairedUrl,
            updatedAt: serverTimestamp(),
          });
        } catch (error) {
          console.error(`Failed to repair cover image for post ${post.id}:`, error);
        }
      }
    };

    repairPostImages();
    return () => {
      cancelled = true;
    };
  }, [news, user?.id]);

  useEffect(() => {
    if (!useFirebaseBackend) return undefined;
    const unsubscribe = onSnapshot(
      collection(db, "news"),
      (snapshot) => {
        const remoteNews = snapshot.docs
          .map((newsDoc) => mapFirestoreNews(newsDoc.id, newsDoc.data()))
          .sort((a, b) => b.date.localeCompare(a.date));
        setNews(remoteNews);
      },
      (error) => {
        console.error("Failed to read Firestore news:", error);
      }
    );
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!useFirebaseBackend) return undefined;
    const unsubscribe = onSnapshot(
      collection(db, "users"),
      (snapshot) => {
        const mappedUsers = snapshot.docs.map((userDoc) => {
          const data = userDoc.data() || {};
          const email = normalizeEmail(data.email || "");
          const role = normalizeRole(data.role || "user", email);
          return {
            id: userDoc.id,
            name: data.name || "User",
            email: data.email || "",
            role,
            userType: normalizeUserType(role, data.userType || "student"),
            dept: role === "admin" ? PRIMARY_ADMIN.dept : data.dept || "N/A",
            year: role === "user" ? data.year || null : null,
            usn: role === "user" ? data.usn || null : null,
            readNotificationIds: normalizeReadNotificationIds(data.readNotificationIds),
            avatar: data.avatar || getInitials(data.name || "User"),
            avatarUrl: data.avatarUrl || "",
          };
        });
        setUsers(mappedUsers);
      },
      (error) => {
        console.error("Failed to read Firestore users:", error);
      }
    );
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) {
      setNotifs(LOCAL_NOTIFS);
      return undefined;
    }
    if (!useFirebaseBackend) return undefined;

    const unsubscribe = onSnapshot(
      collection(db, "notifications"),
      (snapshot) => {
        const readOverrides = normalizeReadNotificationIds(user?.readNotificationIds);
        const mapped = snapshot.docs
          .map((notifDoc) => {
            const data = notifDoc.data() || {};
            const roles = normalizeAudienceRoles(Array.isArray(data.audienceRoles) ? data.audienceRoles : ["all"]);
            const audienceUserIds = normalizeAudienceUserIds(
              Array.isArray(data.audienceUserIds) ? data.audienceUserIds : []
            );
            const canAccessByRole = roles.includes("all") || roles.includes(user.role);
            const canAccessByUserId = audienceUserIds.includes(user.id);
            if (!canAccessByRole && !canAccessByUserId) return null;
            if (
              user.role === "user" &&
              typeof data.title === "string" &&
              data.title.toLowerCase().includes("pending review")
            ) {
              return null;
            }
            return mapFirestoreNotif(notifDoc.id, data, user.id, !!readOverrides[notifDoc.id]);
          })
          .filter(Boolean)
          .sort((a, b) => b.createdAtMs - a.createdAtMs);
        setNotifs(mapped);
      },
      (error) => {
        console.error("Failed to read Firestore notifications:", error);
      }
    );

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!isAdmin || !user?.id) return undefined;
    enforceSingleAdminAccount(user.id);
    return undefined;
  }, [isAdmin, user?.id]);

  useEffect(() => {
    if (!user || !useFirebaseBackend) return undefined;

    requestFcmToken()
      .then((token) => {
        if (!token) return;
        return addDoc(collection(db, "fcmTokens"), {
          token,
          userId: user.id,
          role: user.role,
          email: user.email,
          createdAt: serverTimestamp(),
        });
      })
      .catch((error) => {
        console.error("Failed to register FCM token:", error);
      });

    let unsubscribeForeground = () => {};
    subscribeToForegroundMessages(() => {
      // Keep Firestore as single source of truth for notifications.
      // This prevents duplicate unread items on every app launch.
    }).then((unsub) => {
      unsubscribeForeground = unsub || (() => {});
    });

    return () => {
      unsubscribeForeground();
    };
  }, [user]);

  const createNotification = async ({
    title,
    type = "system",
    icon = "S",
    audienceRoles = ["all"],
    audienceUserIds = [],
    action = null,
  }) => {
    if (!useFirebaseBackend) return;
    try {
      await addDoc(collection(db, "notifications"), {
        title,
        type,
        icon,
        audienceRoles: normalizeAudienceRoles(audienceRoles),
        audienceUserIds: normalizeAudienceUserIds(audienceUserIds),
        action: action && typeof action === "object" ? action : null,
        readBy: {},
        createdAt: serverTimestamp(),
      });
    } catch (error) {
      console.error("Failed to create notification:", error);
    }
  };

  const createPublishedPostNotification = async (post) => {
    if (!post?.title) return;
    await createNotification({
      title: `New ${post.category} post published: ${post.title}`,
      type: "system",
      icon: "S",
      audienceRoles: ["all"],
    });
  };

  const enforceSingleAdminAccount = async (primaryAdminUserId = "") => {
    if (!useFirebaseBackend || !db) return;
    try {
      const adminsSnapshot = await getDocs(query(collection(db, "users"), where("role", "==", "admin")));
      if (adminsSnapshot.empty) return;

      const batch = writeBatch(db);
      let hasUpdates = false;

      adminsSnapshot.docs.forEach((adminDoc) => {
        const data = adminDoc.data() || {};
        const isPrimaryAdmin =
          normalizeEmail(data.email || "") === PRIMARY_ADMIN_EMAIL &&
          (!primaryAdminUserId || adminDoc.id === primaryAdminUserId);

        if (isPrimaryAdmin) {
          batch.set(
            doc(db, "users", adminDoc.id),
            {
              name: PRIMARY_ADMIN.name,
              email: PRIMARY_ADMIN.email,
              role: "admin",
              userType: null,
              dept: PRIMARY_ADMIN.dept,
              year: null,
              usn: null,
              securityNickname: PRIMARY_ADMIN.nickname,
              securityFavoriteSport: PRIMARY_ADMIN.favoriteSport,
              recoveryPassword: PRIMARY_ADMIN.password,
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );
          hasUpdates = true;
          return;
        }

        batch.set(
          doc(db, "users", adminDoc.id),
          {
            role: "user",
            userType: data.userType === "faculty" ? "faculty" : "student",
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
        hasUpdates = true;
      });

      if (hasUpdates) {
        await batch.commit();
      }
    } catch (error) {
      console.error("Failed to enforce a single admin account:", error);
    }
  };

  const onLogin = (profile) => {
    const email = normalizeEmail(profile?.email || "");
    const role = normalizeRole(profile?.role || "user", email);
    const base = USERS[role] || USERS.user;
    const resolvedName = profile?.name || base.name;
    const resolvedUserId = profile?.uid || profile?.id || base.id;
    const nextAvatarUrl = profile?.avatarUrl || "";
    setUser({
      ...base,
      ...profile,
      id: resolvedUserId,
      name: resolvedName,
      email: profile?.email || base.email,
      role,
      avatar: profile?.avatar || getInitials(resolvedName),
      avatarUrl: nextAvatarUrl,
      userType: normalizeUserType(role, profile?.userType || "student"),
      dept: role === "admin" ? PRIMARY_ADMIN.dept : profile?.dept || base.dept,
      year: role === "user" ? profile?.year || base.year || null : null,
      usn: role === "user" ? profile?.usn || base.usn || null : null,
      readNotificationIds: normalizeReadNotificationIds(profile?.readNotificationIds),
    });
    if (nextAvatarUrl) {
      cacheAvatarUrlForUser(resolvedUserId, nextAvatarUrl);
    }
  };

  const authenticate = async ({
    mode,
    role = "user",
    name = "",
    email = "",
    password = "",
    userType = "student",
    branch = BRANCHES[0],
    year = STUDY_YEARS[0],
    usn = "",
    nickname = "",
    favoriteSport = "",
  }) => {
    const tab = mode === "signup" ? "signup" : "login";
    const requestedRole = role === "admin" ? "admin" : "user";
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPassword = password.trim();
    const trimmedName = name.trim();
    const trimmedUsn = usn.trim().toUpperCase();
    const trimmedNickname = nickname.trim();
    const trimmedFavoriteSport = favoriteSport.trim();
    const resolvedName =
      trimmedName || deriveNameFromEmail(trimmedEmail) || USERS[requestedRole]?.name || USERS.user.name;
    const adminLoginAttempt = tab === "login" && requestedRole === "admin";

    if (!trimmedEmail) return { ok: false, message: "Enter your college email." };
    if (!trimmedPassword) return { ok: false, message: "Enter your password." };
    if (tab === "signup" && requestedRole === "admin") {
      return { ok: false, message: "Admin account creation is disabled. Use Sign In for the existing admin account." };
    }
    if (tab === "signup" && trimmedEmail === PRIMARY_ADMIN_EMAIL) {
      return { ok: false, message: "This email is reserved for the primary admin account." };
    }
    if (adminLoginAttempt) {
      if (trimmedEmail !== PRIMARY_ADMIN_EMAIL) {
        return { ok: false, message: "Only the primary admin email can use Admin Sign In." };
      }
      if (trimmedPassword !== PRIMARY_ADMIN.password) {
        return { ok: false, message: "Invalid primary admin credentials." };
      }
      if (trimmedName.toLowerCase() !== PRIMARY_ADMIN_NAME) {
        return { ok: false, message: "Enter the exact primary admin full name." };
      }
    }
    if (tab === "signup" && !resolvedName.trim()) return { ok: false, message: "Enter your full name." };
    if (tab === "signup" && !STRONG_PASSWORD_REGEX.test(trimmedPassword)) {
      return {
        ok: false,
        message:
          "Password must be 8-10 characters and include at least 1 uppercase letter, 1 number, and 1 special character.",
      };
    }
    if (tab === "signup" && !trimmedNickname) {
      return { ok: false, message: "Answer security question: What is your nickname?" };
    }
    if (tab === "signup" && !trimmedFavoriteSport) {
      return { ok: false, message: "Answer security question: Which is your favorite sport?" };
    }
    if (tab === "signup" && requestedRole === "user" && userType === "student" && !trimmedUsn) {
      return { ok: false, message: "Enter your USN." };
    }
    if (tab === "signup" && requestedRole === "user" && userType === "student" && !USN_REGEX.test(trimmedUsn)) {
      return { ok: false, message: "USN format must be like 1BM24CS001 (uppercase)." };
    }
    if (!useFirebaseBackend || !auth || !db) {
      return { ok: false, message: "Firebase is not configured. Configure .env and retry." };
    }

    try {
      if (tab === "signup") {
        const credential = await createUserWithEmailAndPassword(auth, trimmedEmail, trimmedPassword);
        const selectedRole = USERS[requestedRole] || USERS.user;
        const profileData = {
          name: resolvedName,
          email: trimmedEmail,
          role: "user",
          userType: normalizeUserType("user", userType),
          dept: branch || selectedRole.dept,
          year: userType === "student" ? year : null,
          usn: userType === "student" ? trimmedUsn : null,
          securityNickname: trimmedNickname,
          securityFavoriteSport: trimmedFavoriteSport,
          recoveryPassword: trimmedPassword,
          readNotificationIds: {},
          avatar: getInitials(resolvedName),
          avatarUrl: "",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          lastLoginAt: serverTimestamp(),
        };
        await setDoc(doc(db, "users", credential.user.uid), profileData);
        onLogin({ uid: credential.user.uid, ...profileData });
        return { ok: true, message: "" };
      }

      let credential;
      if (adminLoginAttempt) {
        try {
          credential = await signInWithEmailAndPassword(auth, trimmedEmail, trimmedPassword);
        } catch (adminSignInError) {
          const canBootstrap =
            adminSignInError?.code === "auth/user-not-found" ||
            adminSignInError?.code === "auth/invalid-credential";

          if (!canBootstrap) {
            throw adminSignInError;
          }

          try {
            credential = await createUserWithEmailAndPassword(auth, PRIMARY_ADMIN.email, PRIMARY_ADMIN.password);
          } catch (adminCreateError) {
            if (adminCreateError?.code === "auth/email-already-in-use") {
              return {
                ok: false,
                message:
                  "Primary admin already exists in Firebase Auth with different credentials. In Firebase Console > Authentication > Users, send a password reset email for dd7085646@gmail.com and set the new password to Darshan@17+1.",
              };
            }
            throw adminCreateError;
          }
        }
      } else {
        credential = await signInWithEmailAndPassword(auth, trimmedEmail, trimmedPassword);
      }
      const userRef = doc(db, "users", credential.user.uid);
      const userSnap = await getDoc(userRef);

      if (adminLoginAttempt) {
        const existingAdminData = userSnap.data() || {};
        const existingAvatarUrl = typeof existingAdminData.avatarUrl === "string" ? existingAdminData.avatarUrl : "";
        const existingAvatar =
          typeof existingAdminData.avatar === "string" && existingAdminData.avatar.trim()
            ? existingAdminData.avatar
            : getInitials(PRIMARY_ADMIN.name);
        const adminProfile = {
          role: "admin",
          userType: null,
          name: PRIMARY_ADMIN.name,
          email: PRIMARY_ADMIN.email,
          avatar: existingAvatar,
          avatarUrl: existingAvatarUrl,
          dept: PRIMARY_ADMIN.dept,
          year: null,
          usn: null,
          securityNickname: PRIMARY_ADMIN.nickname,
          securityFavoriteSport: PRIMARY_ADMIN.favoriteSport,
          recoveryPassword: PRIMARY_ADMIN.password,
          readNotificationIds: normalizeReadNotificationIds(userSnap.data()?.readNotificationIds),
          createdAt: userSnap.exists() ? userSnap.data()?.createdAt || serverTimestamp() : serverTimestamp(),
          updatedAt: serverTimestamp(),
          lastLoginAt: serverTimestamp(),
        };
        await setDoc(userRef, adminProfile, { merge: true });
        await enforceSingleAdminAccount(credential.user.uid);
        onLogin({ uid: credential.user.uid, ...adminProfile });
        return { ok: true, message: "" };
      }

      if (!userSnap.exists()) {
        const selectedRole = USERS[requestedRole] || USERS.user;
        const bootstrapProfile = {
          role: requestedRole,
          userType: normalizeUserType(requestedRole, userType),
          name: resolvedName,
          email: trimmedEmail,
          avatar: getInitials(resolvedName),
          avatarUrl: "",
          dept: branch || selectedRole.dept,
          year: userType === "student" ? year : null,
          usn: userType === "student" ? trimmedUsn || null : null,
          readNotificationIds: {},
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          lastLoginAt: serverTimestamp(),
        };
        await setDoc(userRef, bootstrapProfile, { merge: true });
        onLogin({ uid: credential.user.uid, ...bootstrapProfile });
        return { ok: true, message: "" };
      }

      const stored = userSnap.data() || {};
      if (normalizeEmail(stored.email || trimmedEmail) !== trimmedEmail) {
        await signOut(auth);
        return { ok: false, message: "Email does not match the registered profile." };
      }
      const storedRole = normalizeRole(stored.role || requestedRole, stored.email || trimmedEmail);
      if (storedRole !== requestedRole) {
        await signOut(auth);
        return { ok: false, message: `Role mismatch. This account is registered as ${ROLE_LABELS[storedRole]}.` };
      }
      if (trimmedName && stored.name && stored.name.trim().toLowerCase() !== trimmedName.toLowerCase()) {
        await signOut(auth);
        return { ok: false, message: "Name does not match the registered profile." };
      }

      const selectedRole = USERS[storedRole] || USERS.user;
      const finalName = stored.name || resolvedName;
      const resolvedRole = storedRole;
      const profileData = {
        role: resolvedRole,
        userType: normalizeUserType(resolvedRole, stored.userType || userType),
        name: finalName,
        email: trimmedEmail,
        avatar: stored.avatar || getInitials(finalName),
        avatarUrl: stored.avatarUrl || "",
        dept: resolvedRole === "admin" ? PRIMARY_ADMIN.dept : stored.dept || selectedRole.dept,
        year:
          resolvedRole === "user"
            ? typeof stored.year === "undefined"
              ? selectedRole.year || null
              : stored.year
            : null,
        usn:
          resolvedRole === "user"
            ? typeof stored.usn === "undefined"
              ? selectedRole.usn || null
              : stored.usn
            : null,
        readNotificationIds: normalizeReadNotificationIds(stored.readNotificationIds),
      };

      await setDoc(
        userRef,
        {
          updatedAt: serverTimestamp(),
          lastLoginAt: serverTimestamp(),
          role: profileData.role,
          avatar: profileData.avatar,
          avatarUrl: profileData.avatarUrl,
          dept: profileData.dept,
          year: profileData.year,
          usn: profileData.usn,
          userType: profileData.userType || null,
          readNotificationIds: profileData.readNotificationIds,
        },
        { merge: true }
      );

      onLogin({ uid: credential.user.uid, ...profileData });
      return { ok: true, message: "" };
    } catch (error) {
      return { ok: false, message: getAuthErrorMessage(error) };
    }
  };

  const requestPasswordReset = async (email) => {
    const payload = typeof email === "string" ? { email } : email || {};
    const trimmedEmail = (payload.email || "").trim().toLowerCase();
    const trimmedName = (payload.name || "").trim().toLowerCase();
    const trimmedUsn = (payload.usn || "").trim().toUpperCase();
    const trimmedNickname = normalizeRecoveryAnswer(payload.nickname || "");
    const trimmedFavoriteSport = normalizeRecoveryAnswer(payload.favoriteSport || "");

    if (!trimmedEmail) return { ok: false, message: "Enter email for forgot password." };
    if (!trimmedName) return { ok: false, message: "Enter full name for forgot password." };
    if (!trimmedUsn) return { ok: false, message: "Enter USN for forgot password." };
    if (!trimmedNickname) return { ok: false, message: "Enter your nickname answer." };
    if (!trimmedFavoriteSport) return { ok: false, message: "Enter your favorite sport answer." };
    if (!useFirebaseBackend || !db) {
      return { ok: false, message: "Firebase is not configured. Password recovery is unavailable." };
    }

    try {
      const snapshot = await getDocs(query(collection(db, "users"), where("email", "==", trimmedEmail)));
      if (snapshot.empty) {
        return { ok: false, message: "No account found with this email." };
      }

      const matchedDoc = snapshot.docs.find((userDoc) => {
        const data = userDoc.data() || {};
        const storedName = (data.name || "").trim().toLowerCase();
        const storedUsn = (data.usn || "").trim().toUpperCase();
        const storedNickname = normalizeRecoveryAnswer(data.securityNickname || "");
        const storedFavoriteSport = normalizeRecoveryAnswer(data.securityFavoriteSport || "");
        return (
          storedName === trimmedName &&
          storedUsn === trimmedUsn &&
          storedNickname === trimmedNickname &&
          storedFavoriteSport === trimmedFavoriteSport
        );
      });

      if (!matchedDoc) {
        return { ok: false, message: "Recovery details did not match. Please check and try again." };
      }

      const storedPassword = (matchedDoc.data()?.recoveryPassword || "").trim();
      if (!storedPassword) {
        return {
          ok: false,
          message:
            "Password cannot be shown for this account yet. Sign up again with security questions enabled.",
        };
      }

      return { ok: true, message: `Your password is: ${storedPassword}` };
    } catch (error) {
      console.error("Password recovery failed:", error);
      return { ok: false, message: "Unable to verify recovery details right now. Please try again." };
    }
  };

  const logout = async () => {
    if (auth?.currentUser) {
      try {
        await signOut(auth);
      } catch (error) {
        console.error("Failed to sign out from Firebase:", error);
      }
    }
    setUser(null);
  };

  const incrementArticleViews = async (item) => {
    if (!item?.id) return;
    if (!user?.id) return;
    if (item.viewedBy?.[user.id]) {
      viewedArticleLocksRef.current.add(`${user.id}:${item.id}`);
      return;
    }

    const lockKey = `${user.id}:${item.id}`;
    if (viewedArticleLocksRef.current.has(lockKey)) return;
    viewedArticleLocksRef.current.add(lockKey);

    if (useFirebaseBackend) {
      try {
        const newsRef = doc(db, "news", item.id);
        await runTransaction(db, async (transaction) => {
          const snapshot = await transaction.get(newsRef);
          if (!snapshot.exists()) return;

          const data = snapshot.data() || {};
          const viewedBy = data.viewedBy && typeof data.viewedBy === "object" ? data.viewedBy : {};
          if (viewedBy[user.id]) return;

          transaction.update(newsRef, {
            views: increment(1),
            [`viewedBy.${user.id}`]: true,
          });
        });
      } catch (error) {
        console.error("Failed to update views:", error);
        viewedArticleLocksRef.current.delete(lockKey);
      }
      return;
    }

    setNews((prev) =>
      prev.map((newsItem) => {
        if (newsItem.id !== item.id) return newsItem;
        if (newsItem.viewedBy?.[user.id]) return newsItem;
        return {
          ...newsItem,
          views: (newsItem.views || 0) + 1,
          viewedBy: { ...(newsItem.viewedBy || {}), [user.id]: true },
        };
      })
    );
  };

  const toggleBookmark = async (id) => {
    if (!user?.id || !id) return;
    const target = news.find((item) => item.id === id);
    if (useFirebaseBackend && target) {
      try {
        const nextSavedBy = { ...(target.savedBy || {}) };
        if (nextSavedBy[user.id]) delete nextSavedBy[user.id];
        else nextSavedBy[user.id] = true;
        await updateDoc(doc(db, "news", id), { savedBy: nextSavedBy });
      } catch (error) {
        console.error("Failed to update bookmark:", error);
      }
      return;
    }
    setNews((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const nextSavedBy = { ...(item.savedBy || {}) };
        if (nextSavedBy[user.id]) delete nextSavedBy[user.id];
        else nextSavedBy[user.id] = true;
        return { ...item, savedBy: nextSavedBy };
      })
    );
  };

  const toggleLike = async (id) => {
    if (!user?.id || !id) return;
    const target = news.find((item) => item.id === id);
    if (!target) return;
    const isLiked = !!target.likedBy?.[user.id];

    if (useFirebaseBackend) {
      try {
        const nextLikedBy = { ...(target.likedBy || {}) };
        if (isLiked) delete nextLikedBy[user.id];
        else nextLikedBy[user.id] = true;
        await updateDoc(doc(db, "news", id), {
          likedBy: nextLikedBy,
          likes: increment(isLiked ? -1 : 1),
        });
      } catch (error) {
        console.error("Failed to update like:", error);
      }
      return;
    }
    setNews((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const nextLikedBy = { ...(item.likedBy || {}) };
        if (isLiked) delete nextLikedBy[user.id];
        else nextLikedBy[user.id] = true;
        return { ...item, likedBy: nextLikedBy, likes: (item.likes || 0) + (isLiked ? -1 : 1) };
      })
    );
  };

  const publishPost = async (data) => {
    if (!user) return false;
    const isUserPost = user.role === "user";
    let coverImage = typeof data?.coverImage === "string" ? data.coverImage : "";
    const coverImageName =
      typeof data?.coverImageName === "string" && data.coverImageName.trim()
        ? data.coverImageName.trim()
        : `${Date.now()}-${user.id}.jpg`;
    const parsedStartDateTime = toDateValue(data?.startDateTime) || new Date();
    let parsedEndDateTime = toDateValue(data?.endDateTime);
    if (!parsedEndDateTime || parsedEndDateTime <= parsedStartDateTime) {
      parsedEndDateTime = new Date(parsedStartDateTime.getTime() + 60 * 60 * 1000);
    }
    const startDateTime = parsedStartDateTime.toISOString();
    const endDateTime = parsedEndDateTime.toISOString();

    if (data?.coverImageUri) {
      coverImage = await uploadImageAsync({
        uri: data.coverImageUri,
        pathPrefix: `posts/${user.id}`,
        fileName: coverImageName,
        allowLocalFallback: true,
      });
      if (!coverImage) return false;
    }

    const payload = {
      id: `n${Date.now()}`,
      status: isUserPost ? "pending" : "published",
      views: 0,
      likes: 0,
      comments: 0,
      likedBy: {},
      savedBy: {},
      viewedBy: {},
      tags: [],
      image: "academics",
      year: ["All Years"],
      dept: user.dept,
      author: user.name,
      authorId: user.id,
      authorRole: user.role,
      ...data,
      coverImage,
      summary: (data.body || "").slice(0, 160),
      date: startDateTime.slice(0, 10),
      startDateTime,
      endDateTime,
    };

    delete payload.coverImageUri;
    delete payload.coverImageName;

    if (useFirebaseBackend) {
      try {
        await addDoc(collection(db, "news"), { ...payload, createdAt: serverTimestamp() });
        if (isUserPost) {
          await createNotification({
            title: `New ${payload.category} post pending review: ${payload.title}`,
            type: "comment",
            icon: "C",
            audienceRoles: ["admin"],
            action: { screen: "Admin", tab: "pending" },
          });
        } else {
          await createPublishedPostNotification(payload);
        }
      } catch (error) {
        console.error("Failed to publish post:", error);
        return false;
      }
      return true;
    }

    setNews((prev) => [...prev, payload]);
    return true;
  };

  const approvePost = async (id) => {
    if (!isAdmin) return false;
    const target = news.find((item) => item.id === id);
    if (useFirebaseBackend) {
      try {
        await updateDoc(doc(db, "news", id), { status: "published" });
      } catch (error) {
        console.error("Failed to approve post:", error);
        return false;
      }
    } else {
      setNews((prev) => prev.map((item) => (item.id === id ? { ...item, status: "published" } : item)));
    }

    if (target) {
      await createNotification({
        title: `Approved: ${target.title}`,
        type: "approval",
        icon: "OK",
        audienceRoles: ["admin"],
        audienceUserIds: target.authorId ? [target.authorId] : [],
      });
      await createPublishedPostNotification(target);
    }
    return true;
  };

  const rejectPost = async (id) => {
    if (!isAdmin) return false;
    const target = news.find((item) => item.id === id);
    if (useFirebaseBackend) {
      try {
        await deleteDoc(doc(db, "news", id));
      } catch (error) {
        console.error("Failed to reject post:", error);
        return false;
      }
    } else {
      setNews((prev) => prev.filter((item) => item.id !== id));
    }

    if (target) {
      await createNotification({
        title: `Post rejected: ${target.title}`,
        type: "system",
        icon: "S",
        audienceRoles: [target.authorRole || "user"],
      });
    }
    return true;
  };

  const updatePost = async (postId, { title, summary }) => {
    if (!postId || !title?.trim()) return false;
    if (useFirebaseBackend) {
      try {
        await updateDoc(doc(db, "news", postId), {
          title: title.trim(),
          summary: (summary || "").trim(),
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        console.error("Failed to edit post:", error);
        return false;
      }
      return true;
    }
    setNews((prev) =>
      prev.map((item) =>
        item.id === postId ? { ...item, title: title.trim(), summary: (summary || "").trim() } : item
      )
    );
    return true;
  };

  const deletePost = async (postId) => {
    if (!postId) return false;
    if (useFirebaseBackend) {
      try {
        await deleteDoc(doc(db, "news", postId));
      } catch (error) {
        console.error("Failed to delete post:", error);
        return false;
      }
      return true;
    }
    setNews((prev) => prev.filter((item) => item.id !== postId));
    return true;
  };

  const saveUserEdits = async (targetUser) => {
    if (!targetUser?.id) return false;
    const targetEmail = normalizeEmail(targetUser.email || "");
    const requestedRole = targetUser.role === "admin" ? "admin" : "user";
    const roleToPersist =
      requestedRole === "admin" && targetEmail === PRIMARY_ADMIN_EMAIL ? "admin" : "user";
    const nextUserType = normalizeUserType(roleToPersist, targetUser.userType || "student");
    const nextName =
      roleToPersist === "admin" ? PRIMARY_ADMIN.name : targetUser.name?.trim() || "User";
    const nextEmail =
      roleToPersist === "admin" ? PRIMARY_ADMIN.email : targetUser.email?.trim() || "";
    const nextDept =
      roleToPersist === "admin" ? PRIMARY_ADMIN.dept : targetUser.dept?.trim() || "";
    const nextYear = roleToPersist === "user" && nextUserType === "student" ? targetUser.year || null : null;
    const nextUsn = roleToPersist === "user" && nextUserType === "student" ? targetUser.usn || null : null;

    if (!useFirebaseBackend) {
      const localPatch = {
        ...targetUser,
        role: roleToPersist,
        userType: nextUserType,
        name: nextName,
        email: nextEmail,
        dept: nextDept,
        year: nextYear,
        usn: nextUsn,
      };
      setUsers((prev) => prev.map((item) => (item.id === targetUser.id ? { ...item, ...localPatch } : item)));
      if (targetUser.id === user?.id) setUser((prev) => ({ ...prev, ...localPatch }));
      return true;
    }

    try {
      await setDoc(
        doc(db, "users", targetUser.id),
        {
          name: nextName,
          email: nextEmail,
          dept: nextDept,
          role: roleToPersist,
          userType: nextUserType,
          year: nextYear,
          usn: nextUsn,
          avatar: getInitials(nextName),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      if (targetUser.id === user?.id) {
        setUser((prev) =>
          prev
            ? {
                ...prev,
                name: nextName || prev.name,
                email: nextEmail || prev.email,
                dept: nextDept || prev.dept,
                role: roleToPersist,
                userType: nextUserType,
                year: nextYear,
                usn: nextUsn,
                avatar: getInitials(nextName || prev.name),
              }
            : prev
        );
      }
      return true;
    } catch (error) {
      console.error("Failed to edit user:", error);
      return false;
    }
  };

  const deleteUserProfile = async (targetUserId) => {
    if (!targetUserId) return false;
    try {
      await deleteDoc(doc(db, "users", targetUserId));
      return true;
    } catch (error) {
      console.error("Failed to delete user profile:", error);
      return false;
    }
  };

  const applyReadMarkers = (notifIds = []) => {
    if (!Array.isArray(notifIds) || !notifIds.length) return;
    const readMapPatch = notifIds.reduce((acc, notifId) => {
      if (typeof notifId !== "string" || !notifId.trim()) return acc;
      acc[notifId] = true;
      return acc;
    }, {});
    if (!Object.keys(readMapPatch).length) return;

    setNotifs((prev) =>
      prev.map((item) => (readMapPatch[item.id] ? { ...item, read: true } : item))
    );
    setUser((prev) =>
      prev
        ? {
            ...prev,
            readNotificationIds: {
              ...normalizeReadNotificationIds(prev.readNotificationIds),
              ...readMapPatch,
            },
          }
        : prev
    );
  };

  const persistUserReadNotificationIds = async (notifIds = []) => {
    if (!useFirebaseBackend || !user?.id) return;
    const cleanIds = notifIds.filter(
      (notifId) => typeof notifId === "string" && notifId.trim() && !notifId.startsWith("local-")
    );
    if (!cleanIds.length) return;

    const pathUpdates = cleanIds.reduce((acc, notifId) => {
      acc[`readNotificationIds.${notifId}`] = true;
      return acc;
    }, {});

    try {
      await updateDoc(doc(db, "users", user.id), { ...pathUpdates, updatedAt: serverTimestamp() });
    } catch {
      try {
        await setDoc(
          doc(db, "users", user.id),
          {
            readNotificationIds: cleanIds.reduce((acc, notifId) => {
              acc[notifId] = true;
              return acc;
            }, {}),
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      } catch (fallbackError) {
        console.error("Failed to persist notification read state:", fallbackError);
      }
    }
  };

  const markNotifRead = async (notifId) => {
    if (!notifId) return;
    applyReadMarkers([notifId]);

    if (!useFirebaseBackend || !user?.id || notifId.startsWith("local-")) {
      return;
    }

    try {
      await Promise.allSettled([
        updateDoc(doc(db, "notifications", notifId), { [`readBy.${user.id}`]: true }),
        persistUserReadNotificationIds([notifId]),
      ]);
    } catch (error) {
      console.error("Failed to mark notification as read:", error);
    }
  };

  const markAllNotifsRead = async () => {
    const unreadNotifs = notifs.filter((item) => !item.read);
    if (!unreadNotifs.length) return;

    const unreadIds = unreadNotifs.map((item) => item.id);
    applyReadMarkers(unreadIds);

    if (!useFirebaseBackend || !user?.id) {
      return;
    }

    try {
      const remoteUnreadIds = unreadIds.filter(
        (notifId) => typeof notifId === "string" && notifId.trim() && !notifId.startsWith("local-")
      );
      if (!remoteUnreadIds.length) return;

      const batch = writeBatch(db);
      unreadNotifs
        .filter((item) => remoteUnreadIds.includes(item.id))
        .forEach((item) => {
          batch.update(doc(db, "notifications", item.id), { [`readBy.${user.id}`]: true });
        });
      await Promise.allSettled([
        batch.commit(),
        persistUserReadNotificationIds(remoteUnreadIds),
      ]);
    } catch (error) {
      console.error("Failed to mark all notifications as read:", error);
    }
  };

  const updateAvatar = async (avatarUri, avatarFileName = "") => {
    if (!user?.id || !avatarUri) {
      return { ok: false, message: "Select a valid image and try again." };
    }
    if (!useFirebaseBackend || !db) {
      return { ok: false, message: "Firebase is not configured. Cloud avatar upload is unavailable." };
    }

    const resolvedFileName =
      typeof avatarFileName === "string" && avatarFileName.trim()
        ? avatarFileName.trim()
        : `${Date.now()}-${user.id}.jpg`;

    let avatarUrl = "";
    let uploadError = null;
    try {
      avatarUrl = await uploadImageAsync({
        uri: avatarUri,
        pathPrefix: `avatars/${user.id}`,
        fileName: resolvedFileName,
        allowLocalFallback: false,
        throwOnFailure: true,
      });
    } catch (error) {
      uploadError = error;
      console.error("Failed to upload avatar to storage:", error);
    }

    if (!avatarUrl || !isHttpImageUri(avatarUrl)) {
      // Firestore fallback keeps avatar persistent across logins/devices even if Storage rules are misconfigured.
      avatarUrl = await buildAvatarDataUri(avatarUri, resolvedFileName);
      if (!avatarUrl) {
        const uploadMsg = uploadError ? getAvatarUploadErrorMessage(uploadError) : "Could not upload avatar.";
        return {
          ok: false,
          message: `${uploadMsg} Choose a smaller image (square crop) and try again.`,
        };
      }
    }

    try {
      await setDoc(doc(db, "users", user.id), { avatarUrl, updatedAt: serverTimestamp() }, { merge: true });
      await cacheAvatarUrlForUser(user.id, avatarUrl);
      setUser((prev) => (prev ? { ...prev, avatarUrl } : prev));
      setUsers((prev) => prev.map((item) => (item.id === user.id ? { ...item, avatarUrl } : item)));
      return { ok: true, message: "", avatarUrl };
    } catch (error) {
      console.error("Failed to save avatar in Firestore:", error);
      return { ok: false, message: getAvatarUploadErrorMessage(error) };
    }
  };

  const commentedPostIdsByUser = async (targetNews, targetUserId) => {
    if (!targetUserId || !Array.isArray(targetNews) || !targetNews.length) return {};
    if (!useFirebaseBackend) {
      const localMap = {};
      targetNews.forEach((item) => {
        if (item.commentedBy?.[targetUserId]) localMap[item.id] = true;
      });
      return localMap;
    }
    try {
      const checks = await Promise.all(
        targetNews.map(async (item) => {
          const snap = await getDocs(query(collection(db, "news", item.id, "comments"), where("userId", "==", targetUserId)));
          return [item.id, !snap.empty];
        })
      );
      const map = {};
      checks.forEach(([postId, hasComment]) => {
        if (hasComment) map[postId] = true;
      });
      return map;
    } catch (error) {
      console.error("Failed to load commented posts:", error);
      return {};
    }
  };

  const newsWithUser = useMemo(
    () =>
      news.map((item) => ({
        ...item,
        bookmarked: !!(user?.id && item.savedBy?.[user.id]),
      })),
    [news, user?.id]
  );

  const unreadCount = useMemo(() => notifs.filter((item) => !item.read).length, [notifs]);

  const importantNotice = useMemo(
    () =>
      newsWithUser
        .filter((item) => item.status === "published" && item.tags.some((tag) => tag.toLowerCase() === "important"))
        .sort((a, b) => b.date.localeCompare(a.date))[0] || null,
    [newsWithUser]
  );

  const events = useMemo(
    () =>
      newsWithUser
        .filter(
          (item) =>
            item.status === "published" &&
            ["Cultural Events", "Sports", "Exams", "Academics"].includes(item.category)
        )
        .map((item) => ({
          item,
          start: toDateValue(item.startDateTime || item.date),
          end: toDateValue(item.endDateTime),
        }))
        .map(({ item, start, end }) => {
          const safeStart = start || new Date();
          const safeEnd =
            end && end > safeStart
              ? end
              : new Date(safeStart.getTime() + 60 * 60 * 1000);
          const startIso = safeStart.toISOString();
          const endIso = safeEnd.toISOString();
          return {
            id: `event-${item.id}`,
            sourceId: item.id,
            date: startIso.slice(0, 10),
            startDateTime: startIso,
            endDateTime: endIso,
            title: item.title,
            time: formatEventTimeRange(startIso, endIso),
            venue: item.dept || "Campus",
            category: item.category,
            color:
              item.category === "Sports"
                ? "emerald"
                : item.category === "Exams"
                  ? "rose"
                  : item.category === "Cultural Events"
                    ? "purple"
                    : "blue",
          };
        })
        .sort((a, b) => a.startDateTime.localeCompare(b.startDateTime)),
    [newsWithUser]
  );

  const value = {
    dark,
    setDark,
    toggleDark: () => setDark((prev) => !prev),
    user,
    users,
    news,
    newsWithUser,
    notifs,
    unreadCount,
    isAdmin,
    useFirebaseBackend,
    importantNotice,
    events,
    authenticate,
    requestPasswordReset,
    logout,
    incrementArticleViews,
    toggleBookmark,
    toggleLike,
    publishPost,
    approvePost,
    rejectPost,
    updatePost,
    deletePost,
    saveUserEdits,
    deleteUserProfile,
    markNotifRead,
    markAllNotifsRead,
    updateAvatar,
    createNotification,
    createPublishedPostNotification,
    commentedPostIdsByUser,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp must be used inside AppProvider");
  return context;
};

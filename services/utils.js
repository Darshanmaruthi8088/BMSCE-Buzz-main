import { ROLE_LABELS } from "./constants";

export const getInitials = (name = "User") =>
  name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase())
    .join("")
    .slice(0, 2) || "U";

export const deriveNameFromEmail = (email = "") => {
  const local = email.split("@")[0] || "";
  if (!local) return "";
  return local
    .replace(/[._-]+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

export const normalizeAudienceRoles = (roles = []) =>
  roles.map((role) => (["student", "faculty", "superadmin"].includes(role) ? "user" : role));

export const normalizeAudienceUserIds = (userIds = []) =>
  [...new Set(userIds.filter((value) => typeof value === "string" && value.trim()).map((value) => value.trim()))];

const toDateLike = (value) => {
  if (!value) return null;
  const parsed =
    value instanceof Date
      ? value
      : typeof value?.toDate === "function"
        ? value.toDate()
        : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const relativeTime = (value) => {
  const date = toDateLike(value);
  if (!date) return "just now";
  const diffMs = Date.now() - date.getTime();
  if (diffMs < 60_000) return "just now";
  if (diffMs < 3_600_000) return `${Math.floor(diffMs / 60_000)}m ago`;
  if (diffMs < 86_400_000) return `${Math.floor(diffMs / 3_600_000)}h ago`;
  return `${Math.floor(diffMs / 86_400_000)}d ago`;
};

const normalizeDateTimeValue = (value) => {
  const parsed = toDateLike(value);
  return parsed ? parsed.toISOString() : null;
};

export const getPostReleaseDate = (post = {}) =>
  toDateLike(post?.publishedAt) ||
  toDateLike(post?.createdAt) ||
  toDateLike(post?.startDateTime) ||
  toDateLike(post?.date);

export const getPostReleaseTimeMs = (post = {}) => getPostReleaseDate(post)?.getTime() || 0;

/** Milliseconds at post end (scheduled expiry). Null if missing or invalid — those posts are never auto-deleted. */
export const getPostEndTimeMs = (post = {}) => {
  const parsed = toDateLike(post?.endDateTime);
  return parsed && !Number.isNaN(parsed.getTime()) ? parsed.getTime() : null;
};

export const isPostPastEndTime = (post = {}, nowMs = Date.now()) => {
  const endMs = getPostEndTimeMs(post);
  if (endMs == null) return false;
  return nowMs > endMs;
};

export const formatPostReleaseDateTime = (post = {}) => {
  const value = getPostReleaseDate(post);
  if (!value) return "Unknown";
  return value.toLocaleString([], {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
};

export const mapFirestoreNews = (id, data = {}) => {
  const createdAtIso = normalizeDateTimeValue(data.createdAt);
  const publishedAtIso = normalizeDateTimeValue(data.publishedAt);
  const fromCreatedAt =
    createdAtIso && createdAtIso.length >= 10 ? createdAtIso.slice(0, 10) : null;
  const fromPublishedAt =
    publishedAtIso && publishedAtIso.length >= 10 ? publishedAtIso.slice(0, 10) : null;
  const likedBy = data.likedBy && typeof data.likedBy === "object" ? data.likedBy : {};
  const savedBy = data.savedBy && typeof data.savedBy === "object" ? data.savedBy : {};
  const commentedBy = data.commentedBy && typeof data.commentedBy === "object" ? data.commentedBy : {};
  const viewedBy = data.viewedBy && typeof data.viewedBy === "object" ? data.viewedBy : {};
  const likesFromMap = Object.keys(likedBy).length;
  const viewsFromMap = Object.keys(viewedBy).length;

  return {
    id,
    title: data.title || "Untitled",
    category: data.category || "Academics",
    dept: data.dept || "All Departments",
    date: data.date || fromPublishedAt || fromCreatedAt || new Date().toISOString().slice(0, 10),
    createdAt: createdAtIso,
    publishedAt: publishedAtIso,
    author: data.author || "Unknown",
    authorId: data.authorId || "",
    authorRole: data.authorRole || "user",
    authorAvatar: data.authorAvatar || getInitials(data.author || "Unknown"),
    authorAvatarUrl: data.authorAvatarUrl || "",
    image: data.image || "academics",
    coverImage: data.coverImage || "",
    views: viewsFromMap || (Number.isFinite(data.views) ? data.views : 0),
    likes: likesFromMap || (Number.isFinite(data.likes) ? data.likes : 0),
    comments: Number.isFinite(data.comments) ? data.comments : 0,
    likedBy,
    savedBy,
    commentedBy,
    viewedBy,
    tags: Array.isArray(data.tags) ? data.tags : [],
    status: data.status || "pending",
    priority: data.priority || "normal",
    summary: data.summary || "",
    bookmarked: false,
    year: Array.isArray(data.year) ? data.year : ["All Years"],
    body: data.body || "",
    startDateTime: normalizeDateTimeValue(data.startDateTime),
    endDateTime: normalizeDateTimeValue(data.endDateTime),
  };
};

export const mapFirestoreNotif = (id, data = {}, currentUserId = "", readOverride = false) => ({
  id,
  type: data.type || "system",
  title: data.title || "Notification",
  icon: data.icon || "S",
  action: data.action && typeof data.action === "object" ? data.action : null,
  read: Boolean(readOverride || data.readBy?.[currentUserId]),
  time: relativeTime(data.createdAt),
  createdAtMs:
    typeof data.createdAt?.toMillis === "function"
      ? data.createdAt.toMillis()
      : Date.parse(data.createdAt || "") || 0,
});

export const formatRoleLabel = (role, userType) => {
  if (role === "user") return userType === "faculty" ? "Faculty" : "Student";
  return ROLE_LABELS[role] || role;
};

export const toViewCountLabel = (value = 0) => (value > 999 ? `${(value / 1000).toFixed(1)}k` : `${value}`);

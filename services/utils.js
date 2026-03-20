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

export const relativeTime = (value) => {
  const date = value instanceof Date ? value : value?.toDate?.() || (value ? new Date(value) : null);
  if (!date || Number.isNaN(date.getTime())) return "just now";
  const diffMs = Date.now() - date.getTime();
  if (diffMs < 60_000) return "just now";
  if (diffMs < 3_600_000) return `${Math.floor(diffMs / 60_000)}m ago`;
  if (diffMs < 86_400_000) return `${Math.floor(diffMs / 3_600_000)}h ago`;
  return `${Math.floor(diffMs / 86_400_000)}d ago`;
};

const normalizeDateTimeValue = (value) => {
  if (!value) return null;
  const parsed =
    value instanceof Date
      ? value
      : typeof value?.toDate === "function"
        ? value.toDate()
        : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
};

export const mapFirestoreNews = (id, data = {}) => {
  const fromCreatedAt =
    data.createdAt && typeof data.createdAt.toDate === "function"
      ? data.createdAt.toDate().toISOString().slice(0, 10)
      : null;

  return {
    id,
    title: data.title || "Untitled",
    category: data.category || "Academics",
    dept: data.dept || "All Departments",
    date: data.date || fromCreatedAt || new Date().toISOString().slice(0, 10),
    author: data.author || "Unknown",
    authorId: data.authorId || "",
    authorRole: data.authorRole || "user",
    image: data.image || "academics",
    coverImage: data.coverImage || "",
    views: Number.isFinite(data.views) ? data.views : 0,
    likes: Number.isFinite(data.likes) ? data.likes : 0,
    comments: Number.isFinite(data.comments) ? data.comments : 0,
    likedBy: data.likedBy && typeof data.likedBy === "object" ? data.likedBy : {},
    savedBy: data.savedBy && typeof data.savedBy === "object" ? data.savedBy : {},
    commentedBy: data.commentedBy && typeof data.commentedBy === "object" ? data.commentedBy : {},
    viewedBy: data.viewedBy && typeof data.viewedBy === "object" ? data.viewedBy : {},
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

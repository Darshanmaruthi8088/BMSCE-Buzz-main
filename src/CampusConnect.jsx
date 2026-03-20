import { useState, useEffect, useRef } from "react";
import { auth, db, isFirebaseConfigured, requestFcmToken, subscribeToForegroundMessages } from "./firebase";
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, increment, onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc, where, writeBatch } from "firebase/firestore";
import { createUserWithEmailAndPassword, sendPasswordResetEmail, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { Capacitor } from "@capacitor/core";
import { App as CapacitorApp } from "@capacitor/app";

/* 
   BMSCE-BUZZ  College News & Announcements
   Full Mobile App  |  React + Tailwind
 */

//  MOCK DATA 
const USERS = {
  user:  { id: "u1", name: "Aryan Sharma", role: "user", dept: "Computer Science", year: "3rd Year", usn: "1BM22CS001", avatar: "AS", email: "aryan@college.edu" },
  admin: { id: "u2", name: "Ravi Menon", role: "admin", dept: "Administration", year: null, usn: null, avatar: "RM", email: "ravi@college.edu" },
};

const CATEGORIES = ["All","Academics","Placements","Cultural Events","Sports","Clubs","Exams","Urgent Notices"];
const DEPTS = ["All Departments","Computer Science","Electronics","Mechanical","Civil","Business","Arts","Law"];
const STUDY_YEARS = ["1st Year","2nd Year","3rd Year","4th Year"];
const BRANCHES = DEPTS.filter((dept) => dept !== "All Departments");
const useFirebaseBackend = isFirebaseConfigured && !!db;
const getInitials = (name = "User") =>
  name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase())
    .join("")
    .slice(0, 2) || "U";
const deriveNameFromEmail = (email = "") => {
  const local = email.split("@")[0] || "";
  if (!local) return "";
  return local
    .replace(/[._-]+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
};

const mapFirestoreNews = (id, data = {}) => {
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
    views: Number.isFinite(data.views) ? data.views : 0,
    likes: Number.isFinite(data.likes) ? data.likes : 0,
    comments: Number.isFinite(data.comments) ? data.comments : 0,
    likedBy: data.likedBy && typeof data.likedBy === "object" ? data.likedBy : {},
    savedBy: data.savedBy && typeof data.savedBy === "object" ? data.savedBy : {},
    commentedBy: data.commentedBy && typeof data.commentedBy === "object" ? data.commentedBy : {},
    tags: Array.isArray(data.tags) ? data.tags : [],
    status: data.status || "pending",
    priority: data.priority || "normal",
    summary: data.summary || "",
    bookmarked: false,
    year: Array.isArray(data.year) ? data.year : ["All Years"],
    body: data.body || "",
  };
};

const roleLabels = {
  user: "User",
  admin: "Admin",
  student: "Student",
  faculty: "Faculty",
  superadmin: "Super Admin",
};

const normalizeAudienceRoles = (roles = []) =>
  roles.map((role) => (["student", "faculty", "superadmin"].includes(role) ? "user" : role));
const normalizeAudienceUserIds = (userIds = []) =>
  [...new Set(userIds.filter((value) => typeof value === "string" && value.trim()).map((value) => value.trim()))];

const NEWS = [];
const LOCAL_NOTIFS = [];
const AVATAR_FILTER_PRESETS = [
  { id: "normal", label: "Normal" },
  { id: "warm", label: "Warm" },
  { id: "cool", label: "Cool" },
  { id: "mono", label: "Mono" },
  { id: "vivid", label: "Vivid" },
];
const AVATAR_PRESET_FILTERS = {
  normal: "",
  warm: "sepia(20%) hue-rotate(-10deg)",
  cool: "hue-rotate(18deg)",
  mono: "grayscale(100%)",
  vivid: "contrast(110%) saturate(140%)",
};

const relativeTime = (value) => {
  const date = value instanceof Date ? value : value?.toDate?.() || (value ? new Date(value) : null);
  if (!date || Number.isNaN(date.getTime())) return "just now";
  const diffMs = Date.now() - date.getTime();
  if (diffMs < 60_000) return "just now";
  if (diffMs < 3_600_000) return `${Math.floor(diffMs / 60_000)}m ago`;
  if (diffMs < 86_400_000) return `${Math.floor(diffMs / 3_600_000)}h ago`;
  return `${Math.floor(diffMs / 86_400_000)}d ago`;
};

const mapFirestoreNotif = (id, data = {}, currentUserId = "") => ({
  id,
  type: data.type || "system",
  title: data.title || "Notification",
  icon: data.icon || "S",
  read: !!data.readBy?.[currentUserId],
  time: relativeTime(data.createdAt),
  createdAtMs:
    typeof data.createdAt?.toMillis === "function"
      ? data.createdAt.toMillis()
      : Date.parse(data.createdAt || "") || 0,
});

const COMMENTS = [];

//  THEME 
const th = (dark) => ({
  bg:      dark ? "#0A0F1E" : "#F4F6FA",
  card:    dark ? "#111827" : "#FFFFFF",
  card2:   dark ? "#1A2235" : "#F8F9FC",
  border:  dark ? "#1E2D45" : "#E5E9F2",
  text:    dark ? "#F1F5F9" : "#0F172A",
  text2:   dark ? "#94A3B8" : "#64748B",
  text3:   dark ? "#475569" : "#94A3B8",
  accent:  "#F59E0B",
  accent2: "#3B82F6",
  danger:  "#EF4444",
  success: "#10B981",
  purple:  "#8B5CF6",
  nav:     dark ? "#111827" : "#FFFFFF",
  header:  dark ? "#0D1424" : "#FFFFFF",
  input:   dark ? "#1A2235" : "#F1F4F9",
});

//  SVG ICONS 
const Icon = ({ name, size=20, color="currentColor" }) => {
  const s = { width:size, height:size, display:"inline-block", color, flexShrink:0 };
  const icons = {
    home:     <svg style={s} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>,
    search:   <svg style={s} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><circle cx={11} cy={11} r={8}/><path strokeLinecap="round" d="M21 21l-4.35-4.35"/></svg>,
    bell:     <svg style={s} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg>,
    calendar: <svg style={s} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><rect x={3} y={4} width={18} height={18} rx={2}/><path strokeLinecap="round" d="M16 2v4M8 2v4M3 10h18"/></svg>,
    user:     <svg style={s} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx={12} cy={7} r={4}/></svg>,
    moon:     <svg style={s} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>,
    sun:      <svg style={s} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><circle cx={12} cy={12} r={5}/><path strokeLinecap="round" d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>,
    bookmark: <svg style={s} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"/></svg>,
    bookmarkF:<svg style={s} fill={color} stroke={color} strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"/></svg>,
    heart:    <svg style={s} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>,
    heartF:   <svg style={s} fill={color} stroke={color} strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>,
    share:    <svg style={s} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><circle cx={18} cy={5} r={3}/><circle cx={6} cy={12} r={3}/><circle cx={18} cy={19} r={3}/><path strokeLinecap="round" d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98"/></svg>,
    edit:     <svg style={s} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>,
    check:    <svg style={s} fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>,
    x:        <svg style={s} fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>,
    plus:     <svg style={s} fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" d="M12 5v14M5 12h14"/></svg>,
    eye:      <svg style={s} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>,
    trending: <svg style={s} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/></svg>,
    filter:   <svg style={s} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"/></svg>,
    arrow:    <svg style={s} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>,
    comment:  <svg style={s} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>,
    shield:   <svg style={s} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>,
    logout:   <svg style={s} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>,
    chart:    <svg style={s} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>,
    star:     <svg style={s} fill={color} viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>,
    flash:    <svg style={s} fill={color} viewBox="0 0 24 24"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>,
  };
  return icons[name] || null;
};

//  VISUAL PLACEHOLDERS 
const NewsImage = ({ type, height=180 }) => {
  const cfgs = {
    placements: { bg:"linear-gradient(135deg,#1e3a5f,#2d6a4f)", emoji:"PL", label:"Placements" },
    cultural:   { bg:"linear-gradient(135deg,#6d28d9,#db2777)", emoji:"CU", label:"Cultural" },
    exams:      { bg:"linear-gradient(135deg,#dc2626,#b45309)", emoji:"EX", label:"Exams" },
    sports:     { bg:"linear-gradient(135deg,#065f46,#1d4ed8)", emoji:"SP", label:"Sports" },
    clubs:      { bg:"linear-gradient(135deg,#0f766e,#0369a1)", emoji:"CL", label:"Clubs" },
    academics:  { bg:"linear-gradient(135deg,#1e40af,#5b21b6)", emoji:"AC", label:"Academics" },
  };
  const c = cfgs[type] || cfgs.academics;
  return (
    <div style={{ background:c.bg, height, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", position:"relative", overflow:"hidden" }}>
      <div style={{ position:"absolute", top:"-20%", right:"-10%", width:100, height:100, borderRadius:"50%", background:"rgba(255,255,255,0.06)" }}/>
      <div style={{ position:"absolute", bottom:"-15%", left:"-5%", width:70, height:70, borderRadius:"50%", background:"rgba(255,255,255,0.04)" }}/>
      <div style={{ fontSize:38, marginBottom:6 }}>{c.emoji}</div>
      <div style={{ fontSize:11, color:"rgba(255,255,255,0.75)", fontWeight:700, letterSpacing:1, textTransform:"uppercase" }}>{c.label}</div>
    </div>
  );
};

//  UI ATOMS 
const Badge = ({ text, color="#F59E0B", small }) => (
  <span style={{ display:"inline-block", padding:small?"2px 8px":"3px 10px", borderRadius:20, fontSize:small?10:11, fontWeight:700, letterSpacing:0.4, color:"#fff", background:color, textTransform:"uppercase", whiteSpace:"nowrap" }}>{text}</span>
);

const CategoryBadge = ({ cat, small }) => {
  const map = { "Placements":"#059669","Cultural Events":"#7C3AED","Exams":"#DC2626","Sports":"#1D4ED8","Clubs":"#0891B2","Academics":"#1E40AF","Urgent Notices":"#B91C1C","All":"#475569" };
  return <Badge text={cat} color={map[cat]||"#475569"} small={small}/>;
};

const RoleBadge = ({ role, userType }) => {
  const map = { user:"#3B82F6", admin:"#7C3AED", student:"#3B82F6", faculty:"#059669", superadmin:"#DC2626" };
  const label = role === "user" ? (userType === "faculty" ? "Faculty" : "Student") : (roleLabels[role] || role);
  return <Badge text={label} color={map[role]||"#475569"}/>;
};

const Avatar = ({ initials, imageUrl, size=36, color="#F59E0B" }) => (
  <div style={{ width:size, height:size, borderRadius:"50%", background:`linear-gradient(135deg,${color},${color}99)`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:size*0.34, fontWeight:900, color:"#fff", flexShrink:0, overflow:"hidden" }}>
    {imageUrl ? <img src={imageUrl} alt="Avatar" style={{ width:"100%", height:"100%", objectFit:"cover" }}/> : initials}
  </div>
);

//  NEWS CARD 
const NewsCard = ({ item, t, onPress, onBookmark, onToggleLike, compact, currentUserId }) => {
  const isLiked = !!(currentUserId && item.likedBy?.[currentUserId]);
  return (
    <div onClick={()=>onPress(item)} style={{ background:t.card, borderRadius:16, overflow:"hidden", marginBottom:14, cursor:"pointer", border:`1px solid ${t.border}`, boxShadow:`0 2px 10px rgba(0,0,0,0.08)` }}>
      {!compact && <NewsImage type={item.image} height={170}/>}
      <div style={{ padding:compact?"12px 14px":"14px 16px" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
          <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
            <CategoryBadge cat={item.category} small/>
            {item.priority==="urgent" && <Badge text="Urgent" color="#DC2626" small/>}
          </div>
          <button onClick={e=>{e.stopPropagation();onBookmark(item.id);}} style={{ background:"none", border:"none", cursor:"pointer", padding:4, lineHeight:0 }}>
            <Icon name={item.bookmarked?"bookmarkF":"bookmark"} size={17} color={item.bookmarked?"#F59E0B":t.text3}/>
          </button>
        </div>
        <div style={{ fontSize:compact?13:15, fontWeight:800, color:t.text, lineHeight:1.35, marginBottom:compact?6:10 }}>{item.title}</div>
        {!compact && <div style={{ fontSize:12.5, color:t.text2, lineHeight:1.6, marginBottom:10 }}>{item.summary.slice(0,100)}</div>}
        {!compact && (
          <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:10 }}>
            {item.tags.slice(0,3).map(tag=><span key={tag} style={{ fontSize:10, color:t.accent2, background:`${t.accent2}18`, padding:"2px 8px", borderRadius:8, fontWeight:600 }}>#{tag}</span>)}
          </div>
        )}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
            <Avatar initials={item.author.split(" ").map(w=>w[0]).join("").slice(0,2)} size={20} color="#3B82F6"/>
            <span style={{ fontSize:10.5, color:t.text2, fontWeight:600 }}>{item.author}  {item.date.slice(5).replace("-","/")}</span>
          </div>
          <div style={{ display:"flex", gap:10, alignItems:"center" }}>
            {[["eye",item.views>999?`${(item.views/1000).toFixed(1)}k`:item.views,t.text3],["heart",item.likes,isLiked?"#EF4444":t.text3],["comment",item.comments,t.text3]].map(([ic,val,col],i)=>(
              <button key={i} onClick={e=>{e.stopPropagation();if(ic==="heart")onToggleLike?.(item.id);}} style={{ display:"flex",alignItems:"center",gap:3,background:"none",border:"none",cursor:"pointer",padding:0 }}>
                <Icon name={ic==="heart"&&isLiked?"heartF":ic} size={14} color={col}/>
                <span style={{ fontSize:11, color:col, fontWeight:600 }}>{val}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// 
// SCREENS
// 

// LOGIN
const LoginScreen = ({ onLogin, dark, onToggleDark }) => {
  const t = th(dark);
  const [tab, setTab]       = useState("login");
  const [role, setRole]     = useState("user");
  const [name, setName]     = useState("");
  const [email, setEmail]   = useState("");
  const [password, setPassword] = useState("");
  const [userType, setUserType] = useState("student");
  const [branch, setBranch] = useState(BRANCHES[0]);
  const [year, setYear] = useState(STUDY_YEARS[0]);
  const [usn, setUsn] = useState("");
  const [loading, setLoading]   = useState(false);
  const [authMsg, setAuthMsg]   = useState("");

  const inp = { width:"100%", padding:"13px 15px", borderRadius:12, border:`1.5px solid ${t.border}`, background:t.input, color:t.text, fontSize:14, outline:"none", boxSizing:"border-box", fontFamily:"inherit" };
  const lbl = { fontSize:11, fontWeight:700, color:t.text2, letterSpacing:0.5, textTransform:"uppercase", marginBottom:6, display:"block" };

  const getAuthErrorMessage = (err) => {
    const code = err?.code || "";
    if (code === "auth/email-already-in-use") return "This email is already registered. Please sign in.";
    if (code === "auth/invalid-email") return "Enter a valid email address.";
    if (code === "auth/weak-password") return "Use a stronger password (at least 6 characters).";
    if (code === "auth/invalid-credential") return "Invalid email or password.";
    if (code === "auth/user-not-found") return "No account found with this email.";
    if (code === "auth/wrong-password") return "Incorrect password.";
    if (code === "auth/operation-not-allowed") {
      return "Email/Password sign-in is disabled. Enable it in Firebase Console -> Authentication -> Sign-in method.";
    }
    if (code === "auth/configuration-not-found") {
      return "Firebase Authentication is not configured for this project. In Firebase Console, set up Authentication and enable Email/Password sign-in.";
    }
    if (code === "auth/unauthorized-domain") {
      return "This domain is not authorized for Firebase Auth. Add it in Firebase Console -> Authentication -> Settings -> Authorized domains.";
    }
    if (code === "permission-denied" || code === "firestore/permission-denied") {
      return "Firestore write failed (permission denied). Update Firestore Rules to allow authenticated users to create/update their own user profile document.";
    }
    if (code === "failed-precondition") {
      return "Firestore is not fully enabled for this project. Open Firebase Console and create/enable Firestore Database first.";
    }
    return err?.message || "Authentication failed. Please try again.";
  };

  const finishLogin = async () => {
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPassword = password.trim();
    const trimmedUsn = usn.trim().toUpperCase();
    const resolvedName = name.trim() || deriveNameFromEmail(trimmedEmail) || USERS[role].name;
    if (!trimmedEmail) return setAuthMsg("Enter your college email.");
    if (!trimmedPassword) return setAuthMsg("Enter your password.");
    if (tab === "signup" && !resolvedName.trim()) return setAuthMsg("Enter your full name.");
    if (tab === "signup" && role === "user" && userType === "student" && !trimmedUsn) return setAuthMsg("Enter your USN.");
    if (!useFirebaseBackend || !auth || !db) return setAuthMsg("Firebase is not configured. Configure .env and retry.");
    setAuthMsg("");
    setLoading(true);
    try {
      if (tab === "signup") {
        const credential = await createUserWithEmailAndPassword(auth, trimmedEmail, trimmedPassword);
        const selectedRole = USERS[role] || USERS.user;
        const profileData = {
          name: resolvedName,
          email: trimmedEmail,
          role,
          userType: role === "user" ? userType : null,
          dept: role === "user" ? branch : selectedRole.dept,
          year: role === "user" && userType === "student" ? year : null,
          usn: role === "user" && userType === "student" ? trimmedUsn : null,
          avatar: getInitials(resolvedName),
          avatarUrl: "",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          lastLoginAt: serverTimestamp(),
        };
        await setDoc(doc(db, "users", credential.user.uid), {
          ...profileData,
        });
        onLogin({ uid: credential.user.uid, ...profileData });
        return;
      }

      const credential = await signInWithEmailAndPassword(auth, trimmedEmail, trimmedPassword);
      const userRef = doc(db, "users", credential.user.uid);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) {
        const selectedRole = USERS[role] || USERS.user;
        const bootstrapProfile = {
          role,
          userType: role === "user" ? userType : null,
          name: resolvedName,
          email: trimmedEmail,
          avatar: getInitials(resolvedName),
          avatarUrl: "",
          dept: role === "user" ? (branch || selectedRole.dept) : selectedRole.dept,
          year: role === "user" && userType === "student" ? year : null,
          usn: role === "user" && userType === "student" ? (trimmedUsn || null) : null,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          lastLoginAt: serverTimestamp(),
        };
        await setDoc(userRef, bootstrapProfile, { merge: true });
        onLogin({ uid: credential.user.uid, ...bootstrapProfile });
        return;
      }

      const stored = userSnap.data() || {};
      if ((stored.email || "").toLowerCase() !== trimmedEmail) {
        await signOut(auth);
        setAuthMsg("Email does not match the registered profile.");
        return;
      }
      if (stored.role && stored.role !== role) {
        await signOut(auth);
        setAuthMsg(`Role mismatch. This account is registered as ${roleLabels[stored.role] || stored.role}.`);
        return;
      }
      if (name.trim() && stored.name && stored.name.trim().toLowerCase() !== name.trim().toLowerCase()) {
        await signOut(auth);
        setAuthMsg("Name does not match the registered profile.");
        return;
      }

      const selectedRole = USERS[stored.role] || USERS.user;
      const finalName = stored.name || resolvedName;
      const resolvedRole = stored.role || role;
      const profileData = {
        role: resolvedRole,
        userType: stored.userType || (resolvedRole === "user" ? userType : null),
        name: finalName,
        email: trimmedEmail,
        avatar: stored.avatar || getInitials(finalName),
        avatarUrl: stored.avatarUrl || "",
        dept: stored.dept || selectedRole.dept,
        year: typeof stored.year === "undefined" ? selectedRole.year || null : stored.year,
        usn: typeof stored.usn === "undefined" ? selectedRole.usn || null : stored.usn,
      };
      await setDoc(
        userRef,
        {
          updatedAt: serverTimestamp(),
          lastLoginAt: serverTimestamp(),
          avatar: profileData.avatar,
          avatarUrl: profileData.avatarUrl,
          dept: profileData.dept,
          year: profileData.year,
          usn: profileData.usn,
          userType: profileData.userType || null,
        },
        { merge: true }
      );
      onLogin({ uid: credential.user.uid, ...profileData });
    } catch (err) {
      console.error("Authentication flow failed:", err);
      setAuthMsg(getAuthErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) {
      setAuthMsg("Enter email first to reset password.");
      return;
    }
    if (!useFirebaseBackend || !auth) {
      setAuthMsg("Firebase is not configured. Password reset is unavailable.");
      return;
    }
    try {
      await sendPasswordResetEmail(auth, trimmedEmail);
      setAuthMsg(`Password reset link sent to ${trimmedEmail}.`);
    } catch (err) {
      console.error("Password reset failed:", err);
      setAuthMsg(getAuthErrorMessage(err));
    }
  };

  return (
    <div style={{ height:"100%", overflowY:"auto", background:t.bg }}>
      {/* Hero Header */}
      <div style={{ background:"linear-gradient(145deg,#060d1f,#0f2040,#1a3870)", padding:"52px 24px 36px", textAlign:"center" }}>
        <button onClick={onToggleDark} style={{ position:"absolute", top:16, right:16, width:34, height:34, borderRadius:"50%", border:"1px solid rgba(255,255,255,0.2)", background:"rgba(255,255,255,0.1)", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer" }}>
          <Icon name={dark?"sun":"moon"} size={15} color="rgba(255,255,255,0.8)"/>
        </button>
        <div style={{ display:"inline-flex", width:68, height:68, borderRadius:22, background:"linear-gradient(135deg,#F59E0B,#D97706)", alignItems:"center", justifyContent:"center", marginBottom:16, boxShadow:"0 8px 32px rgba(245,158,11,0.45)", overflow:"hidden" }}>
          <img src="/app-logo.png" alt="BMSCE Buzz" style={{ width:"100%", height:"100%", objectFit:"cover" }}/>
        </div>
        <div style={{ fontSize:28, fontWeight:900, color:"#fff", letterSpacing:-0.5, marginBottom:4 }}>BMSCE-BUZZ</div>
        <div style={{ fontSize:13, color:"rgba(255,255,255,0.55)", fontWeight:500, marginBottom:28 }}>College News & Announcements Platform</div>
        <div style={{ display:"flex", background:"rgba(255,255,255,0.1)", borderRadius:12, padding:4, maxWidth:260, margin:"0 auto" }}>
          {["login","signup"].map(v=>(
            <button key={v} onClick={()=>setTab(v)} style={{ flex:1, padding:"8px 0", borderRadius:9, border:"none", fontWeight:800, fontSize:13, cursor:"pointer", background:tab===v?"#fff":"transparent", color:tab===v?"#0A1628":"rgba(255,255,255,0.65)", transition:"all 0.2s", fontFamily:"inherit" }}>
              {v==="login"?"Sign In":"Sign Up"}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding:"24px 22px 40px" }}>
        {/* Role Picker */}
        <div style={{ marginBottom:20 }}>
          <label style={lbl}>Choose Role</label>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
            {["user", "admin"].map((key)=>(
              <button key={key} onClick={()=>setRole(key)} style={{ padding:"10px 12px", borderRadius:12, border:`2px solid ${role===key?t.accent:t.border}`, background:role===key?`${t.accent}15`:t.card, cursor:"pointer", textAlign:"left", transition:"all 0.15s", fontFamily:"inherit" }}>
                <div style={{ fontSize:12, fontWeight:900, color:role===key?t.accent:t.text, marginBottom:2 }}>{roleLabels[key]}</div>
                <div style={{ fontSize:10, color:t.text2, fontWeight:600, textTransform:"uppercase", letterSpacing:0.4 }}>{key==="user" ? "Student/Faculty" : "Management"}</div>
              </button>
            ))}
          </div>
        </div>
        <div style={{ marginBottom:14 }}><label style={lbl}>Full Name</label><input style={inp} placeholder="Your full name" value={name} onChange={e=>setName(e.target.value)}/></div>
        <div style={{ marginBottom:14 }}><label style={lbl}>College Email</label><input style={inp} placeholder="yourname@college.edu" value={email} onChange={e=>setEmail(e.target.value)} type="email"/></div>
        {role==="user" && (
          <>
            <div style={{ marginBottom:14 }}>
              <label style={lbl}>I Am</label>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                {["student","faculty"].map((v)=>(
                  <button key={v} type="button" onClick={()=>setUserType(v)} style={{ padding:"10px 12px", borderRadius:10, border:`1.5px solid ${userType===v?t.accent:t.border}`, background:userType===v?`${t.accent}15`:t.card, color:userType===v?t.accent:t.text2, fontWeight:800, fontSize:12, cursor:"pointer", fontFamily:"inherit" }}>
                    {v === "student" ? "Student" : "Faculty"}
                  </button>
                ))}
              </div>
            </div>
            {tab==="signup" && (
              <>
                <div style={{ marginBottom:14 }}>
                  <label style={lbl}>Branch</label>
                  <select style={inp} value={branch} onChange={e=>setBranch(e.target.value)}>
                    {BRANCHES.map((branchOption)=><option key={branchOption}>{branchOption}</option>)}
                  </select>
                </div>
                {userType === "student" && (
                  <>
                    <div style={{ marginBottom:14 }}>
                      <label style={lbl}>Year Of Study</label>
                      <select style={inp} value={year} onChange={e=>setYear(e.target.value)}>
                        {STUDY_YEARS.map((yearOption)=><option key={yearOption}>{yearOption}</option>)}
                      </select>
                    </div>
                    <div style={{ marginBottom:14 }}>
                      <label style={lbl}>USN</label>
                      <input style={inp} placeholder="1BM22CS001" value={usn} onChange={e=>setUsn(e.target.value.toUpperCase())}/>
                    </div>
                  </>
                )}
              </>
            )}
          </>
        )}
        <div style={{ marginBottom:20 }}><label style={lbl}>Password</label><input style={inp} placeholder="" value={password} onChange={e=>setPassword(e.target.value)} type="password"/></div>
        {tab==="login" && (
          <div style={{ textAlign:"right", marginTop:-14, marginBottom:20 }}>
            <button
              onClick={handleForgotPassword}
              style={{ fontSize:13, color:t.accent, fontWeight:700, cursor:"pointer", border:"none", background:"none", padding:0, fontFamily:"inherit" }}
            >
              Forgot password?
            </button>
          </div>
        )}

        <button onClick={finishLogin} style={{ width:"100%", padding:"15px", borderRadius:13, border:"none", background:"linear-gradient(135deg,#F59E0B,#D97706)", color:"#fff", fontSize:15, fontWeight:900, cursor:"pointer", boxShadow:"0 8px 24px rgba(245,158,11,0.35)", letterSpacing:0.2, fontFamily:"inherit" }}>
          {loading ? "Signing in..." : tab==="login" ? "Sign In ->" : "Create Account ->"}
        </button>
        {authMsg && <div style={{ marginTop:10, fontSize:11.5, color:t.accent, fontWeight:700 }}>{authMsg}</div>}

        <div style={{ marginTop:20, padding:"12px 14px", borderRadius:12, background:`${t.accent}10`, border:`1px solid ${t.accent}25`, display:"flex", alignItems:"center", gap:10 }}>
          <Icon name="shield" size={17} color={t.accent}/>
          <span style={{ fontSize:11.5, color:t.text2, lineHeight:1.45 }}>Secured with JWT & 256-bit encryption. Your data is safe.</span>
        </div>
      </div>
    </div>
  );
};

// HOME FEED
const HomeScreen = ({ user, t, news, onOpenArticle, onBookmark, onToggleLike, importantNotice, dark, onToggleDark, onOpenProfile }) => {
  const [activeCat, setActiveCat] = useState("All");
  const [showFilter, setShowFilter] = useState(false);
  const [filterDept, setFilterDept] = useState("All Departments");

  const filtered = news.filter(n => {
    if (n.status==="pending") return false;
    if (activeCat!=="All" && n.category!==activeCat) return false;
    if (filterDept!=="All Departments" && n.dept!=="All" && n.dept!==filterDept) return false;
    return true;
  });
  const featured = filtered[0];
  const rest = filtered.slice(1);

  return (
    <div style={{ height:"100%", overflowY:"auto", position:"relative" }}>
      {/* Sticky Header */}
      <div style={{ position:"sticky", top:0, zIndex:50, background:t.header, borderBottom:`1px solid ${t.border}`, padding:"12px 16px" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ width:36, height:36, borderRadius:11, background:"linear-gradient(135deg,#F59E0B,#D97706)", display:"flex", alignItems:"center", justifyContent:"center", boxShadow:"0 8px 20px rgba(217,119,6,0.35)", overflow:"hidden" }}>
              <img src="/app-logo.png" alt="BMSCE Buzz logo" style={{ width:"100%", height:"100%", objectFit:"cover" }}/>
            </div>
            <div>
              <div style={{ fontSize:16.5, fontWeight:900, color:t.text, letterSpacing:-0.3 }}>BMSCE Buzz</div>
              <div style={{ fontSize:10, color:t.text3, fontWeight:800, letterSpacing:0.6, textTransform:"uppercase" }}>Campus Pulse</div>
            </div>
          </div>
          <div style={{ display:"flex", gap:8, alignItems:"center" }}>
            <button onClick={onToggleDark} style={{ width:34, height:34, borderRadius:"50%", border:`1.5px solid ${t.border}`, background:t.card2, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer" }}>
              <Icon name={dark?"sun":"moon"} size={15} color={t.text2}/>
            </button>
            <button onClick={()=>setShowFilter(!showFilter)} style={{ width:34, height:34, borderRadius:"50%", border:`1.5px solid ${showFilter?t.accent:t.border}`, background:showFilter?`${t.accent}15`:t.card2, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer" }}>
              <Icon name="filter" size={15} color={showFilter?t.accent:t.text2}/>
            </button>
            <button onClick={onOpenProfile} style={{ border:"none", background:"transparent", padding:0, cursor:"pointer", lineHeight:0 }}>
              <Avatar initials={user.avatar} imageUrl={user.avatarUrl} size={34}/>
            </button>
          </div>
        </div>
        {showFilter && (
          <div style={{ marginTop:10 }}>
            <select value={filterDept} onChange={e=>setFilterDept(e.target.value)} style={{ width:"100%", padding:"9px 12px", borderRadius:10, border:`1px solid ${t.border}`, background:t.input, color:t.text, fontSize:12, fontWeight:600, fontFamily:"inherit", outline:"none" }}>
              {DEPTS.map(d=><option key={d}>{d}</option>)}
            </select>
          </div>
        )}
      </div>

      <div style={{ padding:"0 14px 100px" }}>
        {importantNotice && (
          <div onClick={()=>onOpenArticle(importantNotice)} style={{ margin:"12px 0 0", padding:"11px 14px", borderRadius:12, background:"linear-gradient(135deg,#DC2626,#991B1B)", display:"flex", alignItems:"center", gap:10, cursor:"pointer" }}>
            <Icon name="flash" size={16} color="#FCD34D"/>
            <span style={{ color:"#fff", fontSize:12.5, fontWeight:700, flex:1 }}>{importantNotice.title}</span>
          </div>
        )}

        {/* Category Pills */}
        <div style={{ display:"flex", gap:8, overflowX:"auto", padding:"12px 0 4px", scrollbarWidth:"none" }}>
          {CATEGORIES.map(cat=>(
            <button key={cat} onClick={()=>setActiveCat(cat)} style={{ flexShrink:0, padding:"6px 14px", borderRadius:20, border:`1.5px solid ${activeCat===cat?t.accent:t.border}`, background:activeCat===cat?t.accent:"transparent", color:activeCat===cat?"#fff":t.text2, fontSize:11.5, fontWeight:700, cursor:"pointer", whiteSpace:"nowrap", fontFamily:"inherit", transition:"all 0.15s" }}>
              {cat}
            </button>
          ))}
        </div>

        {/* Featured */}
        {featured && (
          <div style={{ marginTop:12 }}>
            <div style={{ display:"flex", alignItems:"center", gap:5, marginBottom:10 }}>
              <Icon name="star" size={13} color={t.accent}/>
              <span style={{ fontSize:10.5, fontWeight:900, color:t.accent, letterSpacing:1, textTransform:"uppercase" }}>Featured Story</span>
            </div>
            <div onClick={()=>onOpenArticle(featured)} style={{ background:t.card, borderRadius:18, overflow:"hidden", cursor:"pointer", border:`1px solid ${t.border}`, boxShadow:`0 4px 20px rgba(0,0,0,0.1)` }}>
              <NewsImage type={featured.image} height={195}/>
              <div style={{ padding:"16px 16px 14px" }}>
                <div style={{ display:"flex", gap:7, marginBottom:10, flexWrap:"wrap" }}><CategoryBadge cat={featured.category}/>{featured.priority==="urgent"&&<Badge text="Urgent" color="#DC2626"/>}</div>
                <div style={{ fontSize:19, fontWeight:900, color:t.text, lineHeight:1.3, marginBottom:8, letterSpacing:-0.4 }}>{featured.title}</div>
                <div style={{ fontSize:12.5, color:t.text2, lineHeight:1.6, marginBottom:12 }}>{featured.summary}</div>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:7 }}>
                    <Avatar initials={featured.author.split(" ").map(w=>w[0]).join("").slice(0,2)} size={24} color="#059669"/>
                    <div>
                      <div style={{ fontSize:11.5, fontWeight:700, color:t.text }}>{featured.author}</div>
                      <div style={{ fontSize:10, color:t.text3, fontWeight:600 }}>{featured.date}</div>
                    </div>
                  </div>
                  <div style={{ display:"flex", gap:10 }}>
                    <div style={{ display:"flex", gap:3, alignItems:"center" }}><Icon name="eye" size={13} color={t.text3}/><span style={{ fontSize:11, color:t.text3, fontWeight:600 }}>{(featured.views/1000).toFixed(1)}k</span></div>
                    <div style={{ display:"flex", gap:3, alignItems:"center" }}><Icon name="heart" size={13} color={t.text3}/><span style={{ fontSize:11, color:t.text3, fontWeight:600 }}>{featured.likes}</span></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        <div style={{ display:"flex", alignItems:"center", gap:6, margin:"18px 0 12px" }}>
          <Icon name="trending" size={15} color={t.accent}/>
          <span style={{ fontSize:13, fontWeight:900, color:t.text }}>Latest News</span>
          <span style={{ fontSize:11, color:t.text3, fontWeight:600, marginLeft:"auto" }}>{filtered.length} articles</span>
        </div>
        {rest.map(item=><NewsCard key={item.id} item={item} t={t} onPress={onOpenArticle} onBookmark={onBookmark} onToggleLike={onToggleLike} currentUserId={user?.id}/>)}
        {filtered.length===0&&<div style={{ textAlign:"center", padding:"48px 24px", color:t.text3 }}><div style={{ fontSize:40 }}></div><div style={{ fontSize:15, fontWeight:700, marginTop:10 }}>No articles found</div></div>}
      </div>
    </div>
  );
};

// ARTICLE DETAIL
const ArticleScreen = ({ item, t, user, onBack, onBookmark, onToggleLike }) => {
  const [comment, setComment] = useState("");
  const [comments, setComments] = useState(COMMENTS);
  const [showShare, setShowShare] = useState(false);
  const commentInputRef = useRef(null);
  const isLiked = !!(user?.id && item.likedBy?.[user.id]);

  useEffect(() => {
    if (!item?.id || !useFirebaseBackend) {
      setComments([]);
      return undefined;
    }
    const commentsRef = query(collection(db, "news", item.id, "comments"), orderBy("createdAt", "asc"));
    const unsub = onSnapshot(commentsRef, (snap) => {
      const mapped = snap.docs.map((commentDoc) => {
        const data = commentDoc.data() || {};
        return {
          id: commentDoc.id,
          user: data.user || "User",
          avatar: data.avatar || "U",
          avatarUrl: data.avatarUrl || "",
          text: data.text || "",
          likes: Number.isFinite(data.likes) ? data.likes : 0,
          time: relativeTime(data.createdAt),
        };
      });
      setComments(mapped);
    });
    return () => unsub();
  }, [item?.id]);

  const postComment = async () => {
    if (!comment.trim() || !user?.id) return;
    const payload = {
      user: user.name,
      avatar: user.avatar,
      avatarUrl: user.avatarUrl || "",
      text: comment.trim(),
      likes: 0,
      createdAt: serverTimestamp(),
      userId: user.id,
    };
    setComment("");
    if (useFirebaseBackend) {
      try {
        await addDoc(collection(db, "news", item.id, "comments"), payload);
        await updateDoc(doc(db, "news", item.id), {
          comments: increment(1),
          [`commentedBy.${user.id}`]: true,
        });
      } catch (err) {
        console.error("Failed to post comment:", err);
      }
      return;
    }
    setComments((prev) => [...prev, { ...payload, id: `c${Date.now()}`, time: "just now" }]);
  };
  const shareLabel = encodeURIComponent(item.title);
  const shareUrl = encodeURIComponent(`https://bmsce-buzz.app/news/${item.id}`);
  const handleShare = async (label) => {
    if (label === "WhatsApp") window.open(`https://wa.me/?text=${shareLabel}%20${shareUrl}`, "_blank");
    if (label === "Email") window.location.href = `mailto:?subject=${shareLabel}&body=${shareUrl}`;
    if (label === "Copy Link") {
      try {
        await navigator.clipboard.writeText(`https://bmsce-buzz.app/news/${item.id}`);
        window.alert("Article link copied.");
      } catch {
        window.alert("Copy failed. Please copy manually.");
      }
    }
    if (label === "PDF") window.print();
  };

  return (
    <div style={{ height:"100%", overflowY:"auto" }}>
      <div style={{ position:"sticky", top:0, zIndex:50, background:t.header, borderBottom:`1px solid ${t.border}`, padding:"12px 14px", display:"flex", alignItems:"center", gap:10 }}>
        <button onClick={onBack} style={{ width:34, height:34, borderRadius:"50%", border:`1.5px solid ${t.border}`, background:t.card2, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer" }}>
          <Icon name="arrow" size={17} color={t.text}/>
        </button>
        <div style={{ flex:1, fontSize:13, fontWeight:700, color:t.text, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{item.category}</div>
        <button onClick={()=>onBookmark(item.id)} style={{ background:"none", border:"none", cursor:"pointer", padding:5, lineHeight:0 }}>
          <Icon name={item.bookmarked?"bookmarkF":"bookmark"} size={19} color={item.bookmarked?"#F59E0B":t.text2}/>
        </button>
        <button onClick={()=>setShowShare(!showShare)} style={{ background:"none", border:"none", cursor:"pointer", padding:5, lineHeight:0 }}>
          <Icon name="share" size={19} color={t.text2}/>
        </button>
      </div>

      {showShare && (
        <div style={{ padding:"14px 16px", background:t.card, borderBottom:`1px solid ${t.border}` }}>
          <div style={{ fontSize:11, fontWeight:800, color:t.text2, textTransform:"uppercase", letterSpacing:0.5, marginBottom:10 }}>Share</div>
          <div style={{ display:"flex", gap:10 }}>
            {[["WhatsApp","#25D366"],["Email","#3B82F6"],["Copy Link","#6B7280"],["PDF","#EF4444"]].map(([lbl,col])=>(
              <button key={lbl} onClick={() => handleShare(lbl)} style={{ flex:1, padding:"9px 4px", borderRadius:11, border:`1.5px solid ${col}30`, background:`${col}12`, cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", gap:3, fontFamily:"inherit" }}>
                <div style={{ width:24, height:24, borderRadius:"50%", background:col, display:"flex", alignItems:"center", justifyContent:"center", fontSize:12 }}>
                  {lbl==="WhatsApp"?"W":lbl==="Email"?"E":lbl==="Copy Link"?"L":"P"}
                </div>
                <span style={{ fontSize:9.5, color:col, fontWeight:700 }}>{lbl}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div style={{ paddingBottom:100 }}>
        <NewsImage type={item.image} height={215}/>
        <div style={{ padding:"18px 16px" }}>
          <div style={{ display:"flex", gap:7, marginBottom:12, flexWrap:"wrap" }}>
            <CategoryBadge cat={item.category}/>
            {item.priority==="urgent"&&<Badge text="Urgent" color="#DC2626"/>}
          </div>
          <h1 style={{ fontSize:21, fontWeight:900, color:t.text, lineHeight:1.3, margin:"0 0 16px", letterSpacing:-0.4 }}>{item.title}</h1>
          <div style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 0", borderTop:`1px solid ${t.border}`, borderBottom:`1px solid ${t.border}`, marginBottom:18 }}>
            <Avatar initials={item.author.split(" ").map(w=>w[0]).join("").slice(0,2)} size={40} color="#059669"/>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:13.5, fontWeight:800, color:t.text }}>{item.author}</div>
              <div style={{ fontSize:11, color:t.text2, marginTop:2 }}>{item.date} | {item.dept}</div>
            </div>
            <div style={{ display:"flex", gap:8 }}>
              {[["eye",(item.views/1000).toFixed(1)+"k",t.text3],["trending","Trending",t.accent]].map(([ic,val,col],i)=>(
                <div key={i} style={{ display:"flex", alignItems:"center", gap:3 }}>
                  <Icon name={ic} size={13} color={col}/>
                  <span style={{ fontSize:11, color:col, fontWeight:700 }}>{val}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ fontSize:14.5, color:t.text, lineHeight:1.8, marginBottom:18 }}>
            <p style={{ margin:"0 0 14px" }}>{item.summary}</p>
            <p style={{ margin:"0 0 14px" }}>Students are encouraged to stay updated with all official communications. Check your registered email and student portal for any additional updates.</p>
            <div style={{ margin:"16px 0", padding:"14px 16px", borderLeft:`4px solid ${t.accent}`, background:`${t.accent}0E`, borderRadius:"0 12px 12px 0" }}>
              <p style={{ margin:0, fontSize:13.5, fontWeight:600, color:t.text, fontStyle:"italic" }}>"This is an important announcement. Please share with peers and ensure timely action."</p>
              <p style={{ margin:"8px 0 0", fontSize:11, color:t.text2 }}>- {item.author}, {item.dept}</p>
            </div>
            <p style={{ margin:0 }}>For queries, contact the department office (Mon-Sat, 9AM-5PM). Online grievances can be submitted via the student portal.</p>
          </div>
          <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:18 }}>
            {item.tags.map(tag=><span key={tag} style={{ fontSize:11, color:t.accent2, background:`${t.accent2}15`, padding:"4px 10px", borderRadius:20, fontWeight:700 }}>#{tag}</span>)}
          </div>
          {/* Action Row */}
          <div style={{ display:"flex", gap:8, padding:"14px 0", borderTop:`1px solid ${t.border}`, borderBottom:`1px solid ${t.border}`, marginBottom:22 }}>
            {[
              { ic:isLiked?"heartF":"heart", label:`${item.likes}`, col:isLiked?"#EF4444":t.text2, action:()=>onToggleLike?.(item.id), border:isLiked?"#EF4444":t.border, bg:isLiked?"#EF444412":"transparent" },
              { ic:"comment", label:`${comments.length}`, col:t.text2, action:()=>commentInputRef.current?.focus(), border:t.border, bg:"transparent" },
              { ic:"share", label:"Share", col:t.text2, action:()=>setShowShare(v=>!v), border:t.border, bg:"transparent" },
            ].map((a,i)=>(
              <button key={i} onClick={a.action} style={{ flex:1, padding:"10px 8px", borderRadius:12, border:`1.5px solid ${a.border}`, background:a.bg, display:"flex", alignItems:"center", justifyContent:"center", gap:5, cursor:"pointer", fontFamily:"inherit" }}>
                <Icon name={a.ic} size={17} color={a.col}/>
                <span style={{ fontSize:12.5, fontWeight:700, color:a.col }}>{a.label}</span>
              </button>
            ))}
          </div>
          {/* Comments */}
          <div style={{ fontSize:15, fontWeight:800, color:t.text, marginBottom:14 }}>Comments ({comments.length})</div>
          {comments.map(c=>(
            <div key={c.id} style={{ display:"flex", gap:10, marginBottom:16 }}>
              <Avatar initials={c.avatar} imageUrl={c.avatarUrl} size={30} color="#7C3AED"/>
              <div style={{ flex:1 }}>
                <div style={{ background:t.card2, borderRadius:"0 13px 13px 13px", padding:"10px 13px" }}>
                  <div style={{ fontSize:11.5, fontWeight:800, color:t.text, marginBottom:4 }}>{c.user} <span style={{ color:t.text3, fontWeight:500 }}>| {c.time}</span></div>
                  <div style={{ fontSize:13, color:t.text, lineHeight:1.55 }}>{c.text}</div>
                </div>
                <div style={{ fontSize:10.5, color:t.text3, fontWeight:600, marginTop:4, paddingLeft:2 }}>&lt;3 {c.likes} | Reply</div>
              </div>
            </div>
          ))}
          {/* Comment input */}
          <div style={{ display:"flex", gap:10, alignItems:"center", marginTop:6 }}>
            <Avatar initials={user.avatar} imageUrl={user.avatarUrl} size={32}/>
            <div style={{ flex:1, background:t.input, borderRadius:14, border:`1.5px solid ${t.border}`, padding:"9px 12px", display:"flex", alignItems:"center", gap:8 }}>
              <input ref={commentInputRef} value={comment} onChange={e=>setComment(e.target.value)} onKeyDown={e=>e.key==="Enter"&&postComment()} placeholder="Write a comment" style={{ flex:1, background:"none", border:"none", color:t.text, fontSize:13, outline:"none", fontFamily:"inherit" }}/>
              <button onClick={postComment} style={{ background:t.accent, border:"none", borderRadius:8, padding:"5px 11px", cursor:"pointer", color:"#fff", fontSize:11.5, fontWeight:800, fontFamily:"inherit" }}>Post</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// SEARCH
const SearchScreen = ({ user, t, news, onOpenArticle, onBookmark, onToggleLike }) => {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("All");

  const results = news.filter(n=>{
    if (n.status==="pending") return false;
    const qL = q.toLowerCase();
    const mQ = !q || n.title.toLowerCase().includes(qL)||n.summary.toLowerCase().includes(qL)||n.tags.some(tg=>tg.toLowerCase().includes(qL));
    return mQ && (cat==="All"||n.category===cat);
  });

  return (
    <div style={{ height:"100%", overflowY:"auto" }}>
      <div style={{ position:"sticky", top:0, zIndex:50, background:t.header, borderBottom:`1px solid ${t.border}`, padding:"12px 14px" }}>
        <div style={{ fontSize:18, fontWeight:900, color:t.text, marginBottom:12, letterSpacing:-0.3 }}>Search</div>
        <div style={{ position:"relative", marginBottom:10 }}>
          <div style={{ position:"absolute", left:12, top:"50%", transform:"translateY(-50%)", lineHeight:0 }}><Icon name="search" size={17} color={t.text3}/></div>
          <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search articles, events, clubs" style={{ width:"100%", padding:"12px 14px 12px 40px", borderRadius:13, border:`1.5px solid ${t.border}`, background:t.input, color:t.text, fontSize:13.5, outline:"none", boxSizing:"border-box", fontFamily:"inherit" }}/>
        </div>
        <div style={{ display:"flex", gap:7, overflowX:"auto", scrollbarWidth:"none" }}>
          {CATEGORIES.map(c=>(
            <button key={c} onClick={()=>setCat(c)} style={{ flexShrink:0, padding:"5px 12px", borderRadius:20, border:`1.5px solid ${cat===c?t.accent:t.border}`, background:cat===c?`${t.accent}18`:"transparent", color:cat===c?t.accent:t.text2, fontSize:11, fontWeight:700, cursor:"pointer", whiteSpace:"nowrap", fontFamily:"inherit" }}>{c}</button>
          ))}
        </div>
      </div>
      <div style={{ padding:"14px 14px 100px" }}>
        {!q && (
          <div style={{ marginBottom:20 }}>
            <div style={{ fontSize:11.5, fontWeight:800, color:t.text2, textTransform:"uppercase", letterSpacing:0.7, marginBottom:10 }}>Trending Topics</div>
            <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
              {["#TCS2025","#ExamTimetable","#Utkarsh2025","#IEEE","#Basketball","#Scholarship"].map(tag=>(
                <button key={tag} onClick={()=>setQ(tag.slice(1))} style={{ padding:"6px 13px", borderRadius:20, border:`1.5px solid ${t.border}`, background:t.card, color:t.accent2, fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>{tag}</button>
              ))}
            </div>
          </div>
        )}
        <div style={{ fontSize:11, color:t.text3, fontWeight:600, marginBottom:10 }}>{results.length} result{results.length!==1?"s":""}</div>
        {results.map(item=><NewsCard key={item.id} item={item} t={t} onPress={onOpenArticle} onBookmark={onBookmark} onToggleLike={onToggleLike} currentUserId={user?.id} compact/>)}
      </div>
    </div>
  );
};

// EVENTS
const EventsScreen = ({ t, events }) => {
  const colorMap = { amber:"#F59E0B", emerald:"#059669", rose:"#EF4444", blue:"#3B82F6", purple:"#7C3AED" };
  const [view, setView] = useState("list");
  const [savedEvents, setSavedEvents] = useState({});
  const evDates = events.map(e=>+e.date.split("-")[2]);
  const addToCalendar = (ev) => {
    setSavedEvents((prev) => ({ ...prev, [ev.id]: !prev[ev.id] }));
  };

  return (
    <div style={{ height:"100%", overflowY:"auto" }}>
      <div style={{ position:"sticky", top:0, zIndex:50, background:t.header, borderBottom:`1px solid ${t.border}`, padding:"12px 14px" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
          <div style={{ fontSize:18, fontWeight:900, color:t.text, letterSpacing:-0.3 }}>Events</div>
          <div style={{ display:"flex", background:t.input, borderRadius:10, padding:3 }}>
            {[["list","List"],["cal","Calendar"]].map(([v,l])=>(
              <button key={v} onClick={()=>setView(v)} style={{ padding:"5px 12px", borderRadius:8, border:"none", background:view===v?t.accent:"transparent", color:view===v?"#fff":t.text2, fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>{l}</button>
            ))}
          </div>
        </div>
      </div>
      <div style={{ padding:"14px 14px 100px" }}>
        {view==="cal" && (
          <div style={{ background:t.card, borderRadius:16, padding:"14px", marginBottom:18, border:`1px solid ${t.border}` }}>
            <div style={{ textAlign:"center", fontSize:14, fontWeight:800, color:t.text, marginBottom:12 }}>December 2025</div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:3, marginBottom:6 }}>
              {["S","M","T","W","T","F","S"].map((d,i)=><div key={i} style={{ textAlign:"center", fontSize:10, fontWeight:700, color:t.text3, padding:"3px 0" }}>{d}</div>)}
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:3 }}>
              {[...Array(6)].map((_,i)=><div key={`e${i}`}/>)}
              {Array.from({length:31},(_,i)=>i+1).map(d=>(
                <div key={d} style={{ aspectRatio:"1", borderRadius:7, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", background:evDates.includes(d)?`${t.accent}18`:t.bg, border:d===6?`2px solid #3B82F6`:evDates.includes(d)?`1.5px solid ${t.accent}40`:"none" }}>
                  <span style={{ fontSize:10.5, fontWeight:evDates.includes(d)||d===6?800:500, color:d===6?"#3B82F6":evDates.includes(d)?t.accent:t.text }}>{d}</span>
                  {evDates.includes(d)&&<div style={{ width:3, height:3, borderRadius:"50%", background:t.accent, marginTop:1 }}/>}
                </div>
              ))}
            </div>
            <div style={{ display:"flex", gap:10, marginTop:12, flexWrap:"wrap" }}>
              {[["#F59E0B","Placement"],["#059669","Sports"],["#EF4444","Exams"],["#3B82F6","Clubs"],["#7C3AED","Cultural"]].map(([c,l])=>(
                <div key={l} style={{ display:"flex", alignItems:"center", gap:4 }}><div style={{ width:7, height:7, borderRadius:2, background:c }}/><span style={{ fontSize:10, color:t.text2, fontWeight:600 }}>{l}</span></div>
              ))}
            </div>
          </div>
        )}
        <div style={{ fontSize:11.5, fontWeight:800, color:t.text2, textTransform:"uppercase", letterSpacing:0.7, marginBottom:10 }}>Upcoming</div>
        {events.length===0 && <div style={{ textAlign:"center", padding:"24px 12px", fontSize:12, color:t.text3 }}>No events yet. Publish posts in Academics, Exams, Sports, or Cultural Events.</div>}
        {events.map(ev=>(
          <div key={ev.id} style={{ background:t.card, borderRadius:14, padding:"13px 14px", marginBottom:10, display:"flex", gap:12, alignItems:"center", border:`1px solid ${t.border}` }}>
            <div style={{ width:46, borderRadius:11, background:`${colorMap[ev.color]}18`, padding:"9px 6px", textAlign:"center", flexShrink:0 }}>
              <div style={{ fontSize:16, fontWeight:900, color:colorMap[ev.color], lineHeight:1 }}>{+ev.date.split("-")[2]}</div>
              <div style={{ fontSize:9, fontWeight:700, color:colorMap[ev.color], textTransform:"uppercase" }}>Dec</div>
            </div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:13, fontWeight:800, color:t.text, marginBottom:4, lineHeight:1.3 }}>{ev.title}</div>
              <div style={{ fontSize:11, color:t.text2 }}>Time: {ev.time} | Venue: {ev.venue}</div>
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:5, alignItems:"flex-end", flexShrink:0 }}>
              <Badge text={ev.category} color={colorMap[ev.color]} small/>
              <button onClick={()=>addToCalendar(ev)} style={{ fontSize:10, color:t.accent2, fontWeight:700, background:`${t.accent2}15`, border:"none", borderRadius:6, padding:"3px 8px", cursor:"pointer", fontFamily:"inherit" }}>{savedEvents[ev.id] ? "Added" : "+ Cal"}</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// NOTIFICATIONS
const NotificationsScreen = ({ t, notifs, onMarkAllRead, onMarkRead }) => {
  const unread = notifs.filter(n=>!n.read).length;
  const typeC = { urgent:"#EF4444", comment:"#3B82F6", like:"#EF4444", approval:"#059669", event:"#F59E0B", system:"#7C3AED" };

  return (
    <div style={{ height:"100%", overflowY:"auto" }}>
      <div style={{ position:"sticky", top:0, zIndex:50, background:t.header, borderBottom:`1px solid ${t.border}`, padding:"12px 14px" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div>
            <div style={{ fontSize:18, fontWeight:900, color:t.text, letterSpacing:-0.3 }}>Notifications</div>
            {unread>0&&<div style={{ fontSize:11, color:t.text2, fontWeight:600, marginTop:1 }}>{unread} unread</div>}
          </div>
          {unread>0&&<button onClick={onMarkAllRead} style={{ fontSize:11.5, color:t.accent, fontWeight:700, background:"none", border:`1px solid ${t.accent}`, borderRadius:8, padding:"5px 11px", cursor:"pointer", fontFamily:"inherit" }}>Mark all read</button>}
        </div>
      </div>
      <div style={{ padding:"12px 14px 100px" }}>
        {notifs.length===0 && <div style={{ padding:"24px 8px", color:t.text3, fontSize:12 }}>No notifications yet.</div>}
        {notifs.map(n=>(
          <div key={n.id} onClick={()=>onMarkRead(n.id)} style={{ display:"flex", gap:11, padding:"13px 12px", borderRadius:13, marginBottom:8, background:n.read?t.card:`${typeC[n.type]||t.accent}08`, border:`1px solid ${n.read?t.border:(typeC[n.type]||t.accent)+"30"}`, cursor:"pointer", alignItems:"center" }}>
            <div style={{ width:38, height:38, borderRadius:11, background:`${typeC[n.type]||t.accent}20`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:17, flexShrink:0 }}>{n.icon}</div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:12.5, fontWeight:n.read?600:800, color:t.text, lineHeight:1.4 }}>{n.title}</div>
              <div style={{ fontSize:10.5, color:t.text3, fontWeight:500, marginTop:3 }}>{n.time}</div>
            </div>
            {!n.read&&<div style={{ width:7, height:7, borderRadius:"50%", background:typeC[n.type]||t.accent, flexShrink:0 }}/>}
          </div>
        ))}
      </div>
    </div>
  );
};

// ADMIN
const AdminScreen = ({ user, t, news, users, onApprove, onReject, onEditPost, onDeletePost, onEditUser, onDeleteUser }) => {
  const [tab, setTab] = useState("pending");
  const [selectedUserId, setSelectedUserId] = useState("");
  const pending   = news.filter(n=>n.status==="pending");
  const published = news.filter(n=>n.status==="published");
  const selectedUser = users.find((u) => u.id === selectedUserId) || null;
  const userPosts = selectedUser
    ? news.filter((item) => (item.authorId && item.authorId === selectedUser.id) || item.author === selectedUser.name)
    : [];
  const totalViews = news.reduce((sum, item) => sum + (item.views || 0), 0);
  const formatViews = totalViews > 999 ? `${(totalViews / 1000).toFixed(1)}k` : `${totalViews}`;

  const recentDays = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    return date.toISOString().slice(0, 10);
  });
  const chartData = recentDays.map((day) => {
    const dayViews = news.filter((item) => item.date === day).reduce((sum, item) => sum + (item.views || 0), 0);
    const labelDate = new Date(day);
    return { d: labelDate.toLocaleDateString("en-US", { weekday: "short" }).slice(0, 1), v: dayViews };
  });
  const mx = Math.max(1, ...chartData.map(x=>x.v));

  return (
    <div style={{ height:"100%", overflowY:"auto" }}>
      <div style={{ position:"sticky", top:0, zIndex:50, background:t.header, borderBottom:`1px solid ${t.border}`, padding:"12px 14px" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div>
            <div style={{ fontSize:17, fontWeight:900, color:t.text, letterSpacing:-0.3 }}>Admin</div>
            <div style={{ fontSize:11, color:t.text2, fontWeight:600, marginTop:1 }}>{user.dept}</div>
          </div>
          <Avatar initials={user.avatar} imageUrl={user.avatarUrl} size={36} color="#EF4444"/>
        </div>
      </div>
      <div style={{ padding:"14px 14px 100px" }}>
        {/* Stats */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:18 }}>
          {[["N","Total",news.length,"#3B82F6"],["P","Pending",pending.length,"#F59E0B"],["OK","Published",published.length,"#059669"],["V","Views",formatViews,"#7C3AED"]].map(([icon,label,val,col])=>(
            <div key={label} style={{ background:t.card, borderRadius:14, padding:"14px 14px", border:`1px solid ${t.border}` }}>
              <div style={{ fontSize:22, marginBottom:4 }}>{icon}</div>
              <div style={{ fontSize:24, fontWeight:900, color:col }}>{val}</div>
              <div style={{ fontSize:10.5, color:t.text2, fontWeight:700, textTransform:"uppercase", letterSpacing:0.4 }}>{label}</div>
            </div>
          ))}
        </div>
        {/* Chart */}
        <div style={{ background:t.card, borderRadius:15, padding:"14px", marginBottom:18, border:`1px solid ${t.border}` }}>
          <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:14 }}>
            <Icon name="chart" size={15} color={t.accent}/>
            <span style={{ fontSize:13, fontWeight:800, color:t.text }}>Weekly Views</span>
          </div>
          <div style={{ display:"flex", alignItems:"flex-end", gap:7, height:70 }}>
            {chartData.map(({d,v})=>(
              <div key={d} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
                <div style={{ width:"100%", borderRadius:"3px 3px 0 0", background:`linear-gradient(to top,${t.accent},${t.accent}55)`, height:`${(v/mx)*60}px`, minHeight:4 }}/>
                <span style={{ fontSize:9.5, color:t.text3, fontWeight:600 }}>{d}</span>
              </div>
            ))}
          </div>
        </div>
        {/* Tabs */}
        <div style={{ display:"flex", background:t.card2, borderRadius:11, padding:3, marginBottom:14, border:`1px solid ${t.border}` }}>
          {[["pending",`Pending (${pending.length})`],["published","Published"],["users","Users"], ...(selectedUser ? [["userPosts", `${selectedUser.name.split(" ")[0]} Posts`]] : [])].map(([v,l])=>(
            <button key={v} onClick={()=>setTab(v)} style={{ flex:1, padding:"8px 4px", borderRadius:9, border:"none", background:tab===v?t.accent:"transparent", color:tab===v?"#fff":t.text2, fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>{l}</button>
          ))}
        </div>
        {/* Pending */}
        {tab==="pending" && (
          pending.length===0
            ? <div style={{ textAlign:"center", padding:"40px", color:t.text3 }}><div style={{ fontSize:36 }}></div><div style={{ fontSize:14, fontWeight:800, marginTop:10 }}>All clear! No pending posts.</div></div>
            : pending.map(item=>(
              <div key={item.id} style={{ background:t.card, borderRadius:15, padding:"14px", marginBottom:14, border:`1.5px solid ${t.accent}30` }}>
                <div style={{ display:"flex", gap:7, marginBottom:9, flexWrap:"wrap" }}>
                  <CategoryBadge cat={item.category} small/>
                  <Badge text="Awaiting Review" color="#B45309" small/>
                </div>
                <div style={{ fontSize:14.5, fontWeight:800, color:t.text, marginBottom:7, lineHeight:1.3 }}>{item.title}</div>
                <div style={{ fontSize:12, color:t.text2, lineHeight:1.55, marginBottom:10 }}>{item.summary.slice(0,120)}</div>
                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12 }}>
                  <Avatar initials={item.author.split(" ").map(w=>w[0]).join("").slice(0,2)} size={22} color="#059669"/>
                  <span style={{ fontSize:10.5, color:t.text2, fontWeight:600 }}>{item.author}  {item.date}</span>
                </div>
                <div style={{ display:"flex", gap:8 }}>
                  <button onClick={()=>onApprove(item.id)} style={{ flex:1, padding:"10px", borderRadius:11, border:"none", background:"#059669", color:"#fff", fontWeight:800, fontSize:12.5, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:5, fontFamily:"inherit" }}>
                    <Icon name="check" size={14} color="#fff"/> Approve
                  </button>
                  <button onClick={()=>onReject(item.id)} style={{ flex:1, padding:"10px", borderRadius:11, border:"none", background:"#EF4444", color:"#fff", fontWeight:800, fontSize:12.5, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:5, fontFamily:"inherit" }}>
                    <Icon name="x" size={14} color="#fff"/> Reject
                  </button>
                  <button onClick={()=>onEditPost(item)} style={{ padding:"10px 12px", borderRadius:11, border:`1.5px solid ${t.border}`, background:"transparent", cursor:"pointer" }}>
                    <Icon name="edit" size={14} color={t.text2}/>
                  </button>
                  <button onClick={()=>onDeletePost(item.id)} style={{ padding:"10px 12px", borderRadius:11, border:"none", background:"#EF444415", cursor:"pointer" }}>
                    <Icon name="x" size={14} color="#EF4444"/>
                  </button>
                </div>
              </div>
            ))
        )}
        {/* Published */}
        {tab==="published" && published.map(item=>(
          <div key={item.id} style={{ background:t.card, borderRadius:13, padding:"13px 14px", marginBottom:10, border:`1px solid ${t.border}`, display:"flex", alignItems:"center", gap:11 }}>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:13, fontWeight:700, color:t.text, lineHeight:1.3, marginBottom:6 }}>{item.title}</div>
              <div style={{ display:"flex", gap:7, flexWrap:"wrap", alignItems:"center" }}>
                <CategoryBadge cat={item.category} small/>
                <span style={{ fontSize:10, color:t.text3, fontWeight:600 }}> {item.views}   {item.likes}</span>
              </div>
            </div>
            <button onClick={()=>onEditPost(item)} style={{ border:"none", background:"transparent", cursor:"pointer", lineHeight:0, padding:0 }}>
              <Icon name="edit" size={15} color={t.text2}/>
            </button>
            <button onClick={()=>onDeletePost(item.id)} style={{ border:"none", background:"transparent", cursor:"pointer", lineHeight:0, padding:0 }}>
              <Icon name="x" size={15} color="#EF4444"/>
            </button>
          </div>
        ))}
        {/* Users */}
        {tab==="users" && users.map(u=>(
          <div key={u.id} style={{ background:t.card, borderRadius:13, padding:"13px 14px", marginBottom:10, border:`1px solid ${t.border}`, display:"flex", alignItems:"center", gap:11 }}>
            <Avatar initials={u.avatar} imageUrl={u.avatarUrl} size={36} color={u.role==="admin"?"#7C3AED":"#3B82F6"}/>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:13, fontWeight:800, color:t.text }}>{u.name}</div>
              <div style={{ fontSize:11, color:t.text2, marginTop:2, marginBottom:5 }}>{u.email}</div>
              <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}><RoleBadge role={u.role} userType={u.userType}/><Badge text={u.dept} color="#475569" small/></div>
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
              <button onClick={()=>{ setSelectedUserId(u.id); setTab("userPosts"); }} style={{ padding:"5px 10px", borderRadius:7, border:`1px solid ${t.border}`, background:`${t.accent}12`, color:t.accent, fontSize:10, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>Posts</button>
              <button onClick={()=>onEditUser(u)} style={{ padding:"5px 10px", borderRadius:7, border:`1px solid ${t.border}`, background:"transparent", color:t.text2, fontSize:10, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>Edit</button>
              {u.id !== user.id && <button onClick={()=>onDeleteUser(u)} style={{ padding:"5px 10px", borderRadius:7, border:"none", background:"#EF444415", color:"#EF4444", fontSize:10, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>Delete</button>}
            </div>
          </div>
        ))}
        {tab==="userPosts" && (
          userPosts.length===0
            ? <div style={{ textAlign:"center", padding:"28px", color:t.text3, fontSize:12.5, fontWeight:700 }}>No posts for selected user.</div>
            : userPosts.map(item=>(
              <div key={item.id} style={{ background:t.card, borderRadius:13, padding:"13px 14px", marginBottom:10, border:`1px solid ${t.border}`, display:"flex", alignItems:"center", gap:11 }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, fontWeight:700, color:t.text, lineHeight:1.3, marginBottom:6 }}>{item.title}</div>
                  <div style={{ display:"flex", gap:7, flexWrap:"wrap", alignItems:"center" }}>
                    <CategoryBadge cat={item.category} small/>
                    <Badge text={item.status === "pending" ? "Pending" : "Published"} color={item.status === "pending" ? "#B45309" : "#059669"} small/>
                    <span style={{ fontSize:10, color:t.text3, fontWeight:600 }}>{item.views} views  {item.likes} likes</span>
                  </div>
                </div>
                <button onClick={()=>onEditPost(item)} style={{ border:"none", background:"transparent", cursor:"pointer", lineHeight:0, padding:0 }}>
                  <Icon name="edit" size={15} color={t.text2}/>
                </button>
                <button onClick={()=>onDeletePost(item.id)} style={{ border:"none", background:"transparent", cursor:"pointer", lineHeight:0, padding:0 }}>
                  <Icon name="x" size={15} color="#EF4444"/>
                </button>
              </div>
            ))
        )}
      </div>
    </div>
  );
};

const UserEditScreen = ({ t, targetUser, onBack, onSave }) => {
  const [form, setForm] = useState({
    name: targetUser?.name || "",
    email: targetUser?.email || "",
    dept: targetUser?.dept || "",
    role: targetUser?.role || "user",
    userType: targetUser?.userType || "student",
    year: targetUser?.year || "",
    usn: targetUser?.usn || "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm({
      name: targetUser?.name || "",
      email: targetUser?.email || "",
      dept: targetUser?.dept || "",
      role: targetUser?.role || "user",
      userType: targetUser?.userType || "student",
      year: targetUser?.year || "",
      usn: targetUser?.usn || "",
    });
  }, [targetUser]);

  const inp = { width:"100%", padding:"12px 13px", borderRadius:11, border:`1.5px solid ${t.border}`, background:t.input, color:t.text, fontSize:13.5, fontFamily:"inherit", outline:"none", boxSizing:"border-box" };
  const lbl = { fontSize:10.5, fontWeight:700, color:t.text2, letterSpacing:0.5, textTransform:"uppercase", marginBottom:6, display:"block" };

  const update = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const submit = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    await onSave({
      ...targetUser,
      name: form.name.trim(),
      email: form.email.trim(),
      dept: form.dept.trim(),
      role: form.role,
      userType: form.role === "user" ? form.userType : null,
      year: form.role === "user" && form.userType === "student" ? form.year : null,
      usn: form.role === "user" && form.userType === "student" ? form.usn : null,
    });
    setSaving(false);
  };

  return (
    <div style={{ height:"100%", overflowY:"auto" }}>
      <div style={{ position:"sticky", top:0, zIndex:50, background:t.header, borderBottom:`1px solid ${t.border}`, padding:"12px 14px", display:"flex", alignItems:"center", gap:10 }}>
        <button onClick={onBack} style={{ width:34, height:34, borderRadius:"50%", border:`1.5px solid ${t.border}`, background:t.card2, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", lineHeight:0 }}>
          <Icon name="arrow" size={17} color={t.text}/>
        </button>
        <div style={{ flex:1, fontSize:15, fontWeight:800, color:t.text }}>Edit User</div>
        <button onClick={submit} style={{ padding:"7px 14px", borderRadius:9, border:"none", background:t.accent, color:"#fff", fontSize:12, fontWeight:800, cursor:"pointer", fontFamily:"inherit" }}>
          {saving ? "Saving..." : "Save"}
        </button>
      </div>
      <div style={{ padding:"18px 14px 100px", display:"flex", flexDirection:"column", gap:14 }}>
        <div><label style={lbl}>Full Name</label><input style={inp} value={form.name} onChange={(e)=>update("name", e.target.value)}/></div>
        <div><label style={lbl}>Email</label><input style={inp} value={form.email} onChange={(e)=>update("email", e.target.value)} type="email"/></div>
        <div><label style={lbl}>Department</label><input style={inp} value={form.dept} onChange={(e)=>update("dept", e.target.value)}/></div>
        <div>
          <label style={lbl}>Role</label>
          <select style={inp} value={form.role} onChange={(e)=>update("role", e.target.value)}>
            <option value="user">User</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        {form.role === "user" && (
          <>
            <div>
              <label style={lbl}>Type</label>
              <select style={inp} value={form.userType} onChange={(e)=>update("userType", e.target.value)}>
                <option value="student">Student</option>
                <option value="faculty">Faculty</option>
              </select>
            </div>
            {form.userType === "student" && (
              <>
                <div>
                  <label style={lbl}>Year</label>
                  <select style={inp} value={form.year || STUDY_YEARS[0]} onChange={(e)=>update("year", e.target.value)}>
                    {STUDY_YEARS.map((yearOption)=><option key={yearOption}>{yearOption}</option>)}
                  </select>
                </div>
                <div><label style={lbl}>USN</label><input style={inp} value={form.usn || ""} onChange={(e)=>update("usn", e.target.value.toUpperCase())}/></div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};

// PROFILE
const ProfileScreen = ({ user, t, dark, onToggleDark, onLogout, news, onOpenNotifications, onOpenArticle, onUpdateAvatar }) => {
  const saved = news.filter((n) => n.bookmarked);
  const myPosts = news.filter((n) => (n.authorId && n.authorId === user.id) || n.author === user.name);
  const likedPosts = news.filter((n) => !!n.likedBy?.[user.id]);
  const [commentedPostIds, setCommentedPostIds] = useState({});
  const commentedPosts = news.filter((n) => !!n.commentedBy?.[user.id] || !!commentedPostIds[n.id]);
  const [tab, setTab] = useState("saved");
  const fileInputRef = useRef(null);
  const [avatarEditorOpen, setAvatarEditorOpen] = useState(false);
  const [avatarSource, setAvatarSource] = useState("");
  const [avatarImageSize, setAvatarImageSize] = useState({ width: 0, height: 0 });
  const [avatarZoom, setAvatarZoom] = useState(1);
  const [avatarOffsetX, setAvatarOffsetX] = useState(0);
  const [avatarOffsetY, setAvatarOffsetY] = useState(0);
  const [avatarBrightness, setAvatarBrightness] = useState(100);
  const [avatarContrast, setAvatarContrast] = useState(100);
  const [avatarSaturation, setAvatarSaturation] = useState(100);
  const [avatarPreset, setAvatarPreset] = useState("normal");
  const [avatarSaving, setAvatarSaving] = useState(false);
  const previewFrameSize = 220;

  const totalLikes = myPosts.reduce((sum, post) => sum + (post.likes || 0), 0);
  const totalComments = myPosts.reduce((sum, post) => sum + (post.comments || 0), 0);
  const publishedPosts = myPosts.filter((post) => post.status === "published").length;
  const activeScore = Math.min(100, saved.length * 10 + myPosts.length * 20 + Math.floor((totalLikes + totalComments) / 5));

  const items =
    tab === "saved" ? saved :
    tab === "posts" ? myPosts :
    tab === "liked" ? likedPosts :
    commentedPosts;

  useEffect(() => {
    if (!user?.id || !news.length) {
      setCommentedPostIds({});
      return;
    }
    let active = true;
    const loadCommentedPosts = async () => {
      if (!useFirebaseBackend) {
        const localMap = {};
        news.forEach((item) => {
          if (item.commentedBy?.[user.id]) localMap[item.id] = true;
        });
        if (active) setCommentedPostIds(localMap);
        return;
      }
      try {
        const checks = await Promise.all(
          news.map(async (item) => {
            const snap = await getDocs(query(collection(db, "news", item.id, "comments"), where("userId", "==", user.id)));
            return [item.id, !snap.empty];
          })
        );
        const result = {};
        checks.forEach(([postId, hasComment]) => {
          if (hasComment) result[postId] = true;
        });
        if (active) setCommentedPostIds(result);
      } catch (err) {
        console.error("Failed to load comment analytics:", err);
      }
    };
    loadCommentedPosts();
    return () => {
      active = false;
    };
  }, [news, user?.id]);

  const getAvatarFilter = () =>
    `brightness(${avatarBrightness}%) contrast(${avatarContrast}%) saturate(${avatarSaturation}%) ${AVATAR_PRESET_FILTERS[avatarPreset] || ""}`.trim();

  const getAvatarDrawMetrics = (frameSize) => {
    const sourceWidth = avatarImageSize.width || frameSize;
    const sourceHeight = avatarImageSize.height || frameSize;
    const baseScale = Math.max(frameSize / sourceWidth, frameSize / sourceHeight);
    const drawWidth = sourceWidth * baseScale * avatarZoom;
    const drawHeight = sourceHeight * baseScale * avatarZoom;
    const maxShiftX = Math.max(0, (drawWidth - frameSize) / 2);
    const maxShiftY = Math.max(0, (drawHeight - frameSize) / 2);
    return {
      drawWidth,
      drawHeight,
      drawX: (frameSize - drawWidth) / 2 + (avatarOffsetX / 100) * maxShiftX,
      drawY: (frameSize - drawHeight) / 2 + (avatarOffsetY / 100) * maxShiftY,
    };
  };

  const closeAvatarEditor = () => {
    if (avatarSaving) return;
    setAvatarEditorOpen(false);
    setAvatarSource("");
  };

  const renderAvatarOutput = () =>
    new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => {
        const outputSize = 512;
        const canvas = document.createElement("canvas");
        canvas.width = outputSize;
        canvas.height = outputSize;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Could not initialize canvas context."));
          return;
        }
        const { drawWidth, drawHeight, drawX, drawY } = getAvatarDrawMetrics(outputSize);
        ctx.clearRect(0, 0, outputSize, outputSize);
        ctx.save();
        ctx.beginPath();
        ctx.arc(outputSize / 2, outputSize / 2, outputSize / 2, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        ctx.filter = getAvatarFilter();
        ctx.drawImage(image, drawX, drawY, drawWidth, drawHeight);
        ctx.restore();
        resolve(canvas.toDataURL("image/jpeg", 0.92));
      };
      image.onerror = () => reject(new Error("Could not process selected image."));
      image.src = avatarSource;
    });

  const saveAvatarEdits = async () => {
    if (!avatarSource || avatarSaving) return;
    setAvatarSaving(true);
    try {
      const avatarUrl = await renderAvatarOutput();
      onUpdateAvatar(avatarUrl);
      if (useFirebaseBackend && user?.id) {
        await setDoc(
          doc(db, "users", user.id),
          { avatarUrl, updatedAt: serverTimestamp() },
          { merge: true }
        );
      }
      setAvatarEditorOpen(false);
      setAvatarSource("");
    } catch (err) {
      console.error("Failed to save avatar:", err);
      window.alert("Could not save avatar. Please try again.");
    } finally {
      setAvatarSaving(false);
    }
  };

  const handleAvatarUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      window.alert("Please upload an image file.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      window.alert("Image must be 2MB or smaller.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const avatarUrl = typeof reader.result === "string" ? reader.result : "";
      if (!avatarUrl) return;
      const image = new Image();
      image.onload = () => {
        setAvatarImageSize({
          width: image.naturalWidth || image.width || 1,
          height: image.naturalHeight || image.height || 1,
        });
        setAvatarSource(avatarUrl);
        setAvatarZoom(1);
        setAvatarOffsetX(0);
        setAvatarOffsetY(0);
        setAvatarBrightness(100);
        setAvatarContrast(100);
        setAvatarSaturation(100);
        setAvatarPreset("normal");
        setAvatarEditorOpen(true);
      };
      image.onerror = () => {
        window.alert("Could not open the selected image.");
      };
      image.src = avatarUrl;
    };
    reader.readAsDataURL(file);
    event.target.value = "";
  };

  return (
    <div style={{ height:"100%", overflowY:"auto" }}>
      <div style={{ background:"linear-gradient(145deg,#060d1f,#0f2040,#1a3870)", padding:"28px 18px 20px" }}>
        <div style={{ display:"flex", alignItems:"center", gap:14, marginBottom:18 }}>
          <div style={{ position:"relative" }}>
            <Avatar initials={user.avatar} imageUrl={user.avatarUrl} size={68} color="#F59E0B"/>
            <button onClick={() => fileInputRef.current?.click()} style={{ position:"absolute", bottom:0, right:0, width:24, height:24, borderRadius:"50%", border:"2px solid #060d1f", background:"#F59E0B", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", lineHeight:0 }}>
              <Icon name="edit" size={11} color="#fff"/>
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" style={{ display:"none" }} onChange={handleAvatarUpload}/>
          </div>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:19, fontWeight:900, color:"#fff", letterSpacing:-0.3 }}>{user.name}</div>
            <div style={{ fontSize:11.5, color:"rgba(255,255,255,0.55)", marginTop:2 }}>{user.email}</div>
            <div style={{ display:"flex", gap:7, marginTop:8, flexWrap:"wrap" }}>
              <RoleBadge role={user.role} userType={user.userType}/>
              <Badge text={user.dept} color="#3B82F6"/>
              {user.year && <Badge text={user.year} color="#6B7280"/>}
              {user.usn && <Badge text={user.usn} color="#475569"/>}
            </div>
          </div>
          <button onClick={onLogout} style={{ background:"rgba(255,255,255,0.1)", border:"1px solid rgba(255,255,255,0.2)", borderRadius:9, padding:"7px 10px", cursor:"pointer", lineHeight:0 }}>
            <Icon name="logout" size={15} color="#fff"/>
          </button>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10 }}>
          {[
            [`${myPosts.length}`,"My Posts","posts"],
            [`${saved.length}`,"Saved","saved"],
            [`${commentedPosts.length}`,"Comments","commented"],
          ].map(([v,l,targetTab])=>(
            <button key={l} onClick={() => setTab(targetTab)} style={{ border:"none", background:"rgba(255,255,255,0.08)", borderRadius:11, padding:"11px", textAlign:"center", cursor:"pointer", fontFamily:"inherit" }}>
              <div style={{ fontSize:20, fontWeight:900, color:"#F59E0B" }}>{v}</div>
              <div style={{ fontSize:9.5, color:"rgba(255,255,255,0.55)", fontWeight:600, marginTop:2, textTransform:"uppercase", letterSpacing:0.4 }}>{l}</div>
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding:"14px 14px 100px" }}>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:18 }}>
          {[
            { icon:"moon", label:dark?"Light Mode":"Dark Mode", col:"#7C3AED", action:onToggleDark },
            { icon:"bell", label:"Notifications", col:"#F59E0B", action:onOpenNotifications },
            { icon:"bookmark", label:`Saved (${saved.length})`, col:"#059669", action:() => setTab("saved") },
            { icon:"chart", label:"My Analytics", col:"#3B82F6", action:() => setTab("analytics") },
          ].map((a,i)=>(
            <button key={i} onClick={a.action} style={{ background:t.card, borderRadius:13, padding:"13px 12px", border:`1px solid ${t.border}`, cursor:"pointer", textAlign:"left", fontFamily:"inherit" }}>
              <div style={{ width:34, height:34, borderRadius:9, background:`${a.col}18`, display:"flex", alignItems:"center", justifyContent:"center", marginBottom:7 }}><Icon name={a.icon} size={16} color={a.col}/></div>
              <div style={{ fontSize:12, fontWeight:800, color:t.text, lineHeight:1.3 }}>{a.label}</div>
            </button>
          ))}
        </div>

        <div style={{ display:"flex", background:t.card2, borderRadius:11, padding:3, marginBottom:14, border:`1px solid ${t.border}` }}>
          <button onClick={()=>setTab("saved")} style={{ flex:1, padding:"8px", borderRadius:9, border:"none", background:tab==="saved"?t.accent:"transparent", color:tab==="saved"?"#fff":t.text2, fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>Saved ({saved.length})</button>
          <button onClick={()=>setTab("posts")} style={{ flex:1, padding:"8px", borderRadius:9, border:"none", background:tab==="posts"?t.accent:"transparent", color:tab==="posts"?"#fff":t.text2, fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>My Posts ({myPosts.length})</button>
          <button onClick={()=>setTab("liked")} style={{ flex:1, padding:"8px", borderRadius:9, border:"none", background:tab==="liked"?t.accent:"transparent", color:tab==="liked"?"#fff":t.text2, fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>Liked ({likedPosts.length})</button>
          <button onClick={()=>setTab("commented")} style={{ flex:1, padding:"8px", borderRadius:9, border:"none", background:tab==="commented"?t.accent:"transparent", color:tab==="commented"?"#fff":t.text2, fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>Commented ({commentedPosts.length})</button>
          <button onClick={()=>setTab("analytics")} style={{ flex:1, padding:"8px", borderRadius:9, border:"none", background:tab==="analytics"?t.accent:"transparent", color:tab==="analytics"?"#fff":t.text2, fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>Analytics</button>
        </div>

        {tab === "analytics" && (
          <div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:12 }}>
              {[
                ["Published Posts", publishedPosts, "#059669"],
                ["Total Likes", totalLikes, "#EF4444"],
                ["Total Comments", totalComments, "#3B82F6"],
                ["Engagement Score", `${activeScore}%`, "#F59E0B"],
              ].map(([label, value, color]) => (
                <div key={label} style={{ background:t.card, borderRadius:13, padding:"12px 13px", border:`1px solid ${t.border}` }}>
                  <div style={{ fontSize:18, fontWeight:900, color }}>{value}</div>
                  <div style={{ fontSize:10.5, color:t.text2, fontWeight:700, marginTop:3 }}>{label}</div>
                </div>
              ))}
            </div>
            <div style={{ background:t.card, border:`1px solid ${t.border}`, borderRadius:13, padding:"13px 14px", marginBottom:10 }}>
              <div style={{ fontSize:12.5, color:t.text, fontWeight:800, marginBottom:8 }}>Activity On BMSCE-Buzz</div>
              <div style={{ height:10, borderRadius:6, background:t.card2, overflow:"hidden", marginBottom:8 }}>
                <div style={{ width:`${activeScore}%`, height:"100%", background:"linear-gradient(90deg,#F59E0B,#D97706)" }}/>
              </div>
              <div style={{ fontSize:11, color:t.text2 }}>Based on your posts, saved items, and post engagement.</div>
            </div>
            {myPosts.length === 0 ? (
              <div style={{ textAlign:"center", padding:"24px", color:t.text3, fontWeight:700, fontSize:12.5 }}>No posts yet to analyze.</div>
            ) : (
              myPosts.map((item) => (
                <div key={item.id} style={{ background:t.card, borderRadius:13, padding:"12px 14px", marginBottom:10, border:`1px solid ${t.border}`, display:"flex", alignItems:"center", gap:10 }}>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13, fontWeight:800, color:t.text, marginBottom:4, lineHeight:1.3 }}>{item.title}</div>
                    <div style={{ display:"flex", gap:9, fontSize:11, color:t.text2, fontWeight:700 }}>
                      <span><Icon name="eye" size={12} color={t.text3}/> {item.views}</span>
                      <span><Icon name="heart" size={12} color="#EF4444"/> {item.likes}</span>
                      <span><Icon name="comment" size={12} color="#3B82F6"/> {item.comments}</span>
                    </div>
                  </div>
                  <button onClick={() => onOpenArticle(item)} style={{ border:"none", background:"transparent", cursor:"pointer", lineHeight:0, padding:0 }}>
                    <Icon name="arrow" size={16} color={t.text3}/>
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {tab !== "analytics" && (
          items.length===0
            ? <div style={{ textAlign:"center", padding:"36px", color:t.text3 }}><div style={{ fontSize:13, fontWeight:700, marginTop:10 }}>Nothing here yet</div></div>
            : items.map(item=>(
              <button key={item.id} onClick={() => onOpenArticle(item)} style={{ width:"100%", background:t.card, borderRadius:13, padding:"12px 14px", marginBottom:10, border:`1px solid ${t.border}`, display:"flex", alignItems:"center", gap:11, textAlign:"left", cursor:"pointer", fontFamily:"inherit" }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, fontWeight:700, color:t.text, lineHeight:1.3, marginBottom:5 }}>{item.title}</div>
                  <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                    <CategoryBadge cat={item.category} small/>
                    {tab==="posts"&&<Badge text={item.status==="pending"?"Pending":"Published"} color={item.status==="pending"?"#B45309":"#059669"} small/>}
                    {tab==="liked"&&<Badge text="Liked" color="#EF4444" small/>}
                    {tab==="commented"&&<Badge text="Commented" color="#3B82F6" small/>}
                  </div>
                </div>
                <Icon name={tab==="saved"?"bookmarkF":tab==="liked"?"heartF":"arrow"} size={16} color={tab==="saved"?"#F59E0B":tab==="liked"?"#EF4444":t.text3}/>
              </button>
            ))
        )}
      </div>

      {avatarEditorOpen && (
        <div style={{ position:"absolute", inset:0, zIndex:70, background:dark?"rgba(2,6,23,0.84)":"rgba(15,23,42,0.56)", backdropFilter:"blur(4px)", display:"flex", alignItems:"center", justifyContent:"center", padding:12 }}>
          <div style={{ width:"100%", maxWidth:380, maxHeight:"95%", overflowY:"auto", background:t.card, border:`1px solid ${t.border}`, borderRadius:18, padding:"14px 14px 12px", boxShadow:"0 24px 60px rgba(0,0,0,0.3)" }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
              <div>
                <div style={{ fontSize:16, fontWeight:900, color:t.text }}>Edit Avatar</div>
                <div style={{ fontSize:11, color:t.text2, fontWeight:600 }}>Crop and apply filters before saving.</div>
              </div>
              <button onClick={closeAvatarEditor} style={{ width:30, height:30, borderRadius:"50%", border:`1px solid ${t.border}`, background:t.card2, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", lineHeight:0 }}>
                <Icon name="x" size={14} color={t.text2}/>
              </button>
            </div>

            <div style={{ display:"flex", justifyContent:"center", marginBottom:12 }}>
              <div style={{ width:previewFrameSize, height:previewFrameSize, borderRadius:"50%", overflow:"hidden", border:`3px solid ${t.border}`, position:"relative", background:t.card2 }}>
                {avatarSource && (() => {
                  const preview = getAvatarDrawMetrics(previewFrameSize);
                  return (
                    <img
                      src={avatarSource}
                      alt="Avatar preview"
                      style={{
                        position:"absolute",
                        left:preview.drawX,
                        top:preview.drawY,
                        width:preview.drawWidth,
                        height:preview.drawHeight,
                        filter:getAvatarFilter(),
                        userSelect:"none",
                        pointerEvents:"none",
                      }}
                    />
                  );
                })()}
              </div>
            </div>

            <div style={{ display:"flex", gap:6, overflowX:"auto", paddingBottom:3, marginBottom:10 }}>
              {AVATAR_FILTER_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => setAvatarPreset(preset.id)}
                  style={{
                    flexShrink:0,
                    border:"none",
                    borderRadius:999,
                    padding:"7px 12px",
                    cursor:"pointer",
                    fontSize:11.5,
                    fontWeight:800,
                    color:avatarPreset===preset.id ? "#fff" : t.text2,
                    background:avatarPreset===preset.id ? t.accent : t.card2,
                    fontFamily:"inherit",
                  }}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            <div style={{ display:"grid", gap:8 }}>
              <label style={{ fontSize:10.5, color:t.text2, fontWeight:800, textTransform:"uppercase", letterSpacing:0.5 }}>Zoom {avatarZoom.toFixed(2)}x</label>
              <input type="range" min={1} max={3} step={0.01} value={avatarZoom} onChange={(e) => setAvatarZoom(Number(e.target.value))}/>

              <label style={{ fontSize:10.5, color:t.text2, fontWeight:800, textTransform:"uppercase", letterSpacing:0.5 }}>Horizontal {avatarOffsetX}</label>
              <input type="range" min={-100} max={100} step={1} value={avatarOffsetX} onChange={(e) => setAvatarOffsetX(Number(e.target.value))}/>

              <label style={{ fontSize:10.5, color:t.text2, fontWeight:800, textTransform:"uppercase", letterSpacing:0.5 }}>Vertical {avatarOffsetY}</label>
              <input type="range" min={-100} max={100} step={1} value={avatarOffsetY} onChange={(e) => setAvatarOffsetY(Number(e.target.value))}/>

              <label style={{ fontSize:10.5, color:t.text2, fontWeight:800, textTransform:"uppercase", letterSpacing:0.5 }}>Brightness {avatarBrightness}%</label>
              <input type="range" min={70} max={140} step={1} value={avatarBrightness} onChange={(e) => setAvatarBrightness(Number(e.target.value))}/>

              <label style={{ fontSize:10.5, color:t.text2, fontWeight:800, textTransform:"uppercase", letterSpacing:0.5 }}>Contrast {avatarContrast}%</label>
              <input type="range" min={70} max={140} step={1} value={avatarContrast} onChange={(e) => setAvatarContrast(Number(e.target.value))}/>

              <label style={{ fontSize:10.5, color:t.text2, fontWeight:800, textTransform:"uppercase", letterSpacing:0.5 }}>Saturation {avatarSaturation}%</label>
              <input type="range" min={0} max={180} step={1} value={avatarSaturation} onChange={(e) => setAvatarSaturation(Number(e.target.value))}/>
            </div>

            <div style={{ display:"flex", gap:8, marginTop:14 }}>
              <button onClick={closeAvatarEditor} disabled={avatarSaving} style={{ flex:1, border:`1px solid ${t.border}`, background:t.card2, color:t.text, borderRadius:11, padding:"10px 12px", cursor:avatarSaving?"not-allowed":"pointer", fontWeight:800, fontFamily:"inherit" }}>
                Cancel
              </button>
              <button onClick={saveAvatarEdits} disabled={avatarSaving} style={{ flex:1, border:"none", background:t.accent, color:"#fff", borderRadius:11, padding:"10px 12px", cursor:avatarSaving?"not-allowed":"pointer", fontWeight:800, fontFamily:"inherit", opacity:avatarSaving?0.75:1 }}>
                {avatarSaving ? "Saving..." : "Save Avatar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// COMPOSE
const ComposeScreen = ({ user, t, onBack, onPublish }) => {
  const [title, setTitle]       = useState("");
  const [body, setBody]         = useState("");
  const [category, setCategory] = useState("Academics");
  const [tags, setTags]         = useState("");
  const [priority, setPriority] = useState("normal");
  const [step, setStep]         = useState(1);
  const [coverImageName, setCoverImageName] = useState("");
  const fileInputRef = useRef(null);

  const inp = { width:"100%", padding:"12px 13px", borderRadius:11, border:`1.5px solid ${t.border}`, background:t.input, color:t.text, fontSize:13.5, fontFamily:"inherit", outline:"none", boxSizing:"border-box" };
  const lbl = { fontSize:10.5, fontWeight:700, color:t.text2, letterSpacing:0.5, textTransform:"uppercase", marginBottom:6, display:"block" };
  const btn = (bg,col,cb,label,extra={}) => <button onClick={cb} style={{ width:"100%", padding:"13px", borderRadius:12, border:"none", background:bg, color:col, fontSize:13.5, fontWeight:800, cursor:"pointer", fontFamily:"inherit", ...extra }}>{label}</button>;

  const insertSnippet = (token) => setBody((prev) => (prev ? `${prev} ${token}` : token));
  const submit = () => {
    if (!title.trim()) return window.alert("Title is required.");
    if (!body.trim()) return window.alert("Content is required.");
    onPublish({ title, body, category, tags:tags.split(",").map(x=>x.trim()).filter(Boolean), priority });
  };

  return (
    <div style={{ height:"100%", overflowY:"auto" }}>
      <div style={{ position:"sticky", top:0, zIndex:50, background:t.header, borderBottom:`1px solid ${t.border}`, padding:"12px 14px", display:"flex", alignItems:"center", gap:10 }}>
        <button onClick={onBack} style={{ width:34, height:34, borderRadius:"50%", border:`1.5px solid ${t.border}`, background:t.card2, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", lineHeight:0 }}>
          <Icon name="x" size={17} color={t.text}/>
        </button>
        <div style={{ flex:1, fontSize:15, fontWeight:800, color:t.text }}>New Article</div>
        <button onClick={submit} style={{ padding:"7px 14px", borderRadius:9, border:"none", background:t.accent, color:"#fff", fontSize:12, fontWeight:800, cursor:"pointer", fontFamily:"inherit" }}>Submit </button>
      </div>
      <div style={{ padding:"18px 14px 100px" }}>
        {/* Steps */}
        <div style={{ display:"flex", marginBottom:20, background:t.card, borderRadius:11, overflow:"hidden", border:`1px solid ${t.border}` }}>
          {["Details","Content","Publish"].map((l,i)=>(
            <button key={l} onClick={()=>setStep(i+1)} style={{ flex:1, padding:"9px 6px", border:"none", background:step===i+1?t.accent:"transparent", cursor:"pointer", borderRight:i<2?`1px solid ${t.border}`:"none", fontFamily:"inherit" }}>
              <div style={{ fontSize:11, fontWeight:800, color:step===i+1?"#fff":t.text2 }}>{i+1}. {l}</div>
            </button>
          ))}
        </div>

        {step===1 && (
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            <div><label style={lbl}>Title *</label><input style={inp} placeholder="Enter a compelling headline" value={title} onChange={e=>setTitle(e.target.value)}/></div>
            <div><label style={lbl}>Category *</label>
              <select style={inp} value={category} onChange={e=>setCategory(e.target.value)}>{CATEGORIES.filter(c=>c!=="All").map(c=><option key={c}>{c}</option>)}</select>
            </div>
            <div><label style={lbl}>Department</label>
              <select style={inp}>{DEPTS.map(d=><option key={d}>{d}</option>)}</select>
            </div>
            <div><label style={lbl}>Tags (comma-separated)</label><input style={inp} placeholder="e.g. TCS, Placement, 2025" value={tags} onChange={e=>setTags(e.target.value)}/></div>
            {btn(t.accent,"#fff",()=>setStep(2),"Next: Add Content ")}
          </div>
        )}
        {step===2 && (
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            <div style={{ display:"flex", gap:6, flexWrap:"wrap", padding:"8px 10px", background:t.card, borderRadius:10, border:`1px solid ${t.border}` }}>
              {["B","I","U","H1","H2","List","Link",""].map(b=>(
                <button key={b} onClick={()=>insertSnippet(`[${b}]`)} style={{ padding:"4px 9px", borderRadius:7, border:`1px solid ${t.border}`, background:t.input, color:t.text, fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>{b}</button>
              ))}
            </div>
            <div>
              <label style={lbl}>Content *</label>
              <textarea style={{ ...inp, minHeight:180, resize:"vertical", lineHeight:1.65 }} placeholder="Write your article" value={body} onChange={e=>setBody(e.target.value)}/>
            </div>
            <div onClick={()=>fileInputRef.current?.click()} style={{ border:`2px dashed ${t.border}`, borderRadius:11, padding:"20px", textAlign:"center", cursor:"pointer" }}>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                style={{ display:"none" }}
                onChange={(e) => setCoverImageName(e.target.files?.[0]?.name || "")}
              />
              <div style={{ fontSize:24, marginBottom:5 }}></div>
              <div style={{ fontSize:13, fontWeight:700, color:t.text2 }}>Upload Cover Image</div>
              <div style={{ fontSize:11, color:t.text3, marginTop:3 }}>{coverImageName || "PNG, JPG up to 10MB"}</div>
            </div>
            <div style={{ display:"flex", gap:8 }}>
              <button onClick={()=>setStep(1)} style={{ flex:1, padding:"12px", borderRadius:11, border:`1.5px solid ${t.border}`, background:"transparent", color:t.text, fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}> Back</button>
              <button onClick={()=>setStep(3)} style={{ flex:2, padding:"12px", borderRadius:11, border:"none", background:t.accent, color:"#fff", fontSize:13, fontWeight:800, cursor:"pointer", fontFamily:"inherit" }}>Next </button>
            </div>
          </div>
        )}
        {step===3 && (
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            <div>
              <label style={lbl}>Priority Level</label>
              <div style={{ display:"flex", gap:8 }}>
                {[["normal","Normal","#059669"],["high","High","#F59E0B"],["urgent","Urgent","#EF4444"]].map(([v,l,c])=>(
                  <button key={v} onClick={()=>setPriority(v)} style={{ flex:1, padding:"10px 6px", borderRadius:11, border:`2px solid ${priority===v?c:t.border}`, background:priority===v?`${c}15`:"transparent", color:priority===v?c:t.text2, fontSize:11, fontWeight:800, cursor:"pointer", fontFamily:"inherit" }}>{l}</button>
                ))}
              </div>
            </div>
            <div><label style={lbl}>Schedule</label><input type="datetime-local" style={inp}/></div>
            <div><label style={lbl}>Expiry Date</label><input type="date" style={inp}/></div>
            {/* Preview */}
            <div style={{ background:t.card, borderRadius:13, padding:"14px", border:`1px solid ${t.border}` }}>
              <div style={{ fontSize:10.5, fontWeight:800, color:t.text2, textTransform:"uppercase", letterSpacing:0.5, marginBottom:9 }}>Preview</div>
              <div style={{ display:"flex", gap:7, marginBottom:8 }}><CategoryBadge cat={category} small/><Badge text={priority} color={priority==="urgent"?"#EF4444":priority==="high"?"#F59E0B":"#059669"} small/></div>
              <div style={{ fontSize:14.5, fontWeight:800, color:t.text, lineHeight:1.3 }}>{title||"Your article title here"}</div>
              <div style={{ fontSize:11, color:t.text2, marginTop:5 }}>By {user.name}  {user.dept}</div>
            </div>
            <div style={{ display:"flex", gap:8 }}>
              <button onClick={()=>setStep(2)} style={{ flex:1, padding:"12px", borderRadius:11, border:`1.5px solid ${t.border}`, background:"transparent", color:t.text, fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}> Back</button>
              <button onClick={submit} style={{ flex:2, padding:"12px", borderRadius:11, border:"none", background:"linear-gradient(135deg,#059669,#047857)", color:"#fff", fontSize:13, fontWeight:900, cursor:"pointer", fontFamily:"inherit" }}>Submit for Review </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// 
// ROOT APP
// 
export default function CampusConnect() {
  const [dark, setDark]           = useState(true);
  const [user, setUser]           = useState(null);
  const [tab, setTab]             = useState("home");
  const [screen, setScreen]       = useState("login");
  const [article, setArticle]     = useState(null);
  const [editingUser, setEditingUser] = useState(null);
  const [news, setNews]           = useState(NEWS);
  const [notifs, setNotifs]       = useState(LOCAL_NOTIFS);
  const [users, setUsers]         = useState([]);
  const navHistoryRef = useRef([]);
  const navStateRef = useRef(null);
  const navRestoreRef = useRef(false);

  const t = th(dark);

  const isAdmin = user && user.role === "admin";
  const canPost  = !!user;
  const unreadCount = notifs.filter((n) => !n.read).length;
  const newsWithUser = news.map((item) => ({
    ...item,
    bookmarked: !!(user?.id && item.savedBy?.[user.id]),
  }));
  const importantNotice = newsWithUser
    .filter((item) => item.status === "published" && item.tags.some((tag) => tag.toLowerCase() === "important"))
    .sort((a, b) => b.date.localeCompare(a.date))[0] || null;
  const events = newsWithUser
    .filter((item) => item.status === "published" && ["Cultural Events", "Sports", "Exams", "Academics"].includes(item.category))
    .map((item) => ({
      id: `event-${item.id}`,
      date: item.date,
      title: item.title,
      time: "All Day",
      venue: item.dept || "Campus",
      category: item.category,
      color:
        item.category === "Sports" ? "emerald" :
        item.category === "Exams" ? "rose" :
        item.category === "Cultural Events" ? "purple" : "blue",
    }));
  const currentArticle = article?.id ? (newsWithUser.find((item) => item.id === article.id) || article) : article;
  const isNativeMobile = typeof window !== "undefined" && Capacitor.isNativePlatform();

  const applyNavigationState = (nextState) => {
    if (!nextState) return;
    navRestoreRef.current = true;
    setScreen(nextState.screen || "app");
    setTab(nextState.tab || "home");
    setArticle(nextState.article || null);
    setEditingUser(nextState.editingUser || null);
  };

  const createNotification = async ({ title, type = "system", icon = "S", audienceRoles = ["all"], audienceUserIds = [] }) => {
    if (!useFirebaseBackend) return;
    try {
      await addDoc(collection(db, "notifications"), {
        title,
        type,
        icon,
        audienceRoles: normalizeAudienceRoles(audienceRoles),
        audienceUserIds: normalizeAudienceUserIds(audienceUserIds),
        readBy: {},
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      console.error("Failed to create notification:", err);
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

  useEffect(() => {
    if (!useFirebaseBackend) return undefined;
    const unsub = onSnapshot(
      collection(db, "news"),
      (snap) => {
        const remoteNews = snap.docs
          .map((newsDoc) => mapFirestoreNews(newsDoc.id, newsDoc.data()))
          .sort((a, b) => b.date.localeCompare(a.date));
        setNews(remoteNews);
      },
      (err) => {
        console.error("Failed to read Firestore news:", err);
      }
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!useFirebaseBackend) return undefined;
    const unsub = onSnapshot(
      collection(db, "users"),
      (snap) => {
        const mapped = snap.docs.map((userDoc) => {
          const data = userDoc.data() || {};
          return {
            id: userDoc.id,
            name: data.name || "User",
            email: data.email || "",
            role: data.role || "user",
            userType: data.role === "user" ? (data.userType || "student") : null,
            dept: data.dept || "N/A",
            year: data.year || null,
            usn: data.usn || null,
            avatar: data.avatar || getInitials(data.name || "User"),
            avatarUrl: data.avatarUrl || "",
          };
        });
        setUsers(mapped);
      },
      (err) => {
        console.error("Failed to read users:", err);
      }
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user) {
      setNotifs(LOCAL_NOTIFS);
      return undefined;
    }
    if (!useFirebaseBackend) return undefined;

    const unsub = onSnapshot(
      collection(db, "notifications"),
      (snap) => {
        const mapped = snap.docs
          .map((notifDoc) => {
            const data = notifDoc.data();
            const roles = normalizeAudienceRoles(Array.isArray(data.audienceRoles) ? data.audienceRoles : ["all"]);
            const audienceUserIds = normalizeAudienceUserIds(Array.isArray(data.audienceUserIds) ? data.audienceUserIds : []);
            const canAccessByRole = roles.includes("all") || roles.includes(user.role);
            const canAccessByUserId = audienceUserIds.includes(user.id);
            if (!canAccessByRole && !canAccessByUserId) return null;
            if (user.role === "user" && typeof data.title === "string" && data.title.toLowerCase().includes("pending review")) return null;
            return mapFirestoreNotif(notifDoc.id, data, user.id);
          })
          .filter(Boolean)
          .sort((a, b) => b.createdAtMs - a.createdAtMs);
        setNotifs(mapped);
      },
      (err) => {
        console.error("Failed to read Firestore notifications:", err);
      }
    );

    return () => unsub();
  }, [user]);

  useEffect(() => {
    const currentNavState = { screen, tab, article, editingUser };
    if (!navStateRef.current) {
      navStateRef.current = currentNavState;
      return;
    }
    const prevNavState = navStateRef.current;
    const hasChanged =
      prevNavState.screen !== currentNavState.screen ||
      prevNavState.tab !== currentNavState.tab ||
      (prevNavState.article?.id || "") !== (currentNavState.article?.id || "") ||
      (prevNavState.editingUser?.id || "") !== (currentNavState.editingUser?.id || "");
    if (!hasChanged) return;

    if (navRestoreRef.current) {
      navRestoreRef.current = false;
    } else {
      navHistoryRef.current.push(prevNavState);
      if (navHistoryRef.current.length > 80) navHistoryRef.current.shift();
    }
    navStateRef.current = currentNavState;
  }, [screen, tab, article, editingUser]);

  useEffect(() => {
    if (!isNativeMobile) return undefined;

    let listenerHandle = null;
    CapacitorApp.addListener("backButton", () => {
      if (navHistoryRef.current.length) {
        const previousState = navHistoryRef.current.pop();
        applyNavigationState(previousState);
        return;
      }

      const currentNavState = navStateRef.current || { screen: "app", tab: "home", article: null, editingUser: null };
      if (currentNavState.screen !== "app") {
        applyNavigationState({ screen: "app", tab: "home", article: null, editingUser: null });
        return;
      }
      if (currentNavState.tab !== "home") {
        navRestoreRef.current = true;
        setTab("home");
        return;
      }
      CapacitorApp.exitApp();
    })
      .then((handle) => {
        listenerHandle = handle;
      })
      .catch((err) => {
        console.error("Failed to attach native back-button handler:", err);
      });

    return () => {
      if (listenerHandle?.remove) listenerHandle.remove();
    };
  }, [isNativeMobile]);

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
      .catch((err) => {
        console.error("Failed to register FCM token:", err);
      });

    let unsubscribeForeground = () => {};
    subscribeToForegroundMessages((payload) => {
      const title = payload?.notification?.title || "New update";
      const body = payload?.notification?.body || "You received a new notification.";
      setNotifs((prev) => [
        {
          id: `local-${Date.now()}`,
          title: `${title}: ${body}`,
          type: "system",
          icon: "S",
          read: false,
          time: "just now",
          createdAtMs: Date.now(),
        },
        ...prev,
      ]);
    }).then((unsub) => {
      unsubscribeForeground = unsub || (() => {});
    });

    return () => unsubscribeForeground();
  }, [user]);

  const handleLogin = (profile) => {
    navHistoryRef.current = [];
    navStateRef.current = null;
    navRestoreRef.current = false;
    const role = profile?.role || "user";
    const base = USERS[role] || USERS.user;
    const resolvedName = profile?.name || base.name;
    setUser({
      ...base,
      ...profile,
      id: profile?.uid || profile?.id || base.id,
      name: resolvedName,
      email: profile?.email || base.email,
      avatar: profile?.avatar || getInitials(resolvedName),
      avatarUrl: profile?.avatarUrl || "",
      userType: profile?.userType || (role === "user" ? "student" : null),
    });
    setScreen("app");
    setTab(role === "admin" ? "admin" : "home");
  };
  const handleUpdateAvatar = (avatarUrl) => {
    setUser((prev) => (prev ? { ...prev, avatarUrl } : prev));
  };
  const handleLogout  = () => {
    navHistoryRef.current = [];
    navStateRef.current = null;
    navRestoreRef.current = false;
    setUser(null);
    setArticle(null);
    setEditingUser(null);
    setScreen("login");
    setTab("home");
  };
  const openArticle   = async (item) => {
    if (!item) return;
    setArticle(item);
    setScreen("article");
    if (useFirebaseBackend) {
      try {
        await updateDoc(doc(db, "news", item.id), { views: increment(1) });
      } catch (err) {
        console.error("Failed to update views:", err);
      }
    } else {
      setNews((prev) => prev.map((newsItem) => (newsItem.id === item.id ? { ...newsItem, views: (newsItem.views || 0) + 1 } : newsItem)));
    }
  };
  const bookmark      = async (id)   => {
    if (!user?.id) return;
    const target = news.find((n) => n.id === id);
    if (useFirebaseBackend && target) {
      try {
        const nextSavedBy = { ...(target.savedBy || {}) };
        if (nextSavedBy[user.id]) {
          delete nextSavedBy[user.id];
        } else {
          nextSavedBy[user.id] = true;
        }
        await updateDoc(doc(db, "news", id), { savedBy: nextSavedBy });
      } catch (err) {
        console.error("Failed to update bookmark:", err);
      }
      return;
    }
    setNews((prev) =>
      prev.map((newsItem) => {
        if (newsItem.id !== id) return newsItem;
        const nextSavedBy = { ...(newsItem.savedBy || {}) };
        if (nextSavedBy[user.id]) delete nextSavedBy[user.id];
        else nextSavedBy[user.id] = true;
        return { ...newsItem, savedBy: nextSavedBy };
      })
    );
  };
  const toggleLike = async (id) => {
    if (!user?.id) return;
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
      } catch (err) {
        console.error("Failed to update like:", err);
      }
      return;
    }
    setNews((prev) =>
      prev.map((newsItem) => {
        if (newsItem.id !== id) return newsItem;
        const nextLikedBy = { ...(newsItem.likedBy || {}) };
        if (isLiked) delete nextLikedBy[user.id];
        else nextLikedBy[user.id] = true;
        return { ...newsItem, likedBy: nextLikedBy, likes: (newsItem.likes || 0) + (isLiked ? -1 : 1) };
      })
    );
  };
  const approve = async (id) => {
    if (!isAdmin) return;
    const target = news.find((n) => n.id === id);
    if (useFirebaseBackend) {
      try {
        await updateDoc(doc(db, "news", id), { status: "published" });
      } catch (err) {
        console.error("Failed to approve post:", err);
        return;
      }
    } else {
      setNews(p=>p.map(n=>n.id===id?{...n,status:"published"}:n));
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
  };
  const reject  = async (id) => {
    if (!isAdmin) return;
    const target = news.find((n) => n.id === id);
    if (useFirebaseBackend) {
      try {
        await deleteDoc(doc(db, "news", id));
      } catch (err) {
        console.error("Failed to reject post:", err);
        return;
      }
    } else {
      setNews(p=>p.filter(n=>n.id!==id));
    }
    if (target) {
      await createNotification({
        title: `Post rejected: ${target.title}`,
        type: "system",
        icon: "S",
        audienceRoles: [target.authorRole || "user"],
      });
    }
  };
  const publish = async (data) => {
    const isUserPost = user.role === "user";
    const n = {
      id:`n${Date.now()}`,
      status:isUserPost ? "pending" : "published",
      views:0,
      likes:0,
      comments:0,
      likedBy:{},
      savedBy:{},
      tags:[],
      image:"academics",
      year:["All Years"],
      dept:user.dept,
      date:new Date().toISOString().slice(0,10),
      author:user.name,
      authorId:user.id,
      authorRole:user.role,
      summary:(data.body||"").slice(0,160),
      ...data,
    };
    if (useFirebaseBackend) {
      try {
        await addDoc(collection(db, "news"), { ...n, createdAt: serverTimestamp() });
        if (isUserPost) {
          await createNotification({
            title: `New ${n.category} post pending review: ${n.title}`,
            type: "comment",
            icon: "C",
            audienceRoles: ["admin"],
          });
        } else {
          await createPublishedPostNotification(n);
        }
      } catch (err) {
        console.error("Failed to publish post:", err);
        return;
      }
    } else {
      setNews(p=>[...p,n]);
    }
    setScreen("app"); setTab("home");
  };

  const markNotifRead = async (notifId) => {
    if (!useFirebaseBackend || !user?.id || notifId.startsWith("local-")) {
      setNotifs((prev) => prev.map((item) => (item.id === notifId ? { ...item, read: true } : item)));
      return;
    }
    try {
      await updateDoc(doc(db, "notifications", notifId), { [`readBy.${user.id}`]: true });
      setNotifs((prev) => prev.map((item) => (item.id === notifId ? { ...item, read: true } : item)));
    } catch (err) {
      console.error("Failed to mark notification as read:", err);
    }
  };

  const markAllNotifsRead = async () => {
    const unreadNotifs = notifs.filter((item) => !item.read);
    if (!unreadNotifs.length) return;
    if (!useFirebaseBackend || !user?.id) {
      setNotifs((prev) => prev.map((item) => ({ ...item, read: true })));
      return;
    }
    try {
      const batch = writeBatch(db);
      unreadNotifs
        .filter((item) => !item.id.startsWith("local-"))
        .forEach((item) => {
          batch.update(doc(db, "notifications", item.id), { [`readBy.${user.id}`]: true });
        });
      await batch.commit();
      setNotifs((prev) => prev.map((item) => ({ ...item, read: true })));
    } catch (err) {
      console.error("Failed to mark all notifications as read:", err);
    }
  };
  const editPost = async (post) => {
    const nextTitle = window.prompt("Edit post title:", post.title);
    if (!nextTitle || !nextTitle.trim()) return;
    const nextSummary = window.prompt("Edit post summary:", post.summary || "") || post.summary || "";
    if (useFirebaseBackend) {
      try {
        await updateDoc(doc(db, "news", post.id), {
          title: nextTitle.trim(),
          summary: nextSummary.trim(),
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        console.error("Failed to edit post:", err);
      }
      return;
    }
    setNews((prev) => prev.map((item) => (item.id === post.id ? { ...item, title: nextTitle.trim(), summary: nextSummary.trim() } : item)));
  };
  const openUserEditor = (targetUser) => {
    setEditingUser(targetUser);
    setScreen("editUser");
  };
  const saveUserEdits = async (targetUser) => {
    if (!targetUser?.id) return;
    if (!useFirebaseBackend) {
      setUsers((prev) => prev.map((item) => (item.id === targetUser.id ? { ...item, ...targetUser } : item)));
      setScreen("app");
      setTab("admin");
      setEditingUser(null);
      return;
    }
    try {
      await setDoc(
        doc(db, "users", targetUser.id),
        {
          name: targetUser.name?.trim() || "User",
          email: targetUser.email?.trim() || "",
          dept: targetUser.dept?.trim() || "",
          role: targetUser.role || "user",
          userType: targetUser.role === "user" ? (targetUser.userType || "student") : null,
          year: targetUser.role === "user" && targetUser.userType === "student" ? (targetUser.year || null) : null,
          usn: targetUser.role === "user" && targetUser.userType === "student" ? (targetUser.usn || null) : null,
          avatar: getInitials(targetUser.name || "User"),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      if (targetUser.id === user?.id) {
        setUser((prev) => prev ? {
          ...prev,
          name: targetUser.name?.trim() || prev.name,
          email: targetUser.email?.trim() || prev.email,
          dept: targetUser.dept?.trim() || prev.dept,
          role: targetUser.role || prev.role,
          userType: targetUser.role === "user" ? (targetUser.userType || "student") : null,
          year: targetUser.role === "user" && targetUser.userType === "student" ? (targetUser.year || null) : null,
          usn: targetUser.role === "user" && targetUser.userType === "student" ? (targetUser.usn || null) : null,
          avatar: getInitials(targetUser.name || prev.name),
        } : prev);
      }
      setScreen("app");
      setTab("admin");
      setEditingUser(null);
    } catch (err) {
      console.error("Failed to edit user:", err);
    }
  };
  const deletePost = async (postId) => {
    const confirmed = window.confirm("Delete this post?");
    if (!confirmed) return;
    if (useFirebaseBackend) {
      try {
        await deleteDoc(doc(db, "news", postId));
      } catch (err) {
        console.error("Failed to delete post:", err);
      }
      return;
    }
    setNews((prev) => prev.filter((item) => item.id !== postId));
  };
  const deleteUserProfile = async (targetUser) => {
    const confirmed = window.confirm(`Delete user profile for ${targetUser.name}?`);
    if (!confirmed) return;
    try {
      await deleteDoc(doc(db, "users", targetUser.id));
    } catch (err) {
      console.error("Failed to delete user profile:", err);
    }
  };

  const navItems = [
    { id:"home",    icon:"home",     label:"Feed" },
    { id:"search",  icon:"search",   label:"Search" },
    { id:"events",  icon:"calendar", label:"Events" },
    { id:"notifs",  icon:"bell",     label:"Alerts", badge:unreadCount },
    ...(isAdmin ? [{ id:"admin", icon:"shield", label:"Admin" }] : []),
    { id:"profile", icon:"user",     label:"Profile" },
  ];

  return (
    <div style={{ width:"100%", height:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:dark?"#030712":"#CBD5E1", fontFamily:"'Segoe UI',system-ui,-apple-system,sans-serif" }}>
      <div style={{ width:"100%", maxWidth:430, height:"100%", maxHeight:870, background:t.bg, position:"relative", overflow:"hidden", display:"flex", flexDirection:"column", boxShadow:"0 30px 80px rgba(0,0,0,0.7)", borderRadius:window.innerWidth>520?"32px":0, border:window.innerWidth>520?`1px solid ${t.border}`:"none" }}>

        {/* Main */}
        <div style={{ flex:1, overflow:"hidden", position:"relative" }}>
          {screen==="login"   && <LoginScreen onLogin={handleLogin} dark={dark} onToggleDark={()=>setDark(!dark)}/>}
          {screen==="compose" && <ComposeScreen user={user} t={t} onBack={()=>setScreen("app")} onPublish={publish}/>}
          {screen==="article" && currentArticle && <ArticleScreen item={currentArticle} t={t} user={user} onBack={()=>setScreen("app")} onBookmark={bookmark} onToggleLike={toggleLike}/>}
          {screen==="app" && (
            <>
              {tab==="home"    && <HomeScreen user={user} t={t} news={newsWithUser} onOpenArticle={openArticle} onBookmark={bookmark} onToggleLike={toggleLike} importantNotice={importantNotice} dark={dark} onToggleDark={()=>setDark(!dark)} onOpenProfile={() => setTab("profile")}/>}
              {tab==="search"  && <SearchScreen user={user} t={t} news={newsWithUser} onOpenArticle={openArticle} onBookmark={bookmark} onToggleLike={toggleLike}/>}
              {tab==="events"  && <EventsScreen t={t} events={events}/>}
              {tab==="notifs"  && <NotificationsScreen t={t} notifs={notifs} onMarkRead={markNotifRead} onMarkAllRead={markAllNotifsRead}/>}
              {tab==="admin"   && <AdminScreen user={user} t={t} news={newsWithUser} users={users} onApprove={approve} onReject={reject} onEditPost={editPost} onDeletePost={deletePost} onEditUser={openUserEditor} onDeleteUser={deleteUserProfile}/>}
              {tab==="profile" && (
                <ProfileScreen
                  user={user}
                  t={t}
                  dark={dark}
                  onToggleDark={()=>setDark(!dark)}
                  onLogout={handleLogout}
                  news={newsWithUser}
                  onOpenNotifications={() => setTab("notifs")}
                  onOpenArticle={openArticle}
                  onUpdateAvatar={handleUpdateAvatar}
                />
              )}
            </>
          )}
          {screen==="editUser" && editingUser && (
            <UserEditScreen
              t={t}
              targetUser={editingUser}
              onBack={() => { setScreen("app"); setTab("admin"); setEditingUser(null); }}
              onSave={saveUserEdits}
            />
          )}
        </div>

        {/* Bottom Nav */}
        {(screen==="app"||screen==="article") && (
          <div style={{ background:t.nav, borderTop:`1px solid ${t.border}`, padding:"6px 6px 12px", display:"flex", alignItems:"center", flexShrink:0, position:"relative" }}>
            {navItems.map(item=>(
              <button key={item.id} onClick={()=>{setScreen("app");setTab(item.id);}} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:3, background:"none", border:"none", cursor:"pointer", padding:"6px 2px", position:"relative" }}>
                <div style={{ position:"relative" }}>
                  <Icon name={item.icon} size={21} color={(tab===item.id&&screen==="app")?t.accent:t.text3}/>
                  {item.badge>0 && <div style={{ position:"absolute", top:-4, right:-5, width:14, height:14, borderRadius:"50%", background:"#EF4444", display:"flex", alignItems:"center", justifyContent:"center" }}><span style={{ fontSize:8, color:"#fff", fontWeight:900 }}>{item.badge}</span></div>}
                </div>
                <span style={{ fontSize:9, fontWeight:700, color:(tab===item.id&&screen==="app")?t.accent:t.text3 }}>{item.label}</span>
                {tab===item.id&&screen==="app"&&<div style={{ position:"absolute", bottom:-2, width:18, height:2.5, borderRadius:2, background:t.accent }}/>}
              </button>
            ))}
            {/* FAB */}
            {canPost && screen==="app" && (
              <button onClick={()=>setScreen("compose")} style={{ position:"absolute", top:-24, right:14, width:48, height:48, borderRadius:"50%", background:"linear-gradient(135deg,#F59E0B,#D97706)", border:`3px solid ${t.bg}`, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", boxShadow:"0 4px 16px rgba(245,158,11,0.5)", lineHeight:0 }}>
                <Icon name="plus" size={21} color="#fff"/>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}



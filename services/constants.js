export const PRIMARY_ADMIN = {
  name: "Darshan Maruthi",
  email: "dd7085646@gmail.com",
  nickname: "Dboss@18",
  favoriteSport: "Cricket",
  password: "Darshan@17+1",
  dept: "Administration",
};

export const USERS = {
  user: {
    id: "u1",
    name: "Aryan Sharma",
    role: "user",
    dept: "Computer Science",
    year: "3rd Year",
    usn: "1BM24CS001",
    avatar: "AS",
    email: "aryan@college.edu",
  },
  admin: {
    id: "u2",
    name: PRIMARY_ADMIN.name,
    role: "admin",
    dept: PRIMARY_ADMIN.dept,
    year: null,
    usn: null,
    avatar: "DM",
    email: PRIMARY_ADMIN.email,
  },
};

export const ROLE_LABELS = {
  user: "User",
  admin: "Admin",
  student: "Student",
  faculty: "Faculty",
  superadmin: "Super Admin",
};

export const CATEGORIES = [
  "All",
  "Academics",
  "Placements",
  "Cultural Events",
  "Sports",
  "Clubs",
  "Exams",
  "Urgent Notices",
];

export const DEPTS = [
  "All Departments",
  "Computer Science",
  "Electronics",
  "Mechanical",
  "Civil",
  "Business",
  "Arts",
  "Law",
];

export const STUDY_YEARS = ["1st Year", "2nd Year", "3rd Year", "4th Year"];
export const BRANCHES = DEPTS.filter((dept) => dept !== "All Departments");

export const CATEGORY_COLORS = {
  Placements: "#059669",
  "Cultural Events": "#7C3AED",
  Exams: "#DC2626",
  Sports: "#1D4ED8",
  Clubs: "#0891B2",
  Academics: "#1E40AF",
  "Urgent Notices": "#B91C1C",
  All: "#475569",
};

export const NOTIFICATION_TYPE_COLORS = {
  urgent: "#EF4444",
  comment: "#3B82F6",
  like: "#EF4444",
  approval: "#059669",
  event: "#F59E0B",
  system: "#7C3AED",
};

export const LOCAL_NOTIFS = [];
export const LOCAL_NEWS = [];

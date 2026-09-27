export const API = (import.meta.env.VITE_BACKEND_URL || "http://localhost:5000").replace(/\/$/, "");

export const apiError = (err, fallback = "Something went wrong") =>
    err?.response?.data?.error || err?.message || fallback;

export const dashboardPath = (role) => ({ faculty: "/faculty", ta: "/ta", student: "/student" }[role] || "/login");

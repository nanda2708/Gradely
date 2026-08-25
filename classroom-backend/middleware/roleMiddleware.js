import Faculty from "../models/faculty.js";
import Student from "../models/student.js";
import TA from "../models/ta.js";

const roleModels = {
    faculty: Faculty,
    student: Student,
    ta: TA
};

export const requireRole = (...allowedRoles) => async (req, res, next) => {
    try {
        if (!req.firebaseUser?.email) {
            return res.status(401).json({ error: "Authenticated user information is missing" });
        }

        const normalizedEmail = req.firebaseUser.email.toLowerCase();

        for (const role of allowedRoles) {
            const Model = roleModels[role];
            if (!Model) continue;

            const user = await Model.findOne({ email: normalizedEmail });
            if (user) {
                req.userRole = role;
                req.mongoUser = user;
                return next();
            }
        }

        return res.status(403).json({ error: "You do not have permission to access this resource" });
    } catch (err) {
        console.error("Role authorization failed:", err);
        return res.status(500).json({ error: "Authorization check failed" });
    }
};

export const requireMatchingEmail = (source = "body") => (req, res, next) => {
    const suppliedEmail = source === "query" ? req.query.email : req.body?.email;
    const authenticatedEmail = req.firebaseUser?.email;

    if (!suppliedEmail || !authenticatedEmail || suppliedEmail.toLowerCase().trim() !== authenticatedEmail.toLowerCase().trim()) {
        return res.status(403).json({ error: "The authenticated user does not match the requested account" });
    }

    return next();
};

import { Router } from "express";
import Faculty from "../models/faculty.js";
import Student from "../models/student.js";
import TA from "../models/ta.js";

const authRouter = Router();

// Return the MongoDB account belonging to the already authenticated Firebase user.
// This endpoint is intentionally scoped to the caller and does not accept an
// arbitrary email, preventing cross-account ID lookups during login.
authRouter.get("/me", async (req, res) => {
    try {
        const email = req.firebaseUser?.email?.toLowerCase().trim();
        if (!email) return res.status(401).json({ error: "Authenticated email is missing" });

        const [faculty, student, ta] = await Promise.all([
            Faculty.findOne({ email }).lean(),
            Student.findOne({ email }).lean(),
            TA.findOne({ email }).lean()
        ]);

        if (faculty) {
            return res.status(200).json({
                id: faculty._id,
                role: "faculty",
                name: faculty.name,
                email: faculty.email,
                emailVerified: Boolean(faculty.emailVerified),
                phoneVerified: Boolean(faculty.phoneVerified)
            });
        }

        if (student) {
            return res.status(200).json({
                id: student._id,
                role: "student",
                name: student.name,
                email: student.email,
                emailVerified: Boolean(student.emailVerified),
                phoneVerified: Boolean(student.phoneVerified)
            });
        }

        if (ta) {
            return res.status(200).json({
                id: ta._id,
                role: "ta",
                name: ta.name,
                email: ta.email,
                emailVerified: Boolean(ta.emailVerified),
                phoneVerified: Boolean(ta.phoneVerified)
            });
        }

        return res.status(404).json({ error: "Gradely account not found" });
    } catch (err) {
        console.error("Error retrieving authenticated Gradely account:", err);
        return res.status(500).json({ error: "Internal Server Error" });
    }
});

export default authRouter;

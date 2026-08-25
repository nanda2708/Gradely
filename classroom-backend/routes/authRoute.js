import { Router } from "express";
import { getFirestore } from "firebase-admin/firestore";
import Faculty from "../models/faculty.js";
import Student from "../models/student.js";
import TA from "../models/ta.js";

const authRouter = Router();

const modelsByRole = { faculty: Faculty, student: Student, ta: TA };

const serializeUser = (user, role) => ({
    id: user._id,
    role,
    name: user.name,
    email: user.email,
    emailVerified: Boolean(user.emailVerified),
    phoneVerified: Boolean(user.phoneVerified)
});

authRouter.get("/me", async (req, res) => {
    try {
        const email = req.firebaseUser?.email?.toLowerCase().trim();
        if (!email) return res.status(401).json({ error: "Authenticated email is missing" });

        const [faculty, student, ta] = await Promise.all([
            Faculty.findOne({ email }).lean(),
            Student.findOne({ email }).lean(),
            TA.findOne({ email }).lean()
        ]);

        if (faculty) return res.status(200).json(serializeUser(faculty, "faculty"));
        if (student) return res.status(200).json(serializeUser(student, "student"));
        if (ta) return res.status(200).json(serializeUser(ta, "ta"));

        return res.status(404).json({ error: "Gradely account not found" });
    } catch (err) {
        console.error("Error retrieving authenticated Gradely account:", err);
        return res.status(500).json({ error: "Internal Server Error" });
    }
});

// Recover a Firebase/Firestore account whose MongoDB record was never created.
// The role is read server-side from the authenticated user's Firestore profile.
authRouter.post("/provision", async (req, res) => {
    try {
        const email = req.firebaseUser?.email?.toLowerCase().trim();
        if (!email) return res.status(401).json({ error: "Authenticated email is missing" });

        const firestoreUser = await getFirestore().collection("users").doc(email).get();
        if (!firestoreUser.exists) {
            return res.status(404).json({ error: "Gradely profile not found in Firestore" });
        }

        const profile = firestoreUser.data() || {};
        const role = profile.role;
        const Model = modelsByRole[role];
        if (!Model) return res.status(400).json({ error: "Gradely profile has an invalid role" });

        const existing = await Model.findOne({ email });
        if (existing) return res.status(200).json(serializeUser(existing, role));

        const created = await Model.create({
            email,
            name: (profile.name || req.firebaseUser.name || "Gradely User").trim(),
            phoneNumber: profile.phoneNumber || "",
            emailVerified: Boolean(req.firebaseUser.email_verified),
            phoneVerified: Boolean(profile.phoneVerified)
        });

        return res.status(201).json(serializeUser(created, role));
    } catch (err) {
        console.error("Error provisioning Gradely account:", err);
        return res.status(500).json({ error: "Unable to provision Gradely account" });
    }
});

export default authRouter;

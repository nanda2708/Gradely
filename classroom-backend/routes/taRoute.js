import { Router } from "express";
import TA from "../models/ta.js";
import Course from "../models/courses.js";
import Solution from "../models/solutions.js";
import { requireMatchingEmail, requireRole } from "../middleware/roleMiddleware.js";

const taRouter = Router();
const idEquals = (a, b) => a?.toString() === b?.toString();

taRouter.post("/createTA", requireMatchingEmail("body"), async (req, res) => {
    try {
        const ta = await TA.create(req.body);
        return res.status(201).json(ta);
    } catch (err) {
        console.error("Error creating TA in DB:", err);
        return res.status(500).json({ error: "Internal Server Error" });
    }
});

taRouter.get("/getTAData", requireMatchingEmail("query"), async (req, res) => {
    try {
        const ta = await TA.findOne({ email: req.query.email.toLowerCase().trim() });
        if (!ta) return res.status(404).json({ error: "TA not found" });
        return res.status(200).json(ta);
    } catch (err) {
        console.error("Error retrieving TA data:", err);
        return res.status(500).json({ error: "Internal Server Error" });
    }
});

// Faculty uses this lookup when enrolling a TA into a course.
taRouter.get("/getTAID", requireRole("faculty"), async (req, res) => {
    try {
        const email = req.query.email?.toLowerCase().trim();
        if (!email) return res.status(400).json({ error: "TA email is required" });

        const ta = await TA.findOne({ email });
        if (!ta) return res.status(404).json({ error: "TA not found" });
        return res.status(200).json(ta._id);
    } catch (err) {
        console.error("Error retrieving TA ID:", err);
        return res.status(500).json({ error: "Internal Server Error" });
    }
});

taRouter.post("/addCourse", requireRole("ta", "faculty"), async (req, res) => {
    const { taId, courseId } = req.body;
    try {
        if (!courseId || !taId) {
            return res.status(400).json({ error: "Course ID and TA ID are required!" });
        }

        const course = await Course.findById(courseId).select("faculty tas");
        if (!course) return res.status(404).json({ error: "Course not found" });

        if (req.userRole === "ta") {
            if (!idEquals(taId, req.mongoUser._id)) {
                return res.status(403).json({ error: "You can only modify your own TA account" });
            }
        } else if (!idEquals(course.faculty, req.mongoUser._id)) {
            return res.status(403).json({ error: "You do not own this course" });
        }

        const ta = await TA.findById(taId);
        if (!ta) return res.status(404).json({ error: "TA not found" });

        if (ta.courses.some(id => idEquals(id, courseId))) {
            return res.status(200).json({ message: "Course already linked to TA", ta });
        }

        ta.courses.addToSet(courseId);
        await ta.save();
        return res.status(200).json({ message: "Course added successfully to TA!", ta });
    } catch (err) {
        console.error("Error adding course to TA:", err);
        return res.status(500).json({ error: "Internal Server Error" });
    }
});

taRouter.get("/getCourses/:taId", requireRole("ta"), async (req, res) => {
    try {
        const { taId } = req.params;
        if (taId !== req.mongoUser._id.toString()) {
            return res.status(403).json({ error: "You can only access your own courses" });
        }

        const ta = await TA.findById(taId).populate({
            path: "courses",
            populate: [
                { path: "faculty", select: "name email" },
                {
                    path: "assignments",
                    select: "title course dueDate submissions marks url",
                    populate: { path: "course", select: "name students" }
                }
            ]
        });

        if (!ta) return res.status(404).json({ error: "TA not found" });
        return res.status(200).json({ courses: ta.courses });
    } catch (err) {
        console.error("Error getting TA courses:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
});

taRouter.get("/getCheckedSolutions/:taId", requireRole("ta"), async (req, res) => {
    try {
        const { taId } = req.params;
        if (taId !== req.mongoUser._id.toString()) {
            return res.status(403).json({ error: "You can only access your own checked solutions" });
        }

        const checkedSolutions = await Solution.find({ gradedBy: taId, gradedByRole: "TA" })
            .populate({
                path: "assignment",
                select: "title course marks",
                populate: { path: "course", select: "name" }
            })
            .populate({ path: "student", select: "name email" })
            .sort({ checkedDate: -1 });

        return res.status(200).json({ checkedSolutions });
    } catch (err) {
        console.error("Error getting checked solutions:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
});

export default taRouter;

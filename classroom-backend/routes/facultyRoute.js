import { Router } from "express";
import Faculty from "../models/faculty.js";
import { requireMatchingEmail, requireRole } from "../middleware/roleMiddleware.js";

const facultyRouter = Router();

facultyRouter.post("/createFaculty", requireMatchingEmail("body"), async (req, res) => {
    try {
        const faculty = await Faculty.create(req.body);
        return res.status(201).json(faculty);
    } catch (err) {
        console.error("Error creating faculty in DB:", err);
        return res.status(500).json({ error: "Internal Server Error" });
    }
});

facultyRouter.get("/getFacultyID", requireMatchingEmail("query"), async (req, res) => {
    try {
        const faculty = await Faculty.findOne({ email: req.query.email.toLowerCase().trim() });
        if (!faculty) return res.status(404).json({ error: "Faculty not found" });
        return res.status(200).json(faculty._id);
    } catch (err) {
        console.error("Error retrieving faculty ID:", err);
        return res.status(500).json({ error: "Internal Server Error" });
    }
});

facultyRouter.post("/addCourse", requireRole("faculty"), async (req, res) => {
    const { facultyId, courseId } = req.body;
    try {
        if (!facultyId || !courseId) {
            return res.status(400).json({ error: "Faculty ID and Course ID both are required!" });
        }
        if (facultyId.toString() !== req.mongoUser._id.toString()) {
            return res.status(403).json({ error: "You can only modify your own faculty account" });
        }

        if (req.mongoUser.courses.some(id => id.toString() === courseId.toString())) {
            return res.status(409).json({ error: "Course is already linked to this faculty!" });
        }

        req.mongoUser.courses.push(courseId);
        await req.mongoUser.save();
        return res.status(200).json({ message: "Course added to faculty successfully", faculty: req.mongoUser });
    } catch (err) {
        console.error("Error adding course to faculty:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
});

facultyRouter.get("/getCourses/:facultyId", requireRole("faculty"), async (req, res) => {
    try {
        if (req.params.facultyId !== req.mongoUser._id.toString()) {
            return res.status(403).json({ error: "You can only access your own courses" });
        }

        const faculty = await Faculty.findById(req.params.facultyId).populate("courses");
        if (!faculty) return res.status(404).json({ error: "Faculty not found" });

        return res.status(200).json({ courses: faculty.courses });
    } catch (err) {
        console.error("Error getting courses:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
});

facultyRouter.get("/getAssignments/:facultyId", requireRole("faculty"), async (req, res) => {
    try {
        if (req.params.facultyId !== req.mongoUser._id.toString()) {
            return res.status(403).json({ error: "You can only access your own assignments" });
        }

        const faculty = await Faculty.findById(req.params.facultyId).populate({
            path: "assignments",
            populate: { path: "course", select: "name students" }
        });

        if (!faculty) return res.status(404).json({ error: "Faculty not found" });
        return res.status(200).json({ assignments: faculty.assignments });
    } catch (err) {
        console.error("Error getting faculty assignments:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
});

facultyRouter.post("/addAssignment", requireRole("faculty"), async (req, res) => {
    const { facultyId, assignmentId } = req.body;
    try {
        if (!facultyId || !assignmentId) {
            return res.status(400).json({ error: "Faculty ID and Assignment ID both are required!" });
        }
        if (facultyId.toString() !== req.mongoUser._id.toString()) {
            return res.status(403).json({ error: "You can only modify your own faculty account" });
        }

        if (req.mongoUser.assignments.some(id => id.toString() === assignmentId.toString())) {
            return res.status(409).json({ error: "Assignment is already linked to this faculty!" });
        }

        req.mongoUser.assignments.push(assignmentId);
        await req.mongoUser.save();
        return res.status(200).json({ message: "Assignment added to faculty successfully", faculty: req.mongoUser });
    } catch (err) {
        console.error("Error adding assignment to faculty:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
});

export default facultyRouter;

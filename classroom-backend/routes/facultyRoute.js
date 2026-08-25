import { Router } from "express";
import Faculty from "../models/faculty.js";

const facultyRouter = Router();

facultyRouter.post("/createFaculty", async (req, res) => {
    try {
        const faculty = await Faculty.create(req.body);
        return res.status(201).json(faculty);
    } catch (err) {
        console.error("Error creating faculty in DB:", err);
        return res.status(500).json({ error: "Internal Server Error" });
    }
});

facultyRouter.get("/getFacultyID", async (req, res) => {
    try {
        const { email } = req.query;
        if (!email) return res.status(400).json({ error: "Email is required" });

        const faculty = await Faculty.findOne({ email });
        if (!faculty) return res.status(404).json({ error: "Faculty not found" });

        return res.status(200).json(faculty._id);
    } catch (err) {
        console.error("Error retrieving faculty ID:", err);
        return res.status(500).json({ error: "Internal Server Error" });
    }
});

facultyRouter.post("/addCourse", async (req, res) => {
    const { facultyId, courseId } = req.body;
    try {
        if (!facultyId || !courseId) {
            return res.status(400).json({ error: "Faculty ID and Course ID both are required!" });
        }

        const faculty = await Faculty.findById(facultyId);
        if (!faculty) return res.status(404).json({ error: "Faculty not found" });

        if (faculty.courses.some(id => id.toString() === courseId.toString())) {
            return res.status(409).json({ error: "Course is already linked to this faculty!" });
        }

        faculty.courses.push(courseId);
        await faculty.save();
        return res.status(200).json({ message: "Course added to faculty successfully", faculty });
    } catch (err) {
        console.error("Error adding course to faculty:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
});

facultyRouter.get("/getCourses/:facultyId", async (req, res) => {
    try {
        const { facultyId } = req.params;
        if (!facultyId) return res.status(400).json({ error: "Faculty ID required!" });

        const faculty = await Faculty.findById(facultyId).populate("courses");
        if (!faculty) return res.status(404).json({ error: "Faculty not found" });

        return res.status(200).json({ courses: faculty.courses });
    } catch (err) {
        console.error("Error getting courses:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
});

facultyRouter.get("/getAssignments/:facultyId", async (req, res) => {
    try {
        const { facultyId } = req.params;
        if (!facultyId) return res.status(400).json({ error: "Faculty ID required!" });

        const faculty = await Faculty.findById(facultyId).populate({
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

facultyRouter.post("/addAssignment", async (req, res) => {
    const { facultyId, assignmentId } = req.body;
    try {
        if (!facultyId || !assignmentId) {
            return res.status(400).json({ error: "Faculty ID and Assignment ID both are required!" });
        }

        const faculty = await Faculty.findById(facultyId);
        if (!faculty) return res.status(404).json({ error: "Faculty not found" });

        if (faculty.assignments.some(id => id.toString() === assignmentId.toString())) {
            return res.status(409).json({ error: "Assignment is already linked to this faculty!" });
        }

        faculty.assignments.push(assignmentId);
        await faculty.save();
        return res.status(200).json({ message: "Assignment added to faculty successfully", faculty });
    } catch (err) {
        console.error("Error adding assignment to faculty:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
});

export default facultyRouter;

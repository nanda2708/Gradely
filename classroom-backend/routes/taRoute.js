import { Router } from "express";
import TA from "../models/ta.js";
import Solution from "../models/solutions.js";

const taRouter = Router();

taRouter.post("/createTA", async (req, res) => {
    try {
        const ta = await TA.create(req.body);
        return res.status(201).json(ta);
    } catch (err) {
        console.error("Error creating TA in DB:", err);
        return res.status(500).json({ error: "Internal Server Error" });
    }
});

taRouter.get("/getTAData", async (req, res) => {
    try {
        const { email } = req.query;
        if (!email) return res.status(400).json({ error: "Email is required" });

        const ta = await TA.findOne({ email });
        if (!ta) return res.status(404).json({ error: "TA not found" });

        return res.status(200).json(ta);
    } catch (err) {
        console.error("Error retrieving TA data:", err);
        return res.status(500).json({ error: "Internal Server Error" });
    }
});

taRouter.get("/getTAID", async (req, res) => {
    try {
        const { email } = req.query;
        if (!email) return res.status(400).json({ error: "Email is required" });

        const ta = await TA.findOne({ email });
        if (!ta) return res.status(404).json({ error: "TA not found" });

        return res.status(200).json(ta._id);
    } catch (err) {
        console.error("Error retrieving TA ID:", err);
        return res.status(500).json({ error: "Internal Server Error" });
    }
});

taRouter.post("/addCourse", async (req, res) => {
    const { taId, courseId } = req.body;
    try {
        if (!courseId || !taId) {
            return res.status(400).json({ error: "Course ID and TA ID are required!" });
        }

        const ta = await TA.findById(taId);
        if (!ta) return res.status(404).json({ error: "TA not found" });

        if (ta.courses.some(id => id.toString() === courseId.toString())) {
            return res.status(409).json({ error: "Course has already been added!" });
        }

        ta.courses.push(courseId);
        await ta.save();
        return res.status(200).json({ message: "Course added successfully to TA!", ta });
    } catch (err) {
        console.error("Error adding course to TA:", err);
        return res.status(500).json({ error: "Internal Server Error" });
    }
});

taRouter.get("/getCourses/:taId", async (req, res) => {
    try {
        const { taId } = req.params;
        if (!taId) return res.status(400).json({ error: "TA ID required!" });

        const ta = await TA.findById(taId).populate({
            path: "courses",
            populate: [
                { path: "faculty", select: "name email" },
                {
                    path: "assignments",
                    select: "title course dueDate submissions marks url",
                    populate: {
                        path: "course",
                        select: "name students"
                    }
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

taRouter.get("/getCheckedSolutions/:taId", async (req, res) => {
    try {
        const { taId } = req.params;
        if (!taId) return res.status(400).json({ error: "TA ID required!" });

        const checkedSolutions = await Solution.find({ gradedBy: taId })
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

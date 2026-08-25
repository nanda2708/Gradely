import { Router } from "express";
import Student from "../models/student.js";
import Assignment from "../models/assignment.js";
import Solution from "../models/solutions.js";

const studentRouter = Router();

studentRouter.post("/createStudent", async (req, res) => {
    try {
        const student = await Student.create(req.body);
        return res.status(201).json(student);
    } catch (err) {
        console.error("Error creating student in DB:", err);
        return res.status(500).json({ error: "Internal Server Error" });
    }
});

studentRouter.get("/getStudentID", async (req, res) => {
    try {
        const { email } = req.query;
        if (!email) return res.status(400).json({ error: "Email is required" });

        const student = await Student.findOne({ email });
        if (!student) return res.status(404).json({ error: "Student not found" });

        return res.status(200).json(student._id);
    } catch (err) {
        console.error("Error retrieving student ID:", err);
        return res.status(500).json({ error: "Internal Server Error" });
    }
});

studentRouter.post("/addCourse", async (req, res) => {
    const { courseId, studentId } = req.body;

    try {
        if (!courseId || !studentId) {
            return res.status(400).json({ error: "Course ID and Student ID both are required!" });
        }

        const student = await Student.findById(studentId);
        if (!student) return res.status(404).json({ error: "Student not found" });

        if (student.courses.some(id => id.toString() === courseId.toString())) {
            return res.status(409).json({ error: "Course has already been added!" });
        }

        student.courses.push(courseId);
        await student.save();
        return res.status(200).json({ message: "Course added successfully to student!", student });
    } catch (err) {
        console.error("Error adding course to student:", err);
        return res.status(500).json({ error: "Internal Server Error" });
    }
});

studentRouter.get("/getCourses/:studentId", async (req, res) => {
    try {
        const { studentId } = req.params;
        if (!studentId) return res.status(400).json({ error: "Student ID required!" });

        const student = await Student.findById(studentId).populate({
            path: "courses",
            populate: [
                { path: "faculty", select: "name email" },
                { path: "assignments" }
            ]
        }).lean();

        if (!student) return res.status(404).json({ error: "Student not found" });

        const allAssignments = student.courses.flatMap(course => course.assignments || []);
        const assignmentIds = allAssignments.map(assignment => assignment._id);

        const submissions = await Solution.find({
            student: studentId,
            assignment: { $in: assignmentIds }
        }).sort({ submittedDate: -1 }).lean();

        const submissionMap = new Map();
        submissions.forEach(submission => {
            const key = submission.assignment.toString();
            if (!submissionMap.has(key)) submissionMap.set(key, submission);
        });

        const now = new Date();

        student.courses.forEach(course => {
            course.assignments = (course.assignments || []).map(assignment => {
                const idStr = assignment._id.toString();
                const latestSubmission = submissionMap.get(idStr);

                if (latestSubmission) {
                    assignment.status = latestSubmission.status === "graded" ? "graded" : "submitted";
                    assignment.submission = latestSubmission;
                } else if (assignment.dueDate && new Date(assignment.dueDate) < now) {
                    assignment.status = "overdue";
                } else {
                    assignment.status = "pending";
                }

                return assignment;
            });
        });

        return res.status(200).json({ courses: student.courses });
    } catch (err) {
        console.error("Error getting student courses:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
});

studentRouter.get("/:studentId/course/:courseId/submissions", async (req, res) => {
    try {
        const { studentId, courseId } = req.params;
        if (!studentId || !courseId) {
            return res.status(400).json({ error: "Student ID and Course ID are required!" });
        }

        const assignments = await Assignment.find({ course: courseId }).select("_id");
        const assignmentIds = assignments.map(assignment => assignment._id);

        const submissions = await Solution.find({
            assignment: { $in: assignmentIds },
            student: studentId
        })
            .populate("assignment", "title marks")
            .populate("gradedBy", "name");

        const submittedAssignments = submissions.map(submission => submission.assignment._id);

        return res.status(200).json({ submissions, submittedAssignments });
    } catch (err) {
        console.error("Error getting student course submissions:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
});

studentRouter.get("/submissions/:studentId", async (req, res) => {
    try {
        const { studentId } = req.params;
        if (!studentId) return res.status(400).json({ error: "Student ID required!" });

        const submissions = await Solution.find({ student: studentId }).populate([
            {
                path: "assignment",
                populate: { path: "course", select: "name" }
            },
            { path: "gradedBy", select: "name" }
        ]).sort({ submittedDate: -1 });

        return res.status(200).json({ submissions });
    } catch (err) {
        console.error("Error getting submissions:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
});

export default studentRouter;

import { Router } from "express";
import Solution from "../models/solutions.js";
import Student from "../models/student.js";
import Assignment from "../models/assignment.js";
import mongoose from "mongoose";
import TA from "../models/ta.js";
import Faculty from "../models/faculty.js";
import { requireRole } from "../middleware/roleMiddleware.js";

const submissionRouter = Router();

const idEquals = (a, b) => a?.toString() === b?.toString();
const includesId = (array = [], id) => array.some(item => idEquals(item, id));

submissionRouter.post("/submitSolution", requireRole("student"), async (req, res) => {
    const { filename, url, publicId, assignmentId, studentId } = req.body;

    if (!url || !assignmentId || !studentId) {
        return res.status(400).json({ error: "Submission URL, assignment ID and student ID are required" });
    }

    if (!idEquals(studentId, req.mongoUser._id)) {
        return res.status(403).json({ error: "You can only submit work for yourself" });
    }

    const session = await mongoose.startSession();

    try {
        session.startTransaction();

        const [student, assignment] = await Promise.all([
            Student.findById(studentId).session(session),
            Assignment.findById(assignmentId).session(session)
        ]);

        if (!student) {
            await session.abortTransaction();
            return res.status(404).json({ error: "Student not found" });
        }
        if (!assignment) {
            await session.abortTransaction();
            return res.status(404).json({ error: "Assignment not found" });
        }

        if (!includesId(student.courses, assignment.course)) {
            await session.abortTransaction();
            return res.status(403).json({ error: "Student is not enrolled in this course" });
        }

        const solution = new Solution({
            filename: filename || "Solution",
            url,
            publicId,
            assignment: assignmentId,
            student: studentId,
            status: assignment.dueDate && new Date() > new Date(assignment.dueDate) ? "overdue" : "pending"
        });

        await solution.save({ session });
        student.submissions.addToSet(solution._id);
        assignment.submissions.addToSet(solution._id);
        await student.save({ session });
        await assignment.save({ session });

        await session.commitTransaction();
        return res.status(201).json({ submission: solution });
    } catch (err) {
        if (session.inTransaction()) await session.abortTransaction();
        console.error("Error saving submission:", err);
        return res.status(500).json({ error: "Failed to save submission data" });
    } finally {
        await session.endSession();
    }
});

submissionRouter.get("/getSolution/:solutionId", requireRole("faculty", "ta"), async (req, res) => {
    try {
        const { solutionId } = req.params;
        if (!solutionId) return res.status(400).json({ error: "Submission ID required!" });

        const submission = await Solution.findById(solutionId)
            .populate("assignment")
            .populate("student", "name email")
            .populate("gradedBy");

        if (!submission) return res.status(404).json({ error: "Submission not found" });

        const courseId = submission.assignment.course;
        let hasAccess = false;
        if (req.userRole === "faculty") {
            const course = await (await import("../models/courses.js")).default.findById(courseId).select("faculty");
            hasAccess = course && idEquals(course.faculty, req.mongoUser._id);
        } else {
            const course = await (await import("../models/courses.js")).default.findById(courseId).select("tas");
            hasAccess = course && includesId(course.tas, req.mongoUser._id);
        }

        if (!hasAccess) return res.status(403).json({ error: "You do not have access to this submission" });
        return res.status(200).json({ submission });
    } catch (err) {
        console.error("Error getting submission:", err);
        return res.status(500).json({ error: "Failed to get submission data" });
    }
});

submissionRouter.put("/gradeSolution/:solutionId", requireRole("faculty", "ta"), async (req, res) => {
    const { solutionId } = req.params;
    const { grade, marks, feedback, graderId, graderRole, taId } = req.body;
    const actualGraderId = graderId || taId;
    const normalizedRole = graderRole === "faculty" || graderRole === "Faculty" ? "Faculty" : "TA";

    if (!solutionId || !actualGraderId) {
        return res.status(400).json({ error: "Solution ID and grader ID are required" });
    }

    if (!idEquals(actualGraderId, req.mongoUser._id)) {
        return res.status(403).json({ error: "You can only grade as the authenticated user" });
    }

    if ((req.userRole === "faculty" && normalizedRole !== "Faculty") || (req.userRole === "ta" && normalizedRole !== "TA")) {
        return res.status(403).json({ error: "Grader role does not match authenticated role" });
    }

    const numericMarks = Number(marks);
    if (!Number.isFinite(numericMarks) || numericMarks < 0) {
        return res.status(400).json({ error: "Marks must be a valid non-negative number" });
    }

    const session = await mongoose.startSession();

    try {
        session.startTransaction();

        const solution = await Solution.findById(solutionId).populate("assignment").session(session);
        if (!solution) {
            await session.abortTransaction();
            return res.status(404).json({ error: "Solution not found" });
        }

        const course = await (await import("../models/courses.js")).default.findById(solution.assignment.course).select("faculty tas").session(session);
        if (!course) {
            await session.abortTransaction();
            return res.status(404).json({ error: "Course not found" });
        }

        const hasAccess = normalizedRole === "Faculty"
            ? idEquals(course.faculty, req.mongoUser._id)
            : includesId(course.tas, req.mongoUser._id);

        if (!hasAccess) {
            await session.abortTransaction();
            return res.status(403).json({ error: "You are not authorized to grade this course" });
        }

        if (numericMarks > solution.assignment.marks) {
            await session.abortTransaction();
            return res.status(400).json({ error: `Marks cannot exceed ${solution.assignment.marks}` });
        }

        const GraderModel = normalizedRole === "Faculty" ? Faculty : TA;
        const grader = await GraderModel.findById(actualGraderId).session(session);
        if (!grader) {
            await session.abortTransaction();
            return res.status(404).json({ error: `${normalizedRole} grader not found` });
        }

        solution.grade = grade || "";
        solution.marks = numericMarks;
        solution.feedback = feedback || "";
        solution.gradedBy = actualGraderId;
        solution.gradedByRole = normalizedRole;
        solution.checkedDate = new Date();
        solution.status = "graded";
        await solution.save({ session });

        if (normalizedRole === "TA") {
            await TA.findByIdAndUpdate(actualGraderId, { $addToSet: { checked: solution._id } }, { session });
        }

        await session.commitTransaction();
        return res.status(200).json({ message: "Solution graded successfully", submission: solution });
    } catch (err) {
        if (session.inTransaction()) await session.abortTransaction();
        console.error("Error grading submission:", err);
        return res.status(500).json({ error: "Failed to grade submission" });
    } finally {
        await session.endSession();
    }
});

export default submissionRouter;

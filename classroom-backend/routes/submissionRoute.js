import { Router } from "express";
import Solution from "../models/solutions.js";
import Student from "../models/student.js";
import Assignment from "../models/assignment.js";
import mongoose from "mongoose";
import TA from "../models/ta.js";
import Faculty from "../models/faculty.js";

const submissionRouter = Router();

submissionRouter.post("/submitSolution", async (req, res) => {
    const { filename, url, publicId, assignmentId, studentId } = req.body;

    if (!url || !assignmentId || !studentId) {
        return res.status(400).json({ error: "Submission URL, assignment ID and student ID are required" });
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

        const enrolled = student.courses.some(id => id.toString() === assignment.course.toString());
        if (!enrolled) {
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

submissionRouter.get("/getSolution/:solutionId", async (req, res) => {
    try {
        const { solutionId } = req.params;
        if (!solutionId) return res.status(400).json({ error: "Submission ID required!" });

        const submission = await Solution.findById(solutionId)
            .populate("assignment")
            .populate("student", "name email")
            .populate("gradedBy");

        if (!submission) return res.status(404).json({ error: "Submission not found" });

        return res.status(200).json({ submission });
    } catch (err) {
        console.error("Error getting submission:", err);
        return res.status(500).json({ error: "Failed to get submission data" });
    }
});

submissionRouter.put("/gradeSolution/:solutionId", async (req, res) => {
    const { solutionId } = req.params;
    const { grade, marks, feedback, graderId, graderRole, taId } = req.body;
    const actualGraderId = graderId || taId;
    const normalizedRole = graderRole === "faculty" || graderRole === "Faculty" ? "Faculty" : "TA";

    if (!solutionId || !actualGraderId) {
        return res.status(400).json({ error: "Solution ID and grader ID are required" });
    }

    const numericMarks = Number(marks);
    if (!Number.isFinite(numericMarks) || numericMarks < 0) {
        return res.status(400).json({ error: "Marks must be a valid non-negative number" });
    }

    const session = await mongoose.startSession();

    try {
        session.startTransaction();

        const solution = await Solution.findById(solutionId)
            .populate("assignment")
            .session(session);

        if (!solution) {
            await session.abortTransaction();
            return res.status(404).json({ error: "Solution not found" });
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
            await TA.findByIdAndUpdate(
                actualGraderId,
                { $addToSet: { checked: solution._id } },
                { session }
            );
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

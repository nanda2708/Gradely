import { Router } from "express";
import Solution from "../models/solutions.js";
import Student from "../models/student.js";
import Assignment from "../models/assignment.js";
import Course from "../models/courses.js";
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
        const course = await Course.findById(assignment.course).select("students").session(session);
        if (!includesId(student.courses, assignment.course) && !includesId(course?.students, student._id)) {
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

        // Student schema stores submitted work under `solutions`.
        student.solutions.addToSet(solution._id);
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

        const course = await Course.findById(submission.assignment.course).select("faculty tas");
        if (!course) return res.status(404).json({ error: "Course not found" });

        const hasAccess = req.userRole === "faculty"
            ? idEquals(course.faculty, req.mongoUser._id)
            : includesId(course.tas, req.mongoUser._id);

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
    const normalizedRole = graderRole === "faculty" || graderRole === "Faculty"
        ? "Faculty"
        : graderRole === "ta" || graderRole === "TA"
            ? "TA"
            : req.userRole === "faculty"
                ? "Faculty"
                : "TA";

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

        const course = await Course.findById(solution.assignment.course).select("faculty tas").session(session);
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
        if (solution.reevalStatus === "pending") {
            solution.reevalStatus = "resolved";
            solution.reevalRequested = false;
        }
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

const MAX_REEVAL_TEXT = 2000;

const loadStaffAccessibleSolution = async (solutionId, req) => {
    const solution = await Solution.findById(solutionId).populate("assignment", "course marks title");
    if (!solution) return { status: 404, error: "Submission not found" };

    const course = await Course.findById(solution.assignment?.course).select("faculty tas");
    if (!course) return { status: 404, error: "Course not found" };

    const hasAccess = req.userRole === "faculty"
        ? idEquals(course.faculty, req.mongoUser._id)
        : includesId(course.tas, req.mongoUser._id);
    if (!hasAccess) return { status: 403, error: "You do not have access to this submission" };

    return { solution };
};

submissionRouter.post("/requestReevaluation/:solutionId", requireRole("student"), async (req, res) => {
    try {
        const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : "";
        if (!reason) return res.status(400).json({ error: "Please explain why you want a re-evaluation" });
        if (reason.length > MAX_REEVAL_TEXT) {
            return res.status(400).json({ error: `Reason must be ${MAX_REEVAL_TEXT} characters or fewer` });
        }

        const solution = await Solution.findById(req.params.solutionId);
        if (!solution) return res.status(404).json({ error: "Submission not found" });
        if (!idEquals(solution.student, req.mongoUser._id)) {
            return res.status(403).json({ error: "You can only request re-evaluation of your own submission" });
        }
        if (solution.status !== "graded") {
            return res.status(400).json({ error: "Only graded submissions can be re-evaluated" });
        }
        if (solution.reevalStatus === "pending") {
            return res.status(409).json({ error: "A re-evaluation request is already pending" });
        }

        solution.reevalRequested = true;
        solution.reevalStatus = "pending";
        solution.reevalReason = reason;
        solution.reevalResponse = "";
        solution.reevalRequestedAt = new Date();
        await solution.save();

        return res.status(200).json({ message: "Re-evaluation requested", submission: solution });
    } catch (err) {
        console.error("Error requesting re-evaluation:", err);
        return res.status(500).json({ error: "Failed to request re-evaluation" });
    }
});

// Staff decline a re-evaluation here. Accepting one is done by re-grading the
// submission, which marks the pending request as resolved.
submissionRouter.put("/rejectReevaluation/:solutionId", requireRole("faculty", "ta"), async (req, res) => {
    try {
        const response = typeof req.body?.response === "string" ? req.body.response.trim() : "";
        if (response.length > MAX_REEVAL_TEXT) {
            return res.status(400).json({ error: `Response must be ${MAX_REEVAL_TEXT} characters or fewer` });
        }

        const { solution, status, error } = await loadStaffAccessibleSolution(req.params.solutionId, req);
        if (error) return res.status(status).json({ error });
        if (solution.reevalStatus !== "pending") {
            return res.status(400).json({ error: "There is no pending re-evaluation for this submission" });
        }

        solution.reevalRequested = false;
        solution.reevalStatus = "rejected";
        solution.reevalResponse = response;
        await solution.save();

        return res.status(200).json({ message: "Re-evaluation request declined", submission: solution });
    } catch (err) {
        console.error("Error rejecting re-evaluation:", err);
        return res.status(500).json({ error: "Failed to update re-evaluation request" });
    }
});

export default submissionRouter;

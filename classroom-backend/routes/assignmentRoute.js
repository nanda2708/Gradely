import { Router } from "express";
import Assignment from "../models/assignment.js";
import Course from "../models/courses.js";
import Faculty from "../models/faculty.js";
import mongoose from "mongoose";
import { requireRole } from "../middleware/roleMiddleware.js";

const assignmentRouter = Router();

assignmentRouter.post("/createAssignment", requireRole("faculty"), async (req, res) => {
    const { assignmentData, courseId, facultyId } = req.body;

    if (!assignmentData || !courseId || !facultyId) {
        return res.status(400).json({ error: "Assignment data, course ID and faculty ID are required" });
    }

    if (facultyId.toString() !== req.mongoUser._id.toString()) {
        return res.status(403).json({ error: "You can only create assignments as yourself" });
    }

    if (!assignmentData.title || !assignmentData.title.trim()) {
        return res.status(400).json({ error: "Assignment title is required" });
    }

    const marks = Number(assignmentData.marks);
    if (!Number.isFinite(marks) || marks <= 0) {
        return res.status(400).json({ error: "Assignment marks must be greater than 0" });
    }

    if (assignmentData.course && assignmentData.course.toString() !== courseId.toString()) {
        return res.status(400).json({ error: "Assignment course does not match course ID" });
    }

    const session = await mongoose.startSession();

    try {
        session.startTransaction();

        const [course, faculty] = await Promise.all([
            Course.findById(courseId).session(session),
            Faculty.findById(facultyId).session(session)
        ]);

        if (!course) {
            await session.abortTransaction();
            return res.status(404).json({ error: "Course not found" });
        }

        if (!faculty) {
            await session.abortTransaction();
            return res.status(404).json({ error: "Faculty not found" });
        }

        if (course.faculty.toString() !== req.mongoUser._id.toString()) {
            await session.abortTransaction();
            return res.status(403).json({ error: "You do not own this course" });
        }

        const assignment = new Assignment({
            ...assignmentData,
            title: assignmentData.title.trim(),
            marks,
            course: courseId
        });

        const savedAssignment = await assignment.save({ session });

        course.assignments.addToSet(savedAssignment._id);
        faculty.assignments.addToSet(savedAssignment._id);

        await course.save({ session });
        await faculty.save({ session });

        await session.commitTransaction();
        return res.status(201).json(savedAssignment);
    } catch (err) {
        if (session.inTransaction()) await session.abortTransaction();
        console.error("Error creating assignment:", err);
        return res.status(500).json({ error: "Failed to save assignment data" });
    } finally {
        await session.endSession();
    }
});

export default assignmentRouter;

import { Router } from "express";
import Course from "../models/courses.js";
import { requireRole } from "../middleware/roleMiddleware.js";

const courseRouter = Router();

const idEquals = (a, b) => a?.toString() === b?.toString();
const arrayIncludesId = (array = [], id) => array.some(item => idEquals(item, id));

courseRouter.post("/createCourse", requireRole("faculty"), async (req, res) => {
    try {
        const { name, faculty } = req.body;
        if (!name?.trim() || !faculty) {
            return res.status(400).json({ error: "Course name and faculty are required!" });
        }
        if (!idEquals(faculty, req.mongoUser._id)) {
            return res.status(403).json({ error: "You can only create courses for yourself" });
        }

        const course = await Course.create({ name: name.trim(), faculty });
        return res.status(201).json(course);
    } catch (err) {
        console.error("Error creating course in DB:", err);
        return res.status(500).json({ error: "Internal Server Error" });
    }
});

courseRouter.get("/getFaculty/:courseId", requireRole("faculty"), async (req, res) => {
    try {
        const course = await Course.findById(req.params.courseId).populate("faculty").populate("tas").populate("students");
        if (!course) return res.status(404).json({ error: "Course not found" });
        if (!idEquals(course.faculty?._id || course.faculty, req.mongoUser._id)) {
            return res.status(403).json({ error: "You do not own this course" });
        }
        return res.status(200).json(course);
    } catch (err) {
        console.error("Error fetching faculty course:", err);
        return res.status(500).json({ error: "Internal Server Error" });
    }
});

courseRouter.get("/getTA/:courseId", requireRole("ta"), async (req, res) => {
    try {
        const course = await Course.findById(req.params.courseId).populate("faculty").populate("tas").populate("students");
        if (!course) return res.status(404).json({ error: "Course not found" });
        if (!arrayIncludesId(course.tas, req.mongoUser._id)) {
            return res.status(403).json({ error: "You are not assigned to this course" });
        }
        return res.status(200).json(course);
    } catch (err) {
        console.error("Error fetching TA course:", err);
        return res.status(500).json({ error: "Internal Server Error" });
    }
});

courseRouter.get("/getStudent/:courseId", requireRole("student"), async (req, res) => {
    try {
        const course = await Course.findById(req.params.courseId).populate("faculty").populate("tas").populate("students");
        if (!course) return res.status(404).json({ error: "Course not found" });
        if (!arrayIncludesId(course.students, req.mongoUser._id)) {
            return res.status(403).json({ error: "You are not enrolled in this course" });
        }
        return res.status(200).json(course);
    } catch (err) {
        console.error("Error fetching student course:", err);
        return res.status(500).json({ error: "Internal Server Error" });
    }
});

courseRouter.post("/addTA", requireRole("faculty"), async (req, res) => {
    const { courseId, taId } = req.body;
    try {
        if (!courseId || !taId) return res.status(400).json({ error: "Course ID and TA ID are required!" });
        const course = await Course.findById(courseId);
        if (!course) return res.status(404).json({ error: "Course not found" });
        if (!idEquals(course.faculty, req.mongoUser._id)) return res.status(403).json({ error: "You do not own this course" });
        if (arrayIncludesId(course.tas, taId)) return res.status(409).json({ error: "This TA has already been assigned!" });

        course.tas.push(taId);
        await course.save();
        return res.status(200).json({ message: "TA added to course successfully!", course });
    } catch (err) {
        console.error("Error adding TA:", err);
        return res.status(500).json({ error: "Internal Server Error" });
    }
});

courseRouter.post("/addStudent", requireRole("faculty"), async (req, res) => {
    const { courseId, studentId } = req.body;
    try {
        if (!courseId || !studentId) return res.status(400).json({ error: "Course ID and Student ID both are required!" });
        const course = await Course.findById(courseId);
        if (!course) return res.status(404).json({ error: "Course not found" });
        if (!idEquals(course.faculty, req.mongoUser._id)) return res.status(403).json({ error: "You do not own this course" });
        if (arrayIncludesId(course.students, studentId)) return res.status(409).json({ error: "This student has already been added!" });

        course.students.push(studentId);
        course.noOfStudents = course.students.length;
        await course.save();
        return res.status(200).json({ message: "Student added to course successfully!", course });
    } catch (err) {
        console.error("Error adding student:", err);
        return res.status(500).json({ error: "Internal Server Error" });
    }
});

courseRouter.post("/addAssignment", requireRole("faculty"), async (req, res) => {
    const { courseId, assignmentId } = req.body;
    try {
        if (!courseId || !assignmentId) return res.status(400).json({ error: "Course ID and Assignment ID both are required!" });
        const course = await Course.findById(courseId);
        if (!course) return res.status(404).json({ error: "Course not found" });
        if (!idEquals(course.faculty, req.mongoUser._id)) return res.status(403).json({ error: "You do not own this course" });
        if (arrayIncludesId(course.assignments, assignmentId)) return res.status(409).json({ error: "Assignment is already linked to this course!" });

        course.assignments.push(assignmentId);
        await course.save();
        return res.status(200).json({ message: "Assignment added to course successfully!", course });
    } catch (err) {
        console.error("Error adding assignment:", err);
        return res.status(500).json({ error: "Internal Server Error" });
    }
});

courseRouter.get("/getAssignments/:courseId", requireRole("faculty", "ta", "student"), async (req, res) => {
    try {
        const course = await Course.findById(req.params.courseId).populate({
            path: "assignments",
            populate: { path: "submissions", populate: [
                { path: "student", select: "name email" },
                { path: "gradedBy", select: "name email" }
            ] }
        });
        if (!course) return res.status(404).json({ error: "Course not found" });

        let hasAccess = false;
        if (req.userRole === "faculty") hasAccess = idEquals(course.faculty, req.mongoUser._id);
        if (req.userRole === "ta") hasAccess = arrayIncludesId(course.tas, req.mongoUser._id);
        if (req.userRole === "student") hasAccess = arrayIncludesId(course.students, req.mongoUser._id);
        if (!hasAccess) return res.status(403).json({ error: "You do not have access to this course" });

        const processedAssignments = course.assignments.map(assignment => {
            if (req.userRole === "student") {
                return {
                    _id: assignment._id,
                    title: assignment.title,
                    description: assignment.description,
                    dueDate: assignment.dueDate,
                    url: assignment.url,
                    publicId: assignment.publicId,
                    marks: assignment.marks,
                    gradedSubmissions: [],
                    ungradedSubmissions: []
                };
            }

            const gradedSubmissions = [];
            const ungradedSubmissions = [];
            assignment.submissions.forEach(submission => {
                if (submission.status === "graded") gradedSubmissions.push(submission);
                else ungradedSubmissions.push(submission);
            });

            return {
                _id: assignment._id,
                title: assignment.title,
                description: assignment.description,
                dueDate: assignment.dueDate,
                url: assignment.url,
                publicId: assignment.publicId,
                marks: assignment.marks,
                gradedSubmissions,
                ungradedSubmissions
            };
        });

        return res.status(200).json({ assignments: processedAssignments });
    } catch (err) {
        console.error("Error fetching assignments:", err);
        return res.status(500).json({ error: "Internal Server Error" });
    }
});

export default courseRouter;

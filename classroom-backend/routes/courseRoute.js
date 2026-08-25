import { Router } from "express";
import Course from "../models/courses.js";

const courseRouter = Router();

courseRouter.post("/createCourse", async (req, res) => {
    try {
        const { name, faculty } = req.body;
        if (!name || !faculty) {
            return res.status(400).json({ error: "Course name and faculty are required!" });
        }

        const course = await Course.create({ name, faculty });
        res.status(201).json(course);
    } catch (err) {
        console.error("Error creating course in DB:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

const getCourse = async (req, res) => {
    try {
        const course = await Course.findById(req.params.courseId)
            .populate("faculty")
            .populate("tas")
            .populate("students");

        if (!course) {
            return res.status(404).json({ error: "Course not found" });
        }

        return res.status(200).json(course);
    } catch (err) {
        console.error("Error fetching course:", err);
        return res.status(500).json({ error: "Internal Server Error" });
    }
};

courseRouter.get("/getFaculty/:courseId", getCourse);
courseRouter.get("/getTA/:courseId", getCourse);
courseRouter.get("/getStudent/:courseId", getCourse);

courseRouter.post("/addTA", async (req, res) => {
    const { courseId, taId } = req.body;
    try {
        if (!courseId || !taId) {
            return res.status(400).json({ error: "Course ID and TA ID are required!" });
        }

        const course = await Course.findById(courseId);
        if (!course) {
            return res.status(404).json({ error: "Course not found" });
        }

        if (course.tas.some(id => id.toString() === taId.toString())) {
            return res.status(409).json({ error: "This TA has already been assigned!" });
        }

        course.tas.push(taId);
        await course.save();
        return res.status(200).json({ message: "TA added to course successfully!", course });
    } catch (err) {
        console.error("Error adding TA:", err);
        return res.status(500).json({ error: "Internal Server Error" });
    }
});

courseRouter.post("/addStudent", async (req, res) => {
    const { courseId, studentId } = req.body;

    try {
        if (!courseId || !studentId) {
            return res.status(400).json({ error: "Course ID and Student ID both are required!" });
        }

        const course = await Course.findById(courseId);
        if (!course) {
            return res.status(404).json({ error: "Course not found" });
        }

        if (course.students.some(id => id.toString() === studentId.toString())) {
            return res.status(409).json({ error: "This student has already been added!" });
        }

        course.students.push(studentId);
        course.noOfStudents = course.students.length;
        await course.save();

        return res.status(200).json({
            message: "Student added to course successfully!",
            course
        });
    } catch (err) {
        console.error("Error adding student:", err);
        return res.status(500).json({ error: "Internal Server Error" });
    }
});

courseRouter.post("/addAssignment", async (req, res) => {
    const { courseId, assignmentId } = req.body;
    try {
        if (!courseId || !assignmentId) {
            return res.status(400).json({ error: "Course ID and Assignment ID both are required!" });
        }

        const course = await Course.findById(courseId);
        if (!course) {
            return res.status(404).json({ error: "Course not found" });
        }

        if (course.assignments.some(id => id.toString() === assignmentId.toString())) {
            return res.status(409).json({ error: "Assignment is already linked to this course!" });
        }

        course.assignments.push(assignmentId);
        await course.save();
        return res.status(200).json({ message: "Assignment added to course successfully!", course });
    } catch (err) {
        console.error("Error adding assignment:", err);
        return res.status(500).json({ error: "Internal Server Error" });
    }
});

courseRouter.get("/getAssignments/:courseId", async (req, res) => {
    try {
        if (!req.params.courseId) {
            return res.status(400).json({ error: "Course ID is required" });
        }

        const course = await Course.findById(req.params.courseId).populate({
            path: "assignments",
            populate: {
                path: "submissions",
                populate: [
                    { path: "student", select: "name email" },
                    { path: "gradedBy", select: "name email" }
                ]
            }
        });

        if (!course) {
            return res.status(404).json({ error: "Course not found" });
        }

        const processedAssignments = course.assignments.map(assignment => {
            const gradedSubmissions = [];
            const ungradedSubmissions = [];

            assignment.submissions.forEach(submission => {
                if (submission.status === "graded") {
                    gradedSubmissions.push(submission);
                } else {
                    ungradedSubmissions.push(submission);
                }
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

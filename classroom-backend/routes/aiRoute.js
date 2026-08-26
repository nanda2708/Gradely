import { Router } from "express";
import Student from "../models/student.js";
import Assignment from "../models/assignment.js";
import Course from "../models/courses.js";
import { requireRole } from "../middleware/roleMiddleware.js";

const aiRouter = Router();
const MAX_MESSAGE_LENGTH = 4000;
const MAX_HISTORY_ITEMS = 12;

aiRouter.post("/helper", requireRole("student"), async (req, res) => {
    try {
        const { assignmentId, message, history = [] } = req.body;
        const cleanMessage = typeof message === "string" ? message.trim() : "";

        if (!cleanMessage) return res.status(400).json({ error: "A question is required" });
        if (cleanMessage.length > MAX_MESSAGE_LENGTH) {
            return res.status(400).json({ error: `Question must be ${MAX_MESSAGE_LENGTH} characters or fewer` });
        }
        const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
        if (!apiKey) {
            return res.status(503).json({ error: "AI helper is not configured on the server" });
        }
        if (!assignmentId) return res.status(400).json({ error: "Assignment ID is required" });

        const student = await Student.findById(req.mongoUser._id).select("courses");
        const assignment = await Assignment.findById(assignmentId).lean();
        if (!student || !assignment) return res.status(404).json({ error: "Assignment not found" });

        const course = await Course.findById(assignment.course).select("name students").lean();
        if (!course) return res.status(404).json({ error: "Course not found" });
        const isEnrolled = student.courses.some(id => id.toString() === assignment.course.toString()) ||
            course.students.some(id => id.toString() === student._id.toString());
        if (!isEnrolled) return res.status(403).json({ error: "You are not enrolled in this assignment's course" });

        const safeHistory = Array.isArray(history)
            ? history.slice(-MAX_HISTORY_ITEMS).filter(item =>
                item && (item.role === "user" || item.role === "model") && typeof item.text === "string"
            )
            : [];

        const contents = safeHistory.map(item => ({
            role: item.role,
            parts: [{ text: item.text.slice(0, MAX_MESSAGE_LENGTH) }]
        }));

        contents.push({
            role: "user",
            parts: [{
                text: cleanMessage
            }]
        });

        const systemPrompt = `You are Gradely AI Helper, an educational assistant for students.\nCourse: ${course.name}\nAssignment: ${assignment.title}\nAssignment description: ${assignment.description || "No description provided."}\nMaximum marks: ${assignment.marks ?? "Not specified"}\n\nHelp the student understand concepts, clarify doubts, explain approaches, and guide them step-by-step. Do not pretend to know information that is not present. If the question is unrelated to the assignment, politely say you are focused on academic help. Do not provide deceptive ways to bypass academic rules or impersonate the student's work. Prefer explanations and hints over ready-to-submit answers.`;

        const requestBody = JSON.stringify({
                systemInstruction: { parts: [{ text: systemPrompt }] },
                contents,
                generationConfig: {
                    temperature: 0.4,
                    maxOutputTokens: 1200
                }
            });
        const requestedModel = process.env.GEMINI_MODEL || "gemini-3.6-flash";
        const candidateModels = [...new Set([requestedModel, "gemini-3.6-flash", "gemini-flash-latest"])];
        let model = candidateModels[0];
        let geminiResponse;
        let data;

        for (const candidate of candidateModels) {
            model = candidate;
            const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(candidate)}:generateContent?key=${encodeURIComponent(apiKey)}`;
            geminiResponse = await fetch(endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: requestBody
            });
            data = await geminiResponse.json().catch(() => ({}));
            if (geminiResponse.ok || geminiResponse.status !== 404) break;
        }

        if (!geminiResponse.ok) {
            console.error("Gemini API error:", data);
            const upstreamMessage = data?.error?.message;
            return res.status(502).json({ error: upstreamMessage || "The AI helper could not answer right now" });
        }

        const answer = data?.candidates?.[0]?.content?.parts?.map(part => part.text || "").join("").trim();
        if (!answer) return res.status(502).json({ error: "The AI returned an empty response" });

        return res.status(200).json({
            answer,
            model,
            assignment: { id: assignment._id, title: assignment.title, course: course.name }
        });
    } catch (err) {
        console.error("AI helper failed:", err);
        return res.status(500).json({ error: "Failed to process AI helper request" });
    }
});

export default aiRouter;

import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";

import { requireAuth } from "./middleware/authMiddleware.js";
import facultyRouter from "./routes/facultyRoute.js";
import studentRouter from "./routes/studentRoute.js";
import taRouter from "./routes/taRoute.js";
import courseRouter from "./routes/courseRoute.js";
import assignmentRouter from "./routes/assignmentRoute.js";
import submissionRouter from "./routes/submissionRoute.js";
import paymentRouter from "./routes/paymentRoute.js";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 5000;
const allowedOrigins = (process.env.FRONTEND_URL || "http://localhost:5173")
    .split(",")
    .map(origin => origin.trim())
    .filter(Boolean);

app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes("*") || allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        return callback(new Error("CORS origin not allowed"));
    },
    credentials: true
}));

app.use(express.json({ limit: "1mb" }));

app.get("/", (req, res) => {
    res.status(200).json({
        name: "Gradely API",
        status: "running",
        health: "/health"
    });
});

app.get("/health", (req, res) => {
    res.set("Cache-Control", "no-store");
    const dbReady = mongoose.connection.readyState === 1;
    return res.status(dbReady ? 200 : 503).json({
        status: dbReady ? "ok" : "degraded",
        database: dbReady ? "connected" : "disconnected"
    });
});

app.use(requireAuth);

app.use("/faculty", facultyRouter);
app.use("/student", studentRouter);
app.use("/ta", taRouter);
app.use("/course", courseRouter);
app.use("/assignment", assignmentRouter);
app.use("/submission", submissionRouter);
app.use("/payment", paymentRouter);

app.use((req, res) => {
    res.status(404).json({ error: "Route not found" });
});

app.use((err, req, res, next) => {
    console.error("Unhandled server error:", err);
    if (res.headersSent) return next(err);
    return res.status(500).json({ error: "Internal Server Error" });
});

const startServer = async () => {
    const dbUri = process.env.CLASSROOM_DB_URI;

    if (!dbUri) {
        console.error("CLASSROOM_DB_URI is not configured");
        process.exit(1);
    }

    try {
        await mongoose.connect(dbUri);
        console.log("MongoDB connected successfully");

        app.listen(PORT, () => {
            console.log(`Gradely API is running on port ${PORT}`);
        });
    } catch (err) {
        console.error("MongoDB connection failed:", err);
        process.exit(1);
    }
};

startServer();

export default app;

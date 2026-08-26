import { Router } from "express";
import crypto from "crypto";
import multer from "multer";
import { requireRole } from "../middleware/roleMiddleware.js";

const uploadRouter = Router();
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 15 * 1024 * 1024
    },
    fileFilter: (req, file, callback) => {
        if (file.mimetype === "application/pdf" || file.mimetype.startsWith("image/")) {
            return callback(null, true);
        }
        return callback(new Error("Only PDF and image files are supported"));
    }
});

const createSignature = (params, apiSecret) => {
    const payload = Object.entries(params)
        .filter(([, value]) => value !== undefined && value !== null && value !== "")
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, value]) => `${key}=${value}`)
        .join("&");

    return crypto
        .createHash("sha1")
        .update(`${payload}${apiSecret}`)
        .digest("hex");
};

uploadRouter.post("/file", requireRole("faculty", "ta", "student"), upload.single("file"), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: "No file was uploaded" });
        }

        const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
        const apiKey = process.env.CLOUDINARY_API_KEY?.trim();
        const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim();

        if (!cloudName || !apiKey || !apiSecret) {
            return res.status(503).json({
                error: "Cloudinary is not configured on the backend. Check CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET."
            });
        }

        const timestamp = Math.floor(Date.now() / 1000);
        const preset = String(req.body?.upload_preset || "");
        const folder = preset === "gradely-submissions"
            ? "gradely/submissions"
            : "gradely/assignments";

        const signature = createSignature({ folder, timestamp }, apiSecret);
        const form = new FormData();
        const fileBlob = new Blob([req.file.buffer], { type: req.file.mimetype });
        // Upload PDFs as "image" so Cloudinary allows inline delivery/viewing.
        // "raw" PDF delivery is blocked (401) unless enabled in Cloudinary security settings.
        const resourceType = "auto";

        form.append("file", fileBlob, req.file.originalname || "upload");
        form.append("api_key", apiKey);
        form.append("timestamp", String(timestamp));
        form.append("folder", folder);
        form.append("resource_type", resourceType);
        form.append("signature", signature);

        const response = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/${resourceType}/upload`, {
            method: "POST",
            body: form
        });

        const rawText = await response.text();
        let result = null;

        try {
            result = rawText ? JSON.parse(rawText) : null;
        } catch (err) {
            console.error("Cloudinary response was not valid JSON:", rawText);
        }

        if (!response.ok) {
            console.error("Cloudinary upload failed:", rawText);
            return res.status(502).json({
                error: result?.error?.message || "Cloudinary rejected the file upload"
            });
        }

        return res.status(201).json({
            secure_url: result.secure_url,
            public_id: result.public_id,
            resource_type: result.resource_type,
            original_filename: result.original_filename
        });
    } catch (err) {
        console.error("Upload route failed:", err);
        if (err instanceof multer.MulterError) {
            if (err.code === "LIMIT_FILE_SIZE") {
                return res.status(413).json({ error: "File is too large. Maximum size is 15 MB." });
            }
            return res.status(400).json({ error: err.message });
        }
        return res.status(500).json({ error: err.message || "File upload failed" });
    }
});

export default uploadRouter;

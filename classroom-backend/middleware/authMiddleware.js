import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const getFirebaseAdminAuth = () => {
    if (getApps().length > 0) {
        return getAuth();
    }

    let serviceAccount = null;
    if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
        try {
            serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
        } catch {
            throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON");
        }
    }

    const projectId = serviceAccount?.project_id || process.env.FIREBASE_PROJECT_ID;
    const clientEmail = serviceAccount?.client_email || process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = (serviceAccount?.private_key || process.env.FIREBASE_PRIVATE_KEY)?.replace(/\\n/g, "\n");

    if (!projectId || !clientEmail || !privateKey) {
        throw new Error("Firebase Admin credentials are not configured");
    }

    initializeApp({
        credential: cert({
            projectId,
            clientEmail,
            privateKey
        })
    });

    return getAuth();
};

export const requireAuth = async (req, res, next) => {
    try {
        const authorization = req.headers.authorization || "";
        const token = authorization.startsWith("Bearer ")
            ? authorization.slice(7)
            : null;

        if (!token) {
            return res.status(401).json({ error: "Authentication token required" });
        }

        const decodedToken = await getFirebaseAdminAuth().verifyIdToken(token);
        req.firebaseUser = decodedToken;

        return next();
    } catch (err) {
        console.error("Authentication failed:", err.message);
        return res.status(401).json({ error: "Invalid or expired authentication token" });
    }
};

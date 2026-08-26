import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import axios from "axios";
import "./index.css";
import App from "./App.jsx";
import { ContextProvider } from "./context/ContextProvider.jsx";
import { auth } from "./firebase/firebaseConfig";

const backendUrl = (import.meta.env.VITE_BACKEND_URL || "http://localhost:5000").replace(/\/$/, "");

axios.interceptors.request.use(async (config) => {
    // Keep legacy development URLs working after deployment.
    if (typeof config.url === "string") {
        const legacyLocalhost = /^https?:\/\/localhost:5000(?=\/|$)/i;
        if (legacyLocalhost.test(config.url)) {
            config.url = config.url.replace(legacyLocalhost, backendUrl);
        }

        // Older Gradely screens upload directly to Cloudinary using an
        // unsigned upload preset. Route those existing FormData requests
        // through the authenticated Gradely backend instead. This keeps the
        // UI unchanged while preventing Cloudinary credentials/presets from
        // being the source of production upload failures.
        if (config.method?.toLowerCase() === "post" && /^https:\/\/api\.cloudinary\.com\/v1_1\/[^/]+\/auto\/upload/i.test(config.url)) {
            config.url = `${backendUrl}/upload/file`;
        }
    }

    const requestUrl = config.url || "";
    const isBackendRequest = backendUrl && (
        requestUrl === backendUrl || requestUrl.startsWith(`${backendUrl}/`)
    );

    if (isBackendRequest && auth.currentUser) {
        try {
            const token = await auth.currentUser.getIdToken();
            config.headers = config.headers || {};
            config.headers.Authorization = `Bearer ${token}`;
        } catch (err) {
            console.error("Unable to obtain Firebase ID token:", err);
        }
    }

    return config;
});

createRoot(document.getElementById("root")).render(
    <StrictMode>
        <ContextProvider>
            <App />
        </ContextProvider>
    </StrictMode>
);

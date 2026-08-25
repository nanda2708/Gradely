import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import axios from "axios";
import "./index.css";
import App from "./App.jsx";
import { ContextProvider } from "./context/ContextProvider.jsx";
import { auth } from "./firebase/firebaseConfig";

const backendUrl = import.meta.env.VITE_BACKEND_URL?.replace(/\/$/, "");

axios.interceptors.request.use(async (config) => {
    // Keep legacy development URLs working after deployment. Some older
    // screens still contain http://localhost:5000; normalize those requests
    // to the configured backend instead of letting production call localhost.
    if (backendUrl && typeof config.url === "string") {
        const legacyLocalhost = /^https?:\/\/localhost:5000(?=\/|$)/i;
        if (legacyLocalhost.test(config.url)) {
            config.url = config.url.replace(legacyLocalhost, backendUrl);
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

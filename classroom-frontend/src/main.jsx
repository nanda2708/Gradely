import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import axios from "axios";
import "./index.css";
import App from "./App.jsx";
import { ContextProvider } from "./context/ContextProvider.jsx";
import { auth } from "./firebase/firebaseConfig";

const backendUrl = import.meta.env.VITE_BACKEND_URL?.replace(/\/$/, "");

axios.interceptors.request.use(async (config) => {
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

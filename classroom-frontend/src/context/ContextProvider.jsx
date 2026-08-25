import { createContext, useState, useEffect, useCallback } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "../firebase/firebaseConfig";

export const UserContext = createContext();

const backendUrl = import.meta.env.VITE_BACKEND_URL?.replace(/\/$/, "");

const getAuthenticatedGradelyUser = async (firebaseUser) => {
    if (!backendUrl) {
        throw new Error("VITE_BACKEND_URL is not configured");
    }

    const idToken = await firebaseUser.getIdToken();
    const response = await fetch(`${backendUrl}/auth/me`, {
        headers: {
            Authorization: `Bearer ${idToken}`,
            "Content-Type": "application/json"
        }
    });

    let data = null;
    try {
        data = await response.json();
    } catch {
        data = null;
    }

    if (!response.ok) {
        const error = new Error(data?.error || `Account lookup failed (${response.status})`);
        error.status = response.status;
        throw error;
    }

    if (!data?.id || !data?.role || !["faculty", "ta", "student"].includes(data.role)) {
        throw new Error("Authenticated Gradely account is incomplete");
    }

    return {
        id: data.id,
        role: data.role,
        name: data.name || firebaseUser.displayName || "User",
        email: data.email || firebaseUser.email,
        emailVerified: Boolean(firebaseUser.emailVerified),
        phoneVerified: Boolean(data.phoneVerified)
    };
};

export const ContextProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let active = true;

        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            if (!firebaseUser) {
                if (!active) return;
                setUser(null);
                localStorage.removeItem("user");
                setLoading(false);
                return;
            }

            setLoading(true);

            try {
                await firebaseUser.reload();

                if (!firebaseUser.emailVerified) {
                    if (!active) return;
                    // Keep Firebase auth alive during the signup verification
                    // screen. SignUp.jsx needs auth.currentUser to finish the
                    // account after the email is verified.
                    setUser(null);
                    localStorage.removeItem("user");
                    setLoading(false);
                    return;
                }

                const gradelyUser = await getAuthenticatedGradelyUser(firebaseUser);

                if (!active) return;
                setUser(gradelyUser);
                localStorage.setItem("user", JSON.stringify(gradelyUser));
            } catch (err) {
                console.error("Failed to restore Gradely session:", err);

                if (!active) return;
                setUser(null);
                localStorage.removeItem("user");

                // An authenticated Firebase user may legitimately exist for a
                // short time before the MongoDB Gradely account is created
                // (the email/phone verification signup flow). Therefore a 404
                // must NOT sign the Firebase user out. Only invalidate the
                // Firebase session for actual authentication failures.
                if (err.status === 401 || err.status === 403) {
                    await signOut(auth).catch(() => {});
                }
            } finally {
                if (active) setLoading(false);
            }
        });

        return () => {
            active = false;
            unsubscribe();
        };
    }, []);

    const login = useCallback((userData) => {
        setUser(userData);
        localStorage.setItem("user", JSON.stringify(userData));
    }, []);

    const logout = useCallback(async () => {
        setUser(null);
        localStorage.removeItem("user");
        try {
            await signOut(auth);
        } catch (err) {
            console.error("Firebase sign out failed:", err);
        }
    }, []);

    return (
        <UserContext.Provider value={{ user, login, logout, loading }}>
            {children}
        </UserContext.Provider>
    );
};

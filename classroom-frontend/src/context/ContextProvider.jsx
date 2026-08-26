import { createContext, useState, useEffect, useCallback } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "../firebase/firebaseConfig";

// eslint-disable-next-line react-refresh/only-export-components
export const UserContext = createContext();

const backendUrl = import.meta.env.VITE_BACKEND_URL?.replace(/\/$/, "");

const getAuthenticatedGradelyUser = async (firebaseUser) => {
    if (!backendUrl) throw new Error("VITE_BACKEND_URL is not configured");

    const idToken = await firebaseUser.getIdToken(true);
    const config = { headers: { Authorization: `Bearer ${idToken}` } };

    try {
        const response = await fetch(`${backendUrl}/auth/me`, config);
        const data = await response.json().catch(() => null);

        if (response.ok) return normalizeGradelyUser(data, firebaseUser);

        if (response.status === 404) {
            const provisionResponse = await fetch(`${backendUrl}/auth/provision`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${idToken}`,
                    "Content-Type": "application/json"
                }
            });
            const provisioned = await provisionResponse.json().catch(() => null);
            if (!provisionResponse.ok) {
                const error = new Error(provisioned?.error || `Account provisioning failed (${provisionResponse.status})`);
                error.status = provisionResponse.status;
                throw error;
            }
            return normalizeGradelyUser(provisioned, firebaseUser);
        }

        const error = new Error(data?.error || `Account lookup failed (${response.status})`);
        error.status = response.status;
        throw error;
    } catch (err) {
        if (err.status) throw err;
        throw new Error(err.message || "Unable to restore Gradely account");
    }
};

const normalizeGradelyUser = (data, firebaseUser) => {
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

                // Do not sign out an otherwise valid Firebase user merely because
                // an old Gradely/Mongo record needs provisioning. Only true auth
                // failures invalidate the Firebase session.
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

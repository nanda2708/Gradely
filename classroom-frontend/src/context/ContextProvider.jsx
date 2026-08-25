import { createContext, useState, useEffect, useCallback } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "../firebase/firebaseConfig";

export const UserContext = createContext();

export const ContextProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            const storedUser = localStorage.getItem("user");

            if (!firebaseUser) {
                setUser(null);
                localStorage.removeItem("user");
                setLoading(false);
                return;
            }

            await firebaseUser.reload().catch(() => {});

            if (!firebaseUser.emailVerified) {
                setUser(null);
                localStorage.removeItem("user");
                setLoading(false);
                return;
            }

            if (storedUser) {
                try {
                    const parsedUser = JSON.parse(storedUser);
                    if (parsedUser?.email?.toLowerCase() === firebaseUser.email?.toLowerCase()) {
                        setUser({ ...parsedUser, emailVerified: true });
                    } else {
                        localStorage.removeItem("user");
                        setUser(null);
                    }
                } catch {
                    localStorage.removeItem("user");
                    setUser(null);
                }
            }

            setLoading(false);
        });

        return unsubscribe;
    }, []);

    useEffect(() => {
        if (user) localStorage.setItem("user", JSON.stringify(user));
        else localStorage.removeItem("user");
    }, [user]);

    const login = useCallback((userData) => {
        setUser(userData);
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

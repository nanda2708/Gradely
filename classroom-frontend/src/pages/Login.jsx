import { useState, useContext } from "react";
import { UserContext } from "../context/ContextProvider";
import { signInWithEmailAndPassword, signInWithPopup, signOut, sendEmailVerification } from "firebase/auth";
import { auth, provider, db } from "../firebase/firebaseConfig";
import { Link, useNavigate } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { Mail, Lock, ArrowRight } from "lucide-react";
import toast from "react-hot-toast";
import axios from "axios";
import AuthLayout, { Divider, GoogleButton } from "../components/AuthLayout";
import { Button, Field, inputClass } from "../components/ui";
import { API as backendUrl, dashboardPath } from "../lib/api";

const getMongoUser = async (firebaseUser) => {
    if (!backendUrl) throw new Error("VITE_BACKEND_URL is not configured");

    const idToken = await firebaseUser.getIdToken(true);
    const config = { headers: { Authorization: `Bearer ${idToken}` } };

    try {
        const response = await axios.get(`${backendUrl}/auth/me`, config);
        return response.data;
    } catch (err) {
        if (err.response?.status !== 404) throw err;
        const provisioned = await axios.post(`${backendUrl}/auth/provision`, {}, config);
        return provisioned.data;
    }
};

const navigateByRole = (navigate, role) => navigate(dashboardPath(role), { replace: true });

export default function Login() {
    const { login } = useContext(UserContext);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [isGoogleLoading, setIsGoogleLoading] = useState(false);
    const navigate = useNavigate();

    const finishLogin = async (firebaseUser, userData = {}) => {
        await firebaseUser.reload();
        const freshUser = auth.currentUser;
        if (!freshUser) throw new Error("Firebase session ended unexpectedly");

        const isGoogleAccount = firebaseUser.providerData?.some(
            providerInfo => providerInfo.providerId === "google.com"
        );

        if (!freshUser.emailVerified && !isGoogleAccount) {
            await sendEmailVerification(freshUser).catch(() => {});
            throw new Error("Please verify your email address before logging in. A new verification email has been sent.");
        }

        const mongoUser = await getMongoUser(freshUser);
        const role = mongoUser.role || userData.role;
        if (!role || !["faculty", "ta", "student"].includes(role)) {
            throw new Error("Your Gradely account does not have a valid role");
        }

        login({
            name: mongoUser.name || userData.name || freshUser.displayName || "User",
            email: mongoUser.email || freshUser.email,
            role,
            id: mongoUser.id,
            emailVerified: Boolean(freshUser.emailVerified || isGoogleAccount),
            phoneVerified: Boolean(mongoUser.phoneVerified ?? userData.phoneVerified)
        });

        toast.success("Logged in successfully!");
        navigateByRole(navigate, role);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            const normalizedEmail = email.toLowerCase().trim();
            const userDoc = await getDoc(doc(db, "users", normalizedEmail));
            if (!userDoc.exists()) {
                toast.error("You are not registered. Please sign up first.");
                navigate("/signup");
                return;
            }

            const credential = await signInWithEmailAndPassword(auth, normalizedEmail, password);
            await finishLogin(credential.user, userDoc.data());
        } catch (err) {
            console.error("Login failed:", err);
            await signOut(auth).catch(() => {});
            if (err.code === "auth/invalid-credential") toast.error("Invalid email or password. Please try again.");
            else if (err.code === "auth/too-many-requests") toast.error("Too many attempts. Please wait and try again.");
            else toast.error(err.response?.data?.error || err.message || "Something went wrong while logging in.");
        } finally {
            setIsLoading(false);
        }
    };

    const logInWithGoogle = async () => {
        setIsGoogleLoading(true);
        try {
            const result = await signInWithPopup(auth, provider);
            const firebaseUser = result.user;
            const normalizedEmail = firebaseUser.email?.toLowerCase().trim();

            if (!normalizedEmail) throw new Error("Google did not provide an email address");

            const userDoc = await getDoc(doc(db, "users", normalizedEmail));
            if (!userDoc.exists()) {
                await signOut(auth);
                toast.error("This Google account is not registered in Gradely. Please sign up first.");
                navigate("/signup");
                return;
            }

            await finishLogin(firebaseUser, { ...userDoc.data(), provider: "google.com" });
        } catch (err) {
            console.error("Google login failed:", err);
            await signOut(auth).catch(() => {});
            toast.error(err.response?.data?.error || err.message || "Unable to sign in with Google.");
        } finally {
            setIsGoogleLoading(false);
        }
    };

    const busy = isLoading || isGoogleLoading;

    return (
        <AuthLayout
            title="Welcome back"
            subtitle="Sign in to continue to your Gradely dashboard."
            footer={<>Don’t have an account? <Link to="/signup" className="font-medium text-indigo-600 hover:text-indigo-700">Create one</Link></>}
        >
            <GoogleButton onClick={logInWithGoogle} loading={isGoogleLoading} disabled={busy}>Continue with Google</GoogleButton>
            <Divider label="or sign in with email" />
            <form onSubmit={handleSubmit} className="space-y-4">
                <Field label="Email" htmlFor="email">
                    <div className="relative">
                        <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input id="email" type="email" autoComplete="email" placeholder="you@university.edu" value={email} onChange={(e) => setEmail(e.target.value)} className={`${inputClass} h-11 pl-10`} required />
                    </div>
                </Field>
                <Field label="Password" htmlFor="password">
                    <div className="relative">
                        <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input id="password" type="password" autoComplete="current-password" placeholder="Your password" value={password} onChange={(e) => setPassword(e.target.value)} className={`${inputClass} h-11 pl-10`} required />
                    </div>
                </Field>
                <Button type="submit" size="lg" className="w-full" loading={isLoading} disabled={busy}>
                    {isLoading ? "Signing in..." : <>Sign in <ArrowRight className="h-4 w-4" /></>}
                </Button>
            </form>
        </AuthLayout>
    );
}

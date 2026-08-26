import { useState, useContext } from "react";
import { UserContext } from "../context/ContextProvider";
import { signInWithEmailAndPassword, signInWithPopup, signOut, sendEmailVerification } from "firebase/auth";
import { auth, provider, db } from "../firebase/firebaseConfig";
import { useNavigate } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { Mail, Lock, ArrowRight, Loader2 } from "lucide-react";
import toast, { Toaster } from "react-hot-toast";
import axios from "axios";
import { UserContext } from "../context/ContextProvider";

const backendUrl = import.meta.env.VITE_BACKEND_URL?.replace(/\/$/, "");

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

const navigateByRole = (navigate, role) => {
    const paths = { faculty: "/faculty", ta: "/ta", student: "/student" };
    navigate(paths[role] || "/unauthorized", { replace: true });
};

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

    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-blue-50 to-indigo-50">
            <Toaster />
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome Back</h1>
                    <p className="text-gray-600">Sign in to your account</p>
                </div>
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                            <div className="relative"><Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5" /><input type="email" placeholder="Enter your email" value={email} onChange={(e) => setEmail(e.target.value)} className="pl-10 w-full py-2 border border-gray-300 rounded-lg" required /></div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                            <div className="relative"><Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5" /><input type="password" placeholder="Enter your password" value={password} onChange={(e) => setPassword(e.target.value)} className="pl-10 w-full py-2 border border-gray-300 rounded-lg" required /></div>
                        </div>
                    </div>
                    <button type="submit" disabled={isLoading || isGoogleLoading} className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2">
                        {isLoading ? <><Loader2 className="h-5 w-5 animate-spin" />Signing In...</> : <>Sign In <ArrowRight className="h-5 w-5" /></>}
                    </button>
                </form>
                <div className="mt-6">
                    <div className="relative"><div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-300" /></div><div className="relative flex justify-center text-sm"><span className="px-2 bg-white text-gray-500">Or continue with</span></div></div>
                    <button onClick={logInWithGoogle} disabled={isLoading || isGoogleLoading} className="mt-4 w-full flex items-center justify-center gap-3 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
                        {isGoogleLoading ? <><Loader2 className="h-5 w-5 animate-spin" />Signing in...</> : <><img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />Sign in with Google</>}
                    </button>
                </div>
                <p className="mt-6 text-center text-sm text-gray-600">Don't have an account? <a href="/signup" className="font-medium text-blue-600 hover:text-blue-500">Sign up</a></p>
            </div>
        </div>
    );
}

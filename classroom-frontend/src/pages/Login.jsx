import { useState, useContext } from "react";
import { UserContext } from "../context/ContextProvider";
import { signInWithEmailAndPassword, signInWithPopup, signOut, sendEmailVerification } from "firebase/auth";
import { auth, provider, db } from "../firebase/firebaseConfig";
import { useNavigate } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { Mail, Lock, ArrowRight, Loader2 } from "lucide-react";
import toast, { Toaster } from "react-hot-toast";
import axios from "axios";

const getMongoUserId = async (firebaseUser, role, email) => {
    const normalizedEmail = email.toLowerCase().trim();
    const endpoint = { faculty: "/faculty/getFacultyID", ta: "/ta/getTAID", student: "/student/getStudentID" }[role];
    if (!endpoint) throw new Error("Invalid user role");

    // The lookup endpoints are protected by role-based backend authorization.
    // Firebase authentication has already completed at this point, so attach
    // the current ID token rather than making an unauthenticated request.
    const idToken = await firebaseUser.getIdToken();
    const response = await axios.get(`${import.meta.env.VITE_BACKEND_URL}${endpoint}`, {
        params: { email: normalizedEmail },
        headers: { Authorization: `Bearer ${idToken}` }
    });

    if (!response.data) throw new Error("Gradely account ID was not returned");
    return response.data;
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

    const finishLogin = async (firebaseUser, userData) => {
        await firebaseUser.reload();
        const freshUser = auth.currentUser;

        if (!freshUser) throw new Error("Firebase session ended unexpectedly");
        if (!freshUser.emailVerified) {
            await sendEmailVerification(freshUser).catch(() => {});
            throw new Error("Please verify your email address before logging in. A new verification email has been sent.");
        }

        const role = userData.role;
        const mongoId = await getMongoUserId(freshUser, role, freshUser.email);

        login({
            name: userData.name,
            email: userData.email,
            role,
            id: mongoId,
            emailVerified: true,
            phoneVerified: Boolean(userData.phoneVerified)
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

            if (err.code === "auth/invalid-credential") {
                toast.error("Invalid email or password. Please try again.");
            } else if (err.code === "auth/too-many-requests") {
                toast.error("Too many attempts. Please wait and try again.");
            } else if (err.response?.status === 404) {
                toast.error("Your Firebase account exists but the Gradely account is missing.");
            } else {
                toast.error(err.response?.data?.error || err.message || "Something went wrong while logging in.");
            }
        } finally {
            setIsLoading(false);
        }
    };

    const logInWithGoogle = async () => {
        setIsGoogleLoading(true);
        try {
            const result = await signInWithPopup(auth, provider);
            const firebaseUser = result.user;
            const normalizedEmail = firebaseUser.email.toLowerCase().trim();
            const userDoc = await getDoc(doc(db, "users", normalizedEmail));

            if (!userDoc.exists()) {
                await signOut(auth);
                toast.error("You are not registered. Please sign up first.");
                navigate("/signup");
                return;
            }

            await finishLogin(firebaseUser, userDoc.data());
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
                            <div className="relative"><Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5" /><input type="email" placeholder="Enter your email" value={email} onChange={(e) => setEmail(e.target.value)} className="pl-10 w-full py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" required /></div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                            <div className="relative"><Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5" /><input type="password" placeholder="Enter your password" value={password} onChange={(e) => setPassword(e.target.value)} className="pl-10 w-full py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" required /></div>
                        </div>
                    </div>

                    <button type="submit" disabled={isLoading || isGoogleLoading} className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 focus:ring-4 focus:ring-blue-300 flex items-center justify-center gap-2 transition-colors">
                        {isLoading ? <><Loader2 className="h-5 w-5 animate-spin" />Signing In...</> : <>Sign In <ArrowRight className="h-5 w-5" /></>}
                    </button>
                </form>

                <div className="mt-6">
                    <div className="relative"><div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-300" /></div><div className="relative flex justify-center text-sm"><span className="px-2 bg-white text-gray-500">Or continue with</span></div></div>
                    <button onClick={logInWithGoogle} disabled={isLoading || isGoogleLoading} className="mt-4 w-full flex items-center justify-center gap-3 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 focus:ring-4 focus:ring-gray-100">
                        {isGoogleLoading ? <><Loader2 className="h-5 w-5 animate-spin" />Signing in...</> : <><img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />Sign in with Google</>}
                    </button>
                </div>

                <p className="mt-6 text-center text-sm text-gray-600">Don't have an account? <a href="/signup" className="font-medium text-blue-600 hover:text-blue-500">Sign up</a></p>
            </div>
        </div>
    );
}

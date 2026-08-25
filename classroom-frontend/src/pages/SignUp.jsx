import { useState } from "react";
import { createUserWithEmailAndPassword, signInWithPopup, deleteUser, signOut } from "firebase/auth";
import { auth, db, provider } from "../firebase/firebaseConfig";
import { setDoc, doc, getDoc, deleteDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { GraduationCap, School, Users, Mail, Lock, User, ArrowRight, Loader2 } from "lucide-react";
import toast, { Toaster } from "react-hot-toast";
import axios from "axios";

const createMongoUser = async (role, email, name) => {
    const endpoint = {
        faculty: "/faculty/createFaculty",
        ta: "/ta/createTA",
        student: "/student/createStudent"
    }[role];

    if (!endpoint) throw new Error("Please select a valid role");

    const response = await axios.post(`${import.meta.env.VITE_BACKEND_URL}${endpoint}`, {
        email: email.toLowerCase().trim(),
        name: name.trim()
    });

    if (response.status < 200 || response.status >= 300 || response.data?.error) {
        throw new Error(response.data?.error || "Unable to create the Gradely account");
    }

    return response.data;
};

export default function SignUp() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [role, setRole] = useState("");
    const [name, setName] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [isGoogleLoading, setIsGoogleLoading] = useState(false);
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);

        const normalizedEmail = email.toLowerCase().trim();
        let firebaseUser = null;
        let firestoreCreated = false;

        try {
            if (!role) throw new Error("Please select a role");

            const credential = await createUserWithEmailAndPassword(auth, normalizedEmail, password);
            firebaseUser = credential.user;

            await setDoc(doc(db, "users", normalizedEmail), {
                email: normalizedEmail,
                name: name.trim(),
                role
            });
            firestoreCreated = true;

            await createMongoUser(role, normalizedEmail, name);

            await signOut(auth);
            toast.success("Successfully signed up! Please log in.");
            navigate("/login", { replace: true });
        } catch (err) {
            console.error("Email signup failed:", err);

            if (firestoreCreated) {
                await deleteDoc(doc(db, "users", normalizedEmail)).catch(() => {});
            }
            if (firebaseUser) {
                await deleteUser(firebaseUser).catch(() => signOut(auth));
            }

            if (err.code === "auth/email-already-in-use") {
                toast.error("An account with this email already exists. Try logging in!");
                navigate("/login");
            } else {
                toast.error(err.response?.data?.error || err.message || "Unable to create your account.");
            }
        } finally {
            setIsLoading(false);
        }
    };

    const signUpWithGoogle = async () => {
        setIsGoogleLoading(true);
        let firebaseUser = null;
        let firestoreCreated = false;

        try {
            if (!role) {
                toast("Please select a role!", { icon: "⚠️" });
                return;
            }

            const result = await signInWithPopup(auth, provider);
            firebaseUser = result.user;
            const normalizedEmail = firebaseUser.email.toLowerCase().trim();
            const userRef = doc(db, "users", normalizedEmail);
            const existingUser = await getDoc(userRef);

            if (existingUser.exists()) {
                await signOut(auth);
                toast.error("An account with this email already exists. Try logging in!");
                navigate("/login");
                return;
            }

            const displayName = firebaseUser.displayName?.trim() || "Gradely User";
            await setDoc(userRef, {
                email: normalizedEmail,
                name: displayName,
                role
            });
            firestoreCreated = true;

            await createMongoUser(role, normalizedEmail, displayName);

            await signOut(auth);
            toast.success("Successfully signed up with Google! Please log in.");
            navigate("/login", { replace: true });
        } catch (err) {
            console.error("Google signup failed:", err);
            if (firebaseUser) {
                const emailToDelete = firebaseUser.email?.toLowerCase().trim();
                if (firestoreCreated && emailToDelete) {
                    await deleteDoc(doc(db, "users", emailToDelete)).catch(() => {});
                }
                await deleteUser(firebaseUser).catch(() => signOut(auth));
            }
            toast.error(err.response?.data?.error || err.message || "Unable to sign up with Google.");
        } finally {
            setIsGoogleLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-blue-50 to-indigo-50">
            <Toaster />
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">Create Account</h1>
                    <p className="text-gray-600">Join our grading platform today</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                            <div className="relative"><User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5" /><input type="text" placeholder="Enter your name" value={name} onChange={(e) => setName(e.target.value)} className="pl-10 w-full py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" required /></div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                            <div className="relative"><Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5" /><input type="email" placeholder="Enter your email" value={email} onChange={(e) => setEmail(e.target.value)} className="pl-10 w-full py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" required /></div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                            <div className="relative"><Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5" /><input type="password" placeholder="Create a password" value={password} onChange={(e) => setPassword(e.target.value)} className="pl-10 w-full py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" minLength={6} required /></div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Register as</label>
                            <div className="relative">
                                <select value={role} onChange={(e) => setRole(e.target.value)} className="w-full py-2 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" required>
                                    <option value="">Select your role</option><option value="student">Student</option><option value="faculty">Faculty</option><option value="ta">Teaching Assistant</option>
                                </select>
                                {role === "student" && <GraduationCap className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5" />}
                                {role === "faculty" && <School className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5" />}
                                {role === "ta" && <Users className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5" />}
                                {!role && <Users className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5" />}
                            </div>
                        </div>
                    </div>
                    <button type="submit" disabled={isLoading || isGoogleLoading} className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 focus:ring-4 focus:ring-blue-300 flex items-center justify-center gap-2 transition-colors">
                        {isLoading ? <><Loader2 className="h-5 w-5 animate-spin" />Signing Up...</> : <>Sign Up <ArrowRight className="h-5 w-5" /></>}
                    </button>
                </form>

                <div className="mt-6">
                    <div className="relative"><div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-300" /></div><div className="relative flex justify-center text-sm"><span className="px-2 bg-white text-gray-500">OR</span></div></div>
                    <button onClick={signUpWithGoogle} disabled={isLoading || isGoogleLoading} className="mt-4 w-full flex items-center justify-center gap-3 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 focus:ring-4 focus:ring-gray-100">
                        {isGoogleLoading ? <><Loader2 className="h-5 w-5 animate-spin" />Signing up...</> : <><img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />Sign up with Google</>}
                    </button>
                </div>

                <p className="mt-6 text-center text-sm text-gray-600">Already have an account? <a href="/login" className="font-medium text-blue-600 hover:text-blue-500">Sign in</a></p>
            </div>
        </div>
    );
}

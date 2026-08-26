import { useRef, useState } from "react";
import {
    createUserWithEmailAndPassword,
    deleteUser,
    RecaptchaVerifier,
    PhoneAuthProvider,
    PhoneAuthCredential,
    sendEmailVerification,
    signInWithPopup,
    signOut
} from "firebase/auth";
import { auth, db, provider } from "../firebase/firebaseConfig";
import { setDoc, doc, getDoc, deleteDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { GraduationCap, School, Users, Mail, Lock, User, Phone, ArrowRight, Loader2 } from "lucide-react";
import toast, { Toaster } from "react-hot-toast";
import axios from "axios";

const createMongoUser = async (role, email, name, phoneNumber = "", emailVerified = true, phoneVerified = false) => {
    const endpoint = { faculty: "/faculty/createFaculty", ta: "/ta/createTA", student: "/student/createStudent" }[role];
    if (!endpoint) throw new Error("Please select a valid role");

    const currentUser = auth.currentUser;
    if (!currentUser) {
        throw new Error("Your Firebase session expired. Please start signup again.");
    }

    const token = await currentUser.getIdToken();
    const response = await axios.post(`${import.meta.env.VITE_BACKEND_URL}${endpoint}`, {
        email: email.toLowerCase().trim(),
        name: name.trim(),
        phoneNumber: phoneNumber.trim() || undefined,
        emailVerified,
        phoneVerified
    }, {
        headers: {
            Authorization: `Bearer ${token}`
        }
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
    const [phoneNumber, setPhoneNumber] = useState("");
    const [verificationCode, setVerificationCode] = useState("");
    const [verificationId, setVerificationId] = useState(null);
    const [verificationStage, setVerificationStage] = useState("form");
    const [isLoading, setIsLoading] = useState(false);
    const [isGoogleLoading, setIsGoogleLoading] = useState(false);
    const [isPhoneLoading, setIsPhoneLoading] = useState(false);
    const recaptchaRef = useRef(null);
    const navigate = useNavigate();

    const cleanupFailedSignup = async (normalizedEmail) => {
        await deleteDoc(doc(db, "users", normalizedEmail)).catch(() => {});
        if (auth.currentUser) await deleteUser(auth.currentUser).catch(() => signOut(auth));
    };

    const createVerifiedAccount = async (phoneVerified = false) => {
        const firebaseUser = auth.currentUser;
        if (!firebaseUser) throw new Error("Your Firebase session expired. Please start signup again.");

        await firebaseUser.reload();
        if (!firebaseUser.emailVerified) {
            throw new Error("Please open the verification email and verify your email first.");
        }

        const normalizedEmail = firebaseUser.email.toLowerCase().trim();
        try {
            await createMongoUser(role, normalizedEmail, name, phoneNumber, true, phoneVerified);
            await setDoc(doc(db, "users", normalizedEmail), {
                email: normalizedEmail,
                name: name.trim(),
                role,
                phoneNumber: phoneNumber.trim() || null,
                emailVerified: true,
                phoneVerified
            }, { merge: true });

            await signOut(auth);
            toast.success("Account verified and created successfully! Please log in.");
            navigate("/login", { replace: true });
        } catch (err) {
            await cleanupFailedSignup(normalizedEmail);
            throw err;
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            if (!role) throw new Error("Please select a role");
            const normalizedEmail = email.toLowerCase().trim();
            const credential = await createUserWithEmailAndPassword(auth, normalizedEmail, password);

            await setDoc(doc(db, "users", normalizedEmail), {
                email: normalizedEmail,
                name: name.trim(),
                role,
                phoneNumber: phoneNumber.trim() || null,
                emailVerified: false,
                phoneVerified: false
            });

            await sendEmailVerification(credential.user);
            setVerificationStage("verify");
            toast.success("Verification email sent. Verify your email, then continue here.");
        } catch (err) {
            console.error("Email signup failed:", err);
            if (auth.currentUser && !auth.currentUser.emailVerified) {
                await signOut(auth).catch(() => {});
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

    const resendEmail = async () => {
        try {
            if (!auth.currentUser) throw new Error("Signup session expired. Please start again.");
            await sendEmailVerification(auth.currentUser);
            toast.success("Verification email sent again.");
        } catch (err) {
            toast.error(err.message || "Unable to resend verification email.");
        }
    };

    const startPhoneVerification = async () => {
        setIsPhoneLoading(true);
        try {
            const currentUser = auth.currentUser;
            if (!currentUser) throw new Error("Signup session expired. Please start again.");
            if (!phoneNumber.trim().startsWith("+")) throw new Error("Enter the phone number with country code, e.g. +91...");

            if (!recaptchaRef.current) {
                recaptchaRef.current = new RecaptchaVerifier(auth, "phone-recaptcha", {
                    size: "normal",
                    "expired-callback": () => {
                        recaptchaRef.current = null;
                    }
                });
            }

            const provider = new PhoneAuthProvider(auth);
            const id = await provider.verifyPhoneNumber({ phoneNumber: phoneNumber.trim() }, recaptchaRef.current);
            setVerificationId(id);
            toast.success("Phone verification code sent.");
        } catch (err) {
            console.error("Phone verification start failed:", err);
            toast.error(err.message || "Unable to send phone verification code.");
            recaptchaRef.current = null;
        } finally {
            setIsPhoneLoading(false);
        }
    };

    const verifyPhone = async () => {
        if (!verificationId || !verificationCode.trim()) {
            toast.error("Enter the verification code first.");
            return;
        }

        setIsPhoneLoading(true);
        try {
            const credential = PhoneAuthCredential.fromVerificationId(verificationId, verificationCode.trim());
            await auth.currentUser.updatePhoneNumber(credential);
            await createVerifiedAccount(true);
        } catch (err) {
            console.error("Phone verification failed:", err);
            toast.error(err.message || "Invalid phone verification code.");
        } finally {
            setIsPhoneLoading(false);
        }
    };

    const continueWithoutPhone = async () => {
        setIsLoading(true);
        try {
            await createVerifiedAccount(false);
        } catch (err) {
            toast.error(err.response?.data?.error || err.message || "Unable to finish signup.");
        } finally {
            setIsLoading(false);
        }
    };

    const signUpWithGoogle = async () => {
        setIsGoogleLoading(true);
        let firebaseUser = null;
        try {
            if (!role) throw new Error("Please select a role");
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
                role,
                emailVerified: firebaseUser.emailVerified,
                phoneVerified: false
            });

            try {
                await createMongoUser(role, normalizedEmail, displayName, "", firebaseUser.emailVerified, false);
            } catch (err) {
                await deleteDoc(userRef).catch(() => {});
                await deleteUser(firebaseUser).catch(() => signOut(auth));
                throw err;
            }

            await signOut(auth);
            toast.success("Successfully signed up with Google! Please log in.");
            navigate("/login", { replace: true });
        } catch (err) {
            console.error("Google signup failed:", err);
            if (firebaseUser && auth.currentUser) await signOut(auth).catch(() => {});
            toast.error(err.response?.data?.error || err.message || "Unable to sign up with Google.");
        } finally {
            setIsGoogleLoading(false);
        }
    };

    if (verificationStage === "verify") {
        return (
            <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-blue-50 to-indigo-50">
                <Toaster />
                <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">Verify your account</h1>
                    <p className="text-gray-600 mb-6">We sent a verification email to <b>{email}</b>. Verify it, then optionally verify your phone.</p>

                    <div className="space-y-4">
                        <button onClick={async () => {
                            try {
                                await auth.currentUser?.reload();
                                if (!auth.currentUser?.emailVerified) {
                                    toast.error("Email is not verified yet. Open the email link first.");
                                    return;
                                }
                                toast.success("Email verified. You can finish signup now.");
                            } catch (err) {
                                toast.error(err.message || "Unable to check verification status.");
                            }
                        }} className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700">
                            Check Email Verification
                        </button>

                        <button onClick={resendEmail} className="w-full border border-gray-300 py-2 rounded-lg hover:bg-gray-50">Resend Verification Email</button>

                        <div className="border-t pt-5">
                            <label className="block text-sm font-medium text-gray-700 mb-2">Phone number (optional)</label>
                            <div className="relative"><Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5" /><input value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} placeholder="+91..." className="pl-10 w-full py-2 border border-gray-300 rounded-lg" /></div>
                            <div id="phone-recaptcha" className="mt-3" />

                            {!verificationId ? (
                                <button onClick={startPhoneVerification} disabled={isPhoneLoading || !phoneNumber.trim()} className="mt-3 w-full border border-blue-300 text-blue-700 py-2 rounded-lg disabled:opacity-50">
                                    {isPhoneLoading ? "Sending code..." : "Send Phone Code"}
                                </button>
                            ) : (
                                <div className="mt-3 space-y-3">
                                    <input value={verificationCode} onChange={(e) => setVerificationCode(e.target.value)} placeholder="Verification code" inputMode="numeric" className="w-full py-2 border border-gray-300 rounded-lg" />
                                    <button onClick={verifyPhone} disabled={isPhoneLoading} className="w-full bg-green-600 text-white py-2 rounded-lg disabled:opacity-50">{isPhoneLoading ? "Verifying..." : "Verify Phone & Finish"}</button>
                                </div>
                            )}
                        </div>

                        <button onClick={continueWithoutPhone} disabled={isLoading} className="w-full bg-gray-900 text-white py-2 rounded-lg disabled:opacity-50">
                            {isLoading ? "Finishing..." : "Continue Without Phone"}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-blue-50 to-indigo-50">
            <Toaster />
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5">
                <div className="text-center mb-8"><h1 className="text-3xl font-bold text-gray-900 mb-2">Create Account</h1><p className="text-gray-600">Join our grading platform today</p></div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-4">
                        <div><label className="block text-sm font-medium text-gray-700 mb-1">Name</label><div className="relative"><User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5" /><input type="text" placeholder="Enter your name" value={name} onChange={(e) => setName(e.target.value)} className="pl-10 w-full py-2 border border-gray-300 rounded-lg" required /></div></div>
                        <div><label className="block text-sm font-medium text-gray-700 mb-1">Email</label><div className="relative"><Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5" /><input type="email" placeholder="Enter your email" value={email} onChange={(e) => setEmail(e.target.value)} className="pl-10 w-full py-2 border border-gray-300 rounded-lg" required /></div></div>
                        <div><label className="block text-sm font-medium text-gray-700 mb-1">Password</label><div className="relative"><Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5" /><input type="password" placeholder="Create a password" value={password} onChange={(e) => setPassword(e.target.value)} className="pl-10 w-full py-2 border border-gray-300 rounded-lg" minLength={6} required /></div></div>
                        <div><label className="block text-sm font-medium text-gray-700 mb-1">Register as</label><div className="relative"><select value={role} onChange={(e) => setRole(e.target.value)} className="w-full py-2 pl-10 border border-gray-300 rounded-lg" required><option value="">Select your role</option><option value="student">Student</option><option value="faculty">Faculty</option><option value="ta">Teaching Assistant</option></select>{role === "student" && <GraduationCap className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5" />}{role === "faculty" && <School className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5" />}{role === "ta" && <Users className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5" />}{!role && <Users className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5" />}</div></div>
                    </div>
                    <button type="submit" disabled={isLoading || isGoogleLoading} className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2">{isLoading ? <><Loader2 className="h-5 w-5 animate-spin" />Signing Up...</> : <>Sign Up <ArrowRight className="h-5 w-5" /></>}</button>
                </form>

                <div className="mt-6"><div className="relative"><div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-300" /></div><div className="relative flex justify-center text-sm"><span className="px-2 bg-white text-gray-500">OR</span></div></div><button onClick={signUpWithGoogle} disabled={isLoading || isGoogleLoading} className="mt-4 w-full flex items-center justify-center gap-3 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">{isGoogleLoading ? <><Loader2 className="h-5 w-5 animate-spin" />Signing up...</> : <><img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />Sign up with Google</>}</button></div>
                <p className="mt-6 text-center text-sm text-gray-600">Already have an account? <a href="/login" className="font-medium text-blue-600 hover:text-blue-500">Sign in</a></p>
            </div>
        </div>
    );
}

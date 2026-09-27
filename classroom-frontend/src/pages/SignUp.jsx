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
import { setDoc, doc, deleteDoc } from "firebase/firestore";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, BookOpen, GraduationCap, Lock, Mail, MailCheck, Phone, School, User } from "lucide-react";
import toast from "react-hot-toast";
import axios from "axios";
import AuthLayout, { Divider, GoogleButton } from "../components/AuthLayout";
import { Button, Field, inputClass } from "../components/ui";
import { API } from "../lib/api";

const roleOptions = [
    { value: "student", label: "Student", icon: GraduationCap, text: "Submit work & track grades" },
    { value: "faculty", label: "Faculty", icon: School, text: "Run courses & assignments" },
    { value: "ta", label: "TA", icon: BookOpen, text: "Grade & give feedback" }
];

const createMongoUser = async (role, email, name, phoneNumber = "") => {
    const endpoint = { faculty: "/faculty/createFaculty", ta: "/ta/createTA", student: "/student/createStudent" }[role];
    if (!endpoint) throw new Error("Please select a valid role");

    const currentUser = auth.currentUser;
    if (!currentUser) {
        throw new Error("Your Firebase session expired. Please start signup again.");
    }

    // Force-refresh so the backend sees the latest verified email/phone claims.
    const token = await currentUser.getIdToken(true);
    try {
        const response = await axios.post(`${API}${endpoint}`, {
            email: email.toLowerCase().trim(),
            name: name.trim(),
            phoneNumber: phoneNumber.trim() || undefined
        }, {
            headers: { Authorization: `Bearer ${token}` }
        });
        return response.data;
    } catch (err) {
        // The session-restore flow may already have provisioned this account.
        if (err.response?.status === 409) return null;
        throw err;
    }
};

// The signup profile in Firestore lets the backend recover an account if the
// Gradely record was never created. It is a backup, so a Firestore rules
// rejection must not abort (or roll back) an otherwise successful signup.
const saveProfile = async (email, profile, options) => {
    try {
        await setDoc(doc(db, "users", email), profile, options);
    } catch (err) {
        console.warn("Could not save Firestore signup profile:", err.code || err.message);
    }
};

// True when this Firebase user already has a Gradely account.
const hasGradelyAccount = async () => {
    try {
        await axios.get(`${API}/auth/me`);
        return true;
    } catch (err) {
        if (err.response?.status === 404) return false;
        throw err;
    }
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
            await createMongoUser(role, normalizedEmail, name, phoneNumber);
            await saveProfile(normalizedEmail, {
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

            await saveProfile(normalizedEmail, {
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
            if (await hasGradelyAccount()) {
                await signOut(auth);
                toast.error("An account with this email already exists. Try logging in!");
                navigate("/login");
                return;
            }

            const displayName = firebaseUser.displayName?.trim() || "Gradely User";
            await saveProfile(normalizedEmail, {
                email: normalizedEmail,
                name: displayName,
                role,
                emailVerified: firebaseUser.emailVerified,
                phoneVerified: false
            });

            try {
                await createMongoUser(role, normalizedEmail, displayName);
            } catch (err) {
                await deleteDoc(doc(db, "users", normalizedEmail)).catch(() => {});
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

    const checkEmailVerified = async () => {
        try {
            await auth.currentUser?.reload();
            if (!auth.currentUser?.emailVerified) {
                toast.error("Email is not verified yet. Open the link in your inbox first.");
                return;
            }
            toast.success("Email verified. You can finish signup now.");
        } catch (err) {
            toast.error(err.message || "Unable to check verification status.");
        }
    };

    if (verificationStage === "verify") {
        return (
            <AuthLayout
                title="Verify your email"
                subtitle={<>We sent a verification link to <span className="font-medium text-slate-900">{email}</span>. Open it, then finish your signup below.</>}
            >
                <div className="mb-6 flex items-center gap-3 rounded-xl bg-indigo-50 p-4 text-sm text-indigo-900">
                    <MailCheck className="h-5 w-5 shrink-0 text-indigo-600" />
                    Can’t find it? Check your spam folder or resend the email.
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <Button variant="soft" onClick={checkEmailVerified}>I’ve verified</Button>
                    <Button variant="secondary" onClick={resendEmail}>Resend email</Button>
                </div>

                <div className="mt-8 rounded-xl border border-slate-200 p-5">
                    <Field label="Phone number" htmlFor="phone" hint="Optional. Include your country code, e.g. +91 98765 43210.">
                        <div className="relative">
                            <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                            <input id="phone" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} placeholder="+91..." className={`${inputClass} h-11 pl-10`} />
                        </div>
                    </Field>
                    <div id="phone-recaptcha" className="mt-3" />
                    {!verificationId ? (
                        <Button variant="secondary" className="mt-3 w-full" onClick={startPhoneVerification} loading={isPhoneLoading} disabled={!phoneNumber.trim()}>
                            {isPhoneLoading ? "Sending code..." : "Send verification code"}
                        </Button>
                    ) : (
                        <div className="mt-3 space-y-3">
                            <input value={verificationCode} onChange={(e) => setVerificationCode(e.target.value)} placeholder="6-digit code" inputMode="numeric" className={`${inputClass} h-11 tracking-widest`} />
                            <Button variant="success" className="w-full" onClick={verifyPhone} loading={isPhoneLoading}>
                                {isPhoneLoading ? "Verifying..." : "Verify phone & finish"}
                            </Button>
                        </div>
                    )}
                </div>

                <Button size="lg" className="mt-6 w-full" onClick={continueWithoutPhone} loading={isLoading}>
                    {isLoading ? "Finishing..." : <>Finish without phone <ArrowRight className="h-4 w-4" /></>}
                </Button>
            </AuthLayout>
        );
    }

    const busy = isLoading || isGoogleLoading;

    return (
        <AuthLayout
            title="Create your account"
            subtitle="Choose your role to get started with Gradely."
            footer={<>Already have an account? <Link to="/login" className="font-medium text-indigo-600 hover:text-indigo-700">Sign in</Link></>}
        >
            <fieldset>
                <legend className="mb-2 text-sm font-medium text-slate-700">I am a</legend>
                <div className="grid grid-cols-3 gap-2">
                    {roleOptions.map(({ value, label, icon: Icon, text }) => {
                        const selected = role === value;
                        return (
                            <button
                                key={value}
                                type="button"
                                onClick={() => setRole(value)}
                                aria-pressed={selected}
                                className={`flex flex-col items-center gap-1 rounded-xl border p-3 text-center transition-colors ${
                                    selected ? "border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500" : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                                }`}
                            >
                                <Icon className={`h-5 w-5 ${selected ? "text-indigo-600" : "text-slate-400"}`} />
                                <span className={`text-sm font-semibold ${selected ? "text-indigo-700" : "text-slate-700"}`}>{label}</span>
                                <span className="hidden text-[11px] leading-tight text-slate-500 sm:block">{text}</span>
                            </button>
                        );
                    })}
                </div>
            </fieldset>

            <div className="mt-6">
                <GoogleButton onClick={signUpWithGoogle} loading={isGoogleLoading} disabled={busy}>Sign up with Google</GoogleButton>
            </div>
            <Divider label="or use email" />

            <form onSubmit={handleSubmit} className="space-y-4">
                <Field label="Full name" htmlFor="name">
                    <div className="relative">
                        <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input id="name" type="text" autoComplete="name" placeholder="Ada Lovelace" value={name} onChange={(e) => setName(e.target.value)} className={`${inputClass} h-11 pl-10`} required />
                    </div>
                </Field>
                <Field label="Email" htmlFor="email">
                    <div className="relative">
                        <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input id="email" type="email" autoComplete="email" placeholder="you@university.edu" value={email} onChange={(e) => setEmail(e.target.value)} className={`${inputClass} h-11 pl-10`} required />
                    </div>
                </Field>
                <Field label="Password" htmlFor="password" hint="At least 6 characters.">
                    <div className="relative">
                        <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input id="password" type="password" autoComplete="new-password" placeholder="Create a password" value={password} onChange={(e) => setPassword(e.target.value)} className={`${inputClass} h-11 pl-10`} minLength={6} required />
                    </div>
                </Field>
                <Button type="submit" size="lg" className="w-full" loading={isLoading} disabled={busy}>
                    {isLoading ? "Creating account..." : <>Create account <ArrowRight className="h-4 w-4" /></>}
                </Button>
            </form>
        </AuthLayout>
    );
}

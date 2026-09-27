import { CheckCircle2 } from "lucide-react";
import { Logo } from "./AppLayout";

const highlights = [
    "Create courses and publish assignments in minutes",
    "Grade submissions with feedback and re-evaluation",
    "Track every deadline from a single dashboard",
    "Get assignment-aware help from the AI study helper"
];

export default function AuthLayout({ title, subtitle, children, footer }) {
    return (
        <div className="grid min-h-screen bg-white lg:grid-cols-2">
            <div className="relative hidden overflow-hidden bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-800 p-12 text-white lg:flex lg:flex-col lg:justify-between">
                <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
                <div className="pointer-events-none absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-violet-400/20 blur-3xl" />
                <Logo light />
                <div className="relative">
                    <h2 className="max-w-md text-4xl font-bold leading-tight tracking-tight">
                        Grading that keeps faculty, TAs and students in sync.
                    </h2>
                    <ul className="mt-8 space-y-3">
                        {highlights.map(item => (
                            <li key={item} className="flex items-start gap-3 text-indigo-100">
                                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" />
                                {item}
                            </li>
                        ))}
                    </ul>
                </div>
                <p className="relative text-sm text-indigo-200">© {new Date().getFullYear()} Gradely</p>
            </div>

            <div className="flex items-center justify-center px-4 py-12 sm:px-8">
                <div className="w-full max-w-md">
                    <div className="mb-8 lg:hidden"><Logo /></div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{title}</h1>
                    {subtitle && <p className="mt-2 text-sm text-slate-500">{subtitle}</p>}
                    <div className="mt-8">{children}</div>
                    {footer && <div className="mt-8 text-center text-sm text-slate-500">{footer}</div>}
                </div>
            </div>
        </div>
    );
}

export function Divider({ label }) {
    return (
        <div className="relative my-6">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200" /></div>
            <div className="relative flex justify-center text-xs uppercase tracking-wide">
                <span className="bg-white px-3 text-slate-400">{label}</span>
            </div>
        </div>
    );
}

export function GoogleButton({ loading, disabled, onClick, children }) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled || loading}
            className="flex h-11 w-full items-center justify-center gap-3 rounded-lg bg-white text-sm font-medium text-slate-700 ring-1 ring-inset ring-slate-200 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
            {loading ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-600" />
            ) : (
                <svg className="h-5 w-5" viewBox="0 0 48 48" aria-hidden="true">
                    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
                    <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
                    <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
                    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
                </svg>
            )}
            {children}
        </button>
    );
}

import { useContext } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { ArrowLeft, Crown, GraduationCap, LayoutDashboard, LogOut, Sparkles } from "lucide-react";
import toast from "react-hot-toast";
import { UserContext } from "../context/ContextProvider";
import { dashboardPath } from "../lib/api";
import { Avatar } from "./ui";

const roleLabels = { faculty: "Faculty", ta: "Teaching Assistant", student: "Student" };

export function Logo({ to = "/", light = false }) {
    return (
        <Link to={to} className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-sm">
                <GraduationCap className="h-5 w-5" />
            </span>
            <span className={`text-lg font-bold tracking-tight ${light ? "text-white" : "text-slate-900"}`}>Gradely</span>
        </Link>
    );
}

function NavItem({ to, icon: Icon, children, end }) {
    return (
        <NavLink
            to={to}
            end={end}
            className={({ isActive }) =>
                `flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    isActive ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`
            }
        >
            <Icon className="h-4 w-4" />
            <span className="hidden sm:inline">{children}</span>
        </NavLink>
    );
}

export default function AppLayout({ title, subtitle, eyebrow, backTo, backLabel = "Back", actions, children }) {
    const { user, logout } = useContext(UserContext);
    const navigate = useNavigate();
    const home = dashboardPath(user?.role);

    const handleLogout = async () => {
        await logout();
        toast.success("Logged out");
        navigate("/login", { replace: true });
    };

    return (
        <div className="min-h-screen bg-slate-50">
            <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/80 backdrop-blur">
                <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center gap-6">
                        <Logo to={home} />
                        <nav className="flex items-center gap-1">
                            <NavItem to={home} icon={LayoutDashboard} end>Dashboard</NavItem>
                            {user?.role === "student" && <NavItem to="/student/ai-helper" icon={Sparkles}>AI Helper</NavItem>}
                            <NavItem to="/premium" icon={Crown}>Premium</NavItem>
                        </nav>
                    </div>
                    {user && (
                        <div className="flex items-center gap-3">
                            <div className="hidden text-right md:block">
                                <p className="text-sm font-medium leading-tight text-slate-900">{user.name}</p>
                                <p className="text-xs text-slate-500">{roleLabels[user.role]}</p>
                            </div>
                            <Avatar name={user.name} />
                            <button
                                type="button"
                                onClick={handleLogout}
                                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-rose-600"
                                title="Log out"
                                aria-label="Log out"
                            >
                                <LogOut className="h-5 w-5" />
                            </button>
                        </div>
                    )}
                </div>
            </header>

            <main className="mx-auto max-w-7xl px-4 pb-16 pt-6 sm:px-6 lg:px-8">
                {(title || backTo) && (
                    <div className="mb-6">
                        {backTo && (
                            <Link to={backTo} className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-900">
                                <ArrowLeft className="h-4 w-4" />
                                {backLabel}
                            </Link>
                        )}
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                            <div className="min-w-0">
                                {eyebrow && <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600">{eyebrow}</p>}
                                {title && <h1 className="break-words text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{title}</h1>}
                                {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
                            </div>
                            {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
                        </div>
                    </div>
                )}
                {children}
            </main>
        </div>
    );
}

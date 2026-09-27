import { useContext } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { LogOut, ShieldAlert } from "lucide-react";
import { UserContext } from "../context/ContextProvider";
import { dashboardPath } from "../lib/api";
import { Logo } from "../components/AppLayout";
import { Button } from "../components/ui";

export default function Unauthorized() {
    const { user, loading, logout } = useContext(UserContext);
    const navigate = useNavigate();

    if (!loading && !user) return <Navigate to="/login" replace />;

    const handleLogout = async () => {
        await logout();
        navigate("/login", { replace: true });
    };

    return (
        <div className="flex min-h-screen flex-col bg-slate-50">
            <div className="px-6 py-5"><Logo to={dashboardPath(user?.role)} /></div>
            <div className="flex flex-1 flex-col items-center justify-center px-4 text-center">
                <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
                    <ShieldAlert className="h-8 w-8" />
                </div>
                <h1 className="text-3xl font-bold tracking-tight text-slate-900">Access denied</h1>
                <p className="mt-2 max-w-sm text-slate-500">
                    You don’t have permission to view this page. If you think this is a mistake, contact your course faculty.
                </p>
                <div className="mt-8 flex flex-col gap-2 sm:flex-row">
                    <Link to={dashboardPath(user?.role)} className="inline-flex h-10 items-center justify-center rounded-lg bg-indigo-600 px-4 text-sm font-medium text-white hover:bg-indigo-700">
                        Back to dashboard
                    </Link>
                    <Button variant="secondary" onClick={handleLogout}>
                        <LogOut className="h-4 w-4" />
                        Log out
                    </Button>
                </div>
            </div>
        </div>
    );
}

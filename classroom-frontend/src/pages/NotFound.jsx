import { useContext } from "react";
import { Link } from "react-router-dom";
import { Compass } from "lucide-react";
import { UserContext } from "../context/ContextProvider";
import { dashboardPath } from "../lib/api";
import { Logo } from "../components/AppLayout";

export default function NotFound() {
    const { user } = useContext(UserContext);
    const home = user ? dashboardPath(user.role) : "/login";

    return (
        <div className="flex min-h-screen flex-col bg-slate-50">
            <div className="px-6 py-5"><Logo to={home} /></div>
            <div className="flex flex-1 flex-col items-center justify-center px-4 text-center">
                <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
                    <Compass className="h-8 w-8" />
                </div>
                <p className="text-sm font-semibold text-indigo-600">404</p>
                <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">Page not found</h1>
                <p className="mt-2 max-w-sm text-slate-500">The page you’re looking for doesn’t exist or has moved.</p>
                <Link to={home} className="mt-8 inline-flex h-10 items-center rounded-lg bg-indigo-600 px-4 text-sm font-medium text-white hover:bg-indigo-700">
                    {user ? "Back to dashboard" : "Go to login"}
                </Link>
            </div>
        </div>
    );
}

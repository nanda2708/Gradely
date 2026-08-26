import { UserContext } from "./ContextProvider";
import { useContext } from "react";
import { Navigate } from "react-router-dom";

const ProtectedRoute = ({ children, roles }) => {
    const { user, loading } = useContext(UserContext);

    if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-600">Loading...</div>;

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    if (!roles.includes(user.role)) {
        return <Navigate to="/unauthorized" replace />;
    }

    return children;
};

export default ProtectedRoute
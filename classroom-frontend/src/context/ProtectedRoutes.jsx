import { useContext } from "react";
import { Navigate } from "react-router-dom";
import { UserContext } from "./ContextProvider";
import { FullScreenLoader } from "../components/ui";

const ProtectedRoute = ({ children, roles }) => {
    const { user, loading } = useContext(UserContext);

    if (loading) return <FullScreenLoader />;
    if (!user) return <Navigate to="/login" replace />;
    if (!roles.includes(user.role)) return <Navigate to="/unauthorized" replace />;

    return children;
};

export default ProtectedRoute;

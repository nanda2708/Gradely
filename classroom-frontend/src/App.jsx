import { lazy, Suspense, useContext } from "react";
import { BrowserRouter as Router, Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import ProtectedRoute from "./context/ProtectedRoutes";
import { UserContext } from "./context/ContextProvider";
import { FullScreenLoader } from "./components/ui";
import { dashboardPath } from "./lib/api";

const Login = lazy(() => import("./pages/Login"));
const SignUp = lazy(() => import("./pages/SignUp"));
const FacultyDashboard = lazy(() => import("./pages/FacultyDashboard"));
const StudentDashboard = lazy(() => import("./pages/StudentDashboard"));
const TADashboard = lazy(() => import("./pages/TADashboard"));
const FacultyCourse = lazy(() => import("./pages/FacultyCourse"));
const TACourse = lazy(() => import("./pages/TACourse"));
const StudentCourse = lazy(() => import("./pages/StudentCourse"));
const CheckSolution = lazy(() => import("./pages/CheckSolution"));
const PaymentTest = lazy(() => import("./pages/PaymentTest"));
const AIHelper = lazy(() => import("./pages/AIHelper"));
const Unauthorized = lazy(() => import("./pages/Unauthorized"));
const NotFound = lazy(() => import("./pages/NotFound"));

// Signed-in users landing on the login page go straight to their dashboard.
const GuestRoute = ({ children }) => {
    const { user, initialized } = useContext(UserContext);
    if (!initialized) return <FullScreenLoader />;
    if (user) return <Navigate to={dashboardPath(user.role)} replace />;
    return children;
};

const ALL_ROLES = ["faculty", "ta", "student"];

const App = () => (
    <Router>
        <Toaster
            position="top-right"
            toastOptions={{
                className: "text-sm",
                style: { borderRadius: "10px", padding: "10px 14px" }
            }}
        />
        <Suspense fallback={<FullScreenLoader />}>
            <Routes>
                <Route path="/" element={<GuestRoute><Login /></GuestRoute>} />
                <Route path="/login" element={<GuestRoute><Login /></GuestRoute>} />
                <Route path="/signup" element={<SignUp />} />
                <Route path="/faculty" element={<ProtectedRoute roles={["faculty"]}><FacultyDashboard /></ProtectedRoute>} />
                <Route path="/ta" element={<ProtectedRoute roles={["ta"]}><TADashboard /></ProtectedRoute>} />
                <Route path="/student" element={<ProtectedRoute roles={["student"]}><StudentDashboard /></ProtectedRoute>} />
                <Route path="/faculty/courses/:courseId" element={<ProtectedRoute roles={["faculty"]}><FacultyCourse /></ProtectedRoute>} />
                <Route path="/ta/courses/:courseId" element={<ProtectedRoute roles={["ta"]}><TACourse /></ProtectedRoute>} />
                <Route path="/student/courses/:courseId" element={<ProtectedRoute roles={["student"]}><StudentCourse /></ProtectedRoute>} />
                <Route path="/checkSubmission/:assignmentId/:submissionId" element={<ProtectedRoute roles={["faculty", "ta"]}><CheckSolution /></ProtectedRoute>} />
                <Route path="/payment-test" element={<Navigate to="/premium" replace />} />
                <Route path="/premium" element={<ProtectedRoute roles={ALL_ROLES}><PaymentTest /></ProtectedRoute>} />
                <Route path="/student/ai-helper" element={<ProtectedRoute roles={["student"]}><AIHelper /></ProtectedRoute>} />
                <Route path="/unauthorized" element={<Unauthorized />} />
                <Route path="*" element={<NotFound />} />
            </Routes>
        </Suspense>
    </Router>
);

export default App;

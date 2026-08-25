import { BrowserRouter as Router, Routes, Route, useNavigate } from "react-router-dom";
import { useContext } from "react";
import { Sparkles } from "lucide-react";
import "./App.css";
import ProtectedRoute from "./context/ProtectedRoutes";
import { UserContext } from "./context/ContextProvider";
import FacultyDashboard from "./pages/FacultyDashboard";
import StudentDashboard from "./pages/StudentDashboard";
import Login from "./pages/Login";
import SignUp from "./pages/SignUp";
import TADashboard from "./pages/TADashboard";
import Unauthorized from "./pages/Unauthorized";
import FacultyCourse from "./pages/FacultyCourse";
import TACourse from "./pages/TACourse";
import StudentCourse from "./pages/StudentCourse";
import CheckSolution from "./pages/CheckSolution";
import PaymentTest from "./pages/PaymentTest";
import AIHelper from "./pages/AIHelper";

const StudentAIButton = () => {
    const { user } = useContext(UserContext);
    const navigate = useNavigate();

    if (user?.role !== "student") return null;

    return (
        <button
            type="button"
            onClick={() => navigate("/student/ai-helper")}
            className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full bg-blue-600 px-5 py-3 text-white shadow-lg hover:bg-blue-700 transition-colors"
            title="Open Gradely AI Helper"
        >
            <Sparkles className="h-5 w-5" />
            AI Helper
        </button>
    );
};

const App = () => (
    <Router>
        <Routes>
            <Route path="/" element={<Login />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<SignUp />} />
            <Route path="/faculty" element={<ProtectedRoute roles={["faculty"]}><FacultyDashboard /></ProtectedRoute>} />
            <Route path="/ta" element={<ProtectedRoute roles={["ta"]}><TADashboard /></ProtectedRoute>} />
            <Route path="/student" element={<ProtectedRoute roles={["student"]}><StudentDashboard /></ProtectedRoute>} />
            <Route path="/faculty/courses/:courseId" element={<ProtectedRoute roles={["faculty"]}><FacultyCourse /></ProtectedRoute>} />
            <Route path="/ta/courses/:courseId" element={<ProtectedRoute roles={["ta"]}><TACourse /></ProtectedRoute>} />
            <Route path="/student/courses/:courseId" element={<ProtectedRoute roles={["student"]}><StudentCourse /></ProtectedRoute>} />
            <Route path="/checkSubmission/:assignmentId/:submissionId" element={<ProtectedRoute roles={["faculty", "ta"]}><CheckSolution /></ProtectedRoute>} />
            <Route path="/payment-test" element={<ProtectedRoute roles={["faculty", "ta", "student"]}><PaymentTest /></ProtectedRoute>} />
            <Route path="/student/ai-helper" element={<ProtectedRoute roles={["student"]}><AIHelper /></ProtectedRoute>} />
            <Route path="/unauthorized" element={<Unauthorized />} />
            <Route path="*" element={<Unauthorized />} />
        </Routes>
        <StudentAIButton />
    </Router>
);

export default App;

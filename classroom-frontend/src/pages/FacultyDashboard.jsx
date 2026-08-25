import { useNavigate } from "react-router-dom";
import { UserContext } from "../context/ContextProvider";
import { useContext, useEffect, useState } from "react";
import { BookOpen, Users, LogOut, Calendar, ClipboardList, Plus, X, Loader2 } from "lucide-react";
import axios from "axios";
import toast, { Toaster } from "react-hot-toast";

const API = import.meta.env.VITE_BACKEND_URL?.replace(/\/$/, "");

export default function FacultyDashboard() {
    const navigate = useNavigate();
    const { user, loading, logout } = useContext(UserContext);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [courseName, setCourseName] = useState("");
    const [createCourseLoading, setCreateCourseLoading] = useState(false);
    const [loadingData, setLoadingData] = useState(false);
    const [courses, setCourses] = useState([]);
    const [assignments, setAssignments] = useState([]);
    const [activeTab, setActiveTab] = useState("courses");

    const fetchDashboard = async () => {
        if (!user?.id || !API) return;
        setLoadingData(true);
        try {
            const [courseRes, assignmentRes] = await Promise.all([
                axios.get(`${API}/faculty/getCourses/${user.id}`),
                axios.get(`${API}/faculty/getAssignments/${user.id}`)
            ]);
            setCourses(courseRes.data?.courses || []);
            setAssignments(assignmentRes.data?.assignments || []);
        } catch (err) {
            console.error("Faculty dashboard load failed:", err);
            toast.error(err.response?.data?.error || "Unable to load your faculty dashboard.");
        } finally {
            setLoadingData(false);
        }
    };

    useEffect(() => {
        if (!loading && user) fetchDashboard();
    }, [loading, user?.id]);

    const handleLogout = async () => {
        await logout();
        navigate("/login", { replace: true });
    };

    const handleCreateCourse = async () => {
        if (!courseName.trim() || !user?.id) return;
        setCreateCourseLoading(true);
        try {
            const courseRes = await axios.post(`${API}/course/createCourse`, {
                name: courseName.trim(),
                faculty: user.id
            });

            const courseId = courseRes.data?._id;
            if (!courseId) throw new Error("Backend did not return the new course ID");

            await axios.post(`${API}/faculty/addCourse`, {
                facultyId: user.id,
                courseId
            });

            setCourseName("");
            setShowCreateModal(false);
            toast.success("Course created successfully!");
            navigate(`/faculty/courses/${courseId}`);
        } catch (err) {
            console.error("Course creation failed:", err);
            toast.error(err.response?.data?.error || err.message || "Unable to create course.");
        } finally {
            setCreateCourseLoading(false);
        }
    };

    if (loading) {
        return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>;
    }

    if (!user) return null;

    return (
        <div className="min-h-screen bg-gray-50">
            <Toaster />
            <header className="bg-white shadow">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
                    <div><h1 className="text-3xl font-bold text-gray-900">Welcome, {user.name}</h1><p className="text-gray-500">Faculty Dashboard</p></div>
                    <button onClick={handleLogout} className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"><LogOut className="h-5 w-5" />Logout</button>
                </div>
            </header>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
                <nav className="border-b border-gray-200 flex gap-8">
                    <button onClick={() => setActiveTab("courses")} className={`${activeTab === "courses" ? "border-blue-500 text-blue-600" : "border-transparent text-gray-500"} flex items-center gap-2 py-4 border-b-2 font-medium`}><BookOpen className="h-5 w-5" />My Courses</button>
                    <button onClick={() => setActiveTab("assignments")} className={`${activeTab === "assignments" ? "border-blue-500 text-blue-600" : "border-transparent text-gray-500"} flex items-center gap-2 py-4 border-b-2 font-medium`}><ClipboardList className="h-5 w-5" />Assignments</button>
                </nav>
            </div>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {activeTab === "courses" ? (
                    <>
                        <div className="mb-6 flex justify-between items-center"><h2 className="text-2xl font-semibold">My Courses</h2><button onClick={() => setShowCreateModal(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"><Plus className="h-5 w-5" />Create Course</button></div>
                        {loadingData ? <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div> : courses.length === 0 ? <div className="bg-white rounded-lg shadow p-10 text-center text-gray-500">No courses yet. Create your first course.</div> : <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">{courses.map(course => <div key={course._id} onClick={() => navigate(`/faculty/courses/${course._id}`)} className="bg-white rounded-lg shadow p-6 hover:shadow-lg cursor-pointer"><h3 className="text-xl font-semibold mb-4">{course.name}</h3><div className="space-y-3 text-gray-600"><div className="flex items-center gap-2"><Users className="h-5 w-5" />{course.students?.length || 0} Students</div><div className="flex items-center gap-2"><BookOpen className="h-5 w-5" />{course.tas?.length || 0} Teaching Assistants</div></div></div>)}</div>}
                    </>
                ) : (
                    <div className="bg-white shadow rounded-lg overflow-hidden"><table className="min-w-full divide-y divide-gray-200"><thead className="bg-gray-50"><tr><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Assignment</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Course</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Due Date</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Submissions</th></tr></thead><tbody className="divide-y divide-gray-200">{assignments.map(assignment => <tr key={assignment._id}><td className="px-6 py-4 font-medium">{assignment.title}</td><td className="px-6 py-4 text-gray-500">{assignment.course?.name || "—"}</td><td className="px-6 py-4 text-gray-500"><span className="flex items-center gap-2"><Calendar className="h-4 w-4" />{assignment.dueDate ? new Date(assignment.dueDate).toLocaleDateString() : "—"}</span></td><td className="px-6 py-4 text-gray-500">{assignment.submissions?.length || 0} / {assignment.course?.students?.length || 0}</td></tr>)}{assignments.length === 0 && <tr><td colSpan="4" className="px-6 py-10 text-center text-gray-500">No assignments yet.</td></tr>}</tbody></table></div>
                )}
            </main>

            {showCreateModal && <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"><div className="bg-white rounded-lg shadow-xl max-w-md w-full"><div className="flex items-center justify-between p-6 border-b"><h3 className="text-lg font-semibold">Create New Course</h3><button onClick={() => setShowCreateModal(false)}><X className="h-6 w-6" /></button></div><div className="p-6"><label htmlFor="courseName" className="block text-sm font-medium mb-2">Course Name</label><input id="courseName" value={courseName} onChange={e => setCourseName(e.target.value)} onKeyDown={e => e.key === "Enter" && handleCreateCourse()} placeholder="e.g. Data Structures" className="w-full px-3 py-2 border rounded-lg" autoFocus /></div><div className="flex justify-end gap-3 p-6 border-t"><button onClick={() => { setCourseName(""); setShowCreateModal(false); }} className="px-4 py-2 bg-gray-100 rounded-lg">Cancel</button><button onClick={handleCreateCourse} disabled={!courseName.trim() || createCourseLoading} className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:bg-gray-300">{createCourseLoading ? "Creating..." : "Create Course"}</button></div></div></div>}
        </div>
    );
}

import { useCallback, useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BookOpen, Calendar, ChevronRight, ClipboardList, Inbox, Plus, Users } from "lucide-react";
import axios from "axios";
import toast from "react-hot-toast";
import { UserContext } from "../context/ContextProvider";
import AppLayout from "../components/AppLayout";
import { Button, Card, EmptyState, Field, Modal, PageLoader, ProgressBar, StatCard, Table, Tabs, Td, Th, inputClass } from "../components/ui";
import { API, apiError } from "../lib/api";
import { countUngradedLatest, formatDate, percent, uniqueStudentCount } from "../lib/format";

export default function FacultyDashboard() {
    const navigate = useNavigate();
    const { user } = useContext(UserContext);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [courseName, setCourseName] = useState("");
    const [creating, setCreating] = useState(false);
    const [loadingData, setLoadingData] = useState(true);
    const [courses, setCourses] = useState([]);
    const [assignments, setAssignments] = useState([]);
    const [activeTab, setActiveTab] = useState("courses");

    const fetchDashboard = useCallback(async () => {
        if (!user?.id) return;
        setLoadingData(true);
        try {
            const [courseRes, assignmentRes] = await Promise.all([
                axios.get(`${API}/faculty/getCourses/${user.id}`),
                axios.get(`${API}/faculty/getAssignments/${user.id}`)
            ]);
            setCourses(courseRes.data?.courses || []);
            setAssignments(assignmentRes.data?.assignments || []);
        } catch (err) {
            toast.error(apiError(err, "Unable to load your dashboard."));
        } finally {
            setLoadingData(false);
        }
    }, [user?.id]);

    useEffect(() => {
        fetchDashboard();
    }, [fetchDashboard]);

    const closeModal = () => {
        setCourseName("");
        setShowCreateModal(false);
    };

    const handleCreateCourse = async (event) => {
        event?.preventDefault();
        if (!courseName.trim() || !user?.id || creating) return;
        setCreating(true);
        try {
            const { data } = await axios.post(`${API}/course/createCourse`, { name: courseName.trim(), faculty: user.id });
            if (!data?._id) throw new Error("Backend did not return the new course ID");
            toast.success("Course created");
            closeModal();
            navigate(`/faculty/courses/${data._id}`);
        } catch (err) {
            toast.error(apiError(err, "Unable to create course."));
        } finally {
            setCreating(false);
        }
    };

    const totalStudents = new Set(courses.flatMap(course => (course.students || []).map(s => String(s?._id || s)))).size;
    const awaitingReview = assignments.reduce(
        (sum, assignment) => sum + countUngradedLatest(assignment.submissions),
        0
    );

    const createButton = (
        <Button onClick={() => setShowCreateModal(true)}>
            <Plus className="h-4 w-4" />
            New course
        </Button>
    );

    return (
        <AppLayout
            eyebrow="Faculty dashboard"
            title={`Welcome back, ${user.name.split(" ")[0]}`}
            subtitle="Manage your courses, assignments and grading."
            actions={createButton}
        >
            <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
                <StatCard label="Courses" value={courses.length} icon={BookOpen} />
                <StatCard label="Assignments" value={assignments.length} icon={ClipboardList} tone="purple" />
                <StatCard label="Students" value={totalStudents} icon={Users} tone="blue" />
                <StatCard label="Awaiting grading" value={awaitingReview} icon={Inbox} tone="yellow" />
            </div>

            <div className="mb-5">
                <Tabs
                    active={activeTab}
                    onChange={setActiveTab}
                    tabs={[
                        { id: "courses", label: "My courses", icon: BookOpen, count: courses.length },
                        { id: "assignments", label: "Assignments", icon: ClipboardList, count: assignments.length }
                    ]}
                />
            </div>

            {loadingData ? (
                <PageLoader />
            ) : activeTab === "courses" ? (
                courses.length === 0 ? (
                    <EmptyState
                        icon={BookOpen}
                        title="No courses yet"
                        description="Create your first course, then add TAs, students and assignments."
                        action={createButton}
                    />
                ) : (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                        {courses.map(course => (
                            <Card
                                key={course._id}
                                role="button"
                                tabIndex={0}
                                onClick={() => navigate(`/faculty/courses/${course._id}`)}
                                onKeyDown={e => e.key === "Enter" && navigate(`/faculty/courses/${course._id}`)}
                                className="group cursor-pointer p-5 transition hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md"
                            >
                                <div className="mb-4 flex items-start justify-between gap-3">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-white">
                                        <BookOpen className="h-5 w-5" />
                                    </div>
                                    <ChevronRight className="h-5 w-5 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-indigo-500" />
                                </div>
                                <h3 className="truncate text-base font-semibold text-slate-900">{course.name}</h3>
                                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">
                                    <span className="flex items-center gap-1.5"><Users className="h-4 w-4" />{course.students?.length || 0} students</span>
                                    <span className="flex items-center gap-1.5"><BookOpen className="h-4 w-4" />{course.tas?.length || 0} TAs</span>
                                    <span className="flex items-center gap-1.5"><ClipboardList className="h-4 w-4" />{course.assignments?.length || 0} assignments</span>
                                </div>
                            </Card>
                        ))}
                    </div>
                )
            ) : assignments.length === 0 ? (
                <EmptyState icon={ClipboardList} title="No assignments yet" description="Open a course to publish its first assignment." />
            ) : (
                <Table>
                    <thead>
                        <tr><Th>Assignment</Th><Th>Course</Th><Th>Due</Th><Th className="w-48">Submitted</Th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                        {assignments.map(assignment => {
                            const submitted = uniqueStudentCount(assignment.submissions);
                            const total = assignment.course?.students?.length || 0;
                            return (
                                <tr
                                    key={assignment._id}
                                    className="cursor-pointer hover:bg-slate-50"
                                    onClick={() => assignment.course?._id && navigate(`/faculty/courses/${assignment.course._id}`)}
                                >
                                    <Td className="font-medium text-slate-900">{assignment.title}</Td>
                                    <Td>{assignment.course?.name || "—"}</Td>
                                    <Td className="whitespace-nowrap"><span className="flex items-center gap-1.5"><Calendar className="h-4 w-4 text-slate-400" />{formatDate(assignment.dueDate)}</span></Td>
                                    <Td><ProgressBar value={percent(submitted, total)} label={`${submitted} of ${total} students`} /></Td>
                                </tr>
                            );
                        })}
                    </tbody>
                </Table>
            )}

            <Modal
                open={showCreateModal}
                onClose={closeModal}
                title="Create a new course"
                description="You can add TAs, students and assignments after creating it."
                footer={
                    <>
                        <Button variant="secondary" onClick={closeModal}>Cancel</Button>
                        <Button type="submit" form="create-course-form" loading={creating} disabled={!courseName.trim()}>Create course</Button>
                    </>
                }
            >
                <form id="create-course-form" onSubmit={handleCreateCourse}>
                    <Field label="Course name" htmlFor="courseName" required>
                        <input id="courseName" value={courseName} onChange={e => setCourseName(e.target.value)} placeholder="e.g. Data Structures" className={inputClass} autoFocus maxLength={120} />
                    </Field>
                </form>
            </Modal>
        </AppLayout>
    );
}

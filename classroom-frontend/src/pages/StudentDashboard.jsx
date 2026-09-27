import { useContext, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import toast from "react-hot-toast";
import { AlertCircle, Award, BookOpen, Calendar, CheckCircle2, ChevronRight, ClipboardList, Clock, Upload } from "lucide-react";
import { UserContext } from "../context/ContextProvider";
import AppLayout from "../components/AppLayout";
import { Badge, Card, EmptyState, GradeBadge, PageLoader, StatCard, StatusBadge, Table, Tabs, Td, Th } from "../components/ui";
import { API, apiError } from "../lib/api";
import { formatDate } from "../lib/format";

const statusOrder = { overdue: 0, pending: 1, submitted: 2, graded: 3 };

export default function StudentDashboard() {
    const { user } = useContext(UserContext);
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState("courses");
    const [courses, setCourses] = useState([]);
    const [submissions, setSubmissions] = useState([]);
    const [loadingData, setLoadingData] = useState(true);

    useEffect(() => {
        if (!user?.id) return;
        const fetchData = async () => {
            try {
                const [courseRes, submissionsRes] = await Promise.all([
                    axios.get(`${API}/student/getCourses/${user.id}`),
                    axios.get(`${API}/student/submissions/${user.id}`)
                ]);
                setCourses(courseRes.data.courses || []);
                setSubmissions(submissionsRes.data.submissions || []);
            } catch (err) {
                toast.error(apiError(err, "There was an error loading your courses"));
            } finally {
                setLoadingData(false);
            }
        };
        fetchData();
    }, [user?.id]);

    const assignments = useMemo(() => courses
        .flatMap(course => (course.assignments || []).map(assignment => ({ ...assignment, courseName: course.name, courseId: course._id })))
        .sort((a, b) => (statusOrder[a.status] - statusOrder[b.status]) || (new Date(a.dueDate || 0) - new Date(b.dueDate || 0))),
    [courses]);

    const graded = submissions.filter(s => s.status === "graded");
    const awaiting = submissions.filter(s => s.status !== "graded");
    const todo = assignments.filter(a => a.status === "pending" || a.status === "overdue");
    const averageScore = graded.length
        ? Math.round(graded.reduce((sum, s) => sum + (s.assignment?.marks ? (s.marks / s.assignment.marks) * 100 : 0), 0) / graded.length)
        : null;

    return (
        <AppLayout eyebrow="Student dashboard" title={`Welcome back, ${user.name.split(" ")[0]}`} subtitle="Keep track of your courses, deadlines and grades.">
            <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
                <StatCard label="Courses" value={courses.length} icon={BookOpen} />
                <StatCard label="To do" value={todo.length} icon={AlertCircle} tone="yellow" />
                <StatCard label="Awaiting grade" value={awaiting.length} icon={Clock} tone="blue" />
                <StatCard label="Average score" value={averageScore === null ? "—" : `${averageScore}%`} icon={Award} tone="green" />
            </div>

            <div className="mb-5">
                <Tabs
                    active={activeTab}
                    onChange={setActiveTab}
                    tabs={[
                        { id: "courses", label: "Courses", icon: BookOpen, count: courses.length },
                        { id: "assignments", label: "Assignments", icon: ClipboardList, count: assignments.length },
                        { id: "submissions", label: "Submissions", icon: Upload, count: submissions.length }
                    ]}
                />
            </div>

            {loadingData ? <PageLoader /> : (
                <>
                    {activeTab === "courses" && (
                        courses.length === 0 ? (
                            <EmptyState icon={BookOpen} title="You’re not enrolled in any courses yet" description="Your faculty can add you using the email you signed up with." />
                        ) : (
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                                {courses.map(course => {
                                    const open = (course.assignments || []).filter(a => a.status === "pending" || a.status === "overdue").length;
                                    return (
                                        <Card
                                            key={course._id}
                                            role="button"
                                            tabIndex={0}
                                            onClick={() => navigate(`/student/courses/${course._id}`)}
                                            onKeyDown={e => e.key === "Enter" && navigate(`/student/courses/${course._id}`)}
                                            className="group cursor-pointer p-5 transition hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md"
                                        >
                                            <div className="mb-4 flex items-start justify-between">
                                                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 text-white">
                                                    <BookOpen className="h-5 w-5" />
                                                </div>
                                                {open > 0 ? <Badge tone="yellow">{open} to do</Badge> : <ChevronRight className="h-5 w-5 text-slate-300 transition group-hover:text-indigo-500" />}
                                            </div>
                                            <h3 className="truncate text-base font-semibold text-slate-900">{course.name}</h3>
                                            <p className="mt-1 truncate text-sm text-slate-500">{course.faculty?.name ? `Prof. ${course.faculty.name}` : "—"}</p>
                                            <p className="mt-3 flex items-center gap-1.5 text-sm text-slate-500"><ClipboardList className="h-4 w-4" />{course.assignments?.length || 0} assignments</p>
                                        </Card>
                                    );
                                })}
                            </div>
                        )
                    )}

                    {activeTab === "assignments" && (
                        assignments.length === 0 ? (
                            <EmptyState icon={ClipboardList} title="No assignments yet" description="Assignments from your courses will appear here." />
                        ) : (
                            <Table>
                                <thead><tr><Th>Assignment</Th><Th>Course</Th><Th>Due</Th><Th>Status</Th></tr></thead>
                                <tbody className="divide-y divide-slate-100 bg-white">
                                    {assignments.map(assignment => (
                                        <tr key={assignment._id} className="cursor-pointer hover:bg-slate-50" onClick={() => navigate(`/student/courses/${assignment.courseId}`)}>
                                            <Td className="font-medium text-slate-900">{assignment.title}</Td>
                                            <Td>{assignment.courseName}</Td>
                                            <Td className="whitespace-nowrap"><span className="flex items-center gap-1.5"><Calendar className="h-4 w-4 text-slate-400" />{formatDate(assignment.dueDate)}</span></Td>
                                            <Td><StatusBadge status={assignment.status} /></Td>
                                        </tr>
                                    ))}
                                </tbody>
                            </Table>
                        )
                    )}

                    {activeTab === "submissions" && (
                        submissions.length === 0 ? (
                            <EmptyState icon={Upload} title="No submissions yet" description="Open a course and submit your first assignment." />
                        ) : (
                            <div className="space-y-8">
                                <section>
                                    <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-slate-900"><CheckCircle2 className="h-5 w-5 text-emerald-500" />Graded</h2>
                                    {graded.length === 0 ? (
                                        <p className="rounded-lg bg-white px-4 py-3 text-sm text-slate-500 ring-1 ring-slate-200">No graded submissions yet.</p>
                                    ) : (
                                        <Table>
                                            <thead><tr><Th>Assignment</Th><Th>Course</Th><Th>Submitted</Th><Th>Grade</Th><Th>Grader</Th><Th>Feedback</Th></tr></thead>
                                            <tbody className="divide-y divide-slate-100 bg-white">
                                                {graded.map(submission => (
                                                    <tr key={submission._id} className="hover:bg-slate-50">
                                                        <Td className="font-medium text-slate-900">{submission.assignment?.title || "—"}</Td>
                                                        <Td>{submission.assignment?.course?.name || "—"}</Td>
                                                        <Td className="whitespace-nowrap">{formatDate(submission.submittedDate)}</Td>
                                                        <Td className="whitespace-nowrap">
                                                            <div className="flex items-center gap-2">
                                                                <GradeBadge grade={submission.grade} />
                                                                <span className="text-xs text-slate-500">{submission.marks}/{submission.assignment?.marks ?? "—"}</span>
                                                            </div>
                                                        </Td>
                                                        <Td>{submission.gradedBy?.name || "—"}</Td>
                                                        <Td className="max-w-xs"><p className="truncate" title={submission.feedback}>{submission.feedback || "—"}</p></Td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </Table>
                                    )}
                                </section>

                                <section>
                                    <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-slate-900"><Clock className="h-5 w-5 text-amber-500" />Awaiting grade</h2>
                                    {awaiting.length === 0 ? (
                                        <p className="rounded-lg bg-white px-4 py-3 text-sm text-slate-500 ring-1 ring-slate-200">Nothing waiting on a grade.</p>
                                    ) : (
                                        <Table>
                                            <thead><tr><Th>Assignment</Th><Th>Course</Th><Th>Submitted</Th><Th>Max marks</Th><Th>Status</Th></tr></thead>
                                            <tbody className="divide-y divide-slate-100 bg-white">
                                                {awaiting.map(submission => (
                                                    <tr key={submission._id} className="hover:bg-slate-50">
                                                        <Td>
                                                            <p className="font-medium text-slate-900">{submission.assignment?.title || "—"}</p>
                                                            <a href={submission.url} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-600 hover:underline">{submission.filename}</a>
                                                        </Td>
                                                        <Td>{submission.assignment?.course?.name || "—"}</Td>
                                                        <Td className="whitespace-nowrap">{formatDate(submission.submittedDate)}</Td>
                                                        <Td>{submission.assignment?.marks ?? "—"}</Td>
                                                        <Td>{submission.status === "overdue" ? <Badge tone="orange">Submitted late</Badge> : <Badge tone="blue">Under review</Badge>}</Td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </Table>
                                    )}
                                </section>
                            </div>
                        )
                    )}
                </>
            )}
        </AppLayout>
    );
}

import { useContext, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import toast from "react-hot-toast";
import { BookOpen, Calendar, CheckCircle2, ChevronRight, ClipboardList, Inbox, Users } from "lucide-react";
import { UserContext } from "../context/ContextProvider";
import AppLayout from "../components/AppLayout";
import { Card, EmptyState, GradeBadge, PageLoader, ProgressBar, StatCard, Table, Tabs, Td, Th } from "../components/ui";
import { API, apiError } from "../lib/api";
import { countUngradedLatest, formatDate, percent, uniqueStudentCount } from "../lib/format";

export default function TADashboard() {
    const { user } = useContext(UserContext);
    const navigate = useNavigate();
    const [courses, setCourses] = useState([]);
    const [checkedSolutions, setCheckedSolutions] = useState([]);
    const [activeTab, setActiveTab] = useState("courses");
    const [loadingData, setLoadingData] = useState(true);

    useEffect(() => {
        if (!user?.id) return;
        const fetchData = async () => {
            try {
                const [courseRes, checkedRes] = await Promise.all([
                    axios.get(`${API}/ta/getCourses/${user.id}`),
                    axios.get(`${API}/ta/getCheckedSolutions/${user.id}`)
                ]);
                setCourses(courseRes.data.courses || []);
                setCheckedSolutions(checkedRes.data.checkedSolutions || []);
            } catch (err) {
                toast.error(apiError(err, "Error loading your courses"));
            } finally {
                setLoadingData(false);
            }
        };
        fetchData();
    }, [user?.id]);

    const assignments = useMemo(() => courses.flatMap(course =>
        (course.assignments || []).map(assignment => ({ ...assignment, courseId: course._id, courseName: course.name, studentCount: course.students?.length || 0 }))
    ), [courses]);

    const toGrade = assignments.reduce((sum, assignment) => sum + countUngradedLatest(assignment.submissions), 0);

    return (
        <AppLayout eyebrow="Teaching assistant" title={`Welcome back, ${user.name.split(" ")[0]}`} subtitle="Your courses and grading queue at a glance.">
            <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
                <StatCard label="Courses" value={courses.length} icon={BookOpen} />
                <StatCard label="Assignments" value={assignments.length} icon={ClipboardList} tone="purple" />
                <StatCard label="Awaiting grading" value={toGrade} icon={Inbox} tone="yellow" />
                <StatCard label="Graded by you" value={checkedSolutions.length} icon={CheckCircle2} tone="green" />
            </div>

            <div className="mb-5">
                <Tabs
                    active={activeTab}
                    onChange={setActiveTab}
                    tabs={[
                        { id: "courses", label: "My courses", icon: BookOpen, count: courses.length },
                        { id: "assignments", label: "Assignments", icon: ClipboardList, count: assignments.length },
                        { id: "solutions", label: "Graded by me", icon: CheckCircle2, count: checkedSolutions.length }
                    ]}
                />
            </div>

            {loadingData ? <PageLoader /> : (
                <>
                    {activeTab === "courses" && (
                        courses.length === 0 ? (
                            <EmptyState icon={BookOpen} title="No courses yet" description="Ask your faculty to add you to a course using your Gradely email." />
                        ) : (
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                                {courses.map(course => (
                                    <Card
                                        key={course._id}
                                        role="button"
                                        tabIndex={0}
                                        onClick={() => navigate(`/ta/courses/${course._id}`)}
                                        onKeyDown={e => e.key === "Enter" && navigate(`/ta/courses/${course._id}`)}
                                        className="group cursor-pointer p-5 transition hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md"
                                    >
                                        <div className="mb-4 flex items-start justify-between">
                                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-sky-500 to-indigo-600 text-white">
                                                <BookOpen className="h-5 w-5" />
                                            </div>
                                            <ChevronRight className="h-5 w-5 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-indigo-500" />
                                        </div>
                                        <h3 className="truncate text-base font-semibold text-slate-900">{course.name}</h3>
                                        <p className="mt-1 truncate text-sm text-slate-500">{course.faculty?.name ? `Prof. ${course.faculty.name}` : "—"}</p>
                                        <div className="mt-3 flex gap-4 text-sm text-slate-500">
                                            <span className="flex items-center gap-1.5"><Users className="h-4 w-4" />{course.students?.length || 0} students</span>
                                            <span className="flex items-center gap-1.5"><ClipboardList className="h-4 w-4" />{course.assignments?.length || 0} assignments</span>
                                        </div>
                                    </Card>
                                ))}
                            </div>
                        )
                    )}

                    {activeTab === "assignments" && (
                        assignments.length === 0 ? (
                            <EmptyState icon={ClipboardList} title="No assignments yet" description="Assignments published in your courses will appear here." />
                        ) : (
                            <Table>
                                <thead><tr><Th>Assignment</Th><Th>Course</Th><Th>Due</Th><Th className="w-48">Submitted</Th></tr></thead>
                                <tbody className="divide-y divide-slate-100 bg-white">
                                    {assignments.map(assignment => {
                                        const submitted = uniqueStudentCount(assignment.submissions);
                                        return (
                                            <tr key={assignment._id} className="cursor-pointer hover:bg-slate-50" onClick={() => navigate(`/ta/courses/${assignment.courseId}`)}>
                                                <Td className="font-medium text-slate-900">{assignment.title}</Td>
                                                <Td>{assignment.courseName}</Td>
                                                <Td className="whitespace-nowrap"><span className="flex items-center gap-1.5"><Calendar className="h-4 w-4 text-slate-400" />{formatDate(assignment.dueDate)}</span></Td>
                                                <Td><ProgressBar value={percent(submitted, assignment.studentCount)} label={`${submitted} of ${assignment.studentCount} students`} /></Td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </Table>
                        )
                    )}

                    {activeTab === "solutions" && (
                        checkedSolutions.length === 0 ? (
                            <EmptyState icon={CheckCircle2} title="Nothing graded yet" description="Submissions you grade will be listed here." />
                        ) : (
                            <Table>
                                <thead><tr><Th>Student</Th><Th>Assignment</Th><Th>Course</Th><Th>Grade</Th><Th>Graded</Th><Th>Feedback</Th></tr></thead>
                                <tbody className="divide-y divide-slate-100 bg-white">
                                    {checkedSolutions.map(solution => (
                                        <tr key={solution._id} className="hover:bg-slate-50">
                                            <Td className="font-medium text-slate-900">{solution.student?.name || "—"}</Td>
                                            <Td>{solution.assignment?.title || "—"}</Td>
                                            <Td>{solution.assignment?.course?.name || "—"}</Td>
                                            <Td className="whitespace-nowrap">
                                                <div className="flex items-center gap-2">
                                                    <GradeBadge grade={solution.grade} />
                                                    <span className="text-xs text-slate-500">{solution.marks}/{solution.assignment?.marks ?? "—"}</span>
                                                </div>
                                            </Td>
                                            <Td className="whitespace-nowrap">{formatDate(solution.checkedDate)}</Td>
                                            <Td className="max-w-xs"><p className="truncate" title={solution.feedback}>{solution.feedback || "—"}</p></Td>
                                        </tr>
                                    ))}
                                </tbody>
                            </Table>
                        )
                    )}
                </>
            )}
        </AppLayout>
    );
}

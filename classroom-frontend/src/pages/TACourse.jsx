import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import toast from "react-hot-toast";
import { AlertTriangle, Calendar, CheckCircle2, ClipboardList, Clock, Eye } from "lucide-react";
import AppLayout from "../components/AppLayout";
import Participants from "../components/Participants";
import { GradedTable, ReevaluationList, ToGradeTable } from "../components/Grading";
import { Card, EmptyState, PageLoader, PdfModal, ProgressBar, Tabs } from "../components/ui";
import { API, apiError } from "../lib/api";
import { dueLabel, flattenSubmissions, isPastDue, percent } from "../lib/format";
import { useGradeNavigation } from "../lib/hooks";

export default function TACourse() {
    const navigate = useNavigate();
    const { courseId } = useParams();
    const gradeSubmission = useGradeNavigation("ta");

    const [course, setCourse] = useState(null);
    const [assignments, setAssignments] = useState([]);
    const [activeTab, setActiveTab] = useState("toGrade");
    const [pdfUrl, setPdfUrl] = useState("");

    const fetchCourse = useCallback(async () => {
        const [courseRes, assignmentRes] = await Promise.all([
            axios.get(`${API}/course/getTA/${courseId}`),
            axios.get(`${API}/course/getAssignments/${courseId}`)
        ]);
        setCourse(courseRes.data);
        setAssignments(assignmentRes.data.assignments || []);
    }, [courseId]);

    useEffect(() => {
        fetchCourse().catch(err => {
            const status = err.response?.status;
            if (status === 401) navigate("/login", { replace: true });
            else if (status === 403) navigate("/unauthorized", { replace: true });
            else if (status === 404) navigate("/ta", { replace: true });
            toast.error(apiError(err, "Unable to load this course"));
        });
    }, [fetchCourse, navigate]);

    const gradedSubmissions = useMemo(() => flattenSubmissions(assignments, "gradedSubmissions"), [assignments]);
    const ungradedSubmissions = useMemo(() => flattenSubmissions(assignments, "ungradedSubmissions"), [assignments]);
    const reevalRequests = gradedSubmissions.filter(s => s.reevalStatus === "pending");

    if (!course) {
        return <AppLayout backTo="/ta" backLabel="All courses"><PageLoader label="Loading course..." /></AppLayout>;
    }

    const students = course.students || [];

    return (
        <AppLayout
            backTo="/ta"
            backLabel="All courses"
            eyebrow="Teaching assistant view"
            title={course.name}
            subtitle={`${course.faculty?.name ? `Prof. ${course.faculty.name} · ` : ""}${students.length} students · ${assignments.length} assignments`}
        >
            <div className="flex gap-6">
                <div className="min-w-0 flex-1">
                    <div className="mb-5">
                        <Tabs
                            active={activeTab}
                            onChange={setActiveTab}
                            tabs={[
                                { id: "toGrade", label: "To grade", icon: Clock, count: ungradedSubmissions.length },
                                { id: "graded", label: "Graded", icon: CheckCircle2, count: gradedSubmissions.length },
                                { id: "reeval", label: "Re-evaluation", icon: AlertTriangle, count: reevalRequests.length },
                                { id: "assignments", label: "Assignments", icon: ClipboardList, count: assignments.length }
                            ]}
                        />
                    </div>

                    {activeTab === "toGrade" && <ToGradeTable submissions={ungradedSubmissions} onGrade={gradeSubmission} />}
                    {activeTab === "graded" && <GradedTable submissions={gradedSubmissions} onGrade={gradeSubmission} />}
                    {activeTab === "reeval" && <ReevaluationList submissions={reevalRequests} onGrade={gradeSubmission} onChanged={fetchCourse} />}

                    {activeTab === "assignments" && (
                        assignments.length === 0 ? (
                            <EmptyState icon={ClipboardList} title="No assignments yet" description="The course faculty hasn’t published any assignments." />
                        ) : (
                            <div className="space-y-3">
                                {assignments.map(assignment => {
                                    const submitted = (assignment.gradedSubmissions?.length || 0) + (assignment.ungradedSubmissions?.length || 0);
                                    return (
                                        <Card key={assignment._id} className="p-5">
                                            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                                                <div className="min-w-0 flex-1">
                                                    <h3 className="font-semibold text-slate-900">{assignment.title}</h3>
                                                    {assignment.description && <p className="mt-1 line-clamp-2 text-sm text-slate-600">{assignment.description}</p>}
                                                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500">
                                                        <span className={`flex items-center gap-1.5 ${isPastDue(assignment.dueDate) ? "text-rose-600" : ""}`}>
                                                            <Calendar className="h-4 w-4" />{dueLabel(assignment.dueDate)}
                                                        </span>
                                                        <span>{assignment.marks} pts</span>
                                                        {assignment.url && (
                                                            <button type="button" onClick={() => setPdfUrl(assignment.url)} className="flex items-center gap-1.5 font-medium text-indigo-600 hover:text-indigo-700">
                                                                <Eye className="h-4 w-4" />View PDF
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="w-full md:w-48">
                                                    <ProgressBar value={percent(submitted, students.length)} label={`${submitted} of ${students.length} submitted`} />
                                                </div>
                                            </div>
                                        </Card>
                                    );
                                })}
                            </div>
                        )
                    )}
                </div>

                <Participants faculty={course.faculty} tas={course.tas || []} students={students} />
            </div>

            <PdfModal url={pdfUrl} title="Assignment PDF" onClose={() => setPdfUrl("")} />
        </AppLayout>
    );
}

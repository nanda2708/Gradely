import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import toast from "react-hot-toast";
import { AlertTriangle, Calendar, CheckCircle2, ClipboardList, Clock, Eye, FileText, Paperclip, RefreshCw, Send, Trash2, Upload, User } from "lucide-react";
import { UserContext } from "../context/ContextProvider";
import AppLayout from "../components/AppLayout";
import Participants from "../components/Participants";
import { Badge, Button, Card, EmptyState, Field, GradeBadge, Modal, PageLoader, PdfModal, StatusBadge, Tabs, inputClass } from "../components/ui";
import { API, apiError } from "../lib/api";
import { dueLabel, formatDate, isPastDue } from "../lib/format";

const MAX_FILE_BYTES = 15 * 1024 * 1024;

const reevalBadge = (submission) => {
    if (submission.reevalStatus === "pending") return <Badge tone="orange" icon={RefreshCw}>Re-evaluation pending</Badge>;
    if (submission.reevalStatus === "resolved") return <Badge tone="green">Re-evaluated</Badge>;
    if (submission.reevalStatus === "rejected") return <Badge tone="gray">Re-evaluation declined</Badge>;
    return null;
};

export default function StudentCourse() {
    const { user } = useContext(UserContext);
    const navigate = useNavigate();
    const { courseId } = useParams();

    const [course, setCourse] = useState(null);
    const [assignments, setAssignments] = useState([]);
    const [submissions, setSubmissions] = useState([]);
    const [activeTab, setActiveTab] = useState("assignments");
    const [pdfUrl, setPdfUrl] = useState("");

    const [selectedAssignment, setSelectedAssignment] = useState(null);
    const [file, setFile] = useState(null);
    const [uploading, setUploading] = useState(false);

    const [reevalTarget, setReevalTarget] = useState(null);
    const [reevalReason, setReevalReason] = useState("");
    const [requestingReeval, setRequestingReeval] = useState(false);

    const fetchCourse = useCallback(async () => {
        const [courseRes, assignmentRes, submissionRes] = await Promise.all([
            axios.get(`${API}/course/getStudent/${courseId}`),
            axios.get(`${API}/course/getAssignments/${courseId}`),
            axios.get(`${API}/student/${user.id}/course/${courseId}/submissions`)
        ]);
        setCourse(courseRes.data);
        setAssignments(assignmentRes.data.assignments || []);
        setSubmissions(submissionRes.data.submissions || []);
    }, [courseId, user.id]);

    useEffect(() => {
        fetchCourse().catch(err => {
            const status = err.response?.status;
            if (status === 401) navigate("/login", { replace: true });
            else if (status === 403) navigate("/unauthorized", { replace: true });
            else if (status === 404) navigate("/student", { replace: true });
            toast.error(apiError(err, "Unable to load this course"));
        });
    }, [fetchCourse, navigate]);

    // Submissions arrive newest first, so the first match is the latest attempt.
    const assignmentsWithStatus = useMemo(() => assignments.map(assignment => {
        const latest = submissions.find(s => (s.assignment?._id || s.assignment) === assignment._id);
        let status = isPastDue(assignment.dueDate) ? "overdue" : "pending";
        if (latest) status = latest.status === "graded" ? "graded" : "submitted";
        return { ...assignment, status, latest };
    }), [assignments, submissions]);

    const todo = assignmentsWithStatus.filter(a => a.status === "pending" || a.status === "overdue");
    const graded = submissions.filter(s => s.status === "graded");
    const awaiting = submissions.filter(s => s.status !== "graded");

    const openSubmit = (assignment) => {
        setSelectedAssignment(assignment);
        setFile(null);
    };

    const closeSubmit = () => {
        if (uploading) return;
        setSelectedAssignment(null);
        setFile(null);
    };

    const handleFileSelect = (event) => {
        const picked = event.target.files?.[0];
        event.target.value = "";
        if (!picked) return;
        if (picked.type !== "application/pdf") {
            toast.error("Please upload your solution as a PDF.");
            return;
        }
        if (picked.size > MAX_FILE_BYTES) {
            toast.error("File must be 15 MB or smaller.");
            return;
        }
        setFile(picked);
    };

    const handleSubmitSolution = async () => {
        if (!file || !selectedAssignment || uploading) return;
        setUploading(true);
        try {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("upload_preset", "gradely-submissions");
            const { data: upload } = await axios.post(`${API}/upload/file`, formData);

            await axios.post(`${API}/submission/submitSolution`, {
                filename: file.name,
                url: upload.secure_url,
                publicId: upload.public_id,
                assignmentId: selectedAssignment._id,
                studentId: user.id
            });

            toast.success("Submission received");
            setSelectedAssignment(null);
            setFile(null);
            await fetchCourse();
        } catch (err) {
            toast.error(apiError(err, "Failed to submit. Please try again."));
        } finally {
            setUploading(false);
        }
    };

    const closeReeval = () => {
        setReevalTarget(null);
        setReevalReason("");
    };

    const handleRequestReeval = async () => {
        if (!reevalReason.trim() || !reevalTarget) return;
        setRequestingReeval(true);
        try {
            await axios.post(`${API}/submission/requestReevaluation/${reevalTarget._id}`, { reason: reevalReason.trim() });
            toast.success("Re-evaluation requested");
            closeReeval();
            await fetchCourse();
        } catch (err) {
            toast.error(apiError(err, "Unable to request re-evaluation"));
        } finally {
            setRequestingReeval(false);
        }
    };

    if (!course) {
        return <AppLayout backTo="/student" backLabel="All courses"><PageLoader label="Loading course..." /></AppLayout>;
    }

    const renderAssignment = (assignment) => {
        const overdue = assignment.status === "overdue";
        const submitLabel = assignment.latest ? "Resubmit" : overdue ? "Submit late" : "Submit";
        return (
            <Card key={assignment._id} className="p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-semibold text-slate-900">{assignment.title}</h3>
                            <StatusBadge status={assignment.status} />
                        </div>
                        {assignment.description && <p className="mt-1 text-sm text-slate-600">{assignment.description}</p>}
                        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500">
                            <span className={`flex items-center gap-1.5 ${overdue ? "text-rose-600" : ""}`}><Calendar className="h-4 w-4" />{dueLabel(assignment.dueDate)}</span>
                            <span>{assignment.marks} pts</span>
                            {assignment.latest?.status === "graded" && (
                                <span className="flex items-center gap-1.5">Score <GradeBadge grade={assignment.latest.grade} />{assignment.latest.marks}/{assignment.marks}</span>
                            )}
                            {assignment.url && (
                                <button type="button" onClick={() => setPdfUrl(assignment.url)} className="flex items-center gap-1.5 font-medium text-indigo-600 hover:text-indigo-700">
                                    <Eye className="h-4 w-4" />View PDF
                                </button>
                            )}
                        </div>
                    </div>
                    <Button
                        size="sm"
                        variant={assignment.latest ? "secondary" : overdue ? "danger" : "primary"}
                        onClick={() => openSubmit(assignment)}
                        className="shrink-0"
                    >
                        <Send className="h-3.5 w-3.5" />
                        {submitLabel}
                    </Button>
                </div>
            </Card>
        );
    };

    return (
        <AppLayout
            backTo="/student"
            backLabel="All courses"
            eyebrow="Course"
            title={course.name}
            subtitle={course.faculty?.name ? `Prof. ${course.faculty.name}` : undefined}
        >
            <div className="flex gap-6">
                <div className="min-w-0 flex-1">
                    <div className="mb-5">
                        <Tabs
                            active={activeTab}
                            onChange={setActiveTab}
                            tabs={[
                                { id: "assignments", label: "Assignments", icon: ClipboardList, count: assignments.length },
                                { id: "todo", label: "To do", icon: Clock, count: todo.length },
                                { id: "submissions", label: "My submissions", icon: Upload, count: submissions.length }
                            ]}
                        />
                    </div>

                    {activeTab === "assignments" && (
                        assignmentsWithStatus.length === 0
                            ? <EmptyState icon={ClipboardList} title="No assignments yet" description="Your faculty hasn’t published any assignments in this course." />
                            : <div className="space-y-3">{assignmentsWithStatus.map(renderAssignment)}</div>
                    )}

                    {activeTab === "todo" && (
                        todo.length === 0
                            ? <EmptyState icon={CheckCircle2} title="All done!" description="You’ve submitted every assignment in this course." />
                            : <div className="space-y-3">{todo.map(renderAssignment)}</div>
                    )}

                    {activeTab === "submissions" && (
                        submissions.length === 0 ? (
                            <EmptyState icon={Upload} title="No submissions yet" description="Submit an assignment to see it here." />
                        ) : (
                            <div className="space-y-8">
                                <section>
                                    <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-slate-900"><CheckCircle2 className="h-5 w-5 text-emerald-500" />Graded</h2>
                                    {graded.length === 0 ? (
                                        <p className="rounded-lg bg-white px-4 py-3 text-sm text-slate-500 ring-1 ring-slate-200">No graded submissions yet.</p>
                                    ) : (
                                        <div className="space-y-3">
                                            {graded.map(submission => (
                                                <Card key={submission._id} className="p-5">
                                                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                                                        <div className="min-w-0 flex-1">
                                                            <div className="flex flex-wrap items-center gap-2">
                                                                <h3 className="font-semibold text-slate-900">{submission.assignment?.title}</h3>
                                                                <GradeBadge grade={submission.grade} />
                                                                <span className="text-sm font-medium text-slate-700">{submission.marks}/{submission.assignment?.marks}</span>
                                                                {reevalBadge(submission)}
                                                            </div>
                                                            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">
                                                                <a href={submission.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-indigo-600 hover:underline"><FileText className="h-4 w-4" />{submission.filename}</a>
                                                                <span className="flex items-center gap-1.5"><Calendar className="h-4 w-4" />Submitted {formatDate(submission.submittedDate)}</span>
                                                                <span className="flex items-center gap-1.5"><User className="h-4 w-4" />Graded by {submission.gradedBy?.name || "—"}</span>
                                                            </div>
                                                            {submission.feedback && (
                                                                <div className="mt-3 rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-700">
                                                                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Feedback</p>
                                                                    {submission.feedback}
                                                                </div>
                                                            )}
                                                            {submission.reevalStatus === "rejected" && submission.reevalResponse && (
                                                                <div className="mt-3 rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-700">
                                                                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Re-evaluation response</p>
                                                                    {submission.reevalResponse}
                                                                </div>
                                                            )}
                                                        </div>
                                                        {submission.reevalStatus !== "pending" && (
                                                            <Button size="sm" variant="secondary" className="shrink-0" onClick={() => setReevalTarget(submission)}>
                                                                <RefreshCw className="h-3.5 w-3.5" />
                                                                Request re-evaluation
                                                            </Button>
                                                        )}
                                                    </div>
                                                </Card>
                                            ))}
                                        </div>
                                    )}
                                </section>

                                <section>
                                    <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-slate-900"><Clock className="h-5 w-5 text-amber-500" />Awaiting grade</h2>
                                    {awaiting.length === 0 ? (
                                        <p className="rounded-lg bg-white px-4 py-3 text-sm text-slate-500 ring-1 ring-slate-200">Nothing waiting on a grade.</p>
                                    ) : (
                                        <div className="space-y-3">
                                            {awaiting.map(submission => (
                                                <Card key={submission._id} className="flex flex-col gap-2 p-5 sm:flex-row sm:items-center sm:justify-between">
                                                    <div className="min-w-0">
                                                        <h3 className="font-semibold text-slate-900">{submission.assignment?.title}</h3>
                                                        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">
                                                            <button type="button" onClick={() => setPdfUrl(submission.url)} className="flex items-center gap-1.5 text-indigo-600 hover:underline"><FileText className="h-4 w-4" />{submission.filename}</button>
                                                            <span className="flex items-center gap-1.5"><Calendar className="h-4 w-4" />Submitted {formatDate(submission.submittedDate)}</span>
                                                        </div>
                                                    </div>
                                                    {submission.status === "overdue" ? <Badge tone="orange">Submitted late</Badge> : <Badge tone="blue">Under review</Badge>}
                                                </Card>
                                            ))}
                                        </div>
                                    )}
                                </section>
                            </div>
                        )
                    )}
                </div>

                <Participants faculty={course.faculty} tas={course.tas || []} students={course.students || []} />
            </div>

            <PdfModal url={pdfUrl} title="Document" onClose={() => setPdfUrl("")} />

            <Modal
                open={Boolean(selectedAssignment)}
                onClose={closeSubmit}
                title={selectedAssignment?.latest ? "Resubmit assignment" : "Submit assignment"}
                description={selectedAssignment?.title}
                footer={
                    <>
                        <Button variant="secondary" onClick={closeSubmit} disabled={uploading}>Cancel</Button>
                        <Button onClick={handleSubmitSolution} loading={uploading} disabled={!file}>
                            {uploading ? "Uploading..." : selectedAssignment?.latest ? "Resubmit" : "Submit"}
                        </Button>
                    </>
                }
            >
                {selectedAssignment && (
                    <div className="space-y-4">
                        <div className="flex flex-wrap gap-x-4 gap-y-1 rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-600">
                            <span className="flex items-center gap-1.5"><Calendar className="h-4 w-4" />{dueLabel(selectedAssignment.dueDate)}</span>
                            <span>{selectedAssignment.marks} pts</span>
                        </div>

                        <Field label="Your solution" required hint="PDF only · up to 15 MB">
                            {file ? (
                                <div className="flex items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                                    <span className="flex min-w-0 items-center gap-2"><FileText className="h-4 w-4 shrink-0" /><span className="truncate">{file.name}</span></span>
                                    <button type="button" onClick={() => setFile(null)} disabled={uploading} className="text-emerald-700 hover:text-rose-600" aria-label="Remove file">
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </div>
                            ) : (
                                <label htmlFor="submissionFile" className="flex cursor-pointer flex-col items-center gap-1 rounded-lg border-2 border-dashed border-slate-200 px-3 py-8 text-center transition hover:border-indigo-300 hover:bg-indigo-50/40">
                                    <Paperclip className="h-6 w-6 text-slate-400" />
                                    <span className="text-sm font-medium text-slate-700">Click to choose a PDF</span>
                                </label>
                            )}
                            <input id="submissionFile" type="file" accept="application/pdf,.pdf" onChange={handleFileSelect} className="hidden" />
                        </Field>

                        {selectedAssignment.latest && (
                            <p className="flex gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
                                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                                Your latest submission will be the one that gets graded.
                            </p>
                        )}
                        {!selectedAssignment.latest && isPastDue(selectedAssignment.dueDate) && (
                            <p className="flex gap-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
                                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                                This assignment is past due. It will be marked as a late submission.
                            </p>
                        )}
                    </div>
                )}
            </Modal>

            <Modal
                open={Boolean(reevalTarget)}
                onClose={closeReeval}
                title="Request re-evaluation"
                description={reevalTarget ? `${reevalTarget.assignment?.title} · current grade ${reevalTarget.grade} (${reevalTarget.marks}/${reevalTarget.assignment?.marks})` : undefined}
                footer={
                    <>
                        <Button variant="secondary" onClick={closeReeval}>Cancel</Button>
                        <Button onClick={handleRequestReeval} loading={requestingReeval} disabled={!reevalReason.trim()}>Send request</Button>
                    </>
                }
            >
                <Field label="Why should this be re-evaluated?" htmlFor="reevalReason" required hint={`Be specific about which parts you think were marked incorrectly. ${reevalReason.length}/2000`}>
                    <textarea id="reevalReason" rows={5} maxLength={2000} value={reevalReason} onChange={e => setReevalReason(e.target.value)} className={inputClass} autoFocus />
                </Field>
            </Modal>
        </AppLayout>
    );
}

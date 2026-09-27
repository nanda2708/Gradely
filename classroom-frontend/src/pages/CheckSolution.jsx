import { useContext, useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import toast from "react-hot-toast";
import { AlertTriangle, Calendar, ExternalLink, Eye, FileText, Send, User } from "lucide-react";
import { UserContext } from "../context/ContextProvider";
import AppLayout from "../components/AppLayout";
import { Badge, Button, Card, Field, PageLoader, PdfModal, inputClass } from "../components/ui";
import { API, apiError, dashboardPath } from "../lib/api";
import { formatDate } from "../lib/format";

const GRADES = ["A+", "A", "A-", "B+", "B", "B-", "C+", "C", "C-", "D+", "D", "F"];
const MAX_FEEDBACK = 2000;

// Suggest a letter grade from the percentage score.
const suggestGrade = (marks, max) => {
    if (!(max > 0) || marks === "" || !Number.isFinite(Number(marks))) return "";
    const pct = (Number(marks) / max) * 100;
    const bands = [[97, "A+"], [93, "A"], [90, "A-"], [87, "B+"], [83, "B"], [80, "B-"], [77, "C+"], [73, "C"], [70, "C-"], [67, "D+"], [60, "D"]];
    return bands.find(([min]) => pct >= min)?.[1] || "F";
};

export default function CheckSolution() {
    const { submissionId } = useParams();
    const { user } = useContext(UserContext);
    const navigate = useNavigate();
    const location = useLocation();

    const [submission, setSubmission] = useState(null);
    const [form, setForm] = useState({ grade: "", marks: "", feedback: "" });
    const [gradeTouched, setGradeTouched] = useState(false);
    const [saving, setSaving] = useState(false);
    const [showAssignment, setShowAssignment] = useState(false);

    const returnPath = location.state?.returnPath || dashboardPath(user?.role);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const { data } = await axios.get(`${API}/submission/getSolution/${submissionId}`);
                const loaded = data.submission;
                setSubmission(loaded);
                if (loaded.status === "graded") {
                    setForm({ grade: loaded.grade || "", marks: String(loaded.marks ?? ""), feedback: loaded.feedback || "" });
                    setGradeTouched(true);
                }
            } catch (err) {
                const status = err.response?.status;
                if (status === 403) navigate("/unauthorized", { replace: true });
                toast.error(apiError(err, "Error fetching submission"));
            }
        };
        fetchData();
    }, [submissionId, navigate]);

    const assignment = submission?.assignment;
    const maxMarks = Number(assignment?.marks) || 0;

    const updateMarks = (value) => {
        setForm(current => ({
            ...current,
            marks: value,
            grade: gradeTouched ? current.grade : suggestGrade(value, maxMarks)
        }));
    };

    const handleSubmitGrade = async (event) => {
        event.preventDefault();
        const marks = Number(form.marks);
        if (!form.grade || form.marks === "") {
            toast.error("Please provide both a score and a letter grade.");
            return;
        }
        if (!Number.isFinite(marks) || marks < 0 || marks > maxMarks) {
            toast.error(`Score must be between 0 and ${maxMarks}.`);
            return;
        }

        setSaving(true);
        try {
            await axios.put(`${API}/submission/gradeSolution/${submissionId}`, {
                grade: form.grade,
                marks,
                feedback: form.feedback.trim(),
                graderId: user.id,
                graderRole: user.role
            });
            toast.success("Grade saved");
            navigate(returnPath);
        } catch (err) {
            toast.error(apiError(err, "Error grading submission"));
        } finally {
            setSaving(false);
        }
    };

    if (!submission) {
        return <AppLayout backTo={returnPath}><PageLoader label="Loading submission..." /></AppLayout>;
    }

    const late = assignment?.dueDate && new Date(submission.submittedDate) > new Date(assignment.dueDate);
    const regrading = submission.status === "graded";

    return (
        <AppLayout
            backTo={returnPath}
            backLabel="Back to course"
            eyebrow={regrading ? "Regrade submission" : "Grade submission"}
            title={assignment?.title || "Submission"}
            actions={assignment?.url && (
                <Button variant="secondary" onClick={() => setShowAssignment(true)}>
                    <Eye className="h-4 w-4" />
                    Assignment brief
                </Button>
            )}
        >
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
                <div className="space-y-4 xl:col-span-2">
                    <Card className="p-5">
                        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-slate-600">
                            <span className="flex items-center gap-1.5"><User className="h-4 w-4 text-slate-400" /><span className="font-medium text-slate-900">{submission.student?.name || "Student"}</span></span>
                            <span className="flex items-center gap-1.5"><Calendar className="h-4 w-4 text-slate-400" />Submitted {formatDate(submission.submittedDate)}</span>
                            {late && <Badge tone="red">Late</Badge>}
                            {regrading && <Badge tone="green">Graded by {submission.gradedBy?.name || "—"}</Badge>}
                            <a href={submission.url} target="_blank" rel="noopener noreferrer" className="ml-auto flex items-center gap-1.5 font-medium text-indigo-600 hover:text-indigo-700">
                                <FileText className="h-4 w-4" />{submission.filename || "Open file"}<ExternalLink className="h-3.5 w-3.5" />
                            </a>
                        </div>
                    </Card>

                    {submission.reevalStatus === "pending" && (
                        <Card className="border-orange-200 bg-orange-50/60 p-5">
                            <p className="flex items-center gap-2 text-sm font-semibold text-orange-800"><AlertTriangle className="h-4 w-4" />Re-evaluation requested {formatDate(submission.reevalRequestedAt)}</p>
                            <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{submission.reevalReason}</p>
                            <p className="mt-2 text-xs text-slate-500">Saving a grade will resolve this request.</p>
                        </Card>
                    )}

                    <Card className="overflow-hidden">
                        {submission.url ? (
                            <iframe src={submission.url} title="Student submission" className="h-[75vh] w-full" />
                        ) : (
                            <p className="p-10 text-center text-sm text-slate-500">Submission file is unavailable.</p>
                        )}
                    </Card>
                </div>

                <div>
                    <Card className="sticky top-24 p-5">
                        <h2 className="mb-5 text-base font-semibold text-slate-900">{regrading ? "Update grade" : "Grade this submission"}</h2>
                        <form onSubmit={handleSubmitGrade} className="space-y-5">
                            <Field label="Score" htmlFor="marks" required>
                                <div className="flex items-center gap-2">
                                    <input id="marks" type="number" min="0" max={maxMarks} step="0.5" value={form.marks} onChange={e => updateMarks(e.target.value)} placeholder="0" className={`${inputClass} text-lg font-semibold`} autoFocus />
                                    <span className="whitespace-nowrap text-sm text-slate-500">/ {maxMarks}</span>
                                </div>
                            </Field>

                            <Field label="Letter grade" required hint={gradeTouched ? undefined : "Suggested from the score — pick another to override."}>
                                <div className="grid grid-cols-6 gap-1.5">
                                    {GRADES.map(grade => (
                                        <button
                                            key={grade}
                                            type="button"
                                            onClick={() => { setGradeTouched(true); setForm({ ...form, grade }); }}
                                            className={`h-9 rounded-lg text-sm font-semibold transition-colors ${
                                                form.grade === grade ? "bg-indigo-600 text-white shadow-sm" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                                            }`}
                                        >
                                            {grade}
                                        </button>
                                    ))}
                                </div>
                            </Field>

                            <Field label="Feedback" htmlFor="feedback" hint={`${form.feedback.length}/${MAX_FEEDBACK}`}>
                                <textarea id="feedback" rows={7} maxLength={MAX_FEEDBACK} value={form.feedback} onChange={e => setForm({ ...form, feedback: e.target.value })} placeholder="What went well, what to improve..." className={`${inputClass} resize-y`} />
                            </Field>

                            <Button type="submit" size="lg" className="w-full" loading={saving} disabled={!form.grade || form.marks === ""}>
                                <Send className="h-4 w-4" />
                                {saving ? "Saving..." : regrading ? "Update grade" : "Submit grade"}
                            </Button>
                        </form>
                    </Card>
                </div>
            </div>

            <PdfModal url={showAssignment ? assignment?.url : ""} title="Assignment brief" onClose={() => setShowAssignment(false)} />
        </AppLayout>
    );
}

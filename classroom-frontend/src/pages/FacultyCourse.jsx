import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import toast from "react-hot-toast";
import { AlertTriangle, Calendar, CheckCircle2, ClipboardList, Clock, Eye, FileText, Paperclip, Plus, Trash2 } from "lucide-react";
import { UserContext } from "../context/ContextProvider";
import AppLayout from "../components/AppLayout";
import Participants from "../components/Participants";
import { GradedTable, ReevaluationList, ToGradeTable } from "../components/Grading";
import { Button, Card, EmptyState, Field, Modal, PageLoader, PdfModal, ProgressBar, Tabs, inputClass } from "../components/ui";
import { API, apiError } from "../lib/api";
import { dueLabel, endOfDayIso, flattenSubmissions, isPastDue, percent } from "../lib/format";
import { useGradeNavigation } from "../lib/hooks";

const emptyAssignment = { name: "", description: "", dueDate: "", maxPoints: "100", pdfFile: null };
const today = () => new Date().toISOString().slice(0, 10);

export default function FacultyCourse() {
    const navigate = useNavigate();
    const { user } = useContext(UserContext);
    const { courseId } = useParams();
    const gradeSubmission = useGradeNavigation("faculty");

    const [course, setCourse] = useState(null);
    const [assignments, setAssignments] = useState([]);
    const [activeTab, setActiveTab] = useState("assignments");
    const [pdfUrl, setPdfUrl] = useState("");

    const [showCreateModal, setShowCreateModal] = useState(false);
    const [assignmentForm, setAssignmentForm] = useState(emptyAssignment);
    const [creating, setCreating] = useState(false);

    const [participantType, setParticipantType] = useState(null);
    const [participantEmail, setParticipantEmail] = useState("");
    const [addingParticipant, setAddingParticipant] = useState(false);

    const fetchCourse = useCallback(async () => {
        const [courseRes, assignmentRes] = await Promise.all([
            axios.get(`${API}/course/getFaculty/${courseId}`),
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
            else if (status === 404) navigate("/faculty", { replace: true });
            toast.error(apiError(err, "Error fetching course"));
        });
    }, [fetchCourse, navigate]);

    const students = course?.students || [];
    const tas = course?.tas || [];
    const gradedSubmissions = useMemo(() => flattenSubmissions(assignments, "gradedSubmissions"), [assignments]);
    const ungradedSubmissions = useMemo(() => flattenSubmissions(assignments, "ungradedSubmissions"), [assignments]);
    const reevalRequests = gradedSubmissions.filter(s => s.reevalStatus === "pending");

    const closeCreate = () => {
        setAssignmentForm(emptyAssignment);
        setShowCreateModal(false);
    };

    const handleFileSelect = (event) => {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (!file) return;
        if (file.type !== "application/pdf") {
            toast.error("Please select a PDF file.");
            return;
        }
        if (file.size > 15 * 1024 * 1024) {
            toast.error("PDF must be 15 MB or smaller.");
            return;
        }
        setAssignmentForm(form => ({ ...form, pdfFile: file }));
    };

    const handleCreateAssignment = async (event) => {
        event?.preventDefault();
        const { name, description, dueDate, maxPoints, pdfFile } = assignmentForm;
        if (!name.trim() || !dueDate || !(Number(maxPoints) > 0) || creating) return;

        setCreating(true);
        try {
            let url = "";
            let publicId = "";
            if (pdfFile) {
                const formData = new FormData();
                formData.append("file", pdfFile);
                formData.append("upload_preset", "gradely-assignments");
                const { data } = await axios.post(`${API}/upload/file`, formData);
                url = data.secure_url;
                publicId = data.public_id;
            }

            await axios.post(`${API}/assignment/createAssignment`, {
                assignmentData: {
                    title: name.trim(),
                    description: description.trim(),
                    url,
                    publicId,
                    course: courseId,
                    marks: Number(maxPoints),
                    dueDate: endOfDayIso(dueDate)
                },
                courseId,
                facultyId: user.id
            });

            toast.success("Assignment published");
            closeCreate();
            await fetchCourse();
        } catch (err) {
            toast.error(apiError(err, "Failed to create assignment"));
        } finally {
            setCreating(false);
        }
    };

    const closeParticipant = () => {
        setParticipantType(null);
        setParticipantEmail("");
    };

    const handleAddParticipant = async (event) => {
        event?.preventDefault();
        const email = participantEmail.trim();
        if (!email || addingParticipant) return;

        const isTA = participantType === "ta";
        setAddingParticipant(true);
        try {
            const { data: participantId } = await axios.get(`${API}/${isTA ? "ta/getTAID" : "student/getStudentID"}`, { params: { email } });
            const { data } = await axios.post(`${API}/course/${isTA ? "addTA" : "addStudent"}`, {
                courseId,
                [isTA ? "taId" : "studentId"]: participantId
            });

            if (data?.alreadyEnrolled) toast(`${isTA ? "TA" : "Student"} is already in this course`, { icon: "ℹ️" });
            else toast.success(`${isTA ? "TA" : "Student"} added to the course`);
            closeParticipant();
            await fetchCourse();
        } catch (err) {
            if (err.response?.status === 404) {
                toast.error(`No ${isTA ? "TA" : "student"} account found for ${email}. Ask them to sign up first.`);
            } else {
                toast.error(apiError(err, "Unable to add participant"));
            }
        } finally {
            setAddingParticipant(false);
        }
    };

    if (!course) {
        return <AppLayout backTo="/faculty" backLabel="All courses"><PageLoader label="Loading course..." /></AppLayout>;
    }

    const newAssignmentButton = (
        <Button onClick={() => setShowCreateModal(true)}>
            <Plus className="h-4 w-4" />
            New assignment
        </Button>
    );

    return (
        <AppLayout
            backTo="/faculty"
            backLabel="All courses"
            eyebrow="Course management"
            title={course.name}
            subtitle={`${students.length} students · ${tas.length} TAs · ${assignments.length} assignments`}
            actions={newAssignmentButton}
        >
            <div className="flex gap-6">
                <div className="min-w-0 flex-1">
                    <div className="mb-5">
                        <Tabs
                            active={activeTab}
                            onChange={setActiveTab}
                            tabs={[
                                { id: "assignments", label: "Assignments", icon: ClipboardList, count: assignments.length },
                                { id: "toGrade", label: "To grade", icon: Clock, count: ungradedSubmissions.length },
                                { id: "graded", label: "Graded", icon: CheckCircle2, count: gradedSubmissions.length },
                                { id: "reeval", label: "Re-evaluation", icon: AlertTriangle, count: reevalRequests.length }
                            ]}
                        />
                    </div>

                    {activeTab === "assignments" && (
                        assignments.length === 0 ? (
                            <EmptyState icon={ClipboardList} title="No assignments yet" description="Publish the first assignment for this course." action={newAssignmentButton} />
                        ) : (
                            <div className="space-y-3">
                                {assignments.map(assignment => {
                                    const submitted = (assignment.gradedSubmissions?.length || 0) + (assignment.ungradedSubmissions?.length || 0);
                                    const graded = assignment.gradedSubmissions?.length || 0;
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
                                                        <span>{graded} graded</span>
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

                    {activeTab === "toGrade" && <ToGradeTable submissions={ungradedSubmissions} onGrade={gradeSubmission} />}
                    {activeTab === "graded" && <GradedTable submissions={gradedSubmissions} onGrade={gradeSubmission} />}
                    {activeTab === "reeval" && <ReevaluationList submissions={reevalRequests} onGrade={gradeSubmission} onChanged={fetchCourse} />}
                </div>

                <Participants
                    faculty={course.faculty}
                    tas={tas}
                    students={students}
                    onAddTA={() => setParticipantType("ta")}
                    onAddStudent={() => setParticipantType("student")}
                />
            </div>

            <PdfModal url={pdfUrl} title="Assignment PDF" onClose={() => setPdfUrl("")} />

            <Modal
                open={showCreateModal}
                onClose={closeCreate}
                title="New assignment"
                description="Students enrolled in this course will see it immediately."
                footer={
                    <>
                        <Button variant="secondary" onClick={closeCreate} disabled={creating}>Cancel</Button>
                        <Button
                            type="submit"
                            form="create-assignment-form"
                            loading={creating}
                            disabled={!assignmentForm.name.trim() || !assignmentForm.dueDate || !(Number(assignmentForm.maxPoints) > 0)}
                        >
                            {creating ? "Publishing..." : "Publish assignment"}
                        </Button>
                    </>
                }
            >
                <form id="create-assignment-form" onSubmit={handleCreateAssignment} className="space-y-4">
                    <Field label="Title" htmlFor="assignmentName" required>
                        <input id="assignmentName" value={assignmentForm.name} onChange={e => setAssignmentForm({ ...assignmentForm, name: e.target.value })} placeholder="e.g. Binary search trees" className={inputClass} autoFocus />
                    </Field>
                    <Field label="Description" htmlFor="assignmentDescription">
                        <textarea id="assignmentDescription" rows={3} value={assignmentForm.description} onChange={e => setAssignmentForm({ ...assignmentForm, description: e.target.value })} placeholder="Instructions, scope, submission format..." className={inputClass} />
                    </Field>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <Field label="Due date" htmlFor="assignmentDue" required hint="Due at 11:59 PM on this day.">
                            <input id="assignmentDue" type="date" min={today()} value={assignmentForm.dueDate} onChange={e => setAssignmentForm({ ...assignmentForm, dueDate: e.target.value })} className={inputClass} />
                        </Field>
                        <Field label="Max points" htmlFor="assignmentMarks" required>
                            <input id="assignmentMarks" type="number" min="1" value={assignmentForm.maxPoints} onChange={e => setAssignmentForm({ ...assignmentForm, maxPoints: e.target.value })} className={inputClass} />
                        </Field>
                    </div>
                    <Field label="Assignment PDF" hint="Optional · PDF up to 15 MB">
                        {assignmentForm.pdfFile ? (
                            <div className="flex items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                                <span className="flex min-w-0 items-center gap-2"><FileText className="h-4 w-4 shrink-0" /><span className="truncate">{assignmentForm.pdfFile.name}</span></span>
                                <button type="button" onClick={() => setAssignmentForm({ ...assignmentForm, pdfFile: null })} className="text-emerald-700 hover:text-rose-600" aria-label="Remove file">
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            </div>
                        ) : (
                            <label htmlFor="assignmentPdf" className="flex cursor-pointer flex-col items-center gap-1 rounded-lg border-2 border-dashed border-slate-200 px-3 py-6 text-center transition hover:border-indigo-300 hover:bg-indigo-50/40">
                                <Paperclip className="h-6 w-6 text-slate-400" />
                                <span className="text-sm font-medium text-slate-700">Click to attach a PDF</span>
                            </label>
                        )}
                        <input id="assignmentPdf" type="file" accept="application/pdf,.pdf" onChange={handleFileSelect} className="hidden" />
                    </Field>
                </form>
            </Modal>

            <Modal
                open={Boolean(participantType)}
                onClose={closeParticipant}
                title={participantType === "ta" ? "Add a teaching assistant" : "Add a student"}
                description={participantType === "ta"
                    ? "TAs can view submissions and grade work in this course."
                    : "Students can view assignments and submit their work."}
                footer={
                    <>
                        <Button variant="secondary" onClick={closeParticipant}>Cancel</Button>
                        <Button type="submit" form="add-participant-form" loading={addingParticipant} disabled={!participantEmail.trim()}>
                            Add {participantType === "ta" ? "TA" : "student"}
                        </Button>
                    </>
                }
            >
                <form id="add-participant-form" onSubmit={handleAddParticipant}>
                    <Field label="Email address" htmlFor="participantEmail" required hint="They must already have a Gradely account with this role.">
                        <input id="participantEmail" type="email" value={participantEmail} onChange={e => setParticipantEmail(e.target.value)} placeholder="name@university.edu" className={inputClass} autoFocus />
                    </Field>
                </form>
            </Modal>
        </AppLayout>
    );
}

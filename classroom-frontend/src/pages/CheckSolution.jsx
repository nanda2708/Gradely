import { useEffect, useState, useContext } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { ArrowLeft, FileText, User, Calendar, Eye, Save, Send, X, CheckCircle } from "lucide-react";
import { UserContext } from "../context/ContextProvider";
import axios from "axios";
import toast, { Toaster } from "react-hot-toast";

function PdfViewer({ pdfUrl }) {
    return (
        <iframe
            src={pdfUrl}
            title="Assignment PDF"
            width="100%"
            height="600px"
            style={{ border: "none", borderRadius: "8px" }}
        />
    );
}

function SubmissionViewer({ submission }) {
    if (!submission?.url) {
        return <div className="p-8 text-center text-gray-500">Submission file is unavailable.</div>;
    }

    return (
        <div className="w-full h-96 bg-gray-100 border-2 border-dashed mx-auto border-gray-300 rounded-lg flex items-center justify-center">
            <iframe
                src={submission.url}
                title="Student Submission"
                width="100%"
                height="100%"
                style={{ border: "none" }}
            />
        </div>
    );
}

export default function CheckSolution() {
    const { submissionId } = useParams();
    const { user, loading } = useContext(UserContext);
    const navigate = useNavigate();
    const location = useLocation();

    const [showAssignmentPdf, setShowAssignmentPdf] = useState(false);
    const [selectedPdfUrl, setSelectedPdfUrl] = useState("");
    const [gradingForm, setGradingForm] = useState({
        grade: "",
        totalPoints: "",
        feedback: ""
    });
    const [submissionData, setSubmissionData] = useState(null);
    const [assignmentData, setAssignmentData] = useState(null);
    const [saving, setSaving] = useState(false);

    const returnPath = location.state?.returnPath || (user?.role === "faculty" ? "/faculty" : "/ta");
    const userRole = location.state?.role || user?.role;

    useEffect(() => {
        if (loading || !user || !submissionId) return;

        const fetchData = async () => {
            try {
                const response = await axios.get(
                    `${import.meta.env.VITE_BACKEND_URL}/submission/getSolution/${submissionId}`
                );

                setSubmissionData(response.data.submission);
                setAssignmentData(response.data.submission.assignment);
            } catch (err) {
                console.error("Error fetching submission data:", err);
                toast.error("Error fetching submission data");
            }
        };

        fetchData();
    }, [loading, user, submissionId]);

    const handleBack = () => navigate(returnPath);

    const handleViewAssignmentPdf = () => {
        if (assignmentData?.url) {
            setSelectedPdfUrl(assignmentData.url);
            setShowAssignmentPdf(true);
        }
    };

    const handleClosePdfViewer = () => {
        setShowAssignmentPdf(false);
        setSelectedPdfUrl("");
    };

    const handleSaveDraft = () => {
        toast("Draft saving will be added in the grading persistence phase.", { icon: "ℹ️" });
    };

    const handleSubmitGrade = async () => {
        if (!gradingForm.grade || gradingForm.totalPoints === "") {
            toast.error("Please provide both a letter grade and numerical score.");
            return;
        }

        const marks = Number(gradingForm.totalPoints);
        const maxMarks = Number(assignmentData?.marks);

        if (!Number.isFinite(marks) || marks < 0 || marks > maxMarks) {
            toast.error(`Score must be between 0 and ${maxMarks}.`);
            return;
        }

        setSaving(true);
        try {
            await axios.put(
                `${import.meta.env.VITE_BACKEND_URL}/submission/gradeSolution/${submissionId}`,
                {
                    grade: gradingForm.grade,
                    marks,
                    feedback: gradingForm.feedback.trim(),
                    graderId: user.id,
                    graderRole: user.role
                }
            );

            toast.success("Submission graded successfully");
            navigate(returnPath);
        } catch (err) {
            console.error("Error grading submission:", err);
            toast.error(err.response?.data?.error || "Error grading submission");
        } finally {
            setSaving(false);
        }
    };

    const getGradeColor = (grade) => {
        if (grade.startsWith("A")) return "border-green-500 text-green-700";
        if (grade.startsWith("B")) return "border-blue-500 text-blue-700";
        if (grade.startsWith("C")) return "border-yellow-500 text-yellow-700";
        return "border-red-500 text-red-700";
    };

    if (!submissionData || !assignmentData) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-gray-600">Loading submission...</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <Toaster />
            <header className="bg-white shadow">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <button onClick={handleBack} className="flex items-center gap-2 text-gray-600 hover:text-gray-900">
                                <ArrowLeft className="h-5 w-5" />
                                Back
                            </button>
                            <div className="h-6 w-px bg-gray-300" />
                            <div>
                                <h1 className="text-3xl font-bold text-gray-900">Grade Submission</h1>
                                <p className="text-gray-600">{userRole === "faculty" ? "Faculty" : "Teaching Assistant"} View</p>
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                    <div className="xl:col-span-2 space-y-6">
                        <div className="bg-white rounded-lg shadow p-6">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
                                <div>
                                    <h2 className="text-2xl font-semibold text-gray-900 mb-2">{assignmentData.title}</h2>
                                    <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                                        <span className="flex items-center gap-1">
                                            <User className="h-4 w-4" />
                                            {submissionData.student?.name || "Student"}
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <Calendar className="h-4 w-4" />
                                            Submitted: {new Date(submissionData.submittedDate).toLocaleDateString()}
                                        </span>
                                        <a
                                            className="flex items-center gap-1 underline text-blue-600"
                                            href={submissionData.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                        >
                                            <FileText className="h-4 w-4" />
                                            {submissionData.filename || "Submission"}
                                        </a>
                                    </div>
                                </div>

                                {assignmentData.url && (
                                    <button
                                        onClick={handleViewAssignmentPdf}
                                        className="mt-4 sm:mt-0 flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200"
                                    >
                                        <Eye className="h-4 w-4" />
                                        View Assignment
                                    </button>
                                )}
                            </div>

                            <h3 className="text-lg font-semibold text-gray-900 mb-4">Student Submission</h3>
                            <SubmissionViewer submission={submissionData} />
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="bg-white rounded-lg shadow p-6 sticky top-6">
                            <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
                                <CheckCircle className="h-5 w-5 text-green-500" />
                                Grade Assignment
                            </h3>

                            <div className="space-y-6">
                                <div>
                                    <label htmlFor="grade" className="block text-sm font-medium text-gray-700 mb-2">Letter Grade *</label>
                                    <select
                                        id="grade"
                                        value={gradingForm.grade}
                                        onChange={(e) => setGradingForm({ ...gradingForm, grade: e.target.value })}
                                        className={`w-1/2 px-3 py-2 border-2 rounded-lg ${gradingForm.grade ? getGradeColor(gradingForm.grade) : "border-gray-300"}`}
                                    >
                                        <option value="">Select Grade</option>
                                        {[
                                            "A+", "A", "A-", "B+", "B", "B-", "C+", "C", "C-", "D+", "D", "F"
                                        ].map(grade => <option key={grade} value={grade}>{grade}</option>)}
                                    </select>
                                </div>

                                <div>
                                    <label htmlFor="totalPoints" className="block text-sm font-medium text-gray-700 mb-2">Total Points *</label>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="number"
                                            id="totalPoints"
                                            min="0"
                                            max={assignmentData.marks}
                                            step="0.5"
                                            value={gradingForm.totalPoints}
                                            onChange={(e) => setGradingForm({ ...gradingForm, totalPoints: e.target.value })}
                                            placeholder="Enter points"
                                            className="w-1/2 px-3 py-2 border border-gray-300 rounded-lg"
                                        />
                                        <span className="text-gray-500">/ {assignmentData.marks}</span>
                                    </div>
                                </div>

                                <div>
                                    <label htmlFor="feedback" className="block text-sm font-medium text-gray-700 mb-2">Feedback</label>
                                    <textarea
                                        id="feedback"
                                        maxLength={200}
                                        value={gradingForm.feedback}
                                        onChange={(e) => setGradingForm({ ...gradingForm, feedback: e.target.value })}
                                        placeholder="Provide feedback on the student's work..."
                                        rows={6}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg resize-none"
                                    />
                                    <p className="mt-1 text-xs text-gray-500">{gradingForm.feedback.length}/200 characters</p>
                                </div>

                                <div className="space-y-3">
                                    <button onClick={handleSaveDraft} className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 text-gray-700 rounded-lg">
                                        <Save className="h-4 w-4" />
                                        Save as Draft
                                    </button>
                                    <button
                                        onClick={handleSubmitGrade}
                                        disabled={saving || !gradingForm.grade || gradingForm.totalPoints === ""}
                                        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg disabled:bg-gray-300"
                                    >
                                        <Send className="h-4 w-4" />
                                        {saving ? "Submitting..." : "Submit Grade"}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {showAssignmentPdf && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden">
                        <div className="flex items-center justify-between p-6 border-b">
                            <h3 className="text-lg font-semibold">Assignment PDF</h3>
                            <button onClick={handleClosePdfViewer}><X className="h-6 w-6" /></button>
                        </div>
                        <div className="p-6">
                            <PdfViewer pdfUrl={selectedPdfUrl} />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

import axios from "axios";
import { useContext, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { UserContext } from "../context/ContextProvider";
import { ArrowLeft, Users, BookOpen, ClipboardList, Upload, Plus, X, Calendar, CheckCircle, Clock, Menu, UserPlus, Paperclip, FileText, Eye, Edit } from 'lucide-react';
import toast, { Toaster } from "react-hot-toast";

const API = import.meta.env.VITE_BACKEND_URL?.replace(/\/$/, "");

export default function FacultyCourse() {
    const navigate = useNavigate();
    const { user, loading, logout } = useContext(UserContext);
    const { courseId } = useParams();

    const [courseData, setCourseData] = useState([]);
    const [students, setStudents] = useState([]);
    const [tas, setTas] = useState([]);
    const [activeTab, setActiveTab] = useState('assignments');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showAddParticipantModal, setShowAddParticipantModal] = useState(false);
    const [participantType, setParticipantType] = useState('student');
    const [showSidebar, setShowSidebar] = useState(false);
    const [showPdfViewer, setShowPdfViewer] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [assignments, setAssignments] = useState([]);
    const [assignmentForm, setAssignmentForm] = useState({ name: '', description: '', dueDate: '', maxPoints: '', pdfFile: null });
    const [participantForm, setParticipantForm] = useState({ email: '' });
    const [selectedPdfUrl, setSelectedPdfUrl] = useState('');
    const [gradedSubmissions, setGradedSubmissions] = useState([]);
    const [ungradedSubmissions, setUngradedSubmissions] = useState([]);

    const goToAuthError = async (err) => {
        const status = err.response?.status;
        if (status === 401) {
            await logout();
            navigate('/login', { replace: true });
            return true;
        }
        if (status === 403) {
            navigate('/unauthorized', { replace: true });
            return true;
        }
        return false;
    };

    function PdfViewer({ pdfUrl }) {
        return <iframe src={pdfUrl} title="Assignment PDF" width="100%" height="600px" style={{ border: "none", borderRadius: "8px" }} />;
    }

    const handleBack = () => navigate('/faculty');

    const handleCreateAssignment = async () => {
        if (!assignmentForm.name.trim() || !assignmentForm.dueDate || !assignmentForm.maxPoints || !API || !user?.id) return;
        setUploading(true);
        let pdfUrl = '', publicId = '';

        if (assignmentForm.pdfFile) {
            const formData = new FormData();
            formData.append('file', assignmentForm.pdfFile);
            formData.append('upload_preset', 'gradely-assignments');
            try {
                const cloudinaryRes = await axios.post(`https://api.cloudinary.com/v1_1/${import.meta.env.VITE_CLOUDINARY_CLOUD_NAME}/auto/upload`, formData);
                pdfUrl = cloudinaryRes.data.secure_url;
                publicId = cloudinaryRes.data.public_id;
            } catch (err) {
                console.error('Assignment PDF upload failed:', err);
                toast.error('Failed to upload PDF to Cloudinary');
                setUploading(false);
                return;
            }
        }

        try {
            await axios.post(`${API}/assignment/createAssignment`, {
                assignmentData: {
                    title: assignmentForm.name.trim(),
                    description: assignmentForm.description.trim(),
                    url: pdfUrl,
                    publicId,
                    course: courseId,
                    marks: Number(assignmentForm.maxPoints),
                    dueDate: assignmentForm.dueDate
                },
                courseId,
                facultyId: user.id
            });

            toast.success('Assignment created successfully!');
            setAssignmentForm({ name: '', description: '', dueDate: '', maxPoints: '', pdfFile: null });
            setShowCreateModal(false);
        } catch (err) {
            if (!(await goToAuthError(err))) {
                toast.error(err.response?.data?.error || 'Failed to create assignment');
            }
        } finally {
            setUploading(false);
        }
    };

    const handleCancelCreate = () => {
        setAssignmentForm({ name: '', description: '', dueDate: '', maxPoints: '', pdfFile: null });
        setShowCreateModal(false);
    };

    const handleFileUpload = (event) => {
        const file = event.target.files?.[0];
        if (file && file.type === 'application/pdf') setAssignmentForm({ ...assignmentForm, pdfFile: file });
        else if (file) {
            toast.error('Please select a PDF file only.');
            event.target.value = '';
        }
    };

    const handleAddParticipant = async () => {
        const email = participantForm.email.trim();
        if (!email || !API) return;

        try {
            if (participantType === 'ta') {
                const res = await axios.get(`${API}/ta/getTAID`, { params: { email } });
                const taId = res.data;
                if (!taId) throw new Error("This TA hasn't registered yet");

                const courseRes = await axios.post(`${API}/course/addTA`, { courseId, taId });
                if (courseRes.status >= 200 && courseRes.status < 300) {
                    await axios.post(`${API}/ta/addCourse`, { courseId, taId });
                    toast.success("Added TA successfully to the course!");
                }
            } else {
                const res = await axios.get(`${API}/student/getStudentID`, { params: { email } });
                const studentId = res.data;
                if (!studentId) throw new Error("This student hasn't registered yet");

                const courseRes = await axios.post(`${API}/course/addStudent`, { courseId, studentId });
                if (courseRes.status >= 200 && courseRes.status < 300) {
                    await axios.post(`${API}/student/addCourse`, { courseId, studentId });
                    toast.success("Added student successfully to the course!");
                }
            }

            setParticipantForm({ email: '' });
            setShowAddParticipantModal(false);
            await fetchCourse();
        } catch (err) {
            if (!(await goToAuthError(err))) {
                toast.error(err.response?.data?.error || err.message || "Unable to add participant");
            }
        }
    };

    const handleCancelAddParticipant = () => {
        setParticipantForm({ email: '' });
        setShowAddParticipantModal(false);
    };

    const openAddParticipantModal = (type) => {
        setParticipantType(type);
        setShowAddParticipantModal(true);
    };

    const handleGradeSubmission = (submissionId, assignmentId) => {
        navigate(`/checkSubmission/${assignmentId}/${submissionId}`, {
            state: { returnPath: window.location.pathname, role: 'faculty' }
        });
    };

    const handleViewPdf = (pdfUrl) => {
        setSelectedPdfUrl(pdfUrl);
        setShowPdfViewer(true);
    };

    const handleClosePdfViewer = () => {
        setShowPdfViewer(false);
        setSelectedPdfUrl('');
    };

    const getGradeColor = (grade = '') => {
        if (grade.startsWith('A')) return 'text-green-600 bg-green-100';
        if (grade.startsWith('B')) return 'text-blue-600 bg-blue-100';
        if (grade.startsWith('C')) return 'text-yellow-600 bg-yellow-100';
        return 'text-red-600 bg-red-100';
    };

    const fetchCourse = async () => {
        if (loading || !user || !API || !courseId) return;
        try {
            const res = await axios.get(`${API}/course/getFaculty/${courseId}`);
            setCourseData(res.data);
            setTas(res.data.tas || []);
            setStudents(res.data.students || []);

            const assignmentRes = await axios.get(`${API}/course/getAssignments/${courseId}`);
            const nextAssignments = assignmentRes.data?.assignments || [];
            setAssignments(nextAssignments);

            setGradedSubmissions(nextAssignments.flatMap(assignment =>
                (assignment.gradedSubmissions || []).map(sub => ({ ...sub, assignmentName: assignment.title, assignmentDueDate: assignment.dueDate, maxMarks: assignment.marks }))
            ));
            setUngradedSubmissions(nextAssignments.flatMap(assignment =>
                (assignment.ungradedSubmissions || []).map(sub => ({ ...sub, assignmentName: assignment.title, assignmentDueDate: assignment.dueDate, maxMarks: assignment.marks }))
            ));
        } catch (err) {
            if (!(await goToAuthError(err))) {
                toast.error(err.response?.data?.error || 'Unable to load this course.');
            }
        }
    };

    useEffect(() => {
        if (!loading && user) fetchCourse();
    }, [loading, user?.id, courseId]);

    return (
      <div className="min-h-screen bg-gray-50">
        <Toaster />
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button onClick={handleBack} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"><ArrowLeft className="h-5 w-5" />Back to Dashboard</button>
              <div className="h-6 w-px bg-gray-300"></div>
              <div><h1 className="text-3xl font-bold text-gray-900">{courseData.name}</h1><p className="text-gray-600">Course Management</p></div>
            </div>
            <button onClick={() => setShowSidebar(!showSidebar)} className="lg:hidden flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"><Menu className="h-5 w-5" />Participants</button>
          </div>
        </div>
      </header>

      {/* Existing presentation/UI below continues from the original page. */}
      {/* The data-loading and mutation logic above is the part intentionally hardened. */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-semibold">{courseData.name || 'Course'}</h2>
            <div className="flex gap-2">
              <button onClick={() => openAddParticipantModal('student')} className="px-4 py-2 bg-blue-600 text-white rounded-lg">Add Student</button>
              <button onClick={() => openAddParticipantModal('ta')} className="px-4 py-2 bg-indigo-600 text-white rounded-lg">Add TA</button>
              <button onClick={() => setShowCreateModal(true)} className="px-4 py-2 bg-green-600 text-white rounded-lg">Create Assignment</button>
            </div>
          </div>

          <div className="flex gap-4 border-b mb-6">
            <button onClick={() => setActiveTab('assignments')} className={`pb-3 border-b-2 ${activeTab === 'assignments' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500'}`}><ClipboardList className="inline h-4 w-4 mr-1" />Assignments ({assignments.length})</button>
            <button onClick={() => setActiveTab('submissions')} className={`pb-3 border-b-2 ${activeTab === 'submissions' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500'}`}><CheckCircle className="inline h-4 w-4 mr-1" />Submissions ({gradedSubmissions.length + ungradedSubmissions.length})</button>
          </div>

          {activeTab === 'assignments' ? (
            <div className="space-y-4">
              {assignments.length === 0 && <div className="text-gray-500 py-10 text-center">No assignments yet.</div>}
              {assignments.map(assignment => (
                <div key={assignment._id} className="border rounded-lg p-4">
                  <div className="flex items-start justify-between gap-4"><div><h3 className="font-semibold text-lg">{assignment.title}</h3><p className="text-gray-600 mt-1">{assignment.description}</p></div><div className="text-sm text-gray-500">{assignment.marks} marks</div></div>
                  <div className="mt-3 text-sm text-gray-500 flex gap-4"><span><Calendar className="inline h-4 w-4 mr-1" />{assignment.dueDate ? new Date(assignment.dueDate).toLocaleString() : 'No due date'}</span>{assignment.url && <button onClick={() => handleViewPdf(assignment.url)} className="text-blue-600"><Eye className="inline h-4 w-4 mr-1" />View PDF</button>}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {ungradedSubmissions.concat(gradedSubmissions).map(submission => (
                <div key={submission._id} className="border rounded-lg p-4 flex items-center justify-between gap-4">
                  <div><div className="font-semibold">{submission.student?.name || 'Student'}</div><div className="text-sm text-gray-500">{submission.assignmentName}</div></div>
                  <div className="flex items-center gap-3">{submission.status === 'graded' ? <span className="px-3 py-1 rounded-full bg-green-100 text-green-700">Graded</span> : <span className="px-3 py-1 rounded-full bg-yellow-100 text-yellow-700">Pending</span>}<button onClick={() => handleGradeSubmission(submission._id, submission.assignment?._id || '')} className="px-3 py-2 border rounded-lg">{submission.status === 'graded' ? 'Review' : 'Grade'}</button></div>
                </div>
              ))}
              {gradedSubmissions.length + ungradedSubmissions.length === 0 && <div className="text-gray-500 py-10 text-center">No submissions yet.</div>}
            </div>
          )}
        </div>
      </div>

      {showCreateModal && <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"><div className="bg-white rounded-lg shadow-xl max-w-md w-full"><div className="p-6 border-b flex justify-between"><h3 className="font-semibold">Create Assignment</h3><button onClick={handleCancelCreate}><X /></button></div><div className="p-6 space-y-4"><input value={assignmentForm.name} onChange={e => setAssignmentForm({ ...assignmentForm, name: e.target.value })} placeholder="Title" className="w-full border rounded-lg px-3 py-2" /><textarea value={assignmentForm.description} onChange={e => setAssignmentForm({ ...assignmentForm, description: e.target.value })} placeholder="Description" className="w-full border rounded-lg px-3 py-2" /><input type="datetime-local" value={assignmentForm.dueDate} onChange={e => setAssignmentForm({ ...assignmentForm, dueDate: e.target.value })} className="w-full border rounded-lg px-3 py-2" /><input type="number" min="1" value={assignmentForm.maxPoints} onChange={e => setAssignmentForm({ ...assignmentForm, maxPoints: e.target.value })} placeholder="Maximum marks" className="w-full border rounded-lg px-3 py-2" /><input type="file" accept="application/pdf" onChange={handleFileUpload} /></div><div className="p-6 border-t flex justify-end gap-3"><button onClick={handleCancelCreate} className="px-4 py-2 border rounded-lg">Cancel</button><button onClick={handleCreateAssignment} disabled={uploading} className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50">{uploading ? 'Creating...' : 'Create'}</button></div></div></div>}
      {showAddParticipantModal && <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"><div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6"><div className="flex justify-between mb-5"><h3 className="font-semibold">Add {participantType === 'ta' ? 'TA' : 'Student'}</h3><button onClick={handleCancelAddParticipant}><X /></button></div><input type="email" value={participantForm.email} onChange={e => setParticipantForm({ email: e.target.value })} placeholder="Registered email" className="w-full border rounded-lg px-3 py-2" /><div className="mt-5 flex justify-end gap-3"><button onClick={handleCancelAddParticipant} className="px-4 py-2 border rounded-lg">Cancel</button><button onClick={handleAddParticipant} className="px-4 py-2 bg-blue-600 text-white rounded-lg">Add</button></div></div></div>}
      {showPdfViewer && <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50"><div className="bg-white rounded-lg w-full max-w-5xl p-4"><div className="flex justify-end mb-2"><button onClick={handleClosePdfViewer}><X /></button></div><PdfViewer pdfUrl={selectedPdfUrl} /></div></div>}
    </div>
    );
}

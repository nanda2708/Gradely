import { useContext, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Bot, Send, Sparkles, User } from "lucide-react";
import axios from "axios";
import toast, { Toaster } from "react-hot-toast";
import { UserContext } from "../context/ContextProvider";

export default function AIHelper() {
    const { user } = useContext(UserContext);
    const navigate = useNavigate();
    const [courses, setCourses] = useState([]);
    const [assignmentId, setAssignmentId] = useState("");
    const [question, setQuestion] = useState("");
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const loadAssignments = async () => {
            if (!user?.id) return;
            try {
                const response = await axios.get(`${import.meta.env.VITE_BACKEND_URL}/student/getCourses/${user.id}`);
                setCourses(response.data.courses || []);
            } catch (err) {
                toast.error(err.response?.data?.error || "Unable to load your assignments");
            }
        };
        loadAssignments();
    }, [user?.id]);

    const assignments = useMemo(() => courses.flatMap(course =>
        (course.assignments || []).map(assignment => ({
            ...assignment,
            courseName: course.name
        }))
    ), [courses]);

    const askAI = async () => {
        const cleanQuestion = question.trim();
        if (!assignmentId) {
            toast.error("Select an assignment first");
            return;
        }
        if (!cleanQuestion) return;
        if (cleanQuestion.length > 4000) {
            toast.error("Please keep your question under 4000 characters");
            return;
        }

        const userMessage = { role: "user", text: cleanQuestion };
        const previousMessages = messages;
        setMessages(prev => [...prev, userMessage]);
        setQuestion("");
        setLoading(true);

        try {
            const response = await axios.post(`${import.meta.env.VITE_BACKEND_URL}/ai/helper`, {
                assignmentId,
                message: cleanQuestion,
                history: previousMessages
            });
            setMessages(prev => [...prev, { role: "model", text: response.data.answer }]);
        } catch (err) {
            setMessages(previousMessages);
            setQuestion(cleanQuestion);
            toast.error(err.response?.data?.error || "AI helper is unavailable right now");
        } finally {
            setLoading(false);
        }
    };

    const selectedAssignment = assignments.find(a => a._id === assignmentId);

    return (
        <div className="min-h-screen bg-gray-50">
            <Toaster />
            <header className="bg-white shadow">
                <div className="max-w-5xl mx-auto px-4 py-4 flex items-center gap-4">
                    <button onClick={() => navigate("/student")} className="p-2 rounded-lg hover:bg-gray-100">
                        <ArrowLeft className="h-5 w-5" />
                    </button>
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-blue-100 text-blue-700"><Bot className="h-6 w-6" /></div>
                        <div>
                            <h1 className="text-xl font-bold text-gray-900">Gradely AI Helper</h1>
                            <p className="text-sm text-gray-500">Ask doubts and learn step-by-step</p>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-5xl mx-auto px-4 py-6">
                <div className="bg-white rounded-xl shadow overflow-hidden">
                    <div className="p-5 border-b">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Choose an assignment</label>
                        <select
                            value={assignmentId}
                            onChange={(e) => { setAssignmentId(e.target.value); setMessages([]); }}
                            className="w-full border rounded-lg px-3 py-2 bg-white"
                        >
                            <option value="">Select an assignment...</option>
                            {assignments.map(assignment => (
                                <option key={assignment._id} value={assignment._id}>
                                    {assignment.courseName} — {assignment.title}
                                </option>
                            ))}
                        </select>
                        {selectedAssignment && (
                            <div className="mt-3 p-3 rounded-lg bg-blue-50 text-sm text-blue-900">
                                <strong>{selectedAssignment.title}</strong>
                                <span className="block mt-1">{selectedAssignment.description || "Ask me anything about this assignment."}</span>
                            </div>
                        )}
                    </div>

                    <div className="min-h-[420px] max-h-[55vh] overflow-y-auto p-5 space-y-4">
                        {messages.length === 0 && (
                            <div className="h-full flex items-center justify-center text-center text-gray-500 py-20">
                                <div>
                                    <Sparkles className="h-10 w-10 mx-auto mb-3 text-blue-500" />
                                    <p className="font-medium text-gray-700">Your AI study helper is ready.</p>
                                    <p className="text-sm mt-1">Select an assignment and ask a conceptual doubt.</p>
                                </div>
                            </div>
                        )}
                        {messages.map((message, index) => (
                            <div key={`${message.role}-${index}`} className={`flex gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                                {message.role === "model" && <div className="p-2 rounded-full bg-blue-100 text-blue-700 h-fit"><Bot className="h-4 w-4" /></div>}
                                <div className={`max-w-[80%] rounded-xl px-4 py-3 whitespace-pre-wrap ${message.role === "user" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-800"}`}>
                                    {message.text}
                                </div>
                                {message.role === "user" && <div className="p-2 rounded-full bg-gray-200 text-gray-700 h-fit"><User className="h-4 w-4" /></div>}
                            </div>
                        ))}
                        {loading && <div className="text-sm text-gray-500">AI is thinking...</div>}
                    </div>

                    <div className="border-t p-4">
                        <div className="flex gap-2">
                            <textarea
                                value={question}
                                onChange={(e) => setQuestion(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" && !e.shiftKey) {
                                        e.preventDefault();
                                        askAI();
                                    }
                                }}
                                placeholder="Ask your assignment doubt..."
                                rows={2}
                                disabled={loading}
                                className="flex-1 resize-none border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <button
                                onClick={askAI}
                                disabled={loading || !question.trim() || !assignmentId}
                                className="self-end px-4 py-3 rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-300"
                            >
                                <Send className="h-5 w-5" />
                            </button>
                        </div>
                        <p className="text-xs text-gray-400 mt-2">Use AI for learning and explanations; verify important answers with your course material.</p>
                    </div>
                </div>
            </main>
        </div>
    );
}

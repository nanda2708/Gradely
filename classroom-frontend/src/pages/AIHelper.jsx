import { useContext, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { Bot, Send, Sparkles, Trash2 } from "lucide-react";
import { UserContext } from "../context/ContextProvider";
import AppLayout from "../components/AppLayout";
import { Avatar, Button, Card, inputClass } from "../components/ui";
import { API, apiError } from "../lib/api";

const MAX_QUESTION = 4000;
const suggestions = [
    "Explain the key concepts this assignment tests",
    "How should I approach this problem step by step?",
    "What are common mistakes to avoid here?",
    "Give me a hint without giving away the answer"
];

export default function AIHelper() {
    const { user } = useContext(UserContext);
    const [courses, setCourses] = useState([]);
    const [assignmentId, setAssignmentId] = useState("");
    const [question, setQuestion] = useState("");
    const [messages, setMessages] = useState([]);
    const [thinking, setThinking] = useState(false);
    const scrollRef = useRef(null);

    useEffect(() => {
        if (!user?.id) return;
        axios.get(`${API}/student/getCourses/${user.id}`)
            .then(response => setCourses(response.data.courses || []))
            .catch(err => toast.error(apiError(err, "Unable to load your assignments")));
    }, [user?.id]);

    useEffect(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }, [messages, thinking]);

    const assignments = useMemo(() => courses.flatMap(course =>
        (course.assignments || []).map(assignment => ({ ...assignment, courseName: course.name }))
    ), [courses]);

    const selectedAssignment = assignments.find(a => a._id === assignmentId);

    const askAI = async (text = question) => {
        const cleanQuestion = text.trim();
        if (!assignmentId) {
            toast.error("Select an assignment first");
            return;
        }
        if (!cleanQuestion || thinking) return;
        if (cleanQuestion.length > MAX_QUESTION) {
            toast.error(`Please keep your question under ${MAX_QUESTION} characters`);
            return;
        }

        const previousMessages = messages;
        setMessages([...previousMessages, { role: "user", text: cleanQuestion }]);
        setQuestion("");
        setThinking(true);

        try {
            const { data } = await axios.post(`${API}/student/ai-helper/helper`, {
                assignmentId,
                message: cleanQuestion,
                history: previousMessages
            });
            setMessages(current => [...current, { role: "model", text: data.answer }]);
        } catch (err) {
            setMessages(previousMessages);
            setQuestion(cleanQuestion);
            toast.error(apiError(err, "AI helper is unavailable right now"));
        } finally {
            setThinking(false);
        }
    };

    return (
        <AppLayout eyebrow="Study assistant" title="AI Helper" subtitle="Ask questions about an assignment and learn step by step.">
            <Card className="flex h-[calc(100vh-14rem)] min-h-[520px] flex-col overflow-hidden">
                <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center">
                    <label htmlFor="assignment" className="shrink-0 text-sm font-medium text-slate-700">Assignment</label>
                    <select
                        id="assignment"
                        value={assignmentId}
                        onChange={(e) => { setAssignmentId(e.target.value); setMessages([]); }}
                        className={`${inputClass} sm:max-w-md`}
                    >
                        <option value="">Select an assignment…</option>
                        {assignments.map(assignment => (
                            <option key={assignment._id} value={assignment._id}>{assignment.courseName} — {assignment.title}</option>
                        ))}
                    </select>
                    {messages.length > 0 && (
                        <Button variant="ghost" size="sm" className="sm:ml-auto" onClick={() => setMessages([])}>
                            <Trash2 className="h-4 w-4" />
                            Clear chat
                        </Button>
                    )}
                </div>

                <div ref={scrollRef} className="flex-1 space-y-5 overflow-y-auto bg-slate-50/60 p-4 sm:p-6">
                    {messages.length === 0 ? (
                        <div className="flex h-full flex-col items-center justify-center text-center">
                            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/20">
                                <Sparkles className="h-7 w-7" />
                            </div>
                            <h2 className="text-lg font-semibold text-slate-900">
                                {selectedAssignment ? selectedAssignment.title : "Pick an assignment to get started"}
                            </h2>
                            <p className="mt-1 max-w-md text-sm text-slate-500">
                                {selectedAssignment?.description || "The helper explains concepts and gives hints — it won’t write your submission for you."}
                            </p>
                            {selectedAssignment && (
                                <div className="mt-6 grid w-full max-w-xl grid-cols-1 gap-2 sm:grid-cols-2">
                                    {suggestions.map(text => (
                                        <button key={text} type="button" onClick={() => askAI(text)} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-left text-sm text-slate-700 transition hover:border-indigo-300 hover:bg-indigo-50/50">
                                            {text}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    ) : (
                        messages.map((message, index) => (
                            <div key={`${message.role}-${index}`} className={`flex gap-3 ${message.role === "user" ? "flex-row-reverse" : ""}`}>
                                {message.role === "user" ? (
                                    <Avatar name={user.name} size="sm" />
                                ) : (
                                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-white"><Bot className="h-4 w-4" /></div>
                                )}
                                <div className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                                    message.role === "user" ? "rounded-tr-sm bg-indigo-600 text-white" : "rounded-tl-sm bg-white text-slate-800 ring-1 ring-slate-200"
                                }`}>
                                    {message.text}
                                </div>
                            </div>
                        ))
                    )}
                    {thinking && (
                        <div className="flex gap-3">
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-white"><Bot className="h-4 w-4" /></div>
                            <div className="flex items-center gap-1 rounded-2xl rounded-tl-sm bg-white px-4 py-3 ring-1 ring-slate-200">
                                {[0, 150, 300].map(delay => <span key={delay} className="h-2 w-2 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: `${delay}ms` }} />)}
                            </div>
                        </div>
                    )}
                </div>

                <form onSubmit={(e) => { e.preventDefault(); askAI(); }} className="border-t border-slate-100 p-4">
                    <div className="flex items-end gap-2">
                        <textarea
                            value={question}
                            onChange={(e) => setQuestion(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && !e.shiftKey) {
                                    e.preventDefault();
                                    askAI();
                                }
                            }}
                            placeholder={assignmentId ? "Ask a question… (Shift+Enter for a new line)" : "Select an assignment first"}
                            rows={2}
                            maxLength={MAX_QUESTION}
                            disabled={thinking || !assignmentId}
                            className={`${inputClass} resize-none`}
                        />
                        <Button type="submit" size="lg" disabled={thinking || !question.trim() || !assignmentId} aria-label="Send">
                            <Send className="h-4 w-4" />
                        </Button>
                    </div>
                    <p className="mt-2 text-xs text-slate-400">AI can make mistakes — verify important answers with your course material.</p>
                </form>
            </Card>
        </AppLayout>
    );
}

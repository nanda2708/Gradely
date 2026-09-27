import { useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { AlertTriangle, CheckCircle2, Clock, Edit3, FileText, MessageSquare } from "lucide-react";
import { Avatar, Badge, Button, Card, EmptyState, Field, GradeBadge, Modal, Table, Td, Th, inputClass } from "./ui";
import { API, apiError } from "../lib/api";
import { formatDate } from "../lib/format";

function StudentCell({ student }) {
    return (
        <div className="flex items-center gap-3">
            <Avatar name={student?.name} size="sm" tone="gray" />
            <div className="min-w-0">
                <p className="truncate font-medium text-slate-900">{student?.name || "Unknown student"}</p>
                {student?.email && <p className="truncate text-xs text-slate-500">{student.email}</p>}
            </div>
        </div>
    );
}

function AssignmentCell({ submission }) {
    return (
        <div className="min-w-0">
            <p className="truncate font-medium text-slate-900">{submission.assignmentName}</p>
            <a
                href={submission.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={e => e.stopPropagation()}
                className="flex items-center gap-1 truncate text-xs text-indigo-600 hover:underline"
            >
                <FileText className="h-3 w-3" />
                {submission.filename || "submission.pdf"}
            </a>
        </div>
    );
}

export function ToGradeTable({ submissions, onGrade }) {
    if (!submissions.length) {
        return <EmptyState icon={CheckCircle2} title="You’re all caught up" description="There are no submissions waiting to be graded." />;
    }

    return (
        <Table>
            <thead><tr><Th>Student</Th><Th>Assignment</Th><Th>Submitted</Th><Th>Max</Th><Th /></tr></thead>
            <tbody className="divide-y divide-slate-100 bg-white">
                {submissions.map(submission => {
                    const late = submission.assignmentDueDate && new Date(submission.submittedDate) > new Date(submission.assignmentDueDate);
                    return (
                        <tr key={submission._id} className="hover:bg-slate-50">
                            <Td><StudentCell student={submission.student} /></Td>
                            <Td><AssignmentCell submission={submission} /></Td>
                            <Td className="whitespace-nowrap">
                                <div className="flex items-center gap-2">
                                    {formatDate(submission.submittedDate || submission.createdAt)}
                                    {late && <Badge tone="red">Late</Badge>}
                                </div>
                            </Td>
                            <Td className="whitespace-nowrap">{submission.maxMarks} pts</Td>
                            <Td className="text-right"><Button size="sm" onClick={() => onGrade(submission)}>Grade</Button></Td>
                        </tr>
                    );
                })}
            </tbody>
        </Table>
    );
}

export function GradedTable({ submissions, onGrade }) {
    if (!submissions.length) {
        return <EmptyState icon={Clock} title="Nothing graded yet" description="Graded submissions will appear here." />;
    }

    return (
        <Table>
            <thead><tr><Th>Student</Th><Th>Assignment</Th><Th>Grade</Th><Th>Graded by</Th><Th>Feedback</Th><Th /></tr></thead>
            <tbody className="divide-y divide-slate-100 bg-white">
                {submissions.map(submission => (
                    <tr key={submission._id} className="hover:bg-slate-50">
                        <Td><StudentCell student={submission.student} /></Td>
                        <Td><AssignmentCell submission={submission} /></Td>
                        <Td className="whitespace-nowrap">
                            <div className="flex items-center gap-2">
                                <GradeBadge grade={submission.grade} />
                                <span className="text-xs text-slate-500">{submission.marks}/{submission.maxMarks}</span>
                            </div>
                        </Td>
                        <Td className="whitespace-nowrap">
                            <p className="text-slate-900">{submission.gradedBy?.name || "—"}</p>
                            <p className="text-xs text-slate-500">{formatDate(submission.checkedDate)}</p>
                        </Td>
                        <Td className="max-w-xs"><p className="truncate" title={submission.feedback}>{submission.feedback || "—"}</p></Td>
                        <Td className="text-right">
                            <Button size="sm" variant="secondary" onClick={() => onGrade(submission)}>
                                <Edit3 className="h-3.5 w-3.5" />
                                Regrade
                            </Button>
                        </Td>
                    </tr>
                ))}
            </tbody>
        </Table>
    );
}

export function ReevaluationList({ submissions, onGrade, onChanged }) {
    const [rejecting, setRejecting] = useState(null);
    const [response, setResponse] = useState("");
    const [saving, setSaving] = useState(false);

    const closeReject = () => {
        setRejecting(null);
        setResponse("");
    };

    const submitReject = async () => {
        setSaving(true);
        try {
            await axios.put(`${API}/submission/rejectReevaluation/${rejecting._id}`, { response: response.trim() });
            toast.success("Re-evaluation request declined");
            closeReject();
            await onChanged?.();
        } catch (err) {
            toast.error(apiError(err, "Unable to update the request"));
        } finally {
            setSaving(false);
        }
    };

    if (!submissions.length) {
        return <EmptyState icon={MessageSquare} title="No re-evaluation requests" description="When students request a re-evaluation, it shows up here." />;
    }

    return (
        <div className="space-y-3">
            {submissions.map(submission => (
                <Card key={submission._id} className="p-5">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                                <h3 className="font-semibold text-slate-900">{submission.assignmentName}</h3>
                                <Badge tone="orange" icon={AlertTriangle}>Re-evaluation requested</Badge>
                            </div>
                            <p className="mt-1 text-sm text-slate-500">
                                {submission.student?.name} · requested {formatDate(submission.reevalRequestedAt)} · current grade{" "}
                                <span className="font-medium text-slate-700">{submission.grade} ({submission.marks}/{submission.maxMarks})</span>
                            </p>
                            <blockquote className="mt-3 rounded-lg border-l-4 border-orange-300 bg-orange-50/60 px-4 py-3 text-sm text-slate-700">
                                {submission.reevalReason}
                            </blockquote>
                        </div>
                        <div className="flex shrink-0 gap-2">
                            <Button size="sm" variant="secondary" onClick={() => setRejecting(submission)}>Decline</Button>
                            <Button size="sm" onClick={() => onGrade(submission)}>Review & regrade</Button>
                        </div>
                    </div>
                </Card>
            ))}

            <Modal
                open={Boolean(rejecting)}
                onClose={closeReject}
                title="Decline re-evaluation"
                description="The current grade stays unchanged. Let the student know why."
                footer={
                    <>
                        <Button variant="secondary" onClick={closeReject}>Cancel</Button>
                        <Button variant="danger" onClick={submitReject} loading={saving}>Decline request</Button>
                    </>
                }
            >
                <Field label="Response to student" htmlFor="reevalResponse" hint={`${response.length}/2000`}>
                    <textarea id="reevalResponse" rows={4} maxLength={2000} value={response} onChange={e => setResponse(e.target.value)} className={inputClass} placeholder="Explain why the original grade stands..." />
                </Field>
            </Modal>
        </div>
    );
}

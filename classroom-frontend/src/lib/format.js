export const formatDate = (value, options) => {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return date.toLocaleDateString(undefined, options || { day: "numeric", month: "short", year: "numeric" });
};

export const isPastDue = (dueDate) => Boolean(dueDate) && new Date(dueDate) < new Date();

// Due dates are picked as calendar days, so treat them as due at the end of that day.
export const endOfDayIso = (dateString) => new Date(`${dateString}T23:59:59`).toISOString();

// Resubmissions create extra Solution documents; count each student once.
export const uniqueStudentCount = (submissions = []) =>
    new Set(submissions.map(s => (s?.student?._id || s?.student || "").toString()).filter(Boolean)).size;

export const percent = (part, total) => (total > 0 ? Math.min(100, Math.round((part / total) * 100)) : 0);

export const initials = (name = "") =>
    name.trim().split(/\s+/).slice(0, 2).map(word => word[0]?.toUpperCase() || "").join("") || "?";

export const flattenSubmissions = (assignments = [], key) =>
    assignments.flatMap(assignment => (assignment[key] || []).map(submission => ({
        ...submission,
        assignmentName: assignment.title,
        assignmentDueDate: assignment.dueDate,
        maxMarks: assignment.marks
    })));

export const gradeTone = (grade = "") => {
    if (grade.startsWith("A")) return "green";
    if (grade.startsWith("B")) return "blue";
    if (grade.startsWith("C")) return "yellow";
    if (grade.startsWith("D")) return "orange";
    return grade ? "red" : "gray";
};

// Submissions arrays are stored in insertion order, so the last entry per student is their latest.
export const countUngradedLatest = (submissions = []) => {
    const latest = new Map();
    submissions.forEach(s => {
        const id = (s?.student?._id || s?.student || "").toString();
        if (id) latest.set(id, s.status);
    });
    return [...latest.values()].filter(status => status !== "graded").length;
};

export const dueLabel = (dueDate) => {
    if (!dueDate) return "No due date";
    return `${isPastDue(dueDate) ? "Was due" : "Due"} ${formatDate(dueDate)}`;
};

import { useEffect } from "react";
import { Loader2, X } from "lucide-react";
import { gradeTone, initials } from "../lib/format";

const cx = (...classes) => classes.filter(Boolean).join(" ");

const buttonVariants = {
    primary: "bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm shadow-indigo-600/20",
    secondary: "bg-white text-slate-700 ring-1 ring-inset ring-slate-200 hover:bg-slate-50",
    soft: "bg-indigo-50 text-indigo-700 hover:bg-indigo-100",
    danger: "bg-rose-600 text-white hover:bg-rose-700",
    success: "bg-emerald-600 text-white hover:bg-emerald-700",
    warning: "bg-amber-500 text-white hover:bg-amber-600",
    ghost: "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
};

const buttonSizes = {
    sm: "h-8 px-3 text-sm gap-1.5",
    md: "h-10 px-4 text-sm gap-2",
    lg: "h-11 px-5 text-base gap-2"
};

export function Button({ variant = "primary", size = "md", loading = false, disabled, className, children, type = "button", ...props }) {
    return (
        <button
            type={type}
            disabled={disabled || loading}
            className={cx(
                "inline-flex items-center justify-center rounded-lg font-medium transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2",
                "disabled:cursor-not-allowed disabled:opacity-50",
                buttonVariants[variant],
                buttonSizes[size],
                className
            )}
            {...props}
        >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {children}
        </button>
    );
}

export const inputClass =
    "block w-full rounded-lg border-0 bg-white focus:outline-none px-3 py-2 text-sm text-slate-900 ring-1 ring-inset ring-slate-200 " +
    "placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-indigo-500 disabled:bg-slate-50";

export function Field({ label, htmlFor, hint, required, children }) {
    return (
        <div>
            {label && (
                <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-slate-700">
                    {label}{required && <span className="text-rose-500"> *</span>}
                </label>
            )}
            {children}
            {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
        </div>
    );
}

export function Card({ className, children, ...props }) {
    return (
        <div className={cx("rounded-xl border border-slate-200 bg-white shadow-sm", className)} {...props}>
            {children}
        </div>
    );
}

const badgeTones = {
    gray: "bg-slate-100 text-slate-700 ring-slate-500/10",
    green: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
    yellow: "bg-amber-50 text-amber-800 ring-amber-600/20",
    red: "bg-rose-50 text-rose-700 ring-rose-600/20",
    blue: "bg-sky-50 text-sky-700 ring-sky-600/20",
    indigo: "bg-indigo-50 text-indigo-700 ring-indigo-600/20",
    purple: "bg-violet-50 text-violet-700 ring-violet-600/20",
    orange: "bg-orange-50 text-orange-700 ring-orange-600/20"
};

export function Badge({ tone = "gray", icon: Icon, children, className }) {
    return (
        <span className={cx("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset", badgeTones[tone], className)}>
            {Icon && <Icon className="h-3 w-3" />}
            {children}
        </span>
    );
}

export function GradeBadge({ grade }) {
    return <Badge tone={gradeTone(grade)}>{grade || "—"}</Badge>;
}

const statusMeta = {
    pending: { tone: "yellow", label: "Pending" },
    overdue: { tone: "red", label: "Overdue" },
    submitted: { tone: "blue", label: "Submitted" },
    graded: { tone: "green", label: "Graded" }
};

export function StatusBadge({ status }) {
    const meta = statusMeta[status] || { tone: "gray", label: status || "Unknown" };
    return <Badge tone={meta.tone}>{meta.label}</Badge>;
}

export function Spinner({ className }) {
    return <Loader2 className={cx("h-6 w-6 animate-spin text-indigo-600", className)} />;
}

export function PageLoader({ label = "Loading..." }) {
    return (
        <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-sm text-slate-500">
            <Spinner className="h-8 w-8" />
            {label}
        </div>
    );
}

export function FullScreenLoader() {
    return (
        <div className="flex min-h-screen items-center justify-center bg-slate-50">
            <Spinner className="h-8 w-8" />
        </div>
    );
}

export function EmptyState({ icon: Icon, title, description, action, className }) {
    return (
        <div className={cx("flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center", className)}>
            {Icon && (
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                    <Icon className="h-6 w-6" />
                </div>
            )}
            <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
            {description && <p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p>}
            {action && <div className="mt-5">{action}</div>}
        </div>
    );
}

export function Tabs({ tabs, active, onChange }) {
    return (
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            <nav className="inline-flex min-w-full gap-1 rounded-xl bg-slate-100 p-1 sm:min-w-0" role="tablist">
                {tabs.map(({ id, label, icon: Icon, count }) => {
                    const selected = active === id;
                    return (
                        <button
                            key={id}
                            type="button"
                            role="tab"
                            aria-selected={selected}
                            onClick={() => onChange(id)}
                            className={cx(
                                "flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                                selected ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
                            )}
                        >
                            {Icon && <Icon className={cx("h-4 w-4", selected ? "text-indigo-600" : "text-slate-400")} />}
                            {label}
                            {count !== undefined && (
                                <span className={cx("rounded-full px-1.5 text-xs", selected ? "bg-indigo-50 text-indigo-700" : "bg-slate-200 text-slate-600")}>
                                    {count}
                                </span>
                            )}
                        </button>
                    );
                })}
            </nav>
        </div>
    );
}

const statTones = {
    indigo: "bg-indigo-50 text-indigo-600",
    green: "bg-emerald-50 text-emerald-600",
    yellow: "bg-amber-50 text-amber-600",
    red: "bg-rose-50 text-rose-600",
    blue: "bg-sky-50 text-sky-600",
    purple: "bg-violet-50 text-violet-600"
};

export function StatCard({ label, value, icon: Icon, tone = "indigo" }) {
    return (
        <Card className="flex items-center gap-4 p-4">
            {Icon && (
                <div className={cx("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", statTones[tone])}>
                    <Icon className="h-5 w-5" />
                </div>
            )}
            <div className="min-w-0">
                <p className="truncate text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
                <p className="text-2xl font-semibold text-slate-900">{value}</p>
            </div>
        </Card>
    );
}

export function ProgressBar({ value, label }) {
    return (
        <div className="w-full">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-indigo-500 transition-all" style={{ width: `${value}%` }} />
            </div>
            {label && <p className="mt-1 text-xs text-slate-500">{label}</p>}
        </div>
    );
}

export function Avatar({ name, tone = "indigo", size = "md" }) {
    const tones = {
        indigo: "bg-indigo-100 text-indigo-700",
        purple: "bg-violet-100 text-violet-700",
        blue: "bg-sky-100 text-sky-700",
        gray: "bg-slate-200 text-slate-700"
    };
    const sizes = { sm: "h-7 w-7 text-xs", md: "h-9 w-9 text-sm" };
    return (
        <div className={cx("flex shrink-0 items-center justify-center rounded-full font-semibold", tones[tone], sizes[size])}>
            {initials(name)}
        </div>
    );
}

export function Modal({ open, onClose, title, description, children, footer, size = "md" }) {
    useEffect(() => {
        if (!open) return undefined;
        const onKey = (event) => event.key === "Escape" && onClose?.();
        document.addEventListener("keydown", onKey);
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.removeEventListener("keydown", onKey);
            document.body.style.overflow = previousOverflow;
        };
    }, [open, onClose]);

    if (!open) return null;

    const widths = { md: "max-w-lg", lg: "max-w-2xl", xl: "max-w-5xl" };

    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={onClose}>
            <div
                role="dialog"
                aria-modal="true"
                className={cx("flex max-h-[92vh] w-full flex-col rounded-t-2xl bg-white shadow-xl sm:rounded-2xl", widths[size])}
                onMouseDown={(event) => event.stopPropagation()}
            >
                <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-4">
                    <div className="min-w-0">
                        <h3 className="truncate text-base font-semibold text-slate-900">{title}</h3>
                        {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
                    </div>
                    <button type="button" onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600" aria-label="Close">
                        <X className="h-5 w-5" />
                    </button>
                </div>
                <div className="overflow-y-auto px-6 py-5">{children}</div>
                {footer && <div className="flex flex-col-reverse gap-2 border-t border-slate-100 px-6 py-4 sm:flex-row sm:justify-end">{footer}</div>}
            </div>
        </div>
    );
}

export function PdfModal({ url, title = "Document", onClose }) {
    return (
        <Modal
            open={Boolean(url)}
            onClose={onClose}
            title={title}
            size="xl"
            footer={
                <a href={url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-indigo-600 hover:text-indigo-700">
                    Open in new tab
                </a>
            }
        >
            <iframe src={url} title={title} className="h-[70vh] w-full rounded-lg border border-slate-200" />
        </Modal>
    );
}

export function Table({ children }) {
    return (
        <Card className="overflow-hidden">
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-sm">{children}</table>
            </div>
        </Card>
    );
}

export function Th({ children, className }) {
    return <th scope="col" className={cx("whitespace-nowrap bg-slate-50 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500", className)}>{children}</th>;
}

export function Td({ children, className, ...props }) {
    return <td className={cx("px-4 py-3 align-middle text-slate-600", className)} {...props}>{children}</td>;
}

export function SectionHeader({ title, description, action }) {
    return (
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
                <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
                {description && <p className="text-sm text-slate-500">{description}</p>}
            </div>
            {action}
        </div>
    );
}

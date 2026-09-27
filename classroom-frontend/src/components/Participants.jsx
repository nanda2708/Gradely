import { useState } from "react";
import { BookOpen, GraduationCap, UserPlus, Users, X } from "lucide-react";
import { Avatar, Button, Card } from "./ui";

function PersonRow({ person, tone }) {
    return (
        <li className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-slate-50">
            <Avatar name={person.name} tone={tone} size="sm" />
            <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-900">{person.name}</p>
                <p className="truncate text-xs text-slate-500">{person.email}</p>
            </div>
        </li>
    );
}

function Group({ icon: Icon, iconClass, title, people, tone, onAdd, addLabel, emptyText }) {
    return (
        <section>
            <div className="mb-2 flex items-center justify-between">
                <h4 className="flex min-w-0 items-center gap-2 text-sm font-semibold text-slate-900">
                    <Icon className={`h-4 w-4 ${iconClass}`} />
                    {title}
                    <span className="text-xs font-normal text-slate-400">{people.length}</span>
                </h4>
                {onAdd && (
                    <Button size="sm" variant="soft" onClick={onAdd} className="shrink-0 whitespace-nowrap">
                        <UserPlus className="h-3.5 w-3.5" />
                        {addLabel}
                    </Button>
                )}
            </div>
            {people.length ? (
                <ul className="max-h-64 space-y-0.5 overflow-y-auto">
                    {people.map(person => <PersonRow key={person._id} person={person} tone={tone} />)}
                </ul>
            ) : (
                <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">{emptyText}</p>
            )}
        </section>
    );
}

function PanelContent({ faculty, tas = [], students = [], onAddTA, onAddStudent }) {
    return (
        <div className="space-y-6">
            {faculty && (
                <Group icon={GraduationCap} iconClass="text-violet-600" title="Faculty" people={[faculty]} tone="purple" emptyText="" />
            )}
            <Group
                icon={BookOpen}
                iconClass="text-sky-600"
                title="TAs"
                people={tas}
                tone="blue"
                onAdd={onAddTA}
                addLabel="Add TA"
                emptyText="No teaching assistants yet."
            />
            <Group
                icon={Users}
                iconClass="text-emerald-600"
                title="Students"
                people={students}
                tone="gray"
                onAdd={onAddStudent}
                addLabel="Add"
                emptyText="No students enrolled yet."
            />
        </div>
    );
}

// Desktop sidebar plus a mobile toggle + drawer for course participants.
export default function Participants(props) {
    const [open, setOpen] = useState(false);
    const total = (props.tas?.length || 0) + (props.students?.length || 0) + (props.faculty ? 1 : 0);

    return (
        <>
            <aside className="hidden w-80 shrink-0 lg:block">
                <Card className="sticky top-24 p-5">
                    <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">Participants</h3>
                    <PanelContent {...props} />
                </Card>
            </aside>

            <button
                type="button"
                onClick={() => setOpen(true)}
                className="fixed bottom-5 right-5 z-30 flex items-center gap-2 rounded-full bg-slate-900 px-4 py-3 text-sm font-medium text-white shadow-lg lg:hidden"
            >
                <Users className="h-4 w-4" />
                Participants ({total})
            </button>

            {open && (
                <div className="fixed inset-0 z-50 bg-slate-900/50 lg:hidden" onClick={() => setOpen(false)}>
                    <div className="absolute right-0 top-0 h-full w-80 max-w-[85vw] overflow-y-auto bg-white p-5 shadow-xl" onClick={event => event.stopPropagation()}>
                        <div className="mb-5 flex items-center justify-between">
                            <h3 className="text-base font-semibold text-slate-900">Participants</h3>
                            <button type="button" onClick={() => setOpen(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100" aria-label="Close">
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        <PanelContent {...props} />
                    </div>
                </div>
            )}
        </>
    );
}

import { useContext, useEffect, useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { ArrowRight, BadgeCheck, Bot, Check, Crown, ShieldCheck, Sparkles, Zap } from "lucide-react";
import { UserContext } from "../context/ContextProvider";
import AppLayout from "../components/AppLayout";
import { Button, Card } from "../components/ui";
import { API, apiError } from "../lib/api";
import { formatDate } from "../lib/format";

const PREMIUM_PRICE = 99;
const CHECKOUT_SRC = "https://checkout.razorpay.com/v1/checkout.js";

const loadRazorpay = () => new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const existing = document.querySelector(`script[src="${CHECKOUT_SRC}"]`);
    if (existing) {
        existing.addEventListener("load", () => resolve(true), { once: true });
        existing.addEventListener("error", () => resolve(false), { once: true });
        return;
    }
    const script = document.createElement("script");
    script.src = CHECKOUT_SRC;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
});

const benefits = [
    { icon: Bot, title: "Unlimited AI guidance", text: "Step-by-step explanations and assignment-focused help whenever you need it." },
    { icon: Zap, title: "Priority experience", text: "Faster access to Gradely’s learning and productivity tools." },
    { icon: Sparkles, title: "Advanced study support", text: "Turn difficult coursework into clear concepts, hints and action plans." },
    { icon: ShieldCheck, title: "Secure checkout", text: "Payments are processed by Razorpay and verified by Gradely." }
];

export default function PaymentTest() {
    const { user } = useContext(UserContext);
    const [paying, setPaying] = useState(false);
    const [paidPayment, setPaidPayment] = useState(null);

    const loadPayments = async () => {
        try {
            const { data } = await axios.get(`${API}/payment/my-payments`);
            setPaidPayment((data.payments || []).find(payment => payment.status === "paid") || null);
        } catch {
            // Payment history is informational only.
        }
    };

    useEffect(() => {
        loadPayments();
    }, []);

    const handlePayment = async () => {
        setPaying(true);
        try {
            const loaded = await loadRazorpay();
            if (!loaded) throw new Error("Unable to load secure checkout. Check your connection and try again.");

            const { data: order } = await axios.post(`${API}/payment/create-order`, {
                amount: PREMIUM_PRICE * 100,
                purpose: "Gradely Premium"
            });

            const checkout = new window.Razorpay({
                key: order.keyId,
                amount: order.amount,
                currency: order.currency,
                name: "Gradely Premium",
                description: "Unlock the complete Gradely experience",
                order_id: order.orderId,
                prefill: { name: user?.name || "", email: user?.email || "" },
                theme: { color: "#4f46e5" },
                handler: async (response) => {
                    try {
                        await axios.post(`${API}/payment/verify`, {
                            paymentId: order.paymentId,
                            razorpayPaymentId: response.razorpay_payment_id,
                            razorpaySignature: response.razorpay_signature
                        });
                        toast.success("Welcome to Gradely Premium!");
                        await loadPayments();
                    } catch (err) {
                        toast.error(apiError(err, "Payment verification failed"));
                    } finally {
                        setPaying(false);
                    }
                },
                modal: { ondismiss: () => setPaying(false) }
            });

            checkout.on("payment.failed", (response) => {
                toast.error(response.error?.description || "Payment could not be completed");
                setPaying(false);
            });
            checkout.open();
        } catch (err) {
            toast.error(apiError(err, "Unable to start payment"));
            setPaying(false);
        }
    };

    return (
        <AppLayout>
            <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950 to-violet-950 p-6 text-white sm:p-10">
                <div className="grid items-center gap-10 lg:grid-cols-[1.15fr_.85fr]">
                    <section>
                        <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-1.5 text-sm font-medium text-amber-200">
                            <Crown className="h-4 w-4" /> Gradely Premium
                        </div>
                        <h1 className="max-w-2xl text-3xl font-bold tracking-tight sm:text-5xl">Learn faster. Submit smarter. Reach your best.</h1>
                        <p className="mt-4 max-w-xl text-base leading-7 text-indigo-100/75">Upgrade your Gradely experience with academic support built around your courses and assignments.</p>
                        <div className="mt-8 grid gap-3 sm:grid-cols-2">
                            {benefits.map(({ icon: Icon, title, text }) => (
                                <div key={title} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                    <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-500/20 text-indigo-200"><Icon className="h-5 w-5" /></div>
                                    <h2 className="text-sm font-semibold">{title}</h2>
                                    <p className="mt-1 text-sm leading-6 text-indigo-100/65">{text}</p>
                                </div>
                            ))}
                        </div>
                    </section>

                    <Card className="p-7 text-slate-900 shadow-2xl sm:p-8">
                        {paidPayment ? (
                            <div className="text-center">
                                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600"><BadgeCheck className="h-8 w-8" /></div>
                                <h2 className="text-2xl font-bold">You’re on Premium</h2>
                                <p className="mt-2 text-sm text-slate-500">Activated {formatDate(paidPayment.verifiedAt || paidPayment.createdAt)}. Thanks for supporting Gradely!</p>
                            </div>
                        ) : (
                            <>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600">Premium plan</p>
                                        <h2 className="mt-1 text-xl font-bold">Everything you need</h2>
                                    </div>
                                    <Crown className="h-8 w-8 text-amber-500" />
                                </div>
                                <div className="my-6 flex items-end gap-2">
                                    <span className="text-5xl font-bold">₹{PREMIUM_PRICE}</span>
                                    <span className="pb-1 text-sm text-slate-500">one-time</span>
                                </div>
                                <ul className="space-y-3 text-sm text-slate-700">
                                    {["AI-powered assignment assistance", "Personalized explanations and hints", "Priority access to new learning tools", "Secure, verified payment"].map(item => (
                                        <li key={item} className="flex gap-3"><span className="mt-0.5 rounded-full bg-emerald-100 p-1 text-emerald-700"><Check className="h-3 w-3" /></span>{item}</li>
                                    ))}
                                </ul>
                                <Button size="lg" className="mt-8 w-full" onClick={handlePayment} loading={paying}>
                                    {paying ? "Opening secure checkout..." : <>Upgrade to Premium <ArrowRight className="h-4 w-4" /></>}
                                </Button>
                                <p className="mt-3 text-center text-xs text-slate-400">Secure payment powered by Razorpay</p>
                            </>
                        )}
                    </Card>
                </div>
            </div>
        </AppLayout>
    );
}

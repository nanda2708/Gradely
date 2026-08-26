import { useContext, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import toast, { Toaster } from "react-hot-toast";
import { ArrowLeft, Bot, Check, Crown, Loader2, ShieldCheck, Sparkles, Zap } from "lucide-react";
import { UserContext } from "../context/ContextProvider";

const PREMIUM_PRICE = 99;

const loadRazorpay = () => new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const existing = document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
    if (existing) {
        existing.addEventListener("load", () => resolve(true), { once: true });
        existing.addEventListener("error", () => resolve(false), { once: true });
        return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
});

const benefits = [
    { icon: <Bot className="h-5 w-5" />, title: "Unlimited AI guidance", text: "Get step-by-step explanations and assignment-focused help whenever you need it." },
    { icon: <Zap className="h-5 w-5" />, title: "Priority experience", text: "Enjoy faster access to Gradely's learning and productivity tools." },
    { icon: <Sparkles className="h-5 w-5" />, title: "Advanced study support", text: "Turn difficult coursework into clear concepts, hints, and action plans." },
    { icon: <ShieldCheck className="h-5 w-5" />, title: "Secure checkout", text: "Payments are processed securely by Razorpay and verified by Gradely." }
];

export default function PaymentTest() {
    const { user } = useContext(UserContext);
    const navigate = useNavigate();
    const [paying, setPaying] = useState(false);

    const handlePayment = async () => {
        setPaying(true);
        try {
            const loaded = await loadRazorpay();
            if (!loaded) throw new Error("Unable to load secure checkout. Check your connection and try again.");

            const { data: order } = await axios.post(`${import.meta.env.VITE_BACKEND_URL}/payment/create-order`, {
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
                        await axios.post(`${import.meta.env.VITE_BACKEND_URL}/payment/verify`, {
                            paymentId: order.paymentId,
                            razorpayPaymentId: response.razorpay_payment_id,
                            razorpaySignature: response.razorpay_signature
                        });
                        toast.success("Welcome to Gradely Premium!");
                    } catch (err) {
                        toast.error(err.response?.data?.error || "Payment verification failed");
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
            console.error("Payment initialization failed:", err);
            toast.error(err.response?.data?.error || err.message || "Unable to start payment");
            setPaying(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 text-white">
            <Toaster position="top-center" />
            <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:py-14">
                <button onClick={() => navigate(-1)} className="mb-8 flex items-center gap-2 text-sm text-indigo-200 hover:text-white"><ArrowLeft className="h-4 w-4" /> Back to Gradely</button>
                <div className="grid items-center gap-10 lg:grid-cols-[1.15fr_.85fr]">
                    <section>
                        <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-amber-300/30 bg-amber-300/10 px-4 py-2 text-sm font-medium text-amber-200"><Crown className="h-4 w-4" /> Gradely Premium</div>
                        <h1 className="max-w-2xl text-4xl font-bold tracking-tight sm:text-6xl">Learn faster. Submit smarter. Reach your best.</h1>
                        <p className="mt-5 max-w-xl text-lg leading-8 text-indigo-100/75">Upgrade your Gradely experience with powerful academic support built around your courses and assignments.</p>
                        <div className="mt-9 grid gap-4 sm:grid-cols-2">
                            {benefits.map(({ icon, title, text }) => <div key={title} className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur"><div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-200">{icon}</div><h2 className="font-semibold">{title}</h2><p className="mt-1 text-sm leading-6 text-indigo-100/65">{text}</p></div>)}
                        </div>
                    </section>
                    <aside className="rounded-3xl border border-white/15 bg-white p-7 text-slate-900 shadow-2xl shadow-indigo-950/50 sm:p-9">
                        <div className="flex items-center justify-between"><div><p className="text-sm font-semibold uppercase tracking-wider text-indigo-600">Premium plan</p><h2 className="mt-1 text-2xl font-bold">Everything you need</h2></div><Crown className="h-9 w-9 text-amber-500" /></div>
                        <div className="my-7 flex items-end gap-2"><span className="text-5xl font-bold">{"\u20B9"}{PREMIUM_PRICE}</span><span className="pb-1 text-slate-500">one-time access</span></div>
                        <ul className="space-y-3 text-sm text-slate-700">{["AI-powered assignment assistance", "Personalized explanations and hints", "Priority access to new learning tools", "Secure, verified payment"].map(item => <li key={item} className="flex gap-3"><span className="mt-0.5 rounded-full bg-emerald-100 p-1 text-emerald-700"><Check className="h-3.5 w-3.5" /></span>{item}</li>)}</ul>
                        <button onClick={handlePayment} disabled={paying} className="mt-8 flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3.5 font-semibold text-white shadow-lg shadow-indigo-200 transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-400">{paying ? <><Loader2 className="h-5 w-5 animate-spin" /> Opening secure checkout...</> : <>Upgrade to Premium <ArrowLeft className="h-5 w-5 rotate-180" /></>}</button>
                        <p className="mt-4 text-center text-xs text-slate-400">Secure payment powered by Razorpay</p>
                    </aside>
                </div>
            </div>
        </div>
    );
}

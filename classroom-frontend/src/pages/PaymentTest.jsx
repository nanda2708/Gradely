import { useContext, useState } from "react";
import axios from "axios";
import toast, { Toaster } from "react-hot-toast";
import { UserContext } from "../context/ContextProvider";

const loadRazorpay = () => new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);

    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
});

export default function PaymentTest() {
    const { user } = useContext(UserContext);
    const [amount, setAmount] = useState("99");
    const [purpose, setPurpose] = useState("Gradely Premium Test");
    const [paying, setPaying] = useState(false);

    const handlePayment = async () => {
        const rupees = Number(amount);
        if (!Number.isFinite(rupees) || rupees < 1) {
            toast.error("Enter a valid amount of at least ₹1.");
            return;
        }
        if (!purpose.trim()) {
            toast.error("Enter a payment purpose.");
            return;
        }

        setPaying(true);
        try {
            const loaded = await loadRazorpay();
            if (!loaded) throw new Error("Unable to load Razorpay Checkout");

            const orderResponse = await axios.post(
                `${import.meta.env.VITE_BACKEND_URL}/payment/create-order`,
                {
                    amount: Math.round(rupees * 100),
                    purpose: purpose.trim()
                }
            );

            const order = orderResponse.data;
            const options = {
                key: order.keyId,
                amount: order.amount,
                currency: order.currency,
                name: "Gradely",
                description: purpose.trim(),
                order_id: order.orderId,
                prefill: {
                    name: user?.name || "",
                    email: user?.email || "",
                    contact: user?.phoneNumber || ""
                },
                handler: async (response) => {
                    try {
                        await axios.post(`${import.meta.env.VITE_BACKEND_URL}/payment/verify`, {
                            paymentId: order.paymentId,
                            razorpayPaymentId: response.razorpay_payment_id,
                            razorpaySignature: response.razorpay_signature
                        });
                        setPaying(false);
                        toast.success("Test payment verified successfully!");
                    } catch (err) {
                        setPaying(false);
                        toast.error(err.response?.data?.error || "Payment verification failed");
                    }
                },
                modal: {
                    ondismiss: () => setPaying(false)
                }
            };

            const checkout = new window.Razorpay(options);
            checkout.on("payment.failed", (response) => {
                console.error("Razorpay payment failed:", response.error);
                toast.error("Test payment failed or was cancelled.");
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
        <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
            <Toaster />
            <div className="w-full max-w-md bg-white rounded-xl shadow p-6">
                <h1 className="text-2xl font-bold text-gray-900">Razorpay Test Payment</h1>
                <p className="text-sm text-gray-500 mt-2">
                    This screen is intended for Razorpay Test Mode only. Do not use live credentials here.
                </p>

                <div className="space-y-4 mt-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Amount (INR)</label>
                        <input
                            type="number"
                            min="1"
                            step="1"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            className="w-full px-3 py-2 border rounded-lg"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Purpose</label>
                        <input
                            value={purpose}
                            onChange={(e) => setPurpose(e.target.value)}
                            className="w-full px-3 py-2 border rounded-lg"
                        />
                    </div>

                    <button
                        onClick={handlePayment}
                        disabled={paying}
                        className="w-full py-2.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-400"
                    >
                        {paying ? "Opening Checkout..." : "Pay in Test Mode"}
                    </button>
                </div>
            </div>
        </div>
    );
}

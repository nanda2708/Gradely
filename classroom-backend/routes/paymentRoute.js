import { Router } from "express";
import crypto from "crypto";
import Payment from "../models/payment.js";
import { requireRole } from "../middleware/roleMiddleware.js";

const paymentRouter = Router();
const MAX_AMOUNT_PAISE = 50000000;

const getUserModel = (role) => ({
    student: "Student",
    faculty: "Faculty",
    ta: "TA"
}[role]);

paymentRouter.post("/create-order", requireRole("student", "faculty", "ta"), async (req, res) => {
    try {
        const { amount, purpose } = req.body;
        const numericAmount = Number(amount);

        if (!Number.isInteger(numericAmount) || numericAmount < 100 || numericAmount > MAX_AMOUNT_PAISE) {
            return res.status(400).json({ error: "Amount must be an integer between 100 and 50,000,000 paise" });
        }
        if (!purpose?.trim()) {
            return res.status(400).json({ error: "Payment purpose is required" });
        }
        if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
            return res.status(503).json({ error: "Razorpay is not configured on this server" });
        }

        const receipt = `gradely_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
        const auth = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString("base64");

        const razorpayResponse = await fetch("https://api.razorpay.com/v1/orders", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Basic ${auth}`
            },
            body: JSON.stringify({
                amount: numericAmount,
                currency: "INR",
                receipt,
                notes: {
                    purpose: purpose.trim(),
                    user_id: req.mongoUser._id.toString(),
                    environment: process.env.RAZORPAY_ENVIRONMENT || "test"
                },
                capture: "automatic"
            })
        });

        const data = await razorpayResponse.json();
        if (!razorpayResponse.ok) {
            console.error("Razorpay order creation failed:", data);
            return res.status(502).json({ error: "Unable to create Razorpay order" });
        }

        const payment = await Payment.create({
            user: req.mongoUser._id,
            userModel: getUserModel(req.userRole),
            purpose: purpose.trim(),
            amount: numericAmount,
            currency: "INR",
            razorpayOrderId: data.id,
            status: "created"
        });

        return res.status(201).json({
            keyId: process.env.RAZORPAY_KEY_ID,
            orderId: data.id,
            amount: data.amount,
            currency: data.currency,
            paymentId: payment._id
        });
    } catch (err) {
        console.error("Error creating payment order:", err);
        return res.status(500).json({ error: "Failed to create payment order" });
    }
});

paymentRouter.post("/verify", requireRole("student", "faculty", "ta"), async (req, res) => {
    try {
        const { paymentId, razorpayPaymentId, razorpaySignature } = req.body;
        if (!paymentId || !razorpayPaymentId || !razorpaySignature) {
            return res.status(400).json({ error: "Payment verification fields are required" });
        }
        if (!process.env.RAZORPAY_KEY_SECRET) {
            return res.status(503).json({ error: "Razorpay is not configured on this server" });
        }

        const payment = await Payment.findOne({
            _id: paymentId,
            user: req.mongoUser._id,
            userModel: getUserModel(req.userRole)
        });
        if (!payment) return res.status(404).json({ error: "Payment record not found" });

        if (payment.status === "paid") {
            return res.status(200).json({ verified: true, message: "Payment already verified" });
        }

        const expected = crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
            .update(`${payment.razorpayOrderId}|${razorpayPaymentId}`)
            .digest("hex");

        const expectedBuffer = Buffer.from(expected, "hex");
        const receivedBuffer = Buffer.from(razorpaySignature, "hex");
        const valid = expectedBuffer.length === receivedBuffer.length &&
            crypto.timingSafeEqual(expectedBuffer, receivedBuffer);

        if (!valid) return res.status(400).json({ error: "Invalid payment signature" });

        payment.razorpayPaymentId = razorpayPaymentId;
        payment.razorpaySignature = razorpaySignature;
        payment.status = "paid";
        payment.verifiedAt = new Date();
        await payment.save();

        return res.status(200).json({ verified: true, paymentId: payment._id });
    } catch (err) {
        console.error("Error verifying payment:", err);
        return res.status(500).json({ error: "Failed to verify payment" });
    }
});

paymentRouter.get("/my-payments", requireRole("student", "faculty", "ta"), async (req, res) => {
    try {
        const payments = await Payment.find({
            user: req.mongoUser._id,
            userModel: getUserModel(req.userRole)
        }).sort({ createdAt: -1 }).select("purpose amount currency razorpayOrderId razorpayPaymentId status verifiedAt createdAt");
        return res.status(200).json({ payments });
    } catch (err) {
        console.error("Error getting payments:", err);
        return res.status(500).json({ error: "Failed to get payments" });
    }
});

export default paymentRouter;

import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        refPath: "userModel"
    },
    userModel: {
        type: String,
        required: true,
        enum: ["Student", "Faculty", "TA"]
    },
    purpose: {
        type: String,
        required: true,
        trim: true
    },
    amount: {
        type: Number,
        required: true,
        min: 100
    },
    currency: {
        type: String,
        default: "INR",
        uppercase: true
    },
    razorpayOrderId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    razorpayPaymentId: {
        type: String,
        unique: true,
        sparse: true,
        index: true
    },
    razorpaySignature: String,
    status: {
        type: String,
        enum: ["created", "paid", "failed"],
        default: "created",
        index: true
    },
    verifiedAt: Date
}, { timestamps: true });

export default mongoose.model("Payment", paymentSchema);

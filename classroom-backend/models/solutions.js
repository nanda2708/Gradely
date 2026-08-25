import { mongoose, Schema } from "mongoose";

const solutionSchema = new Schema(
    {
        filename: { type: String, default: "Solution" },
        url: { type: String, required: true },
        publicId: { type: String },
        assignment: { type: Schema.Types.ObjectId, ref: "Assignment", required: true },
        student: { type: Schema.Types.ObjectId, ref: "Student", required: true },
        status: {
            type: String,
            enum: ["pending", "graded", "overdue"],
            default: "pending"
        },
        submittedDate: { type: Date, default: Date.now },
        grade: { type: String, default: "" },
        marks: { type: Number, default: 0 },
        feedback: { type: String, default: "" },
        gradedBy: {
            type: Schema.Types.ObjectId,
            refPath: "gradedByRole",
            default: null
        },
        gradedByRole: {
            type: String,
            enum: ["TA", "Faculty"],
            default: "TA"
        },
        checkedDate: { type: Date, default: null },
        reevalRequested: { type: Boolean, default: false }
    },
    {
        collection: "solutions",
        timestamps: true
    }
);

const Solution = mongoose.models.Solution || mongoose.model("Solution", solutionSchema);
export default Solution;

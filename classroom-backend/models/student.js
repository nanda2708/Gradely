import { mongoose, Schema } from "mongoose";

const studentSchema = new Schema(
    {
        name: { type: String, required: true, trim: true },
        email: { type: String, unique: true, required: true, lowercase: true, trim: true },
        phoneNumber: { type: String, trim: true },
        emailVerified: { type: Boolean, default: false },
        phoneVerified: { type: Boolean, default: false },
        courses: [{ type: Schema.Types.ObjectId, ref: "Course" }],
        solutions: [{ type: Schema.Types.ObjectId, ref: "Solution" }]
    },
    { collection: "student", timestamps: true }
);

const Student = mongoose.models.Student || mongoose.model("Student", studentSchema);
export default Student;

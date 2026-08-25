import { mongoose, Schema } from "mongoose";

const taSchema = new Schema(
    {
        name: { type: String, required: true, trim: true },
        email: { type: String, unique: true, required: true, lowercase: true, trim: true },
        phoneNumber: { type: String, trim: true },
        emailVerified: { type: Boolean, default: false },
        phoneVerified: { type: Boolean, default: false },
        courses: [{ type: Schema.Types.ObjectId, ref: "Course" }],
        faculty: [{ type: Schema.Types.ObjectId, ref: "Faculty" }],
        checked: [{ type: Schema.Types.ObjectId, ref: "Solution" }]
    },
    { collection: "ta", timestamps: true }
);

const TA = mongoose.models.TA || mongoose.model("TA", taSchema);
export default TA;

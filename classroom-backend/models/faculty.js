import { mongoose, Schema } from "mongoose";

const facultySchema = new Schema(
    {
        name: { type: String, required: true, trim: true },
        email: { type: String, unique: true, required: true, lowercase: true, trim: true },
        phoneNumber: { type: String, trim: true },
        emailVerified: { type: Boolean, default: false },
        phoneVerified: { type: Boolean, default: false },
        courses: [{ type: Schema.Types.ObjectId, ref: "Course" }],
        assignments: [{ type: Schema.Types.ObjectId, ref: "Assignment" }]
    },
    { collection: "faculty", timestamps: true }
);

const Faculty = mongoose.models.Faculty || mongoose.model("Faculty", facultySchema);
export default Faculty;

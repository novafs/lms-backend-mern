import mongoose from "mongoose";
import { string } from "zod";
import { required } from "zod/mini";
import courseModel from "./courseModel.js";

const courseDetailModel = mongoose.Schema({
    title: {
        type: string,
        required: true
    },
    type: {
        type: string,
        enum: ['video', 'text'],
        default: 'video'
    },
    youtubeId: String,
    text: String,
    course: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Course'
    }
}, {timestamps: true}
)

courseDetailModel.post('findOneAndDelete', async(doc) => {
    if (doc) {
        await courseModel.findByIdAndUpdate(doc.course, {
            $pull: {
                details: doc._id
            }
        })
    }
})

export default mongoose.model('CourseDetail', courseDetailModel)
import mongoose from "mongoose";
import { string } from "zod";
import { required } from "zod/mini";

const categoryModel = mongoose.Schema({
    name: {
        type: string,
        required: true
    },
    courses: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Course'
            
        }
    ]
}, {
    timestamps: true
})

export default mongoose.model('Category', categoryModel)
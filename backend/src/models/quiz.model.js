import mongoose, { Schema } from "mongoose";
const { ObjectId } = Schema.Types;


const questionSchema = new mongoose.Schema({
    type: { type: String, enum: [ "mcq", "true_false", "short_answer"] },
    question: String,
    options: [ String ],
    answer: String,
    explanation: String,
    _id: false
})

const quizAttemptSchema = new mongoose.Schema({
    score: Number, 
    total: Number,
    completedAt: {
        type: Date,
        default: Date.now,
    },
    _id: false
});

const quizSchema = new mongoose.Schema({
    note: { type: ObjectId, ref: "Notes", required: true },
    user: { type: ObjectId, ref: "User", required: true },
    quizType: { type: String, enum: ["quiz", "flashcard"] },
    questions: [questionSchema],
    attempts: [quizAttemptSchema],
    generatedAt: {
        type: Date,
        default: Date.now,
        expires: 60 * 60 * 24 * 14 // 14-day TTL automatic cleanup
    }
}, { timestamps: true, versionKey: false });

const Quiz = mongoose.model("Quiz", quizSchema)
export default Quiz;
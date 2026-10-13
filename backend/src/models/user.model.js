import mongoose from "mongoose";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
const userSchema = new mongoose.Schema({
    name:{
        type: String,
        trim: true,
        required: false,
    },
    email:{
        type:String,
        required: [true, "Email is required"],
        unique: true,
        lowercase: true,
        trim: true,
    },
    password:{
        type: String,
        required: function () {
            return this.provider === "local";
        },
        minlength: [6, "Password must be at least 6 characters"],
        select: false,
        default: undefined,
    },
    googleId: {
        type: String,
        default: undefined,
    },
    avatar: String,
    provider: {
        type: String,
        enum: ["local", "google"],
        default: "local"
    },
    refreshToken: [
        {
            token: {
                type: String,
                required: true,
            },
            createdAt: {
                type: Date,
                default: Date.now,
            }
        },
    ],
    forgotPasswordToken: { type: String, select: false},
    forgotPasswordExpiry: { type: Date, select: false},
    isVerified: {
        type: Boolean,
        default: false,
    },
    verificationToken: { type: String, select: false},
    verificationTokenExpires: { type: Date, select: false},
    preferences: {
        theme: { type: String, enum: ["light", "dark", "system"], default: "system"},
        editorFontSize: { type: Number, default: 18, min: 12, max: 28 },
        focusMode: { type: Boolean, default: false },
    },
    plan: {
    tier: { 
        type: String, 
        enum: ["free", "pro", "enterprise"], 
        default: "free" 
    },
    status: { 
        type: String, 
        enum: ["active", "trialing", "past_due", "canceled"], 
        default: "active" 
    },
    currentPeriodEnd: { type: Date, default: null },
    customTokenLimit: { type: Number, default: null },
},
    aiUsage: {
        dailyCount: { type: Number, default: 0},
        dailyTokens: { type: Number, default: 0 },
        dailyInputTokens: { type: Number, default: 0 },
        dailyOutputTokens: { type: Number, default: 0 },
        lastResetAt: { type: Date, default: Date.now },
        modelBreakdown: {
        type: Map,
        of: {
            promptTokens: { type: Number, default: 0 },
            completionTokens: { type: Number, default: 0 },
            totalTokens: { type: Number, default: 0 },
        },
        default: {},
    },
}
} , {timestamps: true});

userSchema.index(
    { googleId: 1 },
    {
        unique: true,
        partialFilterExpression: { googleId: { $type: "string" } },
    }
);

userSchema.pre("save", async function(next) {
    if(!this.isModified("password") || !this.password) return next();

    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
})

userSchema.methods.generateAccessToken = function () {
    return jwt.sign(
        {id: this._id},
        process.env.ACCESS_SECRET,
        { expiresIn: process.env.ACCESS_EXPIRE || "1h" }
    );
};

userSchema.methods.generateRefreshToken = function () {
    return jwt.sign(
        { id: this._id },
        process.env.REFRESH_SECRET,
        { expiresIn: process.env.REFRESH_EXPIRE || "7d" }
    )
}
userSchema.methods.comparePassword = async function (candidatePassword) {
    if (!this.password) return false;
    return await bcrypt.compare(candidatePassword, this.password);
}


const User = mongoose.model("User", userSchema);
export default User;

import express from "express";
    import { initiateGoogleAuth, registerUser, verifyEmail, resendVerification, loginUser, desktopLogin, getAllUsers, refreshToken, logoutUser, getMe, googleCallback, forgotPassword, resetPassword, getShowcaseUsers, exchangeCode } from "../controllers/auth.controller.js";
    import authMiddleware from "../middleware/auth.middleware.js";
    import verifiedMiddleware from "../middleware/verified.middleware.js";
    import passport from "passport";


    const router = express.Router();
    //public routes
    router.post("/register", registerUser);
    router.post("/login", loginUser);
    router.post("/desktop/login", desktopLogin);
    router.post("/exchange-code", exchangeCode);
    router.post("/resend-verification", resendVerification);
    router.post("/forgot-password", forgotPassword);
    router.post("/reset-password/:token", resetPassword);

    router.get("/verify-email/:token", verifyEmail);
    router.post("/refresh", refreshToken);
    router.get("/google", initiateGoogleAuth);
    router.get("/google/callback", passport.authenticate("google", { session: false }), googleCallback);
    router.get("/showcase", getShowcaseUsers);

    //protected routes
    router.post("/logout", authMiddleware, logoutUser);
    router.get("/me", authMiddleware, getMe);

    //For testing purpose
    router.get("/", authMiddleware, verifiedMiddleware, getAllUsers);

    export default router;

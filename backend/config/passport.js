import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { findOrCreateGoogleUser } from "../src/services/auth.service.js";

passport.use(
    new GoogleStrategy(
        {
            clientID: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            callbackURL: process.env.GOOGLE_CALLBACK_URL || (process.env.NODE_ENV === "production" ? "https://fullstack-notes-app-xluo.onrender.com/api/users/google/callback" : "http://localhost:5500/api/users/google/callback")
        },
        async (accessToken, refreshToken, profile, done) => {
            try {
                const user = await findOrCreateGoogleUser(profile);
                return done(null, user);
            } catch (error) {
                done(error, null);
            }
        }
    )
);

export default passport;
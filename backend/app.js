import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import passport from "./config/passport.js";

import authRoute from "./src/routes/auth.route.js";
import notesRoute from "./src/routes/notes.route.js";
import folderRoute from "./src/routes/folder.route.js";
import aiRoute from "./src/routes/aiRoute.js";
import trashRoute from "./src/routes/trash.route.js";
import publicRoute from "./src/routes/public.route.js";
import studyRoute from "./src/routes/study.route.js";
import userRoute from "./src/routes/user.route.js";
import sttRoute from "./src/routes/stt.route.js";
import workflowRoute from "./src/routes/workflow.route.js";

import errorMiddleware from "./src/middleware/error.middleware.js";

const app = express();

app.set("trust proxy", 1);

app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ limit: "15mb", extended: true }));
app.use(cookieParser());

app.use(
    cors({
        origin: [
            "https://notesify.in",
            "https://www.notesify.in",
            "https://app.notesify.in",
            "https://notesify-eta.vercel.app",
            "https://notesify-home.vercel.app",
            "http://localhost:5173",
            "http://localhost:5500",
            "http://127.0.0.1:5173",
            "http://127.0.0.1:5500",
        ],
        credentials: true,
    }),
);

app.use("/api/public", publicRoute);

app.use(passport.initialize());

app.use("/api/users", authRoute);
app.use("/api/notes", notesRoute);
app.use("/api/folders", folderRoute);
app.use("/api/ai", aiRoute);
app.use("/api/trash", trashRoute);
app.use("/api/study", studyRoute);
app.use("/api/user", userRoute);
app.use("/api/stt", sttRoute);
app.use("/api/workflows", workflowRoute);

app.get("/api/keep-alive", (req, res) => {
    res.status(200).json({ status: "alive" });
});

app.get("/", (req, res) => {
    res.status(200).send("API is running");
});

app.use(errorMiddleware);

export default app;

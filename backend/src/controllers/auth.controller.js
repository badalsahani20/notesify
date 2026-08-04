import User from "../models/user.model.js";
import * as AuthService from "../services/auth.service.js";
import catchAsync from "../utils/catchAsync.js";
import crypto from "crypto";
import * as MailService from "../services/mail.service.js";
import { redis } from "../../config/redis.js";
import passport from "passport";

const hashRefreshToken = (token) =>
  crypto.createHash("sha256").update(token).digest("hex");

const getRefreshCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: process.env.NODE_ENV === "production" ? "None" : "Lax",
  maxAge: 7 * 24 * 60 * 60 * 1000,
});

const getRefreshCookieClearOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: process.env.NODE_ENV === "production" ? "None" : "Lax",
});

export const registerUser = catchAsync(async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res
      .status(400)
      .json({ message: "Please provide name, email and password" });
  }

  const { user, verificationToken } = await AuthService.registerUser({
    name,
    email,
    password,
  });

  const verificationUrl = `${process.env.FRONTEND_URL}/verify-email/${verificationToken}`;
  await MailService.sendVerificationEmail(email, name, verificationUrl);

  res.status(201).json({
    success: true,
    message: "Registration successful! Please check your email to verify your account.",
    user: { id: user._id, name: user?.name, email: user.email, avatar: user.avatar, isVerified: user.isVerified },
  });
});

export const verifyEmail = catchAsync(async (req, res) => {
  const { token } = req.params;
  console.log("BACKEND: Verification started for token:", token);
  
  const { user, accessToken, refreshToken } = await AuthService.verifyUserEmail(token);
  console.log("BACKEND: Verification successful for user:", user.email);

  res.cookie("refreshToken", refreshToken, getRefreshCookieOptions());
  res.status(200).json({
    success: true,
    message: "Email verified successfully.",
    accessToken,
    user: { id: user._id, name: user?.name, email: user.email, avatar: user.avatar, isVerified: user.isVerified },
  });
});

export const resendVerification = catchAsync(async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ message: "Please provide your email address" });
  }

  await AuthService.resendVerificationToken(email);

  res.status(200).json({
    success: true,
    message: "A new verification email has been sent. Please check your inbox.",
  });
});


export const loginUser = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res
      .status(400)
      .json({ message: "Please provide email and password" });
  }

  //Call the service to handle login logic
  const { user, accessToken, refreshToken } = await AuthService.loginUser(email, password);

  res.cookie("refreshToken", refreshToken, getRefreshCookieOptions());
  res.status(200).json({
    success: true,
    accessToken,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      isVerified: user.isVerified,
    },
  });
  // const user = await User.findOne({email});
  // if(!user) return res.status(400).json({message: "User does not exist"});

  // const isMatch = await bcrypt.compare(password, user.password);
  // if(!isMatch) return res.status(400).json({message: "Invalid credentials"});

  // const token = jwt.sign({ id: user._id}, process.env.JWT_SECRET, {
  //     expiresIn: "1d",
  // });

  // res.json({ message : "Login successful", user, token});
});

export const getAllUsers = catchAsync(async (req, res, next) => {
  const users = await AuthService.fetchAllUsers();
  res.status(200).json({ success: true, users});
});

export const getShowcaseUsers = catchAsync(async (req, res, next) => {
  // Get the 5 most-recently joined users that have a real avatar first,
  // then fall back to any recent users to fill up to 5 total
  const withAvatar = await User.find({ avatar: { $exists: true, $ne: "" } })
    .select("name avatar provider createdAt")
    .sort({ createdAt: -1 })
    .limit(5);

  let users = withAvatar;

  if (users.length < 5) {
    const withAvatarIds = users.map((u) => u._id);
    const rest = await User.find({ _id: { $nin: withAvatarIds } })
      .select("name avatar provider createdAt")
      .sort({ createdAt: -1 })
      .limit(5 - users.length);
    users = [...users, ...rest];
  }

  res.status(200).json({ success: true, users });
});


export const refreshToken = catchAsync(async (req, res, next) => {
  const clientRefreshToken = req.cookies.refreshToken ?? req.get("X-Refresh-Token");

  const { accessToken, refreshToken, user } = await AuthService.refreshAccessToken(clientRefreshToken);

  res.cookie("refreshToken", refreshToken, getRefreshCookieOptions());

  res.status(200).json({
    success: true,
    accessToken,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      isVerified: user.isVerified,
    }
  })
})

export const logoutUser = catchAsync(async (req, res, next) => {
  const clientRefreshToken = req.cookies.refreshToken ?? req.get("X-Refresh-Token");
  
  await AuthService.logoutUser(clientRefreshToken);
  res.clearCookie("refreshToken", getRefreshCookieClearOptions());

  res.json({ message: "Logged out successfully" });
});

export const getMe = catchAsync(async (req, res, next) => {
  const user = await AuthService.getUserById(req.user._id);

  res.status(200).json({
    success: true,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      isVerified: user.isVerified,
    },
  });
});

export const desktopLogin = catchAsync(async (req, res) => {
    const {
        email,
        password,
        code_challenge,
        redirect_uri,
        clientId,
        clientType,
    } = req.body;

    const emailVal = email?.trim();
    const passwordVal = password;
    const codeChallenge = code_challenge?.trim();
    const redirectUri = redirect_uri?.trim();
    const clientIdVal = clientId?.trim();
    const clientTypeVal = clientType?.trim();

    if (!emailVal || !passwordVal || !codeChallenge || !redirectUri) {
        return res.status(400).json({
            message: "All fields are required.",
        });
    }

    const clientIdFinal = clientIdVal || "notesify-desktop";
    const clientTypeFinal = clientTypeVal || "desktop";

    if (!ALLOWED_CLIENT_TYPES.includes(clientTypeFinal)) {
        return res.status(400).json({
            message: "Invalid client type.",
        });
    }

    if (!ALLOWED_DESKTOP_REDIRECTS.includes(redirectUri)) {
        return res.status(400).json({
            message: "Invalid redirect URI.",
        });
    }

    // Authenticate credentials.
    // Tokens are issued only after the authorization code exchange.
    const user = await AuthService.verifyCredentials(
        emailVal,
        passwordVal
    );

    const authorizationCode =
        crypto.randomBytes(32).toString("hex");

    const authorizationCodeData = {
        userId: user._id.toString(),
        clientId: clientIdFinal,
        clientType: clientTypeFinal,
        codeChallenge,
        redirectUri,
    };

    await redis.set(
        `authorization_code:${authorizationCode}`,
        JSON.stringify(authorizationCodeData),
        { ex: 60 }
    );

    return res.status(200).json({
        success: true,
        authorizationCode,
        redirectUri
    });
});

const ALLOWED_DESKTOP_REDIRECTS = [
  "notesify://callback",
  "https://localhost:5500/oauth-success",
  
];

const ALLOWED_CLIENT_TYPES = ["desktop", "mobile"];


export const initiateGoogleAuth = catchAsync(async (req, res, next) => {
    const { code_challenge, redirect_uri, clientId, clientType } = req.query;

    const codeChallenge = code_challenge?.trim();
    const redirectUri = redirect_uri?.trim();
    const clientIdValue = clientId?.trim();
    const clientTypeValue = clientType?.trim();

    let oauthState;

    // Determine whether this request is initiating a PKCE flow
    const isPkceFlow =
        codeChallenge !== undefined || redirectUri !== undefined;

    if(isPkceFlow) {
        // Both parameters are required for PKCE
        if(!codeChallenge || !redirectUri) {
            return res.status(400).json({
                message: "Both code_challenge and redirect_uri are required.",
            });
        }

        const clientIdFinal = clientIdValue || "notesify-desktop";
        const clientTypeFinal = clientTypeValue || "desktop";

        const allowedClientTypes = ["desktop", "mobile"];

        if(!allowedClientTypes.includes(clientTypeFinal)) {
            return res.status(400).json({
                message: "Invalid client type.",
            });
        }

        // Prevent open redirect attacks
        if(!ALLOWED_DESKTOP_REDIRECTS.includes(redirectUri)) {
            return res.status(400).json({
                message: "Invalid redirect URI.",
            });
        }

        oauthState = crypto.randomBytes(16).toString("hex");

        const oauthStateData = {
            codeChallenge: codeChallenge,
            redirectUri: redirectUri,
            clientId: clientIdFinal,
            clientType: clientTypeFinal,
        };

        await redis.set(
            `oauth_state:${oauthState}`,
            JSON.stringify(oauthStateData),
            { ex: 300 }
        );
    }

    passport.authenticate("google", {
        scope: ["profile", "email"],
        state: oauthState,
        session: false,
    })(req, res, next);
});


export const googleCallback = catchAsync(async (req, res) => {
    const user = req.user;
    const { state } = req.query;

    let oauthStateData = null;

    // PKCE/Desktop flow
    if (state) {
        const rawState = await redis.get(`oauth_state:${state}`);
        if (rawState) await redis.del(`oauth_state:${state}`);

        if (!rawState) {
          return res.redirect(`${process.env.FRONTEND_URL}/login?error=Invalid+or+expired+OAuth+state`);
        }

        oauthStateData = typeof rawState === "string" ? JSON.parse(rawState) : rawState;
    }

    const authorizationCode = crypto.randomBytes(32).toString("hex");

    let authCodeData;
    let targetRedirectUri;

    if (oauthStateData) {
        authCodeData = {
            userId: user._id.toString(),
            clientId: oauthStateData.clientId,
            clientType: oauthStateData.clientType,
            codeChallenge: oauthStateData.codeChallenge,
            redirectUri: oauthStateData.redirectUri,
        };

        const redirectUrl = new URL(oauthStateData.redirectUri);
        redirectUrl.searchParams.set("code", authorizationCode);

        targetRedirectUri = redirectUrl.toString();
    } else {
        // Standard web OAuth flow
        authCodeData = {
            userId: user._id.toString(),
            clientId: "notesify-web",
            clientType: "web",
        };

        const redirectUrl = new URL(
            `${process.env.FRONTEND_URL}/oauth-success`
        );
        redirectUrl.searchParams.set("code", authorizationCode);

        targetRedirectUri = redirectUrl.toString();
    }

    await redis.set(
        `authorization_code:${authorizationCode}`,
        JSON.stringify(authCodeData),
        { ex: 60 }
    );

    res.redirect(targetRedirectUri);
});

export const exchangeCode = catchAsync(async (req, res) => {
    const code = req.body.code?.trim();
    const codeVerifier = req.body.code_verifier?.trim();

    if (!code) {
        return res.status(400).json({
            message: "Authorization code is required.",
        });
    }

    // 1. Consume the authorization code
    const rawAuthorizationCodeData = await redis.get(`authorization_code:${code}`);
    if (rawAuthorizationCodeData) await redis.del(`authorization_code:${code}`);

    if (!rawAuthorizationCodeData) {
        return res.status(400).json({
            message: "Invalid or expired authorization code.",
        });
    }

    const authorizationCodeData = typeof rawAuthorizationCodeData === "string" 
        ? JSON.parse(rawAuthorizationCodeData) 
        : rawAuthorizationCodeData;

    // 2. PKCE Verification (Desktop / Mobile only)
    const isPkceFlow = Boolean(authorizationCodeData.codeChallenge);

    if (isPkceFlow) {
        if (!codeVerifier) {
            return res.status(400).json({
                message: "code_verifier is required.",
            });
        }

        const computedChallenge = crypto
            .createHash("sha256")
            .update(codeVerifier)
            .digest("base64url");

        const expected = Buffer.from(authorizationCodeData.codeChallenge);
        const actual = Buffer.from(computedChallenge);

        if (
            expected.length !== actual.length ||
            !crypto.timingSafeEqual(expected, actual)
        ) {
            return res.status(401).json({
                message: "Invalid code_verifier.",
            });
        }
    }

    // 3. Lookup authenticated user
    const user = await User.findById(authorizationCodeData.userId);

    if (!user) {
        return res.status(404).json({
            message: "User not found.",
        });
    }

    // 4. Generate tokens
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    // 5. Store hashed refresh token
    const hashedRefreshToken = hashRefreshToken(refreshToken);

    const MAX_ACTIVE_SESSIONS = 5;

    await User.updateOne(
        { _id: user._id },
        {
            $push: {
                refreshToken: {
                    $each: [{ token: hashedRefreshToken }],
                    $slice: -MAX_ACTIVE_SESSIONS,
                },
            },
        }
    );

    // 6. Session creation (temporary until AuthSession is implemented)
    const userAgent = req.get("User-Agent") || "Unknown Device";

    // TODO:
    // await AuthSessionService.create({
    //     userId: user._id,
    //     clientId: authorizationCodeData.clientId,
    //     clientType: authorizationCodeData.clientType,
    //     refreshToken,
    //     userAgent,
    //     ip: req.ip,
    // });

    // 7. Common response payload
    const responsePayload = {
        success: true,
        accessToken,
        user: {
            id: user._id,
            name: user.name,
            email: user.email,
            avatar: user.avatar,
            isVerified: user.isVerified,
        },
    };

    // 8. Deliver refresh token according to client type
    if (
        ["desktop", "mobile"].includes(
            authorizationCodeData.clientType
        )
    ) {
        responsePayload.refreshToken = refreshToken;
    } else {
        res.cookie(
            "refreshToken",
            refreshToken,
            getRefreshCookieOptions()
        );
    }

    return res.status(200).json(responsePayload);
});


export const forgotPassword = catchAsync(async(req, res) => {
  const { email } = req.body;

  //Let the service handle the logic
  const resetToken = await AuthService.generatePasswordResetToken(email);

  //Construct the URL
  const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;

  //For now, log it (Setting up emil is next step)
  await MailService.sendResetPasswordEmail(email, resetUrl);

  res.status(200).json({
    success: true,
    message: "A reset link has been sent to your email."
  });
});

export const resetPassword = catchAsync(async(req, res) => {
  const{ token } = req.params;
  const { password } = req.body;
  await AuthService.resetUserPassword(token, password);

  res.status(200).json({
    success: true,
    message: "Password reset successfully. You can now login with your new password."
  });
});
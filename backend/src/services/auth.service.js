import User from "../models/user.model.js";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { createWelcomeNote } from "./notes.service.js";
import { sendVerificationEmail, sendWelcomeEmail } from "./mail.service.js";

const hashRefreshToken = (token) =>
  crypto.createHash("sha256").update(token).digest("hex");

export const registerUser = async (userData) => {
  //Check for duplicates
  const existingUser = await User.findOne({ email: userData.email });
  if(existingUser) {
    const error = new Error("Email already exists, please Login");
    error.statusCode = 400;
    throw error;
  }

  //Data logic
  const verificationToken = crypto.randomBytes(32).toString("hex");
  const hashedToken = crypto
    .createHash("sha256")
    .update(verificationToken)
    .digest("hex");

  const user = await User.create({
    ...userData,
    verificationToken: hashedToken,
    verificationTokenExpires: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
    provider: "local",
    isVerified: false,
  });
  
  return { user, verificationToken };
};

export const verifyUserEmail = async (token) => {
  const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

  const user = await User.findOne({
    verificationToken: hashedToken,
    verificationTokenExpires: { $gt: Date.now() },
  });

  if (!user) {
    const error = new Error("Link is invalid or has expired");
    error.statusCode = 400;
    throw error;
  }

  //Mark as verified
  user.isVerified = true;
  user.verificationToken = undefined;
  user.verificationTokenExpires = undefined;

  const accessToken = user.generateAccessToken();
  const refreshToken = user.generateRefreshToken();
  const hashedRefreshToken = hashRefreshToken(refreshToken);

  // Add new token and keep only last 5
  user.refreshToken.push({ token: hashedRefreshToken });
  if (user.refreshToken.length > 5) {
    user.refreshToken = user.refreshToken.slice(-5);
  }

  await user.save();

  await createWelcomeNote(user._id);

  sendWelcomeEmail(user.email, user.name).catch((err) =>
    console.error("Welcome email failed:", err),
  );

  return { user, accessToken, refreshToken };
};

export const resendVerificationToken = async(email) => {
  const user = await User.findOne({email});
  if(!user) {
    const error = new Error("User not found please sign Up");
    error.statusCode = 404;
    throw error;
  }

  if(user.isVerified) {
    const error = new Error("Account is already verified. Please log in.");
    error.statusCode = 400;
    throw error;
  }

  const rawToken = crypto.randomBytes(32).toString("hex");
  const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex");

  user.verificationToken = hashedToken;
  user.verificationTokenExpires = Date.now() + 24 * 60 * 60 * 1000;
  await user.save();

  const verificationUrl = `${process.env.FRONTEND_URL}/verify-email/${rawToken}`;

  await sendVerificationEmail(user.email, user.name, verificationUrl).catch((err) => {
    console.error("Resend verification email failed:", err);
  });

  return { success: true };
}

export const verifyCredentials = async (email, password) => {
    const user = await User.findOne({ email }).select("+password +verificationToken");
    if(!user) {
        const error = new Error("No account Found, Please sign up.");
        error.statusCode = 404;
        throw error;
    }

    if(!user.password && user.provider === "google") {
        const error = new Error("This account was created using Google. Please log in with Google.");
        error.statusCode = 400;
        throw error;
    }

    if(!user.isVerified) {
        if(!user.verificationToken) {
            user.isVerified = true;
            await user.save();
        } else {
            const error = new Error("Please verify your email address before logging in");
            error.statusCode = 400;
            throw error;
        }
    }

    const isMatch = await user.comparePassword(password);
    if(!isMatch) {
        const error = new Error("Incorrect Password or Username");
        error.statusCode = 400;
        throw error;
    }

    return user;
}


export const loginUser = async (email, password) => {
  const user = await verifyCredentials(email, password);

  const accessToken = user.generateAccessToken();
  const refreshToken = user.generateRefreshToken(); 

  //Hash the refresh token before storing
  const hashedRefreshToken = hashRefreshToken(refreshToken);

  // Add new token and keep only last 5
  user.refreshToken.push({ token: hashedRefreshToken });
  if (user.refreshToken.length > 5) {
    user.refreshToken = user.refreshToken.slice(-5);
  }

  await user.save();

  return { user, accessToken, refreshToken };
};

export const refreshAccessToken = async (refreshTokenFromCookie) => {
  if (!refreshTokenFromCookie) {
    const error = new Error("No refresh token provided");
    error.statusCode = 401;
    throw error;
  }

  let decoded;

  try {
    decoded = jwt.verify(refreshTokenFromCookie, process.env.REFRESH_SECRET);
  } catch (error) {
    const err = new Error("Invalid refresh token");
    err.statusCode = 401;
    throw err;
  }

  const user = await User.findById(decoded.id);

  //If no user -> reject
  if (!user) {
    const error = new Error("Invalid refresh token");
    error.statusCode = 401;
    throw error;
  }

  const hashedToken = hashRefreshToken(refreshTokenFromCookie);

  const tokenExists = user.refreshToken.some((t) => t.token === hashedToken);

  if (!tokenExists) {
    //Likely a stale/replayed token. Clear server-side sessions defensively.
    await User.updateOne({ _id: user._id }, { $set: { refreshToken: [] } });

    const error = new Error("Refresh token reuse detected");
    error.statusCode = 403;
    throw error;
  }
  const newAccessToken = user.generateAccessToken();
  const newRefreshToken = user.generateRefreshToken();
  const newHashedToken = hashRefreshToken(newRefreshToken);
  const rotatedTokens = [
    ...user.refreshToken.filter((t) => t.token !== hashedToken),
    { token: newHashedToken },
  ].slice(-5);

  const rotationResult = await User.updateOne(
    { _id: user._id, "refreshToken.token": hashedToken },
    { $set: { refreshToken: rotatedTokens } },
  );

  if (rotationResult.modifiedCount === 0) {
    const error = new Error("Refresh token already rotated");
    error.statusCode = 401;
    throw error;
  }

  // return {user: user accessToken: newAccessToken, refreshToken: newRefreshToken };
  return { user, accessToken: newAccessToken, refreshToken: newRefreshToken };
};

export const logoutUser = async (refreshTokenFromCookie) => {
  if (!refreshTokenFromCookie) {
    const error = new Error("No refresh token provided");
    error.statusCode = 400;
    throw error;
  }

  const hashedToken = hashRefreshToken(refreshTokenFromCookie);

  await User.updateOne(
    { "refreshToken.token": hashedToken },
    { $pull: { refreshToken: { token: hashedToken } } },
  );
};

export const getUserById = async (userId) => {
  const user = await User.findById(userId).select("-password");
  if (!user) {
    const error = new Error("User not found");
    error.statusCode = 404;
    throw error;
  }
  return user;
};

export const fetchAllUsers = async () => {
  return User.find().select("-password");
};

export const findOrCreateGoogleUser = async (profile) => {
  const email = profile?.emails[0]?.value;

  if (!email) {
    throw new Error("Google account did not provide an email");
  }

  let user = await User.findOne({
    $or: [{ googleId: profile.id }, { email }],
  });

  if (!user) {
    user = await User.create({
      googleId: profile.id,
      email,
      name: profile.displayName || email.split("@")[0],
      avatar: profile.photos?.[0]?.value || "",
      provider: "google",
      isVerified: true,
    });

    //Add welcome note
    await createWelcomeNote(user._id);

    //Send welcome email
    sendWelcomeEmail(user.email, user.name).catch((err) =>
      console.error("Welcome email failed (Google):", err),
    );
  } else if (!user.googleId) {
    //existing email user linking google account
    user.googleId = profile.id;
    user.provider = "google";
    if (!user.name) {
      user.name = profile.displayName || email.split("@")[0];
    }
    user.isVerified = true;
    await user.save();
  }

  // if an existing user log in but their name is still empty
  if (user && !user.name) {
    user.name = profile.displayName || email.split("@")[0];
    await user.save();
  }

  // retroactively pull the google avatar if they never had one before
  if (user && !user.avatar && profile.photos?.[0]?.value) {
    user.avatar = profile.photos[0].value;
    await user.save();
  }

  // Ensure any successful Google login marks the user as verified
  if (user && !user.isVerified) {
    user.isVerified = true;
    await user.save();
  }

  return user;
};

// Forgot password
export const generatePasswordResetToken = async (email) => {
  const user = await User.findOne({ email });
  if (!user) {
    const error = new Error("User not found");
    error.statusCode = 404;
    throw error;
  }
  //Generate plain text token
  const resetToken = crypto.randomBytes(20).toString("hex");
  //Generate hashed token to store in DB
  const hashedToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");

  user.forgotPasswordToken = hashedToken;
  user.forgotPasswordExpiry = Date.now() + 15 * 60 * 1000;
  await user.save();
  return resetToken;
};

export const resetUserPassword = async (token, newPassword) => {
  //Hash the incoming plain text token to compare
  const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

  //Find user with valid token and not expired one
  const user = await User.findOne({
    forgotPasswordToken: hashedToken,
    forgotPasswordExpiry: { $gt: Date.now() },
  });

  if (!user) {
    const error = new Error("Token is invalid or has expired");
    error.statusCode = 400;
    throw error;
  }

  //Update password (pre save hook will hash this)
  user.password = newPassword;
  user.forgotPasswordToken = undefined;
  user.forgotPasswordExpiry = undefined;

  user.refreshToken = [];

  await user.save();

  return user;
};

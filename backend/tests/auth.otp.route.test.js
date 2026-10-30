import { jest } from "@jest/globals";
import request from "supertest";

let lastSentOtp = null;
let lastSentUrl = null;

// Mock only mail.service to capture the generated 6-digit OTP
jest.unstable_mockModule("../src/services/mail.service.js", () => ({
  sendWelcomeEmail: jest.fn().mockResolvedValue(true),
  sendVerificationEmail: jest.fn().mockImplementation((email, name, url, otp) => {
    lastSentOtp = otp;
    lastSentUrl = url;
    return Promise.resolve(true);
  }),
  sendResetPasswordEmail: jest.fn().mockResolvedValue(true),
}));

const app = (await import("../app.js")).default;
const User = (await import("../src/models/user.model.js")).default;

describe("Authentication & 6-Digit OTP Route Integration Tests", () => {
  beforeEach(() => {
    lastSentOtp = null;
    lastSentUrl = null;
  });

  describe("POST /api/users/register and POST /api/users/verify-otp", () => {
    it("should register a user, send 6-digit OTP, verify via OTP, and allow login", async () => {
      // 1. Register new user
      const registerRes = await request(app)
        .post("/api/users/register")
        .send({
          name: "Mobile User",
          email: "mobile@notesify.app",
          password: "password123",
        });

      expect(registerRes.status).toBe(201);
      expect(registerRes.body.success).toBe(true);
      expect(registerRes.body.user.email).toBe("mobile@notesify.app");
      expect(registerRes.body.user.isVerified).toBe(false);

      // Verify that 6-digit OTP was generated and passed to mailer
      expect(lastSentOtp).toBeDefined();
      expect(lastSentOtp).toMatch(/^\d{6}$/);

      // 2. Unverified user cannot log in yet
      const loginAttempt = await request(app)
        .post("/api/users/login")
        .send({
          email: "mobile@notesify.app",
          password: "password123",
        });

      expect(loginAttempt.status).toBe(400);
      expect(loginAttempt.body.message).toContain("Please verify your email address");

      // 3. Verify using the 6-digit OTP
      const verifyRes = await request(app)
        .post("/api/users/verify-otp")
        .send({
          email: "mobile@notesify.app",
          otp: lastSentOtp,
        });

      expect(verifyRes.status).toBe(200);
      expect(verifyRes.body.success).toBe(true);
      expect(verifyRes.body.accessToken).toBeDefined();
      expect(verifyRes.body.refreshToken).toBeDefined();
      expect(verifyRes.body.user.isVerified).toBe(true);

      // Verify refresh cookie was set for web clients
      const cookies = verifyRes.headers["set-cookie"];
      expect(cookies).toBeDefined();
      expect(cookies.some((c) => c.includes("refreshToken"))).toBe(true);

      // 4. User can now log in successfully
      const loginSuccess = await request(app)
        .post("/api/users/login")
        .send({
          email: "mobile@notesify.app",
          password: "password123",
        });

      expect(loginSuccess.status).toBe(200);
      expect(loginSuccess.body.accessToken).toBeDefined();
      expect(loginSuccess.body.user.email).toBe("mobile@notesify.app");
    });

    it("should reject verification with missing email or OTP", async () => {
      const res1 = await request(app)
        .post("/api/users/verify-otp")
        .send({ email: "test@example.com" });
      expect(res1.status).toBe(400);

      const res2 = await request(app)
        .post("/api/users/verify-otp")
        .send({ otp: "123456" });
      expect(res2.status).toBe(400);
    });

    it("should reject verification with wrong OTP code", async () => {
      await request(app)
        .post("/api/users/register")
        .send({
          name: "Wrong Code User",
          email: "wrong@notesify.app",
          password: "password123",
        });

      const res = await request(app)
        .post("/api/users/verify-otp")
        .send({
          email: "wrong@notesify.app",
          otp: "000000",
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe("Invalid or expired verification code");
    });

    it("should reject verification if OTP is expired", async () => {
      await request(app)
        .post("/api/users/register")
        .send({
          name: "Expired Code User",
          email: "expired@notesify.app",
          password: "password123",
        });

      expect(lastSentOtp).toBeDefined();

      // Expire OTP in DB
      await User.updateOne(
        { email: "expired@notesify.app" },
        { $set: { verificationOtpExpires: new Date(Date.now() - 5000) } }
      );

      const res = await request(app)
        .post("/api/users/verify-otp")
        .send({
          email: "expired@notesify.app",
          otp: lastSentOtp,
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe("Invalid or expired verification code");
    });
  });

  describe("POST /api/users/resend-verification", () => {
    it("should generate and send a new 6-digit OTP when requested", async () => {
      await request(app)
        .post("/api/users/register")
        .send({
          name: "Resend Route User",
          email: "resend-route@notesify.app",
          password: "password123",
        });

      const firstOtp = lastSentOtp;
      expect(firstOtp).toBeDefined();

      // Request resend
      const resendRes = await request(app)
        .post("/api/users/resend-verification")
        .send({ email: "resend-route@notesify.app" });

      expect(resendRes.status).toBe(200);
      expect(resendRes.body.success).toBe(true);

      const secondOtp = lastSentOtp;
      expect(secondOtp).toBeDefined();
      expect(secondOtp).toMatch(/^\d{6}$/);

      // Verify with second OTP
      const verifyRes = await request(app)
        .post("/api/users/verify-otp")
        .send({
          email: "resend-route@notesify.app",
          otp: secondOtp,
        });

      expect(verifyRes.status).toBe(200);
      expect(verifyRes.body.user.isVerified).toBe(true);
    });
  });
});

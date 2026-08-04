import { jest } from '@jest/globals';

// Mock the mail and notes services so we don't send emails or hit external APIs during tests
jest.unstable_mockModule('../../src/services/mail.service.js', () => ({
  sendWelcomeEmail: jest.fn().mockResolvedValue(true),
  sendVerificationEmail: jest.fn().mockResolvedValue(true),
  sendResetPasswordEmail: jest.fn().mockResolvedValue(true),
}));

jest.unstable_mockModule('../../src/services/notes.service.js', () => ({
  createWelcomeNote: jest.fn().mockResolvedValue(true),
}));

const AuthService = await import('../../src/services/auth.service.js');
import User from '../../src/models/user.model.js';
import crypto from 'crypto';

describe('Auth Service', () => {
  describe('registerUser', () => {
    it('should successfully register a new user and return a verification token', async () => {
      const userData = { name: 'Test User', email: 'test@example.com', password: 'password123' };
      const { user, verificationToken } = await AuthService.registerUser(userData);

      expect(user).toBeDefined();
      expect(user.email).toBe(userData.email);
      expect(user.name).toBe(userData.name);
      expect(user.isVerified).toBe(false);
      expect(user.password).not.toBe(userData.password); // Password should be hashed
      expect(verificationToken).toBeDefined();

      // Verify token was stored hashed in the db
      const hashedToken = crypto.createHash("sha256").update(verificationToken).digest("hex");
      expect(user.verificationToken).toBe(hashedToken);
    });

    it('should throw an error if the email already exists', async () => {
      const userData = { name: 'Test User', email: 'test2@example.com', password: 'password123' };
      await AuthService.registerUser(userData);

      // Attempt to register again
      await expect(AuthService.registerUser(userData)).rejects.toThrow('Email already exists, please Login');
    });
  });

  describe('verifyUserEmail', () => {
    it('should successfully verify a user and return tokens', async () => {
      const userData = { name: 'Verify User', email: 'verify@example.com', password: 'password123' };
      const { user, verificationToken } = await AuthService.registerUser(userData);

      const result = await AuthService.verifyUserEmail(verificationToken);

      expect(result.user).toBeDefined();
      expect(result.user.isVerified).toBe(true);
      expect(result.user.verificationToken).toBeUndefined();
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
    });

    it('should throw an error if token is invalid', async () => {
      await expect(AuthService.verifyUserEmail('invalid-token')).rejects.toThrow('Link is invalid or has expired');
    });
  });

  describe('loginUser', () => {
    beforeEach(async () => {
      const userData = { name: 'Login User', email: 'login@example.com', password: 'password123' };
      const { verificationToken } = await AuthService.registerUser(userData);
      await AuthService.verifyUserEmail(verificationToken);
    });

    it('should successfully log in a verified user', async () => {
      const result = await AuthService.loginUser('login@example.com', 'password123');

      expect(result.user).toBeDefined();
      expect(result.user.email).toBe('login@example.com');
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
    });

    it('should throw an error with incorrect password', async () => {
      await expect(AuthService.loginUser('login@example.com', 'wrongpassword')).rejects.toThrow('Incorrect Password or Username');
    });

    it('should throw an error if user does not exist', async () => {
      await expect(AuthService.loginUser('nonexistent@example.com', 'password123')).rejects.toThrow('No account Found, Please sign up.');
    });

    it('should throw an error if user is not verified', async () => {
      const userData = { name: 'Unverified', email: 'unverified@example.com', password: 'password123' };
      await AuthService.registerUser(userData);

      await expect(AuthService.loginUser('unverified@example.com', 'password123')).rejects.toThrow('Please verify your email address before logging in');
    });
  });

  describe('resendVerificationToken', () => {
    it('should successfully generate a new token and send verification email for unverified user', async () => {
      const userData = { name: 'Resend User', email: 'resend@example.com', password: 'password123' };
      await AuthService.registerUser(userData);

      const result = await AuthService.resendVerificationToken('resend@example.com');
      expect(result.success).toBe(true);

      const user = await User.findOne({ email: 'resend@example.com' }).select('+verificationToken +verificationTokenExpires');
      expect(user.verificationToken).toBeDefined();
      expect(new Date(user.verificationTokenExpires).getTime()).toBeGreaterThan(Date.now());
    });

    it('should throw an error if user is already verified', async () => {
      const userData = { name: 'Verified User', email: 'verified@example.com', password: 'password123' };
      const { verificationToken } = await AuthService.registerUser(userData);
      await AuthService.verifyUserEmail(verificationToken);

      await expect(AuthService.resendVerificationToken('verified@example.com')).rejects.toThrow('Account is already verified. Please log in.');
    });

    it('should throw an error if user is not found', async () => {
      await expect(AuthService.resendVerificationToken('notfound@example.com')).rejects.toThrow('User not found please sign Up');
    });
  });
});


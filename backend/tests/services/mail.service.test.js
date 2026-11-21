import { jest } from '@jest/globals';

const mockSendMail = jest.fn();
const mockVerify = jest.fn();

jest.unstable_mockModule('nodemailer', () => ({
    default: {
        createTransport: jest.fn(() => ({
            sendMail: mockSendMail,
            verify: mockVerify,
        })),
    },
}));

// Set test environment variables
process.env.MAIL_USER = 'testsender@notesify.app';
process.env.MAIL_PASS = 'abcd 1234 efgh 5678';
process.env.MAIL_HOST = 'smtp.test.com';
process.env.MAIL_PORT = '465';
process.env.FRONTEND_URL = 'https://test.notesify.app';

const {
    sendResetPasswordEmail,
    sendWelcomeEmail,
    sendVerificationEmail,
    verifyMailConnection,
} = await import('../../src/services/mail.service.js');

describe('Mail Service', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('verifyMailConnection', () => {
        it('should successfully verify SMTP connection', async () => {
            mockVerify.mockResolvedValueOnce(true);

            const result = await verifyMailConnection();
            expect(result).toBe(true);
            expect(mockVerify).toHaveBeenCalledTimes(1);
        });

        it('should propagate error if SMTP verification fails', async () => {
            mockVerify.mockRejectedValueOnce(new Error('SMTP Auth Failed'));

            await expect(verifyMailConnection()).rejects.toThrow('SMTP Auth Failed');
            expect(mockVerify).toHaveBeenCalledTimes(1);
        });
    });

    describe('sendResetPasswordEmail', () => {
        it('should send reset password email with proper options and URL', async () => {
            mockSendMail.mockResolvedValueOnce({ messageId: 'reset-123' });

            const email = 'user@example.com';
            const resetUrl = 'https://test.notesify.app/reset-password/abc123token';

            await sendResetPasswordEmail(email, resetUrl);

            expect(mockSendMail).toHaveBeenCalledTimes(1);
            const callArgs = mockSendMail.mock.calls[0][0];

            expect(callArgs.to).toBe(email);
            expect(callArgs.subject).toContain('Reset Your Notesify Password');
            expect(callArgs.from).toContain('Notesify');
            expect(callArgs.from).toContain('testsender@notesify.app');
            expect(callArgs.html).toContain(resetUrl);
            expect(callArgs.html).toContain('15 minutes');
        });

        it('should throw an error when sending reset email fails', async () => {
            mockSendMail.mockRejectedValueOnce(new Error('Connection error'));

            await expect(
                sendResetPasswordEmail('fail@example.com', 'https://test.com/reset')
            ).rejects.toThrow('Failed to send reset email');
        });
    });

    describe('sendWelcomeEmail', () => {
        it('should send welcome email using first name', async () => {
            mockSendMail.mockResolvedValueOnce({ messageId: 'welcome-123' });

            const email = 'alice@example.com';
            const fullName = 'Alice Wonderland';

            await sendWelcomeEmail(email, fullName);

            expect(mockSendMail).toHaveBeenCalledTimes(1);
            const callArgs = mockSendMail.mock.calls[0][0];

            expect(callArgs.to).toBe(email);
            expect(callArgs.subject).toContain('Welcome to Notesify, Alice!');
            expect(callArgs.html).toContain('Welcome aboard, Alice!');
            expect(callArgs.html).toContain('https://test.notesify.app');
            expect(callArgs.html).toContain('AI-Powered Assistant');
        });

        it('should fall back to "there" when name is missing', async () => {
            mockSendMail.mockResolvedValueOnce({ messageId: 'welcome-456' });

            await sendWelcomeEmail('noname@example.com', null);

            const callArgs = mockSendMail.mock.calls[0][0];
            expect(callArgs.subject).toContain('Welcome to Notesify, there!');
            expect(callArgs.html).toContain('Welcome aboard, there!');
        });

        it('should throw an error when sending welcome email fails', async () => {
            mockSendMail.mockRejectedValueOnce(new Error('Network failure'));

            await expect(
                sendWelcomeEmail('fail@example.com', 'User')
            ).rejects.toThrow('Failed to send welcome email');
        });
    });

    describe('sendVerificationEmail', () => {
        it('should include OTP code in subject and body when OTP is provided', async () => {
            mockSendMail.mockResolvedValueOnce({ messageId: 'verify-123' });

            const email = 'bob@example.com';
            const name = 'Bob Smith';
            const verifyUrl = 'https://test.notesify.app/verify/xyz';
            const otp = '987654';

            await sendVerificationEmail(email, name, verifyUrl, otp);

            expect(mockSendMail).toHaveBeenCalledTimes(1);
            const callArgs = mockSendMail.mock.calls[0][0];

            expect(callArgs.to).toBe(email);
            expect(callArgs.subject).toContain('987654 is your Notesify verification code');
            expect(callArgs.html).toContain('Confirm your email, Bob!');
            expect(callArgs.html).toContain('987654');
            expect(callArgs.html).toContain(verifyUrl);
        });

        it('should render standard subject when OTP is not provided', async () => {
            mockSendMail.mockResolvedValueOnce({ messageId: 'verify-456' });

            const email = 'carol@example.com';
            const verifyUrl = 'https://test.notesify.app/verify/linkonly';

            await sendVerificationEmail(email, '', verifyUrl);

            const callArgs = mockSendMail.mock.calls[0][0];
            expect(callArgs.subject).toBe('Verify your Notesify account 📧');
            expect(callArgs.html).toContain('Confirm your email, friend!');
            expect(callArgs.html).toContain(verifyUrl);
            expect(callArgs.html).not.toContain('Your 6-Digit Verification Code');
        });

        it('should throw an error when sending verification email fails', async () => {
            mockSendMail.mockRejectedValueOnce(new Error('SMTP timeout'));

            await expect(
                sendVerificationEmail('fail@example.com', 'User', 'https://test.com', '123456')
            ).rejects.toThrow('Failed to send verification email');
        });
    });
});

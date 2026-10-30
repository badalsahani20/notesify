import { describe, it, expect } from "vitest";

// Helper functions mirroring VerifyEmailPage's internal logic
export const sanitizeOtpInput = (val: string): string => val.replace(/\D/g, "");

export const parsePastedOtp = (pastedText: string): string[] => {
  const digits = sanitizeOtpInput(pastedText).slice(0, 6);
  const otp = ["", "", "", "", "", ""];
  for (let i = 0; i < digits.length; i++) {
    otp[i] = digits[i];
  }
  return otp;
};

export const maskEmail = (email: string | null | undefined): string | null => {
  if (!email) return null;
  const [localPart, domain] = email.split("@");
  if (!localPart || !domain) return email;
  return `${localPart.slice(0, 2)}${"*".repeat(Math.max(1, localPart.length - 2))}@${domain}`;
};

export const isOtpComplete = (otp: string[]): boolean => {
  return otp.length === 6 && otp.every((d) => d.length === 1 && /\d/.test(d));
};

describe("OTP Input & Email Masking Utilities", () => {
  describe("sanitizeOtpInput", () => {
    it("should strip non-digit characters", () => {
      expect(sanitizeOtpInput("12a3b4")).toBe("1234");
      expect(sanitizeOtpInput("  98 76 ")).toBe("9876");
      expect(sanitizeOtpInput("abc-def")).toBe("");
    });
  });

  describe("parsePastedOtp", () => {
    it("should parse standard 6-digit text and populate an array of 6 digits", () => {
      const result = parsePastedOtp("482910");
      expect(result).toEqual(["4", "8", "2", "9", "1", "0"]);
      expect(isOtpComplete(result)).toBe(true);
    });

    it("should parse text containing spaces or dashes from SMS/email notification", () => {
      const result = parsePastedOtp("482-910");
      expect(result).toEqual(["4", "8", "2", "9", "1", "0"]);
      expect(isOtpComplete(result)).toBe(true);
    });

    it("should handle partial pastes without overflow", () => {
      const result = parsePastedOtp("123");
      expect(result).toEqual(["1", "2", "3", "", "", ""]);
      expect(isOtpComplete(result)).toBe(false);
    });

    it("should truncate strings longer than 6 digits", () => {
      const result = parsePastedOtp("123456789");
      expect(result).toEqual(["1", "2", "3", "4", "5", "6"]);
      expect(isOtpComplete(result)).toBe(true);
    });
  });

  describe("maskEmail", () => {
    it("should mask local part retaining first 2 letters", () => {
      expect(maskEmail("john.doe@example.com")).toBe("jo******@example.com");
      expect(maskEmail("badal@notesify.in")).toBe("ba***@notesify.in");
    });

    it("should handle short local parts gracefully", () => {
      expect(maskEmail("ab@test.com")).toBe("ab*@test.com");
      expect(maskEmail("a@test.com")).toBe("a*@test.com");
    });

    it("should return null for empty or null inputs", () => {
      expect(maskEmail(null)).toBeNull();
      expect(maskEmail("")).toBeNull();
    });

    it("should return original string if not an email format", () => {
      expect(maskEmail("invalid-email")).toBe("invalid-email");
    });
  });

  describe("isOtpComplete", () => {
    it("should return true only when all 6 entries are single digits", () => {
      expect(isOtpComplete(["1", "2", "3", "4", "5", "6"])).toBe(true);
      expect(isOtpComplete(["1", "2", "3", "4", "5", ""])).toBe(false);
      expect(isOtpComplete(["1", "2", "3", "4", "", ""])).toBe(false);
      expect(isOtpComplete([])).toBe(false);
    });
  });
});

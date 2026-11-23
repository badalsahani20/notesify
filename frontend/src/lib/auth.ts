import api from "./api";
import { clearAllLocalState } from "./state";
import { getStoredRefreshToken } from "./refreshTokenStorage";

export interface User {
    id: string;
    email: string;
    name?: string;
}

export interface AuthSuccessResponse {
    success: boolean;
    message: string;
    accessToken: string;
    refreshToken?: string;
    user: {
        id?: string;
        _id?: string;
        name?: string;
        email: string;
        avatar?: string;
        isVerified: boolean;
    }
}

export interface MessageResponse {
    success?: boolean;
    message: string;
}

export const requestPasswordReset = async (email: string): Promise<MessageResponse> => {
    const response = await api.post<MessageResponse>("/users/forgot-password", { email: email.trim() });
    return response.data;
}

export const resetPassword = async ( token: string, password: string ): Promise<MessageResponse> => {
    const response = await api.post<MessageResponse>(`/users/reset-password/${token}` , {
        password
    });
    return response.data;
}

export const verifyOtp = async ( email: string, otp: string ) : Promise<AuthSuccessResponse> => {
    const response = await api.post<AuthSuccessResponse>("/users/verify-otp", {
        email: email.trim(),
        otp: otp.trim(),
    });
    return response.data;
}

export const verifyEmailToken = async (token: string) : Promise<AuthSuccessResponse> => {
    const response = await api.get<AuthSuccessResponse> (`/users/verify-email/${token}`);
    return response.data;
}

export const resendVerificationOtp = async (
  email: string
): Promise<MessageResponse> => {
  const response = await api.post<MessageResponse>("/users/resend-verification", {
    email: email.trim(),
  });
  return response.data;
};

// * Validate the session by calling the /me endpoint.
export const checkAuth = async (): Promise<User | null> => {
    try {
        const response = await api.get("/users/me");
        return response.data;
    } catch {
        return null;
    }
}

// * Logs out by calling the backend to clear the HttpOnly cookies.
export const logout = async () => {
    try {
        // Native/desktop clients keep the refresh token outside the cookie jar,
        // so send it explicitly to revoke the correct rotated token server-side.
        const refreshToken = await getStoredRefreshToken();
        await api.post(
            "/users/logout",
            {},
            { headers: refreshToken ? { "X-Refresh-Token": refreshToken } : {} },
        );
    } catch (error) {
        console.error("Logout failed on server", error);
    } finally {
        // Always clear local state even if server request fails.
        // PrivateRoute and React Router's Navigate handle declarative redirection
        // to /login without forcing an invalid file:///login browser navigation in Electron.
        clearAllLocalState();
    }
}

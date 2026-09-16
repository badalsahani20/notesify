import api from "./api";
import { clearAllLocalState } from "./state";

export interface User {
    id: string;
    email: string;
    name?: string;
}

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
        await api.post("/users/logout");
    } catch (error) {
        console.error("Logout failed on server", error);
    } finally {
        // Always clear local state even if server request fails.
        // PrivateRoute and React Router's Navigate handle declarative redirection
        // to /login without forcing an invalid file:///login browser navigation in Electron.
        clearAllLocalState();
    }
}

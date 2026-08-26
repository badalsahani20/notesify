import { Navigate, Outlet } from "react-router-dom";
import { useAuthStore } from "@/store/useAuthStore";

import WelcomeLoader from "./ui/WelcomeLoader";

const PrivateRoute = () => {
  const { user, accessToken, authChecked } = useAuthStore();

  if (!authChecked) {
    return <WelcomeLoader />;
  }

  // Online: requires valid user + accessToken
  // Offline: allows local workspace bootstrap if user profile is available locally
  const isAuthenticated = Boolean(user && (accessToken || !navigator.onLine));

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (user && !user.isVerified) {
    return <Navigate to="/verify-email" replace />;
  }

  return <Outlet />;
};

export default PrivateRoute;

import React from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { Loader2 } from "lucide-react";

interface AuthGuardProps {
  children: React.ReactNode;
}

const AuthGuard: React.FC<AuthGuardProps> = ({ children }) => {
  const { isAuthenticated, isLoading, loginWithRedirect } = useAuth0();

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen text-white bg-gradient-to-r from-purple-900 via-indigo-900 to-black">
        <Loader2 className="animate-spin w-8 h-8 mr-2" />
        <span>Ładowanie...</span>
      </div>
    );
  }

  if (!isAuthenticated) {
    loginWithRedirect();
    return null;
  }

  return <>{children}</>;
};

export default AuthGuard;

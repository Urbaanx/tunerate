import React, { useEffect, useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface AuthGuardProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
  requiredPermission?: string;
}

const parseJwt = (jwt: string | null) => {
  if (!jwt) return null;
  try {
    const payload = jwt.split(".")[1];
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
};

const AuthGuard: React.FC<AuthGuardProps> = ({
  children,
  requireAdmin = false,
  requiredPermission = "admin",
}) => {
  const {
    isAuthenticated,
    isLoading,
    loginWithRedirect,
    getAccessTokenSilently,
  } = useAuth0();
  const [checkingPerms, setCheckingPerms] = useState(false);
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;
    if (!requireAdmin) {
      setAllowed(true);
      return;
    }

    if (!isAuthenticated) {
      setAllowed(false);
      return;
    }

    setCheckingPerms(true);
    const audience = import.meta.env.VITE_AUTH0_AUDIENCE;

    getAccessTokenSilently({
      authorizationParams: { audience, scope: "openid profile email" },
    })
      .then((token) => {
        if (!mounted) return;
        const payload = parseJwt(token);
        if (!payload) {
          setAllowed(false);
        } else {
          const perms = payload.permissions ?? payload.permission ?? null;
          let ok = false;
          if (Array.isArray(perms)) ok = perms.includes(requiredPermission);
          else if (typeof perms === "string")
            ok = perms.split(" ").includes(requiredPermission);
          setAllowed(ok);
        }
      })
      .catch(() => {
        if (mounted) setAllowed(false);
      })
      .finally(() => {
        if (mounted) setCheckingPerms(false);
      });

    return () => {
      mounted = false;
    };
  }, [
    requireAdmin,
    isAuthenticated,
    getAccessTokenSilently,
    requiredPermission,
  ]);

  if (isLoading || checkingPerms || allowed === null) {
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

  if (requireAdmin && !allowed) {
    return (
      <div className="flex flex-col items-center justify-center h-screen text-white bg-gradient-to-r from-purple-900 via-indigo-900 to-black p-6">
        <h1 className="text-2xl font-bold mb-4">Brak dostępu</h1>
        <p className="mb-4">Ta strona wymaga uprawnień administratora.</p>
        <div className="flex gap-3">
          <button
            onClick={() => navigate("/")}
            className="px-4 py-2 bg-blue-600 rounded-lg"
          >
            Powrót na stronę główną
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default AuthGuard;

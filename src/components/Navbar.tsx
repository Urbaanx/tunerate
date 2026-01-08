import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth0 } from "@auth0/auth0-react";
import {
  Home,
  Search,
  Library,
  LayoutDashboard,
  Users,
  Bell,
  MessagesSquare,
  Info,
  Menu,
  X,
  Shield,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  useGetApiSocialShares,
  useGetApiSocialRequests,
  useGetApiUsersByAuth0idAuth0Id,
} from "../api/endpoints/tunerateApi";
import { useGetApiChatUnreadCounts } from "../api/endpoints/tunerateApi";
import { HubConnectionBuilder, HubConnection } from "@microsoft/signalr";
import { useQueryClient } from "@tanstack/react-query";

const Navbar: React.FC = () => {
  const {
    isAuthenticated,
    loginWithRedirect,
    logout,
    user,
    getAccessTokenSilently,
  } = useAuth0();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const queryClient = useQueryClient();
  const [hubConnection, setHubConnection] =
    React.useState<HubConnection | null>(null);

  const audience = import.meta.env.VITE_AUTH0_AUDIENCE;

  useEffect(() => {
    if (!isAuthenticated) {
      setToken(null);
      setIsAdmin(false);
      return;
    }
    let mounted = true;
    getAccessTokenSilently({
      authorizationParams: {
        audience: audience,
        scope: "openid profile email",
      },
    })
      .then((t) => {
        if (mounted) setToken(t);
      })
      .catch(() => {
        if (mounted) {
          setToken(null);
          setIsAdmin(false);
        }
      });
    return () => {
      mounted = false;
    };
  }, [isAuthenticated, getAccessTokenSilently, audience]);

  const parseJwt = (jwt: string | null) => {
    if (!jwt) return null;
    try {
      const payload = jwt.split(".")[1];
      const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split("")
          .map(function (c) {
            return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
          })
          .join("")
      );
      return JSON.parse(jsonPayload);
    } catch {
      return null;
    }
  };

  useEffect(() => {
    if (!token) {
      setIsAdmin(false);
      return;
    }
    const payload = parseJwt(token);
    if (!payload) {
      setIsAdmin(false);
      return;
    }

    const perms = payload.permissions ?? payload.permission ?? null;
    let adminFound = false;

    if (Array.isArray(perms)) {
      adminFound = perms.includes("admin");
    } else if (typeof perms === "string") {
      adminFound = perms.split(" ").includes("admin");
    }

    setIsAdmin(adminFound);
  }, [token]);

  const requestOptions = token
    ? {
        request: { headers: { Authorization: `Bearer ${token}` } },
        query: {
          enabled: true,
          refetchInterval: 5000,
          refetchIntervalInBackground: true,
        },
      }
    : { query: { enabled: false } };

  const sharesQuery = useGetApiSocialShares<any, unknown>(requestOptions);
  const requestsQuery = useGetApiSocialRequests<any, unknown>(requestOptions);

  const shares = sharesQuery.data ?? [];
  const requests = requestsQuery.data ?? [];
  const unreadShares = Array.isArray(shares)
    ? (shares as any[]).filter((s) => !(s.isRead ?? s.IsRead ?? false)).length
    : 0;
  const unreadRequests = Array.isArray(requests)
    ? (requests as any[]).length
    : 0;
  const unreadMessagesQuery = useGetApiChatUnreadCounts<any, unknown>(
    requestOptions
  );
  const unreadNotificationsCount = unreadShares + unreadRequests;
  const unreadMessagesTotal = unreadMessagesQuery.data?.total ?? 0;

  const handleLogout = () => {
    logout({ logoutParams: { returnTo: window.location.origin } });
  };

  const toggleMenu = () => setMenuOpen(!menuOpen);

  const { data: localUser } = useGetApiUsersByAuth0idAuth0Id<any, unknown>(
    user?.sub ?? ""
  );

  const isDbUser =
    !!user &&
    (user.sub?.startsWith?.("auth0|") ||
      user?.identities?.[0]?.provider === "auth0");

  const displayName = isDbUser
    ? localUser?.nickname ?? user?.username ?? user?.nickname ?? user?.email
    : user?.name ?? user?.email;

  const initialsSource = isDbUser
    ? localUser?.nickname ?? user?.name ?? user?.email
    : user?.name ?? user?.email;

  const initials = initialsSource
    ? initialsSource
        .split(" ")
        .map((s: string) => s[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "U";

  const NavItem: React.FC<{
    to: string;
    icon: React.ElementType;
    label: string;
    onClick?: () => void;
  }> = ({ to, icon: Icon, label, onClick }) => (
    <Link
      to={to}
      onClick={onClick}
      className="flex items-center gap-2 text-sm text-gray-100 hover:text-white transition"
    >
      <Icon className="w-4 h-4 text-gray-200" aria-hidden />
      <span>{label}</span>
    </Link>
  );

  React.useEffect(() => {
    if (!token) {
      if (hubConnection) {
        hubConnection.stop().catch(() => {});
        setHubConnection(null);
      }
      return;
    }

    const apiUrl =
      import.meta.env.VITE_AXIOS_BASE_URL_API ?? "http://localhost:5000";
    const conn = new HubConnectionBuilder()
      .withUrl(`${apiUrl}/hubs/social`, {
        accessTokenFactory: () => token,
      })
      .withAutomaticReconnect()
      .build();

    conn
      .start()
      .then(async () => {
        try {
          await conn.invoke("RegisterConnection");
          console.debug("Navbar: SignalR registered");
        } catch (err) {
          console.warn("Navbar: RegisterConnection failed", err);
        }
        setHubConnection(conn);
      })
      .catch((err) => {
        console.error("Navbar: SignalR start error", err);
        setHubConnection(null);
      });

    const presenceHandler = (payload: any) => {
      console.debug("Navbar: FriendPresenceChanged", payload);
      try {
        queryClient.invalidateQueries({
          predicate: (q) => {
            const key = Array.isArray(q.queryKey)
              ? q.queryKey.join(" ")
              : String(q.queryKey);
            return /social|friends|chat|unread|shares|requests/i.test(key);
          },
        });
      } catch (e) {
        queryClient.invalidateQueries();
      }
    };

    conn.on("FriendPresenceChanged", presenceHandler);

    return () => {
      conn.off("FriendPresenceChanged", presenceHandler);
      conn.stop().catch(() => {});
      setHubConnection(null);
    };
  }, [token]);

  if (!isAuthenticated) {
    return (
      <nav className="sticky top-0 z-40 bg-gradient-to-r from-purple-800 to-indigo-900 shadow-md border-b border-indigo-800">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <div
            onClick={() => navigate("/")}
            className="flex items-center gap-3 cursor-pointer"
            aria-label="TuneRate home"
          >
            <div className="w-10 h-10 flex items-center justify-center bg-gradient-to-br from-purple-600 to-indigo-700 rounded-lg shadow-md">
              <span className="text-lg font-bold text-white">TR</span>
            </div>
            <div className="hidden sm:block">
              <div className="text-lg font-extrabold tracking-tight text-white">
                Tune<span className="text-blue-300">Rate</span>
              </div>
              <div className="text-xs text-gray-200 -mt-1">
                kolekcje • rekomendacje
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-3">
              <button
                onClick={() => loginWithRedirect()}
                className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg text-sm font-medium shadow-sm hover:scale-105 transform transition"
              >
                Zaloguj się
              </button>
            </div>

            <div className="md:hidden">
              <button
                onClick={() => loginWithRedirect()}
                aria-label="Zaloguj (mobilnie)"
                className="px-3 py-2 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg text-sm font-medium shadow-sm hover:scale-105 transform transition"
              >
                Zaloguj się
              </button>
            </div>
          </div>
        </div>
      </nav>
    );
  }

  return (
    <nav className="sticky top-0 z-40 bg-gradient-to-r from-purple-800 to-indigo-900 shadow-md border-b border-indigo-800">
      <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
        <div
          onClick={() => navigate("/")}
          className="flex items-center gap-3 cursor-pointer"
          aria-label="TuneRate home"
        >
          <div className="w-10 h-10 flex items-center justify-center bg-gradient-to-br from-purple-600 to-indigo-700 rounded-lg shadow-md">
            <span className="text-lg font-bold text-white">TR</span>
          </div>
          <div className="hidden sm:block">
            <div className="text-lg font-extrabold tracking-tight text-white">
              Tune<span className="text-blue-300">Rate</span>
            </div>
            <div className="text-xs text-gray-200 -mt-1">
              kolekcje • rekomendacje
            </div>
          </div>
        </div>

        <div className="hidden md:flex items-center gap-6">
          <NavItem to="/" icon={Home} label="Strona główna" />
          <NavItem to="/search" icon={Search} label="Szukaj" />
          {isAuthenticated && (
            <NavItem to="/collection" icon={Library} label="Kolekcja" />
          )}
          {isAuthenticated && (
            <NavItem to="/dashboard" icon={LayoutDashboard} label="Panel" />
          )}
          {isAuthenticated && (
            <NavItem to="/friends" icon={Users} label="Znajomi" />
          )}

          {isAdmin && (
            <NavItem to="/admin" icon={Shield} label="Administracja" />
          )}

          {isAuthenticated ? (
            <Link
              to="/notifications"
              className="relative flex items-center gap-2 text-sm text-gray-100 hover:text-white transition"
            >
              <Bell className="w-4 h-4 text-gray-200" aria-hidden />
              <span>Powiadomienia</span>
              {unreadNotificationsCount > 0 && (
                <span className="absolute -top-1 -right-3 inline-flex items-center justify-center px-2 py-0.5 text-xs font-semibold leading-none text-white bg-red-600 rounded-full">
                  {unreadNotificationsCount}
                </span>
              )}
            </Link>
          ) : (
            <NavItem to="/notifications" icon={Bell} label="Powiadomienia" />
          )}

          {isAuthenticated ? (
            <Link
              to="/chat"
              className="relative flex items-center gap-2 text-sm text-gray-100 hover:text-white transition"
            >
              <MessagesSquare className="w-4 h-4 text-gray-200" aria-hidden />
              <span>Czat</span>
              {unreadMessagesTotal > 0 && (
                <span className="absolute -top-1 -right-3 inline-flex items-center justify-center px-2 py-0.5 text-xs font-semibold leading-none text-white bg-red-600 rounded-full">
                  {unreadMessagesTotal}
                </span>
              )}
            </Link>
          ) : (
            <NavItem to="/chat" icon={MessagesSquare} label="Czat" />
          )}
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-3">
            {!isAuthenticated ? (
              <button
                onClick={() => loginWithRedirect()}
                className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg text-sm font-medium shadow-sm hover:scale-105 transform transition"
              >
                Zaloguj
              </button>
            ) : (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-3 bg-black/20 px-3 py-1 rounded-full">
                  {user?.picture ? (
                    <img
                      src={user.picture}
                      alt={displayName ?? "User avatar"}
                      className="w-8 h-8 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center text-sm font-semibold text-white">
                      {initials}
                    </div>
                  )}
                  <div className="text-sm text-left">
                    <div className="text-xs text-gray-300">Witaj,</div>
                    <div className="font-medium text-white">{displayName}</div>
                  </div>
                </div>

                <button
                  onClick={handleLogout}
                  className="ml-2 px-3 py-2 bg-red-600 text-sm font-medium rounded-lg hover:bg-red-700 transition"
                  aria-label="Wyloguj"
                >
                  Wyloguj
                </button>
              </div>
            )}
          </div>

          <div className="md:hidden">
            <button
              onClick={toggleMenu}
              aria-label="Otwórz menu mobilne"
              className="p-1 rounded-md bg-black/10 hover:bg-black/20"
            >
              {menuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="md:hidden bg-indigo-900/95 border-t border-indigo-800 px-6 pb-4 space-y-3 shadow-lg"
          >
            <Link
              to="/"
              onClick={toggleMenu}
              className="flex items-center gap-2 text-gray-100 hover:text-white"
            >
              <Home className="w-4 h-4" /> Strona główna
            </Link>
            <Link
              to="/search"
              onClick={toggleMenu}
              className="flex items-center gap-2 text-gray-100 hover:text-white"
            >
              <Search className="w-4 h-4" /> Szukaj
            </Link>
            {isAuthenticated && (
              <Link
                to="/collection"
                onClick={toggleMenu}
                className="flex items-center gap-2 text-gray-100 hover:text-white"
              >
                <Library className="w-4 h-4" /> Kolekcja
              </Link>
            )}
            {isAuthenticated && (
              <Link
                to="/dashboard"
                onClick={toggleMenu}
                className="flex items-center gap-2 text-gray-100 hover:text-white"
              >
                <LayoutDashboard className="w-4 h-4" /> Panel
              </Link>
            )}
            {isAuthenticated && (
              <Link
                to="/friends"
                onClick={toggleMenu}
                className="flex items-center gap-2 text-gray-100 hover:text-white"
              >
                <Users className="w-4 h-4" /> Znajomi
              </Link>
            )}

            {isAdmin && (
              <Link
                to="/admin"
                onClick={toggleMenu}
                className="flex items-center gap-2 text-gray-100 hover:text-white"
              >
                <Shield className="w-4 h-4" /> Administracja
              </Link>
            )}

            {isAuthenticated && (
              <Link
                to="/notifications"
                onClick={toggleMenu}
                className="flex items-center gap-2 text-gray-100 hover:text-white relative"
              >
                <Bell className="w-4 h-4" /> Powiadomienia
                {unreadNotificationsCount > 0 && (
                  <span className="ml-2 inline-flex items-center justify-center px-2 py-0.5 text-xs font-semibold leading-none text-white bg-red-600 rounded-full">
                    {unreadNotificationsCount}
                  </span>
                )}
              </Link>
            )}
            {isAuthenticated && (
              <Link
                to="/chat"
                onClick={toggleMenu}
                className="flex items-center gap-2 text-gray-100 hover:text-white relative"
              >
                <MessagesSquare className="w-4 h-4" /> Czat
                {unreadMessagesTotal > 0 && (
                  <span className="ml-2 inline-flex items-center justify-center px-2 py-0.5 text-xs font-semibold leading-none text-white bg-red-600 rounded-full">
                    {unreadMessagesTotal}
                  </span>
                )}
              </Link>
            )}
            <Link
              to="/about"
              onClick={toggleMenu}
              className="block text-gray-300 flex items-center gap-2"
            >
              <Info className="w-4 h-4" /> O projekcie
            </Link>

            {!isAuthenticated ? (
              <button
                onClick={() => {
                  toggleMenu();
                  loginWithRedirect();
                }}
                className="w-full px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-700 transition"
              >
                Zaloguj się
              </button>
            ) : (
              <button
                onClick={() => {
                  toggleMenu();
                  handleLogout();
                }}
                className="w-full px-4 py-2 bg-red-600 rounded-lg hover:bg-red-700 transition"
              >
                Wyloguj
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

export default Navbar;

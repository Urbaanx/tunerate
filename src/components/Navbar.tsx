import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth0 } from "@auth0/auth0-react";
import { Menu, X, Search } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const Navbar: React.FC = () => {
  const { isAuthenticated, loginWithRedirect, logout, user } = useAuth0();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = React.useState(false);

  const handleLogout = () => {
    logout({ logoutParams: { returnTo: window.location.origin } });
  };

  const toggleMenu = () => setMenuOpen(!menuOpen);

  const initials = user?.name
    ? user.name
        .split(" ")
        .map((s: string) => s[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "U";

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
          <Link
            to="/"
            className="text-sm text-gray-100 hover:text-white transition"
          >
            Strona główna
          </Link>
          <Link
            to="/search"
            className="text-sm text-gray-100 hover:text-white transition"
          >
            Szukaj
          </Link>
          {isAuthenticated && (
            <Link
              to="/collection"
              className="text-sm text-gray-100 hover:text-white transition"
            >
              Kolekcja
            </Link>
          )}
          {isAuthenticated && (
            <Link
              to="/dashboard"
              className="text-sm text-gray-100 hover:text-white transition"
            >
              Panel
            </Link>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/search")}
            className="hidden sm:flex items-center gap-2 bg-black/20 hover:bg-black/25 px-3 py-1 rounded-lg text-gray-100 transition"
            aria-label="Szukaj"
          >
            <Search className="w-4 h-4" />
            <span className="text-sm">Szukaj</span>
          </button>

          <div className="hidden md:flex items-center gap-3">
            {!isAuthenticated ? (
              <button
                onClick={() => loginWithRedirect()}
                className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg text-sm font-medium shadow-sm hover:scale-105 transform transition"
              >
                Zaloguj
              </button>
            ) : (
              <div className="flex items-center gap-3 bg-black/20 px-3 py-1 rounded-full">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center text-sm font-semibold text-white">
                  {initials}
                </div>
                <div className="text-sm text-left">
                  <div className="text-xs text-gray-300">Witaj,</div>
                  <div className="font-medium text-white">
                    {user?.name ?? user?.email}
                  </div>
                </div>
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
              className="block text-gray-100 hover:text-white"
            >
              Strona główna
            </Link>
            <Link
              to="/search"
              onClick={toggleMenu}
              className="block text-gray-100 hover:text-white"
            >
              Szukaj
            </Link>
            {isAuthenticated && (
              <Link
                to="/collection"
                onClick={toggleMenu}
                className="block text-gray-100 hover:text-white"
              >
                Kolekcja
              </Link>
            )}
            {isAuthenticated && (
              <Link
                to="/dashboard"
                onClick={toggleMenu}
                className="block text-gray-100 hover:text-white"
              >
                Panel
              </Link>
            )}
            <Link
              to="/about"
              onClick={toggleMenu}
              className="block text-gray-300 hover:text-white"
            >
              O projekcie
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

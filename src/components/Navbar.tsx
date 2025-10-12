import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth0 } from "@auth0/auth0-react";
import { Menu, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const Navbar: React.FC = () => {
  const { isAuthenticated, loginWithRedirect, logout } = useAuth0();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = React.useState(false);

  const handleLogout = () => {
    logout({ logoutParams: { returnTo: window.location.origin } });
  };

  const toggleMenu = () => setMenuOpen(!menuOpen);

  return (
    <nav className="bg-gradient-to-r from-purple-800 via-indigo-900 to-black text-white shadow-lg">
      <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
        {/* Logo / nazwa */}
        <div
          onClick={() => navigate("/")}
          className="cursor-pointer text-2xl font-bold tracking-tight"
        >
          Tune<span className="text-blue-400">Rate</span>
        </div>

        {/* Desktop links */}
        <div className="hidden md:flex space-x-6 items-center">
          <Link to="/" className="hover:text-blue-400 transition">
            Strona główna
          </Link>
          <Link to="/search" className="hover:text-blue-400 transition">
            Szukaj
          </Link>
          {isAuthenticated && (
            <Link to="/collection" className="hover:text-blue-400 transition">
              Kolekcja
            </Link>
          )}

          {!isAuthenticated ? (
            <button
              onClick={() => loginWithRedirect()}
              className="px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-700 transition"
            >
              Zaloguj się
            </button>
          ) : (
            <div className="flex items-center space-x-3">
              <Link to="/dashboard" className="hover:text-blue-400 transition">
                Panel
              </Link>
              <button
                onClick={handleLogout}
                className="px-4 py-2 bg-red-600 rounded-lg hover:bg-red-700 transition"
              >
                Wyloguj
              </button>
            </div>
          )}
        </div>

        {/* Mobile menu button */}
        <div className="md:hidden">
          <button onClick={toggleMenu}>
            {menuOpen ? <X size={28} /> : <Menu size={28} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="md:hidden bg-indigo-950 border-t border-indigo-800 px-6 pb-4 space-y-3"
          >
            <Link
              to="/"
              onClick={toggleMenu}
              className="block text-gray-200 hover:text-blue-400"
            >
              Strona główna
            </Link>
            <Link
              to="/search"
              onClick={toggleMenu}
              className="block text-gray-200 hover:text-blue-400"
            >
              Szukaj
            </Link>
            {isAuthenticated && (
              <Link
                to="/collection"
                onClick={toggleMenu}
                className="block text-gray-200 hover:text-blue-400"
              >
                Kolekcja
              </Link>
            )}

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

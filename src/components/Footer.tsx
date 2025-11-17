import React from "react";
import { Link } from "react-router-dom";

const Footer: React.FC = () => {
  return (
    <footer className="mt-12 border-t border-white/6 bg-gradient-to-t from-black/60 via-indigo-900/5 to-transparent text-gray-300">
      <div className="max-w-7xl mx-auto px-6 md:px-10 lg:px-20 py-8 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div>
          <div className="text-lg font-bold text-white">TuneRate</div>
          <div className="text-sm text-gray-400 mt-1">
            Twoja kolekcja, lepsze rekomendacje
          </div>
          <div className="text-xs text-gray-500 mt-3">
            © 2025 TuneRate. Wszystkie prawa zastrzeżone.
          </div>
        </div>

        <div className="flex flex-col">
          <div className="font-semibold text-white mb-2">Przydatne</div>
          <Link
            to="/search"
            className="text-sm text-gray-300 hover:text-white mb-1"
          >
            Przeglądaj
          </Link>
          <Link
            to="/collection"
            className="text-sm text-gray-300 hover:text-white mb-1"
          >
            Moja kolekcja
          </Link>
          <Link
            to="/dashboard"
            className="text-sm text-gray-300 hover:text-white"
          >
            Panel
          </Link>
        </div>

        <div className="flex flex-col">
          <div className="font-semibold text-white mb-2">Kontakt</div>
          <a
            className="text-sm text-gray-300 hover:text-white mb-1"
            href="mailto:hello@tunerate.example"
          >
            hello@tunerate.example
          </a>
          <Link
            to="/privacy"
            className="text-sm text-gray-300 hover:text-white"
          >
            Polityka prywatności
          </Link>
        </div>
      </div>

      <div className="bg-gradient-to-r from-indigo-900/5 to-transparent">
        <div className="max-w-7xl mx-auto px-6 md:px-10 lg:px-20 py-3 text-xs text-gray-500 text-center">
          Built with ❤ · Przyjazne API · Dane przykładowe
        </div>
      </div>
    </footer>
  );
};

export default Footer;

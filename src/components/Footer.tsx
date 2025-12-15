import React from "react";
import { Link } from "react-router-dom";

const Icon = ({ children }: { children: React.ReactNode }) => (
  <span className="w-8 h-8 inline-flex items-center justify-center rounded-md bg-white/6 hover:bg-white/10 transition">
    {children}
  </span>
);

const Footer: React.FC = () => {
  return (
    <footer className="mt-12 border-t border-white/6 bg-gradient-to-t from-black/60 via-indigo-900/5 to-transparent text-gray-300">
      <div className="max-w-7xl mx-auto px-6 md:px-10 lg:px-20 py-10 grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="space-y-3">
          <div className="text-2xl font-bold text-white">TuneRate</div>
          <div className="text-sm text-gray-400 max-w-sm">
            Twoja kolekcja, lepsze rekomendacje — oceniaj albumy, pisz recenzje
            i odkrywaj nowe brzmienia dopasowane do Ciebie.
          </div>
          <div className="pt-3 text-sm text-gray-300">
            <Link to="/privacy" className="hover:text-white">
              Polityka prywatności
            </Link>
            <span className="mx-2 text-gray-600">·</span>
            <Link to="/about" className="hover:text-white">
              O nas
            </Link>
          </div>
        </div>

        <div className="flex flex-col justify-center">
          <div className="font-semibold text-white mb-2">Kontakt</div>
          <a
            href="mailto:support@tunerate.app"
            className="text-sm text-gray-300 hover:text-white"
          >
            support@tunerate.app
          </a>
          <a
            href="tel:+48123456789"
            className="text-sm text-gray-300 hover:text-white mt-1"
          >
            +48 123 456 789
          </a>
          <div className="text-sm text-gray-400 mt-2">
            ul. Muzyczna 7, 00-001 Warszawa
          </div>
          <Link
            to="/contact"
            className="text-sm text-indigo-300 hover:text-indigo-200 mt-3 inline-block"
          >
            Strona kontaktowa
          </Link>
        </div>

        <div className="flex flex-col items-start md:items-end">
          <div className="font-semibold text-white mb-3">Śledź nas</div>
          <div className="flex items-center gap-3 mb-3">
            <a
              href="#"
              aria-label="Twitter"
              className="text-gray-300 hover:text-white"
            >
              <Icon>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden
                >
                  <path d="M22 5.92c-.64.28-1.32.47-2.04.55.73-.44 1.28-1.14 1.54-1.98-.68.4-1.43.7-2.23.86A3.49 3.49 0 0012.5 8c0 .27.03.54.09.8C8.1 8.72 5 6.8 3 4.06c-.3.53-.47 1.14-.47 1.8 0 1.24.63 2.33 1.6 2.97-.6-.02-1.16-.18-1.66-.45v.05c0 1.73 1.23 3.17 2.86 3.5-.3.08-.62.12-.95.12-.23 0-.46-.02-.68-.06.47 1.47 1.82 2.54 3.42 2.57A7.01 7.01 0 013 19.54a9.87 9.87 0 005.34 1.56c6.41 0 9.92-5.32 9.92-9.94v-.45A7.04 7.04 0 0022 5.92z" />
                </svg>
              </Icon>
            </a>
            <a
              href="#"
              aria-label="GitHub"
              className="text-gray-300 hover:text-white"
            >
              <Icon>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden
                >
                  <path d="M12 2C6.48 2 2 6.58 2 12.18c0 4.5 2.87 8.33 6.84 9.67.5.09.68-.22.68-.48 0-.24-.01-.87-.01-1.7-2.78.61-3.37-1.36-3.37-1.36-.45-1.17-1.11-1.48-1.11-1.48-.91-.63.07-.62.07-.62 1.01.07 1.55 1.06 1.55 1.06.9 1.56 2.37 1.11 2.95.85.09-.66.35-1.11.64-1.37-2.22-.26-4.55-1.14-4.55-5.08 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.7 0 0 .84-.27 2.75 1.05A9.2 9.2 0 0112 6.8c.85.004 1.71.116 2.51.34 1.9-1.33 2.74-1.05 2.74-1.05.56 1.4.21 2.44.1 2.7.64.72 1.03 1.63 1.03 2.75 0 3.95-2.34 4.82-4.57 5.07.36.32.68.95.68 1.92 0 1.39-.01 2.51-.01 2.85 0 .26.18.58.69.48A10.2 10.2 0 0022 12.18C22 6.58 17.52 2 12 2z" />
                </svg>
              </Icon>
            </a>
            <a
              href="#"
              aria-label="RSS"
              className="text-gray-300 hover:text-white"
            >
              <Icon>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden
                >
                  <path d="M6.18 18.82A1.82 1.82 0 114 17a1.82 1.82 0 012.18 1.82zM4 11v2a8 8 0 018 8h2c0-5.52-4.48-10-10-10zm0-6v2a14 14 0 0114 14h2C20 11.07 12.93 4 4 4z" />
                </svg>
              </Icon>
            </a>
          </div>

          <div className="text-sm text-gray-500">
            © 2025 TuneRate · Wszystkie prawa zastrzeżone.
          </div>
        </div>
      </div>

      <div className="bg-gradient-to-r from-indigo-900/5 to-transparent">
        <div className="max-w-7xl mx-auto px-6 md:px-10 lg:px-20 py-3 text-xs text-gray-500 text-center">
          Built with <span aria-hidden>❤</span> · Przyjazne API · Dane
          przykładowe
        </div>
      </div>
    </footer>
  );
};

export default Footer;

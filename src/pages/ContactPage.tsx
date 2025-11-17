import React from "react";

const ContactPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-indigo-900 to-black text-white p-8">
      <div className="max-w-4xl mx-auto bg-white/5 p-8 rounded-xl border border-white/6">
        <h1 className="text-3xl font-bold mb-4">Kontakt</h1>

        <p className="text-gray-300 mb-2">
          Masz pytania lub potrzebujesz pomocy? Skontaktuj się z nami:
        </p>

        <ul className="text-gray-300 list-inside space-y-2">
          <li>
            Email:{" "}
            <a className="text-blue-400" href="mailto:support@tunerate.app">
              support@tunerate.app
            </a>
          </li>
          <li>
            Telefon:{" "}
            <a className="text-blue-400" href="tel:+48123456789">
              +48 123 456 789
            </a>
          </li>
          <li>Adres (fikcyjny): ul. Muzyczna 7, 00-001 Warszawa, Polska</li>
        </ul>

        <p className="text-gray-400 mt-4 text-sm">
          Uwaga: powyższe dane są przykładowe i używane tylko w celach
          demonstracyjnych.
        </p>
      </div>
    </div>
  );
};

export default ContactPage;

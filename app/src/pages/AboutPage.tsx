import React from "react";

const AboutPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-indigo-900 to-black text-white p-8">
      <div className="max-w-4xl mx-auto bg-white/5 p-8 rounded-xl border border-white/6">
        <h1 className="text-3xl font-bold mb-4">O TuneRate</h1>
        <p className="text-gray-300 mb-3">
          TuneRate to aplikacja do zarządzania kolekcją albumów, wystawiania
          ocen i pisania recenzji. System proponuje rekomendacje oparte na
          Twoich ocenach i preferencjach.
        </p>
        <p className="text-gray-300">
          Projekt powstał jako demonstracja mechanizmów katalogowania muzyki,
          ocen i rekomendacji. Jeśli masz pytania, skontaktuj się z nami na
          stronie Kontakt.
        </p>
      </div>
    </div>
  );
};

export default AboutPage;

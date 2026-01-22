import React from "react";

const PrivacyPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-indigo-900 to-black text-white p-8">
      <div className="max-w-4xl mx-auto bg-white/5 p-8 rounded-xl border border-white/6">
        <h1 className="text-3xl font-bold mb-4">Polityka prywatności</h1>
        <p className="text-gray-300 mb-3">
          TuneRate przechowuje tylko niezbędne informacje użytkownika (profil,
          oceny, recenzje). Autoryzacja i logowanie oparte są o Auth0.
        </p>
        <p className="text-gray-300">
          Dane nie są sprzedawane ani udostępniane stronom trzecim bez zgody
          użytkownika. W przypadku pytań dotyczących prywatności prosimy o
          kontakt.
        </p>
      </div>
    </div>
  );
};

export default PrivacyPage;

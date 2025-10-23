import React from "react";
import AppRouter from "./utils/AppRouter";
import { Toaster } from "react-hot-toast";

const App: React.FC = () => {
  return (
    <>
      <AppRouter />
      <Toaster
        position="top-right"
        reverseOrder={false}
        // container ma pointer-events-none żeby nie blokować kliknięć pod spodem,
        // a same toasty mają pointer-events-auto żeby były interaktywne
        containerClassName="p-4 pointer-events-none"
        // zwiększony z-index, żeby toasty nie były zasłonięte przez modale/overlaye
        containerStyle={{ zIndex: 11000 }}
        toastOptions={{
          className:
            "pointer-events-auto min-w-[260px] max-w-md bg-slate-900/95 text-slate-100 rounded-lg shadow-2xl border border-slate-800 px-4 py-3 flex items-start gap-3 font-sans",
          duration: 4500,
          style: {
            backdropFilter: "blur(6px)",
            // dodatkowy safety z-index na poziomie pojedynczego toasta
            zIndex: 11000,
          },
          success: {
            iconTheme: {
              primary: "#16a34a",
              secondary: "#ffffff",
            },
          },
          error: {
            iconTheme: {
              primary: "#ef4444",
              secondary: "#ffffff",
            },
          },
        }}
      />
    </>
  );
};

export default App;

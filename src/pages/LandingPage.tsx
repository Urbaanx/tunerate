import React, { useEffect, useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import {
  usePostApiUsersSync,
  useGetApiAlbumsPreview,
} from "../api/endpoints/tunerateApi";
import AlbumCard from "../components/AlbumCard";

const LandingPage: React.FC = () => {
  const {
    isAuthenticated,
    user,
    isLoading,
    getAccessTokenSilently,
  } = useAuth0();

  const audience = import.meta.env.VITE_AUTH0_AUDIENCE;

  const [accessToken, setAccessToken] = useState<string | null>(null);
  const { mutate: postUsersSync } = usePostApiUsersSync({
    request: accessToken
      ? { headers: { Authorization: `Bearer ${accessToken}` } }
      : undefined,
  });

  const [synced, setSynced] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      setAccessToken(null);
      console.log("User not authenticated");
      return;
    }

    (async () => {
      try {
        console.log("User object:", user);
        console.log("Using audience =", audience);

        const token = await getAccessTokenSilently({
          authorizationParams: {
            audience: audience,
            scope: "openid profile email",
          },
        });
        console.log("Auth0 access token:", token);
        setAccessToken(token ?? null);
      } catch (err: any) {
        console.error("Failed to obtain Auth0 token:", err);
        if (err?.error) console.error("error:", err.error);
        if (err?.error_description)
          console.error("error_description:", err.error_description);
        if (err?.message) console.error("message:", err.message);

        console.error(
          "Sprawdź: VITE_audience musi dokładnie zgadzać się z Identifier w Auth0 → APIs oraz Allowed Callback/Origins w aplikacji."
        );
        setAccessToken(null);
      }
    })();
  }, [isAuthenticated, getAccessTokenSilently, user, audience]);

  // <-- DODANE: loguj token przy każdej zmianie accessToken (do testów API)
  useEffect(() => {
    if (!accessToken) {
      console.log("Brak accessToken (niezalogowany lub token usunięty).");
      return;
    }
    console.log("API token (do testów):", accessToken);
  }, [accessToken]);

  useEffect(() => {
    if (!isAuthenticated || !accessToken || synced) return;

    postUsersSync(undefined, {
      onSuccess: (res) => {
        console.log("✅ User sync succeeded:", res);
        setSynced(true);
      },
      onError: (err) => {
        console.error("❌ User sync failed:", err);
        setSynced(true);
      },
    });
  }, [isAuthenticated, accessToken, synced, postUsersSync]);

  // --- preview from backend (3 random albums) ---
  const {
    data: previewData,
    isLoading: previewLoading,
    isError: previewError,
    refetch: refetchPreview,
  } = useGetApiAlbumsPreview<any, unknown>(undefined);

  const previewItems =
    (previewData as any)?.Items ?? (previewData as any)?.items ?? [];

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-b from-black/80 to-black text-gray-400">
        Loading...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-indigo-900 to-black text-white">
      {/* HERO */}
      <header className="py-12">
        <div className="max-w-7xl mx-auto px-6 md:px-10 lg:px-20 flex flex-col md:flex-row items-center gap-10">
          <div className="md:w-full max-w-2xl mx-auto text-center flex flex-col items-center">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold leading-tight mb-4">
              TuneRate — Twoja kolekcja, lepsze rekomendacje
            </h1>
            <p className="text-lg text-gray-300 mb-6">
              Twórz profil, dodawaj przesłuchane albumy, oceniaj je i pisz
              recenzje. Otrzymuj rekomendacje dopasowane do Twojego gustu.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-center"></div>
          </div>
        </div>
      </header>

      <main className="px-6 md:px-10 lg:px-20 pb-16">
        {/* FEATURES */}
        <section className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="bg-gradient-to-br from-white/3 to-white/2 p-6 rounded-xl border border-white/6 hover:shadow-lg transform hover:-translate-y-1 transition">
            <h4 className="text-xl font-semibold mb-2">Twórz profil</h4>
            <p className="text-gray-300 text-sm">
              Rejestruj konto, synchronizuj profil z Auth0 i zarządzaj swoją
              kolekcją albumów.
            </p>
          </div>
          <div className="bg-gradient-to-br from-white/3 to-white/2 p-6 rounded-xl border border-white/6 hover:shadow-lg transform hover:-translate-y-1 transition">
            <h4 className="text-xl font-semibold mb-2">Oceny i recenzje</h4>
            <p className="text-gray-300 text-sm">
              Oceń albumy w skali 1–10, pisz recenzje i przeglądaj opinie innych
              użytkowników.
            </p>
          </div>
          <div className="bg-gradient-to-br from-white/3 to-white/2 p-6 rounded-xl border border-white/6 hover:shadow-lg transform hover:-translate-y-1 transition">
            <h4 className="text-xl font-semibold mb-2">
              Inteligentne rekomendacje
            </h4>
            <p className="text-gray-300 text-sm">
              Rekomendacje oparte na ocenach, tagach i podobieństwach między
              albumami.
            </p>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section className="max-w-5xl mx-auto mb-12 text-left bg-white/2 p-6 rounded-xl border border-white/6">
          <h3 className="text-2xl font-bold mb-4">Jak to działa?</h3>
          <ol className="list-decimal list-inside text-gray-300 space-y-2">
            <li>Załóż konto lub zaloguj się.</li>
            <li>Dodawaj przesłuchane albumy do kolekcji i oceniaj je.</li>
            <li>System analizuje Twoje oceny i proponuje kolejne albumy.</li>
          </ol>
        </section>

        {/* POPULAR / PREVIEW ALBUMS */}
        <section className="max-w-7xl mx-auto mb-12">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-2xl font-bold">Popularne propozycje</h3>
            <div className="flex items-center gap-4">
              <a
                href="/search"
                className="text-sm text-gray-300 hover:text-white"
              >
                Przeglądaj wszystkie
              </a>
              <button
                onClick={() => refetchPreview()}
                className="px-3 py-1 text-sm bg-white/6 rounded"
              >
                Odśwież
              </button>
            </div>
          </div>

          {previewLoading ? (
            <div className="text-gray-300">Ładowanie propozycji...</div>
          ) : previewError ? (
            <div className="text-red-400">
              Nie udało się pobrać propozycji.{" "}
              <button
                onClick={() => refetchPreview()}
                className="ml-2 text-blue-400 underline"
              >
                Spróbuj ponownie
              </button>
            </div>
          ) : !previewItems || previewItems.length === 0 ? (
            <div className="text-gray-400">Brak propozycji w bazie.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {previewItems.map((a: any) => (
                <div
                  key={a.id ?? a.externalId ?? a.title}
                  className="transform hover:-translate-y-1 transition"
                >
                  <AlbumCard
                    album={{
                      id: a.id,
                      title: a.title ?? a.Title ?? "",
                      artist: a.artist ?? a.Artist ?? "",
                      coverUrl: a.coverUrl ?? a.CoverUrl ?? null,
                      releaseDate: a.releaseDate ?? a.ReleaseDate ?? null,
                    }}
                  />
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      {/* FOOTER */}
      <footer className="text-gray-400 text-sm text-center py-8 border-t border-white/6">
        <div className="max-w-7xl mx-auto px-6 md:px-10 lg:px-20 flex flex-col md:flex-row items-center justify-between gap-3">
          <div>&copy; 2025 TuneRate. Wszystkie prawa zastrzeżone.</div>
          <div className="text-gray-500 text-sm space-x-3">
            <a href="/about" className="text-gray-400 hover:text-white">
              O nas
            </a>
            •
            <a href="/privacy" className="text-gray-400 hover:text-white">
              Polityka prywatności
            </a>
            •
            <a href="/contact" className="text-gray-400 hover:text-white">
              Kontakt
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;

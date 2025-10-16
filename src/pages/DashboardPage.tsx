import React, { useEffect, useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { useGetApiUserAlbums } from "../api/endpoints/tunerateApi";
import AlbumCard from "../components/AlbumCard";
import { Loader2 } from "lucide-react";

const DashboardPage: React.FC = () => {
  const { isAuthenticated, user, loginWithRedirect, getAccessTokenSilently } = useAuth0();
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    if (!isAuthenticated) {
      setToken(null);
      return;
    }
    getAccessTokenSilently()
      .then((t) => {
        if (mounted) setToken(t);
      })
      .catch((err) => {
        console.error("Błąd pobierania tokena:", err);
        if (mounted) setToken(null);
      });
    return () => {
      mounted = false;
    };
  }, [isAuthenticated, getAccessTokenSilently]);

  const { data, isLoading, isError, refetch } = useGetApiUserAlbums<any, unknown>({
    request: token ? { headers: { Authorization: `Bearer ${token}` } } : undefined,
  });

  useEffect(() => {
    if (token) refetch();
  }, [token, refetch]);

  const recentAlbums = Array.isArray(data) ? data.slice(0, 6) : [];
  const albumCount = Array.isArray(data) ? data.length : 0;
  const lastAddedDate =
    Array.isArray(data) && data.length > 0
      ? new Date(
          Math.max(...data.map((a: any) => new Date(a.createdAt).getTime()))
        ).toLocaleDateString("pl-PL")
      : null;

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gradient-to-r from-purple-900 via-indigo-900 to-black text-white">
        <h1 className="text-3xl font-bold mb-4">Musisz się zalogować</h1>
        <button
          onClick={() => loginWithRedirect()}
          className="px-6 py-3 bg-blue-600 rounded-lg hover:bg-blue-700 transition"
        >
          Zaloguj się
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-r from-purple-900 via-indigo-900 to-black text-white p-6">
      {/* === HEADER === */}
      <header className="max-w-6xl mx-auto mb-8 flex items-center gap-4">
        {user?.picture && (
          <img
            src={user.picture}
            alt={user.name}
            className="w-16 h-16 rounded-full border border-white/20 shadow-lg"
          />
        )}
        <div>
          <h1 className="text-4xl font-extrabold">Twój panel</h1>
          <p className="text-gray-300 mt-1">
            Witaj, {user?.name ?? user?.email}! 👋
          </p>
          {albumCount > 0 && (
            <p className="text-sm text-gray-400 mt-1">
              Masz <span className="text-blue-400 font-semibold">{albumCount}</span> albumów w kolekcji
              {lastAddedDate && <> — ostatni dodano <span className="text-gray-300">{lastAddedDate}</span></>}.
            </p>
          )}
        </div>
      </header>

      {/* === NAV CARDS === */}
      <section className="max-w-6xl mx-auto grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-10">
        <a
          href="/search"
          className="block rounded-xl bg-black/40 border border-white/10 p-6 hover:bg-black/50 transition"
        >
          <h2 className="text-2xl font-semibold mb-2">Wyszukaj albumy</h2>
          <p className="text-gray-300">Znajdź nowe wydania i dodaj je do swojej kolekcji.</p>
        </a>
        <a
          href="/collection"
          className="block rounded-xl bg-black/40 border border-white/10 p-6 hover:bg-black/50 transition"
        >
          <h2 className="text-2xl font-semibold mb-2">Moja kolekcja</h2>
          <p className="text-gray-300 mb-2">Przeglądaj i zarządzaj dodanymi albumami.</p>
          <p className="text-sm text-gray-400">🎧 {albumCount} albumów</p>
        </a>
        <div className="rounded-xl bg-black/40 border border-white/10 p-6">
          <h2 className="text-2xl font-semibold mb-2">Statystyki (wkrótce)</h2>
          <p className="text-gray-300">Podsumowanie ocen, ulubionych wykonawców i rekomendacji.</p>
        </div>
      </section>

      {/* === RECENT ALBUMS === */}
      <section className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-2xl font-bold">Ostatnio dodane do kolekcji</h3>
          <a href="/collection" className="text-blue-400 hover:text-blue-300">
            Zobacz wszystkie
          </a>
        </div>

        {isLoading && (
          <div className="flex items-center text-gray-300">
            <Loader2 className="animate-spin w-5 h-5 mr-2" />
            Ładowanie...
          </div>
        )}

        {isError && (
          <p className="text-red-400">Nie udało się pobrać listy albumów.</p>
        )}

        {!isLoading && !isError && recentAlbums.length === 0 && (
          <p className="text-gray-400">Nie masz jeszcze żadnych albumów w kolekcji.</p>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {recentAlbums.map((album: any) => (
            <AlbumCard
              key={album.id}
              album={{
                title: album.title,
                artist: album.artist,
                coverUrl: album.coverUrl,
                releaseDate: album.releaseDate,
              }}
            />
          ))}
        </div>
      </section>
    </div>
  );
};

export default DashboardPage;

import React, { useEffect, useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import {
  useGetApiUserAlbums,
  useGetApiRecommendationsUserId,
  useGetApiUsersByAuth0idAuth0Id,
  usePostApiUsersSync,
} from "../api/endpoints/tunerateApi";
import AlbumCard from "../components/AlbumCard";
import { Loader2 } from "lucide-react";

const DashboardPage: React.FC = () => {
  const { isAuthenticated, user, loginWithRedirect, getAccessTokenSilently } =
    useAuth0();
  const [token, setToken] = useState<string | null>(null);

  // Added: audience and users sync hook + synced state
  const audience = import.meta.env.VITE_AUTH0_AUDIENCE;
  const { mutate: postUsersSync } = usePostApiUsersSync({
    request: token
      ? { headers: { Authorization: `Bearer ${token}` } }
      : undefined,
  });
  const [synced, setSynced] = useState(false);

  useEffect(() => {
    let mounted = true;
    if (!isAuthenticated) {
      setToken(null);
      return;
    }
    // request token with audience and scope like on LandingPage
    getAccessTokenSilently({
      authorizationParams: {
        audience: audience,
        scope: "openid profile email",
      },
    })
      .then((t) => {
        if (mounted) setToken(t);
      })
      .catch((err: any) => {
        console.error("Błąd pobierania tokena:", err);
        if (err?.error) console.error("error:", err.error);
        if (err?.error_description)
          console.error("error_description:", err.error_description);
        if (err?.message) console.error("message:", err.message);
        console.error(
          "Sprawdź: VITE_audience musi dokładnie zgadzać się z Identifier w Auth0 → APIs oraz Allowed Callback/Origins w aplikacji."
        );
        if (mounted) setToken(null);
      });
    return () => {
      mounted = false;
    };
  }, [isAuthenticated, getAccessTokenSilently, audience]);

  // effect to run user sync once we have token (same logic as LandingPage)
  useEffect(() => {
    if (!isAuthenticated || !token || synced) return;

    postUsersSync(undefined, {
      onSuccess: (res) => {
        console.log("✅ User sync succeeded:", res);
        setSynced(true);
      },
      onError: (err) => {
        console.error("❌ User sync failed:", err);
        setSynced(true);
      },
      // Note: Orval passes meta through to axiosInstance -> options
    });
  }, [isAuthenticated, token, synced, postUsersSync]);

  const { data: localUser } = useGetApiUsersByAuth0idAuth0Id<any, unknown>(
    user?.sub ?? ""
  );

  //console.log("Local user data:", localUser);
  //console.log("localUser id:", localUser?.id);

  // === Pobranie kolekcji użytkownika ===
  const {
    data: userAlbums,
    isLoading,
    isError,
    refetch,
  } = useGetApiUserAlbums<any, unknown>();

  // === Pobranie rekomendacji z backendu ===
  const {
    data: recommendations,
    isLoading: isRecLoading,
    isError: isRecError,
    refetch: refetchRecs,
  } = useGetApiRecommendationsUserId<any, unknown>(
    localUser?.id ?? "",
    { topN: 5, type: "hybrid" },
    {
      query: { enabled: !!token && !!localUser?.id },
    }
  );
  useEffect(() => {
    if (token && localUser?.id) {
      refetch();
      refetchRecs();
    }
  }, [token, localUser?.id, refetch, refetchRecs]);

  const isDbUser =
    !!user &&
    (user.sub?.startsWith?.("auth0|") ||
      user?.identities?.[0]?.provider === "auth0");

  // prefer backend-synced nickname (backend saves Username into Nickname),
  // then Auth0 `username`, then `nickname` from Auth0 profile, then email
  const displayName = isDbUser
    ? localUser?.nickname ?? user?.username ?? user?.nickname ?? user?.email
    : user?.name ?? user?.email;

  const recentAlbums = Array.isArray(userAlbums) ? userAlbums.slice(0, 6) : [];
  const albumCount = Array.isArray(userAlbums) ? userAlbums.length : 0;
  const lastAddedDate =
    Array.isArray(userAlbums) && userAlbums.length > 0
      ? new Date(
          Math.max(
            ...userAlbums.map((a: any) => new Date(a.createdAt).getTime())
          )
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

  // === RECOMMENDATIONS ===
  // Bezpiecznie wyciągamy tablicę rekomendacji (może być undefined)
  const recList = Array.isArray(recommendations?.recommendations)
    ? recommendations!.recommendations
    : [];

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
          <p className="text-gray-300 mt-1">Witaj, {displayName}! 👋</p>
          {albumCount > 0 && (
            <p className="text-sm text-gray-400 mt-1">
              Masz{" "}
              <span className="text-blue-400 font-semibold">{albumCount}</span>{" "}
              albumów w kolekcji
              {lastAddedDate && (
                <>
                  {" "}
                  — ostatni dodano{" "}
                  <span className="text-gray-300">{lastAddedDate}</span>
                </>
              )}
              .
            </p>
          )}
        </div>
      </header>

      {/* === NAVIGATION CARDS === */}
      <section className="max-w-6xl mx-auto grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-10">
        <a
          href="/search"
          className="block rounded-xl bg-black/40 border border-white/10 p-6 hover:bg-black/50 transition"
        >
          <h2 className="text-2xl font-semibold mb-2">Wyszukaj albumy</h2>
          <p className="text-gray-300">
            Znajdź nowe wydania i dodaj je do swojej kolekcji.
          </p>
        </a>
        <a
          href="/collection"
          className="block rounded-xl bg-black/40 border border-white/10 p-6 hover:bg-black/50 transition"
        >
          <h2 className="text-2xl font-semibold mb-2">Moja kolekcja</h2>
          <p className="text-gray-300 mb-2">
            Przeglądaj i zarządzaj dodanymi albumami.
          </p>
          <p className="text-sm text-gray-400">🎧 {albumCount} albumów</p>
        </a>
        <div className="rounded-xl bg-black/40 border border-white/10 p-6">
          <h2 className="text-2xl font-semibold mb-2">Statystyki (wkrótce)</h2>
          <p className="text-gray-300">
            Podsumowanie ocen, ulubionych wykonawców i rekomendacji.
          </p>
        </div>
      </section>

      {/* === RECENT ALBUMS === */}
      <section className="max-w-6xl mx-auto mb-16">
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
          <p className="text-gray-400">
            Nie masz jeszcze żadnych albumów w kolekcji.
          </p>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {recentAlbums.map((album: any) => (
            <AlbumCard
              key={album.id}
              album={{
                id: album.id,
                title: album.title,
                artist: album.artist,
                coverUrl: album.coverUrl,
                releaseDate: album.releaseDate,
              }}
            />
          ))}
        </div>
      </section>

      {/* === RECOMMENDATIONS === */}
      <section className="max-w-6xl mx-auto">
        <h3 className="text-2xl font-bold mb-4">🎯 Rekomendowane dla Ciebie</h3>

        {isRecLoading && (
          <div className="flex items-center text-gray-300">
            <Loader2 className="animate-spin w-5 h-5 mr-2" />
            Ładowanie rekomendacji...
          </div>
        )}

        {isRecError && (
          <p className="text-red-400">Nie udało się pobrać rekomendacji.</p>
        )}

        {!isRecLoading && !isRecError && recList.length === 0 && (
          <p className="text-gray-400">
            Brak rekomendacji — oceń lub dodaj więcej albumów, aby dopasować
            propozycje!
          </p>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {recList.map((album: any) => (
            <AlbumCard
              key={album.id}
              album={{
                id: album.id,
                title: album.title,
                artist: album.artist ?? "Nieznany artysta",
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

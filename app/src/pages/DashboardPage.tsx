import React, { useEffect, useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import {
  useGetApiUserAlbums,
  useGetApiRecommendationsUserId,
  useGetApiUsersByAuth0idAuth0Id,
  usePostApiUsersSync,
  usePutApiUsersNickname,
  useGetApiUsersStats,
  usePostApiUsersPasswordReset,
} from "../api/endpoints/tunerateApi";
import AlbumCard from "../components/AlbumCard";
import { Loader2, Settings } from "lucide-react";
import { toast } from "../utils/toast";

const DashboardPage: React.FC = () => {
  const { isAuthenticated, user, loginWithRedirect, getAccessTokenSilently } =
    useAuth0();
  const [token, setToken] = useState<string | null>(null);

  const audience = import.meta.env.VITE_AUTH0_AUDIENCE;
  const { mutate: postUsersSync } = usePostApiUsersSync({
    request: token
      ? { headers: { Authorization: `Bearer ${token}` } }
      : undefined,
  });

  const { mutate: postUsersPasswordReset } = usePostApiUsersPasswordReset({
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
          "Sprawdź: VITE_AUTH0_AUDIENCE w pliku .env oraz konfigurację aplikacji w Auth0."
        );
        if (mounted) setToken(null);
      });
    return () => {
      mounted = false;
    };
  }, [isAuthenticated, getAccessTokenSilently, audience]);

  useEffect(() => {
    if (!isAuthenticated || !token || synced) return;

    postUsersSync(undefined, {
      onSuccess: (res) => {
        console.log("User sync succeeded:", res);
        setSynced(true);
      },
      onError: (err) => {
        console.error("User sync failed:", err);
        setSynced(true);
      },
    });
  }, [isAuthenticated, token, synced, postUsersSync]);

  const { data: localUser, refetch: refetchLocalUser } =
    useGetApiUsersByAuth0idAuth0Id<any, unknown>(user?.sub ?? "");

  const {
    data: userAlbums,
    isLoading,
    isError,
    refetch,
  } = useGetApiUserAlbums<any, unknown>();

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

  const displayName = isDbUser
    ? localUser?.nickname ?? user?.username ?? user?.nickname ?? user?.email
    : user?.name ?? user?.email;


  const putNicknameMutation = usePutApiUsersNickname();
  const putNickname = putNicknameMutation.mutate;

  const isUpdating = (putNicknameMutation as any).isLoading ?? false;
  const [showNicknameModal, setShowNicknameModal] = useState(false);
  const [newNickname, setNewNickname] = useState<string>("");

  useEffect(() => {
    if (showNicknameModal) {
      setNewNickname(localUser?.nickname ?? "");
    }
  }, [showNicknameModal, localUser?.nickname]);

  const openNicknameModal = () => {
    setNewNickname(localUser?.nickname ?? "");
    setShowNicknameModal(true);
  };

  const handleSaveNickname = (e?: React.FormEvent) => {
    e?.preventDefault?.();
    const trimmed = (newNickname ?? "").trim();
    if (!trimmed) return;
    if (trimmed === localUser?.nickname) {
      setShowNicknameModal(false);
      return;
    }

    putNickname(
      { data: { nickname: trimmed } },
      {
        onSuccess: () => {
          setShowNicknameModal(false);
          refetchLocalUser?.();
        },
        onError: (err) => {
          console.error("Failed to update nickname:", err);
          setShowNicknameModal(false);
        },
      }
    );
  };

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

  const { data: userStats, isLoading: isStatsLoading } = useGetApiUsersStats<
    any,
    unknown
  >({
    query: { enabled: !!token },
    request: token
      ? { headers: { Authorization: `Bearer ${token}` } }
      : undefined,
  });

  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [isPwdResetting, setIsPwdResetting] = useState(false);

  const openPasswordModal = () => {
    if (!isDbUser) {
      toast(
        "Zmiana hasła dostępna tylko dla użytkowników zarejestrowanych ręcznie.",
        "info"
      );
      setShowSettingsMenu(false);
      return;
    }
    setShowSettingsMenu(false);
    setShowPasswordModal(true);
  };

  const handlePasswordReset = () => {
    setIsPwdResetting(true);
    postUsersPasswordReset(undefined, {
      onSuccess: (data) => {
        setShowPasswordModal(false);
        if ((data as any)?.ticketUrl) {
          window.open((data as any).ticketUrl, "_blank");
          toast("Otwieram stronę resetu hasła.", "success");
        } else {
          toast("Wysłano żądanie resetu hasła. Sprawdź email.", "success");
        }
      },
      onError: (err) => {
        console.error("Password reset failed:", err);
        toast("Nie udało się wysłać żądania resetu hasła.", "error");
      },
      onSettled: () => {
        setIsPwdResetting(false);
      },
    });
  };

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

  const recList = Array.isArray(recommendations?.recommendations)
    ? recommendations!.recommendations
    : [];

  const getStat = (pascal?: any, camel?: any, fallback?: any) => {
    if (pascal !== undefined && pascal !== null) return pascal;
    if (camel !== undefined && camel !== null) return camel;
    return fallback;
  };

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
          <div className="flex items-center gap-3">
            <h1 className="text-4xl font-extrabold">Twój panel</h1>

            <div className="relative">
              <button
                onClick={() => setShowSettingsMenu((s) => !s)}
                className="p-2 bg-white/10 rounded-md hover:bg-white/20 transition"
                title="Ustawienia"
              >
                <Settings className="w-5 h-5" />
              </button>

              {showSettingsMenu && (
                <div className="absolute right-0 mt-2 w-44 bg-black/80 border border-white/10 rounded shadow-lg z-40">
                  <button
                    onClick={() => {
                      openNicknameModal();
                      setShowSettingsMenu(false);
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-white/5"
                  >
                    Zmień nazwę
                  </button>

                  {isDbUser && (
                    <button
                      onClick={() => openPasswordModal()}
                      className="w-full text-left px-3 py-2 hover:bg-white/5"
                    >
                      Zmień hasło
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
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

      {/* Nickname modal */}
      {showNicknameModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setShowNicknameModal(false)}
          />
          <form
            onSubmit={handleSaveNickname}
            className="relative bg-white/5 backdrop-blur-md border border-white/10 rounded-lg p-6 w-full max-w-md z-50"
          >
            <h3 className="text-lg font-semibold mb-2 text-white">
              Zmień nazwę użytkownika
            </h3>
            <label className="block text-sm text-gray-300 mb-2">
              Nowa nazwa
            </label>
            <input
              autoFocus
              value={newNickname}
              onChange={(e) => setNewNickname(e.target.value)}
              className="w-full p-2 rounded bg-white/5 border border-white/10 text-white focus:outline-none"
              placeholder="Wpisz nową nazwę"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowNicknameModal(false)}
                className="px-4 py-2 rounded bg-white/10 hover:bg-white/20 text-white"
                disabled={isUpdating}
              >
                Anuluj
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-60"
                disabled={isUpdating || !(newNickname ?? "").trim()}
              >
                {isUpdating ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> Zapisz...
                  </span>
                ) : (
                  "Zapisz"
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Password reset modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setShowPasswordModal(false)}
          />
          <div className="relative bg-white/5 backdrop-blur-md border border-white/10 rounded-lg p-6 w-full max-w-md z-50">
            <h3 className="text-lg font-semibold mb-2 text-white">
              Zmień hasło
            </h3>
            <p className="text-sm text-gray-300 mb-4">
              Kliknij poniżej, aby otrzymać bezpieczny link do resetu hasła.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setShowPasswordModal(false)}
                className="px-4 py-2 rounded bg-white/10 hover:bg-white/20 text-white"
                disabled={isPwdResetting}
              >
                Anuluj
              </button>
              <button
                onClick={handlePasswordReset}
                className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white"
                disabled={isPwdResetting}
              >
                {isPwdResetting ? "Wysyłanie..." : "Wyślij link resetu"}
              </button>
            </div>
          </div>
        </div>
      )}

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

        {/* === STATISTICS CARD === */}
        <div className="rounded-xl bg-black/40 border border-white/10 p-6">
          <h2 className="text-2xl font-semibold mb-2">Twoje statystyki</h2>
          <p className="text-gray-300 mb-4">
            Szybkie podsumowanie Twoich aktywności.
          </p>

          <div className="grid grid-cols-1 gap-3">
            <div className="bg-white/5 p-3 rounded flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-300">Albumy w kolekcji</div>
                <div className="text-xl font-bold">
                  {isStatsLoading
                    ? "..."
                    : getStat(
                        userStats?.AlbumsCount,
                        userStats?.albumsCount,
                        albumCount ?? 0
                      )}
                </div>
              </div>
            </div>

            <div className="bg-white/5 p-3 rounded flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-300">Twoje recenzje</div>
                <div className="text-xl font-bold">
                  {isStatsLoading
                    ? "..."
                    : getStat(
                        userStats?.ReviewsCount,
                        userStats?.reviewsCount,
                        "—"
                      )}
                </div>
              </div>
            </div>

            <div className="bg-white/5 p-3 rounded flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-300">Średnia ocena</div>
                <div className="text-xl font-bold">
                  {isStatsLoading
                    ? "..."
                    : (() => {
                        const avg = getStat(
                          userStats?.AverageScore,
                          userStats?.averageScore,
                          null
                        );
                        return avg != null ? Number(avg).toFixed(1) : "—";
                      })()}
                </div>
              </div>
            </div>
          </div>
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

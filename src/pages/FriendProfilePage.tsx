import { useAuth0 } from "@auth0/auth0-react";
import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import AlbumCard from "../components/AlbumCard";
import { Loader2 } from "lucide-react";
import {
  useGetApiSocialProfileUserId,
  useGetApiUserAlbumsUserId,
} from "../api/endpoints/tunerateApi";

export default function FriendProfilePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated, getAccessTokenSilently, loginWithRedirect } =
    useAuth0();
  const [token, setToken] = useState<string | null>(null);

  // 🔹 Pobranie tokena z Auth0
  useEffect(() => {
    if (!isAuthenticated) return;

    getAccessTokenSilently()
      .then((t) => setToken(t))
      .catch((err) => {
        console.error("Token error:", err);
        setToken(null);
      });
  }, [isAuthenticated, getAccessTokenSilently]);

  // 🔹 Ustawienia dla requestów Orvala
  const requestOptions = token
    ? { request: { headers: { Authorization: `Bearer ${token}` } } }
    : {};

  // 🔹 Pobranie profilu (Orval: id, params?, options)
  const {
    data: profile,
    isLoading: loadingProfile,
    isError: errorProfile,
    refetch: refetchProfile,
  } = useGetApiSocialProfileUserId<any, unknown>(id ?? "", {
    query: { enabled: !!token },
    ...requestOptions,
  });

  // 🔹 Pobranie albumów użytkownika (Orval: id, params?, options)
  const {
    data: userAlbums,
    isLoading: loadingAlbums,
    isError: errorAlbums,
    refetch: refetchAlbums,
  } = useGetApiUserAlbumsUserId<any, unknown>(id ?? "", {
    query: { enabled: !!token },
    ...requestOptions,
  });

  // 🔹 refetch po zdobyciu tokena
  useEffect(() => {
    if (token) {
      refetchProfile();
      refetchAlbums();
    }
  }, [token, refetchProfile, refetchAlbums]);

  // 🔹 Jeśli niezalogowany
  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center h-screen text-white">
        <h1 className="text-2xl font-bold mb-4">Musisz się zalogować</h1>
        <button
          onClick={() => loginWithRedirect()}
          className="px-6 py-3 bg-blue-600 rounded-lg hover:bg-blue-700 transition"
        >
          Zaloguj się
        </button>
      </div>
    );
  }

  const normalizedProfile = profile ?? {};
  const rawReviews =
    normalizedProfile.reviews ?? normalizedProfile.Reviews ?? [];
  const rawFavoriteAlbums =
    normalizedProfile.favoriteAlbums ?? normalizedProfile.FavoriteAlbums ?? [];
  const rawAlbumsList = Array.isArray(userAlbums)
    ? userAlbums
    : userAlbums?.items ?? [];

  const friendForHeader = {
    id: normalizedProfile.id ?? normalizedProfile.Id,
    nickname:
      normalizedProfile.nickname ?? normalizedProfile.Nickname ?? "Nieznany",
    status: normalizedProfile.status ?? normalizedProfile.Status,
    avatarUrl:
      normalizedProfile.picture ??
      normalizedProfile.Picture ??
      normalizedProfile.avatarUrl ??
      normalizedProfile.AvatarUrl,
  };

  // Normalizacja albumów: zwróć obiekt pasujący do AlbumCard (camelCase)
  const albumsList = useMemo(() => {
    if (!rawAlbumsList || !Array.isArray(rawAlbumsList)) return [];
    return rawAlbumsList.map((ua: any) => {
      const a = ua.album ?? ua.Album ?? ua;
      return {
        id:
          ua.id ??
          ua.Id ??
          a?.id ??
          a?.Id ??
          ua.albumId ??
          ua.AlbumId ??
          a?.albumId ??
          a?.AlbumId,
        title:
          ua.title ??
          ua.Title ??
          a?.title ??
          a?.Title ??
          a?.albumTitle ??
          a?.AlbumTitle ??
          "",
        artist:
          ua.artist ??
          ua.Artist ??
          a?.artist ??
          a?.Artist ??
          (a?.Artist ? a.Artist.Name ?? a.Artist.name : null) ??
          "",
        coverUrl:
          ua.coverUrl ??
          ua.CoverUrl ??
          a?.coverUrl ??
          a?.CoverUrl ??
          a?.albumCoverUrl ??
          a?.AlbumCoverUrl ??
          a?.CoverURL ??
          "",
        releaseDate:
          ua.releaseDate ??
          ua.ReleaseDate ??
          a?.releaseDate ??
          a?.ReleaseDate ??
          null,
      };
    });
  }, [rawAlbumsList]);

  // Normalizacja recenzji
  const reviews = useMemo(() => {
    if (!rawReviews || !Array.isArray(rawReviews)) return [];
    return rawReviews.map((r: any) => {
      return {
        id: r.id ?? r.Id,
        score: r.score ?? r.Score,
        content: r.content ?? r.Content,
        albumTitle:
          r.albumTitle ??
          r.AlbumTitle ??
          r.album?.title ??
          r.Album?.Title ??
          (r.album ? r.album.Title ?? r.album.title : ""),
        albumId:
          r.albumId ??
          r.AlbumId ??
          r.album?.id ??
          r.Album?.Id ??
          r.albumId ??
          null,
        createdAt: r.createdAt ?? r.CreatedAt ?? null,
      };
    });
  }, [rawReviews]);

  // 🔹 loading
  if (
    loadingProfile ||
    loadingAlbums ||
    !normalizedProfile ||
    albumsList === undefined
  ) {
    return (
      <div className="flex justify-center items-center h-screen text-white">
        <Loader2 className="animate-spin w-8 h-8 mr-3" />
        <span>Wczytywanie profilu...</span>
      </div>
    );
  }

  // 🔹 błąd
  if (errorProfile || errorAlbums) {
    return (
      <p className="text-center text-red-400 mt-8">
        Nie udało się pobrać danych użytkownika.
      </p>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-24 h-24 rounded-full bg-gray-700 overflow-hidden flex items-center justify-center text-2xl text-white">
            {friendForHeader.avatarUrl ? (
              <img
                src={friendForHeader.avatarUrl}
                alt={friendForHeader.nickname}
                className="w-full h-full object-cover"
              />
            ) : (
              <span>
                {(friendForHeader.nickname || "U").charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">
              {friendForHeader.nickname}
            </h1>
            <div className="mt-1 flex items-center gap-3">
              <span
                className={`inline-flex items-center px-2 py-1 text-sm rounded-full ${
                  friendForHeader.status === "Online"
                    ? "bg-green-600 text-white"
                    : "bg-gray-700 text-gray-200"
                }`}
              >
                {friendForHeader.status ?? "Offline"}
              </span>
              <span className="text-sm text-gray-400">
                {albumsList.length} albumów
              </span>
              <span className="text-sm text-gray-400">
                {reviews.length} ocen
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Placeholder buttons - keep simple */}
          <button
            onClick={() => navigate(`/chat/${friendForHeader.id ?? id}`)}
            className="px-4 py-2 bg-blue-600 rounded-md text-white hover:bg-blue-700 transition"
          >
            Wyślij wiadomość
          </button>
        </div>
      </div>

      {/* Main content: left = albums, right = reviews */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2">
          <h2 className="text-xl font-bold mb-3">Albumy użytkownika</h2>
          {albumsList.length === 0 ? (
            <p className="text-gray-400">
              Użytkownik nie dodał jeszcze żadnych albumów.
            </p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {albumsList.map((a: any) => (
                <AlbumCard key={a.id ?? a.title} album={a} />
              ))}
            </div>
          )}

          {/* Favorite albums (optional) */}
          {rawFavoriteAlbums && rawFavoriteAlbums.length > 0 && (
            <div className="mt-6">
              <h3 className="font-semibold mb-2">Ulubione albumy</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {rawFavoriteAlbums.map((f: any, idx: number) => {
                  const fa = f.album ?? f.Album ?? (f || {});
                  const item = {
                    id: fa.id ?? fa.Id ?? `${idx}`,
                    title: fa.title ?? fa.Title ?? fa.name ?? "",
                    artist:
                      fa.artist ??
                      fa.Artist ??
                      (fa.Artist ? fa.Artist.Name : "") ??
                      "",
                    coverUrl: fa.coverUrl ?? fa.CoverUrl ?? "",
                  };
                  return <AlbumCard key={item.id} album={item} />;
                })}
              </div>
            </div>
          )}
        </div>

        <aside className="md:col-span-1">
          <h2 className="text-xl font-bold mb-3">Ostatnie oceny</h2>

          {reviews.length === 0 ? (
            <p className="text-gray-400">Brak ocen.</p>
          ) : (
            <div className="space-y-3">
              {reviews.map((r: any) => (
                <div
                  key={r.id}
                  className="bg-gray-900 p-3 rounded-lg border border-gray-800"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-white">
                        {r.albumTitle ?? "–"}
                      </p>
                      <p className="text-sm text-gray-400 mt-1">{r.content}</p>
                    </div>
                    <div className="ml-4 flex flex-col items-end">
                      <span className="text-sm text-gray-400">
                        {r.createdAt
                          ? new Date(r.createdAt).toLocaleDateString()
                          : ""}
                      </span>
                      <div className="mt-2 inline-flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-r from-yellow-400 to-orange-500 text-black font-bold">
                        {r.score ?? "-"}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

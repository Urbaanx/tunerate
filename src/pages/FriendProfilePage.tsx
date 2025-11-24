import { useAuth0 } from "@auth0/auth0-react";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import FriendListItem from "../components/FriendListItem";
import AlbumCard from "../components/AlbumCard";
import { Loader2 } from "lucide-react";
import {
  useGetApiSocialProfileUserId,
  useGetApiUserAlbumsUserId,
} from "../api/endpoints/tunerateApi";

export default function FriendProfilePage() {
  const { id } = useParams();
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

  // normalize shapes (handle PascalCase / camelCase)
  const normalizedProfile = profile ?? {};
  const reviews = normalizedProfile.reviews ?? normalizedProfile.Reviews ?? [];
  const favoriteAlbums =
    normalizedProfile.favoriteAlbums ?? normalizedProfile.FavoriteAlbums ?? [];
  const albumsList = Array.isArray(userAlbums)
    ? userAlbums
    : userAlbums?.items ?? [];

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
    <div className="p-6 max-w-4xl mx-auto">
      {/* Profil użytkownika */}
      <FriendListItem
        friend={{
          id: normalizedProfile.id ?? normalizedProfile.Id,
          nickname:
            normalizedProfile.nickname ??
            normalizedProfile.Nickname ??
            "Nieznany",
        }}
      />

      {/* Ostatnie oceny */}
      <h2 className="text-xl font-bold mt-6 mb-2">Ostatnie oceny</h2>
      <div className="space-y-2">
        {(!reviews || reviews.length === 0) && (
          <p className="text-gray-400">Brak ocen.</p>
        )}

        {(reviews || []).map((r: any) => (
          <div key={r.id ?? r.Id} className="bg-gray-800 rounded-lg p-3">
            <p className="font-semibold">
              {r.albumTitle ?? r.AlbumTitle ?? "–"}
            </p>
            <p className="text-sm text-gray-400">{r.score ?? r.Score}/10</p>
            <p className="text-gray-300">{r.content ?? r.Content}</p>
          </div>
        ))}
      </div>

      {/* Albumy użytkownika */}
      <h2 className="text-xl font-bold mt-6 mb-2">Albumy użytkownika</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {(!albumsList || albumsList.length === 0) && (
          <p className="text-gray-400 col-span-full">
            Użytkownik nie dodał jeszcze żadnych albumów.
          </p>
        )}

        {(albumsList || []).map((ua: any) => (
          <AlbumCard key={ua.id ?? ua.Id} album={ua} />
        ))}
      </div>
    </div>
  );
}

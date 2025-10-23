import React, { useState, useEffect } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import {
  useGetApiAlbumsSearch,
  usePostApiUserAlbums,
} from "../api/endpoints/tunerateApi";
import AlbumCard from "../components/AlbumCard";

const SearchPage: React.FC = () => {
  const [query, setQuery] = useState("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [albums, setAlbums] = useState<any[]>([]);
  const { isAuthenticated, loginWithRedirect, getAccessTokenSilently } =
    useAuth0();
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    if (isAuthenticated) {
      getAccessTokenSilently()
        .then((t) => {
          if (mounted) setToken(t);
        })
        .catch((err) => {
          console.error("Błąd pobierania tokena:", err);
          if (mounted) setToken(null);
        });
    } else {
      setToken(null);
    }
    return () => {
      mounted = false;
    };
  }, [isAuthenticated, getAccessTokenSilently]);

  const { data, isFetching, isError, refetch } = useGetApiAlbumsSearch<
    any,
    unknown
  >(searchQuery ? { query: searchQuery } : undefined, {
    request: token
      ? { headers: { Authorization: `Bearer ${token}` } }
      : undefined,
    query: {
      queryKey: ["albums-search", searchQuery, token],
      enabled: !!(searchQuery && token),
      retry: false,
    },
  });

  useEffect(() => {
    if (data) {
      setAlbums(data as any[]);
    } else {
      setAlbums([]);
    }
  }, [data]);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setSearchQuery(query.trim());
    if (token) {
      refetch();
    }
  };

  const { mutate: postUserAlbum } = usePostApiUserAlbums({
    request: token ? { headers: { Authorization: `Bearer ${token}` } } : undefined,
  });

  const handleAddToCollection = async (album: any) => {
    if (!isAuthenticated) {
      loginWithRedirect();
      return;
    }

    let t = token;
    try {
      t = await getAccessTokenSilently();
      setToken(t ?? null);
    } catch (e) {
      console.error("Failed to refresh token", e);
      alert("Nie można pobrać tokenu. Zaloguj się ponownie.");
      return;
    }
    console.log("album", album);
    const payload = {
      title: album.title ?? null,
      artist: album.artist ?? null,
      artistId: album.artistId ?? "00000000-0000-0000-0000-000000000000",
      releaseDate: album.releaseDate ?? null,
      externalId: album.externalId ?? null,
      coverUrl: album.coverUrl ?? null,
    };

    postUserAlbum(
      { data: payload },
      {
        onSuccess: () => {
          alert(`Dodano album "${album.title}" do kolekcji.`);
        },
        onError: (err: any) => {
          console.error("Add album failed:", err);
          if (err?.response?.status === 409) {
            alert("Ten album już znajduje się w Twojej kolekcji.");
          } else {
            alert("Wystąpił błąd przy dodawaniu albumu.");
          }
        },
      }
    );
  };

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gradient-to-r from-purple-900 via-indigo-900 to-black text-white">
        <h1 className="text-4xl font-bold mb-4">Musisz się zalogować</h1>
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
      <h1 className="text-4xl font-extrabold mb-6 text-center">
        Wyszukaj album
      </h1>

      <div className="flex justify-center mb-8">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Wpisz nazwę albumu lub wykonawcę..."
          className="w-1/2 px-4 py-2 rounded-l-lg bg-gray-800 text-white border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={handleSearch}
          className="px-6 py-2 bg-blue-600 rounded-r-lg hover:bg-blue-700 transition"
        >
          Szukaj
        </button>
      </div>

      {isFetching && (
        <p className="text-center text-gray-400">Wyszukiwanie...</p>
      )}
      {isError && (
        <p className="text-center text-red-400">
          Nie udało się pobrać wyników wyszukiwania.
        </p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {albums.map((a) => (
          <AlbumCard
            key={a.id ?? a.musicBrainzId ?? a.title}
            album={{
              id: a.id,
              title: a.title ?? "",
              artist: a.artist?.name ?? a.artist ?? "",
              artistId: a.artistId ?? "00000000-0000-0000-0000-000000000000",
              releaseDate: a.releaseDate ?? null,
              externalId: a.externalId ?? null,
              coverUrl: a.coverUrl ?? null,
            }}
            onAddToCollection={handleAddToCollection}
          />
        ))}
      </div>
    </div>
  );
};

export default SearchPage;

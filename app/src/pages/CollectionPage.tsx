import React, { useEffect, useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { useGetApiUserAlbums } from "../api/endpoints/tunerateApi";
import AlbumCard from "../components/AlbumCard";
import { Loader2 } from "lucide-react";

const CollectionPage: React.FC = () => {
  const { isAuthenticated, getAccessTokenSilently, loginWithRedirect } = useAuth0();
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) return;
    getAccessTokenSilently()
      .then((t) => setToken(t))
      .catch((err) => {
        console.error("Błąd pobierania tokena:", err);
        setToken(null);
      });
  }, [isAuthenticated, getAccessTokenSilently]);

  const queryOptions = token
    ? {
        request: { headers: { Authorization: `Bearer ${token}` } },
        query: { enabled: true },
      }
    : {
        query: { enabled: false },
      };

  const { data, isLoading, isError, refetch } = useGetApiUserAlbums<any, unknown>(
    queryOptions
  );

  useEffect(() => {
    if (token) refetch();
  }, [token, refetch]);

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

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen text-white">
        <Loader2 className="animate-spin w-8 h-8 mr-3" />
        <span>Ładowanie kolekcji...</span>
      </div>
    );
  }

  if (isError) {
    return <p className="text-center text-red-400 mt-8">Nie udało się pobrać kolekcji.</p>;
  }

  if (!data || data.length === 0) {
    return <p className="text-center text-gray-400 mt-8">Nie masz jeszcze żadnych albumów w kolekcji.</p>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-r from-purple-900 via-indigo-900 to-black text-white p-6">
      <h1 className="text-4xl font-extrabold mb-6 text-center">🎵 Moja kolekcja</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {data.map((album: any) => (
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
    </div>
  );
};

export default CollectionPage;

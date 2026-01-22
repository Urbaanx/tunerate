import React, { useState, useEffect } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import {
  useGetApiAlbums,
  usePostApiUserAlbums
} from "../api/endpoints/tunerateApi";
import AlbumCard from "../components/AlbumCard";
import { ChevronLeft, ChevronRight } from "lucide-react";

const BrowseAlbumsPage: React.FC = () => {
  const [query, setQuery] = useState("");
  const [genre, setGenre] = useState("");
  const [artist, setArtist] = useState("");
  const [year, setYear] = useState<number | undefined>(undefined);
  const [popularity, setPopularity] = useState("");
  const [sort, setSort] = useState("title_asc");

  const [page, setPage] = useState(1);
  const [pageSize] = useState(12);

  const { isAuthenticated, loginWithRedirect, getAccessTokenSilently } = useAuth0();
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthenticated) {
      getAccessTokenSilently().then(setToken).catch(() => setToken(null));
    } else {
      setToken(null);
    }
  }, [isAuthenticated]);

  const { data, isFetching, isError } = useGetApiAlbums<any, unknown>(
    { page, pageSize, sort, genre, artist, year, popularity },
    {
      query: ({
        queryKey: ["albums", page, sort, genre, artist, year, popularity, token],
        enabled: !!token,
        keepPreviousData: true,
        retry: false
      } as any),
    }
  );

  const [albums, setAlbums] = useState<any[]>([]);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalCount, setTotalCount] = useState<number>(0);

  useEffect(() => {
    if (data) {
      setAlbums(data.items ?? []);
      setTotalPages(data.totalPages ?? 1);
      setTotalCount(data.totalCount ?? 0);
    }
  }, [data]);

  const { mutate: postUserAlbum } = usePostApiUserAlbums();
  const handleAddToCollection = async (album: any) => {
    if (!isAuthenticated) return loginWithRedirect();

    const payload = {
      title: album.title,
      artist: album.artist,
      releaseDate: album.releaseDate,
      externalId: album.externalId,
      coverUrl: album.coverUrl,
    };

    postUserAlbum({ data: payload }, {
      onSuccess: () => alert(`Dodano album "${album.title}" do kolekcji.`),
      onError: () => alert("Wystąpił błąd przy dodawaniu albumu."),
    });
  };

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gradient-to-r from-purple-900 via-indigo-900 to-black text-white">
        <h1 className="text-4xl font-bold mb-4">Musisz się zalogować</h1>
        <button onClick={() => loginWithRedirect()} className="px-6 py-3 bg-blue-600 rounded-lg hover:bg-blue-700 transition">
          Zaloguj się
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-r from-purple-900 via-indigo-900 to-black text-white p-6">
      <h1 className="text-4xl font-extrabold mb-6 text-center">Przeglądaj albumy</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 text-black">
        <input
          type="text"
          placeholder="Szukaj tytułu lub wykonawcy..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="p-2 rounded-lg"
        />
        <input
          type="text"
          placeholder="Gatunek"
          value={genre}
          onChange={(e) => setGenre(e.target.value)}
          className="p-2 rounded-lg"
        />
        <input
          type="text"
          placeholder="Wykonawca"
          value={artist}
          onChange={(e) => setArtist(e.target.value)}
          className="p-2 rounded-lg"
        />
        <input
          type="number"
          placeholder="Rok"
          value={year ?? ""}
          onChange={(e) => setYear(e.target.value ? parseInt(e.target.value) : undefined)}
          className="p-2 rounded-lg"
        />
      </div>

      <div className="flex justify-center mb-4 space-x-4">
        <select value={sort} onChange={(e) => setSort(e.target.value)} className="bg-gray-800 text-white p-2 rounded-lg border border-gray-700">
          <option value="title_asc">Tytuł A-Z</option>
          <option value="title_desc">Tytuł Z-A</option>
          <option value="artist_asc">Artysta A-Z</option>
          <option value="artist_desc">Artysta Z-A</option>
          <option value="date_desc">Najnowsze</option>
          <option value="date_asc">Najstarsze</option>
          <option value="rating_desc">Najwyżej oceniane</option>
          <option value="rating_asc">Najniżej oceniane</option>
        </select>

        <select value={popularity} onChange={(e) => setPopularity(e.target.value)} className="bg-gray-800 text-white p-2 rounded-lg border border-gray-700">
          <option value="">Popularność</option>
          <option value="most_reviewed">Najczęściej recenzowane</option>
          <option value="least_reviewed">Najrzadziej recenzowane</option>
        </select>
      </div>

      {isFetching && <p className="text-center text-gray-400">Ładowanie...</p>}
      {isError && <p className="text-center text-red-400">Nie udało się pobrać albumów.</p>}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {albums.map((a) => (
          <AlbumCard
            key={a.id}
            album={{
              id: a.id,
              title: a.title,
              artist: a.artist,
              coverUrl: a.coverUrl,
              releaseDate: a.releaseDate,
              externalId: a.externalId,
            }}
            onAddToCollection={handleAddToCollection}
          />
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center items-center space-x-4 mt-6">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="px-3 py-2 bg-gray-800 rounded-lg disabled:opacity-40 flex items-center">
            <ChevronLeft className="w-4 h-4 mr-1" /> Poprzednia
          </button>
          <div className="text-gray-300">
            Strona <strong className="text-white">{page}</strong> z <strong className="text-white">{totalPages}</strong> — {totalCount} albumów
          </div>
          <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="px-3 py-2 bg-gray-800 rounded-lg disabled:opacity-40 flex items-center">
            Następna <ChevronRight className="w-4 h-4 ml-1" />
          </button>
        </div>
      )}
    </div>
  );
};

export default BrowseAlbumsPage;

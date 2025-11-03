import React, { useState, useEffect } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import {
  useGetApiAlbumsSearch,
  useGetApiAlbums,
  usePostApiUserAlbums,
} from "../api/endpoints/tunerateApi";
import AlbumCard from "../components/AlbumCard";
import { ChevronLeft, ChevronRight } from "lucide-react";

const SearchPage: React.FC = () => {
  const [query, setQuery] = useState("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [albums, setAlbums] = useState<any[]>([]);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalCount, setTotalCount] = useState<number>(0);

  const [page, setPage] = useState<number>(1);
  const [pageSize] = useState<number>(12);
  const [sort, setSort] = useState<string>("title_asc");

  const [year, setYear] = useState<string>("");
  const [artist, setArtist] = useState<string>("");
  const [genre, setGenre] = useState<string>("");

  const { isAuthenticated, loginWithRedirect, getAccessTokenSilently } = useAuth0();
  const [token, setToken] = useState<string | null>(null);

  // Pobranie tokena
  useEffect(() => {
    let mounted = true;
    if (isAuthenticated) {
      getAccessTokenSilently()
        .then((t) => {
          if (mounted) setToken(t);
        })
        .catch(() => {
          if (mounted) setToken(null);
        });
    } else {
      setToken(null);
    }
    return () => {
      mounted = false;
    };
  }, [isAuthenticated, getAccessTokenSilently]);

  // Reset strony przy zmianie filtrów
  useEffect(() => {
    setPage(1);
    // jak zmieniamy filtry, chcemy widok lokalny — wyłącz wyszukiwanie MusicBrainz
    setSearchQuery("");
  }, [artist, year, genre, sort]);

  // 🔹 Fetch lokalnych albumów (server-side filtry: artist, year, genre)
  const {
    data: localAlbumsData,
    isFetching: isFetchingLocal,
    refetch: refetchLocal,
  } = useGetApiAlbums<any>(
    {
      page,
      pageSize,
      sort,
      // przekazujemy tylko jeśli są ustawione (backend potrafi obsłużyć null/undefined)
      artist: artist || undefined,
      year: year ? parseInt(year) : undefined,
      genre: genre || undefined,
    },
    {
      query: {
        enabled: !!token && !searchQuery, // pobieramy lokalne tylko gdy nie w trybie wyszukiwania
        keepPreviousData: true,
      } as any,
    }
  );

  // 🔹 Fetch wyszukiwanych albumów (MusicBrainz via /api/albums/search)
  const {
    data: searchAlbumsData,
    isFetching: isFetchingSearch,
    isError: isSearchError,
  } = useGetApiAlbumsSearch<any, unknown>(
    searchQuery
      ? { query: searchQuery, page, pageSize, sort }
      : undefined,
    {
      query: ({
        queryKey: ["albums-search", searchQuery, page, sort, token],
        enabled: !!(searchQuery && token),
        keepPreviousData: true,
        retry: false,
      } as any),
    }
  );

  // 🔹 Aktualizacja danych (w zależności od trybu)
  useEffect(() => {
    const activeData = searchQuery ? searchAlbumsData : localAlbumsData;

    if (activeData) {
      // różne shape odpowiedzi: items / Items / albumsFromApi.Items
      const items =
        (activeData as any).items ??
        (activeData as any).Items ??
        (activeData as any).albumsFromApi?.Items ??
        [];
      const tp =
        (activeData as any).totalPages ??
        (activeData as any).TotalPages ??
        Math.ceil(((activeData as any).totalCount ?? (activeData as any).TotalCount ?? items.length) / pageSize);

      const tc =
        (activeData as any).totalCount ?? (activeData as any).TotalCount ?? items.length;

      setAlbums(items);
      setTotalPages(tp);
      setTotalCount(tc);
    } else {
      setAlbums([]);
      setTotalPages(1);
      setTotalCount(0);
    }
  }, [localAlbumsData, searchAlbumsData, searchQuery, pageSize]);

  // 🔹 Obsługa opóźnienia wpisywania (debounce 800ms)
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (query.trim().length > 2) {
        setSearchQuery(query.trim());
        setPage(1);
      } else {
        // krótkie query -> wyłącz wyszukiwanie i wróć do lokalnych (server-side filtry zostaną użyte)
        setSearchQuery("");
        // refetchLocal() nie jest konieczne — react-query odświeży gdy params się zmienią,
        // ale możemy wywołać dla pewności:
        refetchLocal();
      }
    }, 800);
    return () => clearTimeout(timeout);
  }, [query, refetchLocal]);

  // 🔹 Dodawanie albumu do kolekcji
  const { mutate: postUserAlbum } = usePostApiUserAlbums();
  const handleAddToCollection = async (album: any) => {
    if (!isAuthenticated) {
      loginWithRedirect();
      return;
    }
    const payload = {
      title: album.title ?? album.Title ?? null,
      artist: album.artist ?? album.Artist ?? null,
      artistId: album.artistId ?? album.artistId ?? "00000000-0000-0000-0000-000000000000",
      releaseDate: album.releaseDate ?? album.ReleaseDate ?? null,
      externalId: album.externalId ?? album.externalId ?? "",
      coverUrl: album.coverUrl ?? album.CoverUrl ?? null,
    };

    postUserAlbum(
      { data: payload },
      {
        onSuccess: () => alert(`Dodano album "${payload.title}" do kolekcji.`),
        onError: (err: any) => {
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

  const isFetching = isFetchingLocal || isFetchingSearch;

  return (
    <div className="min-h-screen bg-gradient-to-r from-purple-900 via-indigo-900 to-black text-white p-6">
      <h1 className="text-4xl font-extrabold mb-6 text-center">
        {searchQuery ? "Wyniki wyszukiwania" : "Przeglądaj albumy"}
      </h1>

      {/* 🔍 Wyszukiwanie */}
      <div className="flex justify-center mb-6">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Wpisz nazwę albumu lub wykonawcę..."
          className="w-1/2 px-4 py-2 rounded-l-lg bg-gray-800 text-white border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={() => {
            if (query.trim().length > 0) {
              setSearchQuery(query.trim());
              setPage(1);
            }
          }}
          className="px-6 py-2 bg-blue-600 rounded-r-lg hover:bg-blue-700 transition"
        >
          Szukaj
        </button>
      </div>

      {/* 🔽 Filtry i sortowanie (server-side) */}
      <div className="flex flex-wrap justify-center gap-4 mb-8">
        <select
          value={sort}
          onChange={(e) => {
            setSort(e.target.value);
            setPage(1);
          }}
          className="bg-gray-800 text-white p-2 rounded-lg border border-gray-700"
        >
          <option value="title_asc">Tytuł A-Z</option>
          <option value="title_desc">Tytuł Z-A</option>
          <option value="artist_asc">Artysta A-Z</option>
          <option value="artist_desc">Artysta Z-A</option>
          <option value="rating_desc">Najwyżej oceniane</option>
          <option value="rating_asc">Najniżej oceniane</option>
          <option value="date_desc">Data (najnowsze)</option>
          <option value="date_asc">Data (najstarsze)</option>
        </select>

        <input
          type="text"
          placeholder="Wykonawca"
          value={artist}
          onChange={(e) => setArtist(e.target.value)}
          className="bg-gray-800 text-white p-2 rounded-lg border border-gray-700"
        />

        <input
          type="number"
          placeholder="Rok wydania"
          value={year}
          onChange={(e) => setYear(e.target.value)}
          className="bg-gray-800 text-white p-2 rounded-lg border border-gray-700 w-36"
        />

        <input
          type="text"
          placeholder="Gatunek"
          value={genre}
          onChange={(e) => setGenre(e.target.value)}
          className="bg-gray-800 text-white p-2 rounded-lg border border-gray-700"
        />
      </div>

      {isFetching && (
        <p className="text-center text-gray-400">Ładowanie albumów...</p>
      )}
      {isSearchError && (
        <p className="text-center text-red-400">
          Nie udało się pobrać wyników wyszukiwania.
        </p>
      )}

      {/* 🖼️ Lista albumów (bez dodatkowego client-side filtrowania) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {albums.map((a) => (
          <AlbumCard
            key={a.id ?? a.externalId ?? a.title}
            album={{
              id: a.id,
              title: a.title ?? a.Title ?? "",
              artist: a.artist ?? a.Artist ?? "",
              artistId: a.artistId ?? a.artistId ?? "00000000-0000-0000-0000-000000000000",
              releaseDate: a.releaseDate ?? a.ReleaseDate ?? null,
              externalId: a.externalId ?? a.ExternalId ?? null,
              coverUrl: a.coverUrl ?? a.CoverUrl ?? null,
            }}
            onAddToCollection={handleAddToCollection}
          />
        ))}
      </div>

      {/* 📄 Paginacja */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center space-x-4 mt-6">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="px-3 py-2 bg-gray-800 rounded-lg disabled:opacity-40 flex items-center"
          >
            <ChevronLeft className="w-4 h-4 mr-1" /> Poprzednia
          </button>

          <div className="text-gray-300">
            Strona <strong className="text-white">{page}</strong> z{" "}
            <strong className="text-white">{totalPages}</strong> — {totalCount} albumów
          </div>

          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="px-3 py-2 bg-gray-800 rounded-lg disabled:opacity-40 flex items-center"
          >
            Następna <ChevronRight className="w-4 h-4 ml-1" />
          </button>
        </div>
      )}
    </div>
  );
};

export default SearchPage;

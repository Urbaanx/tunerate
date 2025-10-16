import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useAuth0 } from "@auth0/auth0-react";
import {
  useGetApiAlbumsId,
  useGetApiAlbumsIdReviews,
  useGetApiUserAlbums,
  usePostApiUserAlbums,
  useDeleteApiUserAlbumsAlbumId,
  usePostApiAlbumsIdReviews,
} from "../api/endpoints/tunerateApi";
import { Loader2, Star, User } from "lucide-react";

const AlbumDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const {
    isAuthenticated,
    isLoading: authLoading,
    getAccessTokenSilently,
    loginWithRedirect,
  } = useAuth0();

  const [token, setToken] = useState<string | null>(null);
  const [isInCollection, setIsInCollection] = useState<boolean>(false);
  const [newReview, setNewReview] = useState<string>("");

  useEffect(() => {
    if (!isAuthenticated) return;
    getAccessTokenSilently()
      .then((t) => setToken(t))
      .catch(() => setToken(null));
  }, [isAuthenticated, getAccessTokenSilently]);

  const {
    data: album,
    isLoading: albumLoading,
    isError: albumError,
  } = useGetApiAlbumsId<any, unknown>(id!, {
    query: { enabled: !!token && !!id },
    request: token
      ? { headers: { Authorization: `Bearer ${token}` } }
      : undefined,
  });


  const { data: userAlbums, refetch: refetchUserAlbums } = useGetApiUserAlbums<
    any,
    unknown
  >({
    query: { enabled: !!token },
    request: token
      ? { headers: { Authorization: `Bearer ${token}` } }
      : undefined,
  });


  const {
    data: reviews,
    isLoading: reviewsLoading,
    isError: reviewsError,
    refetch: refetchReviews,
  } = useGetApiAlbumsIdReviews<any, unknown>(id!, {
    query: { enabled: !!token && !!id },
    request: token
      ? { headers: { Authorization: `Bearer ${token}` } }
      : undefined,
  });

  const postReviewMutation = usePostApiAlbumsIdReviews({
    request: token
      ? { headers: { Authorization: `Bearer ${token}` } }
      : undefined,
  });

  const postingReview = Boolean((postReviewMutation as any)?.isLoading);

  const { mutateAsync: addAlbum } = usePostApiUserAlbums();

  const { mutateAsync: removeAlbum } = useDeleteApiUserAlbumsAlbumId();

  useEffect(() => {
    if (userAlbums && album) {
      const found = userAlbums.some((a: any) => a.id === album.id);
      setIsInCollection(found);
    }
  }, [userAlbums, album]);

  const handleToggleCollection = async () => {
    if (!token || !album) return;

    try {
      if (isInCollection) {
        await removeAlbum({ albumId: album.id }, {
          request: { headers: { Authorization: `Bearer ${token}` } },
        } as any);
        setIsInCollection(false);
      } else {
        await addAlbum(
          {
            data: {
              title: album.title,
              artist: album.artist,
              coverUrl: album.coverUrl,
              externalId: album.musicBrainzId,
              releaseDate: album.releaseDate,
            },
          },
          {
            request: {
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
              },
            },
          } as any
        );
        setIsInCollection(true);
      }

      await refetchUserAlbums(); 
      if (refetchReviews) await refetchReviews();
    } catch (err) {
      console.error("❌ Błąd przy aktualizacji kolekcji:", err);
      alert("Nie udało się zaktualizować kolekcji.");
    }
  };

  const handleSubmitReview = async () => {
    if (!id || !newReview.trim()) return;
    if (!isInCollection) {
      alert("Dodaj album do kolekcji, aby móc dodać recenzję.");
      return;
    }

    try {
      let t = token;
      if (!t) {
        try {
          t = await getAccessTokenSilently();
          setToken(t ?? null);
        } catch (err) {
          console.error("Failed to get token for review:", err);
          alert("Nie można pobrać tokenu. Zaloguj się ponownie.");
          return;
        }
      }

      await postReviewMutation.mutateAsync({
        id,
        data: { content: newReview.trim() },
      });
      setNewReview("");
      if (refetchReviews) await refetchReviews();
    } catch (err) {
      console.error("Błąd dodawania recenzji:", err);
      alert("Nie udało się dodać recenzji.");
    }
  };

  if (authLoading || albumLoading) {
    return (
      <div className="flex justify-center items-center h-screen text-white">
        <Loader2 className="animate-spin w-8 h-8 mr-3" />
        <span>Ładowanie danych albumu...</span>
      </div>
    );
  }

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

  if (albumError || !album) {
    return (
      <div className="text-center text-red-400 mt-10">
        Nie udało się pobrać danych albumu.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-r from-purple-900 via-indigo-900 to-black text-white p-6">
      <div className="max-w-5xl mx-auto">
        {/* Sekcja albumu */}
        <div className="flex flex-col md:flex-row gap-6 items-center mb-10">
          <img
            src={album.coverUrl}
            alt={album.title}
            className="w-64 h-64 object-cover rounded-2xl shadow-lg"
          />
          <div className="flex-1">
            <h1 className="text-4xl font-extrabold mb-2">{album.title}</h1>
            <p className="text-xl text-gray-300 mb-2">{album.artist}</p>
            <p className="text-sm text-gray-400 mb-4">
              Data wydania: {album.releaseDate || "Nieznana"}
            </p>

            <div className="flex items-center mb-4">
              <Star className="text-yellow-400 w-5 h-5 mr-1" />
              <span className="text-lg font-semibold">
                {album.averageRating ? album.averageRating.toFixed(1) : "—"} /
                10
              </span>
            </div>

            <button
              onClick={handleToggleCollection}
              className={`px-6 py-3 rounded-ld font-medium transition ${
                isInCollection
                  ? "bg-red-600 hover:bg-red-700"
                  : "bg-blue-600 hover:bg-blue-700"
              }`}
            >
              {isInCollection ? "Usuń z kolekcji" : "Dodaj do kolekcji"}
            </button>
          </div>
        </div>

        {/* Sekcja recenzji */}
        <div className="bg-black/40 p-6 rounded-2xl border border-white/10">
          <h2 className="text-2xl font-semibold mb-4">Recenzje użytkowników</h2>

          {/* Formularz dodawania recenzji — widoczny tylko gdy album jest w kolekcji */}
          {isInCollection ? (
            <div className="mb-4">
              <textarea
                value={newReview}
                onChange={(e) => setNewReview(e.target.value)}
                rows={3}
                placeholder="Napisz recenzję..."
                className="w-full p-3 rounded-lg bg-gray-800 text-white border border-gray-700 focus:outline-none"
              />
              <div className="flex mt-2">
                <button
                  onClick={handleSubmitReview}
                  disabled={postingReview || !newReview.trim()}
                  className="ml-auto px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg text-white"
                >
                  {postingReview ? "Wysyłanie..." : "Dodaj recenzję"}
                </button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-400 mb-4">
              Dodaj album do kolekcji, aby napisać recenzję.
            </p>
          )}

          {reviewsLoading ? (
            <div className="flex items-center">
              <Loader2 className="animate-spin w-5 h-5 mr-2" />
              <span className="text-gray-400">Ładowanie recenzji...</span>
            </div>
          ) : reviewsError ? (
            <p className="text-red-400">Nie udało się pobrać recenzji.</p>
          ) : !reviews || reviews.length === 0 ? (
            <p className="text-gray-400">Brak recenzji dla tego albumu.</p>
          ) : (
            <ul className="space-y-4">
              {reviews.map((review: any) => (
                <li
                  key={review.id}
                  className="p-4 bg-black/50 rounded-xl border border-white/10"
                >
                  <div className="flex items-center mb-2">
                    <User className="w-4 h-4 mr-2 text-gray-400" />
                    <span className="font-semibold">
                      {review.user ?? review.User}
                    </span>
                    <span className="ml-auto text-xs text-gray-500">
                      {review.createdAt
                        ? new Date(review.createdAt).toLocaleString()
                        : ""}
                    </span>
                  </div>
                  <p className="text-gray-300">
                    {review.content ?? review.Content}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export default AlbumDetailsPage;

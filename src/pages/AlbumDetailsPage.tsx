import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useAuth0 } from "@auth0/auth0-react";
import {
  useGetApiAlbumsId,
  useGetApiReviewsAlbumId,
  useGetApiUserAlbums,
  usePostApiUserAlbums,
  useDeleteApiUserAlbumsAlbumId,
  usePostApiReviewsAlbumId,
  usePutApiReviewsReviewId,
  useDeleteApiReviewsReviewId,
  useGetApiRecommendationsAlbumAlbumId,
} from "../api/endpoints/tunerateApi";
import AlbumCard from "../components/AlbumCard";
import {
  Loader2,
  Star,
  User,
  Edit2,
  Trash2,
  X,
  Check,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

const AlbumDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const {
    isAuthenticated,
    isLoading: authLoading,
    getAccessTokenSilently,
    loginWithRedirect,
    user,
  } = useAuth0();

  const [token, setToken] = useState<string | null>(null);
  const [isInCollection, setIsInCollection] = useState<boolean>(false);
  const [newReview, setNewReview] = useState<string>("");
  const [rating, setRating] = useState<number>(0);
  const [editingReviewId, setEditingReviewId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState<string>("");
  const [editRating, setEditRating] = useState<number>(0);

  const [page, setPage] = useState<number>(1);
  const [pageSize] = useState<number>(5);
  const [sort, setSort] = useState<string>("newest");

  useEffect(() => {
    if (!isAuthenticated) {
      setToken(null);
      return;
    }
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
  });

  const { data: userAlbums, refetch: refetchUserAlbums } = useGetApiUserAlbums<
    any,
    unknown
  >({
    query: { enabled: !!token },
  });

  const {
    data: reviewsResponse,
    isLoading: reviewsLoading,
    isError: reviewsError,
    refetch: refetchReviews,
  } = useGetApiReviewsAlbumId<any, unknown>(
    id!,
    { page, pageSize, sort },
    {
      query: {
        enabled: !!token && !!id,
        queryKey: ["albumReviews", id, page, sort],
      },
    }
  );

  // === Pobranie rekomendacji z backendu ===
  const { data: recommendations } = useGetApiRecommendationsAlbumAlbumId<
    any,
    unknown
  >(id!, { topN: 5 }, { query: { enabled: !!token && !!id } });

  // Wyciągamy listę rekomendacji tak jak w DashboardPage
  const recList = Array.isArray(recommendations?.recommendations)
    ? recommendations!.recommendations
    : [];

  const reviews = reviewsResponse?.items ?? [];
  const totalPages = reviewsResponse?.totalPages ?? 1;
  const totalCount = reviewsResponse?.totalCount ?? 0;

  const { mutateAsync: postReviewMutation } = usePostApiReviewsAlbumId();
  const { mutateAsync: putReviewMutation } = usePutApiReviewsReviewId();
  const { mutateAsync: deleteReviewMutation } = useDeleteApiReviewsReviewId();
  const { mutateAsync: addAlbum } = usePostApiUserAlbums();
  const { mutateAsync: removeAlbum } = useDeleteApiUserAlbumsAlbumId();

  useEffect(() => {
    if (userAlbums && album) {
      const found = userAlbums.some((a: any) => a.id === album.id);
      setIsInCollection(found);
    }
  }, [userAlbums, album]);

  useEffect(() => {
    setPage(1);
  }, [sort]);

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
    if (!id || !newReview.trim() || rating <= 0) {
      alert("Uzupełnij treść i wybierz ocenę przed wysłaniem.");
      return;
    }
    if (!isInCollection) {
      alert("Dodaj album do kolekcji, aby móc dodać recenzję.");
      return;
    }

    try {
      await postReviewMutation({
        albumId: id!,
        data: { content: newReview.trim(), score: rating },
      });
      setNewReview("");
      setRating(0);
      if (sort === "newest") setPage(1);
      if (refetchReviews) await refetchReviews();
    } catch (err) {
      console.error("Błąd dodawania recenzji:", err);
      alert("Nie udało się dodać recenzji.");
    }
  };

  const handleEditReview = async (reviewId: string) => {
    if (!editContent.trim() || editRating <= 0) {
      alert("Uzupełnij treść i ocenę.");
      return;
    }

    try {
      await putReviewMutation({
        reviewId,
        data: { content: editContent.trim(), score: editRating },
      });
      setEditingReviewId(null);
      setEditContent("");
      setEditRating(0);
      if (refetchReviews) await refetchReviews();
    } catch (err) {
      console.error("❌ Błąd edycji recenzji:", err);
      alert("Nie udało się zaktualizować recenzji.");
    }
  };

  const handleDeleteReview = async (reviewId: string) => {
    if (!window.confirm("Czy na pewno chcesz usunąć tę recenzję?")) return;

    try {
      await deleteReviewMutation({ reviewId });
      if (refetchReviews) await refetchReviews();
    } catch (err) {
      console.error("❌ Błąd usuwania recenzji:", err);
      alert("Nie udało się usunąć recenzji.");
    }
  };

  const formatDate = (d?: string | null) => {
    if (!d) return null;
    const idx = d.indexOf("T");
    return idx !== -1 ? d.slice(0, idx) : d;
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

  const currentUserAuth0Id = user?.sub;

  return (
    <div className="min-h-screen bg-gradient-to-r from-purple-900 via-indigo-900 to-black text-white p-6">
      <div className="max-w-5xl mx-auto">
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
              Data wydania: {formatDate(album.releaseDate) || "Nieznana"}
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
              className={`px-6 py-3 rounded-lg font-medium transition ${
                isInCollection
                  ? "bg-red-600 hover:bg-red-700"
                  : "bg-blue-600 hover:bg-blue-700"
              }`}
            >
              {isInCollection ? "Usuń z kolekcji" : "Dodaj do kolekcji"}
            </button>
          </div>
        </div>

        <div className="bg-black/40 p-6 rounded-2xl border border-white/10">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-semibold">Recenzje użytkowników</h2>

            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="bg-gray-800 text-white p-2 rounded-lg border border-gray-700 text-sm"
            >
              <option value="newest">Najnowsze</option>
              <option value="oldest">Najstarsze</option>
              <option value="score_desc">Najwyższa ocena</option>
              <option value="score_asc">Najniższa ocena</option>
            </select>
          </div>

          {isInCollection && (
            <div className="mb-6">
              <textarea
                value={newReview}
                onChange={(e) => setNewReview(e.target.value)}
                rows={3}
                placeholder="Napisz recenzję..."
                className="w-full p-3 rounded-lg bg-gray-800 text-white border border-gray-700 focus:outline-none"
              />
              <div className="flex items-center mt-3 space-x-2">
                {[...Array(10)].map((_, i) => {
                  const value = i + 1;
                  return (
                    <Star
                      key={value}
                      className={`cursor-pointer w-6 h-6 ${
                        value <= rating
                          ? "text-yellow-400"
                          : "text-gray-600 hover:text-yellow-300"
                      }`}
                      onClick={() => setRating(value)}
                    />
                  );
                })}
                <span className="ml-2 text-sm text-gray-300">
                  {rating > 0 ? `${rating}/10` : "Wybierz ocenę"}
                </span>
              </div>
              <div className="flex mt-3">
                <button
                  onClick={handleSubmitReview}
                  disabled={!newReview.trim() || rating <= 0}
                  className="ml-auto px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg text-white"
                >
                  Dodaj recenzję
                </button>
              </div>
            </div>
          )}

          {reviewsLoading ? (
            <div className="flex items-center">
              <Loader2 className="animate-spin w-5 h-5 mr-2" />
              <span className="text-gray-400">Ładowanie recenzji...</span>
            </div>
          ) : reviewsError ? (
            <p className="text-red-400">Nie udało się pobrać recenzji.</p>
          ) : reviews.length === 0 ? (
            <p className="text-gray-400">Brak recenzji dla tego albumu.</p>
          ) : (
            <>
              <ul className="space-y-4">
                {reviews.map((review: any) => (
                  <li
                    key={review.id}
                    className="p-4 bg-black/50 rounded-xl border border-white/10"
                  >
                    <div className="flex items-center mb-2">
                      <User className="w-4 h-4 mr-2 text-gray-400" />
                      <span className="font-semibold">{review.user}</span>
                      <span className="ml-auto text-yellow-400">
                        {review.score ? `${review.score}/10` : ""}
                      </span>
                    </div>

                    {editingReviewId === review.id ? (
                      <>
                        <textarea
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          className="w-full p-2 rounded bg-gray-800 text-white border border-gray-700 mb-2"
                        />
                        <div className="flex items-center mb-2 space-x-2">
                          {[...Array(10)].map((_, i) => {
                            const value = i + 1;
                            return (
                              <Star
                                key={value}
                                className={`cursor-pointer w-5 h-5 ${
                                  value <= editRating
                                    ? "text-yellow-400"
                                    : "text-gray-600 hover:text-yellow-300"
                                }`}
                                onClick={() => setEditRating(value)}
                              />
                            );
                          })}
                          <span className="ml-2 text-sm text-gray-300">
                            {editRating}/10
                          </span>
                        </div>
                        <div className="flex justify-end space-x-2">
                          <button
                            onClick={() => setEditingReviewId(null)}
                            className="px-3 py-1 bg-gray-700 hover:bg-gray-800 rounded-lg flex items-center"
                          >
                            <X className="w-4 h-4 mr-1" /> Anuluj
                          </button>
                          <button
                            onClick={() => handleEditReview(review.id)}
                            className="px-3 py-1 bg-green-600 hover:bg-green-700 rounded-lg flex items-center"
                          >
                            <Check className="w-4 h-4 mr-1" /> Zapisz
                          </button>
                        </div>
                      </>
                    ) : (
                      <p className="text-gray-300">{review.content}</p>
                    )}

                    {review.auth0Id === currentUserAuth0Id &&
                      editingReviewId !== review.id && (
                        <div className="flex justify-end space-x-3 mt-2">
                          <button
                            onClick={() => {
                              setEditingReviewId(review.id);
                              setEditContent(review.content);
                              setEditRating(review.score);
                            }}
                            className="flex items-center text-sm text-blue-400 hover:text-blue-500"
                          >
                            <Edit2 className="w-4 h-4 mr-1" /> Edytuj
                          </button>
                          <button
                            onClick={() => handleDeleteReview(review.id)}
                            className="flex items-center text-sm text-red-400 hover:text-red-500"
                          >
                            <Trash2 className="w-4 h-4 mr-1" /> Usuń
                          </button>
                        </div>
                      )}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
        {/* 🔹 Sekcja podobnych albumów — RENDEROWANA ZAWSZE */}
        <div className="max-w-5xl mx-auto mt-8">
          <h2 className="text-2xl font-semibold mb-4">Podobne albumy</h2>
          {recList.length === 0 ? (
            <p className="text-gray-400">
              Brak podobnych albumów do wyświetlenia.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {recList.map((rec: any) => (
                <AlbumCard
                  key={rec.id}
                  album={{
                    title: rec.title,
                    artist: rec.artist ?? "Nieznany artysta",
                    coverUrl: rec.coverUrl,
                    releaseDate: rec.releaseDate,
                  }}
                />
              ))}
            </div>
          )}
        </div>

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
              <strong className="text-white">{totalPages}</strong> —{" "}
              {totalCount} recenzji
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
    </div>
  );
};

export default AlbumDetailsPage;

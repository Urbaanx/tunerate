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
import TrackPlayer from "../components/TrackPlayer";
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
import { toast } from "../utils/toast";
import SendAlbumRecommendationModal from "../components/SendAlbumRecommendationModal";

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

  const [authPromptVisible, setAuthPromptVisible] = useState(false);
  const [authPromptMessage, setAuthPromptMessage] = useState("");

  const [showRecommendModal, setShowRecommendModal] = useState(false);

  const formatTrackDuration = (ms: number): string => {
    if (!ms || ms <= 0) return "—";
    const sec = Math.floor(ms / 1000);
    const hrs = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    const secs = sec % 60;
    if (hrs > 0)
      return `${hrs}:${mins.toString().padStart(2, "0")}:${secs
        .toString()
        .padStart(2, "0")}`;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  useEffect(() => {
    if (!isAuthenticated) {
      setToken(null);
      return;
    }
    getAccessTokenSilently()
      .then((t) => setToken(t))
      .catch(() => setToken(null));
  }, [isAuthenticated, getAccessTokenSilently]);

  const albumQueryOptions = token
    ? {
        request: { headers: { Authorization: `Bearer ${token}` } },
        query: { enabled: !!id },
      }
    : { query: { enabled: false } };

  const {
    data: album,
    isLoading: albumLoading,
    isError: albumError,
  } = useGetApiAlbumsId<any, unknown>(id!, albumQueryOptions);

  const { data: userAlbums, refetch: refetchUserAlbums } = useGetApiUserAlbums<
    any,
    unknown
  >({
    query: { enabled: !!token },
  });

  const reviewsQueryOptions = token
    ? {
        request: { headers: { Authorization: `Bearer ${token}` } },
        query: { enabled: !!id, queryKey: ["albumReviews", id, page, sort] },
      }
    : { query: { enabled: false } };

  const {
    data: reviewsResponse,
    isLoading: reviewsLoading,
    isError: reviewsError,
    refetch: refetchReviews,
  } = useGetApiReviewsAlbumId<any, unknown>(
    id!,
    { page, pageSize, sort },
    reviewsQueryOptions
  );

  const { data: recommendations } = useGetApiRecommendationsAlbumAlbumId<
    any,
    unknown
  >(id!, { topN: 5 }, { query: { enabled: !!id } });

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
    } else {
      setIsInCollection(false);
    }
  }, [userAlbums, album]);

  useEffect(() => {
    setPage(1);
  }, [sort]);

  const requireAuth = (message?: string) => {
    setAuthPromptMessage(message ?? "Musisz się zalogować");
    setAuthPromptVisible(true);
  };

  const handleToggleCollection = async () => {
    if (!isAuthenticated) {
      requireAuth("Musisz się zalogować, aby zarządzać kolekcją.");
      return;
    }
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
      toast("Nie udało się zaktualizować kolekcji.", "error");
    }
  };

  const handleSubmitReview = async () => {
    if (!id || !newReview.trim() || rating <= 0) {
      toast("Uzupełnij treść i wybierz ocenę.", "error");
      return;
    }

    if (!isAuthenticated) {
      requireAuth("Musisz się zalogować, aby dodać recenzję.");
      return;
    }

    if (!isInCollection) {
      toast("Dodaj album do kolekcji, aby dodać recenzję.", "info");
      return;
    }

    try {
      await postReviewMutation(
        { albumId: id!, data: { content: newReview.trim(), score: rating } },
        { request: { headers: { Authorization: `Bearer ${token}` } } } as any
      );
      setNewReview("");
      setRating(0);
      if (sort === "newest") setPage(1);
      if (refetchReviews) await refetchReviews();
    } catch (err) {
      console.error("❌ Błąd dodawania recenzji:", err);
      toast("Nie udało się dodać recenzji.", "error");
    }
  };

  const handleEditReview = async (reviewId: string) => {
    if (!editContent.trim() || editRating <= 0) {
      toast("Uzupełnij treść i ocenę.", "error");
      return;
    }
    if (!isAuthenticated) {
      requireAuth("Musisz się zalogować, aby edytować recenzję.");
      return;
    }

    try {
      await putReviewMutation(
        { reviewId, data: { content: editContent.trim(), score: editRating } },
        { request: { headers: { Authorization: `Bearer ${token}` } } } as any
      );
      setEditingReviewId(null);
      setEditContent("");
      setEditRating(0);
      if (refetchReviews) await refetchReviews();
    } catch (err) {
      console.error("❌ Błąd edycji recenzji:", err);
      toast("Nie udało się zaktualizować recenzji.", "error");
    }
  };

  const handleDeleteReview = async (reviewId: string) => {
    if (!window.confirm("Czy na pewno chcesz usunąć recenzję?")) return;
    if (!isAuthenticated) {
      requireAuth("Musisz się zalogować, aby usunąć recenzję.");
      return;
    }

    try {
      await deleteReviewMutation({ reviewId }, {
        request: { headers: { Authorization: `Bearer ${token}` } },
      } as any);
      if (refetchReviews) await refetchReviews();
    } catch (err) {
      console.error("❌ Błąd usuwania recenzji:", err);
      toast("Nie udało się usunąć recenzji.", "error");
    }
  };

  const formatDate = (d?: string | null) => {
    if (!d) return null;
    const idx = d.indexOf("T");
    return idx !== -1 ? d.slice(0, idx) : d;
  };

  if (authLoading || albumLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-r from-purple-900 via-indigo-900 to-black text-white flex items-center justify-center p-6">
        <div className="max-w-3xl w-full bg-black/50 rounded-2xl p-6 border border-white/10 shadow-lg">
          <div className="flex gap-6 items-center">
            <div className="w-48 h-48 bg-gray-800 rounded-2xl animate-pulse" />
            <div className="flex-1">
              <div className="h-8 bg-gray-800 rounded w-3/4 mb-3 animate-pulse" />
              <div className="h-5 bg-gray-800 rounded w-1/2 mb-6 animate-pulse" />

              <div className="flex items-center gap-3 mb-4">
                <Loader2 className="animate-spin w-6 h-6 text-white/80" />
                <span className="text-gray-300">
                  Ładowanie danych albumu...
                </span>
              </div>

              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between bg-black/40 p-3 rounded-lg border border-white/6"
                  >
                    <div className="w-2/3">
                      <div className="h-4 bg-gray-800 rounded mb-2 animate-pulse" />
                      <div className="h-3 bg-gray-800 rounded w-1/2 animate-pulse" />
                    </div>
                    <div className="w-20 h-4 bg-gray-800 rounded animate-pulse" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
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
        {authPromptVisible && (
          <div className="mb-6 p-4 rounded-lg bg-black/60 border border-white/10 flex items-center justify-between">
            <div className="text-left">
              <div className="font-semibold text-lg">{authPromptMessage}</div>
              <div className="text-sm text-gray-300">
                Zaloguj się, aby kontynuować.
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setAuthPromptVisible(false);
                  loginWithRedirect();
                }}
                className="px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-700"
              >
                Zaloguj się
              </button>
              <button
                onClick={() => setAuthPromptVisible(false)}
                className="px-4 py-2 bg-gray-700 rounded-lg hover:bg-gray-800"
              >
                Anuluj
              </button>
            </div>
          </div>
        )}

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

            <div className="flex items-center mb-4 gap-3">
              <div>
                <Star className="text-yellow-400 w-5 h-5 mr-1" />
              </div>
              <span className="text-lg font-semibold">
                {album.averageRating ? album.averageRating.toFixed(1) : "—"} /
                10
              </span>
            </div>

            <div className="flex items-center gap-3">
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

              {/* Poleć znajomemu - dostępne, gdy album jest załadowany */}
              <button
                onClick={() => {
                  if (!isAuthenticated) {
                    setAuthPromptMessage(
                      "Musisz się zalogować, aby polecić album."
                    );
                    setAuthPromptVisible(true);
                    return;
                  }
                  setShowRecommendModal(true);
                }}
                className="px-4 py-3 rounded-lg font-medium bg-green-600 hover:bg-green-700"
              >
                Poleć znajomemu
              </button>
            </div>
          </div>
        </div>

        {/* TRACKLISTA */}
        {album.tracks && album.tracks.length > 0 && (
          <div className="bg-black/40 p-6 rounded-2xl border border-white/10 mt-10">
            <h2 className="text-2xl font-semibold mb-4">Lista utworów</h2>

            <ul className="space-y-3">
              {album.tracks.map((t: any, i: number) => {
                const trackNumber = i + 1;
                return (
                  <li
                    key={i}
                    className="flex items-center justify-between bg-black/50 p-3 rounded-lg border border-white/10"
                  >
                    <div className="flex items-center">
                      <div className="w-8 text-gray-400 font-mono mr-3 text-sm">
                        {trackNumber}.
                      </div>
                      <div>
                        <div className="text-white font-medium">{t.title}</div>
                        <div className="text-gray-400 text-sm">
                          {formatTrackDuration(t.durationMs)}
                        </div>
                      </div>
                    </div>

                    {t.previewUrl ? (
                      <TrackPlayer url={t.previewUrl} />
                    ) : (
                      <span className="text-gray-600 text-sm">
                        Brak podglądu
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>

            <div className="mt-5 text-gray-300 text-sm">
              Łączny czas trwania:{" "}
              <strong className="text-white">
                {formatTrackDuration(album.totalDurationMs ?? 0)}
              </strong>
            </div>
          </div>
        )}

        {/* -------------------------------------------
             RECENZJE 
        ------------------------------------------- */}
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

        {/* ===========================
              PODONE ALBUMY
        =========================== */}
        <div className="max-w-5xl mx-auto mt-8">
          <h2 className="text-2xl font-semibold mb-4">Podobne albumy</h2>
          {recList.length === 0 ? (
            <p className="text-gray-400">Brak podobnych albumów.</p>
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

        {showRecommendModal && (
          <SendAlbumRecommendationModal
            album={album}
            onClose={() => setShowRecommendModal(false)}
          />
        )}
      </div>
    </div>
  );
};

export default AlbumDetailsPage;

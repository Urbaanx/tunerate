import { useEffect, useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import {
  useGetApiSocialFriends,
  usePostApiSocialShareToUserIdAlbumId,
} from "../api/endpoints/tunerateApi";

type AlbumPayload = {
  id?: string | number;
  title?: string | null;
  artist?: any;
  Artist?: any;
  coverUrl?: string | null;
  CoverUrl?: string | null;
  [k: string]: any;
};

type Props = {
  album: AlbumPayload;
  onClose: () => void;
};

export default function SendAlbumRecommendationModal({
  album,
  onClose,
}: Props) {
  const { getAccessTokenSilently, isAuthenticated, loginWithRedirect } =
    useAuth0();
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) return;
    getAccessTokenSilently()
      .then((t) => setToken(t))
      .catch(() => setToken(null));
  }, [isAuthenticated, getAccessTokenSilently]);

  // pobierz listę znajomych — options jako 1-szy argument
  const {
    data: friendsData,
    isLoading: friendsLoading,
    isError: friendsError,
    refetch: refetchFriends,
  } = useGetApiSocialFriends<any, unknown>({
    query: { enabled: !!token },
    request: token
      ? { headers: { Authorization: `Bearer ${token}` } }
      : undefined,
  });

  const recommendMutation = usePostApiSocialShareToUserIdAlbumId<any, unknown>({
    request: token
      ? { headers: { Authorization: `Bearer ${token}` } }
      : undefined,
    mutation: {
      onSuccess: () => {
        refetchFriends();
      },
    },
  });

  const friends = Array.isArray(friendsData) ? friendsData : [];

  const [sendingTo, setSendingTo] = useState<string | number | null>(null);

  const sendTo = async (id: string | number) => {
    if (!album?.id) return;
    if (!isAuthenticated) {
      loginWithRedirect();
      return;
    }
    if (!token) {
      // spróbuj pobrać token jeszcze raz
      try {
        const t = await getAccessTokenSilently();
        setToken(t);
      } catch {
        return;
      }
    }

    try {
      setSendingTo(id);
      await recommendMutation.mutateAsync({
        toUserId: String(id),
        albumId: String(album.id),
      } as any);
      onClose();
    } catch (err) {
      console.error("Recommend error", err);
      alert("Nie udało się polecić albumu.");
      setSendingTo(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50">
      <div className="bg-gray-900 p-6 rounded-lg w-96">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-14 h-14 rounded-md overflow-hidden bg-gray-700 flex-shrink-0">
            {album?.coverUrl || album?.CoverUrl ? (
              <img
                src={(album?.coverUrl ?? album?.CoverUrl) as string | undefined}
                alt={String(album?.title ?? album?.Title ?? "okładka")}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gray-700 flex items-center justify-center text-xs text-gray-300">
                Brak okładki
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm text-gray-300">
              <div className="font-semibold text-white truncate">
                {album?.title ?? album?.Title ?? "Nieznany tytuł"}
              </div>
              <div className="text-xs text-gray-400 truncate">
                {String(album?.artist ?? album?.Artist ?? "")}
              </div>
            </div>
          </div>
        </div>

        {friendsLoading ? (
          <div className="flex items-center gap-2">
            <svg
              className="animate-spin w-5 h-5 text-white"
              viewBox="0 0 24 24"
            />
            <span className="text-gray-300">Ładowanie znajomych...</span>
          </div>
        ) : friendsError ? (
          <div className="text-red-400">
            Błąd podczas pobierania listy znajomych.
          </div>
        ) : friends.length === 0 ? (
          <p className="text-gray-400">Nie masz jeszcze znajomych.</p>
        ) : (
          <div className="space-y-2 max-h-64 overflow-auto">
            {friends.map((f: any) => {
              const id = f.id ?? f.Id ?? f.receiverId ?? f.Receiver?.Id;
              const nickname =
                f.nickname ?? f.Nickname ?? f.Receiver?.Nickname ?? "Nieznany";
              return (
                <button
                  key={String(id)}
                  onClick={() => sendTo(id)}
                  disabled={sendingTo === id}
                  className="w-full bg-gray-800 hover:bg-gray-700 p-3 rounded-lg text-left disabled:opacity-60"
                >
                  {sendingTo === id ? "Wysyłanie..." : nickname}
                </button>
              );
            })}
          </div>
        )}

        <button
          className="mt-4 w-full bg-red-600 p-2 rounded-lg"
          onClick={onClose}
          aria-label="Zamknij modal"
        >
          Zamknij
        </button>
      </div>
    </div>
  );
}

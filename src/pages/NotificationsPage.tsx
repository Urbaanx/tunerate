import { useEffect, useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { Loader2 } from "lucide-react";
import NotificationItem from "../components/NotificationItem";
import AlbumRecommendationNotification from "../components/AlbumRecommendationNotification";
import {
  useGetApiSocialShares,
  usePostApiSocialSharesMarkReadShareId,
  useGetApiSocialRequests,
  usePostApiSocialFriendsAcceptFriendshipId,
  usePostApiSocialFriendsDeclineFriendshipId,
} from "../api/endpoints/tunerateApi";

export default function NotificationsPage() {
  const { getAccessTokenSilently } = useAuth0();
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    getAccessTokenSilently()
      .then((t) => setToken(t))
      .catch(() => setToken(null));
  }, [getAccessTokenSilently]);

  const requestOptions = token
    ? {
        request: { headers: { Authorization: `Bearer ${token}` } },
        query: { enabled: true },
      }
    : { query: { enabled: false } };

  const sharesQuery = useGetApiSocialShares<any, unknown>(requestOptions);
  const requestsQuery = useGetApiSocialRequests<any, unknown>(requestOptions);

  const markReadMutation = usePostApiSocialSharesMarkReadShareId<any, unknown>({
    mutation: {
      onSuccess: () => sharesQuery.refetch(),
    },
  });

  const acceptMutation = usePostApiSocialFriendsAcceptFriendshipId<
    any,
    unknown
  >({
    mutation: {
      onSuccess: () => {
        requestsQuery.refetch();
        sharesQuery.refetch();
      },
    },
  });

  const declineMutation = usePostApiSocialFriendsDeclineFriendshipId<
    any,
    unknown
  >({
    mutation: {
      onSuccess: () => {
        requestsQuery.refetch();
        sharesQuery.refetch();
      },
    },
  });

  const loading = !token || sharesQuery.isLoading || requestsQuery.isLoading;

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen text-white">
        <Loader2 className="animate-spin w-8 h-8 mr-3" />
        <span>Wczytywanie powiadomień...</span>
      </div>
    );
  }

  const shares = sharesQuery.data ?? [];
  const requests = requestsQuery.data ?? [];

  type Notification = {
    type: "share" | "friendRequest";
    id: string;
    createdAt: string;
    payload: any;
  };

  const normalizedShares: Notification[] = (shares as any[]).map((s) => ({
    type: "share",
    id: String(s.id ?? s.Id),
    createdAt: (s.createdAt ??
      s.CreatedAt ??
      new Date().toISOString()) as string,
    payload: s,
  }));

  const normalizedRequests: Notification[] = (requests as any[]).map((r) => ({
    type: "friendRequest",
    id: String(r.id ?? r.Id),
    createdAt: (r.createdAt ??
      r.CreatedAt ??
      new Date().toISOString()) as string,
    payload: r,
  }));

  const notifications = [...normalizedShares, ...normalizedRequests].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  if (notifications.length === 0) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Powiadomienia</h1>
        <p className="text-gray-400">Brak powiadomień.</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Powiadomienia</h1>

      <div className="space-y-3">
        {notifications.map((n) => {
          if (n.type === "share") {
            const s = n.payload;
            const albumPayload = s.album ?? s.Album ?? null;
            const from = {
              nickname:
                s.fromUser?.nickname ??
                s.fromUser?.Nickname ??
                s.From?.nickname ??
                null,
            };
            const isRead = s.isRead ?? s.IsRead ?? false;

            return (
              <div key={`share-${n.id}`} className="flex items-start gap-3">
                <div className="flex-1">
                  <AlbumRecommendationNotification
                    album={albumPayload}
                    from={from}
                  />
                </div>

                {!isRead && (
                  <div className="flex flex-col items-end">
                    <button
                      onClick={() =>
                        markReadMutation.mutate({ shareId: String(n.id) })
                      }
                      className="px-3 py-1 bg-green-600 hover:bg-green-700 rounded ml-2 text-sm"
                      aria-label="Oznacz jako przeczytane"
                    >
                      Oznacz jako przeczytane
                    </button>
                  </div>
                )}
              </div>
            );
          }

          const r = n.payload;
          const requester =
            r.requester ?? r.Requester ?? r.from ?? r.From ?? {};
          const title = "Zaproszenie do znajomych";
          const message = `${
            requester.nickname ?? requester.Nickname ?? "Ktoś"
          } wysłał zaproszenie do znajomych.`;
          const reqId = String(n.id);

          return (
            <div key={`req-${reqId}`} className="flex items-start gap-3">
              <div className="flex-1">
                <NotificationItem notification={{ title, message }} />
              </div>

              <div className="flex flex-col items-end gap-2">
                <div className="flex gap-2">
                  <button
                    onClick={() =>
                      acceptMutation.mutate({ friendshipId: reqId })
                    }
                    className="px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-sm"
                    aria-label="Akceptuj zaproszenie"
                  >
                    Akceptuj
                  </button>

                  <button
                    onClick={() =>
                      declineMutation.mutate({ friendshipId: reqId })
                    }
                    className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-sm"
                    aria-label="Odrzuć zaproszenie"
                  >
                    Odrzuć
                  </button>
                </div>
                <div className="text-gray-400 text-xs mt-1">
                  {new Date(n.createdAt).toLocaleString()}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

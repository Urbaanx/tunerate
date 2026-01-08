import { useEffect, useState } from "react";
import { HubConnectionBuilder, HubConnection } from "@microsoft/signalr";
import { useAuth0 } from "@auth0/auth0-react";
import { useGetApiSocialFriends } from "../api/endpoints/tunerateApi";
import ChatWindow from "../components/ChatWindow";
import FriendListItem from "../components/FriendListItem";
import { Loader2 } from "lucide-react";
import { useParams } from "react-router-dom";
import {
  useGetApiChatUnreadCounts,
  usePostApiChatMarkReadOtherUserId,
} from "../api/endpoints/tunerateApi";

export default function ChatPage() {
  const { id: paramId } = useParams<{ id?: string }>();
  const { isAuthenticated, getAccessTokenSilently, loginWithRedirect } =
    useAuth0();
  const [token, setToken] = useState<string | null>(null);
  const [connection, setConnection] = useState<HubConnection | null>(null);
  const [selectedFriend, setSelectedFriend] = useState<any>(null);
  const unreadCountsQuery = useGetApiChatUnreadCounts<any, unknown>(
    token
      ? {
          request: { headers: { Authorization: `Bearer ${token}` } },
          query: { enabled: true },
        }
      : { query: { enabled: false } }
  );
  const markReadMutation = usePostApiChatMarkReadOtherUserId<any, unknown>({
    request: token
      ? { headers: { Authorization: `Bearer ${token}` } }
      : undefined,
    mutation: {
      onSuccess: () => {
        unreadCountsQuery.refetch();
      },
    },
  });

  useEffect(() => {
    if (!isAuthenticated) return;

    getAccessTokenSilently()
      .then((t) => setToken(t))
      .catch((err) => {
        console.error("Błąd pobierania tokena:", err);
        setToken(null);
      });
  }, [isAuthenticated, getAccessTokenSilently]);

  const friendsQueryOptions = token
    ? {
        request: { headers: { Authorization: `Bearer ${token}` } },
        query: { enabled: true },
      }
    : { query: { enabled: false } };

  const {
    data: friends,
    isLoading,
    isError,
    refetch,
  } = useGetApiSocialFriends<any, unknown>(friendsQueryOptions);

  useEffect(() => {
    if (token) refetch();
  }, [token, refetch]);

  useEffect(() => {
    if (!paramId) return;
    if (selectedFriend && String(selectedFriend.id) === String(paramId)) return;
    if (Array.isArray(friends) && friends.length > 0) {
      const match = friends.find((f: any) => String(f.id) === String(paramId));
      if (match) {
        setSelectedFriend(match);
        return;
      }
    }

    setSelectedFriend({ id: paramId });
  }, [paramId, friends, selectedFriend]);


  useEffect(() => {
    if (!selectedFriend?.id) return;

    markReadMutation.mutate({ otherUserId: String(selectedFriend.id) });
  }, [selectedFriend?.id]);


  useEffect(() => {
    if (!token) return;

    const apiUrl =
      import.meta.env.VITE_AXIOS_BASE_URL_API ?? "http://localhost:5000";
    const hub = new HubConnectionBuilder()
      .withUrl(`${apiUrl}/hubs/social`, {
        accessTokenFactory: () => token,
      })
      .withAutomaticReconnect()
      .build();

    hub
      .start()
      .then(async () => {
        try {
          await hub.invoke("RegisterConnection");
          console.debug("SignalR: registered connection with hub");
        } catch (err) {
          console.warn("SignalR: RegisterConnection failed", err);
        }
        setConnection(hub);
      })
      .catch((err) => {
        console.error("SignalR start error:", err);
        setConnection(null);
      });

    return () => {
      hub.stop().catch(() => {});
      setConnection(null);
    };
  }, [token]);

  useEffect(() => {
    if (!connection) return;

    const handler = (payload: any) => {
      console.debug("FriendPresenceChanged", payload);
      refetch();

      try {
        const userId = payload?.UserId ?? payload?.userId;
        const isOnline = payload?.IsOnline ?? payload?.isOnline;
        if (selectedFriend && String(selectedFriend.id) === String(userId)) {
          setSelectedFriend((s: any) => ({
            ...s,
            status: isOnline ? "Online" : "Offline",
          }));
        }
      } catch {}
    };

    connection.on("FriendPresenceChanged", handler);

    return () => {
      connection.off("FriendPresenceChanged", handler);
    };
  }, [connection, refetch, selectedFriend]);

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

  if (isLoading || !friends) {
    return (
      <div className="flex justify-center items-center h-screen text-white">
        <Loader2 className="animate-spin w-8 h-8 mr-3" />
        <span>Ładowanie znajomych...</span>
      </div>
    );
  }

  if (isError) {
    return (
      <p className="text-center text-red-400 mt-8">
        Nie udało się pobrać listy znajomych.
      </p>
    );
  }

  return (
    <div className="p-6 flex gap-6">
      {/* Lista znajomych */}
      <aside className="w-72 bg-gray-900 rounded-xl p-4 h-[80vh] overflow-auto border border-gray-700">
        <h2 className="text-xl font-bold mb-4">Znajomi</h2>

        {friends.length === 0 && (
          <p className="text-gray-400">Nie masz jeszcze znajomych.</p>
        )}

        {friends.map((f: any) => {
          const per = unreadCountsQuery.data?.perUser ?? [];
          const find = Array.isArray(per)
            ? per.find(
                (p: any) =>
                  String(p.fromUserId ?? p.FromUserId) === String(f.id)
              )
            : null;
          const unreadCount = find ? find.count ?? find.Count ?? 0 : 0;
          return (
            <div
              key={f.id}
              onClick={() => setSelectedFriend(f)}
              className="cursor-pointer"
            >
              <FriendListItem friend={f} unreadCount={unreadCount} />
            </div>
          );
        })}
      </aside>

      {/* Czat */}
      <main className="flex-1 bg-gray-900 rounded-xl border border-gray-700 p-4">
        {selectedFriend ? (
          <ChatWindow
            friend={selectedFriend}
            connection={connection}
            markRead={(otherUserId: string) =>
              markReadMutation.mutate({ otherUserId: String(otherUserId) })
            }
          />
        ) : (
          <p className="text-gray-400">
            Wybierz znajomego, aby rozpocząć rozmowę.
          </p>
        )}
      </main>
    </div>
  );
}

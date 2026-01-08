import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth0 } from "@auth0/auth0-react";
import { Loader2 } from "lucide-react";
import FriendListItem from "../components/FriendListItem";
import {
  useGetApiSocialFriends,
  useDeleteApiSocialFriendsFriendId,
} from "../api/endpoints/tunerateApi";

export default function FriendsPage() {
  const { isAuthenticated, getAccessTokenSilently, loginWithRedirect } =
    useAuth0();
  const [token, setToken] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!isAuthenticated) return;
    getAccessTokenSilently()
      .then((t) => setToken(t))
      .catch(() => setToken(null));
  }, [isAuthenticated, getAccessTokenSilently]);

  const requestOptions = token
    ? {
        request: { headers: { Authorization: `Bearer ${token}` } },
        query: { enabled: true },
      }
    : { query: { enabled: false } };

  const {
    data: friendsData,
    isLoading,
    isError,
    refetch,
  } = useGetApiSocialFriends<any, unknown>(requestOptions);

  const deleteFriendMutation = useDeleteApiSocialFriendsFriendId<any, unknown>({
    request: token
      ? { headers: { Authorization: `Bearer ${token}` } }
      : undefined,
    mutation: {
      onSuccess: () => {
        refetch();
      },
    },
  });

  useEffect(() => {
    if (token) refetch();
  }, [token, refetch]);

  const removeFriend = async (id?: string | number) => {
    if (!id || !token) return;
    const ok = window.confirm("Czy na pewno chcesz usunąć tego znajomego?");
    if (!ok) return;

    try {
      await deleteFriendMutation.mutateAsync({ friendId: String(id) });
    } catch (err) {
      console.error("Remove friend error", err);
      alert("Nie udało się usunąć znajomego.");
    }
  };

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

  if (isLoading || !friendsData) {
    return (
      <div className="flex justify-center items-center h-screen text-white">
        <Loader2 className="animate-spin w-8 h-8 mr-3" />
        <span>Wczytywanie...</span>
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

  const friends = Array.isArray(friendsData)
    ? friendsData
    : friendsData?.items ?? [];

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="bg-gradient-to-b from-gray-900 to-black p-6 rounded-2xl border border-gray-800">
        <header className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-white">Twoi znajomi</h1>
            <p className="text-sm text-gray-400 mt-1">
              Masz {friends.length}{" "}
              {friends.length === 1 ? "znajomego" : "znajomych"}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              to="/friend-requests"
              className="text-sm px-3 py-2 bg-white/6 hover:bg-white/8 rounded text-blue-300"
            >
              Zaproszenia
            </Link>
            <Link
              to="/friends/search"
              className="text-sm px-3 py-2 bg-gradient-to-r from-blue-600 to-purple-600 rounded text-white"
            >
              Dodaj znajomego
            </Link>
          </div>
        </header>

        <main>
          {friends.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              Nie masz jeszcze żadnych znajomych.
            </div>
          ) : (
            <ul className="space-y-4">
              {friends.map((f: any) => {
                const id = f.id ?? f.Id;
                const nickname = f.nickname ?? f.Nickname ?? "Nieznany";
                const status = f.status ?? f.Status ?? undefined;

                return (
                  <li key={id}>
                    <FriendListItem
                      friend={{ id, nickname, status }}
                      onClick={() => navigate(`/friend/${id}`)}
                      onChat={() => navigate(`/chat/${id}`)}
                      onRemove={() => removeFriend(id)}
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </main>
      </div>
    </div>
  );
}

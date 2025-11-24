import React, { useEffect, useMemo, useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  useGetApiSocialSearch,
  usePostApiSocialFriendsRequestToUserId,
  useGetApiSocialRequestsOutgoing,
  useDeleteApiSocialRequestsFriendshipId,
} from "../api/endpoints/tunerateApi";

export default function FriendsSearchPage() {
  const { getAccessTokenSilently, isAuthenticated, loginWithRedirect } =
    useAuth0();
  const [token, setToken] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [sendingTo, setSendingTo] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!isAuthenticated) return;
    getAccessTokenSilently()
      .then((t) => setToken(t))
      .catch(() => setToken(null));
  }, [isAuthenticated, getAccessTokenSilently]);

  // Orval search (disabled by default) — will be refetched on doSearch
  const searchQuery = useGetApiSocialSearch<any, unknown>(
    { query: query.trim(), limit: 40 },
    {
      query: { enabled: false },
      request: token
        ? { headers: { Authorization: `Bearer ${token}` } }
        : undefined,
    }
  );

  // outgoing requests (to know which users already received an invitation)
  const outgoingQuery = useGetApiSocialRequestsOutgoing<any, unknown>();

  // map: receiverId -> friendshipId (server returns Receiver)
  const outgoingMap = useMemo(() => {
    const map = new Map<string, string>();
    const list = outgoingQuery.data ?? [];
    if (Array.isArray(list)) {
      list.forEach((it: any) => {
        const fid = it.id ?? it.Id;
        const receiver = it.receiver ?? it.Receiver ?? {};
        const receiverId = receiver?.id ?? receiver?.Id;
        if (receiverId && fid) map.set(String(receiverId), String(fid));
      });
    }
    return map;
  }, [outgoingQuery.data]);

  const sendRequestMutation = usePostApiSocialFriendsRequestToUserId<
    any,
    unknown
  >({
    mutation: {
      onSuccess: () => {
        searchQuery.refetch();
        outgoingQuery.refetch();
      },
    },
  });

  // DELETE mutation (withdraw outgoing request) -- wykorzystuje hook wygenerowany przez Orval
  const withdrawMutation = useDeleteApiSocialRequestsFriendshipId<any, unknown>(
    {
      request: token
        ? { headers: { Authorization: `Bearer ${token}` } }
        : undefined,
      mutation: {
        onSuccess: () => {
          searchQuery.refetch();
          outgoingQuery.refetch();
        },
      },
    }
  );

  const doSearch = async () => {
    if (!token || !query.trim()) return;
    try {
      await searchQuery.refetch();
      outgoingQuery.refetch();
    } catch (err) {
      console.error("Search error", err);
    }
  };

  const sendRequest = async (id: string) => {
    if (!token) return;
    setSendingTo(id);
    try {
      await sendRequestMutation.mutateAsync({ toUserId: id });
    } catch (err) {
      console.error("Send friend request error", err);
      alert("Błąd przy wysyłaniu zaproszenia.");
    } finally {
      setSendingTo(null);
    }
  };

  const withdrawRequest = async (userId: string) => {
    const friendshipId = outgoingMap.get(String(userId));
    if (!friendshipId) return;
    const ok = window.confirm("Czy chcesz wycofać wysłane zaproszenie?");
    if (!ok) return;
    try {
      await withdrawMutation.mutateAsync({ friendshipId });
    } catch (err) {
      console.error("Withdraw request error", err);
      alert("Nie udało się wycofać zaproszenia.");
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center h-screen text-white">
        <h1 className="text-2xl mb-4">
          Zaloguj się, aby wyszukiwać użytkowników
        </h1>
        <button
          onClick={() => loginWithRedirect()}
          className="px-4 py-2 bg-blue-600 rounded"
        >
          Zaloguj
        </button>
      </div>
    );
  }

  const loading = searchQuery.isFetching;
  const results = Array.isArray(searchQuery.data) ? searchQuery.data : [];

  return (
    <div className="p-6 max-w-3xl mx-auto text-white">
      <h1 className="text-3xl font-bold mb-4">Szukaj użytkowników</h1>

      <div className="flex gap-2 mb-4">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") doSearch();
          }}
          className="flex-1 p-2 rounded bg-gray-800 border border-gray-700"
          placeholder="Wpisz nick użytkownika..."
        />
        <button
          onClick={doSearch}
          className="px-4 py-2 bg-blue-600 rounded disabled:opacity-60"
          disabled={!token || !query.trim() || loading}
        >
          Szukaj
        </button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2">
          <Loader2 className="animate-spin" /> Wyszukiwanie...
        </div>
      ) : (
        <div className="space-y-3">
          {results.length === 0 ? (
            <p className="text-gray-400">Brak wyników.</p>
          ) : (
            results.map((u: any) => {
              const uid = u.id ?? u.Id;
              const alreadyRequested = uid
                ? outgoingMap.has(String(uid))
                : false;
              return (
                <div
                  key={uid}
                  className="bg-gray-900 p-3 rounded flex items-center justify-between border border-gray-700"
                >
                  <div>
                    <p className="font-semibold">{u.nickname ?? u.Nickname}</p>
                    <p className="text-sm text-gray-400">{uid}</p>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => navigate(`/friend/${uid}`)}
                      className="px-3 py-1 bg-gray-700 rounded"
                    >
                      Profil
                    </button>

                    {!alreadyRequested ? (
                      <button
                        onClick={() => sendRequest(String(uid))}
                        disabled={sendingTo === String(uid)}
                        className="px-3 py-1 bg-green-600 rounded disabled:opacity-60"
                      >
                        {sendingTo === String(uid)
                          ? "Wysyłanie..."
                          : "Wyślij zaproszenie"}
                      </button>
                    ) : (
                      <div className="flex gap-2 items-center">
                        <button
                          className="px-3 py-1 bg-gray-600 rounded text-sm cursor-default"
                          disabled
                        >
                          Wysłane
                        </button>
                        <button
                          onClick={() => withdrawRequest(String(uid))}
                          className="px-3 py-1 bg-red-600 rounded"
                        >
                          Wycofaj
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

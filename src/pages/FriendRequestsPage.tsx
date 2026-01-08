import { useEffect, useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import {
  useGetApiSocialRequests,
  useGetApiSocialRequestsOutgoing,
  usePostApiSocialFriendsAcceptFriendshipId,
  usePostApiSocialFriendsDeclineFriendshipId,
} from "../api/endpoints/tunerateApi";
import { Loader2 } from "lucide-react";

export default function FriendRequestsPage() {
  const { getAccessTokenSilently } = useAuth0();

  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    getAccessTokenSilently()
      .then((t) => setToken(t))
      .catch(() => setToken(null));
  }, [getAccessTokenSilently]);

  const commonRequestOptions = {
    query: { enabled: !!token },
    request: token
      ? { headers: { Authorization: `Bearer ${token}` } }
      : undefined,
  };

  const incomingQuery = useGetApiSocialRequests<any, unknown>(
    commonRequestOptions
  );

  const outgoingQuery = useGetApiSocialRequestsOutgoing<any, unknown>(
    commonRequestOptions
  );

  const acceptMutation = usePostApiSocialFriendsAcceptFriendshipId<
    any,
    unknown
  >({
    mutation: {
      onSuccess: () => {
        incomingQuery.refetch();
        outgoingQuery.refetch();
      },
    },
  });

  const rejectMutation = usePostApiSocialFriendsDeclineFriendshipId<
    any,
    unknown
  >({
    mutation: {
      onSuccess: () => {
        incomingQuery.refetch();
        outgoingQuery.refetch();
      },
    },
  });

  const acceptRequest = (id: string) => {
    if (!token) return;
    acceptMutation.mutate({ friendshipId: id });
  };

  const rejectRequest = (id: string) => {
    if (!token) return;
    rejectMutation.mutate({ friendshipId: id });
  };

  const loading = !token || incomingQuery.isLoading || outgoingQuery.isLoading;

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen text-white">
        <Loader2 className="animate-spin w-8 h-8 mr-3" />
        <span>Wczytywanie...</span>
      </div>
    );
  }

  const incoming = incomingQuery.data ?? [];
  const outgoing = outgoingQuery.data ?? [];

  return (
    <div className="w-full flex justify-center p-6 text-white">
      <div className="max-w-3xl w-full">
        <h1 className="text-3xl font-bold mb-6">Zaproszenia do znajomych</h1>

        {/* INCOMING REQUESTS */}
        <section className="mb-10">
          <h2 className="text-2xl font-semibold mb-4">Otrzymane</h2>

          {incoming.length === 0 ? (
            <p className="text-gray-400">Brak otrzymanych zaproszeń.</p>
          ) : (
            <div className="space-y-4">
              {incoming.map((req: any) => {
                const requester = req.requester ?? req.Requester ?? {};
                const reqId = req.id ?? req.Id;
                return (
                  <div
                    key={reqId}
                    className="bg-gray-800 p-4 rounded-xl shadow flex justify-between items-center"
                  >
                    <div>
                      <p className="text-lg font-medium">
                        {requester.nickname ?? requester.Nickname}
                      </p>
                      <p className="text-sm text-gray-400">
                        {requester.id ?? requester.Id}
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => acceptRequest(String(reqId))}
                        className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded"
                      >
                        Akceptuj
                      </button>

                      <button
                        onClick={() => rejectRequest(String(reqId))}
                        className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded"
                      >
                        Odrzuć
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* OUTGOING REQUESTS */}
        <section>
          <h2 className="text-2xl font-semibold mb-4">Wysłane</h2>

          {outgoing.length === 0 ? (
            <p className="text-gray-400">Brak wysłanych zaproszeń.</p>
          ) : (
            <div className="space-y-4">
              {outgoing.map((req: any) => {
                const receiver =
                  req.receiver ??
                  req.Receiver ??
                  req.addressee ??
                  req.Addressee ??
                  {};
                const reqId = req.id ?? req.Id;
                return (
                  <div
                    key={reqId}
                    className="bg-gray-800 p-4 rounded-xl shadow flex justify-between items-center"
                  >
                    <div>
                      <p className="text-lg font-medium">
                        {receiver.nickname ?? receiver.Nickname}
                      </p>
                      <p className="text-sm text-gray-400">
                        {receiver.id ?? receiver.Id}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

import { useEffect, useState, useRef } from "react";
import MessageBubble from "./MessageBubble";
import {
  useGetApiChatHistoryOtherUserId,
  usePostApiChatSendToUserId,
} from "../api/endpoints/tunerateApi";

type ChatWindowProps = {
  friend?: { id?: string | number } | null;
  connection?: any;
  markRead?: (otherUserId: string) => void;
};

export default function ChatWindow({
  friend,
  connection,
  markRead,
}: ChatWindowProps) {
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Orval query - fetch chat history for selected friend
  const {
    data: historyData,
    refetch: refetchHistory,
    isFetching: historyLoading,
  } = useGetApiChatHistoryOtherUserId(
    friend?.id != null ? String(friend.id) : "",
    undefined,
    {
      query: { enabled: !!friend?.id },
    }
  );

  // Orval mutation - send message
  const sendMutation = usePostApiChatSendToUserId();

  // Sync historyData to local messages (normalize shape)
  useEffect(() => {
    if (!historyData) {
      setMessages([]);
      return;
    }

    const normalized = (historyData as any[]).map((m) => ({
      id: m.id ?? m.Id,
      fromUserId: m.fromUserId ?? m.FromUserId,
      toUserId: m.toUserId ?? m.ToUserId,
      content: m.content ?? m.Content,
      sentAt: m.sentAt ?? m.SentAt,
      mine: (m.fromUserId ?? m.FromUserId) !== friend?.id,
    }));

    setMessages(normalized);
  }, [historyData, friend?.id]);

  // Receive messages from SignalR (server sends "ChatMessageReceived")
  useEffect(() => {
    if (!connection || !friend?.id) return;

    const handler = (payload: any) => {
      // eslint-disable-next-line no-console
      console.debug(
        "ChatMessageReceived payload:",
        payload,
        "friendId:",
        friend.id
      );

      const id = payload?.Id ?? payload?.id;
      const content =
        payload?.Content ??
        payload?.content ??
        payload?.message ??
        payload?.Message;

      const fromUserId =
        payload?.fromUser?.id ??
        payload?.fromUser?.Id ??
        payload?.FromUser?.id ??
        payload?.FromUser?.Id ??
        payload?.fromUserId ??
        payload?.FromUserId ??
        null;

      const toUserId =
        payload?.toUserId ??
        payload?.ToUserId ??
        payload?.toUser?.id ??
        payload?.toUser?.Id ??
        payload?.ToUser?.id ??
        payload?.ToUser?.Id ??
        null;

      const fromIdStr = fromUserId != null ? String(fromUserId) : null;
      const toIdStr = toUserId != null ? String(toUserId) : null;
      const friendIdStr = friend?.id != null ? String(friend.id) : null;

      if (
        friendIdStr &&
        (fromIdStr === friendIdStr || toIdStr === friendIdStr)
      ) {
        setMessages((prev) => [
          ...prev,
          {
            id,
            fromUserId,
            toUserId,
            content,
            sentAt:
              payload?.SentAt ?? payload?.sentAt ?? new Date().toISOString(),
            mine:
              fromUserId != null
                ? String(fromUserId) !== String(friend.id)
                : false,
          },
        ]);

        // jeśli wiadomość pochodzi od aktualnie otwartego znajomego — oznacz jako odczytaną
        if (fromIdStr === friendIdStr && typeof markRead === "function") {
          try {
            markRead(String(friend.id));
          } catch (e) {
            // eslint-disable-next-line no-console
            console.warn("markRead failed", e);
          }
        }
      }
    };

    connection.on("ChatMessageReceived", handler);
    return () => connection.off("ChatMessageReceived", handler);
  }, [connection, friend, markRead]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    if (!input.trim() || !friend?.id) return;

    try {
      // use Orval mutation: { toUserId, data: { content } }
      await sendMutation.mutateAsync({
        toUserId: String(friend.id),
        data: { content: input },
      });

      // optimistic UI update
      setMessages((prev) => [
        ...prev,
        {
          id: `tmp-${Date.now()}`,
          fromUserId: "me",
          toUserId: friend.id,
          content: input,
          sentAt: new Date().toISOString(),
          mine: true,
        },
      ]);

      setInput("");
      // optionally refetch history to get persisted data / IDs
      refetchHistory();
    } catch (err) {
      console.error("Send message error", err);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-auto space-y-2 p-2">
        {messages.map((m, i) => (
          <MessageBubble
            key={m.id ?? i}
            message={{ content: m.content, mine: !!m.mine }}
          />
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="flex p-2 border-t border-gray-600">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          className="flex-1 bg-gray-800 rounded-lg p-2"
          placeholder="Napisz wiadomość…"
        />
        <button
          onClick={send}
          className="ml-2 px-4 py-2 bg-blue-600 rounded-lg"
        >
          Wyślij
        </button>
      </div>
    </div>
  );
}

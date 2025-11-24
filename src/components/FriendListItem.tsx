import React from "react";

type Friend = {
  id?: string | number;
  nickname: string;
  status?: string;
};

type Props = {
  friend: Friend;
  onClick?: (id?: string | number) => void;
  onChat?: (id?: string | number) => void;
  onRemove?: (id?: string | number) => void;
  unreadCount?: number;
};

export default function FriendListItem({
  friend,
  onClick,
  onChat,
  onRemove,
  unreadCount,
}: Props) {
  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      onClick?.(friend.id);
    }
  };

  return (
    <div
      className="p-3 bg-gray-800 rounded-lg flex items-center gap-3 hover:bg-gray-700 transition cursor-pointer"
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : -1}
      onClick={() => onClick?.(friend.id)}
      onKeyDown={handleKey}
    >
      <div className="w-10 h-10 rounded-full bg-gray-600" />
      <div className="flex-1 min-w-0">
        <p className="font-semibold truncate">{friend.nickname}</p>
        <p className="text-sm text-gray-400">{friend.status ?? "Offline"}</p>
      </div>

      <div className="flex items-center gap-2">
        {typeof unreadCount === "number" && unreadCount > 0 && (
          <div className="inline-flex items-center justify-center px-2 py-0.5 text-xs font-semibold text-white bg-red-600 rounded-full">
            {unreadCount}
          </div>
        )}
        {onChat && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onChat(friend.id);
            }}
            className="px-3 py-1 bg-blue-600 rounded text-sm hover:bg-blue-500"
            aria-label="Chat"
          >
            Chat
          </button>
        )}

        {onRemove && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemove(friend.id);
            }}
            className="px-3 py-1 bg-red-600 rounded text-sm hover:bg-red-500"
            aria-label="Usuń znajomego"
          >
            Usuń
          </button>
        )}
      </div>
    </div>
  );
}

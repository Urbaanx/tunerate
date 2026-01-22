import React from "react";
import { Link } from "react-router-dom";

interface Notification {
  title?: string | null;
  message?: string | null;
  albumId?: string | number | null;
}

type Props = {
  notification: Notification;
};

const NotificationItem = React.memo(function NotificationItem({
  notification,
}: Props) {
  const title = notification?.title ?? "Powiadomienie";
  const message = notification?.message ?? "";
  const albumId = notification?.albumId ?? null;

  return (
    <div
      className="bg-gray-800 border border-gray-700 rounded-lg p-4"
      role="article"
      aria-label={title}
    >
      <p className="font-semibold mb-1">{title}</p>
      <p className="text-gray-300 mb-3">{message}</p>

      {albumId != null && (
        <Link
          to={`/album/${String(albumId)}`}
          className="text-blue-400 hover:underline"
        >
          Zobacz album
        </Link>
      )}
    </div>
  );
});

export default NotificationItem;

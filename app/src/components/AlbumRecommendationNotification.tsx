import { Link } from "react-router-dom";

type AlbumShape = {
  id?: string | number | null;
  title?: string | null;
  coverUrl?: string | null;
  artist?: any;
  Artist?: any;
  artistName?: any;
  artists?: any;
  name?: any;
  Name?: any;
  [k: string]: any;
};

type Props = {
  album?: AlbumShape;
  from?: {
    nickname?: string | null;
  };
};

export default function AlbumRecommendationNotification({
  album,
  from,
}: Props) {
  const title = album?.title ?? album?.Title ?? album?.name ?? "Nieznany tytuł";
  const artist = album?.name ?? "Nieznany artysta";
  const cover = album?.coverUrl ?? album?.CoverUrl ?? "";
  const albumId = album?.id ?? album?.Id ?? null;
  const fromName = from?.nickname ?? "Ktoś";

  const artistAndTitle = `${artist} — ${title}`;

  return (
    <div className="flex gap-4 bg-gray-800 border border-gray-700 rounded-lg p-3 items-center">
      <div className="w-16 h-16 flex-shrink-0 rounded-md overflow-hidden bg-gray-700">
        {cover ? (
          <img
            src={cover}
            alt={artistAndTitle}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-gray-700 to-gray-600 flex items-center justify-center text-xs text-gray-300">
            Brak okładki
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="text-sm text-gray-300 mb-1">
          <span className="truncate">
            <span className="font-semibold text-white">{fromName}</span> polecił
            Ci album{" "}
            <span className="font-semibold text-white">{artistAndTitle}</span>
          </span>
        </div>

        {albumId != null && (
          <Link
            to={`/album/${String(albumId)}`}
            className="inline-block text-sm text-blue-400 hover:underline mt-1"
          >
            Zobacz album
          </Link>
        )}
      </div>
    </div>
  );
}

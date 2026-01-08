import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth0 } from "@auth0/auth0-react";
import { usePostApiAlbums } from "../api/endpoints/tunerateApi";

interface Album {
  id?: string;
  title: string;
  artist: string;
  artistId?: string;
  releaseDate?: string;
  externalId?: string;
  coverUrl?: string;
}

interface AlbumCardProps {
  album: Album;
  onAddToCollection?: (album: Album) => void;
  clickable?: boolean;
}

const formatDate = (dateStr?: string): string | null => {
  if (!dateStr) return null;
  const dateOnly = dateStr.split("T")[0];
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) return dateOnly;
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }
  return dateOnly || null;
};

const AlbumCard: React.FC<AlbumCardProps> = ({
  album,
  onAddToCollection,
  clickable = true,
}) => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth0();

  const createAlbumMutation = usePostApiAlbums();

  const handleCardClick = async () => {
    try {
      if (album.id) {
        navigate(`/album/${album.id}`);
        return;
      }

      if (!isAuthenticated) {
        const previewId = album.externalId ?? encodeURIComponent(album.title);
        navigate(`/album/${previewId}`);
        return;
      }

      const response = (await createAlbumMutation.mutateAsync({
        data: {
          title: album.title,
          artist: album.artist,
          artistId: album.artistId,
          externalId: album.externalId,
          coverUrl: album.coverUrl,
          releaseDate: album.releaseDate,
        },
      })) as any;

      const newAlbumId = response?.data?.id ?? response?.id;
      if (newAlbumId) {
        navigate(`/album/${newAlbumId}`);
      } else {
        console.warn(
          "Created album id not found in mutation response:",
          response
        );
        alert("Utworzono album, ale nie można było otworzyć strony albumu.");
      }
    } catch (err) {
      console.error("Błąd podczas otwierania szczegółów albumu:", err);
      alert("Nie udało się otworzyć strony albumu.");
    }
  };

  const handleAddClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onAddToCollection) return;
    try {
      await onAddToCollection(album);
    } catch (err) {
      console.error("Add to collection failed:", err);
      alert("Wystąpił błąd przy dodawaniu albumu.");
    }
  };

  const formattedDate = formatDate(album.releaseDate);
  const clickableClass = clickable
    ? "hover:scale-105 transform transition duration-300 cursor-pointer"
    : "cursor-default";

  return (
    <div
      onClick={clickable ? handleCardClick : undefined}
      className={`bg-gray-900 bg-opacity-70 rounded-2xl shadow-lg overflow-hidden ${clickableClass} flex flex-col`}
    >
      <div className="relative">
        {album.coverUrl ? (
          <img
            src={album.coverUrl}
            alt={album.title}
            className="w-full h-60 object-cover"
          />
        ) : (
          <div className="w-full h-60 flex items-center justify-center bg-gray-800 text-gray-500">
            Brak okładki
          </div>
        )}
      </div>

      <div className="p-4 flex flex-col flex-grow justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">{album.title}</h3>
          <p className="text-sm text-gray-400">{album.artist}</p>
          {formattedDate && (
            <p className="text-xs text-gray-500 mt-1">
              Data wydania: {formattedDate}
            </p>
          )}
        </div>

        {onAddToCollection && (
          <button
            onClick={handleAddClick}
            className="mt-4 w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white font-medium py-2 rounded-lg hover:opacity-90 transition"
          >
            ➕ Dodaj do kolekcji
          </button>
        )}
      </div>
    </div>
  );
};

export default AlbumCard;

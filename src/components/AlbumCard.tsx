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
}

const AlbumCard: React.FC<AlbumCardProps> = ({ album, onAddToCollection }) => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth0(); // don't redirect here

  const createAlbumMutation = usePostApiAlbums();

  const handleCardClick = async () => {
    try {
      // jeśli mamy db id -> idziemy prosto
      if (album.id) {
        navigate(`/album/${album.id}`);
        return;
      }

      // anonimowy użytkownik: podgląd — nie wywołujemy chronionego endpointu
      if (!isAuthenticated) {
        const previewId = album.externalId ?? encodeURIComponent(album.title);
        navigate(`/album/${previewId}`);
        return;
      }

      // zalogowany użytkownik: wywołaj chroniony endpoint, utwórz w DB i przejdź
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
      console.error("❌ Błąd podczas otwierania szczegółów albumu:", err);
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

  return (
    <div
      onClick={handleCardClick}
      className="bg-gray-900 bg-opacity-70 rounded-2xl shadow-lg overflow-hidden hover:scale-105 transform transition duration-300 flex flex-col cursor-pointer"
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
          {album.releaseDate && (
            <p className="text-xs text-gray-500 mt-1">
              Data wydania: {album.releaseDate}
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

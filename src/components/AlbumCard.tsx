import React from "react";
import { useNavigate } from "react-router-dom";

interface Album {
  id: string;
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

  const handleCardClick = () => {
    navigate(`/album/${album.id}`);
  };

  return (
    <div
      onClick={handleCardClick}
      className="w-56 md:w-64 bg-gray-900 bg-opacity-70 rounded-xl shadow-lg overflow-hidden hover:scale-105 transform transition duration-300 flex flex-col cursor-pointer"
    >
      {/* Okładka */}
      <div className="relative w-full aspect-square bg-gray-800">
        {album.coverUrl ? (
          <img
            src={album.coverUrl}
            alt={album.title}
            className="absolute inset-0 w-full h-full object-cover object-center"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-gray-500">
            Brak okładki
          </div>
        )}
      </div>

      {/* Opis */}
      <div className="p-4 flex flex-col flex-grow justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">{album.title}</h3>
          <p className="text-sm text-gray-300">{album.artist}</p>
          {album.releaseDate && (
            <p className="text-xs text-gray-400 mt-1">
              Data wydania: {album.releaseDate}
            </p>
          )}
        </div>

        {onAddToCollection && (
          <button
            onClick={handleAddClick}
            className="mt-3 w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white text-sm font-medium py-2 rounded-md hover:opacity-90 transition"
          >
            ➕ Dodaj do kolekcji
          </button>
        )}
      </div>
    </div>
  );
};

export default AlbumCard;

import React from "react";

interface Album {
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
  const handleAddClick = async () => {
    if (!onAddToCollection) return;
    try {
      await onAddToCollection(album);
    } catch (err) {
      console.error("Add to collection failed:", err);
      alert("Wystąpił błąd przy dodawaniu albumu.");
    }
  };

  return (
    <div className="bg-gray-900 bg-opacity-70 rounded-2xl shadow-lg overflow-hidden hover:scale-105 transform transition duration-300 flex flex-col">
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

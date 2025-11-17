import React, { useState, useRef, useEffect } from "react";

interface Props {
  url: string;
}

const TrackPlayer: React.FC<Props> = ({ url }) => {
  const [playing, setPlaying] = useState(false);
  const volume = 0.3; // domyślna głośność 30%
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume, url]);

  const togglePlay = () => {
    if (!audioRef.current) return;

    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
    } else {
      audioRef.current.volume = volume;
      audioRef.current.play();
      setPlaying(true);

      audioRef.current.onended = () => setPlaying(false);
    }
  };

  return (
    <div className="flex items-center space-x-3">
      <button
        onClick={togglePlay}
        className="px-3 py-1 text-sm bg-blue-700 rounded-lg hover:bg-blue-800"
      >
        {playing ? "⏸️ Pauza" : "▶️ Odtwórz"}
      </button>

      <audio ref={audioRef} src={url} />
    </div>
  );
};

export default TrackPlayer;

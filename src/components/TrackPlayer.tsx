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

  useEffect(() => {
    const onExternalPlay = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      const source: HTMLAudioElement | undefined = detail?.source;
      if (audioRef.current && source && source !== audioRef.current) {
        audioRef.current.pause();
        setPlaying(false);
      }
    };

    window.addEventListener(
      "tunerate:trackplay",
      onExternalPlay as EventListener
    );
    return () => {
      window.removeEventListener(
        "tunerate:trackplay",
        onExternalPlay as EventListener
      );
    };
  }, []);

  const togglePlay = () => {
    if (!audioRef.current) return;

    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
    } else {
      audioRef.current.volume = volume;
      audioRef.current.play().catch(() => {
        // ignore playback errors (autoplay policies etc.)
      });
      setPlaying(true);

      // Powiadom pozostałe odtwarzacze, żeby się zatrzymały
      window.dispatchEvent(
        new CustomEvent("tunerate:trackplay", {
          detail: { source: audioRef.current },
        })
      );

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

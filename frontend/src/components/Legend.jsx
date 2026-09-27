import { useState } from 'react';
import { useMapStore } from '../stores/mapStore';

/**
 * Legend — Bottom-center pill showing pin color meanings.
 * Inspired by bengaluru.rent's clean legend bar.
 */
export default function Legend() {
  const { pinMode } = useMapStore();
  const [showAbout, setShowAbout] = useState(false);

  // Hide legend during pin mode
  if (pinMode) return null;

  return (
    <div className="absolute bottom-7 left-1/2 -translate-x-1/2 z-10">
      <div className="legend-pill">
        {/* Flat dot */}
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          <span>Flats</span>
        </span>

        <span className="w-px h-3 bg-slate-300 dark:bg-white/10" />

        {/* Seeker dot */}
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-indigo-400" />
          <span>Seekers</span>
        </span>

        <span className="w-px h-3 bg-slate-300 dark:bg-white/10" />

        {/* About link */}
        <button
          onClick={() => {
            localStorage.removeItem('seen_intro');
            window.location.reload();
          }}
          className="text-emerald-500 dark:text-emerald-400/80 hover:text-emerald-600 dark:hover:text-emerald-300 font-semibold transition-colors"
        >
          About
        </button>
      </div>
    </div>
  );
}

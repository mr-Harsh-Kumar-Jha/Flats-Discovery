import { useMapStore } from '../stores/mapStore';

/**
 * Legend — Bottom-center pill showing pin and transit color meanings.
 */
export default function Legend() {
  const { pinMode } = useMapStore();

  // Hide legend during pin mode
  if (pinMode) return null;

  return (
    <div className="absolute bottom-7 left-1/2 -translate-x-1/2 z-10 max-w-[95vw] overflow-x-auto scrollbar-none">
      <div className="legend-pill flex items-center gap-2 whitespace-nowrap text-[11px] px-3.5 py-1.5">
        {/* Flat dot */}
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.5)]" />
          <span>Flats</span>
        </span>

        <span className="w-px h-3 bg-slate-300 dark:bg-white/10" />

        {/* Seeker dot */}
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-indigo-400 shadow-[0_0_6px_rgba(99,102,241,0.5)]" />
          <span>Seekers</span>
        </span>

        <span className="w-px h-3 bg-slate-300 dark:bg-white/10" />

        {/* Metro indicator */}
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-purple-500 shadow-[0_0_6px_rgba(168,85,247,0.5)]" />
          <span>Metro</span>
        </span>

        <span className="w-px h-3 bg-slate-300 dark:bg-white/10" />

        {/* Railway indicator */}
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-rose-500 shadow-[0_0_6px_rgba(225,29,72,0.5)]" />
          <span>Rail</span>
        </span>

        <span className="w-px h-3 bg-slate-300 dark:bg-white/10" />

        {/* Airport indicator */}
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_6px_rgba(37,99,235,0.5)]" />
          <span>Airport</span>
        </span>

        <span className="w-px h-3 bg-slate-300 dark:bg-white/10" />

        {/* Bus indicator */}
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.5)]" />
          <span>Bus</span>
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

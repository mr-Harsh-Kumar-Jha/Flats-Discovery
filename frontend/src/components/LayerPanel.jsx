import { useMapStore, mapStyles } from '../stores/mapStore';
import { usePinsStore } from '../stores/pinsStore';

/**
 * Layer configuration — only data layers we actually control.
 * Transit/metro/railway/airport are rendered natively by the basemap.
 */
const LAYER_CONFIG = [
  {
    key: 'flats',
    label: 'Flat Pins',
    icon: '🏠',
    activeClass: 'bg-emerald-500/20 border-emerald-500/50 text-emerald-600 dark:text-emerald-300',
    dotClass: 'bg-emerald-400',
  },
  {
    key: 'seekers',
    label: 'Seekers',
    icon: '🔍',
    activeClass: 'bg-indigo-500/20 border-indigo-500/50 text-indigo-600 dark:text-indigo-300',
    dotClass: 'bg-indigo-400',
  },
  {
    key: 'heatmap',
    label: 'Demand Heatmap',
    icon: '🔥',
    activeClass: 'bg-amber-500/20 border-amber-500/50 text-amber-600 dark:text-amber-300',
    dotClass: 'bg-amber-400',
  },
];

export default function LayerPanel() {
  const { layers, toggleLayer, mapStyle, setMapStyle } = useMapStore();
  const { meta } = usePinsStore();

  return (
    <div className="absolute top-4 right-4 z-10 flex flex-col gap-3">
      {/* Map Style Switcher */}
      <div className="glass rounded-xl p-3 min-w-[220px]">
        <h4 className="text-[10px] font-semibold text-slate-400 dark:text-white/40 mb-2 px-1 uppercase tracking-widest">
          Map Style
        </h4>
        <div className="grid grid-cols-3 gap-1.5">
          {Object.entries(mapStyles).map(([key, style]) => {
            const styleStr = typeof style.url === 'object' ? JSON.stringify(style.url) : style.url;
            const currentStr = typeof mapStyle === 'object' ? JSON.stringify(mapStyle) : mapStyle;
            const isActive = styleStr === currentStr;

            return (
              <button
                key={key}
                onClick={() => setMapStyle(style.url)}
                className={`text-[11px] px-2 py-1.5 rounded-lg border transition-all font-medium ${
                  isActive
                    ? 'bg-slate-100 dark:bg-white/10 border-slate-300 dark:border-white/30 text-slate-800 dark:text-white'
                    : 'border-slate-200 dark:border-white/5 text-slate-500 dark:text-white/40 hover:text-slate-700 dark:hover:text-white/70 hover:border-slate-300 dark:hover:border-white/15'
                }`}
              >
                {style.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Data Layers */}
      <div className="glass rounded-xl p-3 min-w-[220px]">
        <h4 className="text-[10px] font-semibold text-slate-400 dark:text-white/40 mb-2 px-1 uppercase tracking-widest">
          Data Layers
        </h4>
        <div className="space-y-1">
          {LAYER_CONFIG.map((layer) => {
            const isActive = layers[layer.key];
            const count = meta[layer.key]?.count;

            return (
              <button
                key={layer.key}
                onClick={() => toggleLayer(layer.key)}
                className={`
                  w-full flex items-center gap-2.5 px-3 py-2 rounded-lg
                  border transition-all duration-200 text-left text-sm
                  ${isActive
                    ? layer.activeClass
                    : 'border-slate-200 dark:border-white/5 text-slate-500 dark:text-white/40 hover:text-slate-600 dark:hover:text-white/60 hover:border-slate-300 dark:hover:border-white/10'
                  }
                `}
              >
                <div
                  className={`w-2 h-2 rounded-full transition-all duration-200 shrink-0 ${
                    isActive ? layer.dotClass : 'bg-slate-300 dark:bg-white/20'
                  }`}
                />
                <span className="flex-1 truncate">
                  {layer.icon} {layer.label}
                </span>
                {isActive && count != null && (
                  <span className="text-xs opacity-60 shrink-0">{count}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

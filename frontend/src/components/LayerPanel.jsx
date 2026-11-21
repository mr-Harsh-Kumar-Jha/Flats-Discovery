import { useState, useEffect, useRef } from 'react';
import { Layers, X } from 'lucide-react';
import { useMapStore, mapStyles } from '../stores/mapStore';
import { usePinsStore } from '../stores/pinsStore';

/**
 * Layer configuration — data layers controlled by user.
 */
const LAYER_CONFIG = [
  {
    key: 'flats',
    label: 'Flat Pins',
    icon: '🏠',
    activeClass: 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300',
    dotClass: 'bg-emerald-400',
  },
  {
    key: 'transit',
    label: 'Commute Lines (Metro, Monorail, RRTS, Rail, Bus)',
    icon: '🚇',
    activeClass: 'bg-purple-500/20 border-purple-500/50 text-purple-300',
    dotClass: 'bg-purple-400',
  },
  {
    key: 'seekers',
    label: 'Seekers',
    icon: '🔍',
    activeClass: 'bg-indigo-500/20 border-indigo-500/50 text-indigo-300',
    dotClass: 'bg-indigo-400',
  },
  {
    key: 'heatmap',
    label: 'Demand Heatmap',
    icon: '🔥',
    activeClass: 'bg-amber-500/20 border-amber-500/50 text-amber-300',
    dotClass: 'bg-amber-400',
  },
];

export default function LayerPanel() {
  const { layers, toggleLayer, mapStyle, setMapStyle } = useMapStore();
  const { meta } = usePinsStore();
  const [isOpen, setIsOpen] = useState(false);
  const panelRef = useRef(null);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="absolute top-3.5 right-4 z-40" ref={panelRef}>
      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`h-9 px-3 rounded-xl backdrop-blur-2xl border text-xs font-bold transition-all shadow-xl flex items-center gap-1.5 ${
          isOpen
            ? 'bg-emerald-500/25 border-emerald-500/50 text-emerald-300'
            : 'bg-slate-950/85 border-white/10 text-slate-300 hover:text-white hover:bg-white/10'
        }`}
        title="Map Layers & Basemap"
      >
        <Layers className="w-4 h-4 text-emerald-400" />
        <span className="hidden sm:inline">Layers</span>
      </button>

      {/* Main Dropdown Panel */}
      {isOpen && (
        <div className="absolute top-full right-0 mt-2 z-50 flex flex-col gap-2.5 animate-in fade-in zoom-in-95 duration-150">
          {/* Map Style Switcher */}
          <div className="bg-slate-950/95 backdrop-blur-2xl rounded-2xl p-2.5 min-w-[220px] border border-white/10 shadow-2xl">
            <h4 className="text-[10px] font-bold text-slate-400 mb-1.5 px-1 uppercase tracking-widest">
              Map Basemap
            </h4>
            <div className="grid grid-cols-3 gap-1">
              {Object.entries(mapStyles).map(([key, style]) => {
                const styleStr = typeof style.url === 'object' ? JSON.stringify(style.url) : style.url;
                const currentStr = typeof mapStyle === 'object' ? JSON.stringify(mapStyle) : mapStyle;
                const isActive = styleStr === currentStr;

                return (
                  <button
                    key={key}
                    onClick={() => setMapStyle(style.url)}
                    className={`text-[11px] px-2 py-1.5 rounded-lg border transition-all font-semibold ${
                      isActive
                        ? 'bg-white/15 border-white/30 text-white shadow-sm'
                        : 'border-white/5 text-slate-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {style.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Data Layers */}
          <div className="bg-slate-950/95 backdrop-blur-2xl rounded-2xl p-2.5 min-w-[220px] border border-white/10 shadow-2xl">
            <h4 className="text-[10px] font-bold text-slate-400 mb-1.5 px-1 uppercase tracking-widest">
              Commute &amp; Data Layers
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
                      w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg
                      border transition-all text-left text-xs font-medium
                      ${isActive
                        ? layer.activeClass
                        : 'border-white/5 text-slate-400 hover:text-white hover:bg-white/5'
                      }
                    `}
                  >
                    <div
                      className={`w-2 h-2 rounded-full shrink-0 ${
                        isActive ? layer.dotClass : 'bg-white/20'
                      }`}
                    />
                    <span className="flex-1 truncate">
                      {layer.icon} {layer.label}
                    </span>
                    {isActive && count != null && (
                      <span className="text-[10px] opacity-60 shrink-0 font-bold">{count}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

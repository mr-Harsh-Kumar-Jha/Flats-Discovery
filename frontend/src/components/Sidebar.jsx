import { useState } from 'react';
import { useMapStore } from '../stores/mapStore';
import { usePinsStore } from '../stores/pinsStore';
import OVCalculatorModal from './OVCalculatorModal';
import { Activity, ChevronLeft, ChevronRight, SlidersHorizontal } from 'lucide-react';

function formatRent(amount) {
  if (!amount) return '0';
  if (amount >= 100000) return `${(amount / 100000).toFixed(1)}L`;
  if (amount >= 1000) return `${(amount / 1000).toFixed(amount % 1000 === 0 ? 0 : 1)}K`;
  return amount.toString();
}

function formatFurnishing(val) {
  if (!val) return 'Any';
  return val.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Sidebar — Thoughtfully designed collapsible property list.
 * USP: quick filters + property cards with flyTo sync.
 */
export default function Sidebar() {
  const { sidebarOpen, toggleSidebar, layers, setSelectedPin } = useMapStore();
  const { seekerPins, meta, loading, getFilteredFlats, filters, setFilters } = usePinsStore();
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const displayFlats = getFilteredFlats();
  const flatCount = displayFlats.length;
  const seekerCount = seekerPins?.length ?? 0;

  // Count active filters
  const activeFilterCount =
    filters.bhk.length +
    (filters.maxRent < 200000 ? 1 : 0) +
    filters.furnishing.length +
    filters.propertyType.length +
    filters.parking.length +
    (filters.locality ? 1 : 0) +
    filters.waterSupply.length +
    filters.powerBackup.length;

  return (
    <>
      {/* Collapse/Expand toggle */}
      <button
        onClick={toggleSidebar}
        className="absolute top-4 left-4 z-10 glass rounded-xl p-2 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
        title={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
      >
        {sidebarOpen
          ? <ChevronLeft className="w-4 h-4 text-slate-500 dark:text-white/60" />
          : <ChevronRight className="w-4 h-4 text-slate-500 dark:text-white/60" />
        }
      </button>

      {/* Sidebar panel */}
      <div
        className={`
          absolute top-0 left-0 z-[5] h-full w-[320px]
          transform transition-transform duration-300 ease-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <div className="h-full bg-white/95 dark:bg-[#0f0f1e]/95 backdrop-blur-xl border-r border-slate-200 dark:border-white/8 flex flex-col">
          {/* Header */}
          <div className="px-4 pt-14 pb-3">
            <div className="flex justify-between items-center mb-1">
              <h2 className="text-slate-800 dark:text-white/90 text-[15px] font-semibold tracking-tight">
                Properties
              </h2>
              <div className="flex items-center gap-1.5">
                {/* Filter toggle */}
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`p-1.5 rounded-lg transition-colors relative ${
                    showFilters || activeFilterCount > 0
                      ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                      : 'text-slate-400 dark:text-white/40 hover:text-slate-600 dark:hover:text-white/70 hover:bg-slate-100 dark:hover:bg-white/5'
                  }`}
                  title="Filters"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  {activeFilterCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full text-[9px] font-bold text-white flex items-center justify-center">
                      {activeFilterCount}
                    </span>
                  )}
                </button>
                {/* OV Simulator */}
                <button
                  onClick={() => setIsSimulatorOpen(true)}
                  className="p-1.5 text-slate-400 dark:text-white/40 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors"
                  title="OV Score Simulator"
                >
                  <Activity className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            <p className="text-[11px] text-slate-400 dark:text-white/30">
              {layers.flats ? `${flatCount} flat${flatCount !== 1 ? 's' : ''}` : ''}
              {layers.flats && layers.seekers ? ' · ' : ''}
              {layers.seekers ? `${seekerCount} seeker${seekerCount !== 1 ? 's' : ''}` : ''}
              {!layers.flats && !layers.seekers ? 'Enable layers to see pins' : ''}
              {(loading.flats || loading.seekers) && ' · Loading...'}
            </p>
          </div>

          {/* Collapsible Filters */}
          {showFilters && (
            <div className="px-4 pb-3 border-b border-slate-200 dark:border-white/6 space-y-3 animate-slide-up overflow-y-auto max-h-[50vh]">
              {/* BHK chips */}
              <div>
                <label className="text-[10px] text-slate-400 dark:text-white/30 uppercase tracking-widest block mb-1.5">BHK</label>
                <div className="flex gap-1.5">
                  {['1BHK', '2BHK', '3BHK', '4BHK+'].map(bhk => {
                    const isActive = filters.bhk.includes(bhk);
                    return (
                      <button
                        key={bhk}
                        onClick={() => {
                          const next = isActive
                            ? filters.bhk.filter(b => b !== bhk)
                            : [...filters.bhk, bhk];
                          setFilters({ bhk: next });
                        }}
                        className={`text-[11px] px-2.5 py-1 rounded-lg font-medium transition-all ${
                          isActive
                            ? 'bg-emerald-500/20 border border-emerald-500/50 text-emerald-600 dark:text-emerald-400'
                            : 'bg-slate-50 dark:bg-white/4 border border-slate-200 dark:border-white/8 text-slate-500 dark:text-white/40 hover:text-slate-700 dark:hover:text-white/70'
                        }`}
                      >
                        {bhk}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Rent range */}
              <div>
                <label className="text-[10px] text-slate-400 dark:text-white/30 uppercase tracking-widest flex justify-between mb-1.5">
                  <span>Max Rent</span>
                  <span className="text-slate-600 dark:text-white/50">₹{filters.maxRent.toLocaleString()}</span>
                </label>
                <input
                  type="range"
                  min="5000"
                  max="200000"
                  step="5000"
                  value={filters.maxRent}
                  onChange={(e) => setFilters({ maxRent: parseInt(e.target.value) })}
                  className="w-full accent-emerald-500 h-1"
                />
              </div>

              {/* Furnishing chips */}
              <div>
                <label className="text-[10px] text-slate-400 dark:text-white/30 uppercase tracking-widest block mb-1.5">Furnishing</label>
                <div className="flex gap-1.5 flex-wrap">
                  {[['UNFURNISHED', 'None'], ['SEMI_FURNISHED', 'Semi'], ['FULLY_FURNISHED', 'Full']].map(([val, label]) => {
                    const isActive = filters.furnishing.includes(val);
                    return (
                      <button
                        key={val}
                        onClick={() => {
                          const next = isActive
                            ? filters.furnishing.filter(f => f !== val)
                            : [...filters.furnishing, val];
                          setFilters({ furnishing: next });
                        }}
                        className={`text-[11px] px-2.5 py-1 rounded-lg font-medium transition-all ${
                          isActive
                            ? 'bg-emerald-500/20 border border-emerald-500/50 text-emerald-600 dark:text-emerald-400'
                            : 'bg-slate-50 dark:bg-white/4 border border-slate-200 dark:border-white/8 text-slate-500 dark:text-white/40 hover:text-slate-700 dark:hover:text-white/70'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Property Type chips */}
              <div>
                <label className="text-[10px] text-slate-400 dark:text-white/30 uppercase tracking-widest block mb-1.5">Property Type</label>
                <div className="flex gap-1.5 flex-wrap">
                  {[['APARTMENT', 'Apartment'], ['INDEPENDENT_HOUSE', 'House'], ['PG', 'PG'], ['CO_LIVING', 'Co-living']].map(([val, label]) => {
                    const isActive = filters.propertyType.includes(val);
                    return (
                      <button
                        key={val}
                        onClick={() => {
                          const next = isActive
                            ? filters.propertyType.filter(f => f !== val)
                            : [...filters.propertyType, val];
                          setFilters({ propertyType: next });
                        }}
                        className={`text-[11px] px-2.5 py-1 rounded-lg font-medium transition-all ${
                          isActive
                            ? 'bg-indigo-500/20 border border-indigo-500/50 text-indigo-600 dark:text-indigo-400'
                            : 'bg-slate-50 dark:bg-white/4 border border-slate-200 dark:border-white/8 text-slate-500 dark:text-white/40 hover:text-slate-700 dark:hover:text-white/70'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Parking chips */}
              <div>
                <label className="text-[10px] text-slate-400 dark:text-white/30 uppercase tracking-widest block mb-1.5">Parking</label>
                <div className="flex gap-1.5 flex-wrap">
                  {[['TWO_WHEELER', '🏍️ 2W'], ['FOUR_WHEELER', '🚗 4W'], ['BOTH', '🅿️ Both']].map(([val, label]) => {
                    const isActive = filters.parking.includes(val);
                    return (
                      <button
                        key={val}
                        onClick={() => {
                          const next = isActive
                            ? filters.parking.filter(f => f !== val)
                            : [...filters.parking, val];
                          setFilters({ parking: next });
                        }}
                        className={`text-[11px] px-2.5 py-1 rounded-lg font-medium transition-all ${
                          isActive
                            ? 'bg-violet-500/20 border border-violet-500/50 text-violet-600 dark:text-violet-400'
                            : 'bg-slate-50 dark:bg-white/4 border border-slate-200 dark:border-white/8 text-slate-500 dark:text-white/40 hover:text-slate-700 dark:hover:text-white/70'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Locality search */}
              <div>
                <label className="text-[10px] text-slate-400 dark:text-white/30 uppercase tracking-widest block mb-1.5">Locality / Area</label>
                <input
                  type="text"
                  placeholder="e.g. Kothrud, Baner, Hinjewadi..."
                  value={filters.locality}
                  onChange={(e) => setFilters({ locality: e.target.value })}
                  className="form-input text-[12px] py-2"
                />
              </div>

              {/* Water Supply chips */}
              <div>
                <label className="text-[10px] text-slate-400 dark:text-white/30 uppercase tracking-widest block mb-1.5">Water Supply</label>
                <div className="flex gap-1.5 flex-wrap">
                  {[['MUNICIPAL', 'Municipal'], ['BOREWELL', 'Borewell'], ['TANKER', 'Tanker'], ['MIXED', 'Mixed']].map(([val, label]) => {
                    const isActive = filters.waterSupply.includes(val);
                    return (
                      <button
                        key={val}
                        onClick={() => {
                          const next = isActive
                            ? filters.waterSupply.filter(f => f !== val)
                            : [...filters.waterSupply, val];
                          setFilters({ waterSupply: next });
                        }}
                        className={`text-[11px] px-2.5 py-1 rounded-lg font-medium transition-all ${
                          isActive
                            ? 'bg-cyan-500/20 border border-cyan-500/50 text-cyan-600 dark:text-cyan-400'
                            : 'bg-slate-50 dark:bg-white/4 border border-slate-200 dark:border-white/8 text-slate-500 dark:text-white/40 hover:text-slate-700 dark:hover:text-white/70'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Power Backup chips */}
              <div>
                <label className="text-[10px] text-slate-400 dark:text-white/30 uppercase tracking-widest block mb-1.5">Power Backup</label>
                <div className="flex gap-1.5 flex-wrap">
                  {[['INVERTER', 'Inverter'], ['FULL_DG', 'Full DG']].map(([val, label]) => {
                    const isActive = filters.powerBackup.includes(val);
                    return (
                      <button
                        key={val}
                        onClick={() => {
                          const next = isActive
                            ? filters.powerBackup.filter(f => f !== val)
                            : [...filters.powerBackup, val];
                          setFilters({ powerBackup: next });
                        }}
                        className={`text-[11px] px-2.5 py-1 rounded-lg font-medium transition-all ${
                          isActive
                            ? 'bg-amber-500/20 border border-amber-500/50 text-amber-600 dark:text-amber-400'
                            : 'bg-slate-50 dark:bg-white/4 border border-slate-200 dark:border-white/8 text-slate-500 dark:text-white/40 hover:text-slate-700 dark:hover:text-white/70'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Clear filters */}
              {activeFilterCount > 0 && (
                <button
                  onClick={() => setFilters({
                    bhk: [], maxRent: 200000, furnishing: [],
                    propertyType: [], parking: [], locality: '',
                    waterSupply: [], powerBackup: []
                  })}
                  className="text-[11px] text-emerald-600 dark:text-emerald-400 hover:text-emerald-500 dark:hover:text-emerald-300 transition-colors"
                >
                  Clear all filters
                </button>
              )}
            </div>
          )}

          {/* Pin list */}
          <div className="flex-1 overflow-y-auto py-1 px-2">
            {/* Flat pins */}
            {layers.flats && displayFlats.map((pin) => (
              <FlatPinCard
                key={pin.id}
                pin={pin}
                onClick={() => {
                  setSelectedPin({ type: 'flat', data: pin });
                  const map = useMapStore.getState().mapInstance;
                  if (map) {
                    map.flyTo({ center: [pin.lng, pin.lat], zoom: 16, speed: 1.2 });
                  }
                }}
              />
            ))}

            {/* Seeker pins */}
            {layers.seekers && seekerPins.map((pin) => (
              <SeekerPinCard
                key={pin.id}
                pin={pin}
                onClick={() => {
                  setSelectedPin({ type: 'seeker', data: pin });
                  const map = useMapStore.getState().mapInstance;
                  if (map) {
                    map.flyTo({ center: [pin.lng, pin.lat], zoom: 16, speed: 1.2 });
                  }
                }}
              />
            ))}

            {/* Empty state */}
            {flatCount === 0 && seekerCount === 0 && !loading.flats && !loading.seekers && (
              <div className="flex flex-col items-center justify-center py-16 text-slate-300 dark:text-white/20">
                <div className="text-3xl mb-3">🗺️</div>
                <p className="text-sm font-medium">No pins in this area</p>
                <p className="text-xs mt-1">Pan the map to explore</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {isSimulatorOpen && <OVCalculatorModal onClose={() => setIsSimulatorOpen(false)} />}
    </>
  );
}

// ─── Pin Cards ───

function FlatPinCard({ pin, onClick }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-white/4 transition-all group mb-0.5"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
          <span className="font-semibold text-emerald-600 dark:text-emerald-400 text-[13px]">
            ₹{formatRent(pin.rent)}/mo
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-white/40 font-medium">
            {pin.bhk_config}
          </span>
        </div>
      </div>
      <div className="mt-1 ml-4 text-[11px] text-slate-400 dark:text-white/30 truncate">
        {pin.property_type} · {formatFurnishing(pin.furnishing)}
        {pin.parking && pin.parking !== 'NONE' && ` · 🅿️`}
      </div>
      {pin.description && (
        <p className="mt-1 ml-4 text-[11px] text-slate-300 dark:text-white/20 line-clamp-1 group-hover:text-slate-500 dark:group-hover:text-white/30 transition-colors">
          {pin.description}
        </p>
      )}
    </button>
  );
}

function SeekerPinCard({ pin, onClick }) {
  const bhks = pin.bhk_configs ? pin.bhk_configs.join(', ') : 'Any';
  return (
    <button
      onClick={onClick}
      className="w-full text-left p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-white/4 transition-all group mb-0.5"
    >
      <div className="flex items-center gap-2 min-w-0">
        <div className="w-2 h-2 rounded-full bg-indigo-400 shrink-0" />
        <span className="font-semibold text-indigo-600 dark:text-indigo-400 text-[13px]">
          ₹{formatRent(pin.budget_max)} budget
        </span>
      </div>
      <div className="mt-1 ml-4 text-[11px] text-slate-400 dark:text-white/30 truncate">
        {bhks} · {pin.search_radius_km || 5}km radius
      </div>
      {pin.notes && (
        <p className="mt-1 ml-4 text-[11px] text-slate-300 dark:text-white/20 line-clamp-1 group-hover:text-slate-500 dark:group-hover:text-white/30 transition-colors">
          {pin.notes}
        </p>
      )}
    </button>
  );
}

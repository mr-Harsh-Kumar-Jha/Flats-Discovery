import { useState, useEffect } from 'react';
import { useMapStore, CITIES_CONFIG } from '../stores/mapStore';
import { usePinsStore } from '../stores/pinsStore';
import OVCalculatorModal from './OVCalculatorModal';
import BuyYieldCard from './BuyYieldCard';
import { Activity, ChevronLeft, ChevronRight, SlidersHorizontal, Building, Train, Briefcase, Sparkles, TrendingUp } from 'lucide-react';

function formatRent(amount) {
  if (!amount) return '0';
  if (amount >= 10000000) return `${(amount / 10000000).toFixed(1)}Cr`;
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
 * Features: Rent/Buy toggle, Metro line filters, Office commute, Society intelligence.
 */
export default function Sidebar() {
  const { sidebarOpen, toggleSidebar, layers, setSelectedPin, citySlug, mobileView, setMobileView, viewTab, setViewTab } = useMapStore();
  const { seekerPins, societies, refreshCityData, getFilteredFlats, getFilteredSocieties, filters, setFilters, loading } = usePinsStore();
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const currentCity = CITIES_CONFIG[citySlug] || CITIES_CONFIG.pune;

  useEffect(() => {
    refreshCityData(citySlug);
  }, [citySlug, refreshCityData]);

  const displayFlats = getFilteredFlats();
  const displaySocieties = getFilteredSocieties();
  const flatCount = displayFlats.length;
  const societyCount = displaySocieties.length;
  const seekerCount = seekerPins?.length ?? 0;

  // Dynamic localities list extracted from current loaded societies and flats
  const dynamicLocalities = Array.from(
    new Set([
      ...(currentCity.localities || []),
      ...societies.map((s) => s.locality),
      ...displayFlats.map((f) => f.locality || f.area),
    ].filter(Boolean))
  );

  // Count active filters
  const activeFilterCount =
    filters.bhk.length +
    (filters.maxRent < 350000 ? 1 : 0) +
    (filters.maxPrice < 150000000 ? 1 : 0) +
    (filters.nearMetro ? 1 : 0) +
    (filters.officeCommute ? 1 : 0) +
    (filters.minBedroomDim ? 1 : 0) +
    filters.furnishing.length +
    filters.propertyType.length +
    filters.parking.length +
    (filters.locality ? 1 : 0);

  return (
    <>
      {/* Desktop Expand toggle (shown when sidebar is closed) */}
      {!sidebarOpen && (
        <button
          onClick={toggleSidebar}
          className="hidden md:flex fixed md:absolute top-4 left-4 z-40 bg-slate-950/90 backdrop-blur-xl border border-white/20 text-white rounded-xl p-2.5 hover:bg-white/10 transition-all shadow-2xl"
          title="Show sidebar"
        >
          <ChevronRight className="w-4 h-4 text-emerald-400" />
        </button>
      )}

      {/* Sidebar panel */}
      <div
        className={`
          fixed md:absolute top-0 left-0 z-30 h-full w-full sm:w-[380px]
          transform transition-transform duration-300 ease-out
          ${sidebarOpen ? 'md:translate-x-0' : 'md:-translate-x-full'}
          ${mobileView === 'list' ? 'translate-x-0' : 'max-md:-translate-x-full'}
        `}
      >
        <div className="h-full bg-[#0a0c16]/95 backdrop-blur-2xl border-r border-white/10 flex flex-col shadow-2xl">
          {/* Header */}
          <div className="px-4 pt-3.5 pb-2">
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-white text-[15px] font-bold tracking-tight flex items-center gap-1.5">
                {currentCity.name} {filters.mode === 'rent' ? 'Rentals' : 'Resale & Yield'}
                <span className="text-[10px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded">
                  {filters.mode === 'rent' ? 'RENTING' : 'BUYING'}
                </span>
              </h2>
              <div className="flex items-center gap-1.5">
                {/* Mobile close button */}
                <button
                  onClick={() => setMobileView('map')}
                  className="md:hidden p-1.5 text-slate-400 hover:text-white rounded-lg bg-white/5"
                  title="Close List"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                {/* Desktop collapse button */}
                <button
                  onClick={toggleSidebar}
                  className="hidden md:flex p-1.5 text-slate-400 hover:text-white rounded-lg bg-white/5 transition-colors"
                  title="Collapse sidebar"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                {/* Filter toggle */}
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`p-1.5 rounded-lg transition-colors relative ${
                    showFilters || activeFilterCount > 0
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
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
                  className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors"
                  title="OV Score Simulator"
                >
                  <Activity className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Mode Switcher: Rent vs Buy */}
            <div className="grid grid-cols-2 p-0.5 bg-slate-100 dark:bg-white/5 rounded-xl mb-2 text-xs font-semibold">
              <button
                onClick={() => setFilters({ mode: 'rent' })}
                className={`py-1.5 rounded-lg transition-all ${
                  filters.mode === 'rent'
                    ? 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-sm'
                    : 'text-slate-500 dark:text-white/50 hover:text-slate-800 dark:hover:text-white'
                }`}
              >
                🏠 Rent Flats
              </button>
              <button
                onClick={() => setFilters({ mode: 'buy' })}
                className={`py-1.5 rounded-lg transition-all ${
                  filters.mode === 'buy'
                    ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm'
                    : 'text-slate-500 dark:text-white/50 hover:text-slate-800 dark:hover:text-white'
                }`}
              >
                💎 Buy / Yield
              </button>
            </div>

            {/* View Tab: Flats vs Societies */}
            <div className="flex items-center gap-2 border-b border-slate-200 dark:border-white/10 pb-2 text-[12px] font-medium">
              <button
                onClick={() => setViewTab('flats')}
                className={`pb-1 border-b-2 transition-all ${
                  viewTab === 'flats'
                    ? 'border-emerald-500 text-slate-900 dark:text-white font-bold'
                    : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-white/60'
                }`}
              >
                Listings ({flatCount})
              </button>
              <button
                onClick={() => setViewTab('societies')}
                className={`pb-1 border-b-2 transition-all flex items-center gap-1 ${
                  viewTab === 'societies'
                    ? 'border-emerald-500 text-slate-900 dark:text-white font-bold'
                    : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-white/60'
                }`}
              >
                <Building className="w-3 h-3" />
                Societies ({societyCount})
              </button>
            </div>

            {/* Dynamic Locality Commute Intelligence Card */}
            {filters.locality && (
              <div className="mt-2 p-2.5 rounded-xl bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-indigo-500/10 border border-emerald-500/25 text-xs">
                <div className="flex items-center justify-between font-bold text-emerald-400 mb-1.5">
                  <span className="flex items-center gap-1">
                    <span>🚗</span>
                    <span>Live Commute from {filters.locality}</span>
                  </span>
                  <button
                    onClick={() => setFilters({ locality: '' })}
                    className="text-[10px] text-slate-400 hover:text-white px-1.5 py-0.5 rounded bg-white/5"
                  >
                    Clear
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                  {currentCity.hubs.map((hub, idx) => (
                    <div key={hub.key} className="flex items-center justify-between p-1 rounded bg-black/20">
                      <span className="text-slate-400 truncate text-[10px]">{hub.label}</span>
                      <span className="font-bold text-white text-[10.5px]">
                        {idx === 0 ? '12m' : idx === 1 ? '18m' : idx === 2 ? '24m' : '30m'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Collapsible Filters Drawer */}
          {showFilters && (
            <div className="px-4 pb-3 border-b border-slate-200 dark:border-white/6 space-y-3 animate-slide-up overflow-y-auto max-h-[52vh]">
              {/* BHK chips */}
              <div>
                <label className="text-[10px] text-slate-400 dark:text-white/30 uppercase tracking-widest block mb-1.5 font-bold">BHK Configuration</label>
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
                            : 'bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-white/60'
                        }`}
                      >
                        {bhk}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Dynamic Metro / Transit Line Proximity */}
              {currentCity.metro_lines && currentCity.metro_lines.length > 0 && (
                <div>
                  <label className="text-[10px] text-slate-400 dark:text-white/30 uppercase tracking-widest flex items-center gap-1 mb-1.5 font-bold">
                    <Train className="w-3 h-3 text-cyan-400" />
                    Near {currentCity.name} Metro / Transit
                  </label>
                  <div className="flex gap-1.5 flex-wrap">
                    <button
                      onClick={() => setFilters({ nearMetro: '' })}
                      className={`text-[10px] px-2 py-1 rounded-lg font-medium transition-all ${
                        !filters.nearMetro
                          ? 'bg-cyan-500/20 border border-cyan-500/50 text-cyan-600 dark:text-cyan-400 font-bold'
                          : 'bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-white/60'
                      }`}
                    >
                      Any
                    </button>
                    {currentCity.metro_lines.map((line) => {
                      const isActive = filters.nearMetro === line.key;
                      return (
                        <button
                          key={line.key}
                          onClick={() => setFilters({ nearMetro: isActive ? '' : line.key })}
                          className={`text-[10px] px-2 py-1 rounded-lg font-medium transition-all ${
                            isActive
                              ? 'bg-cyan-500/20 border border-cyan-500/50 text-cyan-600 dark:text-cyan-400 font-bold'
                              : 'bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-white/60'
                          }`}
                        >
                          {line.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Office Commute Hub (Signature Commute Feature) */}
              <div>
                <label className="text-[10px] text-slate-400 dark:text-white/30 uppercase tracking-widest flex items-center gap-1 mb-1.5 font-bold">
                  <Briefcase className="w-3 h-3 text-amber-400" />
                  Office Commute Hub (&lt;30m)
                </label>
                <div className="flex gap-1.5 flex-wrap">
                  <button
                    onClick={() => setFilters({ officeCommute: '' })}
                    className={`text-[10px] px-2 py-1 rounded-lg font-medium transition-all ${
                      !filters.officeCommute
                        ? 'bg-amber-500/20 border border-amber-500/50 text-amber-600 dark:text-amber-400 font-bold'
                        : 'bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-white/60'
                    }`}
                  >
                    All Hubs
                  </button>
                  {currentCity.hubs.map((hub) => {
                    const isActive = filters.officeCommute === hub.key;
                    return (
                      <button
                        key={hub.key}
                        onClick={() => setFilters({ officeCommute: isActive ? '' : hub.key })}
                        className={`text-[10px] px-2 py-1 rounded-lg font-medium transition-all ${
                          isActive
                            ? 'bg-amber-500/20 border border-amber-500/50 text-amber-600 dark:text-amber-400 font-bold'
                            : 'bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-white/60'
                        }`}
                      >
                        {hub.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Smallest Bedroom Size (Signature Flat-Finder Feature) */}
              <div>
                <label className="text-[10px] text-slate-400 dark:text-white/30 uppercase tracking-widest block mb-1.5 font-bold">
                  Smallest Bedroom Dimension
                </label>
                <div className="flex gap-1.5">
                  {[
                    ['', 'Any Size'],
                    ['10x11', '≥ 10\'×11\''],
                    ['11x12', '≥ 11\'×12\''],
                    ['12x14', '≥ 12\'×14\''],
                  ].map(([val, label]) => {
                    const isActive = filters.minBedroomDim === val;
                    return (
                      <button
                        key={val}
                        onClick={() => setFilters({ minBedroomDim: val })}
                        className={`text-[10px] px-2 py-1 rounded-lg font-medium transition-all ${
                          isActive
                            ? 'bg-emerald-500/20 border border-emerald-500/50 text-emerald-600 dark:text-emerald-400 font-bold'
                            : 'bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-white/60'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Rent or Price range */}
              {filters.mode === 'rent' ? (
                <div>
                  <label className="text-[10px] text-slate-400 dark:text-white/30 uppercase tracking-widest flex justify-between mb-1.5 font-bold">
                    <span>Max Monthly Rent</span>
                    <span className="text-emerald-400 font-bold">₹{formatRent(filters.maxRent)}/mo</span>
                  </label>
                  <input
                    type="range"
                    min="5000"
                    max="350000"
                    step="5000"
                    value={filters.maxRent}
                    onChange={(e) => setFilters({ maxRent: parseInt(e.target.value) })}
                    className="w-full accent-emerald-500 h-1"
                  />
                </div>
              ) : (
                <div>
                  <label className="text-[10px] text-slate-400 dark:text-white/30 uppercase tracking-widest flex justify-between mb-1.5 font-bold">
                    <span>Max Buy Price</span>
                    <span className="text-indigo-400 font-bold">₹{formatRent(filters.maxPrice)}</span>
                  </label>
                  <input
                    type="range"
                    min="2500000"
                    max="150000000"
                    step="2500000"
                    value={filters.maxPrice}
                    onChange={(e) => setFilters({ maxPrice: parseInt(e.target.value) })}
                    className="w-full accent-indigo-500 h-1"
                  />
                </div>
              )}

              {/* Dynamic Locality search & quick chips */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[10px] text-slate-400 dark:text-white/30 uppercase tracking-widest font-bold">
                    {currentCity.name} Localities
                  </label>
                  {filters.locality && (
                    <button
                      onClick={() => setFilters({ locality: '' })}
                      className="text-[10px] text-emerald-400 hover:underline"
                    >
                      Clear
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  placeholder={`Search in ${currentCity.name}...`}
                  value={filters.locality}
                  onChange={(e) => setFilters({ locality: e.target.value })}
                  className="w-full text-xs p-2 rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white outline-none focus:border-emerald-500 mb-1.5"
                />
                {dynamicLocalities.length > 0 && (
                  <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto scrollbar-none pt-0.5">
                    {dynamicLocalities.slice(0, 10).map((loc) => {
                      const isActive = filters.locality.toLowerCase() === loc.toLowerCase();
                      return (
                        <button
                          key={loc}
                          onClick={() => setFilters({ locality: isActive ? '' : loc })}
                          className={`text-[10px] px-2 py-0.5 rounded-md font-medium transition-all ${
                            isActive
                              ? 'bg-emerald-500/20 border border-emerald-500/50 text-emerald-400 font-bold'
                              : 'bg-white/5 hover:bg-white/10 text-slate-300 border border-white/5'
                          }`}
                        >
                          {loc}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Clear filters */}
              {activeFilterCount > 0 && (
                <button
                  onClick={() => setFilters({
                    bhk: [], maxRent: 350000, maxPrice: 150000000, furnishing: [],
                    propertyType: [], parking: [], locality: '',
                    nearMetro: '', officeCommute: '', minBedroomDim: '', minSqft: 0
                  })}
                  className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
                >
                  Clear all filters ({activeFilterCount})
                </button>
              )}
            </div>
          )}

          {/* Cards List */}
          <div className="flex-1 overflow-y-auto pt-1 px-2 pb-28 md:pb-16 scrollbar-none">
            {viewTab === 'flats' ? (
              /* TAB 1: LISTINGS (Individual Flats) */
              filters.mode === 'buy' ? (
                /* Individual Flats for Sale */
                <>
                  <div className="px-2.5 py-1.5 mb-2 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-[11px] text-indigo-300 font-medium flex items-center justify-between">
                    <span>💎 Individual Flats for Sale ({flatCount})</span>
                    <span className="text-[10px] text-indigo-400 font-bold">Resale &amp; New</span>
                  </div>

                  {layers.flats && displayFlats.map((pin) => (
                    <FlatSaleCard
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

                  {flatCount === 0 && !loading.flats && (
                    <div className="flex flex-col items-center justify-center py-16 text-slate-300 dark:text-white/20">
                      <div className="text-3xl mb-2">💎</div>
                      <p className="text-xs font-medium">No sale listings match filter</p>
                    </div>
                  )}
                </>
              ) : (
                /* Individual Flats for Rent */
                <>
                  {layers.flats && displayFlats.map((pin) => (
                    <FlatPinCard
                      key={pin.id}
                      pin={pin}
                      mode="rent"
                      onClick={() => {
                        setSelectedPin({ type: 'flat', data: pin });
                        const map = useMapStore.getState().mapInstance;
                        if (map) {
                          map.flyTo({ center: [pin.lng, pin.lat], zoom: 16, speed: 1.2 });
                        }
                      }}
                    />
                  ))}

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

                  {flatCount === 0 && seekerCount === 0 && !loading.flats && (
                    <div className="flex flex-col items-center justify-center py-16 text-slate-300 dark:text-white/20">
                      <div className="text-3xl mb-2">🗺️</div>
                      <p className="text-xs font-medium">No rental listings match filter</p>
                    </div>
                  )}
                </>
              )
            ) : (
              /* TAB 2: SOCIETIES (Housing Complex Footprints) */
              filters.mode === 'buy' ? (
                /* Society Investment Yields & Valuations (BuyYieldCard) */
                <>
                  <div className="px-2.5 py-1.5 mb-2 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-[11px] text-indigo-300 font-medium flex items-center justify-between">
                    <span>🏢 Society Investment Yields ({displaySocieties.length})</span>
                    <span className="text-[10px] text-emerald-400 font-bold">Yields 2.9% - 3.8%</span>
                  </div>

                  {displaySocieties.map((soc) => (
                    <BuyYieldCard
                      key={soc.id}
                      society={soc}
                      onClick={() => {
                        setSelectedPin({ type: 'society', data: soc });
                        const map = useMapStore.getState().mapInstance;
                        if (map) {
                          map.flyTo({ center: [soc.lng, soc.lat], zoom: 15.5, speed: 1.2 });
                        }
                      }}
                    />
                  ))}

                  {displaySocieties.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-16 text-slate-300 dark:text-white/20">
                      <div className="text-3xl mb-2">🏢</div>
                      <p className="text-xs font-medium">No investment societies match criteria</p>
                    </div>
                  )}
                </>
              ) : (
                /* Society Rental Overview */
                <>
                  <div className="px-2.5 py-1.5 mb-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-[11px] text-emerald-300 font-medium flex items-center justify-between">
                    <span>🏢 Gated Societies for Rent ({displaySocieties.length})</span>
                    <span className="text-[10px] text-emerald-400 font-bold">Direct Tenants</span>
                  </div>

                  {displaySocieties.map((soc) => (
                    <SocietyRentalCard
                      key={soc.id}
                      society={soc}
                      onClick={() => {
                        setSelectedPin({ type: 'society', data: soc });
                        const map = useMapStore.getState().mapInstance;
                        if (map) {
                          map.flyTo({ center: [soc.lng, soc.lat], zoom: 15.5, speed: 1.2 });
                        }
                      }}
                    />
                  ))}

                  {displaySocieties.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-16 text-slate-300 dark:text-white/20">
                      <div className="text-3xl mb-2">🏢</div>
                      <p className="text-xs font-medium">No rental societies match criteria</p>
                    </div>
                  )}
                </>
              )
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
      className="w-full text-left p-3 rounded-xl hover:bg-slate-100/70 dark:hover:bg-white/5 transition-all group mb-1 border border-transparent hover:border-slate-200 dark:hover:border-white/5"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 min-w-0">
          <div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
          <span className="font-bold text-slate-900 dark:text-white text-[13px]">
            ₹{formatRent(pin.rent)}/mo
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-white/70 font-semibold">
            {pin.bhk_config}
          </span>
        </div>
      </div>

      <div className="mt-1 ml-3.5 text-[11px] text-slate-500 dark:text-white/50 font-medium truncate">
        {pin.property_type} · {formatFurnishing(pin.furnishing)}
        {pin.parking && pin.parking !== 'NONE' && ` · 🅿️`}
      </div>

      {pin.description && (
        <p className="mt-1 ml-3.5 text-[11px] text-slate-600 dark:text-white/40 line-clamp-1 group-hover:text-slate-900 dark:group-hover:text-white/70 transition-colors">
          {pin.description}
        </p>
      )}
    </button>
  );
}

function FlatSaleCard({ pin, onClick }) {
  const estimatedPrice = pin.rent ? pin.rent * 320 : 6800000;
  const sqft = pin.bhk_config === '1BHK' ? 650 : pin.bhk_config === '2BHK' ? 1050 : pin.bhk_config === '3BHK' ? 1450 : 1850;
  const psf = Math.round(estimatedPrice / sqft);
  const emi = Math.round((estimatedPrice * 0.8 * (8.5 / 1200) * Math.pow(1 + 8.5/1200, 240)) / (Math.pow(1 + 8.5/1200, 240) - 1));
  const yieldPct = ((pin.rent * 12) / estimatedPrice * 100).toFixed(1);

  return (
    <button
      onClick={onClick}
      className="w-full text-left p-3 rounded-xl hover:bg-slate-100/70 dark:hover:bg-white/5 transition-all group mb-1.5 border border-indigo-500/20 bg-indigo-950/10"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 min-w-0">
          <div className="w-2 h-2 rounded-full bg-indigo-500 shrink-0" />
          <span className="font-bold text-slate-900 dark:text-white text-[13px]">
            ₹{formatRent(estimatedPrice)}
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-400 font-bold">
            {pin.bhk_config}
          </span>
          <span className="text-[10px] text-slate-400 font-medium">
            {sqft} sq.ft.
          </span>
        </div>
        <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
          {yieldPct}% Yield
        </span>
      </div>

      <div className="mt-1 ml-3.5 flex items-center justify-between text-[11px] text-slate-500 dark:text-white/50 font-medium">
        <span>₹{psf.toLocaleString('en-IN')}/sqft · EMI ~₹{formatRent(emi)}/mo</span>
        <span className="text-emerald-500 font-semibold">Rent ~₹{formatRent(pin.rent)}/mo</span>
      </div>

      {pin.description && (
        <p className="mt-1 ml-3.5 text-[11px] text-slate-600 dark:text-white/40 line-clamp-1 group-hover:text-slate-900 dark:group-hover:text-white/70 transition-colors">
          {pin.description}
        </p>
      )}
    </button>
  );
}

function SocietyRentalCard({ society, onClick }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left p-3 rounded-xl hover:bg-slate-100/70 dark:hover:bg-white/5 transition-all group mb-1 border border-slate-200/60 dark:border-white/5 bg-slate-50/50 dark:bg-white/[0.02]"
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-1.5">
            <Building className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            <h4 className="font-bold text-slate-900 dark:text-white text-[13px] group-hover:text-emerald-500 transition-colors">
              {society.name}
            </h4>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-white/40 ml-5">
            {society.locality} · {society.towers_count} Towers
          </p>
        </div>

        <div className="text-right">
          <p className="font-bold text-[12px] text-slate-900 dark:text-white">
            ₹{formatRent(society.min_rent)}/mo
          </p>
          <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
            Rentals Available
          </p>
        </div>
      </div>

      {/* Flat-Finder Dimension Badge */}
      <div className="mt-2 ml-5 flex items-center gap-1.5 flex-wrap">
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold">
          Min Bed: {society.min_bedroom_dims}
        </span>
        {society.nearest_metro_station && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 font-medium">
            🚇 {society.metro_distance_meters}m to Metro
          </span>
        )}
      </div>
    </button>
  );
}

function SeekerPinCard({ pin, onClick }) {
  const bhks = pin.bhk_configs ? pin.bhk_configs.join(', ') : 'Any';
  return (
    <button
      onClick={onClick}
      className="w-full text-left p-3 rounded-xl hover:bg-slate-100/70 dark:hover:bg-white/5 transition-all group mb-1 border border-transparent hover:border-slate-200 dark:hover:border-white/5"
    >
      <div className="flex items-center gap-2 min-w-0">
        <div className="w-2 h-2 rounded-full bg-indigo-500 shrink-0" />
        <span className="font-semibold text-indigo-700 dark:text-indigo-400 text-[13px]">
          ₹{formatRent(pin.budget_max)} budget
        </span>
      </div>
      <div className="mt-1 ml-4 text-[11px] text-slate-600 dark:text-white/60 font-medium truncate">
        {bhks} · {pin.search_radius_km || 5}km radius
      </div>
      {pin.notes && (
        <p className="mt-1 ml-4 text-[11px] text-slate-500 dark:text-white/40 line-clamp-1 group-hover:text-slate-700 dark:group-hover:text-white/60 transition-colors">
          {pin.notes}
        </p>
      )}
    </button>
  );
}

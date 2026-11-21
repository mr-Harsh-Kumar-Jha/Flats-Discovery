import { useState, useEffect, useRef } from 'react';
import { Search, MapPin, X, ChevronDown, Sparkles, Flame, Check, Navigation, Plus } from 'lucide-react';
import { useMapStore, CITIES_CONFIG } from '../stores/mapStore';
import { usePinsStore } from '../stores/pinsStore';

const CITY_ICONS = {
  pune: '🏙️',
  mumbai: '🌊',
  gurgaon: '🏢',
  noida: '🌳',
};

export default function SearchBar({ onOpenFlatmates, onOpenOnboarding, onAddListing }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [cityMenuOpen, setCityMenuOpen] = useState(false);

  const { mapInstance, citySlug, switchCity, sidebarOpen } = useMapStore();
  const { filters, setFilters, refreshCityData } = usePinsStore();
  const menuRef = useRef(null);

  const activeCity = CITIES_CONFIG[citySlug] || CITIES_CONFIG.pune;
  const localities = activeCity.localities || [];

  // Close city menu on click outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setCityMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Free-text geocode lookup via Nominatim
  useEffect(() => {
    if (!query || query.length < 3) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query + ' ' + activeCity.name)}&format=json&countrycodes=in&limit=5`);
        const data = await res.json();
        setResults(data);
        setIsOpen(true);
      } catch (err) {
        console.error('Geocoding error:', err);
      } finally {
        setLoading(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [query, activeCity.name]);

  const handleSelectPlace = (place) => {
    if (mapInstance) {
      const lat = parseFloat(place.lat);
      const lon = parseFloat(place.lon);
      mapInstance.flyTo({
        center: [lon, lat],
        zoom: 15.5,
        essential: true,
        speed: 1.2
      });
    }
    setFilters({ locality: place.display_name.split(',')[0] });
    setQuery(place.display_name.split(',')[0]);
    setIsOpen(false);
  };

  const handleSelectLocality = (loc) => {
    const nextLoc = filters.locality === loc ? '' : loc;
    setFilters({ locality: nextLoc });
    setQuery(nextLoc);

    // Fly to locality center if known
    if (nextLoc && activeCity.commuteCoords && activeCity.commuteCoords[nextLoc] && mapInstance) {
      const coords = activeCity.commuteCoords[nextLoc];
      mapInstance.flyTo({
        center: [coords.lng, coords.lat],
        zoom: 15,
        speed: 1.2
      });
    }
  };

  const handleClear = () => {
    setQuery('');
    setFilters({ locality: '' });
    setIsOpen(false);
  };

  return (
    <div className={`absolute top-3 right-0 z-40 px-3 sm:px-6 pointer-events-none flex flex-col items-center transition-all duration-300 ${
      sidebarOpen ? 'left-0 md:left-[380px]' : 'left-0 md:left-14'
    }`}>
      <div className="w-full max-w-2xl pointer-events-auto flex flex-col gap-2">
        {/* Top Control Bar */}
        <div className="flex items-center gap-1.5 sm:gap-2 bg-slate-950/85 backdrop-blur-2xl border border-white/10 rounded-2xl px-2.5 py-1.5 shadow-2xl shadow-black/40">
          
          {/* City Selector Dropdown */}
          <div className="relative shrink-0" ref={menuRef}>
            <button
              type="button"
              onClick={() => setCityMenuOpen(!cityMenuOpen)}
              className="flex items-center gap-1.5 pl-2.5 pr-2 py-1.5 text-xs font-bold text-white rounded-xl bg-white/5 hover:bg-white/10 transition-all border border-white/10"
              title="Switch City"
            >
              <span className="text-sm">{CITY_ICONS[citySlug] || '🏙️'}</span>
              <span className="tracking-tight hidden sm:inline">{activeCity.name}</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            {cityMenuOpen && (
              <div className="absolute top-full left-0 mt-2 w-48 bg-[#0f111a]/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden py-1.5 z-50 animate-slide-up">
                <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Select Metro City
                </div>
                {Object.entries(CITIES_CONFIG).map(([slug, c]) => (
                  <button
                    key={slug}
                    onClick={() => {
                      switchCity(slug);
                      refreshCityData(slug);
                      setCityMenuOpen(false);
                      setQuery('');
                      setFilters({ locality: '' });
                    }}
                    className={`w-full text-left px-3 py-2 flex items-center justify-between text-xs transition-colors ${
                      citySlug === slug
                        ? 'bg-emerald-500/20 text-emerald-400 font-bold'
                        : 'text-slate-300 hover:bg-white/5'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span className="text-base">{CITY_ICONS[slug]}</span>
                      <span>{c.name}</span>
                    </span>
                    <span className="text-[10px] text-slate-500">{c.state}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Mode Switcher: Rent vs Buy Toggle */}
          <div className="flex items-center p-0.5 rounded-xl bg-white/5 border border-white/10 shrink-0 text-xs font-bold">
            <button
              onClick={() => setFilters({ mode: 'rent' })}
              className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 ${
                filters.mode === 'rent'
                  ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>🏠</span>
              <span>Rent</span>
            </button>
            <button
              onClick={() => setFilters({ mode: 'buy' })}
              className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 ${
                filters.mode === 'buy'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>💎</span>
              <span>Buy</span>
            </button>
          </div>

          {/* Search Input */}
          <div className="flex-1 flex items-center min-w-0 bg-white/5 rounded-xl px-2.5 py-1.5 border border-white/5 focus-within:border-emerald-500/50 transition-all">
            <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <input
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setFilters({ locality: e.target.value });
              }}
              placeholder={`Search ${activeCity.name} areas & societies...`}
              className="bg-transparent border-none outline-none text-white placeholder-slate-400 w-full ml-2 text-xs font-medium"
            />
            {query && (
              <button onClick={handleClear} className="text-slate-400 hover:text-white p-0.5 shrink-0">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Action Pills */}
          <div className="flex items-center gap-1 shrink-0">
            {onAddListing && (
              <button
                onClick={onAddListing}
                className="px-2.5 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 hover:border-emerald-400 text-xs font-bold transition-all flex items-center gap-1"
                title="List Property / Room"
              >
                <Plus className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden md:inline">List</span>
              </button>
            )}
            {onOpenFlatmates && (
              <button
                onClick={onOpenFlatmates}
                className="px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-rose-500/20 to-pink-500/20 border border-rose-500/30 text-rose-300 hover:border-rose-400 text-xs font-bold transition-all flex items-center gap-1"
                title="Tinder for Flatmates"
              >
                <Flame className="w-3.5 h-3.5 text-rose-400" />
                <span className="hidden md:inline">Flatmates</span>
              </button>
            )}
            {onOpenOnboarding && (
              <button
                onClick={onOpenOnboarding}
                className="px-2.5 py-1.5 rounded-xl bg-white/5 border border-white/10 text-slate-300 hover:text-white text-xs font-bold transition-all flex items-center gap-1"
                title="Guide & Goal Selection"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              </button>
            )}
          </div>
        </div>

        {/* Dynamic Location Filter Chips */}
        {localities.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-0.5 px-1">
            <button
              onClick={() => handleSelectLocality('')}
              className={`text-[11px] px-2.5 py-1 rounded-full font-semibold shrink-0 transition-all ${
                !filters.locality
                  ? 'bg-emerald-500/25 border border-emerald-500/50 text-emerald-300 shadow-sm'
                  : 'bg-slate-950/80 border border-white/10 text-slate-400 hover:text-white'
              }`}
            >
              📍 All {activeCity.name}
            </button>
            {localities.map((loc) => {
              const isActive = filters.locality.toLowerCase() === loc.toLowerCase();
              return (
                <button
                  key={loc}
                  onClick={() => handleSelectLocality(loc)}
                  className={`text-[11px] px-2.5 py-1 rounded-full font-semibold shrink-0 transition-all ${
                    isActive
                      ? 'bg-emerald-500/25 border border-emerald-500/50 text-emerald-300 shadow-sm'
                      : 'bg-slate-950/80 border border-white/10 text-slate-400 hover:text-white hover:border-white/20'
                  }`}
                >
                  {loc}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Geocoding Results Dropdown */}
      {isOpen && results.length > 0 && (
        <div className="w-full max-w-xl pointer-events-auto mt-2 bg-[#0f111a]/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden divide-y divide-white/5 z-50">
          {results.map((place) => (
            <button
              key={place.place_id}
              onClick={() => handleSelectPlace(place)}
              className="w-full text-left px-4 py-2.5 flex items-start space-x-2.5 hover:bg-white/5 transition-colors group"
            >
              <MapPin className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-white truncate">{place.display_name.split(',')[0]}</p>
                <p className="text-[11px] text-slate-400 truncate mt-0.5">{place.display_name}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

import { useState, useEffect } from 'react';
import { Search, MapPin, X } from 'lucide-react';
import { useMapStore } from '../stores/mapStore';

export default function SearchBar() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const { mapInstance } = useMapStore();

  useEffect(() => {
    if (!query || query.length < 3) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        // We restrict search to India (countrycodes=in).
        const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&countrycodes=in&limit=5`);
        const data = await res.json();
        setResults(data);
        setIsOpen(true);
      } catch (err) {
        console.error('Geocoding error:', err);
      } finally {
        setLoading(false);
      }
    }, 500); // 500ms debounce

    return () => clearTimeout(timer);
  }, [query]);

  const handleSelect = (place) => {
    if (mapInstance) {
      const lat = parseFloat(place.lat);
      const lon = parseFloat(place.lon);
      mapInstance.flyTo({
        center: [lon, lat],
        zoom: 15,
        essential: true,
        speed: 1.2
      });
    }
    setQuery('');
    setIsOpen(false);
  };

  const handleClear = () => {
    setQuery('');
    setIsOpen(false);
  };

  return (
    <div className="absolute top-6 left-1/2 -translate-x-1/2 z-40 w-full max-w-md px-4">
      <div className="relative flex items-center bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border border-slate-200/80 dark:border-gray-700/50 rounded-full px-4 py-3 shadow-lg dark:shadow-2xl transition-all ring-1 ring-slate-900/5 dark:ring-white/10 focus-within:ring-emerald-500/50 focus-within:bg-white dark:focus-within:bg-gray-900">
        <Search className="w-5 h-5 text-slate-400 dark:text-gray-400 shrink-0" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search areas (e.g. Kothrud, Gurgaon)..."
          className="bg-transparent border-none outline-none text-slate-800 dark:text-gray-100 placeholder-slate-400 dark:placeholder-gray-500 w-full ml-3 text-sm font-medium"
        />
        {query && (
          <button onClick={handleClear} className="text-slate-400 dark:text-gray-400 hover:text-slate-700 dark:hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Results Dropdown */}
      {isOpen && results.length > 0 && (
        <div className="absolute top-full left-4 right-4 mt-2 bg-white/95 dark:bg-gray-900/90 backdrop-blur-xl border border-slate-200 dark:border-gray-700/50 rounded-2xl shadow-xl dark:shadow-2xl overflow-hidden divide-y divide-slate-100 dark:divide-gray-800/50">
          {results.map((place) => (
            <button
              key={place.place_id}
              onClick={() => handleSelect(place)}
              className="w-full text-left px-5 py-4 flex items-start space-x-3 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors group"
            >
              <MapPin className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5 group-hover:text-emerald-400" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800 dark:text-gray-100 truncate">{place.display_name.split(',')[0]}</p>
                <p className="text-xs text-slate-500 dark:text-gray-400 truncate mt-0.5">{place.display_name}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

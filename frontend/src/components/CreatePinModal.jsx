import { useState } from 'react';
import { X, MapPin, Home, Search } from 'lucide-react';
import { useMapStore } from '../stores/mapStore';
import { createFlatPin, createSeekerPin } from '../lib/api';

/**
 * CreatePinModal — Accepts coordinates from map tap (pin mode).
 * Props:
 *   coords: { lng, lat } — from map click
 *   initialTab: 'flat' | 'seeker'
 *   onClose: () => void
 */
export default function CreatePinModal({ onClose, initialTab = 'flat', coords }) {
  const [tab, setTab] = useState(initialTab);
  const { citySlug, center } = useMapStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Use coords from map click, or fall back to map center
  const pinLat = coords?.lat ?? center.lat;
  const pinLng = coords?.lng ?? center.lng;

  // Flat form state
  const [flatForm, setFlatForm] = useState({
    rent: '',
    bhk_config: '2',
    property_type: 'gated',
    furnishing: 'SEMI_FURNISHED',
    society: '',
    description: ''
  });

  // Seeker form state
  const [seekerForm, setSeekerForm] = useState({
    budget_max: '',
    search_radius_km: '2.5',
    bhk_configs: ['1', '2'],
    notes: ''
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (tab === 'flat') {
        if (!flatForm.rent) throw new Error('Rent amount is required');
        await createFlatPin({
          city: citySlug,
          lat: pinLat,
          lng: pinLng,
          rent: parseFloat(flatForm.rent),
          bhk_config: flatForm.bhk_config + 'BHK',
          property_type: flatForm.property_type === 'gated' ? 'APARTMENT' : 'INDEPENDENT',
          furnishing: flatForm.furnishing,
          description: flatForm.description || undefined
        });
      } else {
        if (!seekerForm.budget_max) throw new Error('Budget is required');
        await createSeekerPin({
          city: citySlug,
          lat: pinLat,
          lng: pinLng,
          budget_max: parseFloat(seekerForm.budget_max),
          search_radius_km: parseFloat(seekerForm.search_radius_km),
          bhk_configs: seekerForm.bhk_configs.map(b => b + 'BHK'),
          property_types: ['APARTMENT'],
          furnishing_min: 'SEMI_FURNISHED',
          notes: seekerForm.notes || undefined
        });
      }
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to create pin');
    } finally {
      setLoading(false);
    }
  };

  const ff = (field, val) => setFlatForm(p => ({ ...p, [field]: val }));
  const sf = (field, val) => setSeekerForm(p => ({ ...p, [field]: val }));

  const chipClass = (isActive, accentClass) =>
    isActive
      ? accentClass
      : 'bg-slate-100 dark:bg-[#0d0d1a] border border-slate-200 dark:border-white/10 text-slate-500 dark:text-white/50 hover:border-slate-300 dark:hover:border-white/25';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 theme-backdrop backdrop-blur-sm" />

      <div
        className="relative w-full max-w-[400px] max-h-[85vh] overflow-y-auto bg-white dark:bg-[#161625] rounded-t-2xl sm:rounded-2xl border border-slate-200 dark:border-white/8 shadow-2xl p-6 animate-slide-up"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-slate-800 dark:text-white text-[15px] font-semibold">
            {tab === 'flat' ? '🏠 List your flat' : '🔍 Post requirement'}
          </h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-slate-100 dark:bg-white/6 text-slate-400 dark:text-white/50 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-white/12 flex items-center justify-center transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-5">
          <button
            onClick={() => setTab('flat')}
            className={`flex-1 py-2 rounded-xl text-[13px] font-medium transition-all ${
              tab === 'flat'
                ? 'bg-emerald-500/15 border border-emerald-500/40 text-emerald-600 dark:text-emerald-400'
                : 'bg-slate-100 dark:bg-white/4 border border-slate-200 dark:border-white/8 text-slate-500 dark:text-white/40 hover:text-slate-700 dark:hover:text-white/70'
            }`}
          >
            <Home className="w-3.5 h-3.5 inline mr-1.5" />
            List Flat
          </button>
          <button
            onClick={() => setTab('seeker')}
            className={`flex-1 py-2 rounded-xl text-[13px] font-medium transition-all ${
              tab === 'seeker'
                ? 'bg-indigo-500/15 border border-indigo-500/40 text-indigo-600 dark:text-indigo-400'
                : 'bg-slate-100 dark:bg-white/4 border border-slate-200 dark:border-white/8 text-slate-500 dark:text-white/40 hover:text-slate-700 dark:hover:text-white/70'
            }`}
          >
            <Search className="w-3.5 h-3.5 inline mr-1.5" />
            Seeker
          </button>
        </div>

        {/* Location indicator */}
        <div className="flex items-center gap-2 text-slate-400 dark:text-white/40 text-xs mb-5 px-1">
          <MapPin className="w-3 h-3 shrink-0" />
          <span>Pin at {pinLat.toFixed(4)}, {pinLng.toFixed(4)}</span>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl text-red-600 dark:text-red-400 text-[13px]">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {tab === 'flat' ? (
            <div className="space-y-4">
              {/* BHK */}
              <FieldGroup label="BHK">
                <div className="flex gap-2">
                  {['1', '2', '3', '4'].map(bhk => (
                    <button
                      key={bhk}
                      type="button"
                      onClick={() => ff('bhk_config', bhk)}
                      className={`w-12 h-10 rounded-xl text-[14px] font-semibold transition-all ${
                        flatForm.bhk_config === bhk
                          ? 'bg-emerald-500 border-emerald-500 text-white'
                          : chipClass(false)
                      }`}
                    >
                      {bhk}
                    </button>
                  ))}
                </div>
              </FieldGroup>

              {/* Rent */}
              <FieldGroup label="Monthly Rent" required>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-white/30 text-sm pointer-events-none">₹</span>
                  <input
                    type="number"
                    required
                    placeholder="25000"
                    value={flatForm.rent}
                    onChange={e => ff('rent', e.target.value)}
                    className="form-input pl-7"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-white/30 text-xs pointer-events-none">/ month</span>
                </div>
              </FieldGroup>

              {/* Type */}
              <FieldGroup label="Type">
                <div className="flex gap-2">
                  {[['gated', 'Gated Society'], ['independent', 'Independent']].map(([val, label]) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => ff('property_type', val)}
                      className={`flex-1 py-2.5 rounded-xl text-[13px] font-medium transition-all ${
                        flatForm.property_type === val
                          ? 'bg-emerald-500 border-emerald-500 text-white'
                          : chipClass(false)
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </FieldGroup>

              {/* Furnishing */}
              <FieldGroup label="Furnishing">
                <div className="flex gap-2">
                  {[['UNFURNISHED', 'None'], ['SEMI_FURNISHED', 'Semi'], ['FULLY_FURNISHED', 'Full']].map(([val, label]) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => ff('furnishing', val)}
                      className={`flex-1 py-2.5 rounded-xl text-[13px] font-medium transition-all ${
                        flatForm.furnishing === val
                          ? 'bg-emerald-500 border-emerald-500 text-white'
                          : chipClass(false)
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </FieldGroup>

              {/* Society */}
              <FieldGroup label="Society / Locality">
                <input
                  type="text"
                  placeholder="e.g. Amanora Park Town"
                  value={flatForm.society}
                  onChange={e => ff('society', e.target.value)}
                  className="form-input"
                />
              </FieldGroup>

              {/* Description */}
              <FieldGroup label="Comment (optional)">
                <textarea
                  placeholder="Any details — parking, water, maintenance..."
                  value={flatForm.description}
                  onChange={e => ff('description', e.target.value)}
                  className="form-input resize-none h-20"
                  rows={3}
                />
              </FieldGroup>
            </div>
          ) : (
            <div className="space-y-4">
              {/* BHK multi-select */}
              <FieldGroup label="BHK (select all that apply)">
                <div className="flex gap-2">
                  {['1', '2', '3', '4'].map(bhk => {
                    const isActive = seekerForm.bhk_configs.includes(bhk);
                    return (
                      <button
                        key={bhk}
                        type="button"
                        onClick={() => {
                          const next = isActive
                            ? seekerForm.bhk_configs.filter(b => b !== bhk)
                            : [...seekerForm.bhk_configs, bhk];
                          sf('bhk_configs', next);
                        }}
                        className={`w-12 h-10 rounded-xl text-[14px] font-semibold transition-all ${
                          isActive
                            ? 'bg-indigo-500 border-indigo-500 text-white'
                            : chipClass(false)
                        }`}
                      >
                        {bhk}
                      </button>
                    );
                  })}
                </div>
              </FieldGroup>

              {/* Max Budget */}
              <FieldGroup label="Max Budget" required>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-white/30 text-sm pointer-events-none">₹</span>
                  <input
                    type="number"
                    required
                    placeholder="30000"
                    value={seekerForm.budget_max}
                    onChange={e => sf('budget_max', e.target.value)}
                    className="form-input pl-7"
                  />
                </div>
              </FieldGroup>

              {/* Notes */}
              <FieldGroup label="Additional Notes">
                <textarea
                  placeholder="Preferences — pet friendly, near metro..."
                  value={seekerForm.notes}
                  onChange={e => sf('notes', e.target.value)}
                  className="form-input resize-none h-20"
                  rows={3}
                />
              </FieldGroup>
            </div>
          )}

          {/* Submit */}
          <div className="mt-6 flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 py-3 rounded-xl text-[13px] font-medium bg-transparent border border-slate-200 dark:border-white/10 text-slate-500 dark:text-white/50 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className={`flex-1 py-3 rounded-xl text-[14px] font-semibold text-white transition-all ${
                tab === 'flat'
                  ? 'bg-emerald-500 hover:bg-emerald-400'
                  : 'bg-indigo-500 hover:bg-indigo-400'
              } ${loading ? 'opacity-40 cursor-not-allowed' : ''}`}
            >
              {loading ? 'Posting...' : tab === 'flat' ? 'Post Flat' : 'Post Requirement'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function FieldGroup({ label, required, children }) {
  return (
    <div>
      <label className="text-slate-500 dark:text-white/50 text-[12px] mb-2 block">
        {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

import { create } from 'zustand';
import { fetchFlatPins, fetchSeekerPins, fetchHeatmapAggregate } from '../lib/api';

/**
 * Pins data store — handles fetching and caching pin data.
 */
export const usePinsStore = create((set, get) => ({
  // Pin data arrays
  flatPins: [],
  seekerPins: [],
  heatmapCells: [],

  // Active Filters (expanded with new parameters)
  filters: {
    minRent: 0,
    maxRent: 200000,
    bhk: [], // e.g. ['1BHK', '2BHK']
    furnishing: [], // e.g. ['FURNISHED', 'SEMI_FURNISHED']
    propertyType: [], // e.g. ['APARTMENT', 'PG']
    parking: [], // e.g. ['TWO_WHEELER', 'FOUR_WHEELER']
    locality: '', // free-text search against description
    waterSupply: [], // e.g. ['MUNICIPAL', 'BOREWELL']
    powerBackup: [], // e.g. ['INVERTER', 'FULL_DG']
  },

  setFilters: (newFilters) => set((state) => ({ filters: { ...state.filters, ...newFilters } })),

  getFilteredFlats: () => {
    const { flatPins, filters } = get();
    return flatPins.filter(pin => {
      // Rent range
      if (pin.rent < filters.minRent || pin.rent > filters.maxRent) return false;

      // BHK
      if (filters.bhk.length > 0 && !filters.bhk.includes(pin.bhk_config)) return false;

      // Furnishing
      if (filters.furnishing.length > 0 && !filters.furnishing.includes(pin.furnishing)) return false;

      // Property Type
      if (filters.propertyType.length > 0 && !filters.propertyType.includes(pin.property_type)) return false;

      // Parking — if filter includes specific types, the pin must match one of them
      // 'BOTH' in the pin satisfies either TWO_WHEELER or FOUR_WHEELER filter
      if (filters.parking.length > 0) {
        const pinParking = pin.parking || 'NONE';
        if (pinParking === 'NONE') return false;
        const matches = filters.parking.some(f => {
          if (f === pinParking) return true;
          if (pinParking === 'BOTH') return true; // BOTH satisfies any parking filter
          return false;
        });
        if (!matches) return false;
      }

      // Locality — case-insensitive match against description
      if (filters.locality && filters.locality.trim()) {
        const needle = filters.locality.trim().toLowerCase();
        const haystack = (pin.description || '').toLowerCase();
        if (!haystack.includes(needle)) return false;
      }

      // Water Supply
      if (filters.waterSupply.length > 0 && !filters.waterSupply.includes(pin.water_supply)) return false;

      // Power Backup
      if (filters.powerBackup.length > 0 && !filters.powerBackup.includes(pin.power_backup)) return false;

      return true;
    });
  },

  // Loading states
  loading: {
    flats: false,
    seekers: false,
    heatmap: false,
  },

  // Error states
  errors: {
    flats: null,
    seekers: null,
    heatmap: null,
  },

  // Meta (count, etc.)
  meta: {
    flats: null,
    seekers: null,
    heatmap: null,
  },

  // Fetch flat pins for current viewport
  fetchFlats: async (citySlug, bbox) => {
    set((s) => ({ loading: { ...s.loading, flats: true }, errors: { ...s.errors, flats: null } }));
    try {
      const res = await fetchFlatPins(citySlug, bbox);
      set({ flatPins: res.data || [], meta: { ...get().meta, flats: res.meta }, loading: { ...get().loading, flats: false } });
    } catch (err) {
      set((s) => ({ loading: { ...s.loading, flats: false }, errors: { ...s.errors, flats: err.message } }));
    }
  },

  // Fetch seeker pins for current viewport
  fetchSeekers: async (citySlug, bbox) => {
    set((s) => ({ loading: { ...s.loading, seekers: true }, errors: { ...s.errors, seekers: null } }));
    try {
      const res = await fetchSeekerPins(citySlug, bbox);
      set({ seekerPins: res.data || [], meta: { ...get().meta, seekers: res.meta }, loading: { ...get().loading, seekers: false } });
    } catch (err) {
      set((s) => ({ loading: { ...s.loading, seekers: false }, errors: { ...s.errors, seekers: err.message } }));
    }
  },

  // Fetch heatmap data for current viewport
  fetchHeatmap: async (citySlug, bbox) => {
    set((s) => ({ loading: { ...s.loading, heatmap: true }, errors: { ...s.errors, heatmap: null } }));
    try {
      const res = await fetchHeatmapAggregate(citySlug, bbox);
      set({ heatmapCells: res.data || [], meta: { ...get().meta, heatmap: res.meta }, loading: { ...get().loading, heatmap: false } });
    } catch (err) {
      set((s) => ({ loading: { ...s.loading, heatmap: false }, errors: { ...s.errors, heatmap: err.message } }));
    }
  },

  // Clear all pins
  clearPins: () => set({ flatPins: [], seekerPins: [], heatmapCells: [] }),
}));

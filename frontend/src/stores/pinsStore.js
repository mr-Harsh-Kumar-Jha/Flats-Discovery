import { create } from 'zustand';
import { fetchFlatPins, fetchSeekerPins, fetchHeatmapAggregate, fetchSocieties, fetchFlatmates } from '../lib/api';

/**
 * Pins data store — handles fetching and caching pin data, societies, and flatmates.
 */
export const usePinsStore = create((set, get) => ({
  // Pin data arrays
  flatPins: [],
  seekerPins: [],
  heatmapCells: [],
  societies: [],
  flatmates: [],

  // Active Filters (expanded with flat-finder and commute parameters)
  filters: {
    mode: 'rent', // 'rent' (default) | 'buy'
    minRent: 0,
    maxRent: 350000,
    minPrice: 0,
    maxPrice: 150000000, // For buy mode
    bhk: [], // e.g. ['1BHK', '2BHK']
    furnishing: [], // e.g. ['FURNISHED', 'SEMI_FURNISHED']
    propertyType: [], // e.g. ['APARTMENT', 'PG']
    parking: [], // e.g. ['TWO_WHEELER', 'FOUR_WHEELER']
    locality: '', // free-text search against description/name
    waterSupply: [], // e.g. ['MUNICIPAL', 'BOREWELL']
    powerBackup: [], // e.g. ['INVERTER', 'FULL_DG']
    nearMetro: '', // dynamic transit line
    officeCommute: '', // dynamic tech hub
    minBedroomDim: '', // '', '10x11', '11x12', '12x14'
    minSqft: 0,
  },

  setFilters: (newFilters) => set((state) => ({ filters: { ...state.filters, ...newFilters } })),

  getFilteredFlats: () => {
    const { flatPins, filters } = get();
    return flatPins.filter(pin => {
      // In Buy mode: ONLY show properties that are actually for sale
      if (filters.mode === 'buy') {
        if (!pin.is_for_sale && !pin.sale_price) return false;
        const effectivePrice = pin.sale_price || (pin.rent ? pin.rent * 320 : 6800000);
        if (effectivePrice < filters.minPrice || effectivePrice > filters.maxPrice) return false;
      } else {
        // Rent mode: filter by rent range and hide sale-only properties
        if (pin.is_for_sale && !pin.rent) return false;
        if (pin.rent < filters.minRent || pin.rent > filters.maxRent) return false;
      }

      // BHK
      if (filters.bhk.length > 0 && !filters.bhk.includes(pin.bhk_config)) return false;

      // Furnishing
      if (filters.furnishing.length > 0 && !filters.furnishing.includes(pin.furnishing)) return false;

      // Property Type
      if (filters.propertyType.length > 0 && !filters.propertyType.includes(pin.property_type)) return false;

      // Parking
      if (filters.parking.length > 0) {
        const pinParking = pin.parking || 'NONE';
        if (pinParking === 'NONE') return false;
        const matches = filters.parking.some(f => {
          if (f === pinParking) return true;
          if (pinParking === 'BOTH') return true;
          return false;
        });
        if (!matches) return false;
      }

      // Locality / free-text match
      if (filters.locality && filters.locality.trim()) {
        const needle = filters.locality.trim().toLowerCase();
        const haystack = `${pin.description || ''} ${pin.locality || ''} ${pin.address || ''} ${pin.society_name || ''}`.toLowerCase();
        if (!haystack.includes(needle)) return false;
      }

      // Water Supply
      if (filters.waterSupply.length > 0 && !filters.waterSupply.includes(pin.water_supply)) return false;

      // Power Backup
      if (filters.powerBackup.length > 0 && !filters.powerBackup.includes(pin.power_backup)) return false;

      return true;
    });
  },

  getFilteredSocieties: () => {
    const { societies, filters } = get();
    return societies.filter(soc => {
      // Filter by Rent or Buy Price
      if (filters.mode === 'rent') {
        if (soc.min_rent > filters.maxRent) return false;
      } else {
        if (soc.min_price > filters.maxPrice) return false;
      }

      // Filter by Metro / Transit line
      if (filters.nearMetro) {
        if (!soc.metro_line) return false;
        const needle = filters.nearMetro.toLowerCase().replace(/[^a-z0-9]/g, '');
        const haystack = soc.metro_line.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (!haystack.includes(needle) && !needle.includes(haystack)) return false;
      }

      // Filter by Office Commute
      if (filters.officeCommute && soc.office_commute) {
        const mins = soc.office_commute[filters.officeCommute];
        if (mins && mins > 30) return false; // within 30 min commute
      }

      // Filter by Locality
      if (filters.locality && filters.locality.trim()) {
        const needle = filters.locality.trim().toLowerCase();
        const matches = soc.name.toLowerCase().includes(needle) || soc.locality.toLowerCase().includes(needle);
        if (!matches) return false;
      }

      // Filter by Sqft
      if (filters.minSqft > 0 && soc.max_sqft < filters.minSqft) {
        return false;
      }

      return true;
    });
  },

  // Loading states
  loading: {
    flats: false,
    seekers: false,
    heatmap: false,
    societies: false,
    flatmates: false,
  },

  // Error states
  errors: {
    flats: null,
    seekers: null,
    heatmap: null,
    societies: null,
    flatmates: null,
  },

  // Meta (count, etc.)
  meta: {
    flats: null,
    seekers: null,
    heatmap: null,
    societies: null,
    flatmates: null,
  },

  // Fetch flat pins for current viewport or city-wide
  fetchFlats: async (citySlug, bbox) => {
    set((s) => ({ loading: { ...s.loading, flats: true }, errors: { ...s.errors, flats: null } }));
    try {
      const res = await fetchFlatPins(citySlug, bbox);
      set({ flatPins: res.data || [], meta: { ...get().meta, flats: res.meta }, loading: { ...get().loading, flats: false } });
    } catch (err) {
      set((s) => ({ loading: { ...s.loading, flats: false }, errors: { ...s.errors, flats: err.message } }));
    }
  },
  fetchFlatPins: async (citySlug, bbox) => get().fetchFlats(citySlug, bbox),

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
  fetchSeekerPins: async (citySlug, bbox) => get().fetchSeekers(citySlug, bbox),

  // Master refresh for city (fetches both societies and flats together)
  refreshCityData: async (citySlug = 'pune') => {
    await Promise.all([
      get().fetchSocieties(citySlug),
      get().fetchFlats(citySlug)
    ]);
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

  // Fetch Housing Societies (Flat-Finder Architecture)
  fetchSocieties: async (citySlug = 'pune') => {
    set((s) => ({ loading: { ...s.loading, societies: true }, errors: { ...s.errors, societies: null } }));
    try {
      const res = await fetchSocieties(citySlug, get().filters);
      set({ societies: res.data || [], meta: { ...get().meta, societies: res.meta }, loading: { ...get().loading, societies: false } });
    } catch (err) {
      set((s) => ({ loading: { ...s.loading, societies: false }, errors: { ...s.errors, societies: err.message } }));
    }
  },

  // Fetch Flatmates for Tinder-style Deck
  fetchFlatmates: async (citySlug = 'pune', customFilters = {}) => {
    set((s) => ({ loading: { ...s.loading, flatmates: true }, errors: { ...s.errors, flatmates: null } }));
    try {
      const res = await fetchFlatmates(citySlug, customFilters);
      set({ flatmates: res.data || [], meta: { ...get().meta, flatmates: res.meta }, loading: { ...get().loading, flatmates: false } });
    } catch (err) {
      set((s) => ({ loading: { ...s.loading, flatmates: false }, errors: { ...s.errors, flatmates: err.message } }));
    }
  },

  // Clear all pins
  clearPins: () => set({ flatPins: [], seekerPins: [], heatmapCells: [] }),
}));

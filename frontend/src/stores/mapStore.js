import { create } from 'zustand';

// Target Indian Metros Configuration
export const CITIES_CONFIG = {
  pune: {
    name: 'Pune',
    slug: 'pune',
    state: 'Maharashtra',
    center: { lng: 73.8567, lat: 18.5204 },
    zoom: 13.5,
    tagline: 'Pune Flatmates & Real Estate',
    hubs: [
      { key: 'hinjewadi', label: 'Hinjewadi Tech Zone' },
      { key: 'magarpatta', label: 'Magarpatta Cybercity' },
      { key: 'kharadi', label: 'EON Kharadi IT' },
      { key: 'baner', label: 'Baner High St' },
    ],
    metro_lines: [
      { key: 'Purple Line', label: '🟣 Purple Line' },
      { key: 'Aqua Line', label: '🔵 Aqua Line' },
      { key: 'Line 3', label: '🔴 Line 3' },
    ],
    localities: ['Hinjewadi', 'Baner', 'Wakad', 'Kothrud', 'Viman Nagar', 'Kharadi', 'Hadapsar', 'Magarpatta', 'Aundh', 'Kalyani Nagar', 'Bavdhan', 'Pimpri'],
    commuteCoords: {
      'Hinjewadi': { lat: 18.5913, lng: 73.7389 },
      'Baner': { lat: 18.5590, lng: 73.7868 },
      'Wakad': { lat: 18.5987, lng: 73.7684 },
      'Kothrud': { lat: 18.5074, lng: 73.8077 },
      'Viman Nagar': { lat: 18.5679, lng: 73.9143 },
      'Kharadi': { lat: 18.5514, lng: 73.9352 },
      'Hadapsar': { lat: 18.5089, lng: 73.9259 },
      'Magarpatta': { lat: 18.5158, lng: 73.9272 },
    }
  },
  mumbai: {
    name: 'Mumbai',
    slug: 'mumbai',
    state: 'Maharashtra',
    center: { lng: 72.8777, lat: 19.0760 },
    zoom: 12.0,
    tagline: 'Mumbai Flats, BKC & Powai',
    hubs: [
      { key: 'bkc', label: 'BKC Financial Center' },
      { key: 'powai', label: 'Powai Hiranandani' },
      { key: 'andheri_east', label: 'Andheri MIDC' },
      { key: 'lower_parel', label: 'Lower Parel Corp' },
    ],
    metro_lines: [
      { key: 'Line 1', label: '🔵 Line 1 (Versova)' },
      { key: 'Line 2A', label: '🟡 Line 2A' },
      { key: 'Line 7', label: '🔴 Line 7' },
      { key: 'Aqua Line', label: '🌊 Aqua Line 3' },
      { key: 'Monorail', label: '🚝 Monorail' },
    ],
    localities: ['BKC', 'Lower Parel', 'Andheri East', 'Powai', 'Goregaon East', 'Bandra West', 'Dadar', 'Worli', 'Chembur', 'Malad West', 'Vikhroli East'],
    commuteCoords: {
      'BKC': { lat: 19.0657, lng: 72.8687 },
      'Lower Parel': { lat: 18.9950, lng: 72.8300 },
      'Andheri East': { lat: 19.1190, lng: 72.8680 },
      'Powai': { lat: 19.1176, lng: 72.9060 },
      'Goregaon East': { lat: 19.1680, lng: 72.8580 },
      'Bandra West': { lat: 19.0550, lng: 72.8300 },
      'Chembur': { lat: 19.0620, lng: 72.8990 },
      'Vikhroli East': { lat: 19.1020, lng: 72.9280 },
    }
  },
  gurgaon: {
    name: 'Gurgaon',
    slug: 'gurgaon',
    state: 'Haryana',
    center: { lng: 77.0266, lat: 28.4595 },
    zoom: 12.2,
    tagline: 'Gurugram Cyber City & Golf Course Rd',
    hubs: [
      { key: 'cyber_city', label: 'DLF Cyber City' },
      { key: 'golf_course_rd', label: 'Golf Course One Horizon' },
      { key: 'sohna_road', label: 'Sohna Road Tech' },
      { key: 'udyog_vihar', label: 'Udyog Vihar' },
    ],
    metro_lines: [
      { key: 'Rapid Metro', label: '⚡ Rapid Metro' },
      { key: 'Yellow Line', label: '🟡 Yellow Line' },
    ],
    localities: ['Cyber City', 'Golf Course Road', 'Sector 54', 'Sector 56', 'MG Road', 'Sohna Road', 'DLF Phase 1-5', 'Sector 29', 'Udyog Vihar'],
    commuteCoords: {
      'Cyber City': { lat: 28.4950, lng: 77.0895 },
      'Golf Course Road': { lat: 28.4540, lng: 77.1020 },
      'Sector 54': { lat: 28.4410, lng: 77.1040 },
      'Sector 56': { lat: 28.4280, lng: 77.1110 },
      'MG Road': { lat: 28.4790, lng: 77.0780 },
      'Sohna Road': { lat: 28.4120, lng: 77.0420 },
    }
  },
  noida: {
    name: 'Noida',
    slug: 'noida',
    state: 'Uttar Pradesh',
    center: { lng: 77.3910, lat: 28.5355 },
    zoom: 12.2,
    tagline: 'Noida Sector 62 & Expressway',
    hubs: [
      { key: 'sector_62', label: 'Sector 62 IT Park' },
      { key: 'sector_18', label: 'Sector 18 Hub' },
      { key: 'expressway_tech', label: 'Expressway Tech SEZ' },
      { key: 'advant_navis', label: 'Advant Navis 142' },
    ],
    metro_lines: [
      { key: 'Blue Line', label: '🔵 Blue Line' },
      { key: 'Magenta Line', label: '🟣 Magenta Line' },
      { key: 'Aqua Line', label: '💧 Aqua Line NMRC' },
    ],
    localities: ['Sector 62', 'Sector 18', 'Sector 137', 'Sector 142', 'Sector 150', 'Noida Expressway', 'Electronic City', 'Pari Chowk'],
    commuteCoords: {
      'Sector 62': { lat: 28.6180, lng: 77.3710 },
      'Sector 18': { lat: 28.5708, lng: 77.3261 },
      'Sector 137': { lat: 28.5135, lng: 77.3758 },
      'Sector 142': { lat: 28.4975, lng: 77.4172 },
      'Sector 150': { lat: 28.4520, lng: 77.4650 },
      'Electronic City': { lat: 28.6271, lng: 77.3725 },
    }
  },
};

const DEFAULT_CITY = 'pune';

/**
 * Map styles — Voyager is default (free, native transit rendering).
 * Satellite uses Esri tiles with MapTiler glyphs for text rendering.
 */
export const mapStyles = {
  transit: {
    name: 'Transit',
    url: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json'
  },
  dark: {
    name: 'Dark',
    url: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'
  },
  satellite: {
    name: 'Satellite',
    url: {
      version: 8,
      glyphs: 'https://fonts.openmaptiles.org/{fontstack}/{range}.pbf',
      sources: {
        'esri-satellite': {
          type: 'raster',
          tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
          tileSize: 256
        }
      },
      layers: [
        {
          id: 'satellite-layer',
          type: 'raster',
          source: 'esri-satellite',
          minzoom: 0,
          maxzoom: 22
        }
      ]
    }
  }
};

/**
 * Map state store — viewport, active layers, selected pin, pin mode, 3D view.
 */
export const useMapStore = create((set, get) => ({
  // Viewport
  center: CITIES_CONFIG[DEFAULT_CITY].center,
  zoom: CITIES_CONFIG[DEFAULT_CITY].zoom,
  bounds: null,

  // 3D View (Flat-Finder Pitch & Extrusion mode)
  is3D: false,

  // Active city
  citySlug: DEFAULT_CITY,
  cityId: null,

  // Basemap style — default to Voyager for native transit
  mapStyle: mapStyles.transit.url,

  // Layer visibility — only data layers we control
  layers: {
    flats: true,
    seekers: false,
    heatmap: false,
    transit: true,
  },

  // Map instance reference for direct manipulation (flyTo, easeTo)
  mapInstance: null,

  // View mode tab ('flats' | 'societies') — keeps map markers and sidebar in sync
  viewTab: 'flats',
  setViewTab: (viewTab) => set({ viewTab }),

  // Mobile View state ('map' | 'list')
  mobileView: 'map',
  setMobileView: (mobileView) => set({ mobileView }),
  toggleMobileView: () => set((state) => ({ mobileView: state.mobileView === 'map' ? 'list' : 'map' })),

  // Sidebar
  sidebarOpen: true,

  // Currently selected pin for popup/detail
  selectedPin: null, // { type: 'flat'|'seeker'|'society', data: PinObject }

  // Pin placement mode: null | 'rent' | 'flat' | 'seeker'
  pinMode: null,
  pendingPinCoords: null, // { lng, lat }

  // Actions
  setCenter: (center) => set({ center }),
  setZoom: (zoom) => set({ zoom }),
  setBounds: (bounds) => set({ bounds }),

  switchCity: (citySlug) => {
    const city = CITIES_CONFIG[citySlug];
    if (!city) return;
    set({
      citySlug,
      center: city.center,
      zoom: city.zoom,
    });
    const map = get().mapInstance;
    if (map) {
      map.flyTo({
        center: [city.center.lng, city.center.lat],
        zoom: city.zoom,
        speed: 1.4,
        curve: 1.2,
      });
    }
  },

  toggle3D: () => {
    const next3D = !get().is3D;
    set({ is3D: next3D });
    const map = get().mapInstance;
    if (map) {
      if (next3D) {
        map.easeTo({ pitch: 58, bearing: -18, duration: 1000 });
      } else {
        map.easeTo({ pitch: 0, bearing: 0, duration: 800 });
      }
    }
  },

  setMapStyle: (mapStyle) => set({ mapStyle }),

  toggleLayer: (layerName) => set((state) => ({
    layers: { ...state.layers, [layerName]: !state.layers[layerName] }
  })),

  setMapInstance: (mapInstance) => set({ mapInstance }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSelectedPin: (selectedPin) => set({ selectedPin }),
  setPinMode: (mode) => set({ pinMode: mode }),
  setPendingPinCoords: (coords) => set({ pendingPinCoords: coords }),
}));

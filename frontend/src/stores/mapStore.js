import { create } from 'zustand';

// Pune city center as default viewport
const PUNE_CENTER = { lng: 73.8567, lat: 18.5204 };
const DEFAULT_ZOOM = 13.5;

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
 * Map state store — viewport, active layers, selected pin, pin mode.
 */
export const useMapStore = create((set, get) => ({
  // Viewport
  center: PUNE_CENTER,
  zoom: DEFAULT_ZOOM,
  bounds: null,

  // Active city
  citySlug: 'pune',
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

  // Map instance reference for direct manipulation (flyTo)
  mapInstance: null,

  // Sidebar
  sidebarOpen: true,

  // Currently selected pin for popup/detail
  selectedPin: null, // { type: 'flat'|'seeker', data: PinObject }

  // Pin placement mode: null | 'rent' | 'flat' | 'seeker'
  pinMode: null,
  pendingPinCoords: null, // { lng, lat } — set when user taps map in pin mode

  // Actions
  setCenter: (center) => set({ center }),
  setZoom: (zoom) => set({ zoom }),
  setBounds: (bounds) => set({ bounds }),
  setCity: (citySlug) => set({ citySlug }),
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

import { useEffect, useRef, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useMapStore } from '../stores/mapStore';
import { usePinsStore } from '../stores/pinsStore';
import { ICONS } from '../lib/icons';

function formatRent(rent) {
  if (!rent) return '0';
  if (rent >= 10000000) return (rent / 10000000).toFixed(1) + 'Cr';
  if (rent >= 100000) return (rent / 100000).toFixed(1) + 'L';
  if (rent >= 1000) return (rent / 1000).toFixed(1) + 'k';
  return rent.toString();
}

/**
 * MapView — Core map component.
 *
 * ARCHITECTURE NOTES:
 * 1. No native popups — pin clicks set selectedPin in the store,
 *    and App.jsx renders PinDetailModal as a React component.
 * 2. updateFlatsSource / updateSeekersSource read from store via
 *    getState() to avoid stale closure issues inside event handlers.
 * 3. style.load is the ONLY event where we re-add layers + sources.
 *    The 'load' event is NOT used because style.load fires on initial
 *    load too, and using both causes double-initialization.
 */
export default function MapView() {
  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const fetchTimerRef = useRef(null);

  // We only destructure stable actions and reactive values we need for effects.
  const { center, zoom, layers, mapStyle, pinMode } = useMapStore();
  const { flatPins, seekerPins, loading, filters } = usePinsStore();

  // ── STABLE FUNCTIONS (read from store at call time, no stale closures) ──

  const syncFlatsToMap = useCallback(() => {
    const map = mapRef.current;
    if (!map || !map.getSource('flats-source')) return;

    const { layers: currentLayers } = useMapStore.getState();
    if (!currentLayers.flats) {
      map.getSource('flats-source').setData({ type: 'FeatureCollection', features: [] });
      return;
    }

    const displayFlats = usePinsStore.getState().getFilteredFlats();
    const features = displayFlats.map(pin => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [pin.lng, pin.lat] },
      properties: {
        formatted_rent: formatRent(pin.rent),
        raw_data: JSON.stringify(pin)
      }
    }));
    map.getSource('flats-source').setData({ type: 'FeatureCollection', features });
  }, []);

  const syncSeekersToMap = useCallback(() => {
    const map = mapRef.current;
    if (!map || !map.getSource('seekers-source')) return;

    const { layers: currentLayers } = useMapStore.getState();
    if (!currentLayers.seekers) {
      map.getSource('seekers-source').setData({ type: 'FeatureCollection', features: [] });
      return;
    }

    const { seekerPins: pins } = usePinsStore.getState();
    const features = pins.map(pin => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [pin.lng, pin.lat] },
      properties: {
        formatted_budget: formatRent(pin.budget_max),
        raw_data: JSON.stringify(pin)
      }
    }));
    map.getSource('seekers-source').setData({ type: 'FeatureCollection', features });
  }, []);

  const fetchPinsForBBox = useCallback((bbox) => {
    const { layers: currentLayers, citySlug } = useMapStore.getState();
    const { fetchFlats, fetchSeekers, fetchHeatmap } = usePinsStore.getState();
    if (currentLayers.flats) fetchFlats(citySlug, bbox);
    if (currentLayers.seekers) fetchSeekers(citySlug, bbox);
    if (currentLayers.heatmap) fetchHeatmap(citySlug, bbox);
  }, []);

  // ── STYLE CHANGE (fires setStyle) ──
  useEffect(() => {
    if (mapRef.current && mapStyle) {
      mapRef.current.setStyle(mapStyle);
    }
  }, [mapStyle]);

  // ── MAP INITIALIZATION (runs once) ──
  useEffect(() => {
    if (mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: mapStyle,
      center: [center.lng, center.lat],
      zoom: zoom,
      minZoom: 10,
      maxZoom: 18,
      attributionControl: false,
    });

    map.addControl(new maplibregl.NavigationControl(), 'bottom-right');
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-left');

    useMapStore.getState().setMapInstance(map);

    // ── Load icon images ──
    const loadImages = () => new Promise((resolve) => {
      let loaded = 0;
      const entries = Object.entries(ICONS);
      const total = entries.length;
      if (total === 0) { resolve(); return; }

      entries.forEach(([id, dataUri]) => {
        const img = new Image();
        img.onload = () => {
          if (!map.hasImage(id + '-icon')) map.addImage(id + '-icon', img);
          if (++loaded >= total) resolve();
        };
        img.onerror = () => { if (++loaded >= total) resolve(); };
        img.src = dataUri;
      });
    });

    // ── Add sources and layers ──
    const setupLayers = () => {
      // --- Flats source (clustered) ---
      if (!map.getSource('flats-source')) {
        map.addSource('flats-source', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
          cluster: true,
          clusterMaxZoom: 14,
          clusterRadius: 50
        });

        // Cluster circles
        map.addLayer({
          id: 'flats-clusters',
          type: 'circle',
          source: 'flats-source',
          filter: ['has', 'point_count'],
          paint: {
            'circle-color': [
              'step', ['get', 'point_count'],
              '#10b981', 10, '#059669', 50, '#047857'
            ],
            'circle-radius': [
              'step', ['get', 'point_count'],
              18, 10, 24, 50, 32
            ],
            'circle-stroke-width': 3,
            'circle-stroke-color': 'rgba(16, 185, 129, 0.25)',
            'circle-opacity': 0.9
          }
        });

        // Cluster count labels
        map.addLayer({
          id: 'flats-cluster-count',
          type: 'symbol',
          source: 'flats-source',
          filter: ['has', 'point_count'],
          layout: {
            'text-field': '{point_count_abbreviated}',
            'text-size': 13,
            'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
          },
          paint: { 'text-color': '#ffffff' }
        });

        // Individual flat dots
        map.addLayer({
          id: 'flats-unclustered',
          type: 'circle',
          source: 'flats-source',
          filter: ['!', ['has', 'point_count']],
          paint: {
            'circle-color': '#10b981',
            'circle-radius': 8,
            'circle-stroke-width': 2.5,
            'circle-stroke-color': '#ffffff'
          }
        });

        // Rent labels below dots
        map.addLayer({
          id: 'flats-labels',
          type: 'symbol',
          source: 'flats-source',
          filter: ['!', ['has', 'point_count']],
          layout: {
            'text-field': '₹{formatted_rent}',
            'text-size': 11,
            'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
            'text-offset': [0, 1.6],
            'text-anchor': 'top',
            'text-allow-overlap': false,
          },
          paint: {
            'text-color': '#ffffff',
            'text-halo-color': 'rgba(0,0,0,0.7)',
            'text-halo-width': 1.5
          }
        });
      }

      // --- Seekers source ---
      if (!map.getSource('seekers-source')) {
        map.addSource('seekers-source', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] }
        });

        map.addLayer({
          id: 'seekers-unclustered',
          type: 'circle',
          source: 'seekers-source',
          paint: {
            'circle-color': '#6366f1',
            'circle-radius': 7,
            'circle-stroke-width': 2,
            'circle-stroke-color': '#ffffff'
          }
        });

        map.addLayer({
          id: 'seekers-labels',
          type: 'symbol',
          source: 'seekers-source',
          layout: {
            'text-field': '₹{formatted_budget}',
            'text-size': 11,
            'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
            'text-offset': [0, 1.4],
            'text-anchor': 'top',
            'text-allow-overlap': false,
          },
          paint: {
            'text-color': '#c7d2fe',
            'text-halo-color': 'rgba(0,0,0,0.7)',
            'text-halo-width': 1.5
          }
        });
      }

      // --- Transit source (metro + railway stations from static GeoJSON) ---
      if (!map.getSource('transit-source')) {
        map.addSource('transit-source', {
          type: 'geojson',
          data: '/transit_stops.geojson'
        });

        // Purple Line route geometry (PCMC → Swargate — connecting stations in order)
        const purpleLineCoords = [
          [73.8076, 18.6298], // PCMC
          [73.8075, 18.6218], // Sant Tukaram Nagar
          [73.8087, 18.6134], // Bhosari
          [73.8102, 18.6048], // Kasarwadi
          [73.8127, 18.5942], // Phugewadi
          [73.8168, 18.5825], // Dapodi
          [73.8282, 18.5665], // Bopodi
          [73.8361, 18.5568], // Khadki
          [73.8454, 18.5438], // Range Hills
          [73.8507, 18.5337], // Shivajinagar
          [73.8573, 18.5264], // Civil Court
          [73.8602, 18.5190], // Budhwar Peth
          [73.8586, 18.5120], // Mandai
          [73.8574, 18.5005], // Swargate
        ];

        // Aqua Line route geometry (Vanaz → Ramwadi — connecting stations in order)
        const aquaLineCoords = [
          [73.8063, 18.5091], // Vanaz
          [73.8132, 18.5092], // Anand Nagar
          [73.8220, 18.5085], // Ideal Colony
          [73.8288, 18.5073], // Nal Stop
          [73.8375, 18.5108], // Garware College
          [73.8442, 18.5164], // Deccan Gymkhana
          [73.8468, 18.5201], // Chhatrapati Sambhaji Udyan
          [73.8529, 18.5227], // PMC
          [73.8573, 18.5264], // District Court (interchange)
          [73.8653, 18.5275], // Mangalwar Peth
          [73.8744, 18.5289], // Pune Railway Station
          [73.8811, 18.5338], // Ruby Hall
          [73.8858, 18.5396], // Bund Garden
          [73.8887, 18.5453], // Yerawada
          [73.9055, 18.5445], // Kalyani Nagar
          [73.9126, 18.5570], // Ramwadi
        ];

        map.addSource('purple-line-source', {
          type: 'geojson',
          data: {
            type: 'Feature',
            geometry: { type: 'LineString', coordinates: purpleLineCoords }
          }
        });
        map.addSource('aqua-line-source', {
          type: 'geojson',
          data: {
            type: 'Feature',
            geometry: { type: 'LineString', coordinates: aquaLineCoords }
          }
        });

        // Purple Line stroke
        map.addLayer({
          id: 'purple-line',
          type: 'line',
          source: 'purple-line-source',
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: {
            'line-color': '#9333ea',
            'line-width': 3.5,
            'line-opacity': 0.7,
            'line-dasharray': [2, 1]
          }
        });

        // Aqua Line stroke
        map.addLayer({
          id: 'aqua-line',
          type: 'line',
          source: 'aqua-line-source',
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: {
            'line-color': '#06b6d4',
            'line-width': 3.5,
            'line-opacity': 0.7,
            'line-dasharray': [2, 1]
          }
        });

        // Station dots — color by route
        map.addLayer({
          id: 'transit-stations',
          type: 'circle',
          source: 'transit-source',
          filter: ['==', ['get', 'stop_type'], 'metro_station'],
          paint: {
            'circle-color': [
              'match', ['get', 'route_info'],
              'Purple Line', '#9333ea',
              'Aqua Line', '#06b6d4',
              '#94a3b8' // fallback grey
            ],
            'circle-radius': [
              'interpolate', ['linear'], ['zoom'],
              10, 3,
              13, 5,
              16, 8
            ],
            'circle-stroke-width': 2,
            'circle-stroke-color': '#ffffff',
            'circle-opacity': 0.9
          }
        });

        // Railway station dots (larger, distinct color)
        map.addLayer({
          id: 'transit-railway',
          type: 'circle',
          source: 'transit-source',
          filter: ['==', ['get', 'stop_type'], 'railway_station'],
          paint: {
            'circle-color': '#dc2626',
            'circle-radius': [
              'interpolate', ['linear'], ['zoom'],
              10, 4,
              13, 7,
              16, 10
            ],
            'circle-stroke-width': 2.5,
            'circle-stroke-color': '#ffffff',
            'circle-opacity': 0.9
          }
        });

        // Station name labels
        map.addLayer({
          id: 'transit-labels',
          type: 'symbol',
          source: 'transit-source',
          layout: {
            'text-field': ['get', 'name'],
            'text-size': [
              'interpolate', ['linear'], ['zoom'],
              11, 9,
              14, 11,
              16, 13
            ],
            'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
            'text-offset': [0, 1.4],
            'text-anchor': 'top',
            'text-allow-overlap': false,
            'text-optional': true,
          },
          paint: {
            'text-color': [
              'match', ['get', 'route_info'],
              'Purple Line', '#7c3aed',
              'Aqua Line', '#0891b2',
              '#dc2626' // railway
            ],
            'text-halo-color': '#ffffff',
            'text-halo-width': 1.5
          }
        });
      }
    };

    // ── Event handlers (only attached once) ──

    // Cluster click → zoom in
    map.on('click', 'flats-clusters', (e) => {
      const features = map.queryRenderedFeatures(e.point, { layers: ['flats-clusters'] });
      if (!features.length) return;
      const clusterId = features[0].properties.cluster_id;
      const coords = features[0].geometry.coordinates.slice();
      const source = map.getSource('flats-source');

      if (source?.getClusterExpansionZoom) {
        source.getClusterExpansionZoom(clusterId, (err, targetZoom) => {
          map.flyTo({
            center: coords,
            zoom: err ? map.getZoom() + 3 : Math.min(targetZoom + 1, 18),
            speed: 1.4,
            curve: 1.2
          });
        });
      } else {
        map.flyTo({ center: coords, zoom: map.getZoom() + 3, speed: 1.4 });
      }
    });

    // Pin click → set selectedPin in store (NO native popup — App.jsx renders PinDetailModal)
    map.on('click', 'flats-unclustered', (e) => {
      if (!e.features?.length) return;
      try {
        const pin = JSON.parse(e.features[0].properties.raw_data);
        useMapStore.getState().setSelectedPin({ type: 'flat', data: pin });
        // Fly to pin
        map.flyTo({ center: [pin.lng, pin.lat], zoom: Math.max(map.getZoom(), 15), speed: 1.2 });
      } catch (err) {
        console.warn('Failed to parse flat pin:', err);
      }
    });

    map.on('click', 'seekers-unclustered', (e) => {
      if (!e.features?.length) return;
      try {
        const pin = JSON.parse(e.features[0].properties.raw_data);
        useMapStore.getState().setSelectedPin({ type: 'seeker', data: pin });
        map.flyTo({ center: [pin.lng, pin.lat], zoom: Math.max(map.getZoom(), 15), speed: 1.2 });
      } catch (err) {
        console.warn('Failed to parse seeker pin:', err);
      }
    });

    // Pin mode click → capture coords
    map.on('click', (e) => {
      const currentPinMode = useMapStore.getState().pinMode;
      if (!currentPinMode) return;

      // Don't trigger if clicked on a feature layer
      const clickLayers = ['flats-clusters', 'flats-unclustered', 'seekers-unclustered']
        .filter(id => map.getLayer(id));
      if (clickLayers.length > 0) {
        const features = map.queryRenderedFeatures(e.point, { layers: clickLayers });
        if (features.length > 0) return;
      }

      useMapStore.getState().setPendingPinCoords({ lng: e.lngLat.lng, lat: e.lngLat.lat });
      useMapStore.getState().setPinMode(null);
    });

    // Cursor on hover
    ['flats-clusters', 'flats-unclustered', 'seekers-unclustered'].forEach(layerId => {
      map.on('mouseenter', layerId, () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', layerId, () => { map.getCanvas().style.cursor = ''; });
    });

    // ── style.load fires on BOTH initial load and setStyle ──
    // This is the ONLY place we set up sources/layers.
    map.on('style.load', async () => {
      await loadImages();
      setupLayers();
      // Re-populate data from current store state
      syncFlatsToMap();
      syncSeekersToMap();
    });

    // ── moveend → refetch pins for new viewport ──
    map.on('moveend', () => {
      const bounds = map.getBounds();
      const bbox = [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()];
      useMapStore.getState().setBounds(bbox);

      if (fetchTimerRef.current) clearTimeout(fetchTimerRef.current);
      fetchTimerRef.current = setTimeout(() => fetchPinsForBBox(bbox), 300);
    });

    // ── Initial data fetch ──
    map.once('load', () => {
      const bounds = map.getBounds();
      const bbox = [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()];
      useMapStore.getState().setBounds(bbox);
      fetchPinsForBBox(bbox);
    });

    mapRef.current = map;

    return () => {
      if (fetchTimerRef.current) clearTimeout(fetchTimerRef.current);
      map.remove();
      mapRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Sync store data → map sources when pins or filters change ──
  useEffect(() => { syncFlatsToMap(); }, [flatPins, filters, layers.flats, syncFlatsToMap]);
  useEffect(() => { syncSeekersToMap(); }, [seekerPins, layers.seekers, syncSeekersToMap]);

  // ── Refetch when layer toggles change ──
  useEffect(() => {
    const bounds = useMapStore.getState().bounds;
    if (bounds) fetchPinsForBBox(bounds);
  }, [layers.flats, layers.seekers, layers.heatmap, fetchPinsForBBox]);

  return (
    <div className="absolute inset-0">
      <div
        ref={mapContainer}
        className="w-full h-full"
        style={{ cursor: pinMode ? 'crosshair' : undefined }}
      />
      {(loading.flats || loading.seekers) && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
          <div className="glass rounded-full px-4 py-2 flex items-center gap-2 text-xs text-slate-500 dark:text-white/60">
            <div className="w-2.5 h-2.5 border-2 border-emerald-500/30 border-t-emerald-400 rounded-full animate-spin" />
            Loading...
          </div>
        </div>
      )}
    </div>
  );
}

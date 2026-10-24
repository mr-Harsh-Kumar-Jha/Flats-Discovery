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

const TRANSIT_LAYER_IDS = [
  'transit-railway-casing',
  'transit-railway-line',
  'transit-bus-corridors',
  'transit-airport-feeder',
  'transit-airport-runway',
  'transit-purple-line-glow',
  'transit-purple-line',
  'transit-aqua-line-glow',
  'transit-aqua-line',
  'transit-metro-stations',
  'transit-railway-stations',
  'transit-airport-marker',
  'transit-bus-stands',
  'transit-labels'
];

/**
 * MapView — Core interactive MapLibre map component.
 * Supports light, dark, and satellite basemap switching with complete layer preservation.
 */
export default function MapView() {
  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const fetchTimerRef = useRef(null);
  const activePopupRef = useRef(null);

  const { center, zoom, layers, mapStyle, pinMode } = useMapStore();
  const { flatPins, seekerPins, loading, filters } = usePinsStore();

  // ── Sync Flats to Map ──
  const syncFlatsToMap = useCallback(() => {
    const map = mapRef.current;
    if (!map || !map.getSource('flats-source')) return;

    const { layers: currentLayers } = useMapStore.getState();
    if (!currentLayers.flats) {
      map.getSource('flats-source').setData({ type: 'FeatureCollection', features: [] });
      return;
    }

    const displayFlats = usePinsStore.getState().getFilteredFlats();
    const features = displayFlats.map((pin) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [pin.lng, pin.lat] },
      properties: {
        formatted_rent: formatRent(pin.rent),
        raw_data: JSON.stringify(pin),
      },
    }));
    map.getSource('flats-source').setData({ type: 'FeatureCollection', features });
  }, []);

  // ── Sync Seekers to Map ──
  const syncSeekersToMap = useCallback(() => {
    const map = mapRef.current;
    if (!map || !map.getSource('seekers-source')) return;

    const { layers: currentLayers } = useMapStore.getState();
    if (!currentLayers.seekers) {
      map.getSource('seekers-source').setData({ type: 'FeatureCollection', features: [] });
      return;
    }

    const { seekerPins: pins } = usePinsStore.getState();
    const features = pins.map((pin) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [pin.lng, pin.lat] },
      properties: {
        formatted_budget: formatRent(pin.budget_max),
        raw_data: JSON.stringify(pin),
      },
    }));
    map.getSource('seekers-source').setData({ type: 'FeatureCollection', features });
  }, []);

  // ── Sync Layer Visibility ──
  const syncLayerVisibility = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;

    const { layers: currentLayers } = useMapStore.getState();

    // Transit layers
    const transitVis = currentLayers.transit ? 'visible' : 'none';
    TRANSIT_LAYER_IDS.forEach((id) => {
      if (map.getLayer(id)) {
        map.setLayoutProperty(id, 'visibility', transitVis);
      }
    });

    // Flats layers
    const flatsVis = currentLayers.flats ? 'visible' : 'none';
    ['flats-clusters', 'flats-cluster-count', 'flats-unclustered', 'flats-labels'].forEach((id) => {
      if (map.getLayer(id)) {
        map.setLayoutProperty(id, 'visibility', flatsVis);
      }
    });

    // Seekers layers
    const seekersVis = currentLayers.seekers ? 'visible' : 'none';
    ['seekers-unclustered', 'seekers-labels'].forEach((id) => {
      if (map.getLayer(id)) {
        map.setLayoutProperty(id, 'visibility', seekersVis);
      }
    });
  }, []);

  // ── Fetch pins for BBox with smart area clamping ──
  const fetchPinsForBBox = useCallback((bbox) => {
    const { layers: currentLayers, citySlug } = useMapStore.getState();
    const { fetchFlats, fetchSeekers, fetchHeatmap } = usePinsStore.getState();

    const [swLng, swLat, neLng, neLat] = bbox;
    const toRad = (d) => (d * Math.PI) / 180;
    const widthKm = Math.abs(neLng - swLng) * 111.32 * Math.cos(toRad((swLat + neLat) / 2));
    const heightKm = Math.abs(neLat - swLat) * 110.574;
    const areaKm2 = widthKm * heightKm;

    // If viewport exceeds 185 km², clamp query window to ~168 km² around map center
    // so API never returns 400 and listings remain visible
    let queryBBox = bbox;
    if (areaKm2 > 185) {
      const cLng = (swLng + neLng) / 2;
      const cLat = (swLat + neLat) / 2;
      queryBBox = [cLng - 0.075, cLat - 0.055, cLng + 0.075, cLat + 0.055];
    }

    if (currentLayers.flats) fetchFlats(citySlug, queryBBox);
    if (currentLayers.seekers) fetchSeekers(citySlug, queryBBox);
    if (currentLayers.heatmap) fetchHeatmap(citySlug, queryBBox);
  }, []);

  // ── Load SVG icons into map ──
  const loadImages = (map) =>
    new Promise((resolve) => {
      const entries = Object.entries(ICONS);
      let remaining = entries.length;
      if (!remaining) return resolve();

      entries.forEach(([id, dataUri]) => {
        const iconName = `${id}-icon`;
        if (map.hasImage(iconName)) {
          if (--remaining === 0) resolve();
          return;
        }

        const img = new Image();
        img.onload = () => {
          try {
            if (!map.hasImage(iconName)) map.addImage(iconName, img);
          } catch (e) {
            console.warn('Icon load warning:', e);
          }
          if (--remaining === 0) resolve();
        };
        img.onerror = () => {
          if (--remaining === 0) resolve();
        };
        img.src = dataUri;
      });
    });

  // ── Setup all sources and layers ──
  const setupLayers = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;

    // ─────────────────────────────────────────────────────────────────
    // 1. TRANSIT ROUTES (Metro Purple & Aqua Lines, Railway, Airport Feeder)
    // ─────────────────────────────────────────────────────────────────
    if (!map.getSource('transit-routes-source')) {
      map.addSource('transit-routes-source', {
        type: 'geojson',
        data: '/transit_routes.geojson',
      });

      // Railway line track (realistic railroad casing + dashed centerline)
      map.addLayer({
        id: 'transit-railway-casing',
        type: 'line',
        source: 'transit-routes-source',
        filter: ['==', ['get', 'route_type'], 'railway'],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': '#1e293b',
          'line-width': ['interpolate', ['linear'], ['zoom'], 10, 3.5, 14, 5.5, 17, 7.5],
          'line-opacity': 0.85,
        },
      });

      map.addLayer({
        id: 'transit-railway-line',
        type: 'line',
        source: 'transit-routes-source',
        filter: ['==', ['get', 'route_type'], 'railway'],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': '#e11d48',
          'line-width': ['interpolate', ['linear'], ['zoom'], 10, 2, 14, 3, 17, 4.5],
          'line-dasharray': [3, 2],
          'line-opacity': 0.95,
        },
      });

      // Airport Runway
      map.addLayer({
        id: 'transit-airport-runway',
        type: 'line',
        source: 'transit-routes-source',
        filter: ['==', ['get', 'route_type'], 'runway'],
        layout: { 'line-cap': 'butt' },
        paint: {
          'line-color': '#475569',
          'line-width': ['interpolate', ['linear'], ['zoom'], 10, 4, 13, 8, 16, 14],
          'line-opacity': 0.9,
        },
      });

      // Airport Feeder Corridor (Connecting PNQ to Ramwadi / Yerawada Metro)
      map.addLayer({
        id: 'transit-airport-feeder',
        type: 'line',
        source: 'transit-routes-source',
        filter: ['==', ['get', 'route_type'], 'airport_feeder'],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': '#38bdf8',
          'line-width': ['interpolate', ['linear'], ['zoom'], 10, 2.5, 14, 3.5, 17, 5],
          'line-dasharray': [2, 2],
          'line-opacity': 0.85,
        },
      });

      // Bus Corridors
      map.addLayer({
        id: 'transit-bus-corridors',
        type: 'line',
        source: 'transit-routes-source',
        filter: ['==', ['get', 'route_type'], 'bus_corridor'],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': '#f59e0b',
          'line-width': ['interpolate', ['linear'], ['zoom'], 10, 2, 14, 3, 17, 4.5],
          'line-dasharray': [3, 2],
          'line-opacity': 0.8,
        },
      });

      // Purple Line Glow
      map.addLayer({
        id: 'transit-purple-line-glow',
        type: 'line',
        source: 'transit-routes-source',
        filter: ['==', ['get', 'id'], 'purple-line'],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': '#a855f7',
          'line-width': ['interpolate', ['linear'], ['zoom'], 10, 7, 14, 11, 17, 15],
          'line-opacity': 0.35,
          'line-blur': 3,
        },
      });

      // Purple Line Track
      map.addLayer({
        id: 'transit-purple-line',
        type: 'line',
        source: 'transit-routes-source',
        filter: ['==', ['get', 'id'], 'purple-line'],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': '#9333ea',
          'line-width': ['interpolate', ['linear'], ['zoom'], 10, 3, 14, 4.5, 17, 6],
          'line-opacity': 0.95,
        },
      });

      // Aqua Line Glow
      map.addLayer({
        id: 'transit-aqua-line-glow',
        type: 'line',
        source: 'transit-routes-source',
        filter: ['==', ['get', 'id'], 'aqua-line'],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': '#06b6d4',
          'line-width': ['interpolate', ['linear'], ['zoom'], 10, 7, 14, 11, 17, 15],
          'line-opacity': 0.35,
          'line-blur': 3,
        },
      });

      // Aqua Line Track
      map.addLayer({
        id: 'transit-aqua-line',
        type: 'line',
        source: 'transit-routes-source',
        filter: ['==', ['get', 'id'], 'aqua-line'],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': '#0891b2',
          'line-width': ['interpolate', ['linear'], ['zoom'], 10, 3, 14, 4.5, 17, 6],
          'line-opacity': 0.95,
        },
      });
    }

    // ─────────────────────────────────────────────────────────────────
    // 2. TRANSIT STOPS & HUBS (Metro, Railway, Airport, Bus Stands)
    // ─────────────────────────────────────────────────────────────────
    if (!map.getSource('transit-stops-source')) {
      map.addSource('transit-stops-source', {
        type: 'geojson',
        data: '/transit_stops.geojson',
      });

      // Metro Stations (Purple, Aqua, Interchange)
      map.addLayer({
        id: 'transit-metro-stations',
        type: 'circle',
        source: 'transit-stops-source',
        filter: ['==', ['get', 'stop_type'], 'metro_station'],
        paint: {
          'circle-color': [
            'match',
            ['get', 'route_info'],
            'Purple Line',
            '#a855f7',
            'Aqua Line',
            '#06b6d4',
            'Interchange',
            '#ec4899',
            '#38bdf8',
          ],
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 4, 13, 6.5, 16, 9.5],
          'circle-stroke-width': 2.5,
          'circle-stroke-color': '#ffffff',
          'circle-opacity': 0.95,
        },
      });

      // Railway Stations (Central Railway)
      map.addLayer({
        id: 'transit-railway-stations',
        type: 'circle',
        source: 'transit-stops-source',
        filter: ['==', ['get', 'stop_type'], 'railway_station'],
        paint: {
          'circle-color': '#e11d48',
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 5, 13, 8, 16, 11.5],
          'circle-stroke-width': 2.5,
          'circle-stroke-color': '#ffffff',
          'circle-opacity': 0.95,
        },
      });

      // Pune Airport Terminal Marker
      map.addLayer({
        id: 'transit-airport-marker',
        type: 'circle',
        source: 'transit-stops-source',
        filter: ['==', ['get', 'stop_type'], 'airport'],
        paint: {
          'circle-color': '#2563eb',
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 6.5, 13, 10, 16, 14],
          'circle-stroke-width': 3,
          'circle-stroke-color': '#ffffff',
          'circle-opacity': 0.95,
        },
      });

      // Major Bus Stands / Depots
      map.addLayer({
        id: 'transit-bus-stands',
        type: 'circle',
        source: 'transit-stops-source',
        filter: ['==', ['get', 'stop_type'], 'bus_station'],
        paint: {
          'circle-color': '#f59e0b',
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 4.5, 13, 7, 16, 10],
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
          'circle-opacity': 0.95,
        },
      });

      // Station & Hub Name Labels (with high-contrast dark halo for dark & light maps)
      map.addLayer({
        id: 'transit-labels',
        type: 'symbol',
        source: 'transit-stops-source',
        layout: {
          'text-field': ['get', 'name'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 11, 9.5, 14, 11.5, 16, 13.5],
          'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
          'text-offset': [0, 1.4],
          'text-anchor': 'top',
          'text-optional': true,
          'text-max-width': 9,
        },
        paint: {
          'text-color': '#ffffff',
          'text-halo-color': 'rgba(15, 23, 42, 0.95)',
          'text-halo-width': 2,
        },
      });
    }

    // ─────────────────────────────────────────────────────────────────
    // 3. FLATS (Clustered GeoJSON)
    // ─────────────────────────────────────────────────────────────────
    if (!map.getSource('flats-source')) {
      map.addSource('flats-source', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
        cluster: true,
        clusterMaxZoom: 14,
        clusterRadius: 50,
      });

      // Cluster circles
      map.addLayer({
        id: 'flats-clusters',
        type: 'circle',
        source: 'flats-source',
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': ['step', ['get', 'point_count'], '#10b981', 10, '#059669', 50, '#047857'],
          'circle-radius': ['step', ['get', 'point_count'], 18, 10, 24, 50, 32],
          'circle-stroke-width': 3,
          'circle-stroke-color': 'rgba(16, 185, 129, 0.35)',
          'circle-opacity': 0.95,
        },
      });

      // Cluster count
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
        paint: { 'text-color': '#ffffff' },
      });

      // Individual flat dots
      map.addLayer({
        id: 'flats-unclustered',
        type: 'circle',
        source: 'flats-source',
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-color': '#10b981',
          'circle-radius': 8.5,
          'circle-stroke-width': 2.5,
          'circle-stroke-color': '#ffffff',
          'circle-opacity': 0.95,
        },
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
          'text-halo-color': 'rgba(15, 23, 42, 0.95)',
          'text-halo-width': 2,
        },
      });
    }

    // ─────────────────────────────────────────────────────────────────
    // 4. SEEKERS
    // ─────────────────────────────────────────────────────────────────
    if (!map.getSource('seekers-source')) {
      map.addSource('seekers-source', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      map.addLayer({
        id: 'seekers-unclustered',
        type: 'circle',
        source: 'seekers-source',
        paint: {
          'circle-color': '#6366f1',
          'circle-radius': 7.5,
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
          'circle-opacity': 0.95,
        },
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
          'text-halo-color': 'rgba(15, 23, 42, 0.95)',
          'text-halo-width': 2,
        },
      });
    }

    syncLayerVisibility();
  }, [syncLayerVisibility]);

  // ── MAP INITIALIZATION (runs once on mount) ──
  useEffect(() => {
    if (mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: mapStyle,
      center: [center.lng, center.lat],
      zoom: zoom,
      minZoom: 11,
      maxZoom: 18,
      attributionControl: false,
    });

    map.addControl(new maplibregl.NavigationControl(), 'bottom-right');
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-left');

    useMapStore.getState().setMapInstance(map);

    // ── Cluster click → zoom in ──
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
            curve: 1.2,
          });
        });
      } else {
        map.flyTo({ center: coords, zoom: map.getZoom() + 3, speed: 1.4 });
      }
    });

    // ── Flat pin click → open detail modal ──
    map.on('click', 'flats-unclustered', (e) => {
      if (!e.features?.length) return;
      try {
        const pin = JSON.parse(e.features[0].properties.raw_data);
        useMapStore.getState().setSelectedPin({ type: 'flat', data: pin });
        map.flyTo({ center: [pin.lng, pin.lat], zoom: Math.max(map.getZoom(), 15), speed: 1.2 });
      } catch (err) {
        console.warn('Failed to parse flat pin:', err);
      }
    });

    // ── Seeker pin click → open detail modal ──
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

    // ── Transit stop click → informative popup ──
    const transitClickLayers = [
      'transit-metro-stations',
      'transit-railway-stations',
      'transit-airport-marker',
      'transit-bus-stands',
    ];

    transitClickLayers.forEach((layerId) => {
      map.on('click', layerId, (e) => {
        if (!e.features?.length) return;
        const props = e.features[0].properties;
        const coords = e.features[0].geometry.coordinates.slice();

        let icon = '🚇';
        let badgeColor = '#9333ea';
        if (props.stop_type === 'railway_station') {
          icon = '🚆';
          badgeColor = '#e11d48';
        } else if (props.stop_type === 'airport') {
          icon = '✈️';
          badgeColor = '#2563eb';
        } else if (props.stop_type === 'bus_station') {
          icon = '🚌';
          badgeColor = '#f59e0b';
        }

        if (activePopupRef.current) {
          activePopupRef.current.remove();
        }

        const popupHtml = `
          <div style="padding: 12px 14px; min-width: 220px; font-family: inherit;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
              <span style="font-size: 16px;">${icon}</span>
              <span style="font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; padding: 2px 7px; border-radius: 9999px; background: ${badgeColor}22; color: ${badgeColor}; border: 1px solid ${badgeColor}44;">
                ${props.route_info || props.stop_type}
              </span>
            </div>
            <h4 style="margin: 0 0 4px 0; font-size: 14px; font-weight: 700; color: #0f172a; line-height: 1.3;">
              ${props.name}
            </h4>
            <p style="margin: 0 0 8px 0; font-size: 11.5px; color: #475569; line-height: 1.4;">
              ${props.desc || ''}
            </p>
            <div style="font-size: 10px; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 6px; font-family: monospace;">
              📍 ${coords[1].toFixed(5)}, ${coords[0].toFixed(5)}
            </div>
          </div>
        `;

        activePopupRef.current = new maplibregl.Popup({
          closeButton: true,
          closeOnClick: true,
          offset: 12,
        })
          .setLngLat(coords)
          .setHTML(popupHtml)
          .addTo(map);
      });
    });

    // ── Pin placement mode click ──
    map.on('click', (e) => {
      const currentPinMode = useMapStore.getState().pinMode;
      if (!currentPinMode) return;

      const clickLayers = [
        'flats-clusters',
        'flats-unclustered',
        'seekers-unclustered',
        ...transitClickLayers,
      ].filter((id) => map.getLayer(id));

      if (clickLayers.length > 0) {
        const features = map.queryRenderedFeatures(e.point, { layers: clickLayers });
        if (features.length > 0) return;
      }

      useMapStore.getState().setPendingPinCoords({ lng: e.lngLat.lng, lat: e.lngLat.lat });
      useMapStore.getState().setPinMode(null);
    });

    // ── Cursor on hover ──
    const interactiveLayers = [
      'flats-clusters',
      'flats-unclustered',
      'seekers-unclustered',
      ...transitClickLayers,
    ];
    interactiveLayers.forEach((layerId) => {
      map.on('mouseenter', layerId, () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', layerId, () => {
        map.getCanvas().style.cursor = '';
      });
    });

    // ── Master Style Lifecycle Handler ──
    // This executes on initial load AND every time setStyle(newStyle) is called!
    map.on('style.load', async () => {
      await loadImages(map);
      setupLayers();
      syncFlatsToMap();
      syncSeekersToMap();
      syncLayerVisibility();

      const bounds = map.getBounds();
      if (bounds) {
        const bbox = [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()];
        fetchPinsForBBox(bbox);
      }
    });

    // ── Moveend → refetch pins for new viewport ──
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
      if (activePopupRef.current) activePopupRef.current.remove();
      map.remove();
      mapRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── MAP STYLE CHANGE EFFECT (Dark / Transit / Satellite) ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapStyle) return;

    // Call setStyle with diff: false so MapLibre reliably applies the new stylesheet
    // and triggers 'style.load' to rebuild all custom layers and markers
    map.setStyle(mapStyle, { diff: false });
  }, [mapStyle]);

  // ── Sync store data → map sources when pins or filters change ──
  useEffect(() => {
    syncFlatsToMap();
  }, [flatPins, filters, layers.flats, syncFlatsToMap]);

  useEffect(() => {
    syncSeekersToMap();
  }, [seekerPins, layers.seekers, syncSeekersToMap]);

  // ── Toggle layer visibility when checkboxes change ──
  useEffect(() => {
    syncLayerVisibility();
  }, [layers.transit, layers.flats, layers.seekers, syncLayerVisibility]);

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
            Loading pins...
          </div>
        </div>
      )}
    </div>
  );
}

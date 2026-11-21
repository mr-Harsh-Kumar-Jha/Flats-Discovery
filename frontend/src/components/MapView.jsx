import { useEffect, useRef, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useMapStore, CITIES_CONFIG } from '../stores/mapStore';
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
  'transit-monorail-glow',
  'transit-monorail-line',
  'transit-rapid-rail-glow',
  'transit-rapid-rail-line',
  'transit-metro-glow',
  'transit-metro-line',
  'transit-metro-stations',
  'transit-monorail-stations',
  'transit-rapid-rail-stations',
  'transit-railway-stations',
  'transit-bus-stations',
];

function clusterPins(pins, distanceThreshold = 0.038) {
  const clusters = [];
  const assigned = new Set();

  for (let i = 0; i < pins.length; i++) {
    if (assigned.has(i)) continue;
    const p1 = pins[i];
    const group = [p1];
    assigned.add(i);

    for (let j = i + 1; j < pins.length; j++) {
      if (assigned.has(j)) continue;
      const p2 = pins[j];
      const dist = Math.hypot(p1.lng - p2.lng, p1.lat - p2.lat);
      if (dist < distanceThreshold) {
        group.push(p2);
        assigned.add(j);
      }
    }

    if (group.length > 1) {
      const avgLng = group.reduce((sum, p) => sum + p.lng, 0) / group.length;
      const avgLat = group.reduce((sum, p) => sum + p.lat, 0) / group.length;
      clusters.push({
        isCluster: true,
        lng: avgLng,
        lat: avgLat,
        count: group.length,
        pins: group,
      });
    } else {
      clusters.push({
        isCluster: false,
        pin: p1,
        lng: p1.lng,
        lat: p1.lat,
      });
    }
  }
  return clusters;
}

function clusterSocieties(societies, distanceThreshold = 0.04) {
  const clusters = [];
  const assigned = new Set();

  for (let i = 0; i < societies.length; i++) {
    if (assigned.has(i)) continue;
    const s1 = societies[i];
    const group = [s1];
    assigned.add(i);

    for (let j = i + 1; j < societies.length; j++) {
      if (assigned.has(j)) continue;
      const s2 = societies[j];
      const dist = Math.hypot(s1.lng - s2.lng, s1.lat - s2.lat);
      if (dist < distanceThreshold) {
        group.push(s2);
        assigned.add(j);
      }
    }

    const localityCounts = {};
    group.forEach((s) => {
      const loc = s.locality || '';
      if (loc) localityCounts[loc] = (localityCounts[loc] || 0) + 1;
    });
    const topLocality = Object.keys(localityCounts).sort((a, b) => localityCounts[b] - localityCounts[a])[0] || '';

    if (group.length > 1) {
      const avgLng = group.reduce((sum, s) => sum + s.lng, 0) / group.length;
      const avgLat = group.reduce((sum, s) => sum + s.lat, 0) / group.length;
      clusters.push({
        isCluster: true,
        lng: avgLng,
        lat: avgLat,
        count: group.length,
        locality: topLocality,
        societies: group,
      });
    } else {
      clusters.push({
        isCluster: false,
        society: s1,
        lng: s1.lng,
        lat: s1.lat,
      });
    }
  }
  return clusters;
}

/**
 * MapView — Core interactive MapLibre map component.
 * Features Flat-Finder UI:
 *   - 3D Building Extrusions & Cinematic 58° Pitch
 *   - Modern HTML DOM Pill Badges (Airbnb / Flat-Finder style)
 *   - Dynamic Transit Overlay per city (Pune, Mumbai, Gurgaon, Noida)
 *   - Strict Buy Mode filtering: only genuine properties for sale + society yields
 */
export default function MapView() {
  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const fetchTimerRef = useRef(null);
  const activePopupRef = useRef(null);
  const htmlMarkersRef = useRef([]);

  const { center, zoom, layers, mapStyle, pinMode, is3D, toggle3D, citySlug, setSelectedPin, viewTab } = useMapStore();
  const { flatPins, seekerPins, societies, loading, filters, getFilteredFlats, getFilteredSocieties } = usePinsStore();

  // ── Sync Modern HTML Pill Markers (Flat-Finder & Airbnb style) ──
  const syncHTMLPillMarkers = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;

    // Remove old HTML markers
    htmlMarkersRef.current.forEach((m) => m.remove());
    htmlMarkersRef.current = [];

    const { mode } = filters;
    const { layers: currentLayers, viewTab: currentViewTab } = useMapStore.getState();
    const currentZoom = map.getZoom();
    const isZoomedOut = currentZoom < 13.5;

    // ─────────────────────────────────────────────────────────────
    // BRANCH A: USER IS ON SOCIETIES TAB (viewTab === 'societies')
    // Shows ONLY societies pins — Zero overlap with individual listings!
    // Each society pin shows how many flats are listed in that society.
    // When zoomed out (< 13.5), shows area-wise cumulative count pins.
    // ─────────────────────────────────────────────────────────────
    if (currentViewTab === 'societies') {
      const displaySocieties = getFilteredSocieties();

      if (isZoomedOut && displaySocieties.length > 2) {
        // Area-wise cumulative count pin for societies
        const clusters = clusterSocieties(displaySocieties, 0.04);

        clusters.forEach((item) => {
          const el = document.createElement('div');
          el.className = 'flat-finder-marker';

          if (item.isCluster) {
            const totalFlats = item.societies.reduce((sum, s) => {
              const count = mode === 'buy'
                ? (s.available_sales_count || 1)
                : (s.available_rentals_count || 1);
              return sum + count;
            }, 0);

            if (mode === 'buy') {
              const avgYield = (item.societies.reduce((sum, s) => sum + (parseFloat(s.rental_yield_pct) || 3.2), 0) / item.count).toFixed(1);
              el.innerHTML = `
                <div class="map-pill-badge map-pill-society" style="padding: 6px 12px; font-size: 11.5px; border-width: 2px; box-shadow: 0 6px 20px rgba(0,0,0,0.5);">
                  <span style="font-size: 13px;">🏢</span>
                  <span style="font-weight: 800;">${item.count} Societies</span>
                  <span style="background: rgba(129, 140, 248, 0.35); border: 1px solid rgba(165, 180, 252, 0.5); border-radius: 9999px; padding: 2px 7px; font-size: 10px; font-weight: 800;">
                    ${totalFlats} Resale · ${avgYield}% Yield
                  </span>
                  ${item.locality ? `<span style="font-size: 10px; opacity: 0.8; font-weight: 600;">(${item.locality.split(' ')[0]})</span>` : ''}
                </div>
              `;
            } else {
              el.innerHTML = `
                <div class="map-pill-badge map-pill-society" style="padding: 6px 12px; font-size: 11.5px; border-width: 2px; box-shadow: 0 6px 20px rgba(0,0,0,0.5);">
                  <span style="font-size: 13px;">🏢</span>
                  <span style="font-weight: 800;">${item.count} Societies</span>
                  <span style="background: rgba(16, 185, 129, 0.35); border: 1px solid rgba(52, 211, 153, 0.5); border-radius: 9999px; padding: 2px 7px; font-size: 10px; font-weight: 800;">
                    ${totalFlats} Flats Listed
                  </span>
                  ${item.locality ? `<span style="font-size: 10px; opacity: 0.8; font-weight: 600;">(${item.locality.split(' ')[0]})</span>` : ''}
                </div>
              `;
            }

            el.onclick = (e) => {
              e.stopPropagation();
              map.flyTo({ center: [item.lng, item.lat], zoom: 15, speed: 1.3 });
            };
          } else {
            const soc = item.society;
            const flatsCount = mode === 'buy'
              ? (soc.available_sales_count || 1)
              : (soc.available_rentals_count || 1);

            if (mode === 'buy') {
              el.innerHTML = `
                <div class="map-pill-badge map-pill-society">
                  <span style="font-size: 12px;">🏢</span>
                  <span style="max-width: 100px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${soc.name}</span>
                  <span style="background: rgba(129, 140, 248, 0.25); color: #818cf8; border: 1px solid rgba(129, 140, 248, 0.4); border-radius: 6px; padding: 2px 5px; font-size: 10px; font-weight: 800;">
                    ${flatsCount} Resale
                  </span>
                  <span style="background: rgba(16, 185, 129, 0.25); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.4); border-radius: 6px; padding: 2px 5px; font-size: 10px; font-weight: 800;">
                    ${soc.rental_yield_pct}%
                  </span>
                </div>
              `;
            } else {
              el.innerHTML = `
                <div class="map-pill-badge map-pill-society">
                  <span style="font-size: 12px;">🏢</span>
                  <span style="max-width: 100px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${soc.name}</span>
                  <span style="background: rgba(16, 185, 129, 0.25); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.4); border-radius: 6px; padding: 2px 5px; font-size: 10px; font-weight: 800;">
                    ${flatsCount} ${flatsCount === 1 ? 'Flat' : 'Flats'}
                  </span>
                  <span style="color: #a7f3d0; font-size: 10px; font-weight: 700;">
                    ₹${formatRent(soc.min_rent)}+
                  </span>
                </div>
              `;
            }

            el.onclick = (e) => {
              e.stopPropagation();
              setSelectedPin({ type: 'society', data: soc });
              map.flyTo({ center: [soc.lng, soc.lat], zoom: 15.5, speed: 1.2 });
            };
          }

          const m = new maplibregl.Marker({ element: el })
            .setLngLat([item.lng, item.lat])
            .addTo(map);
          htmlMarkersRef.current.push(m);
        });
      } else {
        // Individual society pins when zoomed in
        displaySocieties.forEach((soc) => {
          const el = document.createElement('div');
          el.className = 'flat-finder-marker';
          const flatsCount = mode === 'buy'
            ? (soc.available_sales_count || 1)
            : (soc.available_rentals_count || 1);

          if (mode === 'buy') {
            el.innerHTML = `
              <div class="map-pill-badge map-pill-society">
                <span style="font-size: 12px;">🏢</span>
                <span style="max-width: 100px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${soc.name}</span>
                <span style="background: rgba(129, 140, 248, 0.25); color: #818cf8; border: 1px solid rgba(129, 140, 248, 0.4); border-radius: 6px; padding: 2px 5px; font-size: 10px; font-weight: 800;">
                  ${flatsCount} Resale
                </span>
                <span style="background: rgba(16, 185, 129, 0.25); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.4); border-radius: 6px; padding: 2px 5px; font-size: 10px; font-weight: 800;">
                  ${soc.rental_yield_pct}%
                </span>
              </div>
            `;
          } else {
            el.innerHTML = `
              <div class="map-pill-badge map-pill-society">
                <span style="font-size: 12px;">🏢</span>
                <span style="max-width: 100px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${soc.name}</span>
                <span style="background: rgba(16, 185, 129, 0.25); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.4); border-radius: 6px; padding: 2px 5px; font-size: 10px; font-weight: 800;">
                  ${flatsCount} ${flatsCount === 1 ? 'Flat' : 'Flats'}
                </span>
                <span style="color: #a7f3d0; font-size: 10px; font-weight: 700;">
                  ₹${formatRent(soc.min_rent)}+
                </span>
              </div>
            `;
          }

          el.onclick = (e) => {
            e.stopPropagation();
            setSelectedPin({ type: 'society', data: soc });
            map.flyTo({ center: [soc.lng, soc.lat], zoom: 15.5, speed: 1.2 });
          };
          const m = new maplibregl.Marker({ element: el })
            .setLngLat([soc.lng, soc.lat])
            .addTo(map);
          htmlMarkersRef.current.push(m);
        });
      }
      return;
    }

    // ─────────────────────────────────────────────────────────────
    // BRANCH B: USER IS ON LISTINGS TAB (viewTab === 'flats')
    // Shows ONLY flat listings pins — Societies are hidden -> Zero overlap!
    // When zoomed out (< 13.5), shows area-wise cumulative count pins.
    // ─────────────────────────────────────────────────────────────
    if (currentLayers.flats) {
      const displayFlats = getFilteredFlats();

      if (isZoomedOut && displayFlats.length > 2) {
        const clusters = clusterPins(displayFlats, 0.038);

        clusters.forEach((item) => {
          const el = document.createElement('div');
          el.className = 'flat-finder-marker';

          if (item.isCluster) {
            if (mode === 'buy') {
              const avgPrice = Math.round(item.pins.reduce((sum, p) => sum + (p.sale_price || (p.rent * 320)), 0) / item.count);
              el.innerHTML = `
                <div class="map-pill-badge map-pill-sale" style="padding: 6px 12px; font-size: 11.5px; border-width: 2px; box-shadow: 0 6px 20px rgba(0,0,0,0.5);">
                  <span style="font-size: 13px;">💎</span>
                  <span style="font-weight: 800;">${item.count} Resale</span>
                  <span style="background: rgba(129, 140, 248, 0.35); border: 1px solid rgba(165, 180, 252, 0.5); border-radius: 9999px; padding: 2px 7px; font-size: 10px; font-weight: 800;">
                    ₹${formatRent(avgPrice)} avg
                  </span>
                </div>
              `;
            } else {
              const avgRent = Math.round(item.pins.reduce((sum, p) => sum + p.rent, 0) / item.count);
              el.innerHTML = `
                <div class="map-pill-badge map-pill-rent" style="padding: 6px 12px; font-size: 11.5px; border-width: 2px; box-shadow: 0 6px 20px rgba(0,0,0,0.5);">
                  <span style="font-size: 13px;">🏠</span>
                  <span style="font-weight: 800;">${item.count} Flats</span>
                  <span style="background: rgba(16, 185, 129, 0.35); border: 1px solid rgba(52, 211, 153, 0.5); border-radius: 9999px; padding: 2px 7px; font-size: 10px; font-weight: 800;">
                    ₹${formatRent(avgRent)} avg
                  </span>
                </div>
              `;
            }

            el.onclick = (e) => {
              e.stopPropagation();
              map.flyTo({ center: [item.lng, item.lat], zoom: 15, speed: 1.3 });
            };
          } else {
            const pin = item.pin;
            if (mode === 'buy') {
              const price = pin.sale_price || (pin.rent * 320);
              el.innerHTML = `
                <div class="map-pill-badge map-pill-sale">
                  <span style="font-size: 11px;">💎</span>
                  <span>₹${formatRent(price)}</span>
                  <span style="font-size: 9.5px; opacity: 0.85; font-weight: 600;">${pin.bhk_config}</span>
                </div>
              `;
            } else {
              el.innerHTML = `
                <div class="map-pill-badge map-pill-rent">
                  <span style="width: 7px; height: 7px; border-radius: 9999px; background: #10b981; display: inline-block;"></span>
                  <span>₹${formatRent(pin.rent)}</span>
                  <span style="font-size: 9.5px; opacity: 0.75; font-weight: 600;">${pin.bhk_config}</span>
                </div>
              `;
            }

            el.onclick = (e) => {
              e.stopPropagation();
              setSelectedPin({ type: 'flat', data: pin });
              map.flyTo({ center: [pin.lng, pin.lat], zoom: 16, speed: 1.2 });
            };
          }

          const m = new maplibregl.Marker({ element: el })
            .setLngLat([item.lng, item.lat])
            .addTo(map);
          htmlMarkersRef.current.push(m);
        });
      } else {
        // Individual flat pins when zoomed in
        displayFlats.forEach((pin) => {
          if (mode === 'buy' && !pin.is_for_sale && !pin.sale_price) return;

          const el = document.createElement('div');
          el.className = 'flat-finder-marker';

          if (mode === 'buy') {
            const price = pin.sale_price || (pin.rent * 320);
            el.innerHTML = `
              <div class="map-pill-badge map-pill-sale">
                <span style="font-size: 11px;">💎</span>
                <span>₹${formatRent(price)}</span>
                <span style="font-size: 9.5px; opacity: 0.85; font-weight: 600;">${pin.bhk_config}</span>
              </div>
            `;
          } else {
            el.innerHTML = `
              <div class="map-pill-badge map-pill-rent">
                <span style="width: 7px; height: 7px; border-radius: 9999px; background: #10b981; display: inline-block;"></span>
                <span>₹${formatRent(pin.rent)}</span>
                <span style="font-size: 9.5px; opacity: 0.75; font-weight: 600;">${pin.bhk_config}</span>
              </div>
            `;
          }

          el.onclick = (e) => {
            e.stopPropagation();
            setSelectedPin({ type: 'flat', data: pin });
            map.flyTo({ center: [pin.lng, pin.lat], zoom: 16, speed: 1.2 });
          };
          const m = new maplibregl.Marker({ element: el })
            .setLngLat([pin.lng, pin.lat])
            .addTo(map);
          htmlMarkersRef.current.push(m);
        });
      }
    }

    // ─────────────────────────────────────────────────────────────
    // BRANCH C: SEEKERS (when seekers layer is toggled)
    // ─────────────────────────────────────────────────────────────
    if (currentLayers.seekers) {
      seekerPins.forEach((pin) => {
        const el = document.createElement('div');
        el.className = 'flat-finder-marker';
        el.innerHTML = `
          <div class="map-pill-badge map-pill-seeker">
            <span style="width: 7px; height: 7px; border-radius: 9999px; background: #6366f1; display: inline-block;"></span>
            <span>Seeker: ₹${formatRent(pin.budget_max)}</span>
          </div>
        `;
        el.onclick = (e) => {
          e.stopPropagation();
          setSelectedPin({ type: 'seeker', data: pin });
          map.flyTo({ center: [pin.lng, pin.lat], zoom: 16, speed: 1.2 });
        };
        const m = new maplibregl.Marker({ element: el })
          .setLngLat([pin.lng, pin.lat])
          .addTo(map);
        htmlMarkersRef.current.push(m);
      });
    }
  }, [filters, getFilteredFlats, getFilteredSocieties, seekerPins, setSelectedPin, viewTab]);

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

    // 3D Buildings layer visibility
    if (map.getLayer('3d-buildings-extrusion')) {
      map.setLayoutProperty('3d-buildings-extrusion', 'visibility', is3D ? 'visible' : 'none');
    }
  }, [is3D]);

  // ── Setup all sources and layers ──
  const setupLayers = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;

    // ─────────────────────────────────────────────────────────────────
    // 1. TRANSIT ROUTES (Metro, Suburban Rail, Monorail, Rapid Rail RRTS)
    // ─────────────────────────────────────────────────────────────────
    if (!map.getSource('transit-routes-source')) {
      const activeCity = useMapStore.getState().citySlug || 'pune';
      map.addSource('transit-routes-source', {
        type: 'geojson',
        data: `/data/${activeCity}_transit_routes.geojson`,
      });

      // A) Suburban Railway line tracks (Dark Casing + Crimson dashed line)
      map.addLayer({
        id: 'transit-railway-casing',
        type: 'line',
        source: 'transit-routes-source',
        filter: ['==', ['get', 'route_type'], 'railway'],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': '#0f172a',
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
          'line-color': '#dc2626',
          'line-width': ['interpolate', ['linear'], ['zoom'], 10, 2, 14, 3, 17, 4.5],
          'line-dasharray': [3, 2],
          'line-opacity': 0.95,
        },
      });

      // B) Monorail (Mumbai Monorail - Elevated Turquoise Track)
      map.addLayer({
        id: 'transit-monorail-glow',
        type: 'line',
        source: 'transit-routes-source',
        filter: ['==', ['get', 'route_type'], 'monorail'],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': '#14b8a6',
          'line-width': ['interpolate', ['linear'], ['zoom'], 10, 8, 14, 13, 17, 18],
          'line-opacity': 0.45,
          'line-blur': 4,
        },
      });

      map.addLayer({
        id: 'transit-monorail-line',
        type: 'line',
        source: 'transit-routes-source',
        filter: ['==', ['get', 'route_type'], 'monorail'],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': '#0d9488',
          'line-width': ['interpolate', ['linear'], ['zoom'], 10, 3.5, 14, 5.5, 17, 7],
          'line-opacity': 0.95,
        },
      });

      // C) Rapid Rail (Namo Bharat RRTS High-Speed Corridor - Electric Orange)
      map.addLayer({
        id: 'transit-rapid-rail-glow',
        type: 'line',
        source: 'transit-routes-source',
        filter: ['==', ['get', 'route_type'], 'rapid_rail'],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': '#ea580c',
          'line-width': ['interpolate', ['linear'], ['zoom'], 10, 8, 14, 14, 17, 19],
          'line-opacity': 0.45,
          'line-blur': 4,
        },
      });

      map.addLayer({
        id: 'transit-rapid-rail-line',
        type: 'line',
        source: 'transit-routes-source',
        filter: ['==', ['get', 'route_type'], 'rapid_rail'],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': '#f97316',
          'line-width': ['interpolate', ['linear'], ['zoom'], 10, 4, 14, 6, 17, 8],
          'line-opacity': 0.95,
        },
      });

      // D) Metro Lines (Dynamic line color from GeoJSON feature)
      map.addLayer({
        id: 'transit-metro-glow',
        type: 'line',
        source: 'transit-routes-source',
        filter: ['==', ['get', 'route_type'], 'metro'],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': ['coalesce', ['get', 'color'], '#3b82f6'],
          'line-width': ['interpolate', ['linear'], ['zoom'], 10, 7, 14, 11, 17, 15],
          'line-opacity': 0.35,
          'line-blur': 3,
        },
      });

      map.addLayer({
        id: 'transit-metro-line',
        type: 'line',
        source: 'transit-routes-source',
        filter: ['==', ['get', 'route_type'], 'metro'],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': ['coalesce', ['get', 'color'], '#3b82f6'],
          'line-width': ['interpolate', ['linear'], ['zoom'], 10, 3, 14, 4.5, 17, 6],
          'line-opacity': 0.95,
        },
      });
    }

    // ─────────────────────────────────────────────────────────────────
    // 2. TRANSIT STOPS & HUBS (Metro, Monorail, Rapid Rail, Railway, Bus)
    // ─────────────────────────────────────────────────────────────────
    if (!map.getSource('transit-stops-source')) {
      const activeCity = useMapStore.getState().citySlug || 'pune';
      map.addSource('transit-stops-source', {
        type: 'geojson',
        data: `/data/${activeCity}_transit_stops.geojson`,
      });

      // Metro Stations (Sky Blue Badge)
      map.addLayer({
        id: 'transit-metro-stations',
        type: 'circle',
        source: 'transit-stops-source',
        filter: ['==', ['get', 'stop_type'], 'metro_station'],
        paint: {
          'circle-color': '#0284c7',
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 4, 13, 6.5, 16, 9.5],
          'circle-stroke-width': 2.5,
          'circle-stroke-color': '#ffffff',
          'circle-opacity': 0.95,
        },
      });

      // Monorail Stations (Turquoise Badge)
      map.addLayer({
        id: 'transit-monorail-stations',
        type: 'circle',
        source: 'transit-stops-source',
        filter: ['==', ['get', 'stop_type'], 'monorail_station'],
        paint: {
          'circle-color': '#14b8a6',
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 4.5, 13, 7, 16, 10],
          'circle-stroke-width': 2.5,
          'circle-stroke-color': '#ffffff',
          'circle-opacity': 0.95,
        },
      });

      // Rapid Rail Stations (Namo Bharat RRTS Electric Orange Badge)
      map.addLayer({
        id: 'transit-rapid-rail-stations',
        type: 'circle',
        source: 'transit-stops-source',
        filter: ['==', ['get', 'stop_type'], 'rapid_rail_station'],
        paint: {
          'circle-color': '#f97316',
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 5, 13, 8, 16, 11],
          'circle-stroke-width': 3,
          'circle-stroke-color': '#ffffff',
          'circle-opacity': 0.95,
        },
      });

      // Railway Stations (Ruby Red Badge)
      map.addLayer({
        id: 'transit-railway-stations',
        type: 'circle',
        source: 'transit-stops-source',
        filter: ['==', ['get', 'stop_type'], 'railway_station'],
        paint: {
          'circle-color': '#dc2626',
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 5, 13, 8, 16, 11.5],
          'circle-stroke-width': 2.5,
          'circle-stroke-color': '#ffffff',
          'circle-opacity': 0.95,
        },
      });

      // Bus Terminals / Depots (Amber Badge)
      map.addLayer({
        id: 'transit-bus-stations',
        type: 'circle',
        source: 'transit-stops-source',
        filter: ['==', ['get', 'stop_type'], 'bus_station'],
        paint: {
          'circle-color': '#d97706',
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 3.5, 13, 5.5, 16, 8],
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
          'circle-opacity': 0.9,
        },
      });
    }

    // ─────────────────────────────────────────────────────────────────
    // 3. 3D BUILDING EXTRUSIONS (Flat-Finder Architecture)
    // ─────────────────────────────────────────────────────────────────
    if (!map.getLayer('3d-buildings-extrusion') && map.getSource('protomaps')) {
      map.addLayer({
        id: '3d-buildings-extrusion',
        source: 'protomaps',
        'source-layer': 'buildings',
        type: 'fill-extrusion',
        minzoom: 13,
        paint: {
          'fill-extrusion-color': [
            'interpolate', ['linear'], ['zoom'],
            13, '#94a3b8',
            15, '#64748b',
            17, '#475569'
          ],
          'fill-extrusion-height': [
            'coalesce',
            ['get', 'height'],
            ['*', ['coalesce', ['get', 'levels'], 3], 3.5],
            16
          ],
          'fill-extrusion-base': [
            'coalesce',
            ['get', 'min_height'],
            0
          ],
          'fill-extrusion-opacity': 0.82,
        },
      });
    }

    syncLayerVisibility();
  }, [syncLayerVisibility]);

  // ── MAP INITIALIZATION ──
  useEffect(() => {
    if (mapRef.current) return;

    const initialCity = CITIES_CONFIG[citySlug] || CITIES_CONFIG.pune;

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: mapStyle,
      center: [initialCity.center.lng, initialCity.center.lat],
      zoom: initialCity.zoom,
      pitch: is3D ? 58 : 0,
      bearing: is3D ? -18 : 0,
      minZoom: 10,
      maxZoom: 19,
      attributionControl: false,
    });

    map.addControl(new maplibregl.NavigationControl(), 'bottom-right');
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-left');

    map.dragRotate.enable();
    map.touchZoomRotate.enableRotation();

    useMapStore.getState().setMapInstance(map);

    // ── Transit stop click → informative popup ──
    const transitClickLayers = [
      'transit-metro-stations',
      'transit-monorail-stations',
      'transit-rapid-rail-stations',
      'transit-railway-stations',
      'transit-bus-stations',
    ];
    transitClickLayers.forEach((layerId) => {
      map.on('click', layerId, (e) => {
        if (!e.features?.length) return;
        const props = e.features[0].properties;
        const coords = e.features[0].geometry.coordinates.slice();
        
        let icon = '🚇';
        let badgeColor = '#0284c7';
        if (props.stop_type === 'railway_station') {
          icon = '🚆';
          badgeColor = '#dc2626';
        } else if (props.stop_type === 'monorail_station') {
          icon = '🚝';
          badgeColor = '#14b8a6';
        } else if (props.stop_type === 'rapid_rail_station') {
          icon = '⚡';
          badgeColor = '#ea580c';
        } else if (props.stop_type === 'bus_station') {
          icon = '🚌';
          badgeColor = '#d97706';
        }

        if (activePopupRef.current) activePopupRef.current.remove();

        const popupHtml = `
          <div style="padding: 10px 12px; min-width: 200px; font-family: inherit;">
            <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
              <span style="font-size: 16px;">${icon}</span>
              <span style="font-size: 10px; font-weight: 700; color: ${badgeColor}; text-transform: uppercase;">
                ${props.route_info || props.stop_type}
              </span>
            </div>
            <h4 style="margin: 0; font-size: 13px; font-weight: 700; color: #0f172a;">
              ${props.name}
            </h4>
          </div>
        `;

        activePopupRef.current = new maplibregl.Popup({ closeButton: true, offset: 12 })
          .setLngLat(coords)
          .setHTML(popupHtml)
          .addTo(map);
      });
    });

    // ── Cursor on hover for transit ──
    transitClickLayers.forEach((layerId) => {
      map.on('mouseenter', layerId, () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', layerId, () => {
        map.getCanvas().style.cursor = '';
      });
    });

    // ── Master Style Lifecycle Handler ──
    map.on('style.load', async () => {
      setupLayers();
      syncLayerVisibility();
      syncHTMLPillMarkers();

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

    // ── Zoomend → transition between clusters & individual pills ──
    map.on('zoomend', () => {
      syncHTMLPillMarkers();
    });

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
      htmlMarkersRef.current.forEach((m) => m.remove());
      map.remove();
      mapRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── MAP STYLE CHANGE EFFECT ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapStyle) return;
    map.setStyle(mapStyle, { diff: false });
  }, [mapStyle]);

  // ── DYNAMIC CITY TRANSIT GEOJSON SWITCHER ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const routesSrc = map.getSource('transit-routes-source');
    if (routesSrc) {
      fetch(`/data/${citySlug}_transit_routes.geojson`)
        .then((r) => r.ok ? r.json() : null)
        .then((data) => {
          if (data) routesSrc.setData(data);
        })
        .catch(() => {});
    }

    const stopsSrc = map.getSource('transit-stops-source');
    if (stopsSrc) {
      fetch(`/data/${citySlug}_transit_stops.geojson`)
        .then((r) => r.ok ? r.json() : null)
        .then((data) => {
          if (data) stopsSrc.setData(data);
        })
        .catch(() => {});
    }
  }, [citySlug]);

  // ── Sync HTML Pill Markers whenever pins, societies, mode, layers, or viewTab change ──
  useEffect(() => {
    syncHTMLPillMarkers();
  }, [flatPins, societies, seekerPins, filters.mode, layers.flats, layers.seekers, viewTab, syncHTMLPillMarkers]);

  // ── Toggle layer visibility and 3D mode ──
  useEffect(() => {
    syncLayerVisibility();
  }, [layers.transit, is3D, syncLayerVisibility]);

  // Helper to fetch pins for bounding box
  const fetchPinsForBBox = useCallback(async (bbox) => {
    const map = mapRef.current;
    const currentZoom = map ? map.getZoom() : 13;
    const city = useMapStore.getState().citySlug || 'pune';
    const { layers: currentLayers } = useMapStore.getState();

    // When zoomed out (< 13.5), fetch whole city so no listings are wiped out!
    if (currentZoom < 13.5) {
      if (currentLayers.flats) {
        usePinsStore.getState().fetchFlatPins(city, { limit: 250 });
      }
      if (currentLayers.seekers) {
        usePinsStore.getState().fetchSeekerPins(city, { limit: 250 });
      }
      return;
    }

    // When zoomed in, pass current visible viewport
    const [west, south, east, north] = bbox;
    if (currentLayers.flats) {
      usePinsStore.getState().fetchFlatPins(city, {
        sw_lng: west,
        sw_lat: south,
        ne_lng: east,
        ne_lat: north,
        limit: 100,
      });
    }

    if (currentLayers.seekers) {
      usePinsStore.getState().fetchSeekerPins(city, {
        sw_lng: west,
        sw_lat: south,
        ne_lng: east,
        ne_lat: north,
        limit: 100,
      });
    }
  }, []);

  return (
    <div className="absolute inset-0">
      <div
        ref={mapContainer}
        className="w-full h-full"
        style={{ cursor: pinMode ? 'crosshair' : undefined }}
      />

      {/* 3D View Toggle Button (Flat-Finder Style) */}
      <div className="absolute bottom-28 right-4 z-20">
        <button
          onClick={toggle3D}
          className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xl backdrop-blur-xl border transition-all ${
            is3D
              ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white border-emerald-400/60 shadow-emerald-500/20'
              : 'bg-white/95 dark:bg-slate-900/95 text-slate-800 dark:text-white border-slate-200 dark:border-white/10 hover:border-emerald-500/50'
          }`}
          title={is3D ? 'Switch to 2D Top-Down View' : 'Switch to 3D Buildings View'}
        >
          <span className="text-sm">🌆</span>
          <span>{is3D ? '3D Active' : '3D View'}</span>
        </button>
      </div>

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

// API client for the Pune-Flats backend.
// All requests are proxied through Vite in dev: /api → go-api:8080

const API_BASE = '/api/v1';

/**
 * Generic fetch wrapper with error handling.
 * @param {string} path - API path (e.g., '/cities')
 * @param {object} options - fetch options
 * @returns {Promise<{data: any, meta: any}>}
 */
async function request(path, options = {}) {
  const url = `${API_BASE}${path}`;

  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  // Dev auth: inject X-Dev-User-ID header
  const devUserID = localStorage.getItem('dev_user_id');
  if (devUserID) {
    headers['X-Dev-User-ID'] = devUserID;
  }

  const res = await fetch(url, { ...options, headers });
  const json = await res.json();

  if (json.error) {
    const err = new Error(json.error.message || 'API error');
    err.code = json.error.code;
    err.details = json.error.details;
    throw err;
  }

  return json;
}

// =========================================================================
// Cities
// =========================================================================

export async function fetchCities() {
  const res = await request('/cities');
  return res.data;
}

// =========================================================================
// Flat Pins
// =========================================================================

export async function fetchFlatPins(citySlug, bbox) {
  const params = new URLSearchParams({
    city: citySlug,
    sw_lng: bbox[0].toString(),
    sw_lat: bbox[1].toString(),
    ne_lng: bbox[2].toString(),
    ne_lat: bbox[3].toString(),
  });
  const res = await request(`/pins/flats?${params}`);
  return res;
}

export async function fetchFlatPinById(id) {
  const res = await request(`/pins/flats/${id}`);
  return res.data;
}

export async function createFlatPin(data) {
  const res = await request('/pins/flats', {
    method: 'POST',
    body: JSON.stringify(data)
  });
  return res.data;
}

// =========================================================================
// Seeker Pins
// =========================================================================

export async function fetchSeekerPins(citySlug, bbox) {
  const params = new URLSearchParams({
    city: citySlug,
    sw_lng: bbox[0].toString(),
    sw_lat: bbox[1].toString(),
    ne_lng: bbox[2].toString(),
    ne_lat: bbox[3].toString(),
  });
  const res = await request(`/pins/seekers?${params}`);
  return res;
}

export async function createSeekerPin(data) {
  const res = await request('/pins/seekers', {
    method: 'POST',
    body: JSON.stringify(data)
  });
  return res.data;
}

// =========================================================================
// Heatmap
// =========================================================================

export async function fetchHeatmapAggregate(citySlug, bbox) {
  const params = new URLSearchParams({
    city: citySlug,
    sw_lng: bbox[0].toString(),
    sw_lat: bbox[1].toString(),
    ne_lng: bbox[2].toString(),
    ne_lat: bbox[3].toString(),
    mode: 'aggregate',
  });
  const res = await request(`/pins/heatmap?${params}`);
  return res;
}

// =========================================================================
// To-Let Boards
// =========================================================================

export async function fetchToLetBoards(citySlug, bbox) {
  const params = new URLSearchParams({
    city: citySlug,
    sw_lng: bbox[0].toString(),
    sw_lat: bbox[1].toString(),
    ne_lng: bbox[2].toString(),
    ne_lat: bbox[3].toString(),
  });
  const res = await request(`/pins/tolet?${params}`);
  return res;
}

// =========================================================================
// Matches
// =========================================================================

export async function fetchMyMatches() {
  const res = await request('/matches');
  return res;
}

// =========================================================================
// Chat
// =========================================================================

export async function createDirectRoom(matchId) {
  const res = await request('/chat/rooms/direct', {
    method: 'POST',
    body: JSON.stringify({ match_id: matchId }),
  });
  return res.data;
}

export async function fetchMyRooms() {
  const res = await request('/chat/rooms');
  return res;
}

export async function fetchMessages(roomId, limit = 50, offset = 0) {
  const params = new URLSearchParams({ limit: limit.toString(), offset: offset.toString() });
  const res = await request(`/chat/rooms/${roomId}/messages?${params}`);
  return res;
}

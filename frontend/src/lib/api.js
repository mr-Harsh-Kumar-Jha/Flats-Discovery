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
  let devUserID = localStorage.getItem('dev_user_id');
  if (!devUserID || devUserID.startsWith('a0000000-') || devUserID.startsWith('b0000000-')) {
    devUserID = 'a0000001-0000-0000-0000-000000000001';
  }
  headers['X-Dev-User-ID'] = devUserID;

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
  const params = new URLSearchParams({ city: citySlug });
  if (Array.isArray(bbox) && bbox.length >= 4) {
    params.set('sw_lng', bbox[0].toString());
    params.set('sw_lat', bbox[1].toString());
    params.set('ne_lng', bbox[2].toString());
    params.set('ne_lat', bbox[3].toString());
  } else if (bbox && typeof bbox === 'object') {
    if (bbox.sw_lng != null) params.set('sw_lng', bbox.sw_lng.toString());
    if (bbox.sw_lat != null) params.set('sw_lat', bbox.sw_lat.toString());
    if (bbox.ne_lng != null) params.set('ne_lng', bbox.ne_lng.toString());
    if (bbox.ne_lat != null) params.set('ne_lat', bbox.ne_lat.toString());
    if (bbox.limit != null) params.set('limit', bbox.limit.toString());
  }
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
  const params = new URLSearchParams({ city: citySlug });
  if (Array.isArray(bbox) && bbox.length >= 4) {
    params.set('sw_lng', bbox[0].toString());
    params.set('sw_lat', bbox[1].toString());
    params.set('ne_lng', bbox[2].toString());
    params.set('ne_lat', bbox[3].toString());
  } else if (bbox && typeof bbox === 'object') {
    if (bbox.sw_lng != null) params.set('sw_lng', bbox.sw_lng.toString());
    if (bbox.sw_lat != null) params.set('sw_lat', bbox.sw_lat.toString());
    if (bbox.ne_lng != null) params.set('ne_lng', bbox.ne_lng.toString());
    if (bbox.ne_lat != null) params.set('ne_lat', bbox.ne_lat.toString());
    if (bbox.limit != null) params.set('limit', bbox.limit.toString());
  }
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
// Chat & E2EE
// =========================================================================

export async function createDirectRoom(params) {
  let body = {};
  if (typeof params === 'string') {
    body = { match_id: params };
  } else if (params && typeof params === 'object') {
    body = {
      match_id: params.matchId || params.match_id,
      target_user_id: params.targetUserId || params.target_user_id,
      pin_id: params.pinId || params.pin_id,
    };
  }

  const res = await request('/chat/rooms/direct', {
    method: 'POST',
    body: JSON.stringify(body),
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

export async function registerPublicKey(keyData) {
  const res = await request('/chat/keys', {
    method: 'POST',
    body: JSON.stringify(keyData),
  });
  return res.data;
}

export async function fetchUserPublicKey(userId) {
  const res = await request(`/chat/keys/${userId}`);
  return res.data;
}

export async function fetchRoomKeys(roomId) {
  const res = await request(`/chat/rooms/${roomId}/keys`);
  return res;
}

// =========================================================================
// Housing Societies (Flat-Finder Architecture)
// =========================================================================

export async function fetchSocieties(citySlug = 'pune', filters = {}) {
  const params = new URLSearchParams({ city: citySlug });
  if (filters.metro) params.append('metro', filters.metro);
  if (filters.bedroom) params.append('bedroom', filters.bedroom);
  if (filters.sqft) params.append('sqft', filters.sqft.toString());
  if (filters.maxRent) params.append('max_rent', filters.maxRent.toString());

  const res = await request(`/societies?${params}`);
  return res;
}

// =========================================================================
// Tinder for Flatmates
// =========================================================================

export async function fetchFlatmates(citySlug = 'pune', filters = {}) {
  const params = new URLSearchParams({ city: citySlug });
  if (filters.type) params.append('type', filters.type);
  if (filters.food) params.append('food', filters.food);
  if (filters.smoking) params.append('smoking', filters.smoking);
  if (filters.gender) params.append('gender', filters.gender);

  const res = await request(`/flatmates?${params}`);
  return res;
}

export async function swipeFlatmate(targetUserId, swipeType = 'LIKE') {
  const res = await request('/flatmates/swipe', {
    method: 'POST',
    body: JSON.stringify({
      target_user_id: targetUserId,
      swipe_type: swipeType,
    }),
  });
  return res.data;
}

// =========================================================================
// User Onboarding & Profile
// =========================================================================

export async function saveOnboarding(data) {
  const res = await request('/users/onboarding', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return res.data;
}

export async function fetchUserProfile() {
  const res = await request('/users/me');
  return res.data;
}




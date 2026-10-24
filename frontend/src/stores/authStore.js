import { create } from 'zustand';

const DEFAULT_USER = {
  id: 'a0000001-0000-0000-0000-000000000001',
  name: 'Raj P.',
};

function getInitialUser() {
  try {
    const storedId = localStorage.getItem('dev_user_id');
    const storedName = localStorage.getItem('dev_display_name');

    // Upgrade stale placeholder IDs (a0000000-...) to valid seeded user
    if (!storedId || storedId.startsWith('a0000000-') || storedId.startsWith('b0000000-')) {
      localStorage.setItem('dev_user_id', DEFAULT_USER.id);
      localStorage.setItem('dev_display_name', DEFAULT_USER.name);
      return DEFAULT_USER;
    }

    return { id: storedId, name: storedName || DEFAULT_USER.name };
  } catch (e) {
    return DEFAULT_USER;
  }
}

const initial = getInitialUser();

/**
 * Auth store — dev auth with seamless fallback to seeded test users.
 */
export const useAuthStore = create((set) => ({
  userId: initial.id,
  displayName: initial.name,
  isAuthenticated: true,

  // Set user (dev mode)
  login: (userId, displayName) => {
    localStorage.setItem('dev_user_id', userId);
    localStorage.setItem('dev_display_name', displayName || userId.slice(0, 8));
    set({ userId, displayName: displayName || userId.slice(0, 8), isAuthenticated: true });
  },

  logout: () => {
    localStorage.removeItem('dev_user_id');
    localStorage.removeItem('dev_display_name');
    set({ userId: '', displayName: '', isAuthenticated: false });
  },
}));

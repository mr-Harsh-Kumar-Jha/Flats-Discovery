import { create } from 'zustand';

/**
 * Auth store — minimal dev auth for MVP.
 * Production: JWT-based with refresh tokens.
 */
export const useAuthStore = create((set) => ({
  // Current user (dev mode: stored in localStorage)
  userId: localStorage.getItem('dev_user_id') || '',
  displayName: localStorage.getItem('dev_display_name') || '',
  isAuthenticated: !!localStorage.getItem('dev_user_id'),

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

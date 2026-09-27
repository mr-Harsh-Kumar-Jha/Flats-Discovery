import { useState } from 'react';
import { useAuthStore } from '../stores/authStore';

const DEV_USERS = [
  { id: 'a0000000-0000-0000-0000-000000000001', name: 'Test U. (Seeker)' },
  { id: 'b0000000-0000-0000-0000-000000000002', name: 'Flat O. (Owner)' },
];

/**
 * DevAuthBar — Development-only auth switcher.
 * Shows as a subtle bar at the bottom of the screen.
 */
export default function DevAuthBar() {
  const { userId, displayName, isAuthenticated, login, logout } = useAuthStore();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="absolute bottom-0 left-0 right-0 z-20">
      {/* Collapsed bar */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-1.5 bg-slate-100/90 dark:bg-surface-800/90 backdrop-blur border-t border-slate-200 dark:border-white/10 
                   flex items-center justify-between text-xs hover:bg-slate-200/90 dark:hover:bg-surface-700/90 transition-colors"
      >
        <span className="text-slate-400 dark:text-white/30">
          🔧 DEV MODE
        </span>
        <span className="text-slate-500 dark:text-white/50">
          {isAuthenticated ? (
            <>
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5" />
              {displayName}
            </>
          ) : (
            <>
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-400 mr-1.5" />
              Not signed in
            </>
          )}
        </span>
      </button>

      {/* Expanded panel */}
      {isOpen && (
        <div className="bg-slate-100/95 dark:bg-surface-800/95 backdrop-blur border-t border-slate-200 dark:border-white/10 px-4 py-3">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs text-slate-400 dark:text-white/40">Switch user:</span>
            {DEV_USERS.map((user) => (
              <button
                key={user.id}
                onClick={() => {
                  login(user.id, user.name);
                  setIsOpen(false);
                }}
                className={`
                  text-xs px-3 py-1.5 rounded-lg border transition-colors
                  ${userId === user.id
                    ? 'border-teal-500/50 bg-teal-500/10 text-teal-600 dark:text-accent-300'
                    : 'border-slate-200 dark:border-white/10 text-slate-500 dark:text-white/50 hover:border-slate-300 dark:hover:border-white/20 hover:text-slate-700 dark:hover:text-white/70'
                  }
                `}
              >
                {user.name}
              </button>
            ))}
            {isAuthenticated && (
              <button
                onClick={() => {
                  logout();
                  setIsOpen(false);
                }}
                className="text-xs px-3 py-1.5 rounded-lg border border-red-200 dark:border-red-500/30 text-red-500 dark:text-red-400/70 
                           hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors ml-auto"
              >
                Sign out
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

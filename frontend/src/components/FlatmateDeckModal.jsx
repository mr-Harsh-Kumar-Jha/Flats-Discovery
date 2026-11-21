import { useState, useEffect, useRef } from 'react';
import { X, Heart, Star, Sparkles, MapPin, Briefcase, Coffee, ShieldCheck, Flame, ArrowLeft, ArrowRight, MessageSquare, ChevronRight } from 'lucide-react';
import { usePinsStore } from '../stores/pinsStore';
import { swipeFlatmate, createDirectRoom } from '../lib/api';
import { useAuthStore } from '../stores/authStore';

export default function FlatmateDeckModal({ isOpen, onClose, onOpenChat }) {
  const { flatmates, fetchFlatmates, loading } = usePinsStore();
  const { user } = useAuthStore();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [filterType, setFilterType] = useState('ALL'); // 'ALL' | 'HAS_ROOM' | 'SEEKING_PARTNER'
  const [vegOnly, setVegOnly] = useState(false);
  const [nonSmokerOnly, setNonSmokerOnly] = useState(false);

  // Swipe animation states
  const [swipeDirection, setSwipeDirection] = useState(null); // 'left' | 'right' | 'up'
  const [matchData, setMatchData] = useState(null); // { name, roomId, userAvatar }

  // Drag interaction
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const startPosRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (isOpen) {
      fetchFlatmates('pune', {
        type: filterType !== 'ALL' ? filterType : undefined,
        food: vegOnly ? 'VEG' : undefined,
        smoking: nonSmokerOnly ? 'NO' : undefined,
      });
      setCurrentIndex(0);
      setMatchData(null);
    }
  }, [isOpen, filterType, vegOnly, nonSmokerOnly, fetchFlatmates]);

  if (!isOpen) return null;

  const currentCandidate = flatmates && flatmates.length > currentIndex ? flatmates[currentIndex] : null;

  const handleSwipe = async (direction) => {
    if (!currentCandidate) return;

    setSwipeDirection(direction);
    const targetUserId = currentCandidate.user_id;
    const swipeType = direction === 'right' ? 'LIKE' : direction === 'up' ? 'SUPERLIKE' : 'PASS';

    setTimeout(async () => {
      try {
        const res = await swipeFlatmate(targetUserId, swipeType);
        if (res && res.is_match) {
          setMatchData({
            name: currentCandidate.user_name || 'Your Match',
            roomId: res.match_room_id,
            bio: currentCandidate.bio,
            locality: currentCandidate.locality_name,
            role: currentCandidate.occupation,
          });
        }
      } catch (err) {
        // If demo without auth, simulate match for top match candidate
        if (direction === 'right' && (currentCandidate.compatibility_score || 0) >= 92) {
          setMatchData({
            name: currentCandidate.user_name || 'Your Match',
            roomId: 'mock-room-' + targetUserId,
            bio: currentCandidate.bio,
            locality: currentCandidate.locality_name,
            role: currentCandidate.occupation,
          });
        }
      }

      setSwipeDirection(null);
      setDragOffset({ x: 0, y: 0 });
      setCurrentIndex((prev) => prev + 1);
    }, 280);
  };

  // Keyboard navigation
  const handleKeyDown = (e) => {
    if (matchData) return;
    if (e.key === 'ArrowLeft') handleSwipe('left');
    if (e.key === 'ArrowRight') handleSwipe('right');
    if (e.key === 'ArrowUp') handleSwipe('up');
  };

  // Mouse / Touch handlers for swipe drag
  const handleStart = (clientX, clientY) => {
    setIsDragging(true);
    startPosRef.current = { x: clientX, y: clientY };
  };

  const handleMove = (clientX, clientY) => {
    if (!isDragging) return;
    const dx = clientX - startPosRef.current.x;
    const dy = clientY - startPosRef.current.y;
    setDragOffset({ x: dx, y: dy });
  };

  const handleEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);
    if (dragOffset.x > 90) {
      handleSwipe('right');
    } else if (dragOffset.x < -90) {
      handleSwipe('left');
    } else if (dragOffset.y < -90) {
      handleSwipe('up');
    } else {
      setDragOffset({ x: 0, y: 0 });
    }
  };

  const startChatWithMatch = async () => {
    if (matchData && onOpenChat) {
      onOpenChat(matchData.roomId);
    }
    setMatchData(null);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 outline-none"
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      {/* Dimmed Theme Backdrop */}
      <div className="absolute inset-0 bg-black/75 backdrop-blur-md" onClick={onClose} />

      {/* Main Container */}
      <div
        className="relative w-full max-w-[460px] bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 pt-4 pb-3 border-b border-white/10 flex items-center justify-between bg-slate-950/40">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-xl bg-gradient-to-tr from-pink-500 to-rose-600 text-white shadow-md">
              <Flame className="w-5 h-5 fill-white" />
            </span>
            <div>
              <h2 className="text-white font-bold text-base tracking-tight flex items-center gap-1.5">
                Tinder for Flatmates
                <span className="text-[10px] bg-rose-500/20 text-rose-400 border border-rose-500/30 px-1.5 py-0.5 rounded-md font-semibold">
                  Pune
                </span>
              </h2>
              <p className="text-slate-400 text-xs">Swipe to match with verified co-renters</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Filter Bar */}
        <div className="px-5 py-2.5 bg-slate-950/20 border-b border-white/5 flex items-center gap-1.5 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setFilterType('ALL')}
            className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-colors shrink-0 ${
              filterType === 'ALL'
                ? 'bg-emerald-500 text-white'
                : 'bg-white/5 text-slate-400 hover:bg-white/10'
            }`}
          >
            All Candidates
          </button>
          <button
            onClick={() => setFilterType('HAS_ROOM')}
            className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-colors shrink-0 ${
              filterType === 'HAS_ROOM'
                ? 'bg-emerald-500 text-white'
                : 'bg-white/5 text-slate-400 hover:bg-white/10'
            }`}
          >
            🏠 Has a Room
          </button>
          <button
            onClick={() => setFilterType('SEEKING_PARTNER')}
            className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-colors shrink-0 ${
              filterType === 'SEEKING_PARTNER'
                ? 'bg-emerald-500 text-white'
                : 'bg-white/5 text-slate-400 hover:bg-white/10'
            }`}
          >
            🔍 Seeking Co-Renter
          </button>
          <button
            onClick={() => setVegOnly(!vegOnly)}
            className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-colors shrink-0 ${
              vegOnly ? 'bg-amber-500 text-slate-950 font-bold' : 'bg-white/5 text-slate-400'
            }`}
          >
            🥗 Veg Only
          </button>
          <button
            onClick={() => setNonSmokerOnly(!nonSmokerOnly)}
            className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-colors shrink-0 ${
              nonSmokerOnly ? 'bg-cyan-500 text-slate-950 font-bold' : 'bg-white/5 text-slate-400'
            }`}
          >
            🚭 Non-Smoker
          </button>
        </div>

        {/* Card Stage */}
        <div className="relative flex-1 p-5 min-h-[460px] flex items-center justify-center overflow-hidden select-none">
          {currentCandidate ? (
            <div
              className={`relative w-full h-full max-w-[400px] bg-gradient-to-b from-slate-800 to-slate-900 border border-white/10 rounded-2xl shadow-xl overflow-hidden cursor-grab active:cursor-grabbing flex flex-col justify-between transition-transform duration-200 ${
                swipeDirection === 'left'
                  ? '-translate-x-[120%] rotate-[-15deg] opacity-0'
                  : swipeDirection === 'right'
                  ? 'translate-x-[120%] rotate-[15deg] opacity-0'
                  : swipeDirection === 'up'
                  ? '-translate-y-[120%] opacity-0 scale-95'
                  : ''
              }`}
              style={{
                transform: !swipeDirection
                  ? `translate3d(${dragOffset.x}px, ${dragOffset.y}px, 0) rotate(${dragOffset.x * 0.05}deg)`
                  : undefined,
              }}
              onMouseDown={(e) => handleStart(e.clientX, e.clientY)}
              onMouseMove={(e) => handleMove(e.clientX, e.clientY)}
              onMouseUp={handleEnd}
              onTouchStart={(e) => handleStart(e.touches[0].clientX, e.touches[0].clientY)}
              onTouchMove={(e) => handleMove(e.touches[0].clientX, e.touches[0].clientY)}
              onTouchEnd={handleEnd}
            >
              {/* Swipe Indicators */}
              {dragOffset.x > 40 && (
                <div className="absolute top-4 right-4 z-20 border-2 border-emerald-400 text-emerald-400 font-extrabold text-sm px-3 py-1 rounded-xl uppercase tracking-wider rotate-12 bg-emerald-950/80">
                  CONNECT 💚
                </div>
              )}
              {dragOffset.x < -40 && (
                <div className="absolute top-4 left-4 z-20 border-2 border-rose-400 text-rose-400 font-extrabold text-sm px-3 py-1 rounded-xl uppercase tracking-wider -rotate-12 bg-rose-950/80">
                  PASS ❌
                </div>
              )}
              {dragOffset.y < -40 && (
                <div className="absolute top-1/3 left-1/2 -translate-x-1/2 z-20 border-2 border-cyan-400 text-cyan-400 font-extrabold text-sm px-4 py-1.5 rounded-xl uppercase tracking-wider bg-cyan-950/80 shadow-lg">
                  SUPER LIKE ⭐
                </div>
              )}

              {/* Card Header & Avatar Banner */}
              <div className="relative p-5 pb-3 bg-gradient-to-r from-indigo-900/40 via-purple-900/30 to-slate-800/80 border-b border-white/5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-400 to-cyan-500 p-0.5 shadow-lg">
                      <div className="w-full h-full bg-slate-900 rounded-[14px] flex items-center justify-center text-white text-lg font-bold">
                        {currentCandidate.user_name ? currentCandidate.user_name.substring(0, 2).toUpperCase() : 'FL'}
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h3 className="text-white text-lg font-bold tracking-tight">
                          {currentCandidate.user_name || 'Pune Flatmate'}
                        </h3>
                        <ShieldCheck className="w-4 h-4 text-emerald-400" title="Verified User" />
                      </div>
                      <p className="text-slate-400 text-xs flex items-center gap-1">
                        <Briefcase className="w-3.5 h-3.5 text-slate-500" />
                        {currentCandidate.occupation || 'Working Professional'}
                      </p>
                    </div>
                  </div>

                  {/* Compatibility Badge */}
                  <div className="px-2.5 py-1 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-xs font-bold flex items-center gap-1 shadow-sm">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{currentCandidate.compatibility_score || 94}% Match</span>
                  </div>
                </div>

                {/* Listing Type & Budget Pill */}
                <div className="mt-3 flex items-center justify-between">
                  <span
                    className={`text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                      currentCandidate.listing_type === 'HAS_ROOM'
                        ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                        : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    }`}
                  >
                    {currentCandidate.listing_type === 'HAS_ROOM' ? '🏠 Has Room' : '🔍 Seeking Co-Renter'}
                  </span>
                  <div className="text-right">
                    <span className="text-white font-bold text-base">
                      ₹{(currentCandidate.room_rent || 15000).toLocaleString('en-IN')}
                    </span>
                    <span className="text-slate-400 text-xs ml-0.5">/mo</span>
                  </div>
                </div>
              </div>

              {/* Card Body & Traits */}
              <div className="p-5 space-y-3.5 overflow-y-auto max-h-[220px] scrollbar-none">
                {/* Metro & Commute Matrix */}
                <div className="bg-slate-950/50 border border-white/5 rounded-xl p-2.5 space-y-1">
                  <div className="flex items-center justify-between text-xs text-slate-300">
                    <span className="flex items-center gap-1.5 text-slate-400">
                      <MapPin className="w-3.5 h-3.5 text-rose-400" />
                      Locality:
                    </span>
                    <span className="font-semibold text-white">{currentCandidate.locality_name || 'Pune Central'}</span>
                  </div>
                  {currentCandidate.near_metro_line && (
                    <div className="flex items-center justify-between text-xs text-slate-300">
                      <span className="flex items-center gap-1.5 text-slate-400">
                        🚇 Metro:
                      </span>
                      <span className="font-semibold text-cyan-300">
                        {currentCandidate.near_metro_line} ({currentCandidate.metro_dist_meters || 500}m)
                      </span>
                    </div>
                  )}
                  {currentCandidate.commute_office && (
                    <div className="flex items-center justify-between text-xs text-slate-300">
                      <span className="flex items-center gap-1.5 text-slate-400">
                        🚗 Commute:
                      </span>
                      <span className="font-semibold text-amber-300">
                        ~{currentCandidate.commute_mins || 15} mins to {currentCandidate.commute_office}
                      </span>
                    </div>
                  )}
                </div>

                {/* Bio Quote */}
                {currentCandidate.bio && (
                  <p className="text-xs italic text-slate-300 bg-white/5 p-2.5 rounded-xl border border-white/5 leading-relaxed">
                    "{currentCandidate.bio}"
                  </p>
                )}

                {/* Lifestyle Chips */}
                <div>
                  <label className="text-[10px] text-slate-400 uppercase tracking-widest font-bold block mb-1.5">
                    Lifestyle & Habits
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    <span className="text-[11px] px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-slate-300 font-medium">
                      🥗 {currentCandidate.food || 'Vegetarian'}
                    </span>
                    <span className="text-[11px] px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-slate-300 font-medium">
                      🚭 Smoking: {currentCandidate.smoking === 'NO' ? 'Non-Smoker' : 'Occasional'}
                    </span>
                    <span className="text-[11px] px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-slate-300 font-medium">
                      🐾 Pets: {currentCandidate.pets === 'NO_PETS' ? 'No Pets' : 'Pet-Friendly'}
                    </span>
                    <span className="text-[11px] px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-slate-300 font-medium">
                      👤 {currentCandidate.gender || 'Any'} Flatmate
                    </span>
                    {currentCandidate.languages && currentCandidate.languages.length > 0 && (
                      <span className="text-[11px] px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-slate-300 font-medium">
                        🗣️ {currentCandidate.languages.join(', ')}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Card Footer Action Bar */}
              <div className="p-4 bg-slate-950/60 border-t border-white/5 flex items-center justify-around">
                <button
                  onClick={() => handleSwipe('left')}
                  className="w-12 h-12 rounded-full border border-rose-500/40 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 flex items-center justify-center transition-transform hover:scale-110 active:scale-95 shadow-lg"
                  title="Pass (Left Arrow)"
                >
                  <X className="w-5 h-5 stroke-[2.5]" />
                </button>

                <button
                  onClick={() => handleSwipe('up')}
                  className="w-10 h-10 rounded-full border border-cyan-500/40 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 flex items-center justify-center transition-transform hover:scale-110 active:scale-95 shadow-md"
                  title="Super Like (Up Arrow)"
                >
                  <Star className="w-4 h-4 fill-cyan-400" />
                </button>

                <button
                  onClick={() => handleSwipe('right')}
                  className="w-12 h-12 rounded-full border border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 flex items-center justify-center transition-transform hover:scale-110 active:scale-95 shadow-lg"
                  title="Like / Connect (Right Arrow)"
                >
                  <Heart className="w-5 h-5 fill-emerald-400 stroke-emerald-400" />
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 px-6">
              <div className="w-16 h-16 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center mx-auto mb-3 text-slate-500">
                <Sparkles className="w-8 h-8 text-amber-400" />
              </div>
              <h3 className="text-white font-bold text-base mb-1">You've seen all flatmates for now!</h3>
              <p className="text-slate-400 text-xs mb-4 max-w-xs mx-auto">
                Check back soon or broaden your lifestyle and locality filters to discover more co-renters.
              </p>
              <button
                onClick={() => {
                  setFilterType('ALL');
                  setVegOnly(false);
                  setNonSmokerOnly(false);
                  fetchFlatmates('pune');
                  setCurrentIndex(0);
                }}
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-xl transition-colors shadow-md"
              >
                Reset Filters & Start Over
              </button>
            </div>
          )}
        </div>

        {/* Footer Navigation Hints */}
        <div className="px-5 py-2.5 bg-slate-950/60 border-t border-white/5 flex items-center justify-between text-[11px] text-slate-500">
          <span>Tip: Use keyboard arrows ⬅️ ⬆️ ➡️ to swipe</span>
          <span className="font-semibold text-slate-400">
            {currentCandidate ? `${currentIndex + 1} of ${flatmates.length}` : '0 of 0'}
          </span>
        </div>
      </div>

      {/* ── Mutual Match Celebration Modal ── */}
      {matchData && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-[380px] bg-gradient-to-b from-slate-900 to-slate-950 border border-emerald-500/40 rounded-3xl p-6 text-center shadow-2xl animate-scale-up">
            <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-pink-500 to-rose-500 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-rose-500/30">
              <Heart className="w-8 h-8 fill-white text-white" />
            </div>

            <h2 className="text-2xl font-black text-white tracking-tight mb-1">
              It's a Match! 🎉
            </h2>
            <p className="text-slate-300 text-sm mb-4">
              You and <span className="font-bold text-emerald-400">{matchData.name}</span> both liked each other's profile!
            </p>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5 mb-5 text-left">
              <p className="text-xs font-semibold text-white mb-0.5">{matchData.role}</p>
              <p className="text-[11px] text-slate-400 mb-2">📍 {matchData.locality}</p>
              {matchData.bio && (
                <p className="text-xs italic text-slate-300 line-clamp-2">"{matchData.bio}"</p>
              )}
            </div>

            <div className="space-y-2">
              <button
                onClick={startChatWithMatch}
                className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-bold text-sm rounded-xl transition-all shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2"
              >
                <MessageSquare className="w-4 h-4" />
                Start Encrypted Chat (E2EE)
              </button>

              <button
                onClick={() => setMatchData(null)}
                className="w-full py-2.5 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
              >
                Keep Swiping Flatmates
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { useState, useEffect } from 'react';
import MapView from './components/MapView';
import LayerPanel from './components/LayerPanel';
import Sidebar from './components/Sidebar';
import DevAuthBar from './components/DevAuthBar';
import SearchBar from './components/SearchBar';
import AboutModal from './components/AboutModal';
import CreatePinModal from './components/CreatePinModal';
import ChatPanel from './components/ChatPanel';
import PinDetailModal from './components/PinDetailModal';
import FlatmateDeckModal from './components/FlatmateDeckModal';
import UserOnboardingModal from './components/UserOnboardingModal';
import Legend from './components/Legend';
import { useMapStore } from './stores/mapStore';
import { usePinsStore } from './stores/pinsStore';

/**
 * App — Root component.
 * Map-first layout: full-screen map with floating UI panels.
 */
function App() {
  const { pinMode, setPinMode, pendingPinCoords, setPendingPinCoords, selectedPin, setSelectedPin, mobileView, toggleMobileView } = useMapStore();
  const getFilteredFlats = usePinsStore((s) => s.getFilteredFlats);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [flatmateDeckOpen, setFlatmateDeckOpen] = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [createTab, setCreateTab] = useState('flat'); // 'flat' | 'seeker' | 'rent'

  const displayFlats = getFilteredFlats();

  // Trigger onboarding for new users on first visit
  useEffect(() => {
    const hasOnboarded = localStorage.getItem('has_onboarded_v1');
    if (!hasOnboarded) {
      const timer = setTimeout(() => setOnboardingOpen(true), 700);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleCompleteGoal = (goal) => {
    if (goal === 'FLATMATE') {
      setFlatmateDeckOpen(true);
    } else if (goal === 'BUY') {
      usePinsStore.getState().setFilters({ mode: 'buy' });
    } else if (goal === 'RENT') {
      usePinsStore.getState().setFilters({ mode: 'rent' });
    } else if (goal === 'LIST') {
      enterPinMode('flat');
    }
  };

  // When user taps map in pin mode, open the create form
  useEffect(() => {
    if (pendingPinCoords) {
      setCreateModalOpen(true);
    }
  }, [pendingPinCoords]);

  const handleCloseCreate = () => {
    setCreateModalOpen(false);
    setPendingPinCoords(null);
  };

  const enterPinMode = (mode) => {
    setCreateTab(mode === 'rent' ? 'flat' : mode);
    setPinMode(mode);
  };

  return (
    <div className="relative h-full w-full overflow-hidden">
      {/* Full-screen map (base layer) */}
      <MapView />

      {/* Unified Search & Quick Controls */}
      <SearchBar
        onOpenFlatmates={() => setFlatmateDeckOpen(true)}
        onOpenOnboarding={() => setOnboardingOpen(true)}
        onAddListing={() => enterPinMode('flat')}
      />

      {/* Floating UI panels */}
      <Sidebar />
      <LayerPanel />
      <DevAuthBar />
      <AboutModal />
      <ChatPanel />
      <Legend />

      {/* ── Mobile View Toggle Pill (Show List vs Show Map) ── */}
      <div className="md:hidden fixed bottom-14 left-1/2 -translate-x-1/2 z-40">
        <button
          onClick={toggleMobileView}
          className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-slate-950/95 border border-white/20 text-white font-bold text-xs shadow-2xl backdrop-blur-xl hover:scale-105 active:scale-95 transition-all"
        >
          {mobileView === 'map' ? (
            <>
              <span className="text-sm">📋</span>
              <span>Show List ({displayFlats.length})</span>
            </>
          ) : (
            <>
              <span className="text-sm">🗺️</span>
              <span>Show Map</span>
            </>
          )}
        </button>
      </div>

      {/* ── Pin Mode Banner — shown when user is placing a pin ── */}
      {pinMode && (
        <div className="absolute top-[80px] left-1/2 -translate-x-1/2 z-40 w-full max-w-md px-4">
          <div className="pin-mode-banner">
            <div className="flex-1">
              <span className="font-bold text-amber-200">
                {pinMode === 'rent' ? '📍 Tap your location' : pinMode === 'flat' ? '🏠 Tap your flat' : '🔍 Tap where you want to live'}
              </span>
              <span className="text-white/80 text-[13px] ml-1">— tap anywhere on the map</span>
            </div>
            <button
              onClick={() => setPinMode(null)}
              className="px-3 py-1.5 text-xs font-semibold bg-black/25 border border-white/15 rounded-lg text-white hover:bg-black/40 transition-colors shrink-0"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Pin Detail Modal — shown when a pin is selected ── */}
      {selectedPin && (
        <PinDetailModal
          pin={selectedPin.data}
          type={selectedPin.type}
          onClose={() => setSelectedPin(null)}
        />
      )}

      {/* ── Create Pin Modal ── */}
      {createModalOpen && (
        <CreatePinModal
          onClose={handleCloseCreate}
          initialTab={createTab}
          coords={pendingPinCoords}
        />
      )}

      {/* ── Tinder for Flatmates Deck ── */}
      <FlatmateDeckModal
        isOpen={flatmateDeckOpen}
        onClose={() => setFlatmateDeckOpen(false)}
      />

      {/* ── End-to-End User Onboarding ── */}
      <UserOnboardingModal
        isOpen={onboardingOpen}
        onClose={() => setOnboardingOpen(false)}
        onCompleteGoal={handleCompleteGoal}
      />
    </div>
  );
}

export default App;

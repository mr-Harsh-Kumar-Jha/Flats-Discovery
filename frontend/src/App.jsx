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
import Legend from './components/Legend';
import { useMapStore } from './stores/mapStore';

/**
 * App — Root component.
 * Map-first layout: full-screen map with floating UI panels.
 */
function App() {
  const { pinMode, setPinMode, pendingPinCoords, setPendingPinCoords, selectedPin, setSelectedPin } = useMapStore();
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createTab, setCreateTab] = useState('flat'); // 'flat' | 'seeker' | 'rent'

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

      {/* Floating UI panels */}
      <SearchBar />
      <Sidebar />
      <LayerPanel />
      <DevAuthBar />
      <AboutModal />
      <ChatPanel />
      <Legend />

      {/* ── Chicklet Bar (below search) — primary action entry points ── */}
      {!pinMode && (
        <div className="absolute top-[68px] left-1/2 -translate-x-1/2 z-10 flex gap-2 px-3 max-w-[540px] w-full overflow-x-auto scrollbar-none">
          <button
            onClick={() => enterPinMode('rent')}
            className="chicklet"
          >
            <span className="text-sm">📍</span>
            I pay rent here
          </button>
          <button
            onClick={() => enterPinMode('flat')}
            className="chicklet"
          >
            <span className="text-sm">🏠</span>
            List my flat
          </button>
          <button
            onClick={() => enterPinMode('seeker')}
            className="chicklet"
          >
            <span className="text-sm">🔍</span>
            I'm looking
          </button>
        </div>
      )}

      {/* ── Pin Mode Banner — shown when user is placing a pin ── */}
      {pinMode && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 w-[calc(100%-24px)] max-w-[520px]">
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
    </div>
  );
}

export default App;

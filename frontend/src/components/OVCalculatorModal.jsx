import { useState, useEffect } from 'react';
import { X, Activity, Info } from 'lucide-react';

export default function OVCalculatorModal({ onClose }) {
  const [distance, setDistance] = useState(2); // km
  const [budgetGap, setBudgetGap] = useState(0); // % gap (0 = perfect, positive = flat is more expensive)
  const [furnishingMatch, setFurnishingMatch] = useState(1); // 1 = perfect, 0 = mismatch
  const [transitMatch, setTransitMatch] = useState(0.8); // 0-1 scale

  const [score, setScore] = useState(0);

  useEffect(() => {
    // Simulator logic based on weights:
    // Distance (25%): 1.0 for 0km, decays to 0.0 at 10km
    let dScore = Math.max(0, 1 - (distance / 10));
    
    // Budget (35%): 1.0 for 0 gap, decays to 0 at 30% gap
    let bScore = Math.max(0, 1 - (Math.abs(budgetGap) / 30));
    
    // Furnishing (20%)
    let fScore = furnishingMatch;
    
    // Transit (20%)
    let tScore = transitMatch;

    const total = (dScore * 0.25) + (bScore * 0.35) + (fScore * 0.20) + (tScore * 0.20);
    setScore(total);
  }, [distance, budgetGap, furnishingMatch, transitMatch]);

  const getScoreColor = (val) => {
    if (val >= 0.8) return 'text-emerald-500 dark:text-emerald-400 drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]';
    if (val >= 0.6) return 'text-amber-500 dark:text-amber-400 drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]';
    return 'text-rose-500 dark:text-rose-400 drop-shadow-[0_0_8px_rgba(225,29,72,0.5)]';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 theme-backdrop backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative w-full max-w-md bg-white dark:bg-gray-900 border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden p-6">
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 dark:text-gray-400 hover:text-slate-800 dark:hover:text-white p-1 rounded-full hover:bg-slate-100 dark:hover:bg-white/5">
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-indigo-50 dark:bg-primary-500/20 rounded-xl flex items-center justify-center border border-indigo-200 dark:border-primary-500/30">
            <Activity className="w-5 h-5 text-indigo-500 dark:text-primary-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-800 dark:text-white leading-tight">OV Score Simulator</h2>
            <p className="text-xs text-slate-500 dark:text-gray-400">Objectivity Value Algorithm</p>
          </div>
        </div>

        <div className="bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/5 rounded-xl p-6 mb-6 flex flex-col items-center justify-center">
          <div className={`text-5xl font-display font-bold ${getScoreColor(score)} transition-all duration-300`}>
            {Math.round(score * 100)}%
          </div>
          <p className="text-sm text-slate-500 dark:text-gray-400 mt-2 uppercase tracking-widest">Match Quality</p>
        </div>

        <div className="space-y-6">
          <div>
            <label className="flex justify-between text-sm font-medium text-slate-600 dark:text-gray-300 mb-2">
              <span>Distance (<span className="text-emerald-500 dark:text-emerald-400">25% weight</span>)</span>
              <span>{distance} km</span>
            </label>
            <input type="range" min="0" max="10" step="0.5" value={distance} onChange={e => setDistance(parseFloat(e.target.value))} className="w-full accent-emerald-500" />
          </div>
          
          <div>
            <label className="flex justify-between text-sm font-medium text-slate-600 dark:text-gray-300 mb-2">
              <span>Budget Gap (<span className="text-indigo-500 dark:text-primary-400">35% weight</span>)</span>
              <span>{budgetGap}%</span>
            </label>
            <input type="range" min="-30" max="30" step="5" value={budgetGap} onChange={e => setBudgetGap(parseFloat(e.target.value))} className="w-full accent-indigo-500" />
            <p className="text-xs text-slate-400 dark:text-gray-500 mt-1">Negative = Flat is cheaper than budget</p>
          </div>

          <div>
            <label className="flex justify-between text-sm font-medium text-slate-600 dark:text-gray-300 mb-2">
              <span>Furnishing Match (<span className="text-amber-500 dark:text-amber-400">20% weight</span>)</span>
            </label>
            <select className="w-full bg-slate-100 dark:bg-black/50 border border-slate-200 dark:border-white/10 rounded-lg px-3 py-2 text-slate-800 dark:text-white outline-none" value={furnishingMatch} onChange={e => setFurnishingMatch(parseFloat(e.target.value))}>
              <option value="1">Exact Match (1.0)</option>
              <option value="0.5">Partial Match (0.5)</option>
              <option value="0">Mismatch (0.0)</option>
            </select>
          </div>

          <div>
            <label className="flex justify-between text-sm font-medium text-slate-600 dark:text-gray-300 mb-2">
              <span>Transit / Amenities (<span className="text-rose-500 dark:text-rose-400">20% weight</span>)</span>
              <span>{Math.round(transitMatch * 100)}%</span>
            </label>
            <input type="range" min="0" max="1" step="0.1" value={transitMatch} onChange={e => setTransitMatch(parseFloat(e.target.value))} className="w-full accent-rose-500" />
          </div>
        </div>

      </div>
    </div>
  );
}

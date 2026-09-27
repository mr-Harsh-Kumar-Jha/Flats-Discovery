import { useState, useEffect } from 'react';
import { X, Map, ShieldCheck, Activity } from 'lucide-react';

export default function AboutModal() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const hasSeen = localStorage.getItem('seen_intro');
    if (!hasSeen) {
      setIsOpen(true);
    }
  }, []);

  const handleClose = () => {
    localStorage.setItem('seen_intro', 'true');
    setIsOpen(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 theme-backdrop backdrop-blur-sm"
        onClick={handleClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-lg bg-white dark:bg-gray-900 border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden p-1">
        {/* Glow effect */}
        <div className="absolute top-0 left-1/4 right-1/4 h-px bg-gradient-to-r from-transparent via-emerald-500 to-transparent opacity-50"></div>
        
        <div className="bg-white/50 dark:bg-gray-900/50 rounded-xl p-8">
          <button 
            onClick={handleClose}
            className="absolute top-4 right-4 text-slate-400 dark:text-gray-400 hover:text-slate-800 dark:hover:text-white transition-colors p-2 rounded-full hover:bg-slate-100 dark:hover:bg-white/5"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="mb-8">
            <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">Welcome to Pune Flats</h2>
            <p className="text-slate-500 dark:text-gray-400">Zero brokerage. Map-first. Analytics driven.</p>
          </div>

          <div className="space-y-6">
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-12 h-12 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-xl flex items-center justify-center text-emerald-500 dark:text-emerald-400">
                <Map className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-700 dark:text-gray-200 mb-1">Map-First Experience</h3>
                <p className="text-sm text-slate-500 dark:text-gray-400 leading-relaxed">See exactly where flats are located instead of scrolling endless lists. Filter by neighborhood visually.</p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-12 h-12 bg-indigo-50 dark:bg-primary-500/10 border border-indigo-200 dark:border-primary-500/20 rounded-xl flex items-center justify-center text-indigo-500 dark:text-primary-400">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-700 dark:text-gray-200 mb-1">Zero Brokerage</h3>
                <p className="text-sm text-slate-500 dark:text-gray-400 leading-relaxed">Connect directly with owners and seekers. We strip out brokers so you save money and hassle.</p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-12 h-12 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-xl flex items-center justify-center text-amber-500 dark:text-amber-400">
                <Activity className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-700 dark:text-gray-200 mb-1">Analytics Driven</h3>
                <p className="text-sm text-slate-500 dark:text-gray-400 leading-relaxed">Toggle Metro lines, Green cover, and Transport hubs to make data-driven decisions on where to live.</p>
              </div>
            </div>
          </div>

          <button 
            onClick={handleClose}
            className="w-full mt-8 bg-emerald-500 hover:bg-emerald-600 text-white font-medium py-3 rounded-xl transition-colors shadow-lg shadow-emerald-500/20"
          >
            Start Exploring
          </button>
        </div>
      </div>
    </div>
  );
}

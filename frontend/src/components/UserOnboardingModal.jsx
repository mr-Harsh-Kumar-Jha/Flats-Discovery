import { useState } from 'react';
import { X, Check, ArrowRight, ArrowLeft, Flame, Building, Home, MapPin, Briefcase, Sparkles, Train, Coffee, ShieldCheck } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { usePinsStore } from '../stores/pinsStore';
import { useMapStore } from '../stores/mapStore';
import { saveOnboarding } from '../lib/api';

const GOALS = [
  {
    id: 'FLATMATE',
    icon: '🔥',
    title: 'Find Flatmates & Rooms',
    subtitle: 'Tinder-style matching based on lifestyle, diet, and office commute',
    badge: 'Popular',
    color: 'from-rose-500/20 to-pink-500/20 border-rose-500/40 text-rose-300',
  },
  {
    id: 'RENT',
    icon: '🏠',
    title: 'Rent a Flat / Home',
    subtitle: 'Explore verified apartments with transparent rents & bedroom sizes',
    badge: 'Direct Owner',
    color: 'from-emerald-500/20 to-teal-500/20 border-emerald-500/40 text-emerald-300',
  },
  {
    id: 'BUY',
    icon: '💎',
    title: 'Buy / Yield Investment',
    subtitle: 'Societies with 3.5%+ rental yield, P/R ratio & capital appreciation',
    badge: 'Investor',
    color: 'from-indigo-500/20 to-violet-500/20 border-indigo-500/40 text-indigo-300',
  },
  {
    id: 'LIST',
    icon: '📍',
    title: 'List My Flat or Room',
    subtitle: 'Post your property pin or find replacement flatmate with zero brokerage',
    badge: 'No Broker',
    color: 'from-amber-500/20 to-orange-500/20 border-amber-500/40 text-amber-300',
  },
];

const OFFICE_HUBS = [
  { id: 'hinjewadi', name: 'Hinjewadi IT Park (Phases 1-3)', lat: 18.5913, lng: 73.7389 },
  { id: 'magarpatta', name: 'Magarpatta Cybercity (Hadapsar)', lat: 18.5146, lng: 73.9298 },
  { id: 'kharadi', name: 'EON IT Park / World Trade Center (Kharadi)', lat: 18.5514, lng: 73.9532 },
  { id: 'baner', name: 'Baner-Balewadi High Street', lat: 18.5590, lng: 73.7868 },
  { id: 'sb_road', name: 'Senapati Bapat Road / Shivajinagar', lat: 18.5322, lng: 73.8497 },
];

export default function UserOnboardingModal({ isOpen, onClose, onCompleteGoal }) {
  const { userId, displayName, login } = useAuthStore();
  const { setFilters } = usePinsStore();
  const { mapInstance } = useMapStore();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    goal: 'FLATMATE',
    firstName: displayName?.split(' ')[0] || '',
    lastName: displayName?.split(' ')[1] || '',
    phone: '+919876543001',
    occupation: 'Software Engineer @ Tech Hub',
    officeHub: 'hinjewadi',
    metroLine: 'LINE3',
    maxRent: 20000,
    maxBuyPrice: 8500000,
    food: 'VEG',
    smoking: 'NO',
    pets: 'NO_PETS',
    gender: 'MALE',
    sleepCycle: 'EARLY_BIRD',
    languages: ['English', 'Hindi'],
    bio: 'Looking for clean, friendly flatmates near my workplace with good metro connectivity.',
  });

  if (!isOpen) return null;

  const update = (field, val) => setFormData((prev) => ({ ...prev, [field]: val }));

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const payload = {
        user_id: userId,
        goal: formData.goal,
        first_name: formData.firstName || 'Pune',
        last_name: formData.lastName || 'User',
        display_name: `${formData.firstName} ${formData.lastName ? formData.lastName[0] + '.' : ''}`.trim(),
        occupation: formData.occupation,
        city_slug: 'pune',
        office_hub: formData.officeHub,
        metro_line: formData.metroLine,
        budget_max: formData.goal === 'BUY' ? formData.maxBuyPrice : formData.maxRent,
        current_rent: formData.maxRent,
        food: formData.food,
        smoking: formData.smoking,
        pets: formData.pets,
        gender: formData.gender,
        sleep_cycle: formData.sleepCycle,
        languages: formData.languages,
        bio: formData.bio,
      };

      await saveOnboarding(payload);

      // Update Auth Display Name
      login(userId, payload.display_name);

      // Tailor Store Filters
      if (formData.goal === 'BUY') {
        setFilters({
          mode: 'buy',
          maxPrice: formData.maxBuyPrice,
          nearMetro: formData.metroLine !== 'ANY' ? formData.metroLine : '',
          officeCommute: formData.officeHub,
        });
      } else {
        setFilters({
          mode: 'rent',
          maxRent: formData.maxRent,
          nearMetro: formData.metroLine !== 'ANY' ? formData.metroLine : '',
          officeCommute: formData.officeHub,
        });
      }

      // Fly to preferred workplace hub
      const hub = OFFICE_HUBS.find((h) => h.id === formData.officeHub);
      if (hub && mapInstance) {
        mapInstance.flyTo({ center: [hub.lng, hub.lat], zoom: 14.5, speed: 1.2 });
      }

      // Save onboarding flag locally
      localStorage.setItem('has_onboarded_v1', 'true');

      if (onCompleteGoal) {
        onCompleteGoal(formData.goal);
      }

      onClose();
    } catch (err) {
      console.warn('Onboarding save error:', err);
      // Fallback local save
      login(userId, formData.firstName || 'User');
      if (onCompleteGoal) onCompleteGoal(formData.goal);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-4 animate-fade-in">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={onClose} />

      {/* Modal Dialog */}
      <div
        className="relative w-full max-w-[500px] bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with Progress Steps */}
        <div className="px-6 pt-5 pb-4 border-b border-white/10 bg-slate-950/40">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-500 flex items-center justify-center text-white font-black text-sm shadow-md">
                PF
              </span>
              <div>
                <h3 className="text-white font-bold text-sm tracking-tight flex items-center gap-1.5">
                  Welcome to Pune Flats
                </h3>
                <p className="text-slate-400 text-[11px]">Step {step} of 4</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-500 h-full transition-all duration-300"
              style={{ width: `${(step / 4) * 100}%` }}
            />
          </div>
        </div>

        {/* Wizard Step Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh] scrollbar-none space-y-4">
          {/* STEP 1: What is your primary goal? */}
          {step === 1 && (
            <div className="space-y-3 animate-fade-in">
              <div className="text-center mb-4">
                <h2 className="text-lg font-bold text-white mb-1">What brings you to Pune?</h2>
                <p className="text-slate-400 text-xs">We will tailor your map, recommendations, and feed</p>
              </div>

              <div className="grid grid-cols-1 gap-2.5">
                {GOALS.map((g) => {
                  const isSelected = formData.goal === g.id;
                  return (
                    <button
                      key={g.id}
                      onClick={() => update('goal', g.id)}
                      className={`text-left p-3.5 rounded-2xl border transition-all flex items-start gap-3.5 ${
                        isSelected
                          ? `bg-slate-800/90 border-emerald-500 shadow-md ring-1 ring-emerald-500/50`
                          : 'bg-slate-950/40 border-white/5 hover:border-white/15 hover:bg-slate-800/40'
                      }`}
                    >
                      <span className="text-2xl p-2 rounded-xl bg-white/5 shrink-0">{g.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <h4 className="text-sm font-bold text-white tracking-tight">{g.title}</h4>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${g.color}`}>
                            {g.badge}
                          </span>
                        </div>
                        <p className="text-slate-400 text-xs leading-relaxed">{g.subtitle}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 2: Identity & Work */}
          {step === 2 && (
            <div className="space-y-4 animate-fade-in">
              <div className="text-center mb-3">
                <h2 className="text-lg font-bold text-white mb-1">Your Identity & Occupation</h2>
                <p className="text-slate-400 text-xs">Shown to potential flatmates and verified property owners</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-slate-400 font-semibold block mb-1">First Name</label>
                  <input
                    type="text"
                    value={formData.firstName}
                    onChange={(e) => update('firstName', e.target.value)}
                    placeholder="e.g. Raj"
                    className="w-full text-xs p-3 rounded-xl bg-slate-950/60 border border-white/10 text-white outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 font-semibold block mb-1">Last Name</label>
                  <input
                    type="text"
                    value={formData.lastName}
                    onChange={(e) => update('lastName', e.target.value)}
                    placeholder="e.g. Patel"
                    className="w-full text-xs p-3 rounded-xl bg-slate-950/60 border border-white/10 text-white outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] text-slate-400 font-semibold block mb-1">Occupation & Company</label>
                <div className="relative">
                  <Briefcase className="w-4 h-4 text-slate-500 absolute left-3 top-3.5" />
                  <input
                    type="text"
                    value={formData.occupation}
                    onChange={(e) => update('occupation', e.target.value)}
                    placeholder="e.g. Software Engineer @ Infosys Hinjewadi"
                    className="w-full text-xs pl-9 pr-3 py-3 rounded-xl bg-slate-950/60 border border-white/10 text-white outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] text-slate-400 font-semibold block mb-1">Gender</label>
                <div className="grid grid-cols-3 gap-2">
                  {['MALE', 'FEMALE', 'ANY'].map((g) => (
                    <button
                      key={g}
                      onClick={() => update('gender', g)}
                      className={`text-xs py-2.5 rounded-xl font-semibold border transition-all ${
                        formData.gender === g
                          ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                          : 'bg-slate-950/40 border-white/5 text-slate-400 hover:bg-slate-800'
                      }`}
                    >
                      {g === 'MALE' ? '👨 Male' : g === 'FEMALE' ? '👩 Female' : '🌈 Any'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Commute Hub, Metro & Budget */}
          {step === 3 && (
            <div className="space-y-4 animate-fade-in">
              <div className="text-center mb-3">
                <h2 className="text-lg font-bold text-white mb-1">Office Commute & Budget</h2>
                <p className="text-slate-400 text-xs">We rank flats & flatmates by proximity to your daily workplace</p>
              </div>

              {/* Office Hub Selector */}
              <div>
                <label className="text-[11px] text-slate-400 font-semibold block mb-1 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-amber-400" />
                  Primary Workplace / College Hub
                </label>
                <div className="space-y-2">
                  {OFFICE_HUBS.map((hub) => (
                    <button
                      key={hub.id}
                      onClick={() => update('officeHub', hub.id)}
                      className={`w-full text-left p-2.5 rounded-xl border text-xs font-medium transition-all flex items-center justify-between ${
                        formData.officeHub === hub.id
                          ? 'bg-amber-500/15 border-amber-500/60 text-amber-200'
                          : 'bg-slate-950/40 border-white/5 text-slate-400 hover:bg-slate-800/40'
                      }`}
                    >
                      <span>{hub.name}</span>
                      {formData.officeHub === hub.id && <Check className="w-4 h-4 text-amber-400" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Metro Line Filter */}
              <div>
                <label className="text-[11px] text-slate-400 font-semibold block mb-1 flex items-center gap-1">
                  <Train className="w-3.5 h-3.5 text-cyan-400" />
                  Preferred Pune Metro Line
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    ['LINE3', '🚇 Line 3 (Hinjewadi)'],
                    ['AQUA', '🚇 Aqua (Vanaz-Ramwadi)'],
                    ['PURPLE', '🚇 Purple (PCMC-Swargate)'],
                    ['ANY', '🚶 Any / Not Needed'],
                  ].map(([val, label]) => (
                    <button
                      key={val}
                      onClick={() => update('metroLine', val)}
                      className={`text-xs p-2 rounded-xl border text-left font-semibold transition-all ${
                        formData.metroLine === val
                          ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300'
                          : 'bg-slate-950/40 border-white/5 text-slate-400 hover:bg-slate-800'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Budget Slider */}
              {formData.goal === 'BUY' ? (
                <div>
                  <div className="flex justify-between items-center text-xs mb-1">
                    <span className="text-slate-400 font-semibold">Max Purchase Budget</span>
                    <span className="text-indigo-400 font-bold">
                      ₹{(formData.maxBuyPrice / 100000).toFixed(0)} Lakhs
                    </span>
                  </div>
                  <input
                    type="range"
                    min="3500000"
                    max="35000000"
                    step="500000"
                    value={formData.maxBuyPrice}
                    onChange={(e) => update('maxBuyPrice', parseInt(e.target.value))}
                    className="w-full accent-indigo-500 h-1.5"
                  />
                </div>
              ) : (
                <div>
                  <div className="flex justify-between items-center text-xs mb-1">
                    <span className="text-slate-400 font-semibold">Max Monthly Rent / Share</span>
                    <span className="text-emerald-400 font-bold">₹{formData.maxRent.toLocaleString('en-IN')}/mo</span>
                  </div>
                  <input
                    type="range"
                    min="6000"
                    max="60000"
                    step="1000"
                    value={formData.maxRent}
                    onChange={(e) => update('maxRent', parseInt(e.target.value))}
                    className="w-full accent-emerald-500 h-1.5"
                  />
                </div>
              )}
            </div>
          )}

          {/* STEP 4: Lifestyle & Compatibility (Crucial for Tinder for Flatmates!) */}
          {step === 4 && (
            <div className="space-y-4 animate-fade-in">
              <div className="text-center mb-3">
                <h2 className="text-lg font-bold text-white mb-1">Lifestyle & Roommate Traits</h2>
                <p className="text-slate-400 text-xs">Powers the Compatibility Match % in your swipe deck</p>
              </div>

              {/* Food Preference */}
              <div>
                <label className="text-[11px] text-slate-400 font-semibold block mb-1">Food / Dietary</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {[
                    ['VEG', '🥗 Veg'],
                    ['NON_VEG', '🍗 Non-Veg'],
                    ['EGGETARIAN', '🍳 Egg'],
                    ['VEGAN', '🌱 Vegan'],
                  ].map(([val, label]) => (
                    <button
                      key={val}
                      onClick={() => update('food', val)}
                      className={`text-xs py-2 rounded-xl font-semibold border transition-all ${
                        formData.food === val
                          ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                          : 'bg-slate-950/40 border-white/5 text-slate-400'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Smoking & Pets */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-slate-400 font-semibold block mb-1">Smoking</label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      ['NO', '🚭 No'],
                      ['OCCASIONAL', '💨 Yes'],
                    ].map(([val, label]) => (
                      <button
                        key={val}
                        onClick={() => update('smoking', val)}
                        className={`text-xs py-2 rounded-xl font-semibold border transition-all ${
                          formData.smoking === val
                            ? 'bg-rose-500/20 border-rose-500 text-rose-300'
                            : 'bg-slate-950/40 border-white/5 text-slate-400'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[11px] text-slate-400 font-semibold block mb-1">Pets</label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      ['NO_PETS', '🚫 No'],
                      ['PETS_WELCOME', '🐾 Ok'],
                    ].map(([val, label]) => (
                      <button
                        key={val}
                        onClick={() => update('pets', val)}
                        className={`text-xs py-2 rounded-xl font-semibold border transition-all ${
                          formData.pets === val
                            ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                            : 'bg-slate-950/40 border-white/5 text-slate-400'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Bio */}
              <div>
                <label className="text-[11px] text-slate-400 font-semibold block mb-1">Short Bio</label>
                <textarea
                  value={formData.bio}
                  onChange={(e) => update('bio', e.target.value)}
                  rows={2}
                  placeholder="Tell potential flatmates what you love, your work schedule, and habits..."
                  className="w-full text-xs p-3 rounded-xl bg-slate-950/60 border border-white/10 text-white outline-none focus:border-emerald-500 resize-none"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="px-6 py-4 bg-slate-950/80 border-t border-white/10 flex items-center justify-between">
          {step > 1 ? (
            <button
              onClick={() => setStep((s) => s - 1)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white flex items-center gap-1.5 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back
            </button>
          ) : (
            <div />
          )}

          {step < 4 ? (
            <button
              onClick={() => setStep((s) => s + 1)}
              className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-emerald-500/20 transition-all hover:scale-105"
            >
              Next Step
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-emerald-500/25 transition-all hover:scale-105 disabled:opacity-50"
            >
              {loading ? 'Setting up profile...' : 'Launch My Experience 🚀'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

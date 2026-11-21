import { useState, useRef, useEffect } from 'react';
import { X, Share2, Flag, MapPin, Home, Calendar, MessageSquare, Send, Users, Briefcase, ChevronLeft, ChevronRight, Building, Droplets, Zap, Car, ShieldCheck, Lock, TrendingUp, Compass, Award, Calculator, Train } from 'lucide-react';
import { createDirectRoom, fetchMessages } from '../lib/api';
import { useAuthStore } from '../stores/authStore';
import { usePinsStore } from '../stores/pinsStore';
import { getRoomSharedKey, encryptMessage, decryptMessage } from '../lib/e2ee';

function formatRent(rent) {
  if (!rent) return '0';
  if (rent >= 10000000) return (rent / 10000000).toFixed(1) + 'Cr';
  if (rent >= 100000) return (rent / 100000).toFixed(1) + 'L';
  if (rent >= 1000) return (rent / 1000).toFixed(1) + 'k';
  return rent.toString();
}

function formatFurnishing(val) {
  if (!val) return '';
  return val.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

function formatEnum(val) {
  if (!val) return '';
  return val.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * PinDetailModal — Multi-slide carousel detail view for a pin or housing society.
 * 3 slides:
 *   - For Flat (Rent): Overview → People → Chat
 *   - For Flat (Buy): Overview → Mortgage & Yield → Owner Desk
 *   - For Society: Complex Overview → Commute & Yield ROI → Inquire Desk
 *   - For Seeker: Overview → Chat
 */
export default function PinDetailModal({ pin, type, onClose }) {
  if (!pin) return null;

  const mode = usePinsStore(s => s.filters.mode);
  const isSociety = type === 'society';
  const isFlat = type === 'flat';
  const isSeeker = type === 'seeker';
  const isBuyMode = mode === 'buy';

  const [activeSlide, setActiveSlide] = useState(0);
  const carouselRef = useRef(null);

  // Financial calculations for Buy mode / Flat sale
  const estimatedPrice = pin.min_price || (pin.rent ? pin.rent * 320 : 6800000);
  const sqft = pin.min_sqft || (pin.bhk_config === '1BHK' ? 650 : pin.bhk_config === '2BHK' ? 1050 : pin.bhk_config === '3BHK' ? 1450 : 1850);
  const psf = pin.avg_price_per_sqft || Math.round(estimatedPrice / sqft);
  const emi = Math.round((estimatedPrice * 0.8 * (8.5 / 1200) * Math.pow(1 + 8.5/1200, 240)) / (Math.pow(1 + 8.5/1200, 240) - 1));
  const yieldPct = pin.rental_yield_pct || (pin.rent ? ((pin.rent * 12) / estimatedPrice * 100).toFixed(1) : '3.6');

  const accentColor = isSociety ? '#6366f1' : (isFlat ? (isBuyMode ? '#818cf8' : '#10b981') : '#6366f1');
  const amount = isFlat ? (isBuyMode ? estimatedPrice : pin.rent) : pin.budget_max;
  const config = isFlat ? pin.bhk_config : (pin.bhk_configs?.join(', ') || 'Any');

  const slideLabels = isSociety
    ? ['Overview', 'Commute & ROI', 'Inquire Desk']
    : (isFlat
      ? (isBuyMode ? ['Overview', 'Loan & Yield', 'Contact'] : ['Overview', 'People', 'Chat'])
      : ['Overview', 'Chat']);

  const scrollToSlide = (index) => {
    if (carouselRef.current) {
      const slideWidth = carouselRef.current.offsetWidth;
      carouselRef.current.scrollTo({ left: slideWidth * index, behavior: 'smooth' });
      setActiveSlide(index);
    }
  };

  const handleScroll = () => {
    if (carouselRef.current) {
      const slideWidth = carouselRef.current.offsetWidth;
      const scrollLeft = carouselRef.current.scrollLeft;
      const newSlide = Math.round(scrollLeft / slideWidth);
      if (newSlide !== activeSlide) setActiveSlide(newSlide);
    }
  };

  const handleShare = async () => {
    const text = isSociety
      ? `${pin.name} (${pin.locality}) — ${pin.rental_yield_pct}% Gross Yield on PuneFlats`
      : isBuyMode
      ? `${config} for Sale for ₹${formatRent(estimatedPrice)} on PuneFlats`
      : `${config} available for ₹${formatRent(amount)}/mo on PuneFlats`;

    if (navigator.share) {
      try {
        await navigator.share({ title: 'PuneFlats', text, url: window.location.href });
      } catch { }
    } else {
      await navigator.clipboard.writeText(text + ' — ' + window.location.href);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 theme-backdrop backdrop-blur-sm" />

      {/* Modal card */}
      <div
        className="relative w-full max-w-[440px] max-h-[88vh] bg-white dark:bg-[#161625] rounded-t-2xl sm:rounded-2xl border border-slate-200 dark:border-white/8 shadow-2xl animate-slide-up overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 pb-0">
          <div className="flex items-start justify-between mb-3">
            <div>
              {isSociety ? (
                <div>
                  <div className="text-indigo-400 text-[11px] uppercase tracking-widest font-bold mb-1 flex items-center gap-1.5">
                    <Building className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Housing Society &amp; Complex</span>
                  </div>
                  <div className="text-slate-900 dark:text-white text-2xl font-black tracking-tight">
                    {pin.name}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-white/60 font-medium mt-0.5">
                    📍 {pin.locality} · {pin.towers_count || 6} Towers · {pin.units_count || 350} Units
                  </div>
                </div>
              ) : isFlat && isBuyMode ? (
                <div>
                  <div className="text-indigo-500 dark:text-indigo-400 text-[11px] uppercase tracking-widest font-bold mb-1 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-indigo-500 inline-block" />
                    <span>Individual Flat for Sale</span>
                  </div>
                  <div className="text-slate-900 dark:text-white text-3xl font-bold tracking-tight" style={{ letterSpacing: '-1px' }}>
                    ₹{formatRent(estimatedPrice)}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-white/60 font-medium mt-0.5">
                    ₹{psf.toLocaleString('en-IN')}/sqft · {sqft} sq.ft. · {config}
                  </div>
                </div>
              ) : (
                <div>
                  <div className="text-emerald-700 dark:text-emerald-400 text-[11px] uppercase tracking-widest font-bold mb-1 flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${isFlat ? 'bg-emerald-500' : 'bg-indigo-500'} inline-block`} />
                    {isFlat ? 'Flat for Rent' : 'Seeker Profile'}
                  </div>
                  <div className="text-slate-900 dark:text-white text-3xl font-bold tracking-tight" style={{ letterSpacing: '-1px' }}>
                    ₹{formatRent(amount)}
                    {isFlat && <span className="text-slate-500 dark:text-white/60 text-lg font-medium ml-1">/mo</span>}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleShare}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-white/10 border border-slate-200/60 dark:border-white/10 text-slate-600 dark:text-white/70 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-white/20 flex items-center justify-center transition-all"
                title="Share"
              >
                <Share2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-white/10 border border-slate-200/60 dark:border-white/10 text-slate-600 hover:text-slate-900 dark:text-white/70 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-white/20 flex items-center justify-center transition-all"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Slide Nav Dots + Labels */}
          <div className="flex items-center justify-center gap-2 mb-4">
            {slideLabels.map((label, i) => (
              <button
                key={i}
                onClick={() => scrollToSlide(i)}
                className={`text-[11px] px-3.5 py-1.5 rounded-full font-semibold transition-all ${
                  activeSlide === i
                    ? 'bg-slate-900 text-white dark:bg-white/15 dark:text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900 dark:bg-white/5 dark:text-white/60 dark:hover:bg-white/10 dark:hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Carousel */}
        <div
          ref={carouselRef}
          onScroll={handleScroll}
          className="flex-1 overflow-x-auto overflow-y-hidden snap-x snap-mandatory scrollbar-none flex"
          style={{ scrollSnapType: 'x mandatory' }}
        >
          {/* ═══ Slide 1: Overview ═══ */}
          <div className="w-full flex-shrink-0 snap-center overflow-y-auto px-6 pb-6" style={{ minWidth: '100%' }}>
            {isSociety ? (
              /* Society Overview */
              <div>
                {/* Badges */}
                <div className="flex flex-wrap gap-1.5 mb-4">
                  <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" />
                    {pin.rera_id || 'MahaRERA Verified'}
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 text-[10px] font-bold flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" />
                    {pin.rental_yield_pct}% Gross Yield
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-400 text-[10px] font-bold">
                    P/R: {pin.price_to_rent_ratio || 27.5}
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-white/80 text-[10px] font-bold">
                    Bed: {pin.min_bedroom_dims || '11x12'}
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold">
                    💎 {pin.available_sales_count || 2} For Sale
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[10px] font-bold">
                    🏠 {pin.available_rentals_count || 1} Rentals
                  </span>
                </div>

                {/* Society Financials Grid */}
                <div className="grid grid-cols-2 gap-2 mb-4">
                  <DetailCell icon={<Building className="w-3.5 h-3.5 text-indigo-400" />} label="Starting Price" value={`₹${formatRent(pin.min_price)}`} />
                  <DetailCell icon={<TrendingUp className="w-3.5 h-3.5 text-emerald-400" />} label="Avg Rate" value={`₹${(pin.avg_price_per_sqft || 7800).toLocaleString('en-IN')}/sqft`} />
                  <DetailCell icon={<Home className="w-3.5 h-3.5 text-indigo-400" />} label="Rent Range" value={`₹${formatRent(pin.min_rent)} - ₹${formatRent(pin.max_rent)}/mo`} />
                  <DetailCell icon={<Calculator className="w-3.5 h-3.5 text-indigo-400" />} label="Est. Loan EMI" value={`~₹${formatRent(emi)}/mo`} />
                </div>

                {/* Metro Connectivity */}
                {pin.nearest_metro_station && (
                  <div className="mb-4 p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <Train className="w-4 h-4 text-emerald-500" />
                      <div>
                        <div className="font-bold text-slate-800 dark:text-white">{pin.nearest_metro_station}</div>
                        <div className="text-[10px] text-slate-500 dark:text-white/50">{pin.metro_line || 'Metro Network'}</div>
                      </div>
                    </div>
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                      {pin.metro_distance_meters ? `${pin.metro_distance_meters}m walk` : 'Direct Station'}
                    </span>
                  </div>
                )}

                {/* Office Commute Grid */}
                {pin.office_commute && Object.keys(pin.office_commute).length > 0 && (
                  <div className="mb-4">
                    <h4 className="text-[10px] uppercase tracking-widest font-bold text-slate-400 dark:text-white/40 mb-2">
                      🚗 Tech Park Peak Commute
                    </h4>
                    <div className="grid grid-cols-3 gap-1.5 text-center">
                      {Object.entries(pin.office_commute).slice(0, 6).map(([hub, mins]) => (
                        <div key={hub} className="p-2 rounded-lg bg-slate-50 dark:bg-white/5 border border-slate-200/60 dark:border-white/5">
                          <div className="text-[10px] text-slate-500 dark:text-white/50 capitalize truncate">{hub}</div>
                          <div className="text-xs font-bold text-slate-800 dark:text-white">{mins} mins</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Amenities */}
                {pin.amenities && pin.amenities.length > 0 && (
                  <div className="mb-4">
                    <h4 className="text-[10px] uppercase tracking-widest font-bold text-slate-400 dark:text-white/40 mb-2">
                      ✨ Society Amenities
                    </h4>
                    <div className="flex flex-wrap gap-1.5">
                      {pin.amenities.map(a => (
                        <span key={a} className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-white/70">
                          {a}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Description */}
                {pin.description && (
                  <div className="rounded-xl border border-slate-200 bg-white p-3.5 dark:border-white/10 dark:bg-[#171725] mb-4">
                    <p className="text-xs leading-relaxed text-slate-700 dark:text-slate-100">
                      {pin.description}
                    </p>
                  </div>
                )}
              </div>
            ) : isFlat && isBuyMode ? (
              /* Flat for Sale Overview */
              <div>
                <div className="flex flex-wrap gap-1.5 mb-4">
                  <Badge color="#4f46e5" text={config} />
                  <Badge color="#10b981" text={`${yieldPct}% Yield`} />
                  <Badge color="#06b6d4" text="Freehold Title" />
                  <Badge color="#d97706" text="Ready to Move" />
                </div>

                <div className="grid grid-cols-2 gap-2 mb-4">
                  <DetailCell icon={<Calculator className="w-3.5 h-3.5 text-indigo-400" />} label="Est. Loan EMI" value={`~₹${formatRent(emi)}/mo`} />
                  <DetailCell icon={<TrendingUp className="w-3.5 h-3.5 text-emerald-400" />} label="Rent Potential" value={`~₹${formatRent(pin.rent)}/mo`} />
                  <DetailCell icon={<Building className="w-3.5 h-3.5 text-indigo-400" />} label="Carpet Area" value={`${sqft} sq.ft.`} />
                  <DetailCell icon={<Home className="w-3.5 h-3.5 text-indigo-400" />} label="Down Payment" value={`₹${formatRent(estimatedPrice * 0.2)} (20%)`} />
                  {pin.floor_number != null && (
                    <DetailCell icon={<Building className="w-3.5 h-3.5 text-indigo-400" />} label="Floor" value={`${pin.floor_number}${pin.total_floors ? ` / ${pin.total_floors}` : ''}`} />
                  )}
                  {pin.parking && pin.parking !== 'NONE' && (
                    <DetailCell icon={<Car className="w-3.5 h-3.5 text-indigo-400" />} label="Parking" value={formatEnum(pin.parking)} />
                  )}
                </div>

                {pin.description && (
                  <div className="mb-4 rounded-xl border border-slate-200 bg-white p-3.5 dark:border-white/10 dark:bg-[#171725]">
                    <p className="text-xs leading-relaxed italic text-slate-700 dark:text-slate-100">
                      "{pin.description}"
                    </p>
                  </div>
                )}
              </div>
            ) : (
              /* Flat for Rent / Seeker Overview */
              <div>
                <div className="flex flex-wrap gap-1.5 mb-4">
                  <Badge color={accentColor} text={config} />
                  {isFlat && pin.property_type && (
                    <Badge color="#4f46e5" text={formatEnum(pin.property_type)} />
                  )}
                  {isFlat && pin.furnishing && (
                    <Badge color="#d97706" text={formatFurnishing(pin.furnishing)} />
                  )}
                  {isFlat && pin.parking && pin.parking !== 'NONE' && (
                    <Badge color="#7c3aed" text={`🅿️ ${formatEnum(pin.parking)}`} />
                  )}
                  {!isFlat && (
                    <Badge color="#4f46e5" text={`${pin.search_radius_km || 5}km radius`} />
                  )}
                </div>

                {isFlat && (
                  <div className="grid grid-cols-2 gap-2 mb-4">
                    {pin.deposit_amount && (
                      <DetailCell icon={<Building className="w-3.5 h-3.5" />} label="Deposit" value={`₹${formatRent(pin.deposit_amount)}`} />
                    )}
                    {pin.floor_number != null && (
                      <DetailCell icon={<Building className="w-3.5 h-3.5" />} label="Floor" value={`${pin.floor_number}${pin.total_floors ? ` / ${pin.total_floors}` : ''}`} />
                    )}
                    {pin.water_supply && pin.water_supply !== 'MUNICIPAL' && (
                      <DetailCell icon={<Droplets className="w-3.5 h-3.5" />} label="Water" value={formatEnum(pin.water_supply)} />
                    )}
                    {pin.power_backup && pin.power_backup !== 'NONE' && (
                      <DetailCell icon={<Zap className="w-3.5 h-3.5" />} label="Power" value={formatEnum(pin.power_backup)} />
                    )}
                    {pin.available_from && (
                      <DetailCell icon={<Calendar className="w-3.5 h-3.5" />} label="Available" value={new Date(pin.available_from).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} />
                    )}
                    {pin.lease_duration && (
                      <DetailCell icon={<Home className="w-3.5 h-3.5" />} label="Lease" value={formatEnum(pin.lease_duration)} />
                    )}
                  </div>
                )}

                {pin.description && (
                  <div className="mb-4 rounded-xl border border-slate-200 bg-white p-3.5 dark:border-white/10 dark:bg-[#171725]">
                    <p className="text-xs leading-relaxed italic text-slate-700 dark:text-slate-100">
                      "{pin.description}"
                    </p>
                  </div>
                )}

                {!isFlat && pin.notes && (
                  <div className="mb-4 rounded-xl border border-slate-200 bg-white p-3.5 dark:border-white/10 dark:bg-[#171725]">
                    <p className="text-xs leading-relaxed text-slate-700 dark:text-slate-100">
                      {pin.notes}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ═══ Slide 2: People or ROI ═══ */}
          <div className="w-full flex-shrink-0 snap-center overflow-y-auto px-6 pb-6" style={{ minWidth: '100%' }}>
            {isSociety ? (
              /* Society ROI & Investment Breakdown */
              <div className="space-y-4">
                <h3 className="text-[11px] text-slate-600 dark:text-white/60 uppercase tracking-widest font-bold flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-indigo-400 inline" />
                  Investment Yield Matrix
                </h3>
                <div className="bg-slate-50 dark:bg-[#0d0d1a] border border-slate-200/80 dark:border-white/10 rounded-xl p-4 space-y-3">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500">Gross Rental Yield</span>
                    <span className="font-bold text-emerald-400 text-sm">{pin.rental_yield_pct}%</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500">Price-to-Rent (P/R) Ratio</span>
                    <span className="font-bold text-white">{pin.price_to_rent_ratio || 27.5} years</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500">Capital Appreciation (3-Yr Avg)</span>
                    <span className="font-bold text-indigo-400">+8.4% p.a.</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500">Tenant Occupancy Rate</span>
                    <span className="font-bold text-emerald-400">96.5%</span>
                  </div>
                </div>
                <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-3.5 text-[11px] text-indigo-300">
                  🏢 <strong>Direct Tenant Demand:</strong> Located within proximity to major tech parks and metro lines, offering high rental liquidity.
                </div>
              </div>
            ) : isFlat && isBuyMode ? (
              /* Sale Financing Calculator */
              <div className="space-y-4">
                <h3 className="text-[11px] text-slate-600 dark:text-white/60 uppercase tracking-widest font-bold flex items-center gap-1.5">
                  <Calculator className="w-3.5 h-3.5 text-indigo-400 inline" />
                  Home Loan &amp; Cash Flow
                </h3>
                <div className="bg-slate-50 dark:bg-[#0d0d1a] border border-slate-200/80 dark:border-white/10 rounded-xl p-4 space-y-3">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500">Property Price</span>
                    <span className="font-bold text-white">₹{formatRent(estimatedPrice)}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500">Loan Amount (80%)</span>
                    <span className="font-bold text-white">₹{formatRent(estimatedPrice * 0.8)}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500">Down Payment (20%)</span>
                    <span className="font-bold text-indigo-400">₹{formatRent(estimatedPrice * 0.2)}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500">Monthly EMI (8.5%, 20Y)</span>
                    <span className="font-bold text-emerald-400 text-sm">~₹{formatRent(emi)}/mo</span>
                  </div>
                </div>
              </div>
            ) : isFlat ? (
              <PeopleSlide pin={pin} />
            ) : (
              <ChatSlide pin={pin} type={type} />
            )}
          </div>

          {/* ═══ Slide 3: Chat or Desk ═══ */}
          <div className="w-full flex-shrink-0 snap-center overflow-y-auto px-6 pb-6" style={{ minWidth: '100%' }}>
            {isSociety ? (
              <div className="space-y-4 text-center py-4">
                <Building className="w-10 h-10 text-indigo-400 mx-auto mb-2" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">{pin.name} Office Desk</h3>
                <p className="text-xs text-slate-500 dark:text-white/60 max-w-[280px] mx-auto">
                  Connect with the Resident Welfare Association (RWA) or authorized broker desk for site visits.
                </p>
                <div className="pt-2">
                  <button
                    onClick={() => alert(`Inquiry submitted for ${pin.name}. The society desk will reach out.`)}
                    className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs transition-all shadow-md shadow-indigo-600/20"
                  >
                    Schedule Society Site Visit
                  </button>
                </div>
              </div>
            ) : (
              <ChatSlide pin={pin} type={type} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Subcomponents ───

function Badge({ color, text }) {
  return (
    <span
      className="text-[10px] font-bold px-2 py-0.5 rounded-md border"
      style={{
        backgroundColor: `${color}18`,
        color: color,
        borderColor: `${color}35`,
      }}
    >
      {text}
    </span>
  );
}

function DetailCell({ icon, label, value }) {
  return (
    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200/60 dark:border-white/5">
      <div className="flex items-center gap-1.5 text-slate-500 dark:text-white/40 text-[10px] uppercase font-bold tracking-wider mb-0.5">
        {icon}
        <span>{label}</span>
      </div>
      <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
        {value}
      </div>
    </div>
  );
}

// ─── People Slide ───
function PeopleSlide({ pin }) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-[11px] text-slate-600 dark:text-white/60 uppercase tracking-widest font-bold mb-3 flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 inline" />
          Listed By
        </h3>
        <div className="bg-slate-50 dark:bg-[#0d0d1a] border border-slate-200/80 dark:border-white/10 rounded-xl p-4">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-sm">
              {pin.user_id ? pin.user_id.substring(0, 2).toUpperCase() : 'FL'}
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">Property Owner</p>
              <p className="text-xs text-slate-500 dark:text-white/50">Verified listing</p>
            </div>
          </div>
        </div>
      </div>

      {pin.flatmate_profile && (
        <div className="space-y-3">
          <div className="bg-slate-50 dark:bg-[#0d0d1a] border border-slate-200/80 dark:border-white/10 rounded-xl p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-600 dark:text-white/60 font-medium">Occupation</span>
              <span className="text-xs font-semibold text-slate-900 dark:text-white">{pin.flatmate_profile.occupation || 'Not specified'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-600 dark:text-white/60 font-medium">Food</span>
              <span className="text-xs font-semibold text-slate-900 dark:text-white">{formatEnum(pin.flatmate_profile.food)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-600 dark:text-white/60 font-medium">Smoking</span>
              <span className="text-xs font-semibold text-slate-900 dark:text-white">{formatEnum(pin.flatmate_profile.smoking)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Chat Slide (End-to-End Encrypted) ───
function ChatSlide({ pin, type }) {
  const [chatState, setChatState] = useState('idle');
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [roomId, setRoomId] = useState(null);
  const [sharedKeyInfo, setSharedKeyInfo] = useState(null);
  const wsRef = useRef(null);
  const messagesEndRef = useRef(null);

  const { userId, displayName } = useAuthStore();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  const startChat = async () => {
    if (!userId) {
      setChatState('idle');
      return;
    }
    setChatState('connecting');
    try {
      const room = await createDirectRoom({ pinId: pin.id, targetUserId: pin.user_id });
      setRoomId(room.id);

      const keyInfo = await getRoomSharedKey(room.id, userId);
      setSharedKeyInfo(keyInfo);

      const res = await fetchMessages(room.id);
      const rawMessages = res.data?.reverse() || [];

      const decrypted = await Promise.all(
        rawMessages.map(async (msg) => {
          const dec = await decryptMessage(msg.content, keyInfo?.key);
          return {
            ...msg,
            decryptedContent: dec.text,
            isE2EE: dec.isEncrypted || msg.is_encrypted,
          };
        })
      );
      setMessages(decrypted);

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      const wsUrl = `${protocol}//${host}/ws/chat?user_id=${userId}`;
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        ws.send(JSON.stringify({ type: 'subscribe', room_id: room.id }));
        setChatState('active');
      };

      ws.onmessage = async (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'message' && msg.room_id === room.id) {
            const dec = await decryptMessage(msg.content, keyInfo?.key);
            setMessages((prev) => [
              ...prev,
              {
                ...msg,
                decryptedContent: dec.text,
                isE2EE: dec.isEncrypted || msg.is_encrypted,
              },
            ]);
          }
        } catch (err) {
          console.error('WS parse error:', err);
        }
      };

      ws.onclose = () => setChatState('idle');
      wsRef.current = ws;
    } catch (err) {
      console.error('Chat start failed:', err);
      setChatState('idle');
    }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim() || !roomId || !wsRef.current) return;

    const plaintext = input.trim();
    setInput('');

    try {
      let contentToSend = plaintext;
      let isEnc = false;

      if (sharedKeyInfo?.key) {
        contentToSend = await encryptMessage(plaintext, sharedKeyInfo.key);
        isEnc = true;
      }

      wsRef.current.send(
        JSON.stringify({
          type: 'message',
          room_id: roomId,
          content: contentToSend,
          is_encrypted: isEnc,
        })
      );
    } catch (err) {
      console.error('Send error:', err);
    }
  };

  if (chatState === 'idle') {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <MessageSquare className="w-8 h-8 text-slate-400 dark:text-white/30 mb-2" />
        <h4 className="text-sm font-semibold text-slate-800 dark:text-white">Direct Message</h4>
        <p className="text-xs text-slate-500 dark:text-white/50 mt-1 mb-4 max-w-[240px]">
          Start an end-to-end encrypted chat with the owner.
        </p>
        <button
          onClick={startChat}
          className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-all shadow-md"
        >
          Start Chat
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[280px]">
      <div className="flex-1 overflow-y-auto space-y-2 pr-1 mb-2">
        {messages.map((m, idx) => (
          <div
            key={idx}
            className={`text-xs p-2.5 rounded-xl max-w-[80%] ${
              m.sender_id === userId
                ? 'ml-auto bg-emerald-600 text-white'
                : 'mr-auto bg-slate-100 dark:bg-white/10 text-slate-900 dark:text-white'
            }`}
          >
            {m.decryptedContent || m.content}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={sendMessage} className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type an encrypted message..."
          className="flex-1 text-xs px-3 py-2 rounded-xl bg-slate-100 dark:bg-white/10 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white focus:outline-none"
        />
        <button
          type="submit"
          className="p-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white transition-all"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>
    </div>
  );
}

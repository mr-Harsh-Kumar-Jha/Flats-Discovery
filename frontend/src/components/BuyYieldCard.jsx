import { useState } from 'react';
import { Building, TrendingUp, Sparkles, ShieldCheck, Train, Briefcase, Calculator, ChevronRight, DollarSign } from 'lucide-react';

function formatPrice(amount) {
  if (!amount) return '0';
  if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(2)} Cr`;
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)} Lakh`;
  return `₹${amount.toLocaleString('en-IN')}`;
}

function calculateEMI(principal, annualRate = 8.5, tenureYears = 20) {
  const p = principal * 0.8; // 80% loan to value (20% down payment)
  const r = annualRate / 12 / 100;
  const n = tenureYears * 12;
  const emi = (p * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
  return Math.round(emi);
}

/**
 * BuyYieldCard — Dedicated real estate investment & property sale card.
 * Distinct from rental flats or flatmate cards: highlights gross rental yield,
 * price/sqft, P/R ratio, estimated EMI, and MahaRERA verification.
 */
export default function BuyYieldCard({ society, onClick }) {
  const [showEMICalc, setShowEMICalc] = useState(false);

  const price = society.min_price || 6500000;
  const yieldPct = society.rental_yield_pct || 3.4;
  const monthlyRent = society.min_rent || Math.round((price * (yieldPct / 100)) / 12);
  const emi = calculateEMI(price);
  const prRatio = society.price_to_rent_ratio || Math.round(price / (monthlyRent * 12));

  // Determine Yield Quality Badge
  const yieldQuality = yieldPct >= 3.5 ? 'High Rental Yield' : 'Steady Growth';

  return (
    <div
      onClick={onClick}
      className="w-full text-left p-3.5 rounded-2xl bg-gradient-to-b from-slate-900 to-[#121324] border border-indigo-500/30 hover:border-indigo-400 transition-all group mb-2.5 shadow-lg shadow-indigo-950/20 cursor-pointer"
    >
      {/* Top Bar: Name + RERA Verification */}
      <div className="flex items-start justify-between mb-2">
        <div>
          <div className="flex items-center gap-1.5">
            <Building className="w-4 h-4 text-indigo-400 shrink-0" />
            <h3 className="font-bold text-white text-[14px] tracking-tight group-hover:text-indigo-300 transition-colors">
              {society.name}
            </h3>
          </div>
          <p className="text-[11px] text-slate-400 ml-5 font-medium">
            📍 {society.locality} · {society.towers_count || 6} Towers
          </p>
        </div>

        {/* MahaRERA Badge */}
        <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold shrink-0">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>{society.rera_id || 'MahaRERA'}</span>
        </div>
      </div>

      {/* Main Pricing & Yield Grid */}
      <div className="grid grid-cols-2 gap-2 p-2.5 rounded-xl bg-slate-950/60 border border-white/5 mb-2.5">
        {/* Total Price & Rate */}
        <div>
          <span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold block">
            Starting Price
          </span>
          <div className="text-base font-black text-white tracking-tight">
            {formatPrice(price)}
          </div>
          <div className="text-[10px] text-slate-400 font-medium">
            ₹{(society.avg_price_per_sqft || 7800).toLocaleString('en-IN')}/sq.ft.
          </div>
        </div>

        {/* Rental Yield & Monthly Income */}
        <div className="text-right border-l border-white/5 pl-2.5">
          <span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold block">
            Gross Yield
          </span>
          <div className="text-base font-black text-emerald-400 flex items-center justify-end gap-1">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            <span>{yieldPct}%</span>
          </div>
          <div className="text-[10px] text-indigo-300 font-semibold">
            ~₹{(monthlyRent).toLocaleString('en-IN')}/mo rent
          </div>
        </div>
      </div>

      {/* Investment Highlights: P/R Ratio, EMI, Smallest Bedroom */}
      <div className="space-y-1.5 text-xs text-slate-300 mb-3">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-slate-400 flex items-center gap-1">
            <Calculator className="w-3.5 h-3.5 text-indigo-400" />
            Estimated Home Loan EMI:
          </span>
          <span className="font-bold text-white">~₹{emi.toLocaleString('en-IN')}/mo</span>
        </div>

        <div className="flex items-center justify-between text-[11px]">
          <span className="text-slate-400">Price-to-Rent (P/R) Ratio:</span>
          <span className="font-semibold text-emerald-400">
            {prRatio} · <span className="text-[10px] text-slate-400 font-normal">({yieldQuality})</span>
          </span>
        </div>

        {/* Flat-Finder Signature Bedroom Dimension */}
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-slate-400">Smallest Bedroom Size:</span>
          <span className="font-bold text-amber-300 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
            {society.min_bedroom_dims || '11\'×12\''}
          </span>
        </div>

        {/* Live Inventory Counter */}
        <div className="flex items-center justify-between text-[11px] pt-1">
          <span className="text-slate-400">Live Inventory:</span>
          <div className="flex items-center gap-1.5 font-semibold text-[10.5px]">
            <span className="text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
              💎 {society.available_sales_count || 2} For Sale
            </span>
            <span className="text-indigo-300 bg-indigo-500/10 px-1.5 py-0.5 rounded border border-indigo-500/20">
              🏠 {society.available_rentals_count || 1} Rent
            </span>
          </div>
        </div>
      </div>

      {/* Connectivity & Metro Pills */}
      <div className="flex items-center gap-1.5 flex-wrap pt-2 border-t border-white/5">
        {society.nearest_metro_station && (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-cyan-500/15 text-cyan-300 border border-cyan-500/25 flex items-center gap-1">
            <Train className="w-3 h-3" />
            {society.nearest_metro_station} ({society.metro_distance_meters || 600}m)
          </span>
        )}
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-indigo-500/15 text-indigo-300 border border-indigo-500/25">
          {society.min_sqft || 950} - {society.max_sqft || 2400} sq.ft.
        </span>
      </div>
    </div>
  );
}

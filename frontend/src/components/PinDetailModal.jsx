import { useState, useRef, useEffect } from 'react';
import { X, Share2, Flag, MapPin, Home, Calendar, MessageSquare, Send, Users, Briefcase, ChevronLeft, ChevronRight, Building, Droplets, Zap, Car } from 'lucide-react';
import { createDirectRoom, fetchMessages } from '../lib/api';

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
 * PinDetailModal — Multi-slide carousel detail view for a pin.
 * 3 slides: Overview → People → Chat
 */
export default function PinDetailModal({ pin, type, onClose }) {
  if (!pin) return null;

  const isFlat = type === 'flat';
  const accentColor = isFlat ? '#10b981' : '#6366f1';
  const amount = isFlat ? pin.rent : pin.budget_max;
  const config = isFlat ? pin.bhk_config : (pin.bhk_configs?.join(', ') || 'Any');

  const [activeSlide, setActiveSlide] = useState(0);
  const carouselRef = useRef(null);
  const slideCount = isFlat ? 3 : 2; // Flat: Overview, People, Chat. Seeker: Overview, Chat.

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
    const text = isFlat
      ? `${config} available for ₹${formatRent(amount)}/mo on PuneFlats`
      : `Looking for ${config} under ₹${formatRent(amount)} on PuneFlats`;

    if (navigator.share) {
      try {
        await navigator.share({ title: 'PuneFlats', text, url: window.location.href });
      } catch {}
    } else {
      await navigator.clipboard.writeText(text + ' — ' + window.location.href);
    }
  };

  const slideLabels = isFlat
    ? ['Overview', 'People', 'Chat']
    : ['Overview', 'Chat'];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 theme-backdrop backdrop-blur-sm" />

      {/* Modal card */}
      <div
        className="relative w-full max-w-[420px] max-h-[85vh] bg-white dark:bg-[#161625] rounded-t-2xl sm:rounded-2xl border border-slate-200 dark:border-white/8 shadow-2xl animate-slide-up overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 pb-0">
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="text-slate-400 dark:text-white/50 text-[11px] uppercase tracking-widest font-semibold mb-1">
                {isFlat ? 'Flat for Rent' : 'Seeker'}
              </div>
              <div className="text-slate-900 dark:text-white text-3xl font-bold tracking-tight" style={{ letterSpacing: '-1px' }}>
                ₹{formatRent(amount)}
                {isFlat && <span className="text-slate-400 dark:text-white/40 text-lg font-normal">/mo</span>}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleShare}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-white/6 border-none text-slate-400 dark:text-white/50 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-white/12 flex items-center justify-center transition-colors"
                title="Share"
              >
                <Share2 className="w-3.5 h-3.5" />
              </button>
              <button
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-white/6 border-none text-slate-400 dark:text-white/50 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 flex items-center justify-center transition-colors"
                title="Report"
              >
                <Flag className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-white/6 border-none text-slate-400 dark:text-white/50 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-white/12 flex items-center justify-center transition-colors"
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
                className={`text-[11px] px-3 py-1.5 rounded-full font-medium transition-all ${
                  activeSlide === i
                    ? 'bg-slate-800 dark:bg-white/15 text-white dark:text-white'
                    : 'bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-white/40 hover:bg-slate-200 dark:hover:bg-white/10'
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
            {/* Badges */}
            <div className="flex flex-wrap gap-1.5 mb-4">
              <Badge color={accentColor} text={config} />
              {isFlat && pin.property_type && (
                <Badge color="#6366f1" text={formatEnum(pin.property_type)} />
              )}
              {isFlat && pin.furnishing && (
                <Badge color="#f59e0b" text={formatFurnishing(pin.furnishing)} />
              )}
              {isFlat && pin.parking && pin.parking !== 'NONE' && (
                <Badge color="#8b5cf6" text={`🅿️ ${formatEnum(pin.parking)}`} />
              )}
              {!isFlat && (
                <Badge color="#6366f1" text={`${pin.search_radius_km || 5}km radius`} />
              )}
            </div>

            {/* Flat Details Grid */}
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

            {/* Location */}
            <div className="flex items-center gap-2 text-slate-400 dark:text-white/40 text-xs mb-4">
              <MapPin className="w-3 h-3 shrink-0" />
              <span>{pin.lat?.toFixed(4)}, {pin.lng?.toFixed(4)}</span>
            </div>

            {/* Description */}
            {pin.description && (
              <div className="bg-slate-50 dark:bg-white/4 border border-slate-200 dark:border-white/6 rounded-xl p-3 mb-4">
                <p className="text-slate-600 dark:text-white/70 text-sm leading-relaxed italic">
                  "{pin.description}"
                </p>
              </div>
            )}

            {/* Seeker-specific info */}
            {!isFlat && pin.notes && (
              <div className="bg-slate-50 dark:bg-white/4 border border-slate-200 dark:border-white/6 rounded-xl p-3 mb-4">
                <p className="text-slate-600 dark:text-white/70 text-sm leading-relaxed">
                  {pin.notes}
                </p>
              </div>
            )}

            {/* Footer info */}
            <div className="border-t border-slate-200 dark:border-white/6 pt-4 mt-4">
              <div className="flex items-center gap-2 text-slate-400 dark:text-white/30 text-xs">
                <Calendar className="w-3 h-3" />
                <span>
                  {pin.created_at
                    ? `Posted ${new Date(pin.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`
                    : 'Recently posted'
                  }
                </span>
              </div>
            </div>
          </div>

          {/* ═══ Slide 2: People (Flat only) ═══ */}
          {isFlat && (
            <div className="w-full flex-shrink-0 snap-center overflow-y-auto px-6 pb-6" style={{ minWidth: '100%' }}>
              <PeopleSlide pin={pin} />
            </div>
          )}

          {/* ═══ Slide 3 (or 2 for seekers): Chat ═══ */}
          <div className="w-full flex-shrink-0 snap-center overflow-y-auto px-6 pb-6" style={{ minWidth: '100%' }}>
            <ChatSlide pin={pin} type={type} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── People Slide ───
function PeopleSlide({ pin }) {
  // The flat owner / poster info
  // Currently we show what data is available from the pin.
  // When flatmate_profile data is available from backend, it will be displayed here.
  return (
    <div className="space-y-4">
      {/* Owner / Poster */}
      <div>
        <h3 className="text-[11px] text-slate-400 dark:text-white/40 uppercase tracking-widest font-semibold mb-3">
          <Users className="w-3.5 h-3.5 inline mr-1.5" />
          Listed By
        </h3>
        <div className="bg-slate-50 dark:bg-white/4 border border-slate-200 dark:border-white/6 rounded-xl p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white font-bold text-sm shrink-0">
              {pin.user_id ? pin.user_id.substring(0, 2).toUpperCase() : 'FL'}
            </div>
            <div>
              <p className="text-sm font-medium text-slate-800 dark:text-white">Flat Owner</p>
              <p className="text-xs text-slate-400 dark:text-white/40">Verified listing</p>
            </div>
          </div>
        </div>
      </div>

      {/* Current Flatmates / Occupants info */}
      <div>
        <h3 className="text-[11px] text-slate-400 dark:text-white/40 uppercase tracking-widest font-semibold mb-3">
          <Briefcase className="w-3.5 h-3.5 inline mr-1.5" />
          Flatmate Details
        </h3>

        {/* Flatmate Profile Info - shown when available */}
        {pin.flatmate_profile ? (
          <div className="space-y-3">
            {/* Lifestyle Preferences */}
            <div className="bg-slate-50 dark:bg-white/4 border border-slate-200 dark:border-white/6 rounded-xl p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500 dark:text-white/40">Occupation</span>
                <span className="text-xs font-medium text-slate-700 dark:text-white/80">{pin.flatmate_profile.occupation || 'Not specified'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500 dark:text-white/40">Food Preference</span>
                <span className="text-xs font-medium text-slate-700 dark:text-white/80">{formatEnum(pin.flatmate_profile.food)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500 dark:text-white/40">Smoking</span>
                <span className="text-xs font-medium text-slate-700 dark:text-white/80">{formatEnum(pin.flatmate_profile.smoking)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500 dark:text-white/40">Pets</span>
                <span className="text-xs font-medium text-slate-700 dark:text-white/80">{formatEnum(pin.flatmate_profile.pets)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500 dark:text-white/40">Gender Pref</span>
                <span className="text-xs font-medium text-slate-700 dark:text-white/80">{formatEnum(pin.flatmate_profile.gender)}</span>
              </div>
              {pin.flatmate_profile.languages?.length > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500 dark:text-white/40">Languages</span>
                  <span className="text-xs font-medium text-slate-700 dark:text-white/80">{pin.flatmate_profile.languages.join(', ')}</span>
                </div>
              )}
              {pin.flatmate_profile.current_occupants != null && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500 dark:text-white/40">Current Occupants</span>
                  <span className="text-xs font-medium text-slate-700 dark:text-white/80">{pin.flatmate_profile.current_occupants}</span>
                </div>
              )}
              {pin.flatmate_profile.rooms_available != null && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500 dark:text-white/40">Rooms Available</span>
                  <span className="text-xs font-medium text-slate-700 dark:text-white/80">{pin.flatmate_profile.rooms_available}</span>
                </div>
              )}
            </div>

            {/* Bio */}
            {pin.flatmate_profile.bio && (
              <div className="bg-slate-50 dark:bg-white/4 border border-slate-200 dark:border-white/6 rounded-xl p-3">
                <p className="text-slate-600 dark:text-white/70 text-sm leading-relaxed italic">
                  "{pin.flatmate_profile.bio}"
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-slate-50 dark:bg-white/4 border border-slate-200 dark:border-white/6 rounded-xl p-4 text-center">
            <Users className="w-8 h-8 text-slate-300 dark:text-white/15 mx-auto mb-2" />
            <p className="text-xs text-slate-500 dark:text-white/40 font-medium">Flatmate details not yet added</p>
            <p className="text-[11px] text-slate-400 dark:text-white/25 mt-1">
              The owner hasn't added flatmate preferences yet. Start a chat to ask about the living situation!
            </p>
          </div>
        )}
      </div>

      {/* Tip */}
      <div className="bg-emerald-50 dark:bg-emerald-500/5 border border-emerald-200 dark:border-emerald-500/15 rounded-xl p-3">
        <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
          💡 <strong>Pro tip:</strong> Knowing your flatmates' occupation and lifestyle helps you make informed decisions about shared living.
        </p>
      </div>
    </div>
  );
}

// ─── Chat Slide ───
function ChatSlide({ pin, type }) {
  const [chatState, setChatState] = useState('idle'); // 'idle' | 'connecting' | 'active'
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [roomId, setRoomId] = useState(null);
  const wsRef = useRef(null);
  const messagesEndRef = useRef(null);
  const devUserId = localStorage.getItem('dev_user_id');

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  const startChat = async () => {
    if (!devUserId) {
      setChatState('idle');
      return;
    }
    setChatState('connecting');
    try {
      // Create or get direct room for this pin's match
      const room = await createDirectRoom(pin.id);
      setRoomId(room.id);

      // Load existing messages
      const res = await fetchMessages(room.id);
      setMessages(res.data?.reverse() || []);

      // Connect WebSocket
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      const wsUrl = `${protocol}//${host}/ws/chat?user_id=${devUserId}`;
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        ws.send(JSON.stringify({ type: 'subscribe', room_id: room.id }));
        setChatState('active');
      };
      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'message' && msg.room_id === room.id) {
            setMessages(prev => [...prev, msg]);
          }
        } catch {}
      };
      ws.onclose = () => setChatState('idle');
      wsRef.current = ws;
    } catch (err) {
      console.error('Chat start failed:', err);
      setChatState('idle');
    }
  };

  const sendMessage = (e) => {
    e.preventDefault();
    if (!input.trim() || !roomId || !wsRef.current) return;
    wsRef.current.send(JSON.stringify({
      type: 'message',
      room_id: roomId,
      content: input.trim()
    }));
    setInput('');
  };

  if (chatState === 'idle') {
    return (
      <div className="flex flex-col items-center justify-center py-8">
        <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 flex items-center justify-center mb-4">
          <MessageSquare className="w-7 h-7 text-indigo-500 dark:text-indigo-400" />
        </div>
        <h3 className="text-slate-800 dark:text-white font-semibold text-sm mb-1">Chat with the {type === 'flat' ? 'owner' : 'seeker'}</h3>
        <p className="text-slate-500 dark:text-white/40 text-xs text-center mb-6 max-w-[250px]">
          Start a conversation to ask about availability, flatmates, locality, and more.
        </p>
        {devUserId ? (
          <button
            onClick={startChat}
            className="px-6 py-2.5 bg-indigo-500 hover:bg-indigo-400 text-white text-sm font-semibold rounded-xl transition-colors shadow-lg shadow-indigo-500/25"
          >
            <MessageSquare className="w-4 h-4 inline mr-2" />
            Start Conversation
          </button>
        ) : (
          <p className="text-xs text-red-400">Set your Dev User ID in the auth bar to chat</p>
        )}
      </div>
    );
  }

  if (chatState === 'connecting') {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="w-6 h-6 border-2 border-indigo-500/30 border-t-indigo-400 rounded-full animate-spin mb-3" />
        <p className="text-slate-500 dark:text-white/40 text-sm">Connecting...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[300px]">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-3 mb-3">
        {messages.length === 0 ? (
          <p className="text-sm text-slate-400 dark:text-white/30 text-center my-auto py-8">
            Say hello! 👋
          </p>
        ) : (
          messages.map((msg, i) => {
            const isMe = msg.sender_id === devUserId;
            return (
              <div key={i} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
                  isMe
                    ? 'bg-indigo-500 text-white rounded-tr-sm'
                    : 'bg-slate-100 dark:bg-white/8 text-slate-800 dark:text-gray-100 border border-slate-200 dark:border-white/5 rounded-tl-sm'
                }`}>
                  <p>{msg.content}</p>
                  <p className="text-[10px] opacity-50 text-right mt-1">
                    {new Date(msg.created_at || Date.now()).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={sendMessage} className="flex gap-2 pt-2 border-t border-slate-200 dark:border-white/10">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 bg-slate-100 dark:bg-black/50 border border-slate-200 dark:border-white/10 rounded-full px-4 py-2 text-sm text-slate-800 dark:text-white outline-none focus:border-indigo-500 dark:focus:border-indigo-500"
        />
        <button
          type="submit"
          disabled={!input.trim()}
          className="w-10 h-10 rounded-full bg-indigo-500 hover:bg-indigo-400 text-white flex items-center justify-center disabled:opacity-50 transition-colors shrink-0"
        >
          <Send className="w-4 h-4 ml-0.5" />
        </button>
      </form>
    </div>
  );
}

// ─── Detail Cell ───
function DetailCell({ icon, label, value }) {
  return (
    <div className="bg-slate-50 dark:bg-white/4 border border-slate-200 dark:border-white/6 rounded-lg p-2.5">
      <div className="flex items-center gap-1.5 text-slate-400 dark:text-white/30 mb-1">
        {icon}
        <span className="text-[10px] uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-sm font-medium text-slate-700 dark:text-white/80">{value}</p>
    </div>
  );
}

// ─── Badge ───
function Badge({ color, text }) {
  return (
    <span
      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium"
      style={{
        background: color + '18',
        color: color,
        border: `1px solid ${color}30`,
      }}
    >
      {text}
    </span>
  );
}

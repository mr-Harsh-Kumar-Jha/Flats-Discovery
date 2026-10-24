import { useState, useEffect, useRef } from 'react';
import { MessageSquare, X, Send, ShieldCheck, Lock, Key, Eye, EyeOff, Check, Copy } from 'lucide-react';
import { fetchMyRooms, fetchMessages } from '../lib/api';
import { useAuthStore } from '../stores/authStore';
import {
  initUserKeys,
  getRoomSharedKey,
  encryptMessage,
  decryptMessage,
} from '../lib/e2ee';

export default function ChatPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [rooms, setRooms] = useState([]);
  const [activeRoom, setActiveRoom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sharedKeyInfo, setSharedKeyInfo] = useState(null);
  const [showSecurityModal, setShowSecurityModal] = useState(false);
  const [expandedCiphertext, setExpandedCiphertext] = useState({});
  const [copiedId, setCopiedId] = useState(null);

  const wsRef = useRef(null);
  const messagesEndRef = useRef(null);

  const { userId, displayName } = useAuthStore();

  // Initialize E2EE keys on mount or when user changes
  useEffect(() => {
    if (userId) {
      initUserKeys(userId);
    }
  }, [userId]);

  useEffect(() => {
    if (isOpen) {
      loadRooms();
    }
  }, [isOpen, userId]);

  useEffect(() => {
    if (activeRoom && userId) {
      setupActiveRoom(activeRoom);
    } else {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      setSharedKeyInfo(null);
      setMessages([]);
    }
    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, [activeRoom, userId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadRooms = async () => {
    try {
      setLoading(true);
      const res = await fetchMyRooms();
      setRooms(res.data || []);
    } catch (err) {
      console.error('Failed to load rooms:', err);
    } finally {
      setLoading(false);
    }
  };

  const setupActiveRoom = async (room) => {
    try {
      setLoading(true);
      // Derive shared key for E2EE
      const keyInfo = await getRoomSharedKey(room.id, userId);
      setSharedKeyInfo(keyInfo);

      // Load and decrypt messages
      const res = await fetchMessages(room.id);
      const rawMessages = res.data?.reverse() || [];

      const decrypted = await Promise.all(
        rawMessages.map(async (msg) => {
          const dec = await decryptMessage(msg.content, keyInfo?.key);
          return {
            ...msg,
            decryptedContent: dec.text,
            isE2EE: dec.isEncrypted || msg.is_encrypted,
            verified: dec.verified,
            rawCiphertext: dec.rawCiphertext || msg.content,
          };
        })
      );

      setMessages(decrypted);
      connectWebSocket(room.id, keyInfo);
    } catch (err) {
      console.error('Failed to setup active room:', err);
    } finally {
      setLoading(false);
    }
  };

  const connectWebSocket = (roomId, keyInfo) => {
    if (wsRef.current) wsRef.current.close();

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/ws/chat?user_id=${userId}`;

    const ws = new WebSocket(wsUrl);
    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'subscribe', room_id: roomId }));
    };

    ws.onmessage = async (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'message' && msg.room_id === roomId) {
          const dec = await decryptMessage(msg.content, keyInfo?.key);
          const formatted = {
            ...msg,
            decryptedContent: dec.text,
            isE2EE: dec.isEncrypted || msg.is_encrypted,
            verified: dec.verified,
            rawCiphertext: dec.rawCiphertext || msg.content,
          };
          setMessages((prev) => [...prev, formatted]);
        }
      } catch (err) {
        console.error('WS parse error:', err);
      }
    };

    ws.onclose = () => console.log('WS Disconnected');
    wsRef.current = ws;
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim() || !activeRoom || !wsRef.current) return;

    const plaintext = input.trim();
    setInput('');

    try {
      let contentToSend = plaintext;
      let isEncrypted = false;
      let senderFingerprint = '';

      if (sharedKeyInfo?.key) {
        contentToSend = await encryptMessage(plaintext, sharedKeyInfo.key, sharedKeyInfo.myFingerprint);
        isEncrypted = true;
        senderFingerprint = sharedKeyInfo.myFingerprint;
      }

      const payload = {
        type: 'message',
        room_id: activeRoom.id,
        content: contentToSend,
        is_encrypted: isEncrypted,
        sender_pub_fingerprint: senderFingerprint,
      };

      wsRef.current.send(JSON.stringify(payload));
    } catch (err) {
      console.error('Failed to send encrypted message:', err);
    }
  };

  const toggleCiphertext = (msgId) => {
    setExpandedCiphertext((prev) => ({
      ...prev,
      [msgId]: !prev[msgId],
    }));
  };

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Helper to extract peer name from room
  const getPeerDisplayName = (room) => {
    if (room.members && room.members.length > 0) {
      const peer = room.members.find((m) => m.user_id !== userId);
      if (peer && peer.display_name) return peer.display_name;
    }
    return `Match #${room.id.substring(0, 6)}`;
  };

  return (
    <>
      {/* Floating Chat Trigger Button */}
      <button
        id="btn-floating-chat"
        onClick={() => setIsOpen(!isOpen)}
        className="absolute bottom-24 right-8 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200 dark:border-white/10 hover:border-emerald-500/50 dark:hover:border-emerald-500/50 text-slate-800 dark:text-white p-3.5 rounded-full shadow-2xl transition-all hover:scale-105 flex items-center justify-center group"
        title="Encrypted Chat"
      >
        <div className="relative">
          <MessageSquare className="w-6 h-6 text-indigo-500 dark:text-indigo-400 group-hover:text-emerald-500 dark:group-hover:text-emerald-400 transition-colors" />
          <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900 flex items-center justify-center">
            <Lock className="w-1.5 h-1.5 text-white" />
          </span>
        </div>
      </button>

      {/* Main Chat Panel Container */}
      {isOpen && (
        <div className="absolute bottom-8 right-24 z-40 w-[26rem] h-[36rem] bg-white dark:bg-[#0c101d] border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
          {/* Header */}
          <div className="px-4 py-3 border-b border-slate-200 dark:border-white/10 flex justify-between items-center bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur">
            <div className="flex items-center gap-2.5 min-w-0">
              {activeRoom ? (
                <>
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-emerald-500 flex items-center justify-center text-white font-bold text-xs shrink-0">
                    {getPeerDisplayName(activeRoom).charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h3 className="font-semibold text-slate-800 dark:text-white text-sm truncate">
                        {getPeerDisplayName(activeRoom)}
                      </h3>
                      <button
                        onClick={() => setShowSecurityModal(true)}
                        className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors"
                        title="Click to view end-to-end encryption details"
                      >
                        <ShieldCheck className="w-3 h-3 text-emerald-500" />
                        <span>E2EE</span>
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                      ECDH P-256 • AES-GCM
                    </p>
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                    <ShieldCheck className="w-4 h-4 text-emerald-500" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-800 dark:text-white text-sm">
                      Encrypted Messages
                    </h3>
                    <p className="text-[11px] text-emerald-500 font-medium">
                      Zero-Knowledge Direct Chat
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Header controls */}
            <div className="flex items-center gap-1.5">
              {activeRoom && (
                <button
                  onClick={() => setActiveRoom(null)}
                  className="text-xs text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-200/60 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 px-2.5 py-1 rounded-lg transition-colors font-medium"
                >
                  Back
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Security Information Modal */}
          {showSecurityModal && (
            <div className="absolute inset-0 z-50 bg-slate-950/80 backdrop-blur-sm p-4 flex flex-col justify-center items-center">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl p-5 w-full max-w-sm shadow-2xl relative">
                <button
                  onClick={() => setShowSecurityModal(false)}
                  className="absolute top-3 right-3 text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>

                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-3 mx-auto">
                  <ShieldCheck className="w-6 h-6 text-emerald-400" />
                </div>

                <h4 className="text-center font-bold text-slate-900 dark:text-white text-sm mb-1">
                  End-to-End Encrypted Chat
                </h4>
                <p className="text-center text-xs text-slate-500 dark:text-slate-400 mb-4 leading-relaxed">
                  Messages in this chat are encrypted on your device using <b>ECDH P-256</b> and <b>AES-256-GCM</b>. No one outside of this chat, not even Pune-Flats servers, can read them.
                </p>

                <div className="space-y-2.5 bg-slate-50 dark:bg-black/40 p-3 rounded-xl border border-slate-200 dark:border-white/5 text-xs">
                  <div>
                    <span className="text-slate-400 dark:text-slate-500 block text-[10px] uppercase font-bold tracking-wider">
                      Your Device Fingerprint:
                    </span>
                    <span className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold text-[11px] select-all">
                      {sharedKeyInfo?.myFingerprint || 'Generating...'}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-400 dark:text-slate-500 block text-[10px] uppercase font-bold tracking-wider">
                      Recipient Safety Number:
                    </span>
                    <span className="font-mono text-indigo-600 dark:text-indigo-400 font-semibold text-[11px] select-all">
                      {sharedKeyInfo?.peerFingerprint || 'Verifying peer key...'}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-400 dark:text-slate-500 block text-[10px] uppercase font-bold tracking-wider">
                      Cipher Suite:
                    </span>
                    <span className="text-slate-700 dark:text-slate-300 font-mono text-[11px]">
                      ECDH-P256 + AES-GCM-256 (IV: 96-bit random)
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => setShowSecurityModal(false)}
                  className="w-full mt-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold transition-colors"
                >
                  Got It
                </button>
              </div>
            </div>
          )}

          {!activeRoom ? (
            // Room List View
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              <div className="mb-3 px-1 flex items-center justify-between text-xs text-slate-400 dark:text-slate-500">
                <span>Direct Conversations</span>
                <span className="flex items-center gap-1 text-emerald-500">
                  <Lock className="w-3 h-3" /> E2EE Active
                </span>
              </div>

              {loading ? (
                <div className="flex flex-col items-center justify-center py-16 gap-2">
                  <div className="w-6 h-6 border-2 border-emerald-500/30 border-t-emerald-400 rounded-full animate-spin" />
                  <p className="text-xs text-slate-400">Loading secure rooms...</p>
                </div>
              ) : rooms.length === 0 ? (
                <div className="text-center py-16 px-4 text-slate-400 dark:text-slate-500">
                  <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-indigo-500/10 flex items-center justify-center">
                    <MessageSquare className="w-7 h-7 text-indigo-400 opacity-60" />
                  </div>
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300">No conversations yet</p>
                  <p className="text-xs mt-1 text-slate-400 dark:text-slate-500 leading-relaxed max-w-xs mx-auto">
                    Click any flat or seeker pin on the map and tap "Start Conversation" to begin an end-to-end encrypted chat!
                  </p>
                </div>
              ) : (
                rooms.map((room) => {
                  const peerName = getPeerDisplayName(room);
                  return (
                    <button
                      key={room.id}
                      onClick={() => setActiveRoom(room)}
                      className="w-full flex items-center gap-3 p-3 bg-slate-50 dark:bg-white/[0.03] hover:bg-slate-100 dark:hover:bg-white/[0.08] rounded-xl transition-all border border-slate-200/60 dark:border-white/5 text-left group"
                    >
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-emerald-500 flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-md">
                        {peerName.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold text-slate-800 dark:text-white truncate">
                            {peerName}
                          </p>
                          <span className="text-[10px] text-emerald-500 flex items-center gap-0.5">
                            <Lock className="w-2.5 h-2.5" /> E2EE
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 dark:text-slate-400 truncate mt-0.5">
                          Tap to open secure room
                        </p>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          ) : (
            // Active Chat View
            <>
              {/* E2EE Safety Banner */}
              <div className="px-4 py-1.5 bg-emerald-500/5 dark:bg-emerald-500/10 border-b border-emerald-500/10 flex items-center justify-between text-[11px] text-emerald-600 dark:text-emerald-400">
                <span className="flex items-center gap-1 font-medium">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                  End-to-End Encrypted (AES-GCM-256)
                </span>
                <button
                  onClick={() => setShowSecurityModal(true)}
                  className="underline hover:text-emerald-300 font-medium"
                >
                  Verify Keys
                </button>
              </div>

              {/* Message Stream */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3.5 flex flex-col">
                {messages.length === 0 ? (
                  <div className="my-auto text-center py-8">
                    <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto mb-2">
                      <Lock className="w-5 h-5" />
                    </div>
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      Zero-Knowledge Chat Initiated
                    </p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 max-w-xs mx-auto mt-1">
                      Messages sent here are encrypted on your browser and can only be decrypted by {getPeerDisplayName(activeRoom)}.
                    </p>
                  </div>
                ) : (
                  messages.map((msg, i) => {
                    const isMe = msg.sender_id === userId;
                    const msgId = msg.id || msg.message_id || `msg-${i}`;
                    const isExpanded = !!expandedCiphertext[msgId];

                    return (
                      <div
                        key={msgId}
                        className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                      >
                        <div
                          className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm shadow-sm ${
                            isMe
                              ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white rounded-tr-xs'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-white/5 rounded-tl-xs'
                          }`}
                        >
                          <p className="leading-relaxed whitespace-pre-wrap break-words">
                            {msg.decryptedContent || msg.content}
                          </p>

                          {/* Message Footer: Timestamp, lock badge, and Inspect Ciphertext button */}
                          <div className="flex items-center justify-between gap-3 mt-1.5 pt-1 border-t border-black/5 dark:border-white/5 text-[10px]">
                            <button
                              type="button"
                              onClick={() => toggleCiphertext(msgId)}
                              className={`flex items-center gap-1 font-mono hover:underline ${
                                isMe ? 'text-indigo-200' : 'text-slate-400 dark:text-slate-400'
                              }`}
                              title="Inspect raw ciphertext stored on server"
                            >
                              {isExpanded ? (
                                <>
                                  <EyeOff className="w-3 h-3" /> Hide Raw
                                </>
                              ) : (
                                <>
                                  <Lock className="w-3 h-3 text-emerald-400" /> Inspect Ciphertext
                                </>
                              )}
                            </button>

                            <span className={isMe ? 'text-indigo-200' : 'text-slate-400 dark:text-slate-500'}>
                              {new Date(msg.created_at || Date.now()).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                        </div>

                        {/* Expandable Ciphertext Inspector Drawer */}
                        {isExpanded && (
                          <div className="w-[85%] mt-1.5 p-2.5 bg-slate-900 border border-slate-700/80 rounded-xl text-[10px] font-mono text-emerald-400 shadow-lg animate-in fade-in duration-150">
                            <div className="flex items-center justify-between mb-1 pb-1 border-b border-slate-800 text-slate-400">
                              <span className="flex items-center gap-1 font-sans text-[11px] font-semibold text-slate-300">
                                <Key className="w-3 h-3 text-emerald-400" />
                                Stored Server Payload (Ciphertext)
                              </span>
                              <button
                                onClick={() => copyToClipboard(msg.rawCiphertext || msg.content, msgId)}
                                className="flex items-center gap-0.5 text-slate-400 hover:text-white"
                              >
                                {copiedId === msgId ? (
                                  <>
                                    <Check className="w-3 h-3 text-emerald-400" /> Copied
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3 h-3" /> Copy
                                  </>
                                )}
                              </button>
                            </div>
                            <div className="overflow-x-auto select-all max-h-24 p-1 bg-black/60 rounded text-[9.5px] leading-tight text-slate-300 break-all">
                              {msg.rawCiphertext || msg.content}
                            </div>
                            <p className="mt-1 text-[9px] text-slate-500 font-sans">
                              🔒 Decryption is mathematically zero-knowledge without the local ECDH private key.
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input Bar */}
              <form
                onSubmit={sendMessage}
                className="p-3 border-t border-slate-200 dark:border-white/10 bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur flex flex-col gap-1.5"
              >
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Type an end-to-end encrypted message..."
                    className="flex-1 bg-white dark:bg-black/50 border border-slate-200 dark:border-white/10 rounded-full px-4 py-2.5 text-sm text-slate-800 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none focus:border-emerald-500 dark:focus:border-emerald-500 shadow-inner"
                  />
                  <button
                    type="submit"
                    disabled={!input.trim()}
                    className="w-10 h-10 rounded-full bg-gradient-to-r from-indigo-500 to-emerald-500 hover:from-indigo-400 hover:to-emerald-400 text-white flex items-center justify-center disabled:opacity-40 transition-all shadow-md shrink-0"
                    title="Send encrypted"
                  >
                    <Send className="w-4 h-4 ml-0.5" />
                  </button>
                </div>
                <div className="flex items-center justify-center gap-1 text-[10px] text-slate-400 dark:text-slate-500">
                  <Lock className="w-2.5 h-2.5 text-emerald-500" />
                  <span>Encrypted with AES-256-GCM before leaving your device</span>
                </div>
              </form>
            </>
          )}
        </div>
      )}
    </>
  );
}

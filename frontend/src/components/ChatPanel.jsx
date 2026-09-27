import { useState, useEffect, useRef } from 'react';
import { MessageSquare, X, Send } from 'lucide-react';
import { fetchMyRooms, fetchMessages } from '../lib/api';
import { useMapStore } from '../stores/mapStore';

export default function ChatPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [rooms, setRooms] = useState([]);
  const [activeRoom, setActiveRoom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  
  const wsRef = useRef(null);
  const messagesEndRef = useRef(null);

  const devUserId = localStorage.getItem('dev_user_id');

  useEffect(() => {
    if (isOpen) {
      loadRooms();
    }
  }, [isOpen]);

  useEffect(() => {
    if (activeRoom) {
      loadMessages(activeRoom.id);
      connectWebSocket(activeRoom.id);
    } else {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    }
    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, [activeRoom]);

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

  const loadMessages = async (roomId) => {
    try {
      const res = await fetchMessages(roomId);
      setMessages(res.data?.reverse() || []); // newest at bottom
    } catch (err) {
      console.error('Failed to load messages:', err);
    }
  };

  const connectWebSocket = (roomId) => {
    if (wsRef.current) wsRef.current.close();
    
    // Construct WS URL
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/ws/chat?user_id=${devUserId}`;
    
    const ws = new WebSocket(wsUrl);
    ws.onopen = () => {
      console.log('WS Connected');
      ws.send(JSON.stringify({ type: 'subscribe', room_id: roomId }));
    };
    
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'message' && msg.room_id === roomId) {
          setMessages(prev => [...prev, msg]);
        }
      } catch (err) {
        console.error('WS parse error:', err);
      }
    };
    
    ws.onclose = () => console.log('WS Disconnected');
    wsRef.current = ws;
  };

  const sendMessage = (e) => {
    e.preventDefault();
    if (!input.trim() || !activeRoom || !wsRef.current) return;

    const payload = {
      type: 'message',
      room_id: activeRoom.id,
      content: input.trim()
    };
    
    wsRef.current.send(JSON.stringify(payload));
    setInput('');
  };

  return (
    <>
      {/* Floating Chat Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="absolute bottom-24 right-8 z-30 bg-white dark:bg-gray-900 border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-gray-800 text-slate-800 dark:text-white p-4 rounded-full shadow-lg dark:shadow-2xl transition-all hover:scale-105 flex items-center justify-center"
      >
        <MessageSquare className="w-6 h-6 text-indigo-500 dark:text-primary-400" />
      </button>

      {/* Chat Panel */}
      {isOpen && (
        <div className="absolute bottom-8 right-24 z-40 w-96 h-[32rem] bg-white dark:bg-[#0f0f1e] border border-slate-200 dark:border-white/10 rounded-2xl shadow-xl dark:shadow-2xl flex flex-col overflow-hidden">
          {/* Header */}
          <div className="p-4 border-b border-slate-200 dark:border-white/10 flex justify-between items-center bg-slate-50 dark:bg-gray-900/50">
            <h3 className="font-semibold text-slate-800 dark:text-white">
              {activeRoom ? 'Chat Room' : 'Messages'}
            </h3>
            <div className="flex gap-2">
              {activeRoom && (
                <button onClick={() => setActiveRoom(null)} className="text-xs text-slate-500 dark:text-gray-400 hover:text-slate-800 dark:hover:text-white bg-slate-100 dark:bg-white/5 px-2 py-1 rounded">Back</button>
              )}
              <button onClick={() => setIsOpen(false)} className="text-slate-400 dark:text-gray-400 hover:text-slate-800 dark:hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {!activeRoom ? (
            // Room List
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {loading ? (
                <p className="text-sm text-slate-400 dark:text-gray-500 text-center py-4">Loading rooms...</p>
              ) : rooms.length === 0 ? (
                <div className="text-center py-12 text-slate-400 dark:text-gray-500">
                  <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-20" />
                  <p className="text-sm">No active matches yet.</p>
                  <p className="text-xs mt-1">Wait for the OV engine to find a match!</p>
                </div>
              ) : (
                rooms.map(room => (
                  <button
                    key={room.id}
                    onClick={() => setActiveRoom(room)}
                    className="w-full flex items-center gap-3 p-3 bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl transition-colors border border-transparent hover:border-slate-200 dark:hover:border-white/5 text-left"
                  >
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-emerald-500 flex items-center justify-center text-white font-bold text-sm shrink-0">
                      R
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 dark:text-white truncate">Match #{room.id.substring(0,6)}</p>
                      <p className="text-xs text-slate-400 dark:text-gray-400 truncate mt-0.5">Click to view chat</p>
                    </div>
                  </button>
                ))
              )}
            </div>
          ) : (
            // Active Chat
            <>
              <div className="flex-1 overflow-y-auto p-4 space-y-4 flex flex-col">
                {messages.length === 0 ? (
                  <p className="text-sm text-slate-400 dark:text-gray-500 text-center my-auto">Start the conversation!</p>
                ) : (
                  messages.map((msg, i) => {
                    const isMe = msg.sender_id === devUserId;
                    return (
                      <div key={i} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${isMe ? 'bg-indigo-500 text-white rounded-tr-sm' : 'bg-slate-100 dark:bg-gray-800 text-slate-800 dark:text-gray-100 border border-slate-200 dark:border-white/5 rounded-tl-sm'}`}>
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
              <form onSubmit={sendMessage} className="p-3 border-t border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-gray-900/50 flex gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 bg-white dark:bg-black/50 border border-slate-200 dark:border-white/10 rounded-full px-4 py-2 text-sm text-slate-800 dark:text-white outline-none focus:border-indigo-500 dark:focus:border-primary-500"
                />
                <button
                  type="submit"
                  disabled={!input.trim()}
                  className="w-10 h-10 rounded-full bg-indigo-500 hover:bg-indigo-400 text-white flex items-center justify-center disabled:opacity-50 transition-colors shrink-0"
                >
                  <Send className="w-4 h-4 ml-0.5" />
                </button>
              </form>
            </>
          )}
        </div>
      )}
    </>
  );
}

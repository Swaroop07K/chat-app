import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import axios from 'axios';
import { LogIn, MessageSquare, Plus, Image as ImageIcon, Send, User as UserIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// const API_BASE = 'http://localhost:5000';     // Local Backend
const API_BASE = 'https://chat-app-ra9y.onrender.com';
const socket = io(API_BASE);

function App() {
  const [user, setUser] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [currentRoom, setCurrentRoom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [selectedImage, setSelectedImage] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  // User Setup State
  const [loginData, setLoginData] = useState({ name: '', email: '' });

  useEffect(() => {
    if (user) {
      fetchRooms();
    }
  }, [user]);

  useEffect(() => {
    if (currentRoom) {
      fetchMessages(currentRoom._id);
      socket.emit('join_room', currentRoom._id);
    }
  }, [currentRoom]);

  useEffect(() => {
    socket.on('receive_message', (message) => {
      setMessages((prev) => [...prev, message]);
    });

    return () => socket.off('receive_message');
  }, []);

  const fetchRooms = async () => {
    const res = await axios.get(`${API_BASE}/api/rooms`);
    setRooms(res.data);
  };

  const fetchMessages = async (roomId) => {
    const res = await axios.get(`${API_BASE}/api/messages/${roomId}`);
    setMessages(res.data);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    const res = await axios.post(`${API_BASE}/api/users`, loginData);
    setUser(res.data);
  };

  const handleCreateRoom = async () => {
    const name = prompt('Enter room name:');
    if (name) {
      const res = await axios.post(`${API_BASE}/api/rooms`, { name });
      setRooms([...rooms, res.data]);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputText && !selectedImage) return;

    if (selectedImage) {
      setIsUploading(true);
      const formData = new FormData();
      formData.append('image', selectedImage);
      formData.append('text', inputText);
      formData.append('sender', user._id);
      formData.append('room', currentRoom._id);

      try {
        await axios.post(`${API_BASE}/api/messages/upload`, formData);
        setSelectedImage(null);
        setInputText('');
      } catch (error) {
        console.error('Failed to send image message:', error);
        alert('Failed to send image. Please try again.');
      } finally {
        setIsUploading(false);
      }
    } else {
      // Text only message via Socket.io
      socket.emit('send_message', {
        room: currentRoom._id,
        sender: user._id,
        text: inputText,
        imageUrl: ''
      });
      setInputText('');
    }
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-panel p-8 w-full max-w-md"
        >
          <div className="flex items-center gap-3 mb-8">
            <div className="p-3 bg-purple-600 rounded-xl">
              <MessageSquare className="text-white" />
            </div>
            <h1 className="text-2xl font-bold gradient-text">Cloud Chat</h1>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-sm text-slate-400 mb-1 block">Full Name</label>
              <input
                type="text"
                required
                className="w-full bg-slate-800/50 border border-slate-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-purple-500"
                placeholder="John Doe"
                value={loginData.name}
                onChange={(e) => setLoginData({ ...loginData, name: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm text-slate-400 mb-1 block">Email Address</label>
              <input
                type="email"
                required
                className="w-full bg-slate-800/50 border border-slate-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-purple-500"
                placeholder="john@example.com"
                value={loginData.email}
                onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
              />
            </div>
            <button className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 rounded-lg flex items-center justify-center gap-2">
              <LogIn size={20} />
              Join Chat
            </button>
          </form>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <div className="w-80 glass-panel border-r-0 rounded-none flex flex-col">
        <div className="p-6 border-b border-slate-700/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UserIcon size={20} className="text-purple-400" />
            <span className="font-semibold truncate max-w-[120px]">{user.name}</span>
          </div>
          <button
            onClick={handleCreateRoom}
            className="p-2 hover:bg-slate-700 rounded-lg text-slate-400"
          >
            <Plus size={20} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {rooms.map((room) => (
            <button
              key={room._id}
              onClick={() => setCurrentRoom(room)}
              className={`w-full text-left p-3 rounded-xl transition-all ${currentRoom?._id === room._id
                ? 'bg-purple-600/20 border border-purple-500/50 text-purple-100'
                : 'hover:bg-slate-800/50 text-slate-400'
                }`}
            >
              # {room.name}
            </button>
          ))}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-slate-900/50">
        {currentRoom ? (
          <>
            <div className="p-6 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold"># {currentRoom.name}</h2>
                <p className="text-sm text-slate-500">Real-time messaging active</p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide">
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex gap-4 ${msg.sender?._id === user._id ? 'flex-row-reverse' : ''}`}
                >
                  <div className={`flex flex-col ${msg.sender?._id === user._id ? 'items-end' : ''}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold text-slate-400">{msg.sender?.name}</span>
                      <span className="text-[10px] text-slate-600">{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <div className={`p-4 rounded-2xl max-w-md ${msg.sender?._id === user._id
                      ? 'bg-purple-600 text-white rounded-tr-none'
                      : 'bg-slate-800 text-slate-100 rounded-tl-none'
                      }`}>
                      {msg.imageUrl && (
                        <img
                          src={msg.imageUrl}
                          alt="shared"
                          className="rounded-lg mb-2 max-w-full h-auto shadow-lg"
                        />
                      )}
                      {msg.text && <p className="leading-relaxed">{msg.text}</p>}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-6">
              <form
                onSubmit={handleSendMessage}
                className="glass-panel p-2 flex items-center gap-3"
              >
                <input
                  type="file"
                  id="image-upload"
                  className="hidden"
                  accept="image/*"
                  onChange={(e) => setSelectedImage(e.target.files[0])}
                />
                <label
                  htmlFor="image-upload"
                  className={`p-3 rounded-lg cursor-pointer transition-colors ${selectedImage ? 'bg-purple-500 text-white' : 'hover:bg-slate-800 text-slate-400'
                    }`}
                >
                  <ImageIcon size={20} />
                </label>
                <input
                  type="text"
                  placeholder={isUploading ? 'Uploading image...' : "Type your message..."}
                  disabled={isUploading}
                  className="flex-1 bg-transparent px-2 text-white"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                />
                <button
                  disabled={isUploading}
                  className="bg-purple-600 hover:bg-purple-700 p-3 rounded-lg text-white"
                >
                  <Send size={20} />
                </button>
              </form>
              {selectedImage && (
                <div className="mt-2 text-xs text-purple-400 flex items-center gap-1">
                  <ImageIcon size={12} /> {selectedImage.name} (Ready to send)
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
            <MessageSquare size={64} className="mb-4 opacity-10" />
            <p className="text-xl font-medium">Select a room to start chatting</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const { upload } = require('./cloudinaryConfig');
const { User, Room, Message } = require('./models');

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

app.use(cors());
app.use(express.json());

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// API Routes
app.post('/api/users', async (req, res) => {
  try {
    const { name, email } = req.body;
    let user = await User.findOne({ email });
    if (!user) {
      user = new User({ name, email });
      await user.save();
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/rooms', async (req, res) => {
  try {
    const rooms = await Room.find();
    res.json(rooms);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/rooms', async (req, res) => {
  try {
    const { name } = req.body;
    const room = new Room({ name });
    await room.save();
    res.json(room);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/messages/:roomId', async (req, res) => {
  try {
    const messages = await Message.find({ room: req.params.roomId }).populate('sender');
    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Unified Image and Message Upload Endpoint
app.post('/api/messages/upload', (req, res) => {
  upload.single('image')(req, res, async (err) => {
    if (err) {
      console.error('Upload Error:', err);
      return res.status(500).json({ error: 'Upload failed', details: err.message });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    try {
      const { text, sender, room } = req.body;
      
      const newMessage = new Message({
        room,
        sender,
        text,
        imageUrl: req.file.path // Cloudinary URL
      });

      await newMessage.save();
      
      // Populate sender to match the receive_message expected format
      const populatedMessage = await Message.findById(newMessage._id).populate('sender');

      // Broadcast the message to the room via Socket.io
      io.to(room).emit('receive_message', populatedMessage);

      res.status(201).json(populatedMessage);
    } catch (dbError) {
      console.error('Database/Socket Error:', dbError);
      res.status(500).json({ error: 'Failed to save message', details: dbError.message });
    }
  });
});

// Socket.io logic
io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  socket.on('join_room', (roomId) => {
    socket.join(roomId);
    console.log(`User ${socket.id} joined room ${roomId}`);
  });

  socket.on('send_message', async (data) => {
    try {
      const { room, sender, text, imageUrl } = data;
      const newMessage = new Message({
        room,
        sender,
        text,
        imageUrl
      });
      await newMessage.save();

      const populatedMessage = await Message.findById(newMessage._id).populate('sender');

      io.to(room).emit('receive_message', populatedMessage);
    } catch (error) {
      console.error('Error saving message:', error);
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected');
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

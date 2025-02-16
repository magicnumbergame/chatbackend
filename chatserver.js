const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const Filter = require('bad-words');
const rateLimit = require('express-rate-limit');

const app = express();
app.use(cors());

// Rate limiter to prevent spam (5 messages per 10 seconds per IP)
const messageLimiter = rateLimit({
  windowMs: 10000, // 10 seconds
  max: 5,
  message: "Too many messages sent, please slow down."
});

const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const messages = [];
const filter = new Filter();

// Remove specific words from the filter
filter.removeWords('hell', 'damn', 'ass', 'hoe', 'ho');

// Function to filter out links, executables, and crypto scams
const isValidMessage = (message) => {
  const linkRegex = /(https?:\/\/[^\s]+)/g;
  const exeRegex = /\.(exe|bat|sh|msi|cmd)$/i;
  const scamRegex = /(free crypto|double your coins|send eth to get more)/i;
  return !linkRegex.test(message) && !exeRegex.test(message) && !scamRegex.test(message);
};

io.on('connection', (socket) => {
  console.log('New client connected');

  // Send existing messages to the newly connected client
  socket.emit('initial messages', messages);

  socket.on('chat message', ({ username, message }) => {
    if (!username || !message) return;
    if (!isValidMessage(message)) {
      socket.emit('chat error', "Your message was flagged as unsafe.");
      return;
    }

    const cleanedMessage = filter.clean(message);
    const chatMessage = { username, message: cleanedMessage, timestamp: new Date().toISOString() };

    messages.push(chatMessage);
    io.emit('chat message', chatMessage);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));

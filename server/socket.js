// Socket.IO: pengiriman pesan real-time, indikator mengetik, dan status online.
// Isi pesan tetap terenkripsi; server hanya meneruskan.
const { Server } = require('socket.io');
const { Op } = require('sequelize');
const { Conversation } = require('./models');
const { userFromToken } = require('./middlewares/authentication');
const { CHAT_ROLES } = require('./services/chat');

let io = null;
const onlineCount = new Map(); // userId -> jumlah tab/perangkat yang terhubung

const room = (userId) => `user:${userId}`;

function emitToUser(userId, event, payload) {
  io?.to(room(userId)).emit(event, payload);
}

function isOnline(userId) {
  return (onlineCount.get(userId) ?? 0) > 0;
}

// Beri tahu semua lawan bicara bahwa status online user berubah.
async function broadcastPresence(userId, online) {
  const conversations = await Conversation.findAll({
    where: { [Op.or]: [{ teacherId: userId }, { parentId: userId }] },
    attributes: ['teacherId', 'parentId'],
  });
  conversations.forEach((c) => emitToUser(c.otherParticipantId(userId), 'presence', { userId, online }));
}

function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: { origin: process.env.CLIENT_URL || 'http://localhost:5173' },
  });

  io.use(async (socket, next) => {
    try {
      socket.user = await userFromToken(socket.handshake.auth?.token);
      if (!CHAT_ROLES.includes(socket.user.role)) throw { message: 'Chat hanya untuk guru dan orang tua' };
      next();
    } catch (err) {
      next(new Error(err.message || 'Unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.user.id;
    socket.join(room(userId));
    onlineCount.set(userId, (onlineCount.get(userId) ?? 0) + 1);
    if (onlineCount.get(userId) === 1) broadcastPresence(userId, true).catch(console.error);

    // { conversationId, isTyping }
    socket.on('typing', async ({ conversationId, isTyping } = {}) => {
      try {
        const conversation = await Conversation.findByPk(Number(conversationId));
        if (!conversation?.hasParticipant(userId)) return;
        emitToUser(conversation.otherParticipantId(userId), 'typing', { conversationId: conversation.id, userId, isTyping: Boolean(isTyping) });
      } catch (err) {
        console.error('typing:', err.message);
      }
    });

    socket.on('disconnect', () => {
      const remaining = (onlineCount.get(userId) ?? 1) - 1;
      if (remaining > 0) onlineCount.set(userId, remaining);
      else {
        onlineCount.delete(userId);
        broadcastPresence(userId, false).catch(console.error);
      }
    });
  });

  return io;
}

// Putuskan semua koneksi user (misalnya setelah password di-reset atau akun dinonaktifkan).
function disconnectUser(userId) {
  io?.in(room(userId)).disconnectSockets(true);
}

module.exports = { initSocket, emitToUser, isOnline, disconnectUser };

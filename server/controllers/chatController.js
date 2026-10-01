const { Op, QueryTypes } = require('sequelize');
const { ChatKey, Conversation, Message, User, sequelize } = require('../models');
const { assertChatRole, getContacts, contactDto } = require('../services/chat');
const { authorInclude, authorDto } = require('../services/postView');
const { emitToUser, isOnline } = require('../socket');
const { parsePublicKey, parseWrappedKey, activeKeyOf } = require('../services/chatKeys');

const PAGE_SIZE = 30;

// ---------- Percakapan ----------

async function findConversationFor(user, id) {
  const conversation = await Conversation.findByPk(id);
  if (!conversation?.hasParticipant(user.id)) throw { name: 'NotFound', message: 'Percakapan tidak ditemukan' };
  return conversation;
}

const conversationIncludes = [authorInclude('teacher'), authorInclude('parent')];

async function conversationDtos(user, conversations) {
  if (conversations.length === 0) return [];
  const ids = conversations.map((c) => c.id);
  const counterpartIds = conversations.map((c) => c.otherParticipantId(user.id));

  const [lastMessages, unread, keys, contacts] = await Promise.all([
    // Pesan terakhir per percakapan (DISTINCT ON khas PostgreSQL).
    sequelize.query(
      `SELECT DISTINCT ON ("conversationId") * FROM "Messages"
       WHERE "conversationId" IN (:ids) ORDER BY "conversationId", id DESC`,
      { replacements: { ids }, type: QueryTypes.SELECT },
    ),
    Message.findAll({
      where: { conversationId: ids, senderId: { [Op.ne]: user.id }, readAt: null },
      attributes: ['conversationId', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
      group: ['conversationId'],
      raw: true,
    }),
    ChatKey.findAll({ where: { userId: counterpartIds, isActive: true } }),
    getContacts(user),
  ]);

  return conversations.map((c) => {
    const counterpartId = c.otherParticipantId(user.id);
    const counterpart = c.teacherId === user.id ? c.parent : c.teacher;
    const last = lastMessages.find((m) => m.conversationId === c.id);
    return {
      id: c.id,
      counterpart: {
        ...authorDto(counterpart),
        subtitle: contacts.get(counterpartId) ? contactDto(contacts.get(counterpartId)).subtitle : '',
        online: isOnline(counterpartId),
        activeKey: keys.find((k) => k.userId === counterpartId)?.toPublic() ?? null,
      },
      lastMessage: last ? Message.build(last).toDto() : null,
      lastMessageAt: c.lastMessageAt,
      unreadCount: Number(unread.find((u) => u.conversationId === c.id)?.count ?? 0),
      // Bisa dibalas hanya selama guru masih wali kelas anak tersebut di tahun ajaran aktif.
      canSend: contacts.has(counterpartId),
    };
  });
}

class ChatController {
  // ----- Kunci -----

  // GET /chat/keys/me — kunci aktif milik sendiri (termasuk kunci privat yang masih terkunci).
  static async myKey(req, res) {
    assertChatRole(req.user);
    const key = await activeKeyOf(req.user.id);
    res.json(
      key?.wrappedPrivateKey
        ? { id: key.id, publicKey: key.publicKey, wrappedPrivateKey: key.wrappedPrivateKey, salt: key.salt, iv: key.iv, iterations: key.iterations }
        : null,
    );
  }

  // POST /chat/keys — simpan kunci baru (hanya jika belum ada kunci aktif).
  static async createKey(req, res) {
    assertChatRole(req.user);
    const publicKey = parsePublicKey(req.body?.publicKey);
    const wrapped = parseWrappedKey(req.body);

    const key = await sequelize.transaction(async (transaction) => {
      if (await activeKeyOf(req.user.id, transaction)) {
        throw { name: 'Conflict', message: 'Kunci chat sudah ada' };
      }
      return ChatKey.create({ userId: req.user.id, publicKey, ...wrapped, isActive: true }, { transaction });
    });
    res.status(201).json({ id: key.id, publicKey: key.publicKey });
  }

  // GET /chat/keys?ids=1,2 — kunci publik yang dipakai di pesan-pesan percakapan user.
  static async publicKeys(req, res) {
    assertChatRole(req.user);
    const ids = String(req.query.ids ?? '')
      .split(',')
      .map(Number)
      .filter((n) => Number.isInteger(n) && n > 0)
      .slice(0, 100);
    if (ids.length === 0) return res.json([]);

    // Hanya kunci milik sendiri atau lawan bicara di percakapan yang ada.
    const conversations = await Conversation.findAll({
      where: { [Op.or]: [{ teacherId: req.user.id }, { parentId: req.user.id }] },
      attributes: ['teacherId', 'parentId'],
    });
    const allowedUsers = new Set([req.user.id, ...conversations.map((c) => c.otherParticipantId(req.user.id))]);
    const keys = await ChatKey.findAll({ where: { id: ids } });
    res.json(keys.filter((k) => allowedUsers.has(k.userId)).map((k) => k.toPublic()));
  }

  // ----- Kontak & percakapan -----

  static async contacts(req, res) {
    const contacts = await getContacts(req.user);
    const existing = await Conversation.findAll({
      where: { [req.user.role === 'teacher' ? 'teacherId' : 'parentId']: req.user.id },
      attributes: ['id', 'teacherId', 'parentId'],
    });
    const list = [...contacts.values()].map((entry) => ({
      ...contactDto(entry),
      online: isOnline(entry.user.id),
      conversationId: existing.find((c) => c.otherParticipantId(req.user.id) === entry.user.id)?.id ?? null,
    }));
    list.sort((a, b) => a.displayName.localeCompare(b.displayName, 'id'));
    res.json(list);
  }

  static async listConversations(req, res) {
    assertChatRole(req.user);
    const conversations = await Conversation.findAll({
      where: { [Op.or]: [{ teacherId: req.user.id }, { parentId: req.user.id }] },
      include: conversationIncludes,
      order: [[sequelize.literal('"lastMessageAt" IS NULL'), 'ASC'], ['lastMessageAt', 'DESC'], ['id', 'DESC']],
    });
    res.json(await conversationDtos(req.user, conversations));
  }

  // POST /conversations  body: { userId } — buka (atau buat) percakapan dengan seorang kontak.
  static async openConversation(req, res) {
    const contacts = await getContacts(req.user);
    const otherId = Number(req.body?.userId);
    if (!contacts.has(otherId)) throw { name: 'Forbidden', message: 'Anda tidak bisa memulai chat dengan pengguna ini' };

    const [teacherId, parentId] = req.user.role === 'teacher' ? [req.user.id, otherId] : [otherId, req.user.id];
    const [conversation] = await Conversation.findOrCreate({ where: { teacherId, parentId } });
    await conversation.reload({ include: conversationIncludes });
    const [dto] = await conversationDtos(req.user, [conversation]);
    res.json(dto);
  }

  // GET /conversations/:id/messages?before=<id> — 30 pesan, terbaru dulu.
  static async messages(req, res) {
    assertChatRole(req.user);
    const conversation = await findConversationFor(req.user, req.params.id);
    const before = Number(req.query.before);
    const where = { conversationId: conversation.id };
    if (Number.isInteger(before) && before > 0) where.id = { [Op.lt]: before };

    const messages = await Message.findAll({ where, order: [['id', 'DESC']], limit: PAGE_SIZE + 1 });
    const page = messages.slice(0, PAGE_SIZE);
    res.json({
      items: page.map((m) => m.toDto()),
      nextBefore: messages.length > PAGE_SIZE ? page.at(-1).id : null,
    });
  }

  // POST /conversations/:id/messages  body: { ciphertext, iv, senderKeyId, recipientKeyId }
  static async send(req, res) {
    assertChatRole(req.user);
    const conversation = await findConversationFor(req.user, req.params.id);
    const otherId = conversation.otherParticipantId(req.user.id);
    if (!(await getContacts(req.user)).has(otherId)) {
      throw { name: 'Forbidden', message: 'Percakapan ini sudah ditutup karena siswa tidak lagi di kelas tersebut' };
    }

    const [myKey, otherKey] = await Promise.all([activeKeyOf(req.user.id), activeKeyOf(otherId)]);
    if (!myKey) throw { name: 'BadRequest', message: 'Kunci chat Anda belum aktif' };
    if (!otherKey) throw { name: 'BadRequest', message: 'Lawan bicara belum mengaktifkan chat (belum pernah login)' };
    // Kunci berubah (misalnya password lawan bicara di-reset): client harus memuat kunci terbaru.
    if (Number(req.body?.senderKeyId) !== myKey.id || Number(req.body?.recipientKeyId) !== otherKey.id) {
      throw { name: 'Conflict', message: 'Kunci enkripsi berubah, silakan muat ulang percakapan' };
    }

    const message = await sequelize.transaction(async (transaction) => {
      const created = await Message.create(
        {
          conversationId: conversation.id,
          senderId: req.user.id,
          senderKeyId: myKey.id,
          recipientKeyId: otherKey.id,
          ciphertext: req.body?.ciphertext,
          iv: req.body?.iv,
        },
        { transaction },
      );
      await conversation.update({ lastMessageAt: created.createdAt }, { transaction });
      return created;
    });

    const dto = message.toDto();
    emitToUser(otherId, 'message:new', dto);
    emitToUser(req.user.id, 'message:new', dto); // tab/perangkat lain milik pengirim
    res.status(201).json(dto);
  }

  // POST /conversations/:id/read — tandai semua pesan dari lawan bicara sebagai sudah dibaca.
  static async markRead(req, res) {
    assertChatRole(req.user);
    const conversation = await findConversationFor(req.user, req.params.id);
    const readAt = new Date();
    const [count] = await Message.update(
      { readAt },
      { where: { conversationId: conversation.id, senderId: { [Op.ne]: req.user.id }, readAt: null } },
    );
    if (count > 0) {
      const payload = { conversationId: conversation.id, readerId: req.user.id, readAt };
      emitToUser(conversation.otherParticipantId(req.user.id), 'messages:read', payload);
      emitToUser(req.user.id, 'messages:read', payload);
    }
    res.json({ updated: count });
  }

  // GET /chat/unread — jumlah pesan belum dibaca (untuk badge di menu).
  static async unreadCount(req, res) {
    if (!['teacher', 'parent'].includes(req.user.role)) return res.json({ count: 0 });
    const [row] = await sequelize.query(
      `SELECT COUNT(*)::int AS count FROM "Messages" m JOIN "Conversations" c ON c.id = m."conversationId"
       WHERE (c."teacherId" = :me OR c."parentId" = :me) AND m."senderId" <> :me AND m."readAt" IS NULL`,
      { replacements: { me: req.user.id }, type: QueryTypes.SELECT },
    );
    res.json({ count: row.count });
  }
}

module.exports = ChatController;

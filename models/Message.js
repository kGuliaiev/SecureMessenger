const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const MessageSchema = new Schema({
    messageId: { type: String, required: true, unique: true },
    chatId: { type: Schema.Types.ObjectId, ref: 'Chat', required: true, index: true },
    senderId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    recipientId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    encryptedContent: { type: String, required: true },
    iv: { type: String, required: true },
    isDelivered: { type: Boolean, default: false },
    isRead: { type: Boolean, default: false },
    isDeletedForSender: { type: Boolean, default: false },
    isDeletedForRecipient: { type: Boolean, default: false },
    isDeletedRemotely: { type: Boolean, default: false },
    ttl: { type: Number, default: null },
    scheduledDeletion: { type: Date, default: null }
}, { timestamps: true }); // Автоматическое обновление createdAt и updatedAt

// Индексы для оптимизации запросов
MessageSchema.index({ chatId: 1, createdAt: -1 }); // Для быстрой сортировки сообщений в чате по времени
MessageSchema.index({ recipientId: 1, isDelivered: 1 }); // Для запросов недоставленных сообщений
MessageSchema.index({ updatedAt: -1 }); // Для быстрого поиска недавно обновленных сообщений
MessageSchema.index({ scheduledDeletion: 1 }, { sparse: true }); // Для поиска сообщений с истекающим сроком жизни

// Метод для установки автоудаления
MessageSchema.methods.setAutoDeleteTimer = function(seconds) {
    if (seconds && seconds > 0) {
        this.ttl = seconds;
        this.scheduledDeletion = new Date(Date.now() + seconds * 1000);
    } else {
        this.ttl = null;
        this.scheduledDeletion = null;
    }
    return this.save();
};

// Статический метод для получения сообщений чата
MessageSchema.statics.findByChatId = function(chatId, options = {}) {
    const query = { 
        chatId: chatId,
        isDeletedForSender: false,
        isDeletedForRecipient: false
    };
    
    if (options.since) {
        query.createdAt = { $gt: new Date(options.since) };
    }
    
    return this.find(query)
        .sort({ createdAt: 1 })
        .limit(options.limit || 100);
};

// Статический метод для удаления истекших сообщений
MessageSchema.statics.deleteExpiredMessages = function() {
    const now = new Date();
    return this.updateMany(
        { scheduledDeletion: { $lte: now, $ne: null } },
        { $set: { isDeletedRemotely: true } }
    );
};

const Message = mongoose.model('Message', MessageSchema);

module.exports = Message;

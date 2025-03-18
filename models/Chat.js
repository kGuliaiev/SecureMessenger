const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ChatSchema = new Schema({
    participants: [{
        type: Schema.Types.ObjectId,
        ref: 'User',
        index: true
    }],
    lastMessage: {
        type: Schema.Types.ObjectId,
        ref: 'Message',
        default: null
    },
    autoDeleteSeconds: {
        type: Number,
        default: null
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true }); // Автоматическое обновление createdAt и updatedAt

// Индексы для оптимизации поиска
ChatSchema.index({ updatedAt: -1 }); // Быстрый поиск последних обновленных чатов
ChatSchema.index({ participants: 1 }); // Поиск чатов по участникам

module.exports = mongoose.model('Chat', ChatSchema);
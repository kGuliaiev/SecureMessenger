const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const UserSchema = new Schema({
    username: { type: String, required: true, unique: true, trim: true, index: true },
    publicKey: { type: String, required: true },
    deviceToken: { type: String, default: null },
    isOnline: { type: Boolean, default: false, index: true },
    lastSeen: { type: Date, default: Date.now, index: true }
}, { timestamps: true }); // Автоматическое обновление createdAt и updatedAt

// Индексы для ускоренного поиска
UserSchema.index({ username: 1 }); // Быстрый поиск пользователей
UserSchema.index({ isOnline: 1, lastSeen: -1 }); // Поиск онлайн-пользователей и сортировка по активности

const User = mongoose.model('User', UserSchema);

module.exports = User;

const express = require('express');
const router = express.Router();
const Chat = require('../models/Chat');
const Message = require('../models/Message');

const { logError } = require('../utils/logger');


// Создание нового чата
router.post('/create', async (req, res) => {
    try {
        const { participants } = req.body;
        
        if (!participants || participants.length < 2) {
            return res.status(400).json({ error: 'Чат должен содержать как минимум двух участников' });
        }
        
        let chat = await Chat.findOne({ participants: { $all: participants }, $size: participants.length });
        
        if (!chat) {
            chat = new Chat({ participants });
            await chat.save();
        }
        
        res.status(201).json(chat);
    } catch (error) {
        logError(`Ошибка создания чата: ${error.message}`);
        res.status(500).json({ error: 'Ошибка сервера при создании чата' });
    }
});

// Получение списка чатов пользователя
router.get('/', async (req, res) => {
    try {
        const userId = req.user.id;
        const chats = await Chat.find({ participants: userId }).sort({ updatedAt: -1 });
        res.status(200).json(chats);
    } catch (error) {
        logError(`Ошибка получения чатов: ${error.message}`);
        res.status(500).json({ error: 'Ошибка сервера при получении чатов' });
    }
});

// Получение информации о конкретном чате
router.get('/:chatId', async (req, res) => {
    try {
        const { chatId } = req.params;
        const chat = await Chat.findById(chatId);
        
        if (!chat) {
            return res.status(404).json({ error: 'Чат не найден' });
        }
        
        res.status(200).json(chat);
    } catch (error) {
        logError(`Ошибка получения данных чата: ${error.message}`);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Локальное удаление чата (пользователь удаляет сообщения у себя)
router.delete('/:chatId/local', async (req, res) => {
    try {
        const { chatId } = req.params;
        const userId = req.user.id;
        
        const messages = await Message.find({ chatId, senderId: userId });
        
        if (!messages.length) {
            return res.status(404).json({ error: 'Нет сообщений для удаления' });
        }
        
        await Message.updateMany(
            { chatId, senderId: userId },
            { isDeletedForSender: true }
        );
        
        res.status(200).json({ message: 'Локальное удаление чата выполнено' });
    } catch (error) {
        logError(`Ошибка локального удаления чата: ${error.message}`);
        res.status(500).json({ error: 'Ошибка сервера при локальном удалении чата' });
    }
});

// Полное удаление чата для всех пользователей
router.delete('/:chatId/full', async (req, res) => {
    try {
        const { chatId } = req.params;
        const userId = req.user.id;
        
        const chat = await Chat.findById(chatId);
        if (!chat) {
            return res.status(404).json({ error: 'Чат не найден' });
        }
        
        if (!chat.participants.includes(userId)) {
            return res.status(403).json({ error: 'Нет прав на удаление чата' });
        }
        
        await Message.deleteMany({ chatId });
        await Chat.deleteOne({ _id: chatId });
        
        res.status(200).json({ message: 'Чат полностью удален' });
    } catch (error) {
        logError(`Ошибка полного удаления чата: ${error.message}`);
        res.status(500).json({ error: 'Ошибка сервера при удалении чата' });
    }
});


module.exports = router;

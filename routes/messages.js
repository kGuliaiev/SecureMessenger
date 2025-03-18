const express = require('express');
const router = express.Router();


const Message = require('../models/Message');
const Chat = require('../models/Chat');
const User = require('../models/User');

// Запуск задачи для автоудаления сообщений
const autoDeleteJob = require('../jobs/autoDeleteMessages');

// Отправка сообщения
router.post('/send', async (req, res) => {
    try {
        const { messageId, recipientId, encryptedContent, iv, chatId } = req.body;
        const senderId = req.user.id;
        
        // Проверка существования получателя
        const recipient = await User.findById(recipientId);
        if (!recipient) {
            return res.status(404).json({ error: 'Получатель не найден' });
        }
        
        // Проверка или создание чата
        let chat;
        if (chatId) {
            chat = await Chat.findById(chatId);
            if (!chat) {
                return res.status(404).json({ error: 'Чат не найден' });
            }
            
            // Проверка, что отправитель участвует в чате
            if (!chat.participants.includes(senderId)) {
                return res.status(403).json({ error: 'Нет доступа к этому чату' });
            }
        } else {
            // Проверка, существует ли уже чат между этими пользователями
            chat = await Chat.findOne({
                participants: { $all: [senderId, recipientId], $size: 2 }
            });
            
            if (!chat) {
                // Создание нового чата
                chat = new Chat({
                    participants: [senderId, recipientId]
                });
                await chat.save();
            }
        }
        
        // Создание сообщения
        const message = new Message({
            messageId,
            chatId: chat._id,
            senderId,
            recipientId,
            encryptedContent,
            iv,
            timestamp: new Date()
        });
        
        // Проверка на автоудаление
        if (chat.autoDeleteSeconds) {
            message.ttl = chat.autoDeleteSeconds;
            message.scheduledDeletion = new Date(Date.now() + chat.autoDeleteSeconds * 1000);
        }
        
        await message.save();
        
        // Обновление информации о последнем сообщении в чате
        chat.lastMessage = message._id;
        chat.updatedAt = new Date();
        await chat.save();
        
        // Отправка уведомления через WebSocket
        const io = req.app.get('io');
        io.to(`user:${recipientId}`).emit('new-message', {
            messageId,
            chatId: chat._id,
            senderId
        });
        
        res.status(201).json({
            success: true,
            message: {
                id: message._id,
                messageId: message.messageId,
                chatId: chat._id,
                timestamp: message.timestamp
            }
        });
        
    } catch (error) {
        console.error('Send message error:', error);
        res.status(500).json({ error: 'Ошибка сервера при отправке сообщения' });
    }
});

// Получение сообщений для чата
router.get('/chat/:chatId', async (req, res) => {
    try {
        const { chatId } = req.params;
        const { since } = req.query;
        const userId = req.user.id;
        
        // Проверка доступа к чату
        const chat = await Chat.findById(chatId);
        if (!chat || !chat.participants.includes(userId)) {
            return res.status(403).json({ error: 'Нет доступа к этому чату' });
        }
        
        // Формирование запроса для поиска сообщений
        const query = { chatId };
        
        // Если указана временная метка, получаем только более новые сообщения
        if (since) {
            query.timestamp = { $gt: new Date(parseInt(since)) };
        }
        
        // Получение сообщений
        const messages = await Message.find(query)
            .sort({ timestamp: 1 })
            .lean();
        
        // Фильтрация удаленных сообщений
        const filteredMessages = messages.filter(msg => {
            const isSender = msg.senderId.toString() === userId;
            if (isSender && msg.isDeletedForSender) return false;
            if (!isSender && msg.isDeletedForRecipient) return false;
            return true;
        });
        
        // Отметка сообщений как прочитанных
        const unreadMessages = messages.filter(msg => 
            msg.recipientId.toString() === userId && 
            !msg.isRead
        );
        
        if (unreadMessages.length > 0) {
            await Message.updateMany(
                { 
                    _id: { $in: unreadMessages.map(msg => msg._id) }
                },
                { 
                    isRead: true
                }
            );
            
            // Уведомление отправителя о прочтении
            const io = req.app.get('io');
            unreadMessages.forEach(msg => {
                io.to(`user:${msg.senderId}`).emit('message-read', {
                    messageId: msg.messageId,
                    chatId: msg.chatId
                });
            });
        }
        
        res.status(200).json(filteredMessages);
        
    } catch (error) {
        console.error('Get messages error:', error);
        res.status(500).json({ error: 'Ошибка сервера при получении сообщений' });
    }
});

// Удаление сообщения (локально)
router.delete('/:messageId', async (req, res) => {
    try {
        const { messageId } = req.params;
        const userId = req.user.id;
        
        const message = await Message.findOne({ messageId });
        
        if (!message) {
            return res.status(404).json({ error: 'Сообщение не найдено' });
        }
        
        // Проверка, что пользователь является отправителем или получателем
        const isSender = message.senderId.toString() === userId;
        const isRecipient = message.recipientId.toString() === userId;
        
        if (!isSender && !isRecipient) {
            return res.status(403).json({ error: 'Нет доступа к этому сообщению' });
        }
        
        // Отметка сообщения как удаленного для соответствующего пользователя
        if (isSender) {
            message.isDeletedForSender = true;
        } else {
            message.isDeletedForRecipient = true;
        }
        
        await message.save();
        
        res.status(200).json({ success: true });
        
    } catch (error) {
        console.error('Delete message error:', error);
        res.status(500).json({ error: 'Ошибка сервера при удалении сообщения' });
    }
});

// Удаленное удаление сообщения
router.delete('/:messageId/remote', async (req, res) => {
    try {
        const { messageId } = req.params;
        const userId = req.user.id;
        
        const message = await Message.findOne({ messageId });
        
        if (!message) {
            return res.status(404).json({ error: 'Сообщение не найдено' });
        }
        
        // Проверка, что пользователь является отправителем
        if (message.senderId.toString() !== userId) {
            return res.status(403).json({ error: 'Только отправитель может удалить сообщение удаленно' });
        }
        
        // Отметка сообщения как удаленного для обоих пользователей
        message.isDeletedForSender = true;
        message.isDeletedForRecipient = true;
        message.isDeletedRemotely = true;
        
        await message.save();
        
        // Отправка уведомления получателю о удаленном удалении
        const io = req.app.get('io');
        io.to(`user:${message.recipientId}`).emit('message-deleted-remotely', {
            messageId: message.messageId,
            chatId: message.chatId
        });
        
        res.status(200).json({ success: true });
        
    } catch (error) {
        console.error('Remote delete message error:', error);
        res.status(500).json({ error: 'Ошибка сервера при удаленном удалении сообщения' });
    }
});

// Установка таймера автоудаления для сообщения
router.post('/:messageId/auto-delete', async (req, res) => {
    try {
        const { messageId } = req.params;
        const { seconds } = req.body;
        const userId = req.user.id;
        
        const message = await Message.findOne({ messageId });
        
        if (!message) {
            return res.status(404).json({ error: 'Сообщение не найдено' });
        }
        
        // Проверка, что пользователь является отправителем
        if (message.senderId.toString() !== userId) {
            return res.status(403).json({ error: 'Только отправитель может установить автоудаление' });
        }
        
        message.ttl = seconds;
        if (seconds) {
            message.scheduledDeletion = new Date(Date.now() + seconds * 1000);
        } else {
            message.scheduledDeletion = null;
        }
        
        await message.save();
        
        // Уведомление получателя об установке автоудаления
        const io = req.app.get('io');
        io.to(`user:${message.recipientId}`).emit('message-auto-delete-set', {
            messageId: message.messageId,
            chatId: message.chatId,
            ttl: seconds
        });
        
        res.status(200).json({ success: true });
        
    } catch (error) {
        console.error('Set auto-delete error:', error);
        res.status(500).json({ error: 'Ошибка сервера при установке автоудаления' });
    }
});



module.exports = router;
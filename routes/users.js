const express = require('express');
const router = express.Router();

const User = require('../models/User');

// Поиск пользователей
router.get('/search', async (req, res) => {
    try {
        const { query } = req.query;
        
        if (!query || query.length < 3) {
            return res.status(400).json({ error: 'Запрос должен содержать не менее 3 символов' });
        }
        
        // Поиск пользователей (исключая текущего пользователя)
        const users = await User.find({
            username: { $regex: query, $options: 'i' },
            _id: { $ne: req.user.id }
        }).limit(20);
        
        // Возврат только безопасных данных
        const safeUsers = users.map(user => user.toSafeObject());
        
        res.status(200).json(safeUsers);
        
    } catch (error) {
        console.error('User search error:', error);
        res.status(500).json({ error: 'Ошибка сервера при поиске пользователей' });
    }
});

// Получение данных пользователя по ID
router.get('/:id', async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        
        if (!user) {
            return res.status(404).json({ error: 'Пользователь не найден' });
        }
        
        res.status(200).json(user.toSafeObject());
        
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ error: 'Ошибка сервера при получении данных пользователя' });
    }
});

// Получение публичного ключа пользователя
router.get('/:id/public-key', async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        
        if (!user) {
            return res.status(404).json({ error: 'Пользователь не найден' });
        }
        
        res.status(200).json({ publicKey: user.publicKey });
        
    } catch (error) {
        console.error('Get public key error:', error);
        res.status(500).json({ error: 'Ошибка сервера при получении публичного ключа' });
    }
});

module.exports = router;
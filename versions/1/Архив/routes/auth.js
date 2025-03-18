const express = require('express');
const router = express.Router();

const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Регистрация нового пользователя
router.post('/register', async (req, res) => {
    try {
        const { username, publicKey, deviceToken } = req.body;
        
        // Проверка, существует ли пользователь
        const existingUser = await User.findOne({ username });
        if (existingUser) {
            return res.status(400).json({ error: 'Пользователь с таким именем уже существует' });
        }
        
        // Создание нового пользователя
        const user = new User({
            username,
            publicKey,
            deviceToken
        });
        
        await user.save();
        
        // Создание JWT токена
        const token = jwt.sign(
            { id: user._id, username: user.username },
            process.env.JWT_SECRET,
            { expiresIn: '30d' }
        );
        
        res.status(201).json({
            user: user.toSafeObject(),
            token
        });
        
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Ошибка сервера при регистрации' });
    }
});

// Обновление ключа пользователя
router.post('/update-key', async (req, res) => {
    try {
        const { username, oldPublicKey, newPublicKey } = req.body;
        
        // Проверка, существует ли пользователь и совпадает ли старый ключ
        const user = await User.findOne({ username, publicKey: oldPublicKey });
        if (!user) {
            return res.status(400).json({ error: 'Пользователь не найден или старый ключ неверен' });
        }
        
        // Обновление ключа
        user.publicKey = newPublicKey;
        await user.save();
        
        // Создание нового JWT токена
        const token = jwt.sign(
            { id: user._id, username: user.username },
            process.env.JWT_SECRET,
            { expiresIn: '30d' }
        );
        
        res.status(200).json({
            user: user.toSafeObject(),
            token
        });
        
    } catch (error) {
        console.error('Key update error:', error);
        res.status(500).json({ error: 'Ошибка сервера при обновлении ключа' });
    }
});

// Обновление токена устройства
router.post('/update-device-token', async (req, res) => {
    try {
        const { userId, deviceToken } = req.body;
        
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ error: 'Пользователь не найден' });
        }
        
        user.deviceToken = deviceToken;
        await user.save();
        
        res.status(200).json({ success: true });
        
    } catch (error) {
        console.error('Device token update error:', error);
        res.status(500).json({ error: 'Ошибка сервера при обновлении токена устройства' });
    }
});

module.exports = router;
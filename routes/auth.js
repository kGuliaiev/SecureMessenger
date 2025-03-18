const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const User = require('../models/User');
const { logError } = require('../utils/logger');
const redisClient = require('../config/redis');
const router = express.Router();
const { body, validationResult } = require("express-validator");

// Ограничение количества попыток входа с логированием
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    handler: (req, res) => {
        const clientIp = req.ip;
        logError(`Превышено количество попыток входа. IP: ${clientIp}, Пользователь: ${req.body.username || 'Неизвестно'}`);
        res.status(429).json({ error: 'Слишком много попыток входа. Попробуйте позже.' });
    },
    message: 'Слишком много попыток входа. Попробуйте позже.'
});

const generateTokens = (user) => {
    const accessToken = jwt.sign({ id: user._id, username: user.username }, process.env.JWT_SECRET, { expiresIn: '15m' });
    const refreshToken = jwt.sign({ id: user._id }, process.env.JWT_REFRESH_SECRET, { expiresIn: '7d' });
    return { accessToken, refreshToken };
};

// Генерация уникального идентификатора (8 символов: заглавные буквы и цифры)
const generateUniqueId = async () => {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let uniqueId;
    let exists;
    do {
        uniqueId = Array.from({ length: 8 }, () => characters[Math.floor(Math.random() * characters.length)]).join('');
        exists = await User.findOne({ uniqueId });
    } while (exists);
    return uniqueId;
};

// Регистрация нового пользователя
router.post("/register", loginLimiter, async (req, res)  => {
    try {
        const { username, publicKey, deviceToken } = req.body;
        const existingUser = await User.findOne({ username });
        if (existingUser) {
            logError(`Пользователь с таким именем уже существует: ${username}`);
            return res.status(400).json({ error: 'Пользователь с таким именем уже существует' });
        }
        const uniqueId = await generateUniqueId();
        const user = new User({ username, uniqueId, publicKey, deviceToken });
        await user.save();
        const tokens = generateTokens(user);
        res.status(201).json({ user: user.toSafeObject(), ...tokens });
    } catch (error) {
        logError(`Ошибка регистрации: ${error.message}`);
        res.status(500).json({ error: 'Ошибка сервера при регистрации' });
    }
});

// Логин
router.post("/login", loginLimiter, async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await User.findOne({ username });
        if (!user) {
            return res.status(400).json({ error: 'Неверный логин или пароль' });
        }
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ error: 'Неверный логин или пароль' });
        }
        const tokens = generateTokens(user);
        res.json(tokens);
    } catch (error) {
        logError(`Ошибка при входе: ${error.message}`);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Обновление токена
router.post('/refresh-token', async (req, res) => {
    try {
        const { refreshToken } = req.body;
        if (!refreshToken) {
            return res.status(401).json({ error: 'Требуется refresh token' });
        }
        let decoded;
        try {
            decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
        } catch (error) {
            return res.status(403).json({ error: "Недействительный refresh token" });
        }
        const user = await User.findById(decoded.id);
        if (!user) {
            return res.status(403).json({ error: 'Пользователь не найден' });
        }
        const tokens = generateTokens(user);
        res.json(tokens);
    } catch (error) {
        logError(`Ошибка при обновлении токена: ${error.message}`);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Обновление deviceToken пользователя
router.post('/update-device-token', async (req, res) => {
    try {
        const { username, deviceToken } = req.body;
        const user = await User.findOne({ username });
        if (!user) {
            return res.status(404).json({ error: 'Пользователь не найден' });
        }
        user.deviceToken = deviceToken;
        await user.save();
        res.json({ message: 'Device Token обновлен' });
    } catch (error) {
        logError(`Ошибка при обновлении Device Token: ${error.message}`);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Выход
router.post('/logout', async (req, res) => {
    try {
        const token = req.header('Authorization')?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ error: 'Нет токена' });
        }
        await redisClient.set(token, 'blacklisted', 'EX', 3600);
        res.json({ message: 'Выход выполнен' });
    } catch (error) {
        logError(`Ошибка при выходе: ${error.message}`);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

module.exports = router;

// Загрузка переменных окружения (должно выполняться первым)
const dotenv = require('dotenv');
dotenv.config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const http = require('http');
const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');
const mongoose = require('./config/db.js'); // Проверьте, что этот путь соответствует структуре проекта

// Инициализация Express
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Сохранение io для использования в маршрутах
app.set('io', io);

// Middleware для безопасности
app.use(helmet());
app.use(cors());
app.use(express.json()); // Вместо bodyParser.json()

// Ограничение количества запросов для защиты от DDoS
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 минут
    max: 100, // ограничение каждого IP до 100 запросов на окно
    standardHeaders: true,
    legacyHeaders: false
});
app.use('/api/', apiLimiter);

// Middleware для проверки JWT токена
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ error: 'Не авторизован' });
    }
    
    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Недействительный токен' });
        }
        req.user = user;
        next();
    });
};

// Роуты для аутентификации и регистрации
const authRoutes = require('./routes/auth');
app.use('/api/auth', authRoutes);

// Роуты для работы с пользователями
const userRoutes = require('./routes/users');
app.use('/api/users', authenticateToken, userRoutes);

// Роуты для работы с сообщениями
const messageRoutes = require('./routes/messages');
app.use('/api/messages', authenticateToken, messageRoutes);

// Роуты для работы с чатами
const chatRoutes = require('./routes/chats');
app.use('/api/chats', authenticateToken, chatRoutes);

// Базовый маршрут для проверки работы API
app.get('/', (req, res) => {
    res.send('Secure Messenger API работает');
});

// WebSocket соединения
io.on('connection', (socket) => {
    // Аутентификация для WebSocket
    socket.on('authenticate', async (token) => {
        try {
            const user = jwt.verify(token, process.env.JWT_SECRET);
            socket.userId = user.id;
            
            // Обновление статуса пользователя на "онлайн"
            const User = require('./models/User');
            await User.findByIdAndUpdate(user.id, { 
                isOnline: true,
                lastSeen: new Date()
            });
            
            // Присоединение к персональному каналу для получения сообщений
            socket.join(`user:${user.id}`);
            socket.emit('authenticated', { success: true });
            
            // Получение списка чатов пользователя
            const Chat = require('./models/Chat');
            const chats = await Chat.find({ participants: user.id });
            chats.forEach(chat => {
                socket.join(`chat:${chat._id}`);
            });
            
        } catch (error) {
            socket.emit('authenticated', { success: false, error: 'Invalid token' });
        }
    });
    
    // Обработка отключения пользователя
    socket.on('disconnect', async () => {
        if (socket.userId) {
            const User = require('./models/User');
            await User.findByIdAndUpdate(socket.userId, { 
                isOnline: false,
                lastSeen: new Date()
            });
        }
    });
});

// Запуск сервера
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});
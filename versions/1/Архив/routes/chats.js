const express = require('express');
const router = express.Router();

// Минимальная реализация маршрутов для чатов
router.get('/', (req, res) => {
    res.json({ message: 'Chats route works' });
});

module.exports = router;
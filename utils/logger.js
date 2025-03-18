const fs = require('fs');
const path = require('path');
const io = require('../server').io;

const logFilePath = path.join(__dirname, '../logs/errors.log');

function logError(errorMessage, req = null) {
    const timestamp = new Date().toISOString();
    const clientIp = req ? req.ip : 'Неизвестно';
    const userAgent = req ? req.headers['user-agent'] : 'Неизвестно';
    const host = req ? req.headers['host'] : 'Неизвестно';
    const referer = req ? req.headers['referer'] || 'Прямой запрос' : 'Неизвестно';
    
    const logMessage = `[${timestamp}] ERROR: ${errorMessage} | IP: ${clientIp} | Host: ${host} | User-Agent: ${userAgent} | Referer: ${referer}\n`;
    
    fs.appendFile(logFilePath, logMessage, (err) => {
        if (err) console.error('Ошибка записи лога:', err);
    });
    
    io.emit('admin_alert', { message: logMessage });
}

module.exports = { logError };

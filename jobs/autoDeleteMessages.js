const cron = require('node-cron');
const Message = require('./models/Message'); // Assuming Mongoose model
const Chat = require('./models/Chat'); // Assuming Mongoose model

// Function to auto-delete expired messages
async function deleteExpiredMessages() {
    try {
        const now = new Date();

        // Find messages with auto-delete time in the past
        const expiredMessages = await Message.find({
            scheduledDeletion: { $lte: now },
            isDeletedRemotely: false
        });

        // Process each expired message
        for (const message of expiredMessages) {
            try {
                // Mark message as deleted
                message.isDeletedLocally = true;
                message.isDeletedRemotely = true;
                await message.save();

                // Emit socket event to notify clients about message deletion
                global.io.to(message.chatId).emit('message-deleted-remotely', {
                    messageId: message.id,
                    chatId: message.chatId
                });
            } catch (messageError) {
                console.error(`Error processing message ${message.id}:`, messageError);
            }
        }

        // Check and apply chat-level auto-deletion
        await handleChatAutoDelete();

    } catch (error) {
        console.error('Error in auto-delete process:', error);
    }
}

// Function to handle chat-level auto-deletion
async function handleChatAutoDelete() {
    try {
        const now = new Date();

        // Find chats with auto-delete settings
        const chatsToDelete = await Chat.find({
            autoDeleteSeconds: { $exists: true, $ne: null },
            lastMessageTimestamp: { $lte: new Date(now.getTime() - this.autoDeleteSeconds * 1000) }
        });

        for (const chat of chatsToDelete) {
            try {
                // Delete all messages in the chat
                await Message.deleteMany({ chatId: chat.id });

                // Delete the chat
                await Chat.findByIdAndDelete(chat.id);

                // Emit socket event to notify clients about chat deletion
                global.io.emit('chat-deleted-remotely', {
                    chatId: chat.id
                });
            } catch (chatError) {
                console.error(`Error processing chat ${chat.id}:`, chatError);
            }
        }
    } catch (error) {
        console.error('Error in chat auto-delete process:', error);
    }
}

// Schedule auto-delete to run every hour
function scheduleAutoDelete() {
    // Run every hour at the start of the hour
    cron.schedule('0 * * * *', () => {
        console.log('Running auto-delete process');
        deleteExpiredMessages();
    });
}

module.exports = {
    scheduleAutoDelete,
    deleteExpiredMessages,
    handleChatAutoDelete
};
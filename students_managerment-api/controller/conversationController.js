const conversationService = require('../service/conversationService');
const conversationRepository = require('../repository/conversationRepository');
const messageRepository = require('../repository/messageRepository');


const createDirectConversation = async (req, res) => {
    try {
        const currentUserId = Number(req.user.id);
        const targetUserId = Number(req.body.userId);

        if (!Number.isInteger(currentUserId) || currentUserId <= 0) {
            return res.status(401).json({
                message: 'User hiện tại không hợp lệ'
            });
        }

        if (!Number.isInteger(targetUserId) || targetUserId <= 0) {
            return res.status(400).json({
                message: 'userId không hợp lệ'
            });
        }

        const conversation =
            await conversationService.getOrCreateDirectConversation(
                currentUserId,
                targetUserId
            );

        return res.status(200).json({
            message: 'Conversation đã sẵn sàng',
            data: conversation
        });

    } catch (error) {
        console.error(
            'CREATE DIRECT CONVERSATION ERROR:',
            error
        );

        return res.status(500).json({
            message:
                error.message ||
                'Không thể tạo conversation'
        });
    }
};

// Lấy danh sách tất cả userId trong conversation để join vào room
const getUserConversations = async (req, res) => {
    try {
        const userId = req.user.id;

        const conversations =
            await conversationService.getUserConversations(userId);

        return res.status(200).json({
            data: conversations
        });
    } catch (error) {
        console.error(
            'GET USER CONVERSATIONS ERROR:',
            error
        );

        return res.status(500).json({
            message: 'Không thể lấy danh sách conversation'
        });
    }
};
// Lấy danh sách tất cả userId trong conversation
const getConversationMembers = async (req, res) => {
    try {
        const userId = req.user.id;
        const conversationId = Number(
            req.params.conversationId
        );

        if (Number.isNaN(conversationId)) {
            return res.status(400).json({
                message: 'conversationId không hợp lệ'
            });
        }

        const members =
            await conversationService.getConversationMembers(
                conversationId,
                userId
            );

        return res.status(200).json({
            data: members
        });
    } catch (error) {
        console.error(
            'GET CONVERSATION MEMBERS ERROR:',
            error
        );

        if (
            error.message ===
            'Bạn không thuộc conversation này'
        ) {
            return res.status(403).json({
                message: error.message
            });
        }

        return res.status(500).json({
            message: 'Không thể lấy members'
        });
    }
};
// lấy danh sách toàn bộ userId trong conversation đến room , mục đích để hiện thị một newmessage 
const getConversationMemberIds = async (conversationId) => {
    const query = `
        SELECT user_id 
        FROM conversation_members 
        WHERE conversation_id = $1;
    `;
    const { rows } = await pool.query(query, [conversationId]);
    return rows.map(row => Number(row.user_id));
};

const getConversations = async (req, res, next) => {
  try {
    const userId = req.user.id; // Lấy từ authMiddleware (JWT)
    
    const conversations = await conversationRepository.getUserConversations(userId);

    return res.status(200).json({
      success: true,
      data: conversations,
    });
  } catch (error) {
    next(error);
  }
};


//  [PATCH] /api/conversations/:id/read
//  Đánh dấu đã xem toàn bộ tin nhắn trong cuộc trò chuyện
const markAsRead = async (req, res, next) => {
  try {
    const conversationId = req.params.id;
    const userId = req.user.id; // Lấy từ authMiddleware (JWT)

    await messageRepository.markMessagesAsRead(conversationId, userId);

    // Bắn Socket event báo cho người kia biết nếu cần (Optional)
    const io = req.app.get('io');
    if (io) {
      io.to(`conversation:${conversationId}`).emit('messages_marked_read', {
        conversationId,
        readBy: userId,
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Đã đánh dấu là đã đọc',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
    createDirectConversation,
    getUserConversations,
    getConversationMembers,
    getConversationMemberIds,
    markAsRead,
    getConversations 

};
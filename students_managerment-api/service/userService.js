const userRepository = require('../repository/userRepository');

const searchUsersForChat = async (currentUserId, search) => {
    return userRepository.searchUsersForChat(currentUserId, search);
};

module.exports = {
    searchUsersForChat
};

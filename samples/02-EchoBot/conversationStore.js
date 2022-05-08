const storage = new Map();

async function loadConversationState(conversationId) {
    return storage.get(conversationId);
}

async function saveConversationState(conversationId, state) {
    storage.set(conversationId, state);
}

module.exports.loadConversationState = loadConversationState;
module.exports.saveConversationState = saveConversationState;

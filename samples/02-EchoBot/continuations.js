const { canContinueWith, continueWith, dontContinue } = require('@stevenic/continue-js');

async function startContinuation(context) {
    if (!context.conversationState.name) {
        // Prompt for users name and chain response to namePromptContinuation
        await context.sendActivity(`Hi! What's your name?`);
        return await continueWith(namePromptContinuation);
    } else {
        // Echo back what they said and end conversation
        await context.sendActivity(`${context.conversationState.name}, you said: ${context.activity.text}`);
        return await dontContinue();
    }
}

async function namePromptContinuation(context) {
    // Save users response and end conversation
    context.conversationState.name = context.activity.text;
    await context.sendActivity(`Nice to meet you ${context.conversationState.name}! You can say stuff to me and I'll echo it back.`);
    return await dontContinue();
}

// Register continuations.
canContinueWith(startContinuation);
canContinueWith(namePromptContinuation);

// We only need to export the root continuation
module.exports.startContinuation = startContinuation;
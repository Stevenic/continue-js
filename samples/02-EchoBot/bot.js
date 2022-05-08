// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

const { ActivityHandler, MessageFactory } = require('botbuilder');
const { continueWith, continueNow } = require('@stevenic/continue-js');
const { loadConversationState, saveConversationState } = require('./conversationStore');
const { startContinuation } = require('./continuations');

class EchoBot extends ActivityHandler {
    constructor() {
        super();
        this.onMessage(async (context, next) => {
            // Load continuation and state for current conversation
            const conversationId = context.activity.conversation.id;
            const { continuation, state } = await loadConversationState(conversationId) ?? { 
                continuation: await continueWith(startContinuation),
                state: {}
            };

            // Add state to turn context
            context.conversationState = state;

            // Execute continuation
            const nextContinuation = await continueNow(continuation, context);

            // Save next continuation and any state changes
            await saveConversationState(conversationId, { 
                continuation: !nextContinuation.done ? nextContinuation : await continueWith(startContinuation),
                state: context.conversationState 
            });

            // By calling next() you ensure that the next BotHandler is run.
            await next();
        });

        this.onMembersAdded(async (context, next) => {
            const membersAdded = context.activity.membersAdded;
            const welcomeText = 'Hello and welcome!';
            for (let cnt = 0; cnt < membersAdded.length; ++cnt) {
                if (membersAdded[cnt].id !== context.activity.recipient.id) {
                    await context.sendActivity(MessageFactory.text(welcomeText, welcomeText));
                }
            }
            
            // By calling next() you ensure that the next BotHandler is run.
            await next();
        });
    }
}

module.exports.EchoBot = EchoBot;

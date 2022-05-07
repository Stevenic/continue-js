# Continue JS
A tiny library that makes building complex bots and workflows a little easier. 

## What is it?
Building a complex bot that can ask users branching questions or workflows that need to span many server processes and tasks can be challenging. You often need the help of [orchestration frameworks](https://en.wikipedia.org/wiki/Orchestration_(computing))
like the [Bot Framework SDK](https://github.com/microsoft/botframework-sdk) or the [Durable Task Framework](https://github.com/Azure/durabletask) to help simplify developing these types of applications. These domain specific frameworks are great (I helped design one of them) but let’s be honest, they often come with a steep learning curve. There are typically several concepts you need to learn to get started and the domain specific nature means that learning to use a framework for one domain will have little to no crossover for building apps in another domain.

Before I describe what Continue JS is, let me state what it isn’t. It’s not a complete solution for building a bot or workflow. It’s a library that helps simplify the solving of a problem that these domains share, running the next block of code after some long running operation, like asking the user a question or performing some task, completes.  To help solve this problem it uses the concept of a [continuation]( https://en.wikipedia.org/wiki/Continuation) to save off the function and arguments that should be run after the operation completes.

As JavaScript/TypeScript developers you’re already using continuations in the form of callbacks or async/await. These continuations call back into your code after you perform some short running operation, like a network request, completes. These continuations are super rich and can leverage things like closure scope to give you access to variables in the processes memory after the operation completes. The problem with using traditional continuations like this for long running operations is that the long running operation could take minutes, hours, days, or even weeks to complete. During that time, your servers process could have crashed, redeployed, or even the code modified meaning there’s no way to reliably continue the execution of a running process after a long operation completes.

## How does it work?
Continue JS solves the problem of identifying the next code to run, by letting you specify the function to continue with after an operation completes. There are 4 functions you need to learn to use Continue JS. Lets look at teh first 3 using a simple example of a bot that prompts a user for their name:

```TS
// Functions comprising the bots logic
async function promptForNameContinuation(context: BotContext): Promise<Continuation> {
  await context.send(`Hi I'm "Bot". What's your name?`);
  return await continueWith(namePromptResponseContinuation);
}

async function namePromptResponseContinuation(context: BotContext): Promise<Continuation> {
  await context.send(`Hi ${context.message}! Nice to meet you!`);
  return await dontContinue();
}

// Register continuations with Continue JS
canContinueWith(promptForNameContinuation);
canContinueWith(namePromptResponseContinuation);

// App specific context object passed to every continuation
interface BotContext {
  message: string;
  conversationId: string;
  send(message: string): Promise<void>;
}
```

We’ll look at the code that drives everything in a moment but let’s break down the code for our bot. The bots main logic is comprised of two standard async functions: the `promptForNameContinuation()` function asks the user their name and the `namePromptResponseContinuation()` processes the users response. Those functions need to be registered with Continue JS using  `canContinueWith()`. More on that later...

Theres going to be a delay of an undeterminable amount of time between us asking the user their name and them responding. It will likely be just a few seconds, but it could easily be tomorrow or not even at all. We can use the `continueWith()` function to specify the function that should be called after the user responds to our question. This function returns a `Continuation` object which we can return to end the current “turn” with the user.  Bots use the concept of a “turn” to represent a single request/response pair between a bot and a user so we can use continueWith() to specify the function that should be called for the next “turn” of the conversation.

When the user responds to our question, the bots driver code will call the namePromptResponseContinuation() and we can retrieve the users response from `context.message`.  Continue JS doesn’t know anything about bots but it does know you’ll likely need to pass in some sort of contextual session information, so it reserves the first parameter of every continuation function to pass along a context object from the driver code.

In our example, the bot will reply to the user with a personalized greeting. If we wanted to ask additional follow-up questions we could ask the question and then chain to other response handlers using `continueWith()`. Once we’re done asking questions, we can end the conversation by returning `dontContinue()`. 

Let’s look at the bot’s driver code and our last function:
 
```TS
// Bots message handler
async function onMessageReceived(context: BotContext) {
  // Load existing continuation for conversation or create a new one
  const continuation = await loadContinuation(context.conversationId) ?? await continueWith(promptForNameContinuation);
  
  // Execute continuation
  const next = await continueNow(continuation, context);
  if (next.done) {
    // Delete saved continuation if its exists
    await deleteContinuation(context.conversationId);
  } else {
    // Save next continuation for conversation
    await saveContinuation(context.conversationId, next);
  }
}

// Continuation storage system
const storage = new Map<string, Continuation>();

async function loadContinuation(conversationId: string): Promise<Continuation|undefined> {
  return storage.get(conversationId);
}

async function saveContinuation(conversationId: string, continuation: Continuation): Promise<void> {
  storage.set(conversationId, continuation);
}

async function deleteContinuation(conversationId: string): Promise<void> {
  storage.delete(conversationId);
}
```

The continuation returned by continueWith() is a simple JSON object that needs to be stored somewhere and then reloaded once the operation your waiting on completes. With both bots and workflows you typically have multiple conversations/workflows you’re managing so you’ll want to store your continuations relative to the conversation of session ID the framework you’re using provides. It’s totally up to you for where and how you want to store your continuations. I’m showing a very simple memory based continuation store for illustration purposes.

The heart of our bots driver code is the `onMessageReceived()` function. To dispatch received messages we need a continuation. We can call our stores `loadContinuation()` function to load the last saved continuation if it exists. If it doesn’t exist we need to create a new one. We can just create one by calling `continueWith()`. Once we’ve identified the continuation to use we can execute it using `continueNow()`. This function takes the continuation to execute as well as the context object to pass to the function. All continuation functions must return the next continuation to chain to so our driver code will look to see if the returned continuation is done,  `dontContinue()` was called, and either save the new continuation or delete the existing one.

Deleting the existing continuation will effectively end the conversation meaning that the next turn with the user will result in the conversation flow returning to the initial continuation. 


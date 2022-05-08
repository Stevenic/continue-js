# Continue JS

A tiny library that makes building complex bots and workflows a little easier. 

**Table of Contents**

- [What is it?](#what-is-it)
- [How does it work?](#how-does-it-work)
- [Why is canContinueWith() needed?](#why-is-cancontinuewith-needed)
  - [Custom getContinuationId()](#custom-getcontinuationid)
  - [Custom functionNotFound()](#custom-functionnotfound)
- [Installing](#installing)
- [Building](#building)

## What is it?

Building a complex bot that can ask users branching questions or workflows that need to span many server processes and tasks can be challenging. You often need the help of [orchestration frameworks](https://en.wikipedia.org/wiki/Orchestration_(computing))
like the [Bot Framework SDK](https://github.com/microsoft/botframework-sdk) or the [Durable Task Framework](https://github.com/Azure/durabletask) to help simplify developing these types of applications. These domain specific frameworks are great (I helped design one of them) but let’s be honest, they often come with a steep learning curve. There are typically several concepts you need to learn to get started and the domain specific nature means that learning to use a framework for one domain will have little to no crossover for building apps in another domain.

Before I describe what Continue JS is, let me state what it isn’t. It’s not a complete solution for building a bot or workflow. It’s a library that helps simplify the solving of a problem that these domains share, running the next block of code after some long running operation, like asking the user a question or performing some task, completes.  To help solve this problem it uses the concept of a [continuation]( https://en.wikipedia.org/wiki/Continuation) to save off the function and arguments that should be run after the operation completes.

As JavaScript/TypeScript developers you’re already using continuations in the form of callbacks or async/await. These continuations call back into your code after you perform some short running operation, like a network request, completes. These continuations are super rich and can leverage things like closure scope to give you access to variables in the processes memory after the operation completes. The problem with using traditional continuations like this for long running operations is that the long running operation could take minutes, hours, days, or even weeks to complete. During that time, your servers process could have crashed, redeployed, or even the code modified meaning there’s no way to reliably continue the execution of a running process after a long operation completes.

## How does it work?

Continue JS solves the problem of identifying the next code to run, by letting you specify the function to continue with after an operation completes. There are 4 functions you need to learn to use Continue JS. Lets look at teh first 3 using a simple example of a bot that prompts a user for their name:

```TypeScript
import { continueWith, dontContinue, canContinueWith } from "@stevenic/continue-js";

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
 
```TypeScript
import { continueWith, continueNow } from "@stevenic/continue-js";

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

## Why is canContinueWith() needed?

The main superpower of Continue JS is its ability to call functions anywhere in your app from a central dispatcher. For that to work it needs to know where all of the functions it might call are in your code and it needs to associate a unique ID with each function so that it knows which function to call, when a continuation is being executed using `continueNow()`.  In other programming languages we can use language features like attributes and reflection to find these functions. For JavaScript we need to maintain a central lookup table of the functions that can be continued and the `canContinueWith()` function is just a simple way of registering all of the possible continuation points in the app.

If we look at the data that gets serialized for a continuation, we can see that it contains the ID of the function to continue and an optional set of additional arguments to pass that function:

```TypeScript
export interface Continuation {
    done: boolean;
    continuationId?: string;
    args?: any[];
}
```

Each continuation function needs a unique ID. To help generate these ID’s, the canContinueWith() function generates a stack trace it walks in reverse to find the name of the file that called it. It then calls a configurable `getContinuationId()` function with the name of the calling file and the function name that was passed in. The default implementation of getContinuationId() combines these values into a unique ID using `${fileName}#${functionName}`. This ID is then used to register the function with a central lookup table and its added to the function itself as additional metadata so that continueWith() can easily validate that it was passed a registered function and knows the ID of the function to generate a continuation for. Knowing this results in a couple of observations: 

1. You should always call canContinueWith() from the same file that the function was defined in. Otherwise, you risk ID clashes.
2. The ID that's generated includes the full path of the functions js file, including drive letter. This is probably on in most deployments but you might want to consider registering a custom getContinuationId() function for added safety.
3. You can do some amount of code refactoring without breaking existing continuations saved to your continuation store. Renaming continuation functions, moving them to a different file, or moving the source file to a different directory are all things that will break your stored continuations. You can either prevent breaks by providing a custom getContinuationId() function that generates a more stable ID or handle breaks by providing a custom `functionNotFound()` implementation.

### Custom getContinuationId()

To give added stability to the ID's that get generated for your continuation functions, you might consider registering a custom `getContinuationId()` function. Here’s an example that trims off the leading `__dirname` from each functions ID. Register this from your apps root source file and the ID’s generated for continuation functions will be relative ID’s, giving you some resilience to changes with to where your app gets deployed to:

```TypeScript
import { configureContinue } from "@stevenic/continue-js";

configureContinue({
  getContinuationId: (fileName, functionName) => `${fileName.substring(__dirname.length)}#${functionName}`
});
```

### Custom functionNotFound()

Refactoring your apps code can result in new ID’s being generated for your apps continuation functions which can result in breaks to the existing continuations stored in your continuation store. To handle breaks like this you can register a custom `functionNotFound()` implementation that redirects to an error continuation:

```TypeScript
import { continueWith, dontContinue, canContinueWith, configureContinue } from "@stevenic/continue-js";

// Define error continuation
async function errorContinuation(context: BotContext): Promise<Continuation> {
  await context.send(`I'm sorry. Something went wrong.`);
  return await dontContinue();
}

// Register it
canContinueWith(errorContinuation);

// Configure redirect
configureContinue({
  functionNotFound: (continuation, context) => continueWith(errorContinuation)
});
```

## Installing

Continue JS requires a recent version of [NodeJS](https://nodejs.org) and your package manager of choice. To add the latest version of Continue JS to your app using NPM, type the following from your apps root directory:

```bash
$ npm install @stevenic/continue-js --save
```

## Building

To build Continue JS and its samples [fork the project](https://github.com/Stevenic/continue-js/fork) and clone it to your desktop using [git](https://git-scm.com/). Then install and build the packages using your package manager of choice.  Using NPM:

```bash
$ cd continue-js
$ npm install
$ npm run build
```


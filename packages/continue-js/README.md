# Continue JS

A tiny library that makes building complex bots and workflows a little easier. 

To learn more about what Continue JS is and how it works see [the project repository](https://github.com/Stevenic/continue-js#what-is-it)

## Installing

Continue JS requires a recent version of [NodeJS](https://nodejs.org) and your package manager of choice. To add the latest version of Continue JS to your app using NPM, type the following from your apps root directory:

```bash
$ npm install continue-js --save
```

## Usage

Here's a simple JavaScript app to get started. This app calls a test continuation 5 times. To learn why that's useful see [the project repository](https://github.com/Stevenic/continue-js#what-is-it):

```javascript
const { canContinueWith, continueWith, continueNow, dontContinue } = require('continue-js');

// Define test continuation
async function testContinuation(context) {
    // Print call number and increment iteration count
    console.log(`This is call ${++context.iterations} of ${context.maxIterations}`);
    
    // Chain back to self until max iterations met. 
    // - Recursion without using recursion :)
    if (context.iterations < context.maxIterations) {
        return await continueWith(testContinuation);
    } else {
        return await dontContinue();
    }
}

// Register continuations with library
canContinueWith(testContinuation);

// Execute test continuation 5 times
(async () => {
    // Define a context object that will be passed to the continuation
    const context = { iterations: 0, maxIterations: 5 };

    // Create initial continuation using continueWith()
    let continuation = await continueWith(testContinuation);

    // Loop over continuations until told we're done
    // - continueNow() executes the current continuation and returns the next one
    while (!continuation.done) {
        continuation = await continueNow(continuation, context);
    }
})();
```

## Building

To build Continue JS and its samples [fork the project](https://github.com/Stevenic/continue-js/fork) and clone it to your desktop using [git](https://git-scm.com/). Then install and build the packages using your package manager of choice.  Using NPM:

```bash
$ cd continue-js
$ npm install
$ npm run build
```


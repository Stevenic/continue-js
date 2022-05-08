const { canContinueWith, continueWith, continueNow, dontContinue } = require('@stevenic/continue-js');

// Define test continuation
async function testContinuation(context) {
    // Print call number and increment iteration count
    console.log(`This is call ${++context.iterations} of ${context.maxIterations}`);
    
    // Chain back to self until max iterations met
    if (context.iterations < context.maxIterations) {
        return await continueWith(testContinuation);
    } else {
        return await dontContinue();
    }
}

// Register continuations with Continue JS
canContinueWith(testContinuation);

// Execute continuation 5 times
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



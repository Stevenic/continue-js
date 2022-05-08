
const _continuations = new Map<string, ContinuationFunction>();
let _config: ContinuationConfiguration = {
    getContinuationId: (fileName, functionName) => { return `${fileName}#${functionName}` },
    functionNotFound: (continuation) => { throw new Error(`continueNow() can't find a continuation function for continuationId '${continuation.continuationId}'.`) }
}

/**
 * Serialized continuation. 
 */
export interface Continuation {
    /**
     * If true the continuation chain is finished and both `continueId` and `args` should be empty.
     */
    done: boolean;

    /**
     * ID of the continuation function to call.
     */
    continuationId?: string;

    /**
     * Optional arguments passed to the continuation function when its called.
     */
    args?: any[];
}

/**
 * Configuration information used to customize the processing of continuations. 
 */
export interface ContinuationConfiguration {
    /**
     * Function used to generate unique ID's for continuation functions.
     * @param fileName Name and path of the file containing the function being registered.
     * @param functionName Name of the function being registered.
     */
    getContinuationId: (fileName: string, functionName: string) => string;

    /**
     * Function called when `continueNow()` can't find the function being continued.
     * @param continuation The continuation for the function that wasn't found.
     * @param context The context passed by the app to `continueNow()`.
     * @returns A continuation to redirect to. If `done = true` the continuation will be returned otherwise `continueNow()` will be called recursively with the returned continuation.
     */
    functionNotFound: (continuation: Continuation, context: any) => Promise<Continuation>;
}

/**
 * Extended metadata for a function that's been registered as a continuation function.
 */
export interface ContinuationFunction extends Function {
    /**
     * Unique ID of the continuation function.
     */
    continuationId?: string;
} 

/**
 * Registers a function as being a continuation point.
 * @param fn Function to register continuation support for.
 */
export function canContinueWith(fn: (context: any, ...args: any[]) => Promise<Continuation>): (context: any, ...args: any[]) => Promise<Continuation> {
    var originalFunc = Error.prepareStackTrace;
    try {
        const cfn = fn as ContinuationFunction;

        // Generate a call stack
        Error.prepareStackTrace = (err, stack) => stack;
        const err = new Error();
        const stack: NodeJS.CallSite[] = err.stack as any;

        // Identify current file
        const currentfile = stack.shift()?.getFileName() ?? '';

        // Search for calling file
        let callerfile: string = '';
        while (stack.length) {
            callerfile = stack.shift()?.getFileName() ?? '';

            if(currentfile !== callerfile) break;
        }

        // Generate unique ID for continuation
        if (!cfn.continuationId) {
            cfn.continuationId =  _config.getContinuationId(callerfile, cfn.name);
        } else {
            throw new Error(`canContinue() has already been called for '${cfn.name}' in file '${callerfile}'.`)
        }

        // Register continuation
        if (!_continuations.has(cfn.continuationId)) {
            _continuations.set(cfn.continuationId, cfn);
        } else {
            throw new Error(`canContinue() can't register continuationId '${cfn.continuationId}' because it a;ready exists.`)
        }
    } finally {
        Error.prepareStackTrace = originalFunc; 
    }

    return fn;
}

/**
 * Generates a continuation for a given continuation function.
 * @param fn Function to generation a continuation for. The function must have previously been passed to `canContinueWith()`.
 * @param args Optional arguments that should be passed to the function.
 * @returns Serialized continuation information for the function.
 */
export function continueWith(fn: (context: any, ...args: any[]) => Promise<Continuation>, ...args: any[]): Promise<Continuation> {
    // Ensure function can be continued
    const cfn = fn as ContinuationFunction;
    if (!cfn.continuationId) {
        throw new Error(`continueWith() called with a function that can't be continued. Call 'canContinue(${fn.name})'.`);
    }

    // Return continuation
    return Promise.resolve({
        done: false,
        continuationId: cfn.continuationId,
        args: args
    });   
}

/**
 * Executes a continuation.
 * @param continuation Serialized continuation information for the function to call or a Promise to a continuation object.
 * @param context Additional context information which 
 * @returns Serialized continuation information for the next function to continue.
 */
export async function continueNow(continuation: Continuation|Promise<Continuation>, context: any): Promise<Continuation> {
    // Resolve continuation
    const resolved = await continuation;
    if (!resolved.done && resolved.continuationId) {
        // Find continuation function
        const cfn = _continuations.get(resolved.continuationId);
        if (cfn) {
            return await cfn.apply(null, [context, ...resolved.args ?? []])
        } else {
            // Redirect to a configured error handler
            const redirect = await _config.functionNotFound(resolved, context);
            if (!redirect.done) {
                return await continueNow(redirect, context);
            } else {
                return redirect;
            }
        }
    } else {
        return await dontContinue();
    }
}

/**
 * Ends a chain of continuation functions.
 * @returns Serialized continuation object with `done = true`.
 */
export function dontContinue(): Promise<Continuation> {
    return Promise.resolve({ done: true });
}

/**
 * Customizes the processing of continuations.
 * @param config Options to configure.
 */
export function configureContinue(config: Partial<ContinuationConfiguration>): void {
    _config = {..._config, ...config};
}

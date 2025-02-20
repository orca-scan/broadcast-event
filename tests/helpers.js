var path = require('path');
var fs = require('fs').promises;

/**
 * Sets up request interception for a Puppeteer page to mock out responses with local file contents.
 * This allows for the simulation of loading resources from different domains or paths.
 * @param {Object} page - The Puppeteer page object for which the request interception is to be set up.
 * @param {Array} mappings - An array of objects, each containing a baseURL and files array.
 *                           Each object maps URL paths under the baseURL to local file paths.
 *                           Example mapping object: { baseURL: 'http://example.com', files: [{ urlPath: '/', filePath: 'index.html' }] }
 * @param {boolean} debug - if true, console logs intercepts
 * @returns {Promise<void>} resolves once complete
 */
async function mockPuppeteerRequest(page, mappings, debug) {
    await page.setRequestInterception(true);

    var counter = 1;

    page.on('request', async (interceptedRequest) => {

        const url = interceptedRequest.url();

        if (debug) {
            console.log('--------------------------');
            console.log('Request intercepted (' + counter + '):', url);
        }

        const mapping = mappings.find(item => url.startsWith(item.baseURL));

        if (mapping) {

            if (debug) console.log('Request mapping found:', mapping.baseURL);

            const relativePath = url.substring(mapping.baseURL.length).split('?').shift(); // remove query params
            const fileMapping = mapping.files.find(f => f.urlPath === relativePath);

            if (fileMapping) {

                try {
                    var fileContent = fileMapping.fileContent;
                    var contentType = fileMapping.contentType;

                    if (!fileContent && fileMapping.filePath) {
                        fileContent = await fs.readFile(fileMapping.filePath, 'utf8');
                        contentType = getContentType(fileMapping.filePath);
                    }

                    await interceptedRequest.respond({
                        status: 200,
                        contentType: contentType,
                        body: fileContent
                    });

                    if (debug) console.log('Request served from:', fileMapping.filePath);
                }
                catch (error) {
                    if (debug) console.error('Error reading file:' + fileMapping.filePath + ':', error);
                }
            }
            else if (debug) {
                console.log('File mapping NOT found:', relativePath);
            }
        }
        else if (debug) {
            console.log('Request ignored.');
        }

        counter++;
    });
}

/**
 * Gets the content type based on the file extension.
 *
 * @param {string} filePath - The path to the file.
 * @returns {string} The content type for the file.
 */
function getContentType(filePath) {
    var ext = path.extname(filePath).toLowerCase();
    switch (ext) {
        case '.html':
            return 'text/html';
        case '.js':
            return 'application/javascript';
        case '.css':
            return 'text/css';
        case '.json':
            return 'application/json';
        case '.png':
            return 'image/png';
        case '.jpg':
        case '.jpeg':
            return 'image/jpeg';
        case '.gif':
            return 'image/gif';
        default:
            return 'text/html'; // Default to text/html if the extension is not recognized
    }
}

/**
 * returns a promise that is fulfilled after interval has passed
 * @param {integer} timeoutInMs - timeout in milliseconds
 * @return {Promise} resolved when timeout is reached
 */
function sleep(timeoutInMs) {
    return new Promise(function (resolve) {
        setTimeout(resolve, timeoutInMs);
    });
}

/**
 * Execute a specified function within the puppeteer page
 * Arguments passed after funcName are forwarded to the function
 * @example
 * execFunction(page, 'simplitics.sendEvent', 'eventName', eventData).then(function(result) {
 *     console.log(result);
 * })
 * .catch(function(error) {
 *      console.error(error);
 * });
 * @param {object} puppeteerPage - puppeteer page
 * @param {string} funcName - the function name to call, can include dot notation for nested objects
 * @returns {Promise} - result of the function execution
 */
function execFunction(puppeteerPage, funcName) {

    var args = Array.prototype.slice.call(arguments, 2);

    return puppeteerPage.evaluate(function (innerFuncName, innerArgs) {

        var parts = innerFuncName.split('.');
        var context = window;

        // iterate over the parts to access the nested function
        for (var i = 0; i < parts.length; i++) {
            if (context === undefined || context === null || !(parts[i] in context)) {
                return Promise.reject(new Error('Function not found: ' + parts.slice(0, i + 1).join('.')));
            }
            context = context[parts[i]];
        }

        // Check if the target is a function and execute it with the provided parameters
        if (typeof context === 'function') {
            try {
                return Promise.resolve(context(...innerArgs));
            }
            catch (error) {
                return Promise.reject(new Error('Error executing function: ' + innerFuncName + ' - ' + error.message));
            }
        }
        else {
            return Promise.reject(new Error('Target is not a function: ' + innerFuncName));
        }

    }, funcName, args)
    .catch(function (error) {
        // Catch and re-throw any errors from the evaluation
        throw new Error('Error in execFunction: ' + error.message);
    });
}

/**
 * Wait for the browser to fire an event (including custom events)
 * @param {object} puppeteerPage - puppeteer page
 * @param {string} eventName - Event name
 * @param {integer} [seconds] - number of seconds to wait (default=30)
 * @returns {Promise<object>} resolves when event fires or timeout is reached
 */
async function waitForEvent(puppeteerPage, eventName, seconds) {

    seconds = seconds || 30;

    // use race to implement a timeout
    return Promise.race([

        // add event listener and wait for event to fire before returning
        puppeteerPage.evaluate(function(eventName) {
            return new Promise(function(resolve, reject) {
                window.addEventListener(eventName, function(e) {

                    // resolves when the event fires
                    resolve({
                        type: e.type,
                        detail: e.detail,
                        timeStamp: e.timeStamp
                    });
                });
            });
        }, eventName),

        // if the event does not fire within n seconds, exit
        new Promise(function(resolve) {
            setTimeout(resolve, seconds * 1000);
        })
    ]);
}

/**
 * Spies on a function inside a Puppeteer page, mimicking Jasmine spy.
 * @param {object} page - Puppeteer page object.
 * @param {string} functionName - Name of the function to spy on (e.g., 'postMessage').
 * @returns {Promise<object>} - Resolves with a spy object containing spy methods.
 *
 * @example
 * var spy = await spyOnFunction(page, 'postMessage');
 * await page.evaluate(function () { window.postMessage({ foo: 'bar' }, '*'); });
 * var calls = await spy.calls();
 * console.log(calls); // [ [{ foo: 'bar' }, '*' ] ]
 * var count = await spy.count();
 * await spy.clear();
 */
async function spyOnFunction(page, functionName) {

    await page.evaluate(function (fnName) {
        if (!window[fnName] || typeof window[fnName] !== 'function') {
            throw new Error('Function "' + fnName + '" does not exist on window.');
        }

        window.__spiedCalls = window.__spiedCalls || {};
        window.__spiedCalls[fnName] = [];
        window.__originalFn = window.__originalFn || {};
        window.__originalFn[fnName] = window[fnName];

        window[fnName] = function () {
            var args = Array.prototype.slice.call(arguments);
            window.__spiedCalls[fnName].push(args);
            return window.__originalFn[fnName].apply(this, args);
        };
    }, functionName);

    return {

        /** Retrieves all recorded calls. */
        calls: function () {
            return page.evaluate(function (fn) {
                return window.__spiedCalls[fn] || [];
            }, functionName);
        },

        /** Retrieves the number of times the function was called. */
        count: function () {
            return page.evaluate(function (fn) {
                return window.__spiedCalls[fn] ? window.__spiedCalls[fn].length : 0;
            }, functionName);
        },

        /** Clears all stored calls. */
        clear: function () {
            return page.evaluate(function (fn) {
                window.__spiedCalls[fn] = [];
            }, functionName);
        }
    };
}

module.exports = {
    mockPuppeteerRequest: mockPuppeteerRequest,
    execFunction: execFunction,
    waitForEvent: waitForEvent,
    spyOnFunction: spyOnFunction,
    sleep: sleep
};
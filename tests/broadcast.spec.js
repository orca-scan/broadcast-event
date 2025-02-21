const puppeteer = require('puppeteer');
const path = require('path');
const helpers = require('./helpers.js');

describe('broadcast-event', function() {

    let browser, page, iframe, nestedIframe;
    let logs = [];

    beforeEach(async () => {

        // Launch a new browser instance
        browser = await puppeteer.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-web-security', // Disables the same-origin policy (and CORS)
                '--disable-features=IsolateOrigins,site-per-process'
            ]
        });

        // get page
        page = (await browser.pages())[0];

        // redirect puppeteer console.log to node
        page.on('console', function (msg) {
            logs.push(msg.text());
            // console.log(`${msg.text()}`);
        });

        // serve content from disk
        await helpers.mockPuppeteerRequest(page, [
            {
                baseURL: 'http://localhost',
                files: [
                    { urlPath: '/parent-with-iframe.html', filePath: path.resolve('./tests/html/parent-with-iframe.html') },
                    { urlPath: '/parent-without-iframe.html', filePath: path.resolve('./tests/html/parent-without-iframe.html') },
                    { urlPath: '/iframe.html', filePath: path.resolve('./tests/html/iframe.html') },
                    { urlPath: '/nested-iframe.html', filePath: path.resolve('./tests/html/nested-iframe.html') },
                    { urlPath: '/src/broadcast-event.js', filePath: path.resolve('./src/broadcast-event.js') }
                ]
            }
        ], false);

        // add jasmine helper
        jasmine.addMatchers({
            toStartWith: function () {
                return {
                    compare: function (actual, expected) {
                        var result = {};
                        result.pass = typeof actual === 'string' && actual.indexOf(expected) === 0;
                        result.message = result.pass
                            ? 'Expected "' + actual + '" not to start with "' + expected + '"'
                            : 'Expected "' + actual + '" to start with "' + expected + '"';
                        return result;
                    }
                };
            }
        });
        
    });

    afterEach(async () => {
        await browser.close();
        logs = [];
    });

    it('should expose broadcastEvent method', async function() {

        // load parent page
        await page.goto('http://localhost/parent-without-iframe.html', { waitUntil: 'load' });

        const type = await page.evaluate(() => typeof window.broadcastEvent);
        expect(type).toBe('function');
    });

    it('should not postMessage if no iframes exist', async function() {

        // load parent page
        await page.goto('http://localhost/parent-without-iframe.html', { waitUntil: 'load' });

        // spy on post message
        var postMessageSpy = await helpers.spyOnFunction(page, 'postMessage');

        // broadcast
        await helpers.execFunction(page, 'broadcastEvent', 'app:ready');

        // confirm we did not postMessage
        var postMessageCalls = await postMessageSpy.count();
        expect(postMessageCalls).toEqual(0);
    });

    it('should postMessage to all iframes', async function() {

        // load parent page
        await page.goto('http://localhost/parent-with-iframe.html', { waitUntil: 'load' });

        // wait for iframes to load
        await page.waitForSelector('#iframe');
        iframe = await (await page.$('#iframe')).contentFrame();
        await iframe.waitForSelector('#nested-iframe');

        // fire event in topmost page (it should emit to all)
        await helpers.execFunction(page, 'broadcastEvent', 'app:ready', undefined, { debug: true });

        // wait for logs to fill up
        await helpers.sleep(250);

        // confirm we have the correct flow
        expect(logs).toEqual([
            'broadcast-event[http://localhost/parent-with-iframe.html] sending "app:ready" down',
            'broadcast-event[http://localhost/iframe.html] received "app:ready"',
            'broadcast-event[http://localhost/iframe.html] sending "app:ready" up',
            'broadcast-event[http://localhost/iframe.html] sending "app:ready" down',
            'broadcast-event[http://localhost/parent-with-iframe.html] received "app:ready"',
            'broadcast-event[http://localhost/parent-with-iframe.html] suppressed "app:ready"',
            'broadcast-event[http://localhost/nested-iframe.html] received "app:ready"',
            'broadcast-event[http://localhost/nested-iframe.html] sending "app:ready" up',
            'broadcast-event[http://localhost/iframe.html] received "app:ready"',
            'broadcast-event[http://localhost/iframe.html] suppressed "app:ready"'
        ]);     
    });

    it('should send eventData to all iframes', async function() {

        var eventName = 'test:event:' + Date.now();
        var eventData = {
            dadJoke: 'Why do programmers prefer dark mode? Because light attracts bugs'
        };

        // load parent page
        await page.goto('http://localhost/parent-with-iframe.html', { waitUntil: 'load' });

        // wait for iframe to load
        await page.waitForSelector('#iframe');
        iframe = await (await page.$('#iframe')).contentFrame();

        // wait for nested iframe inside the first iframe
        await iframe.waitForSelector('#nested-iframe');
        nestedIframe = await (await iframe.$('#nested-iframe')).contentFrame();

        var catchEvents = Promise.all([
            helpers.waitForEvent(page, eventName),
            helpers.waitForEvent(iframe, eventName),
            helpers.waitForEvent(nestedIframe, eventName)
        ]);

        // fire event in topmost page (it should emit to all)
        await helpers.execFunction(page, 'broadcastEvent', eventName, eventData, { debug: true });

        var results = await catchEvents;

        // top page
        expect(results[0].type).toEqual(eventName);
        expect(results[0].detail.dadJoke).toEqual(eventData.dadJoke);
        expect(results[0].detail._originId).toBeDefined();

        // iframe
        expect(results[1].type).toEqual(eventName);
        expect(results[1].detail.dadJoke).toEqual(eventData.dadJoke);
        expect(results[1].detail._originId).toBeDefined();

        // nested iframe
        expect(results[2].type).toEqual(eventName);
        expect(results[2].detail.dadJoke).toEqual(eventData.dadJoke);
        expect(results[2].detail._originId).toBeDefined();

        // ensure originId maintained across frames
        expect(results[1].detail._originId).toEqual(results[0].detail._originId);
        expect(results[2].detail._originId).toEqual(results[0].detail._originId);
    });

    it('should generate originId for each page', async function() {

        // load parent page
        await page.goto('http://localhost/parent-with-iframe.html', { waitUntil: 'load' });

        // wait for iframes to load
        await page.waitForSelector('#iframe');
        iframe = await (await page.$('#iframe')).contentFrame();
        await iframe.waitForSelector('#nested-iframe');
        nestedIframe = await (await iframe.$('#nested-iframe')).contentFrame();

        // setup listeners to collect _originIds
        var catchInitEvents = Promise.all([
            helpers.waitForEvent(page, 'my:event:1'),
            helpers.waitForEvent(iframe, 'my:event:2'),
            helpers.waitForEvent(nestedIframe, 'my:event:3')
        ]);

        // broadcast an event from each frame so can we get the _originId of each
        await Promise.all([
            helpers.execFunction(page, 'broadcastEvent', 'my:event:1'),
            helpers.execFunction(iframe, 'broadcastEvent', 'my:event:2'),
            helpers.execFunction(nestedIframe, 'broadcastEvent', 'my:event:3')
        ]);

        // once all handlers have recieved the event
        var results = await catchInitEvents;

        // check we have an _originId for each 
        var parentOriginId = results[0].detail._originId;
        var iframeOriginId = results[1].detail._originId;
        var nestedIframeOriginId = results[2].detail._originId;

        expect(parentOriginId).toBeDefined();
        expect(iframeOriginId).toBeDefined();
        expect(nestedIframeOriginId).toBeDefined();

        // check _originId for each window is unique
        expect(parentOriginId).not.toEqual(iframeOriginId);
        expect(parentOriginId).not.toEqual(nestedIframeOriginId);
        expect(iframeOriginId).not.toEqual(parentOriginId);
        expect(iframeOriginId).not.toEqual(nestedIframeOriginId);
        expect(nestedIframeOriginId).not.toEqual(parentOriginId);
        expect(nestedIframeOriginId).not.toEqual(iframeOriginId);
    });

    it('should allow targeting only 1 frame', async function() {

        // 1. broadcast an event from each frame to collect origin ids
        // 2. broadcast an event to a specific frame
        // 3. confirm only the target frame recieved it (all others did not recieve an event)

        // load parent page
        await page.goto('http://localhost/parent-with-iframe.html', { waitUntil: 'load' });

        // wait for iframes to load
        await page.waitForSelector('#iframe');
        iframe = await (await page.$('#iframe')).contentFrame();
        await iframe.waitForSelector('#nested-iframe');
        nestedIframe = await (await iframe.$('#nested-iframe')).contentFrame();

        // setup listeners for initial events (need to do this to collect _originIds)
        var catchInitEvents = Promise.all([
            helpers.waitForEvent(page, 'my:event:1'),
            helpers.waitForEvent(iframe, 'my:event:2'),
            helpers.waitForEvent(nestedIframe, 'my:event:3')
        ]);

        // broadcast and event in each frame so can we get the _originId of each
        await Promise.all([
            helpers.execFunction(page, 'broadcastEvent', 'my:event:1'),
            helpers.execFunction(iframe, 'broadcastEvent', 'my:event:2'),
            helpers.execFunction(nestedIframe, 'broadcastEvent', 'my:event:3')
        ]);

        // once all handlers have recieved the event
        var results = await catchInitEvents;

        // check we have an _originId for each 
        var parentOriginId = results[0].detail._originId;
        var iframeOriginId = results[1].detail._originId;
        var nestedIframeOriginId = results[2].detail._originId;

        // listen for targeted event in al frames
        var targetedEventName = 'my:targeted:event';
        var targetedEventListeners = Promise.all([
            helpers.waitForEvent(page, targetedEventName, 1),
            helpers.waitForEvent(iframe, targetedEventName, 1),
            helpers.waitForEvent(nestedIframe, targetedEventName, 1)
        ]);

        // broadcast targeted event from top/parent to nested iframe
        var options = { target: nestedIframeOriginId };
        await helpers.execFunction(page, 'broadcastEvent', targetedEventName, undefined, options);

        // wait for event handlers to comlpete
        var targetedEventResults = await targetedEventListeners;

        // top/parent and iframe should not get an event
        expect(targetedEventResults[0]).toBeUndefined();
        expect(targetedEventResults[1]).toBeUndefined();

        // nested iframe should have the event
        expect(targetedEventResults[2]).toBeDefined();
        expect(targetedEventResults[2].detail._originId).toEqual(parentOriginId);
        expect(targetedEventResults[2].detail._targetId).toEqual(nestedIframeOriginId);
    });

    it('should not fire event if target not found', async function() {

        // load parent page
        await page.goto('http://localhost/parent-with-iframe.html', { waitUntil: 'load' });

        // wait for iframes to load
        await page.waitForSelector('#iframe');
        iframe = await (await page.$('#iframe')).contentFrame();
        await iframe.waitForSelector('#nested-iframe');
        nestedIframe = await (await iframe.$('#nested-iframe')).contentFrame();

        // listen for targeted event in all frames
        var targetedEventName = 'my:targeted:event';
        var targetedEventListeners = Promise.all([
            helpers.waitForEvent(page, targetedEventName, 1),
            helpers.waitForEvent(iframe, targetedEventName, 1),
            helpers.waitForEvent(nestedIframe, targetedEventName, 1)
        ]);

        // broadcast targeted event from top/parent
        var options = { target: 'invalidTargetId' };
        await helpers.execFunction(page, 'broadcastEvent', targetedEventName, undefined, options);

        // wait for event handlers to comlpete
        var targetedEventResults = await targetedEventListeners;

        // confirm no events were fired as target did not match
        expect(targetedEventResults[0]).toBeUndefined();
        expect(targetedEventResults[1]).toBeUndefined();
        expect(targetedEventResults[2]).toBeUndefined();
    });

    it('should encrypt eventData in transit', async function() {

        var eventName = 'test:encrypt:' + Date.now();
        var eventData = {
            firstName: 'William',
            lastName: 'Gates'
        };

        // load parent page
        await page.goto('http://localhost/parent-with-iframe.html', { waitUntil: 'load' });

        // wait for iframes to load
        await page.waitForSelector('#iframe');
        iframe = await (await page.$('#iframe')).contentFrame();
        await iframe.waitForSelector('#nested-iframe');
        nestedIframe = await (await iframe.$('#nested-iframe')).contentFrame();

        // intercept postMessage on topmost page so we can inspect the payload
        var postMessageSpy = await helpers.spyOnFunction(page, 'postMessage');

        // listen for broadcasts
        var eventListener = helpers.waitForEvent(iframe, eventName);

        // broadcast an event from iframe
        await helpers.execFunction(iframe, 'broadcastEvent', eventName, eventData, { encrypt: true });

        // once handler recieved the event
        var e = await eventListener;

        // get postMessage calls
        var postMessageCalls = await postMessageSpy.calls();
        var numberOfPostMessageCalls = await postMessageSpy.count();

        // confirm eventData was encrypted
        expect(numberOfPostMessageCalls).toEqual(1);

        var firstPostMessageCall = postMessageCalls[0];
        var firstPostMessageParam = firstPostMessageCall[0];
        var postMessagePayload = firstPostMessageParam._broadcast;

        expect(postMessagePayload.detail).toBeDefined();
        expect(typeof postMessagePayload.detail).toEqual('string');
        expect(postMessagePayload.detail).toStartWith('BE:');

        // confirm eventData was decrypted
        expect(e.type).toEqual(eventName);
        expect(e.detail._originId).toBeDefined();
        expect(e.detail.firstName).toEqual(eventData.firstName);
        expect(e.detail.lastName).toEqual(eventData.lastName);
    });
});
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

        // intercept postMessage calls so we can test 
        await page.evaluate(function(){
            window.postMessageCalls = []; // Store messages

            const originalPostMessage = window.postMessage;
            window.postMessage = function (message, targetOrigin) {
                window.postMessageCalls.push({ message, targetOrigin });
                return originalPostMessage.apply(this, arguments);
            };
        });

        await helpers.execFunction(page, 'broadcastEvent', 'app:ready');

        const postMessageCalls = await page.evaluate(function(){
            return window.postMessageCalls;
        });
    
        expect(postMessageCalls.length).toEqual(0);
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
        expect(results[0].detail).toEqual(eventData);

        // iframe
        expect(results[1].type).toEqual(eventName);
        expect(results[1].detail).toEqual(eventData);

        // nested iframe
        expect(results[2].type).toEqual(eventName);
        expect(results[2].detail).toEqual(eventData);
    });
});
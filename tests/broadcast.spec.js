const puppeteer = require('puppeteer');
const path = require('path');
const helpers = require('./helpers.js');

describe('broadcast-event', function() {

    let browser, page, iframe, nestedIframe;
    let consoleLogs = [];

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
            consoleLogs.push(msg);
            console.log(`puppeteer log: ${msg.text()}`);
        });

        page.on('pageerror', err => {
            console.log('🚨 JS Error on page:', err.message);
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

        await helpers.execFunction(page, 'broadcastEvent', 'app:ready');

        const postMessageCalls = await page.evaluate(function(){
            return window.postMessageCalls;
        });
    
        expect(postMessageCalls.length).toEqual(0);
    });

    fit('should postMessage if iframes exist', async function() {

        // load parent page
        await page.goto('http://localhost/parent-with-iframe.html', { waitUntil: 'load' });

        // wait for iframe to load
        await page.waitForSelector('#iframe');
        iframe = await (await page.$('#iframe')).contentFrame();

        // wait for nested iframe inside the first iframe
        await iframe.waitForSelector('#nested-iframe');
        nestedIframe = await (await iframe.$('#nested-iframe')).contentFrame();

        // // fire event in topmost page
        await helpers.execFunction(page, 'broadcastEvent', 'app:ready');

        expect(consoleLogs.length).toBeGreaterThan(1);

        // const postMessageCalls1 = await page.evaluate(function(){
        //     return window.postMessageCalls;
        // });

        // const postMessageCalls2 = await iframe.evaluate(function(){
        //     return window.postMessageCalls;
        // });

        // const postMessageCalls3 = await nestedIframe.evaluate(function(){
        //     return window.postMessageCalls;
        // });

        // expect(postMessageCalls1.length).toEqual(0);
        // expect(postMessageCalls2.length).toEqual(1);
        // expect(postMessageCalls3.length).toEqual(0);
    });
});
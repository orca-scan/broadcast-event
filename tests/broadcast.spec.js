const puppeteer = require('puppeteer');
const path = require('path');
const nock = require('nock');
const helpers = require('./helpers.js');

describe('broadcast-event', function() {
    let browser, page, iframe, nestedIframe;

    beforeAll(async () => {

        // Launch a new browser instance
        browser = await puppeteer.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-web-security' // Disables the same-origin policy (and CORS)
            ]
        });

        // get page
        page = (await browser.pages())[0];

        // redirect puppeteer console.log to node
        page.on('console', function (msg) {
            console.log(`puppeteer log: ${msg.text()}`);
        });

        // serve content from disk
        await helpers.mockPuppeteerRequest(page, [
            {
                baseURL: 'http://localhost',
                files: [
                    { urlPath: '/1.parent.html', filePath: path.resolve('./tests/1.parent.html') },
                    { urlPath: '/2.iframe.html', filePath: path.resolve('./tests/2.iframe.html') },
                    { urlPath: '/3.nested-iframe.html', filePath: path.resolve('./tests/3.nested-iframe.html') },
                    { urlPath: '/src/broadcast-event.js', filePath: path.resolve('./src/broadcast-event.js') }
                ]
            }
        ], false);

        // load parent page
        await page.goto('http://localhost/1.parent.html', { waitUntil: 'load' });

        // wait for iframe to load
        await page.waitForSelector('#test-iframe');
        iframe = await (await page.$('#test-iframe')).contentFrame();

        // wait for nested iframe inside the first iframe
        await iframe.waitForSelector('#nested-iframe');
        nestedIframe = await (await iframe.$('#nested-iframe')).contentFrame();
    });

    afterAll(async () => {
        await browser.close();
        nock.cleanAll();
    });

    it('should expose broadcastEvent method', async function() {
        const type = await page.evaluate(() => typeof window.broadcastEvent);
        expect(type).toBe('function');
    });
});
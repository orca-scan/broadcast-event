# broadcast-event

A simple way to broadcast JavaScript events across iframes.

## Why?

[Orca Scan](https://orcascan.com) uses [CustomEvent](https://developer.mozilla.org/en-US/docs/Web/API/CustomEvent/CustomEvent) to fire app lifecycle events such as `app:ready` in our apps. Trouble is `dispatchEvent` only works in the current page, if you have an iframe, the JS in that frame never sees the event. `broadcastEvent(eventName, eventData)` solves that problem.

## How?

1. Add [broadcast-event.min.js](dist/broadcast-event.min.js) to parent and iframe page
2. Fire an event using `broadcastEvent('my:event', { name: 'my JSON data' });`
3. Listen everywhere `window.addEventListener('my:event', function(e) { /* go wild */ })`

![How broadcastEvent works](docs/how-broadcast-event-works.png)

### Debugging

Pass `{ debug: true }` as the thrid parameter to see a console log of the event broadcast flow. 

```js
/**
 * Fire events across iframes
 * @param {string} eventName - event to dispatch
 * @param {object} [eventData] - data to send with the event
 * @param {object} [options] - { debug: true }
 * @returns {void}
 */
broadcastEvent(eventName, eventData, options);
```

### Tests

We have a few unit tests to confirm stability, more will be added over time. To run the tests use:

```bash
cd broadcast-event
npm i
npm test
```

## Contribute

We Open Source code we think might help others, if you'd like to assist:

1. Fork it!
2. Create your feature branch: `git checkout -b my-new-feature`
3. Commit your changes: `git commit -m 'Add some feature'`
4. Push to the branch: `git push origin my-new-feature`
5. Submit a pull request 🙏

## Star the repo

Find this useful? Star the repo - it help us priorities open source tasks 🌟

## License

[MIT License](LICENSE) © Orca Scan - a [barcode app](https://orcascan.com) with simple [barcode tracking APIs](https://orcascan.com/guides?tag=for-developers).

# broadcast-event

A simple way to fire JavaScript events across iframes.

## Why?

[Orca Scan](https://orcascan.com) uses [CustomEvent](https://developer.mozilla.org/en-US/docs/Web/API/CustomEvent/CustomEvent) to fire app lifecycle events such as `app-ready` in our apps. Trouble is, this only works in the current page - if you have an iframe, the JS in that iframe never sees the event.

## How?

1. Add [broadcast-event.min.js](dist/broadcast-event.min.js) to parent and iframe page
2. Fire an event using `broadcastEvent('my:event', { name: 'my JSON data' });`
3. Listen everywhere `window.addEventListener('my:event', function(e) { /* go wild */ })`

## Contribute

We Open Source code we think might help others, if you'd like to assist:

1. Fork it!
2. Create your feature branch: `git checkout -b my-new-feature`
3. Commit your changes: `git commit -m 'Add some feature'`
4. Push to the branch: `git push origin my-new-feature`
5. Submit a pull request

## Star the repo

Find this useful? Star the repo to help us priorities open source tasks 🌟

## License

[MIT License](LICENSE) © Orca Scan - a [barcode app](https://orcascan.com) with simple [APIs](https://orcascan.com/guides?tag=for-developers) for barcode tracking.

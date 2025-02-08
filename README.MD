# broadcast-event

A simple way to fire JavaScript events across iframes.

## How?

1. Add [broadcast-event.min.js](dist/broadcast-event.min.js) to parent and iframe page
2. Fire an event using `broadcastEvent('my:event', { name: 'my JSON data' });`
3. Listen in any frame `window.addEventListener('my:event', function(e) { /* go wild */ })`

## Why?

[Orca Scan](https://orcascan.com) uses [CustomEvent](https://developer.mozilla.org/en-US/docs/Web/API/CustomEvent/CustomEvent) to fire app lifecycle events such as `app-ready` in our apps. Trouble is, this only works in the current page - if you have an iframe, the JS in that iframe never sees the event.

## Contributing

1. Fork it!
2. Create your feature branch: `git checkout -b my-new-feature`
3. Commit your changes: `git commit -m 'Add some feature'`
4. Push to the branch: `git push origin my-new-feature`
5. Submit a pull request

## Star the repo

If you find this useful please star the repo, it helps us priorities open source fixes.

## License

👨‍💻 Built by [Orca Scan](https://orcascan.com) - a barcode system compatible with any device.

🕵️ Need more? Our [developer APIs](https://orcascan.com/guides?tag=for-developers) make it easy to integrate barcode tracking.

🛠️ Open-source [MIT License](LICENSE) - © [Orca Scan](https://orcascan.com) _(free to use/modify/distribute with attribution)_.

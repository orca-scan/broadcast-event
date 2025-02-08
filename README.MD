# broadcast-event

A simple way to fire JavaScript events across iframes.

## How?

1. Add [broadcast-event.min.js](dist/broadcast-event.min.js) to parent and iframe page
2. Fire an event using `broadcastEvent('my:event', { name: 'my JSON data' });`
3. Listen in any frame `window.addEventListener('my:event', function(e) { /* go wild */ })`

## Why?

[Orca Scan](https://orcascan.com) uses [CustomEvent](https://developer.mozilla.org/en-US/docs/Web/API/CustomEvent/CustomEvent) to fire app lifecycle events such as `app-ready` in our apps. Trouble is, this only works in the current page - if you have an iframe, the JS in that iframe never sees the event.

## 🚀 For Developers

🤓 **Built by [Orca Scan](https://orcascan.com)** – a barcode system that works with any device.

🕵️ **Looking for more?** Explore our [developer APIs](https://orcascan.com/guides?tag=for-developers) to seamlessly integrate barcode tracking.

🛠️ Open-source under the [MIT License](LICENSE) – © [Orca Scan](https://orcascan.com). Free to use, modify, and distribute with attribution.


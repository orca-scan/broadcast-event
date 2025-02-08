# broadcast-event

A simple way to fire JavaScript events across iframes.

## How?

1. Add [broadcast-event.min.js](dist/broadcast-event.min.js) to parent and iframe page
2. Fire an event using `broadcastEvent('my:custom:event', { name: 'my JSON data' });`
3. Listen in any frame using `window.addEventListener('my:custom:event', function(e) {})`

## Why?

Orca uses `CustomEvent` to fire app lifecycle events such as `app-ready`, `app-user-authed` in our apps. Trouble is, this only works in the current page - if you have an iframe, the JS in that iframe never sees the event.


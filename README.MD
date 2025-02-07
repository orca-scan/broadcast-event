# broadcast-events.js

Simple, automatic firing of JavaScript events across iframes.

## Why?

Orca uses `CustomEvent` to fire app lifecycle events such as `app-ready`, `app-user-authed` in our apps. Trouble is, this only works in the current page - if you have an iframe, the JS in that iframe never sees the event.

## How?

This script intercepts all calls to `dispatchEvent` and, if the event meets the following criteria, fires the same event in all iframes:
* Must have namespaced event name e.g. `user:authed`
* Must be fired on the `window` object _(everything else ignored)_
* Must be a `CustomEvent` _(dom events are ignored)_

For this to work [broadcast-events.min.js](dist/broadcast-events.min.js) must be added to each page _(parent and iframes)_:

```html
<script src="broadcast-events.min.js"></script>
```

### How to fire a cross frame event

```js
// auto broadcast to all frames
window.dispatchEvent(new CustomEvent('user:authed', { user: 'john@orcascan.com' }));
```

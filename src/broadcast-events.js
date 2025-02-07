/* eslint-disable prefer-spread */
/*!
/* broadcast-events.js - v@version@
 * Automatically broadcasts CustomEvent to all iframes
 */
(function () {

    // Dependency check!
    if (typeof window.CustomEvent !== 'function') throw new Error('missing CustomEvent polyfill');
    if (typeof window.EventTarget !== 'function') throw new Error('missing EventTarget polyfill');

    var originalDispatchEvent = EventTarget.prototype.dispatchEvent;
    var host = window.location.host;
    var debug = true; // uncomment to console log sequence
    var originId = window.location.href + '_' + stringHash(window.location.href + ':' + performance.now() + ':' + Math.random());
    var eventIdCache = [];

    /**
     * to avoid rebroadcast loops, we give every event a unique id and hold a copy of that id in memory
     * when broadcasting an event, we check if we have the event id (are we the source?)
     * if so, we do not send it otherwise we get stuck in an event loop
     * the problem is, when do we know the id held in memory is obsolite and can be cleaned up?
     */

    /**
     * Broadcast CustomEvent with ':' in the event name across frames
     * @example
     *  window.dispatchEvent(new CustomEvent('mobile:ready', { token: '', email: 'john' }));
     * @param {Event} event - event to dispatch
     * @returns {boolean} true if the event was dispatched successfully
     */
    EventTarget.prototype.dispatchEvent = function (event) {

        var isCustomEvent = (event instanceof CustomEvent && 'detail' in event);
        var isNamespacedEvent = String(event.type || '').includes(':');
        var isWindowEvent = (this === window);

        // not a broadcastable event, dispatch locally as normal
        if (!(isCustomEvent && isNamespacedEvent && isWindowEvent)) {
            return originalDispatchEvent.call(this, event);
        }

        var source = window.location.href;
        var data = {
            type: event.type,
            detail: event.detail,
            host: host,
            source: source,
            originId: originId,
            timestamp: Date.now()
        };

        // dispatch locally
        var eventResult = originalDispatchEvent.call(this, event);

        if (window.top !== this) {
            sendMessage(window.top, { broadcastEvent: data }, '*');
        }
        else {
            // send event to all child frames
            for (var i = 0, l = window.frames.length; i < l; i++) {
                sendMessage(window.frames[i], { broadcastEvent: data }, '*');
            }
        }

        return eventResult;
    };

    /**
     * console.log but only if debug=true
     * @returns {void}
     */
    function log() {
        if (debug) {
            var params = ['broadcast-event[' + host + ']'].concat([].slice.call(arguments));
            console.log.apply(console, params);
        }
    }

    /**
     * Post message to a window
     * @param {Window} targetWindow - window to send message to
     * @param {object} payload - data to send
     * @returns {void}
     */
    function sendMessage(targetWindow, payload) {

        // do not send to self
        if (targetWindow === window) return;
    
        // see if we have already sent this previoulsey (resending causes an event loop)
        var alreadyBroadcast = eventIdCache.some(function(guid) {
            return eventIdIndex = (payload?.broadcastEvent?.detail?.eventIds || []).indexOf(guid) !== -1;
        });

        if (alreadyBroadcast) return;

        // this uniquley identifies the event so we can prevent it been rebroadcast
        var eventId = stringHash(host + ':' + payload.type + ':' + performance.now() + ':' + Math.random());

        // event.detail might not be an object
        payload.broadcastEvent.detail = payload?.broadcastEvent?.detail || {};
        payload.broadcastEvent.detail.eventIds = payload?.broadcastEvent?.detail?.eventIds || [];
        payload.broadcastEvent.detail.eventIds.push(eventId);

        eventIdCache.push(eventId);

        // TODO: clear cache of ids to avoid memory leak

        try {
            log('sent:', payload);
            targetWindow.postMessage(payload, '*');
        }
        catch (e) {
            // ignore cross-origin frame errors
        }
    }

    /**
     * Generates a unique, obfuscated hash from a given string
     * @param {string} input - the input string to hash
     * @returns {string} unique obfuscated hash
     */
    function stringHash(input) {
        var hash = 2166136261; // FNV-1a offset basis
        for (var i = 0; i < input.length; i++) {
            hash ^= input.charCodeAt(i);
            hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
        }
        return Math.abs(hash >>> 0).toString(36);
    }

    /**
     * handles incoming messages and processes event dispatching
     * prevents rebroadcast loops by tracking seen event IDs
     * @param {MessageEvent} event - received postMessage event
     * @returns {void}
     */
    function handleMessage(event) {

        // prevent rebroadcasting the same event to the originating frame
        if (event.source === window) return;

        var broadcastEvent = event.data && event.data.broadcastEvent;

        if (broadcastEvent && typeof broadcastEvent.type === 'string') {

            log('received:', broadcastEvent);

            // dispatch the broadcasted event locally
            window.dispatchEvent(new CustomEvent(broadcastEvent.type, { detail: broadcastEvent.detail }));
        }
    }

    // listen for events from other frames
    window.addEventListener('message', handleMessage);

})();
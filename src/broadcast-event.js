/* eslint-disable prefer-spread */
/*!
/* broadcast-events.js - v@version@
 * Automatically broadcasts CustomEvent to all iframes
 */
(function (window) {

    'use strict';

    // dependency check!
    if (typeof window.CustomEvent !== 'function') throw new Error('missing CustomEvent polyfill');
    if (typeof window.EventTarget !== 'function') throw new Error('missing EventTarget polyfill');

    var sender = window.location.href;
    var eventIdCache = [];
    var debugging = true; // uncomment to console log sequence

    /**
     * to avoid rebroadcast loops, we give every event a unique id and hold a copy of that id in memory
     * when broadcasting an event, we check if we have the event id (are we the source?)
     * if so, we do not send it otherwise we get stuck in an event loop
     * the problem is, when do we know the id held in memory is obsolite and can be cleaned up?
     */

    /**
     * Fire events across iframes
     * @example
     *  broadcastEvent('mobile:ready', { token: '01234', email: 'john@orcascan.com' });
     * @param {string} eventName - event to dispatch
     * @param {object} [eventData] - data to send with the event
     * @param {boolean} [debug] - console log flow if true (default false)
     * @returns {void}
     */
    function broadcastEvent(eventName, eventData, debug) {

        eventName = String(eventName || '') || '';
        eventData = eventData || {};
        debugging = (debug === true);

        if (eventName.indexOf(':') === -1) throw new Error('eventName must be namespaced with :');

        // exit if we already sent this
        if (alreadyBroadcast(eventData)) return;

        var data = {
            type: eventName,
            detail: eventData,
            sender: sender,
            timestamp: Date.now()
        };

        // dispatch locally
        log('fired:', data);
        window.dispatchEvent(new CustomEvent(eventName, eventData));

        // send to other frames
        if (window.top !== window) {
            // we're in an iframe, send to parent
            sendEvent(window.top, data);
        }
        else {
            // we're topmost page, send to all child frames
            for (var i = 0, l = window.frames.length; i < l; i++) {
                sendEvent(window.frames[i], data);
            }
        }
    };

    /**
     * console.log but only if debug=true
     * @returns {void}
     */
    function log() {
        if (debugging) {
            var params = ['broadcast-event[' + sender + ']'].concat([].slice.call(arguments));
            console.log.apply(console, params);
        }
    }

    /**
     * Checks if this event has already been broadcast by us
     * @param {object} eventData - event data
     * @returns {boolean} true if we've already send this, otherwise false
     */
    function alreadyBroadcast(eventData) {

        if (!eventData) throw new Error('Invalid payload param');

        var eventIds = eventData.eventIds || [];
        
        // check if this event id was issued by us
        var matchFound = eventIdCache.some(function(guid) {
            return eventIds.indexOf(guid) !== -1;
        });

        return matchFound;
    }

    /**
     * Send an event to another window using postMessage
     * @param {Window} targetWindow - window to send message to
     * @param {object} payload - data to send
     * @returns {void}
     */
    function sendEvent(targetWindow, payload) {

        // dont send to self
        if (targetWindow === window) return;

        // exit if we already sent this
        if (alreadyBroadcast(payload.detail)) return;
    
        // generate a unique event ID to prevent rebroadcast loops
        var eventId = stringHash(sender + ':' + payload.type + ':' + performance.now() + ':' + Math.random());
        
        // add new event ID (ensures if we see this event again, we dont rebroadcast)
        payload.detail.eventIds = payload.detail.eventIds || [];
        payload.detail.eventIds.push(eventId);

        // store this event ID in cache
        eventIdCache.push(eventId);
    
        // dont let event cache grow beyond 500 items
        if (eventIdCache.length > 1000) {
            eventIdCache.splice(0, eventIdCache.length - 1000);
        }

        try {
            log('sent:', payload);
            targetWindow.postMessage({ _broadcast: payload }, '*');
        }
        catch (e) {
            // Ignore cross-origin frame errors
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
    window.addEventListener('message', function(event) {

        var _broadcast = event.data && event.data._broadcast;

        if (_broadcast && typeof _broadcast.type === 'string' && _broadcast.detail) {

            log('received:', _broadcast);

            // share with other frames
            broadcastEvent(_broadcast.type, _broadcast.detail);
        }
    });

    // export
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = broadcastEvent;
    }
    else {
        window.broadcastEvent = broadcastEvent;
    }

})(this);
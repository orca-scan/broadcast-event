/*!
 * broadcast-events.js v1.0.0
 * @description A simple way to broadcast JavaScript events across iframes.
 * @see {@link https://github.com/orca-scan/broadcast-event}
 * @author Orca Scan <orcascan.com>
 * @license MIT
 */
(function (window) {

    'use strict';

    // dependency check!
    if (typeof window.CustomEvent !== 'function') throw new Error('missing CustomEvent polyfill');
    if (typeof window.EventTarget !== 'function') throw new Error('missing EventTarget polyfill');

    var sender = window.location.href;
    var originId = stringHash(sender + ':' + performance.now() + ':' + Math.random());
    var debugging = true; // uncomment to console log sequence

    /**
     * Fire events across iframes
     * @example
     *  broadcastEvent('mobile:ready', { token: '01234', email: 'john@orcascan.com' });
     * @param {string} eventName - event to dispatch
     * @param {object} [eventData] - data to send with the event
     * @returns {void}
     */
    function broadcastEvent(eventName, eventData, eventOriginId) {

        eventName = String(eventName || '') || '';

        if (eventName.indexOf(':') === -1) throw new Error('eventName must be namespaced with :');

        // dont rebroadcast our own events
        if (eventOriginId === originId) {
            log('suppressed:', eventName);
            return;
        }

        var data = {
            originId: eventOriginId || originId,
            type: eventName,
            detail: eventData,
            eventId: stringHash(eventName + ':' + performance.now() + ':' + Math.random())
        };

        log('fired:', data);

        // dispatch locally
        window.dispatchEvent(new CustomEvent(eventName, eventData));

        // we're in an iframe, send to parent
        if (window.top !== window) {
            sendEvent(window.top, data);
        }
        else {
            // send to all child frames
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
     * Send an event to another window using postMessage
     * @param {Window} targetWindow - window to send message to
     * @param {object} payload - data to send
     * @returns {void}
     */
    function sendEvent(targetWindow, payload) {

        // dont send to self
        if (targetWindow === window) return;

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

        if (event.source === window) return;

        var _broadcast = event.data && event.data._broadcast;

        if (_broadcast && typeof _broadcast.type === 'string') {

            log('received:', _broadcast);

            // share with other frames
            broadcastEvent(_broadcast.type, _broadcast.detail, _broadcast.originId);
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
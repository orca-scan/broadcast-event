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

    var sender = window.location.href;
    var originId = stringHash(sender + ':' + performance.now() + ':' + Math.random());
    var debugging = true; // uncomment to console log sequence
    var recentEvents = [];

    /**
     * Fire events across iframes
     * @example
     *  broadcastEvent('mobile:ready', { token: '01234', email: 'john@orcascan.com' });
     * @param {string} eventName - event to dispatch
     * @param {object} [eventData] - data to send with the event
     * @returns {void}
     */
    function broadcastEvent(eventName, eventData, eventOriginId, eventIds) {

        eventName = String(eventName || '') || '';

        if (eventName.indexOf(':') === -1) throw new Error('eventName must be namespaced with :');

        var data = {
            originId: eventOriginId || originId,
            type: eventName,
            detail: eventData,
            eventIds: eventIds || []
        };

        // see if we have already sent this previoulsey (resending causes an event loop)
        var alreadyBroadcast = recentEvents.some(function(guid) {
            return ((data.eventIds || []).indexOf(guid) !== -1);
        });

        if (alreadyBroadcast) {
            log('suppressed: ', window.location.href);
            return;
        }

        // this uniquley identifies the event so we can prevent it been rebroadcast
        var eventId = stringHash(sender + ':' + data.type + ':' + performance.now() + ':' + Math.random());

        // payload.eventIds = payload.eventIds || [];
        data.eventIds.push(eventId);

        recentEvents.push(eventId);

        // dispatch locally
        window.dispatchEvent(new CustomEvent(eventName, eventData));

        // we're in an iframe, send to parent
        if (window.parent !== window) {
            sendEvent(window.parent, data);
            log('sending up from: ', window.location.href);
        }

        // send to all child frames
        for (var i = 0, l = window.frames.length; i < l; i++) {
            sendEvent(window.frames[i], data);
            log('sending down from: ', window.location.href);
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
            // log('sent:', payload);
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
            broadcastEvent(_broadcast.type, _broadcast.detail, _broadcast.originId, _broadcast.eventIds);
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
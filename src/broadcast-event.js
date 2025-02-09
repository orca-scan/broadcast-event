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
    if (typeof window.CustomEvent !== 'function') throw new Error('Missing CustomEvent polyfill');

    var sender = window.location.href;
    var originId = stringHash(sender + ':' + performance.now() + ':' + Math.random());
    var debugging = true; // uncomment to console log sequence
    var recentEvents = {};

    /**
     * Fire events across iframes
     * @example
     *  broadcastEvent('mobile:ready', { token: '01234', email: 'john@orcascan.com' });
     * @param {string} eventName - event to dispatch
     * @param {object} [eventData] - data to send with the event
     * @param {object} [options] - { debug: true }
     * @returns {void}
     */
    function broadcastEvent(eventName, eventData, options) {

        eventName = String(eventName || '') || '';
        options = options || {};

        if (eventName.indexOf(':') === -1) throw new Error('eventName must be namespaced with :');

        // should we enable logging?
        debugging = (options.debug === true);

        var payload = {
            type: eventName,
            detail: eventData,
            eventIds: options._eventIds || [],
            originId: options._originId || originId, // retain original originId
            debug: debugging
        };

        // if we've already sent this, exit
        if (alreadyBroadcast(payload)) return;

        // dispatch locally
        window.dispatchEvent(new CustomEvent(eventName, eventData));

        // we're in an iframe, send to parent
        if (window.parent !== window) {
            sendEvent(window.parent, payload);
            log('sending "' + payload.type + '" up');
        }

        // send to all child frames
        for (var i = 0, l = window.frames.length; i < l; i++) {
            sendEvent(window.frames[i], payload);
            log('sending "' + payload.type + '" down');
        }
    };

    /**
     * Checks if an event has already been sent by this instance
     * @param {object} payload - data to be sent
     * @returns {boolean} true if broadcast of false
     */
    function alreadyBroadcast(payload) {

        var now = Date.now();

        // remove anything older than 30 seconds
        var expiredAfter = now - 30000;
        Object.keys(recentEvents).forEach(function(key) {
            if (recentEvents[key] < expiredAfter) {
                delete recentEvents[key];
            }
        });

        // see if we have already sent this previoulsey (resending causes an event loop)
        var suppress = payload.eventIds.some(function(id) {
            return recentEvents[id] !== undefined;
        });

        if (suppress) {
            log('suppressed "' + payload.type + '"');
            return true;
        }

        // this uniquley identifies the event so we can prevent rebroadcasts
        var eventId = stringHash(sender + ':' + payload.type + ':' + performance.now() + ':' + Math.random());

        // add event id to payload
        payload.eventIds.push(eventId);

        // store the event id so we can check if we've seen it before
        recentEvents[eventId] = now;

        return false;
    }

    /**
     * console.log but only if debug=true
     * @returns {void}
     */
    function log() {
        if (debugging) {
            var args = [].slice.call(arguments);
            var params = ['broadcast-event[' + sender + ']'].concat(args);
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

        if (_broadcast && typeof _broadcast.type === 'string' && _broadcast.originId) {

            log('received "' + _broadcast.type + '"');

            var options = {
                _originId: _broadcast.originId,
                _eventIds: _broadcast.eventIds,
                debug: _broadcast.debug
            };

            // share with other frames
            broadcastEvent(_broadcast.type, _broadcast.detail, options);
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
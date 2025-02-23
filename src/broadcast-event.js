/*!
 * broadcast-events.js v@version@
 * @description A simple way to fire JavaScript events across iframes.
 * @see {@link https://github.com/orca-scan/broadcast-event}
 * @author Orca Scan <orcascan.com>
 * @license MIT
 */
(function (window) {

    'use strict';

    // dependency check!
    if (typeof window.CustomEvent !== 'function') throw new Error('Missing CustomEvent polyfill');

    var sender = window.location.href;
    var originId = stringHash(sender + ':' + Date.now() + ':' + Math.random() * 1e18);
    var recentEvents = {};

    /**
     * Fire events across iframes
     * @example
     *  broadcastEvent('mobile:ready', { token: '01234', email: 'john@orcascan.com' });
     * @param {string} eventName - event to dispatch
     * @param {object} [eventData={}] - optional data to send
     * @param {object} [options={}] - optional options ;)
     * @param {boolean} [options.encrypt=false] - if set, encrypts event data in transit
     * @param {string} [options.target=e.detail._originId] - if set, sends event only to that frame
     * @param {boolean} [options.debug=false] - console log if true (default false)
     * @returns {void}
     */
    function broadcastEvent(eventName, eventData, options) {

        if (eventData && typeof eventData !== 'object') throw new Error('eventData must be an object');

        eventName = String(eventName || '') || '';
        eventData = eventData || {};
        options = options || {};

        // should we enable logging?
        options.debug = (options.debug === true);

        // send originId so handlers know whos calling (always retain original originId)
        if (!eventData._originId) {
            eventData._originId = originId;
        }

        // set event target if provided
        if (options.target) {
            eventData._targetId = options.target;
        }

        var payload = {
            type: eventName,
            detail: eventData,
            eventIds: options._eventIds || [],
            debug: options.debug
        };

        // if we've already sent this, exit
        if (alreadyBroadcast(payload)) {
            if (options.debug) {
                log('suppressed "' + payload.type + '"');
            }
            return;
        }

        // only fire event locally if we have no target or we are the target
        if (!eventData._targetId || eventData._targetId === originId) {
            window.dispatchEvent(new CustomEvent(eventName, { detail: eventData }));
        }

        // if required, encrypt the payload
        if (options.encrypt) {
            payload.detail = 'BE:' + encrypt(eventData, eventData._originId) + ':' + eventData._originId;
        }
    
        // we're in an iframe, send to parent
        if (window.parent !== window) {
            sendEvent(window.parent, payload);
            if (options.debug) {
                log('sending "' + payload.type + '" up');
            }
        }

        // send to all child frames
        for (var i = 0, l = window.frames.length; i < l; i++) {
            sendEvent(window.frames[i], payload);
            if (options.debug) {
                log('sending "' + payload.type + '" down');
            }
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

        // exit if we've already processed this event
        if (suppress) return true;

        // this uniquley identifies the event so we can prevent rebroadcasts
        var eventId = stringHash(sender + ':' + payload.type + ':' + performance.now() + ':' + Math.random());

        // add event id to payload
        payload.eventIds.push(eventId);

        // store the event id so we can check if we've seen it before
        recentEvents[eventId] = now;

        return false;
    }

    /**
     * console.log helper
     * @returns {void}
     */
    function log() {
        var args = [].slice.call(arguments);
        var params = ['broadcast-event[' + sender + ']'].concat(args);
        console.log.apply(console, params);
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
        catch (err) {
            // Ignore cross-origin frame errors
            log('postMessage error', err);
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
     * Encrypts a string using XOR + Base64 encoding.
     * @param {string|object} input - item to encrypt
     * @param {string} key - The encryption key.
     * @returns {string} - The encrypted string, Base64-encoded.
     */
    function encrypt(input, key) {
        if (!key) throw new Error('Encryption key is required');

        // serialise obejcts
        input = (typeof input === 'object') ? JSON.stringify(input) : input;

        var output = [];
        for (var i = 0; i < input.length; i++) {
            var keyChar = key.charCodeAt(i % key.length);
            var mixedChar = input.charCodeAt(i) ^ keyChar ^ (i % 256); // Adds position-dependent entropy
            output.push(String.fromCharCode(mixedChar));
        }

        return btoa(output.join(''));
    }

    /**
     * Decrypts a string encrypted using XOR + Base64 encoding.
     * @param {string} input - The Base64-encoded encrypted string.
     * @param {string} key - The encryption key.
     * @returns {string} - The decrypted plaintext string.
     */
    function decrypt(input, key) {
        if (!key) throw new Error('Decryption key is required');

        var decoded = atob(input);
        var output = [];
        for (var i = 0; i < decoded.length; i++) {
            var keyChar = key.charCodeAt(i % key.length);
            var originalChar = decoded.charCodeAt(i) ^ keyChar ^ (i % 256);
            output.push(String.fromCharCode(originalChar));
        }

        return output.join('');
    }

    /**
     * handles incoming messages and processes event dispatching
     * @param {MessageEvent} event - received postMessage event
     * @returns {void}
     */
    window.addEventListener('message', function(event) {

        // exit if source is self
        if (event.source === window) return;

        // exit if it's not a valid broadcast
        if (!event.data) return;
        if (!event.data._broadcast) return;
        if (!event.data._broadcast.detail) return;
        if (typeof event.data._broadcast.type !== 'string') return;

        var broadcast = event.data._broadcast;

        if (broadcast.debug) {
            log('received "' + broadcast.type + '"');
        }

        // is the event data encrypted?
        var encrypted = (typeof broadcast.detail === 'string' && broadcast.detail.indexOf('BE:') === 0);

        if (encrypted) {
            try {
                // decrypt event data
                var parts = broadcast.detail.split(':');
                broadcast.detail = JSON.parse(decrypt(parts[1], parts[2]));
            }
            catch (err) {
                broadcast.detail = null;
                log('Failed to decrypt event data');
            }
        }

        var options = {
            _eventIds: broadcast.eventIds,
            debug: broadcast.debug,
            encrypt: encrypted
        };

        broadcastEvent(broadcast.type, broadcast.detail, options);
    });

    // export
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = broadcastEvent;
    }
    else {
        window.broadcastEvent = broadcastEvent;
    }

})(this);
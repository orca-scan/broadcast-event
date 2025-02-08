/* eslint-disable prefer-spread */
/*!
/* broadcast-event.js - v@version@
 * Automatically broadcasts CustomEvent to all iframes
 */
(function (window) {

    'use strict';

    // dependency check!
    if (typeof window.CustomEvent !== 'function') throw new Error('missing CustomEvent polyfill');
    if (typeof window.EventTarget !== 'function') throw new Error('missing EventTarget polyfill');

    var host = window.location.host;
    var sender = window.location.href;
    var debug = true; // uncomment to console log sequence
    var eventIdCache = [];

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
     * @param {object} eventData - data to send with the event
     * TODO: add debug as a parm
     * @returns {boolean} true if the event was dispatched successfully
     */
    function broadcastEvent(eventName, eventData) {

        eventName = String(eventName || '') || '';

        if (eventName.indexOf(':') === -1) throw new Error('eventName must be namespaced with :');

        var data = {
            type: eventName,
            detail: eventData || {},
            sender: sender,
            timestamp: Date.now()
        };

        // dispatch locally
        var eventResult = window.dispatchEvent(new CustomEvent(eventName, eventData));

        if (window.top !== window) {
            sendMessage(window.top, { broadcastEventData: data }, '*');
        }
        else {
            // Send event to all child frames, including forwarding from parent
            for (var i = 0, l = window.frames.length; i < l; i++) {
                if (window.frames[i] !== window) { // Prevent sending to self
                    sendMessage(window.frames[i], { broadcastEventData: data }, '*');
                }
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
            var params = ['broadcast-event[' + sender + ']'].concat([].slice.call(arguments));
            console.log.apply(console, params);
        }
    }

    /**
     * Send event via post message
     * @param {Window} targetWindow - window to send message to
     * @param {object} payload - data to send
     * @returns {void}
     */
    function sendMessage(targetWindow, payload) {

        if (targetWindow === window) return; // Prevent sending to self

        var eventIds = [];

        // extract existing event IDs from payload
        if (payload.broadcastEventData && payload.broadcastEventData.detail && Array.isArray(payload.broadcastEventData.detail.eventIds)){
            eventIds = payload.broadcastEventData.detail.eventIds;
        }

        // check if the event was already broadcast
        var alreadyBroadcast = eventIdCache.some(function(guid) {
            return eventIds.indexOf(guid) !== -1;
        });
        if (alreadyBroadcast) return;

        // generate a unique event ID to prevent rebroadcast loops
        var eventId = stringHash(host + ':' + payload.broadcastEventData.type + ':' + performance.now() + ':' + Math.random());

        // ensure payload structure is initialized
        if (!payload) payload = {};
        if (!payload.broadcastEventData) payload.broadcastEventData = {};
        if (!payload.broadcastEventData.detail) payload.broadcastEventData.detail = {};
        if (!payload.broadcastEventData.detail.eventIds) payload.broadcastEventData.detail.eventIds = [];
        
        // add new event ID
        payload.broadcastEventData.detail.eventIds.push(eventId);

        // store this event ID so we can check for future broadcasts
        eventIdCache.push(eventId);
    
        // dont let event cache grow beyond 500 items
        if (eventIdCache.length > 500) {
            eventIdCache.splice(0, eventIdCache.length - 500);
        }
        
        try {
            log('sent:', payload);
            targetWindow.postMessage(payload, '*');
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

        var broadcastEventData = event.data && event.data.broadcastEventData;

        if (broadcastEventData && typeof broadcastEventData.type === 'string' && broadcastEventData.detail) {

            log('received:', broadcastEventData);

            // dispatch the broadcasted event locally
            window.dispatchEvent(new CustomEvent(broadcastEventData.type, { detail: broadcastEventData.detail }));
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

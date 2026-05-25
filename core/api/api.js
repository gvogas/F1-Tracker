/**
 * F1API — client module for the PHP backend.
 * All data goes through /api/* (never directly to OpenF1).
 */
var F1API = {

    // Shared request path: backoff guard, success/Retry-After tracking.
    _xhr: function (opts) {
        if (F1Utils.isBackingOff()) {
            return $.Deferred().reject({ status: 429 }).promise();
        }
        var xhr = $.ajax(opts);
        xhr.done(function () { F1Utils.noteSuccess(); });
        xhr.fail(function (jqXhr) {
            var s = jqXhr && jqXhr.status;
            if (s === 429 || s === 503) {
                var ra = parseInt((jqXhr.getResponseHeader && jqXhr.getResponseHeader('Retry-After')) || '0', 10);
                F1Utils.setBackoff(ra > 0 ? ra * 1000 : 8000);
            }
        });
        return xhr;
    },

    _get: function (path, params) {
        return F1API._xhr({
            url:      '/api/' + path,
            method:   'GET',
            dataType: 'json',
            data:     params || {},
            timeout:  15000
        });
    },

    _post: function (path, body) {
        return F1API._xhr({
            url:         '/api/' + path,
            method:      'POST',
            dataType:    'json',
            contentType: 'application/json',
            data:        JSON.stringify(body || {}),
            timeout:     30000
        });
    },

    /* ===== Data endpoints (GET) ===== */

    meetings: function (params) {
        return F1API._get('meetings', params);
    },

    sessions: function (params) {
        return F1API._get('sessions', params);
    },

    drivers: function (params) {
        return F1API._get('drivers', params);
    },

    results: function (params) {
        return F1API._get('results', params);
    },

    weather: function (params) {
        return F1API._get('weather', params);
    },

    tower: function (params) {
        return F1API._get('tower', params);
    },

    laps: function (params) {
        return F1API._get('laps', params);
    },

    raceControl: function (params) {
        return F1API._get('race-control', params);
    },

    /* ===== AI endpoints (POST) ===== */

    aiCommentator: function (sessionKey) {
        return F1API._post('ai/commentator', { session_key: sessionKey });
    },

    aiTyreStrategy: function (sessionKey) {
        return F1API._post('ai/tyre-strategy', { session_key: sessionKey });
    },

    aiRaceControlExplain: function (sessionKey) {
        return F1API._post('ai/race-control-explain', { session_key: sessionKey });
    },

    aiPerformance: function (sessionKey) {
        return F1API._post('ai/performance', { session_key: sessionKey });
    }
};

/**
 * F1API — client module for the PHP backend.
 * All data goes through /api/* (never directly to OpenF1).
 */
var F1API = {

    _get: function (path, params) {
        return $.ajax({
            url:      '/api/' + path,
            method:   'GET',
            dataType: 'json',
            data:     params || {},
            timeout:  15000
        });
    },

    _post: function (path, body) {
        return $.ajax({
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

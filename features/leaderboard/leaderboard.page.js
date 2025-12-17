var LeaderboardPageModel = (function () {

    var state = {
        year: new Date().getFullYear(),
        meeting_key: null,
        session_key: null
    };

    function init() {
        HeaderModel.createHeader();

        $("#refreshBtn").on("click", function () {
        loadMeetings(true);
        });

        $("#meetingSelect").on("change", function () {
        state.meeting_key = $("#meetingSelect").val() || null;
        state.session_key = null;
        loadSessionsForMeeting(state.meeting_key, true);
        });

        $("#sessionSelect").on("change", function () {
        state.session_key = $("#sessionSelect").val() || null;
        if (state.session_key) loadResultsForSession(state.session_key);
        });

        loadMeetings(false);
    }

    /* ===== Meetings ===== */
    function loadMeetings(force) {
        $("#lbMsg").text("Loading meetings...");
        $("#driversBody").empty();
        $("#lbTitle").text("Leaderboard");

        // You can later add a year dropdown; for now use current year
        OpenF1API.meetings({ year: state.year })
        .done(function (meetings) {
            if (!Array.isArray(meetings) || meetings.length === 0) {
            $("#lbMsg").text("No meetings found for " + state.year + ".");
            $("#meetingSelect").empty();
            $("#sessionSelect").empty();
            return;
            }

            // sort by date_start
            meetings.sort(function (a, b) {
            return new Date(a.date_start).getTime() - new Date(b.date_start).getTime();
            });

            // build meeting dropdown
            var prev = (!force && state.meeting_key) ? state.meeting_key : $("#meetingSelect").val();
            $("#meetingSelect").empty();

            for (var i = 0; i < meetings.length; i++) {
            var m = meetings[i];
            var label = formatMeetingLabel(m);
            $("#meetingSelect").append($("<option>").val(String(m.meeting_key)).text(label));
            }

            // default: keep prev if exists, else latest meeting
            var pick = null;
            if (prev && $("#meetingSelect option[value='" + prev + "']").length) {
            pick = prev;
            } else {
            pick = String(meetings[meetings.length - 1].meeting_key);
            }

            state.meeting_key = pick;
            $("#meetingSelect").val(pick);

            // load sessions
            loadSessionsForMeeting(pick, force);
        })
        .fail(function () {
            $("#lbMsg").text("Failed to load meetings.");
        });
    }

    function formatMeetingLabel(m) {
        // Example: "Monaco GP · May 26"
        var name = m.meeting_name || m.meeting_official_name || "Grand Prix";
        var d = m.date_start ? new Date(m.date_start) : null;

        if (!d || isNaN(d.getTime())) return name;

        var mon = d.toLocaleDateString(undefined, { month: "short" });
        var day = d.toLocaleDateString(undefined, { day: "2-digit" });

        return name + " · " + mon + " " + day;
    }

    /* ===== Sessions ===== */
    function loadSessionsForMeeting(meetingKey, force) {
        if (!meetingKey) return;

        $("#lbMsg").text("Loading sessions...");
        $("#driversBody").empty();
        $("#sessionSelect").empty();

        OpenF1API.sessions({ meeting_key: meetingKey })
        .done(function (sessions) {
            if (!Array.isArray(sessions) || sessions.length === 0) {
            $("#lbMsg").text("No sessions found for this meeting.");
            return;
            }

            // sort by date_start
            sessions.sort(function (a, b) {
            return new Date(a.date_start).getTime() - new Date(b.date_start).getTime();
            });

            // title from meeting/session fields
            var last = sessions[sessions.length - 1];
            var titleBits = [];
            if (last.meeting_name) titleBits.push(last.meeting_name);
            if (last.year) titleBits.push(String(last.year));
            $("#lbTitle").text(titleBits.length ? ("Leaderboard · " + titleBits.join(" ")) : "Leaderboard");

            var prev = (!force && state.session_key) ? state.session_key : $("#sessionSelect").val();
            $("#sessionSelect").empty();

            for (var i = 0; i < sessions.length; i++) {
            var s = sessions[i];
            $("#sessionSelect").append(
                $("<option>").val(String(s.session_key)).text(formatSessionLabel(s))
            );
            }

            // default:
            // keep prev if exists, else pick Race, else newest
            var pick = null;
            if (prev && $("#sessionSelect option[value='" + prev + "']").length) {
            pick = prev;
            } else {
            var race = sessions.find(function (s) { return s.session_name === "Race"; });
            pick = race ? String(race.session_key) : String(sessions[sessions.length - 1].session_key);
            }

            state.session_key = pick;
            $("#sessionSelect").val(pick);

            $("#lbMsg").text("");
            loadResultsForSession(pick);
        })
        .fail(function () {
            $("#lbMsg").text("Failed to load sessions.");
        });
    }

    function formatSessionLabel(s) {
        // Example: "Qualifying · Sat 14:00"
        var name = s.session_name || "Session";
        var d = s.date_start ? new Date(s.date_start) : null;
        if (!d || isNaN(d.getTime())) return name;

        var day = d.toLocaleDateString(undefined, { weekday: "short" });
        var time = d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
        return name + " · " + day + " " + time;
    }

    /* ===== Results ===== */
    function loadResultsForSession(sessionKey) {
        $("#lbMsg").text("Loading results...");
        $("#driversBody").empty();

        $.when(
        OpenF1API.drivers({ session_key: sessionKey }),
        OpenF1API.sessionResult({ session_key: sessionKey })
        ).done(function (driversRes, resultRes) {
        var drivers = driversRes[0] || [];
        var results = resultRes[0] || [];

        var byNum = {};
        for (var i = 0; i < drivers.length; i++) {
            byNum[String(drivers[i].driver_number)] = drivers[i];
        }

        render(results, byNum);
        $("#lbMsg").text(results.length ? "" : "No results found for this session.");
        }).fail(function () {
        $("#lbMsg").text("Failed to load drivers/results.");
        });
    }

    function render(results, byNum) {
        var prefs = UserPrefsModel.load();
        var favDriver = (prefs.favoriteDriver || "").trim().toLowerCase();
        var favTeam = (prefs.favoriteTeam || "").trim().toLowerCase();

        results = (results || []).slice().sort(function (a, b) {
        return (a.position || 999) - (b.position || 999);
        });

        var $body = $("#driversBody").empty();

        for (var i = 0; i < results.length; i++) {
        var r = results[i];
        var num = String(r.driver_number || "");
        var d = byNum[num] || {};

        var fullName = (d.full_name || "").trim();
        if (!fullName) {
            var fn = (d.first_name || "").trim();
            var ln = (d.last_name || "").trim();
            fullName = (fn || ln) ? (fn + (ln ? " " + ln : "")) : ("#" + num);
        }

        var team = (d.team_name || "").trim();
        var status = r.dsq ? "DSQ" : (r.dns ? "DNS" : (r.dnf ? "DNF" : "OK"));

        var gap = (r.gap_to_leader === 0 || r.gap_to_leader === "0" || r.gap_to_leader === null)
            ? "—"
            : String(r.gap_to_leader);

        var isFav =
            (favDriver && fullName.toLowerCase() === favDriver) ||
            (favTeam && team.toLowerCase() === favTeam);

        var $tr = $("<tr>").toggleClass("lb-row-fav", isFav);
        $tr.append($("<td>").text(r.position || ""));
        $tr.append($("<td>").text(fullName));
        $tr.append($("<td>").text(team || "—"));
        $tr.append($("<td>").addClass("right").text(gap));
        $tr.append($("<td>").addClass("right").text(status));
        $body.append($tr);
        }
    }

    return { init: init };

})();

$(function () { LeaderboardPageModel.init(); });

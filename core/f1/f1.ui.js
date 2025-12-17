var F1UI = {

    renderDriverGrid: function (grid, drivers, opts) {
        opts = opts || {};

        var search = String(opts.search || "").toLowerCase().trim();
        var selectedName = String(opts.selectedName || "").trim();

        grid.empty();

        drivers = drivers || [];

        var list = drivers.filter(function (d) {
        if (!search) return true;

        var name = String(d.fullName || "").toLowerCase();
        var team = String(d.teamName || "").toLowerCase();
        var acr  = String(d.acronym || "").toLowerCase();

        return name.includes(search) || team.includes(search) || acr.includes(search);
        });

        for (var i = 0; i < list.length; i++) {
        var d = list[i];

        var chip = $("<div/>")
            .addClass("chip")
            .attr({
            "data-type": "driver",
            "data-num": d.number,
            "data-value": d.fullName || ""
            });

        if (String(d.fullName || "") === selectedName) chip.addClass("is-selected");

        var left = $("<div/>").addClass("chip-left");

        if (d.headshotUrl) {
            left.append(
            $("<img/>")
                .addClass("chip-avatar")
                .attr({
                src: d.headshotUrl,
                alt: d.fullName || "Driver"
                })
            );
        }

        var nameWrap = $("<div/>").addClass("chip-namewrap");

        nameWrap.append(
            $("<div/>")
            .addClass("chip-name")
            .text(d.fullName || ("#" + d.number))
        );

        nameWrap.append(
            $("<div/>")
            .addClass("chip-sub muted")
            .text([d.country, d.acronym, d.number ? ("#" + d.number) : ""].filter(Boolean).join(" • "))
        );

        left.append(nameWrap);

        var right = $("<div/>").addClass("chip-meta");

        if (d.teamColour) {
            right.append(
            $("<span/>")
                .addClass("chip-dot")
                .css("background", "#" + d.teamColour)
            );
        }

        right.append($("<span/>").text(d.teamName || "—"));

        chip.append(left, right);
        grid.append(chip);
        }
    },

    setPill: function (sel, value, placeholder) {
        value = String(value || "").trim();

        if (value) {
        $(sel).text(value).addClass("has-value");
        } else {
        $(sel).text(placeholder).removeClass("has-value");
        }
    },

    getPillValue: function (sel) {
        return $(sel).hasClass("has-value") ? $(sel).text().trim() : "";
    }

};

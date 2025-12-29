var HeaderModel = {

  createHeader: function () {

    var prefs = (typeof UserPrefsModel !== "undefined" && UserPrefsModel.load)
      ? UserPrefsModel.load()
      : {};

    var favText = HeaderModel.buildFavText(prefs);

    // root
    var header = $("<header>").addClass("site-header");
    var inner = $("<div>").addClass("site-header__inner");

    // brand
    var brand = $("<a>")
      .addClass("site-brand")
      .attr({ href: "home.html", "aria-label": "F1 Tracker Home" });

    var logo = $("<div>").addClass("site-brand__logo").attr("id", "headerLogo");

    var brandText = $("<div>").addClass("site-brand__text");

    var title = $("<div>").addClass("site-brand__title").text("F1 Tracker");

    // favorites row: optional headshot + text
    var favRow = $("<div>").addClass("site-brand__favrow");
    var favAvatar = $("<img/>")
      .attr({ id: "headerFavAvatar", alt: "Favorite driver" })
      .addClass("fav-avatar")
      .hide();

    var sub = $("<div/>")
      .addClass("site-brand__sub muted")
      .attr("id", "headerFavText")
      .text(favText);

    favRow.append(favAvatar, sub);
    brandText.append(title, favRow);
    brand.append(logo, brandText);

    // nav
    var nav = $("<nav>").addClass("site-nav").attr("aria-label", "Primary");

    var links = [
      { href: "home.html", label: "Home", key: "home", accesskey: "1" },
      { href: "leaderboard.html", label: "Leaderboard", key: "leaderboard", accesskey: "2" },
      { href: "dashboard.html", label: "Dashboard", key: "dash", accesskey: "3" },
      { href: "profile.html", label: "Profile", key: "profile", accesskey: "4" }
    ];

    for (var i = 0; i < links.length; i++) {
      nav.append(
        $("<a>")
          .addClass("site-nav__link")
          .attr({
            href: links[i].href,
            "data-page": links[i].key,
            accesskey: links[i].accesskey
          })
          .text(links[i].label)
      );
    }

    // actions
    var actions = $("<div>").addClass("site-actions");

    var editFavBtn = $("<a>")
      .addClass("site-actions__btn")
      .attr({ href: "profile.html", accesskey: "5" })
      .text("Edit Favorites");

    var soundBtn = $("<button>")
      .addClass("site-actions__btn icon")
      .attr({ type: "button", id: "soundToggle", "aria-pressed": "false" })
      .html('<span class="pulse-dot" id="soundDot"></span><span id="soundLabel">Sound Off</span>');

    actions.append(editFavBtn, soundBtn);

    // build
    inner.append(brand, nav, actions);
    header.append(inner);

    // insert
    $("#header-container").html(header);

    // active state
    HeaderModel.setActiveNav();

    // set avatar immediately (if available)
    HeaderModel.refreshFavText();

    return header;
  },

  setActiveNav: function () {
    var path = (window.location.pathname || "").toLowerCase();
    var page =
      path.includes("leaderboard") ? "leaderboard" :
      path.includes("dashboard") ? "dashboard" :
      path.includes("profile") ? "profile" :
      "home";

    $(".site-nav__link").removeClass("is-active");
    $('.site-nav__link[data-page="' + page + '"]').addClass("is-active");
  },

  buildFavText: function (prefs) {
    return (prefs.favoriteDriver || prefs.favoriteTeam)
      ? ("Fav: " + [prefs.favoriteDriver, prefs.favoriteTeam].filter(Boolean).join(" • "))
      : "No favorites set";
  },

  refreshFavText: function () {
    var prefs = (typeof UserPrefsModel !== "undefined" && UserPrefsModel.load)
      ? UserPrefsModel.load()
      : {};

    var favText = (prefs.favoriteDriver || prefs.favoriteTeam)
      ? ("Fav: " + [prefs.favoriteDriver, prefs.favoriteTeam].filter(Boolean).join(" • "))
      : "No favorites set";

    $("#headerFavText").text(favText);

    // Use driver headshot as logo if available
    var headshot = (prefs.favoriteDriverHeadshot || "").trim();
    var $logo = $("#headerLogo");

    if (headshot) {
      $logo
        .css({
          "background-image": "url(" + headshot + ")",
          "background-size": "cover",
          "background-position": "center"
        })
        .addClass("has-driver-logo");
    } else {
      // fallback to default logo style
      $logo
        .css({ "background-image": "" })
        .removeClass("has-driver-logo");
    }
  }

};

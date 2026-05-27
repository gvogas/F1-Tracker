UserPrefsModel = {

  KEY: "f1_prefs",

  load: function () {
    try {
      var raw = CookieModel.get(this.KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  },

  save: function (prefs) {
    CookieModel.set(this.KEY, JSON.stringify(prefs || {}), 365);
  },

  clear: function () {
    CookieModel.del(this.KEY);
  }
};

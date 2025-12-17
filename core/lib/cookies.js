var CookieModel = {

  get: function (name) {
    var cookies = document.cookie.split("; ");
    for (var i = 0; i < cookies.length; i++) {
      var parts = cookies[i].split("=");
      var key = parts.shift();
      var value = parts.join("=");
      if (key === name) {
        return decodeURIComponent(value || "");
      }
    }
    return null;
  },

  set: function (name, value, days) {
    days = Number(days);
    if (!days || days <= 0) days = 30;

    var maxAge = Math.floor(days * 24 * 60 * 60);
    document.cookie =
      name + "=" + encodeURIComponent(String(value)) +
      "; path=/; max-age=" + maxAge + "; SameSite=Lax";
  },

  del: function (name) {
    document.cookie =
      name + "=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax";
  }
};

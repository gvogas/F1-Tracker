var SoundModel = (function () {
  var ctx = null, osc = null, osc2 = null, gain = null, filter = null;
  var running = false;

  function start() {
    if (running) return;

    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();

    // Two oscillators for a richer “engine”
    osc = ctx.createOscillator();
    osc2 = ctx.createOscillator();
    filter = ctx.createBiquadFilter();
    gain = ctx.createGain();

    osc.type = "sawtooth";
    osc2.type = "square";

    // base pitch 
    osc.frequency.value = 110;
    osc2.frequency.value = 55;

    filter.type = "lowpass";
    filter.frequency.value = 900;
    filter.Q.value = 0.8;

    // safe volume
    gain.gain.value = 0.0;

    osc.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc2.start();

    // fade in
    var t = ctx.currentTime;
    gain.gain.cancelScheduledValues(t);
    gain.gain.setValueAtTime(0.0, t);
    gain.gain.linearRampToValueAtTime(0.06, t + 0.25);

    running = true;
    animateRev();
  }

  function stop() {
    if (!running || !ctx) return;

    var t = ctx.currentTime;
    gain.gain.cancelScheduledValues(t);
    gain.gain.setValueAtTime(gain.gain.value, t);
    gain.gain.linearRampToValueAtTime(0.0, t + 0.2);

    // stop after fade
    setTimeout(function () {
      try { osc.stop(); } catch(e){}
      try { osc2.stop(); } catch(e){}
      osc = null; osc2 = null; filter = null; gain = null;
      running = false;
    }, 260);
  }

  function toggle() {
    if (!running) start();
    else stop();
    return running;
  }

  // small automatic “rev” movement while running
  function animateRev() {
    if (!running || !ctx || !osc || !osc2 || !filter) return;

    var now = ctx.currentTime;
    // pseudo-random rev
    var rev = 90 + Math.random() * 140;
    osc.frequency.setTargetAtTime(rev, now, 0.06);
    osc2.frequency.setTargetAtTime(rev * 0.5, now, 0.06);
    filter.frequency.setTargetAtTime(700 + Math.random() * 900, now, 0.08);

    setTimeout(animateRev, 220);
  }

  function bindUI() {
    $(document).on("click", "#soundToggle", function () {
      var isOn = toggle();

      $("#soundLabel").text(isOn ? "Sound On" : "Sound Off");
      $("#soundDot").toggleClass("on", isOn);
      $("#soundToggle").attr("aria-pressed", isOn ? "true" : "false");
    });
  }

  return { bindUI: bindUI };
})();

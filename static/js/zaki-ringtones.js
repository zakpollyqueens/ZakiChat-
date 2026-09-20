(() => {
  "use strict";

  let audio = null;
  let timer = null;
  let context = null;

  function getSettings() {
    try {
      return JSON.parse(
        localStorage.getItem("zakichat_call_settings") || "{}"
      );
    } catch {
      return {};
    }
  }

  function stop() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }

    if (audio) {
      try {
        audio.pause();
        audio.currentTime = 0;
      } catch (_) {}
      audio = null;
    }

    if (context) {
      try {
        context.close();
      } catch (_) {}
      context = null;
    }
  }

  async function play() {
    stop();

    const s = getSettings();

    if (s.callSounds === false) return;

    if (s.callRingtone === "custom" && s.customCallRingtoneData) {
      audio = new Audio(s.customCallRingtoneData);
      audio.loop = true;
      audio.volume = 0.45;

      try {
        await audio.play();
      } catch (e) {
        console.warn("Custom ringtone playback blocked:", e);
      }

      return;
    }

    const AudioContext =
      window.AudioContext || window.webkitAudioContext;

    if (!AudioContext) return;

    context = new AudioContext();

    if (context.state === "suspended") {
      try {
        await context.resume();
      } catch (_) {}
    }

    const patterns = {
      default: [880, 660, 880, 660],
      classic: [740, 740, 740],
      soft: [523, 659, 784],
      digital: [1047, 1319, 1568]
    };

    const pattern =
      patterns[s.callRingtone] || patterns.default;

    function ring() {
      pattern.forEach((frequency, index) => {
        const oscillator = context.createOscillator();
        const gain = context.createGain();

        oscillator.type =
          s.callRingtone === "digital"
            ? "square"
            : "sine";

        oscillator.frequency.value = frequency;

        const start =
          context.currentTime + index * 0.22;

        gain.gain.setValueAtTime(0.0001, start);

        gain.gain.exponentialRampToValueAtTime(
          0.11,
          start + 0.02
        );

        gain.gain.exponentialRampToValueAtTime(
          0.0001,
          start + 0.18
        );

        oscillator.connect(gain);
        gain.connect(context.destination);

        oscillator.start(start);
        oscillator.stop(start + 0.2);
      });
    }

    ring();
    timer = setInterval(ring, 2200);
  }

  async function test() {
    await play();
    setTimeout(stop, 10000);
  }

  window.ZakiRingtones = {
    play,
    stop,
    test
  };
})();

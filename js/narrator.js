/* Narrator – telewizor czyta komunikaty na głos (synteza mowy przeglądarki, głos polski).
   Gdy przeglądarka nie ma polskiego głosu, narrator milczy (napisy i tak są na ekranie). */
(() => {
'use strict';
const synth = window.speechSynthesis;
let voice = null, enabled = true, lastText = '', lastAt = 0;

function pickVoice() {
  if (!synth) return;
  const vs = synth.getVoices() || [];
  const pl = vs.filter(v => /^pl(-|_|$)/i.test(v.lang));
  // wolimy głosy „naturalne”/Google, jeśli są
  voice = pl.find(v => /google|natural|neural|online/i.test(v.name)) || pl[0] || null;
}
if (synth) { pickVoice(); try { synth.addEventListener('voiceschanged', pickVoice); } catch (e) { synth.onvoiceschanged = pickVoice; } }

window.Narrator = {
  get available() { return !!(synth && voice); },
  set enabled(v) { enabled = !!v; if (!enabled) this.stop(); },
  get enabled() { return enabled; },
  /** Przeczytaj tekst. queue=false przerywa poprzedni komunikat. */
  say(text, { queue = false, rate = 1.0, pitch = 0.9, delay = 0 } = {}) {
    if (!enabled || !synth || !text) return;
    if (window.Sfx && Sfx.muted) return;
    const now = Date.now();
    if (text === lastText && now - lastAt < 4000) return; // bez dublowania przy odświeżeniu sceny
    lastText = text; lastAt = now;
    const go = () => {
      if (!voice) pickVoice();
      if (!voice) return;
      try {
        if (!queue) synth.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.voice = voice; u.lang = voice.lang; u.rate = rate; u.pitch = pitch; u.volume = 1;
        // przycisz muzykę na czas mówienia
        u.onstart = () => { if (window.Sfx && Sfx.duck) Sfx.duck(true); };
        u.onend = u.onerror = () => { if (window.Sfx && Sfx.duck && !synth.speaking) Sfx.duck(false); };
        synth.speak(u);
      } catch (e) {}
    };
    if (delay) setTimeout(go, delay); else go();
  },
  stop() { try { synth && synth.cancel(); } catch (e) {} if (window.Sfx && Sfx.duck) Sfx.duck(false); },
};
})();

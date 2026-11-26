let activePlayback = null;

export function stopSpeaking() {
  activePlayback?.stop();
}

function playRecording(url, slow, session) {
  return new Promise((resolve, reject) => {
    const audio = new Audio(url);
    audio.playbackRate = slow ? 0.8 : 1;
    const finish = (error) => {
      audio.onended = null;
      audio.onerror = null;
      audio.onabort = null;
      audio.pause();
      error ? reject(error) : resolve();
    };
    session.stop = () => finish();
    audio.onended = () => finish();
    audio.onerror = () => finish(new Error("聽力音檔無法載入。"));
    audio.onabort = () => finish(new Error("聽力音檔載入中斷。"));
    audio.play().catch(finish);
  });
}

function playDeviceVoice(text, slow, session) {
  if (!globalThis.speechSynthesis || !globalThis.SpeechSynthesisUtterance) {
    throw new Error("這個瀏覽器無法使用裝置語音，請改用有英文語音的瀏覽器。");
  }
  const synth = globalThis.speechSynthesis;
  const line = new SpeechSynthesisUtterance(text);
  const english = synth.getVoices().filter((voice) => /^en(?:[-_]|$)/i.test(voice.lang));
  const voice = english.find((entry) => entry.localService && entry.lang === "en-US")
    ?? english.find((entry) => entry.localService)
    ?? english[0];
  if (voice) line.voice = voice;
  line.lang = voice?.lang ?? "en-US";
  line.rate = slow ? 0.8 : 1;
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (error, cancel = false) => {
      if (settled) return;
      settled = true;
      clearTimeout(startTimer);
      line.onstart = null;
      line.onend = null;
      line.onerror = null;
      if (cancel) synth.cancel();
      error ? reject(error) : resolve();
    };
    const startTimer = setTimeout(() => {
      finish(new Error("裝置未啟動英文語音。請確認已安裝英文語音後，再按一次發音。"), true);
    }, 8000);
    session.stop = () => finish(null, true);
    line.onstart = () => clearTimeout(startTimer);
    line.onend = () => finish();
    line.onerror = () => finish(new Error("裝置無法朗讀此詞，請確認英文語音設定。"));
    try {
      synth.speak(line);
    } catch (error) {
      finish(error);
    }
  });
}

export async function speak(text, { id, slow = false } = {}) {
  const content = String(text ?? "").trim();
  if (!content) throw new Error("沒有可播放的文字。");
  stopSpeaking();
  const session = { stop() {}, stopped: false };
  const playback = {
    stop() {
      session.stopped = true;
      session.stop();
    },
  };
  activePlayback = playback;
  try {
    if (id && /^[a-z0-9_-]+$/i.test(id)) {
      const src = new URL("./audio/" + id + ".mp3", import.meta.url);
      try {
        await playRecording(src.href, slow, session);
        return;
      } catch (error) {
        if (session.stopped) return;
        if (error.name === "NotAllowedError") {
          throw new Error("瀏覽器未允許播放，請再按一次播放鍵。");
        }
      }
    }
    await playDeviceVoice(content, slow, session);
  } finally {
    if (activePlayback === playback) activePlayback = null;
  }
}

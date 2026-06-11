import { format } from "date-fns";
function displayDate(value) {
  return format(new Date(value), "dd MMM yyyy");
}
function displayDateTime(value) {
  return format(new Date(value), "dd MMM yyyy, h:mm a");
}
function dateInputValue(date = /* @__PURE__ */ new Date()) {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 6e4).toISOString().slice(0, 16);
}
function shortName(name) {
  return name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}
function playTone(type) {
  if (localStorage.getItem("routeflow_sounds") === "false") return;
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    const context = new AudioContextClass();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(type === "success" ? 620 : 220, context.currentTime);
    if (type === "success") oscillator.frequency.exponentialRampToValueAtTime(880, context.currentTime + 0.13);
    gain.gain.setValueAtTime(1e-4, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.13, context.currentTime + 0.015);
    gain.gain.exponentialRampToValueAtTime(1e-4, context.currentTime + 0.22);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.23);
  } catch {
  }
}
export {
  dateInputValue,
  displayDate,
  displayDateTime,
  playTone,
  shortName
};

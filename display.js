import { auth, db } from "./firebase.js";
import { onAuthStateChanged, signInAnonymously } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";
import { collection, onSnapshot, query, orderBy } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js";

const byId = id => document.getElementById(id);
const ticketsRef = collection(db, "tickets");
let tickets = [];
let unsubscribeTickets = null;
let voiceEnabled = false;
let audioContext = null;
let hasInitialSnapshot = false;
let lastAnnouncedTicketId = null;
let lastAnnouncedCallTime = 0;

function timestampValue(value) {
  if (!value) return 0;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (typeof value === "number") return value;
  return new Date(value).getTime() || 0;
}

function dateValue(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isToday(value) {
  const date = dateValue(value);
  return date !== null && date.toDateString() === new Date().toDateString();
}

function updateClock() {
  const now = new Date();
  byId("clock").textContent = now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  byId("date").textContent = now.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

function renderNext(waiting) {
  const list = byId("next-list");
  list.replaceChildren();

  if (waiting.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "No students waiting";
    list.appendChild(empty);
    return;
  }

  waiting.slice(0, 5).forEach(ticket => {
    const item = document.createElement("div");
    item.className = "next-item";

    const number = document.createElement("strong");
    number.className = "next-ticket";
    number.textContent = ticket.number || "—";

    const service = document.createElement("span");
    service.className = "next-service";
    service.textContent = ticket.service || "General transaction";

    item.append(number, service);
    list.appendChild(item);
  });
}

function render() {
  const current = tickets.find(ticket => ticket.status === "serving");
  const waiting = tickets
    .filter(ticket => ticket.status === "waiting")
    .sort((a, b) => timestampValue(a.createdAt) - timestampValue(b.createdAt));
  const completed = tickets.filter(ticket => ticket.status === "done" && isToday(ticket.finishedAt));

  byId("current-number").textContent = current?.number || "—";
  byId("current-service").textContent = current?.service || "Please wait for the next ticket";
  byId("serving-status").textContent = current ? "Please proceed to the registrar counter" : "Waiting for the next student";
  byId("waiting-count").textContent = `${waiting.length} waiting`;
  byId("waiting-total").textContent = waiting.length;
  byId("completed-total").textContent = completed.length;
  byId("updated-time").textContent = `Last updated ${new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" })}`;

  renderNext(waiting);
}

function spokenNumber(value) {
  const digits = { "0": "zero", "1": "one", "2": "two", "3": "three", "4": "four", "5": "five", "6": "six", "7": "seven", "8": "eight", "9": "nine" };
  return String(value ?? "").split("").map(character => {
    if (digits[character]) return digits[character];
    if (/^[a-z]$/i.test(character)) return character;
    return " ";
  }).join(" ").replace(/\s+/g, " ").trim();
}

function playDing() {
  if (!voiceEnabled || !audioContext) return;

  try {
    const now = audioContext.currentTime;
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(880, now);
    oscillator.frequency.exponentialRampToValueAtTime(1175, now + 0.11);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.16, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.32);

    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.33);
  } catch (error) {
    console.error("Display notification sound failed:", error);
  }
}

function speak(message) {
  if (!voiceEnabled || !("speechSynthesis" in window)) return;

  window.speechSynthesis.cancel();
  window.speechSynthesis.resume();

  const utterance = new SpeechSynthesisUtterance(message);
  utterance.lang = "en-US";
  utterance.rate = 0.9;
  utterance.pitch = 1;
  utterance.volume = 1;
  window.speechSynthesis.speak(utterance);
}

function announceTicket(ticket) {
  if (!ticket) return;
  const number = spokenNumber(ticket.number);
  speak(`Calling number ${number}. Please proceed to the registrar's office.`);
}

function enableVoice() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;

  if (!AudioContextClass || !("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) {
    byId("connection-error").textContent = "Audio announcements are not supported in this browser. Please open this page in Chrome or Safari.";
    byId("connection-error").hidden = false;
    return;
  }

  try {
    if (!audioContext) audioContext = new AudioContextClass();

    audioContext.resume().then(() => {
      voiceEnabled = true;
      const button = byId("voice-btn");
      button.textContent = "TV Audio Enabled";
      button.classList.add("enabled");
      button.setAttribute("aria-pressed", "true");
      playDing();
    }).catch(error => {
      console.error("Could not enable display audio:", error);
      byId("connection-error").textContent = "Could not enable audio. Please check your device volume and browser permissions.";
      byId("connection-error").hidden = false;
    });
  } catch (error) {
    console.error("Could not initialize display audio:", error);
    byId("connection-error").textContent = "Could not initialize audio on this device.";
    byId("connection-error").hidden = false;
  }
}

byId("voice-btn").addEventListener("click", enableVoice);

function showConnectionError(message) {
  byId("connection-error").textContent = message;
  byId("connection-error").hidden = false;
  byId("connection-status").textContent = "Offline";
}

byId("fullscreen-btn").addEventListener("click", async () => {
  try {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen();
    } else {
      await document.exitFullscreen();
    }
  } catch (error) {
    console.error("Fullscreen error:", error);
  }
});

updateClock();
setInterval(updateClock, 1000);

onAuthStateChanged(auth, async user => {
  try {
    if (!user) {
      await signInAnonymously(auth);
      return;
    }

    if (unsubscribeTickets) return;

    unsubscribeTickets = onSnapshot(
      query(ticketsRef, orderBy("createdAt", "asc")),
      snapshot => {
        tickets = snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
        const current = tickets.find(ticket => ticket.status === "serving");

        if (!hasInitialSnapshot) {
          lastAnnouncedTicketId = current?.id || null;
          lastAnnouncedCallTime = timestampValue(current?.lastCalledAt);
          hasInitialSnapshot = true;
        } else if (current && current.id !== lastAnnouncedTicketId) {
          lastAnnouncedTicketId = current.id;
          lastAnnouncedCallTime = timestampValue(current.lastCalledAt);
          playDing();
        } else if (current) {
          const callTime = timestampValue(current.lastCalledAt);

          if (callTime && callTime !== lastAnnouncedCallTime) {
            lastAnnouncedCallTime = callTime;
            announceTicket(current);
          }
        } else {
          lastAnnouncedTicketId = null;
          lastAnnouncedCallTime = 0;
        }

        byId("connection-error").hidden = true;
        byId("connection-status").textContent = "Live";
        render();
      },
      error => {
        console.error("Queue display listener error:", error);
        showConnectionError("Unable to load live queue data. Please check the internet connection and Firestore read permissions.");
      }
    );
  } catch (error) {
    console.error("Queue display authentication error:", error);
    showConnectionError("Could not connect to the queue. Check Firebase Anonymous Authentication settings.");
  }
});

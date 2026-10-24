
import { auth, db } from "./firebase.js";
import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  doc,
  updateDoc,
  deleteDoc,
  getDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js";

const ticketsRef = collection(db, "tickets");
let tickets = [];
let audioContext;
let unsubscribeTickets = null;

const byId = id => document.getElementById(id);

function timeValue(value) {
  if (!value) return 0;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (typeof value === "number") return value;
  return new Date(value).getTime() || 0;
}

function dateValue(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  return new Date(value);
}

function formatTime(value) {
  const date = dateValue(value);
  return date ? date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "—";
}

function formatDate(value) {
  const date = dateValue(value);
  return date ? date.toLocaleString([], { dateStyle: "short", timeStyle: "short" }) : "—";
}

function formatDuration(milliseconds) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  return `${Math.floor(totalSeconds / 60)} min ${totalSeconds % 60} sec`;
}

function isToday(value) {
  const date = dateValue(value);
  return date !== null && date.toDateString() === new Date().toDateString();
}

function addCell(row, text) {
  const cell = row.insertCell();
  cell.textContent = text;
  return cell;
}

function currentTicket() {
  return tickets.find(ticket => ticket.status === "serving");
}

function waitingTickets() {
  return tickets
    .filter(ticket => ticket.status === "waiting")
    .sort((a, b) => timeValue(a.createdAt) - timeValue(b.createdAt));
}

async function changeStatus(ticket, status) {
  const updates = {
    status,
    updatedAt: serverTimestamp()
  };

  if (status === "serving") {
    updates.calledAt = serverTimestamp();
    updates.lastCalledAt = null;
  }

  if (status === "done" || status === "skipped") {
    updates.finishedAt = serverTimestamp();
  }

  await updateDoc(doc(db, "tickets", ticket.id), updates);
}

async function startNextTicket() {
  if (currentTicket()) return;

  const next = waitingTickets()[0];
  if (!next) {
    alert("There are no waiting tickets.");
    return;
  }

  await changeStatus(next, "serving");
}

function showWaitingList(waiting, current, average, now) {
  const body = byId("waiting-body");
  body.replaceChildren();

  if (current) {
    const row = body.insertRow();
    row.className = "serving-row";
    addCell(row, current.number);
    addCell(row, current.service);
    addCell(row, formatTime(current.createdAt));
    addCell(row, current.calledAt ? formatDuration(timeValue(current.calledAt) - timeValue(current.createdAt)) : "—");
    addCell(row, "NOW SERVING");
    addCell(row, "Called");
  }

  waiting.forEach((ticket, index) => {
    const row = body.insertRow();
    addCell(row, ticket.number);
    addCell(row, ticket.service);
    addCell(row, formatTime(ticket.createdAt));
    addCell(row, formatDuration(now - timeValue(ticket.createdAt)));

    const position = index + (current ? 1 : 0);
    addCell(row, average ? `About ${average * position} min` : "—");

    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "Skip";
    button.addEventListener("click", async () => {
      try {
        await changeStatus(ticket, "skipped");
      } catch (error) {
        console.error(error);
        alert("Could not skip this ticket. Check Firestore rules.");
      }
    });

    row.insertCell().appendChild(button);
  });

  if (!current && waiting.length === 0) {
    const row = body.insertRow();
    const cell = row.insertCell();
    cell.colSpan = 6;
    cell.className = "empty";
    cell.textContent = "No student tickets are waiting right now.";
  }
}

function showHistory() {
  const body = byId("history-body");
  body.replaceChildren();

  const history = [...tickets]
    .filter(ticket => ["done", "skipped"].includes(ticket.status))
    .sort((a, b) => timeValue(b.finishedAt) - timeValue(a.finishedAt));

  history.forEach(ticket => {
    const row = body.insertRow();
    addCell(row, ticket.number);
    addCell(row, ticket.service);
    addCell(row, formatDate(ticket.createdAt));

    const statusCell = row.insertCell();
    const badge = document.createElement("span");
    badge.className = `badge ${ticket.status}`;
    badge.textContent = ticket.status.charAt(0).toUpperCase() + ticket.status.slice(1);
    statusCell.appendChild(badge);

    addCell(row, formatDate(ticket.calledAt));
    addCell(row, formatDate(ticket.finishedAt));
    addCell(row, ticket.calledAt ? formatDuration(timeValue(ticket.calledAt) - timeValue(ticket.createdAt)) : "—");
  });

  if (history.length === 0) {
    const row = body.insertRow();
    const cell = row.insertCell();
    cell.colSpan = 7;
    cell.className = "empty";
    cell.textContent = "No queue history yet.";
  }
}

function showData() {
  const now = Date.now();
  const current = currentTicket();
  const waiting = waitingTickets();

  byId("clock").textContent = new Date().toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short"
  });

  byId("current-number").textContent = current?.number || "—";

  let currentInfo = "No ticket being served";
  if (current) {
    currentInfo = `${current.service} | Serving for ${formatDuration(now - timeValue(current.calledAt))}`;
    if (current.lastCalledAt) {
      const remaining = Math.max(0, 300000 - (now - timeValue(current.lastCalledAt)));
      currentInfo += ` | Auto-skip in ${formatDuration(remaining)}`;
    } else {
      currentInfo += " | Press Call to start the 5 min timer";
    }
  }

  byId("current-info").textContent = currentInfo;
  byId("waiting-count").textContent = waiting.length;

  const completed = tickets.filter(ticket => ticket.status === "done" && isToday(ticket.finishedAt));
  const skipped = tickets.filter(ticket => ticket.status === "skipped" && isToday(ticket.finishedAt));

  byId("completed-count").textContent = completed.length;
  byId("skipped-count").textContent = `${skipped.length} skipped today`;

  const serviceTimes = completed
    .filter(ticket => ticket.calledAt && ticket.finishedAt)
    .map(ticket => (timeValue(ticket.finishedAt) - timeValue(ticket.calledAt)) / 60000);

  const average = serviceTimes.length
    ? Math.max(1, Math.round(serviceTimes.reduce((sum, value) => sum + value, 0) / serviceTimes.length))
    : 0;

  byId("estimated-wait").textContent = average
    ? `Estimated wait: about ${current ? average : 0} min`
    : "Estimated wait: —";

  byId("next-btn").disabled = Boolean(current) || waiting.length === 0;
  byId("call-btn").disabled = !current;
  byId("done-btn").disabled = !current;
  byId("skip-btn").disabled = !current;

  showWaitingList(waiting, current, average, now);
  showHistory();
}

function playCallSound() {
  const sound = new Audio("Rene Baterbonia Mama - Sound Effect.mp3");
  sound.volume = 1;
  sound.play().catch(error => console.error("Audio failed:", error));
}

byId("next-btn").addEventListener("click", async () => {
  try {
    await startNextTicket();
  } catch (error) {
    console.error(error);
    alert("Could not call the next ticket. Check Firestore rules.");
  }
});

byId("call-btn").addEventListener("click", async () => {
  const current = currentTicket();
  if (!current) return;

  try {
    await updateDoc(doc(db, "tickets", current.id), {
      lastCalledAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    playCallSound();

    const card = byId("current-number").closest(".stat");
    card.classList.remove("call-flash");
    void card.offsetWidth;
    card.classList.add("call-flash");
  } catch (error) {
    console.error(error);
    alert("Could not call the student. Check Firestore rules.");
  }
});

byId("done-btn").addEventListener("click", async () => {
  const current = currentTicket();
  if (!current) return;

  try {
    await changeStatus(current, "done");
    await startNextTicket();
  } catch (error) {
    console.error(error);
    alert("Could not complete the ticket.");
  }
});

byId("skip-btn").addEventListener("click", async () => {
  const current = currentTicket();
  if (!current) return;

  try {
    await changeStatus(current, "skipped");
    await startNextTicket();
  } catch (error) {
    console.error(error);
    alert("Could not skip the ticket.");
  }
});

byId("clear-btn").addEventListener("click", async () => {
  if (!confirm("Delete completed and skipped tickets from queue history?")) return;

  const history = tickets.filter(ticket => ["done", "skipped"].includes(ticket.status));

  try {
    await Promise.all(history.map(ticket => deleteDoc(doc(db, "tickets", ticket.id))));
  } catch (error) {
    console.error(error);
    alert("Could not clear history. Check Firestore rules.");
  }
});

function showPage() {
  const history = location.hash === "#history";
  byId("dashboard-view").hidden = history;
  byId("history-view").hidden = !history;
  byId("page-title").textContent = history ? "Queue History" : "Dashboard";
  byId("page-subtitle").textContent = history ? "Review your queue activity" : "Manage and monitor the queue";
  byId("dashboard-link").classList.toggle("active", !history);
  byId("history-link").classList.toggle("active", history);
}

byId("dashboard-link").addEventListener("click", () => {
  location.hash = "dashboard";
});

byId("history-link").addEventListener("click", () => {
  location.hash = "history";
});

document.querySelector(".logout")?.addEventListener("click", async event => {
  event.preventDefault();
  await signOut(auth);
  location.href = "login.html";
});

let timer;

onAuthStateChanged(auth, async user => {
  if (!user || user.isAnonymous) {
    location.href = "login.html";
    return;
  }

  try {
    const profile = await getDoc(doc(db, "users", user.uid));

    if (!profile.exists() || profile.data().role !== "admin") {
      await signOut(auth);
      location.href = "login.html";
      return;
    }

    if (!unsubscribeTickets) {
      unsubscribeTickets = onSnapshot(
        query(ticketsRef, orderBy("createdAt", "asc")),
        snapshot => {
          tickets = snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
          showData();
        },
        error => {
          console.error(error);
          alert("Could not load tickets. Check Firestore rules.");
        }
      );
    }

    showPage();
    window.addEventListener("hashchange", showPage);
    clearInterval(timer);
    timer = setInterval(showData, 1000);
  } catch (error) {
    console.error(error);
    alert("Could not verify admin access.");
  }
});

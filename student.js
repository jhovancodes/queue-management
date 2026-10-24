
import { auth, db } from "./firebase.js";
import {
  onAuthStateChanged,
  signInAnonymously
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";
import {
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  doc,
  runTransaction,
  Timestamp
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js";

const serviceSelect = document.getElementById("service-select");
const ticketForm = document.getElementById("ticket-form");
const result = document.getElementById("ticket-result");
const message = document.getElementById("ticket-message");

let currentUid = null;
let lastTicketId = null;
let tickets = [];
let unsubscribeTickets = null;

const ticketsRef = collection(db, "tickets");

function showMessage(text, type = "success") {
  message.textContent = text;
  message.className = `message ${type}`;
  message.hidden = false;
}

function timestampValue(value) {
  if (!value) return 0;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (typeof value === "number") return value;
  return new Date(value).getTime() || 0;
}

function render() {
  const waiting = tickets
    .filter(ticket => ticket.status === "waiting")
    .sort((a, b) => timestampValue(a.createdAt) - timestampValue(b.createdAt));

  const current = tickets.find(ticket => ticket.status === "serving");
  const today = new Date().toDateString();

  const completed = tickets.filter(ticket =>
    ticket.status === "done" &&
    ticket.finishedAt?.toDate?.().toDateString() === today
  );

  document.getElementById("current-number").textContent = current?.number || "—";
  document.getElementById("current-service").textContent = current?.service || "Waiting for the next ticket";
  document.getElementById("waiting-count").textContent = waiting.length;
  document.getElementById("completed-count").textContent = completed.length;
  document.getElementById("queue-count").textContent = `${waiting.length} waiting`;
  document.getElementById("updated-time").textContent =
    `Queue last updated ${new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;

  const body = document.getElementById("waiting-body");
  body.replaceChildren();

  if (waiting.length === 0) {
    const row = body.insertRow();
    const cell = row.insertCell();
    cell.colSpan = 3;
    cell.className = "empty-row";
    cell.textContent = "No tickets are waiting right now.";
  } else {
    waiting.forEach(ticket => {
      const row = body.insertRow();
      row.insertCell().textContent = ticket.number;
      row.insertCell().textContent = ticket.service;

      const statusCell = row.insertCell();
      const badge = document.createElement("span");
      badge.className = "status-pill waiting";
      badge.textContent = "Waiting";
      statusCell.appendChild(badge);
    });
  }

  const myTicket = tickets.find(ticket => ticket.id === lastTicketId);

  if (myTicket) {
    result.hidden = false;
    document.getElementById("my-ticket-number").textContent = myTicket.number;
    document.getElementById("my-ticket-service").textContent = myTicket.service;

    const status = document.getElementById("my-ticket-status");
    status.textContent = myTicket.status.charAt(0).toUpperCase() + myTicket.status.slice(1);
    status.className = `status-pill ${myTicket.status}`;
  }
}

ticketForm.addEventListener("submit", async event => {
  event.preventDefault();

  if (!currentUid) {
    showMessage("Connecting to the queue. Please try again shortly.", "error");
    return;
  }

  const service = serviceSelect.value;
  if (!service) return;

  const button = ticketForm.querySelector('button[type="submit"]');
  button.disabled = true;

  try {
    const now = new Date();
    const dateKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const counterRef = doc(db, "queueCounters", dateKey);

    const number = await runTransaction(db, async transaction => {
      const counterSnapshot = await transaction.get(counterRef);
      const nextNumber = (counterSnapshot.exists() ? counterSnapshot.data().lastNumber : 0) + 1;

      transaction.set(counterRef, {
        lastNumber: nextNumber,
        updatedAt: serverTimestamp()
      });

      return `A${String(nextNumber).padStart(3, "0")}`;
    });

    const ticketRef = await addDoc(ticketsRef, {
      number,
      service,
      status: "waiting",
      studentUid: currentUid,
      createdAt: serverTimestamp(),
      calledAt: null,
      finishedAt: null,
      lastCalledAt: null,
      updatedAt: serverTimestamp()
    });

    lastTicketId = ticketRef.id;
    showMessage(`Your ticket ${number} has been submitted.`, "success");
    serviceSelect.value = "";
  } catch (error) {
    console.error("Ticket submission error:", error);
    showMessage("Ticket submission failed. Check your Firestore rules and counter permissions.", "error");
  } finally {
    button.disabled = false;
  }
});

onAuthStateChanged(auth, async user => {
  try {
    let signedInUser = user;

    if (!signedInUser) {
      const credential = await signInAnonymously(auth);
      signedInUser = credential.user;
    }

    currentUid = signedInUser.uid;

    if (!unsubscribeTickets) {
      unsubscribeTickets = onSnapshot(
        query(ticketsRef, orderBy("createdAt", "asc")),
        snapshot => {
          tickets = snapshot.docs.map(item => ({
            id: item.id,
            ...item.data()
          }));
          render();
        },
        error => {
          console.error("Queue listener error:", error);
          showMessage("Unable to load the queue. Check your Firestore rules.", "error");
        }
      );
    }
  } catch (error) {
    console.error("Firebase sign-in error:", error);
    showMessage("Firebase sign-in failed. Check Authentication settings.", "error");
  }
});

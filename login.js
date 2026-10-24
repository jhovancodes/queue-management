
import { auth } from "./firebase.js";
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";

const form = document.getElementById("login-form");

form?.addEventListener("submit", async event => {
  event.preventDefault();

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const button = form.querySelector('button[type="submit"]');

  if (button) button.disabled = true;

  try {
    await signInWithEmailAndPassword(auth, email, password);
    window.location.href = "admindashboard.html";
  } catch (error) {
    console.error(error);
    alert("Login failed. Check your email and password, and make sure the account exists in Firebase Authentication.");
  } finally {
    if (button) button.disabled = false;
  }
});

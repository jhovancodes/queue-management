import { auth } from "./firebase.js";
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";

const form = document.getElementById("login-form");
const message = document.getElementById("login-message");
const password = document.getElementById("password");
const toggle = document.getElementById("toggle-password");

toggle?.addEventListener("click", () => {
  const showing = password.type === "text";
  password.type = showing ? "password" : "text";
  toggle.setAttribute("aria-label", showing ? "Show password" : "Hide password");
  toggle.innerHTML = showing ? '<i class="bx bx-show"></i>' : '<i class="bx bx-hide"></i>';
});

form?.addEventListener("submit", async event => {
  event.preventDefault();

  const email = document.getElementById("email").value.trim();
  const passwordValue = password.value;
  const button = form.querySelector('button[type="submit"]');

  if (button) button.disabled = true;
  message.hidden = false;
  message.className = "login-message info";
  message.textContent = "Logging in...";

  try {
    await signInWithEmailAndPassword(auth, email, passwordValue);
    window.location.href = "./admindashboard.html";
  } catch (error) {
    console.error("Login error:", error);
    message.className = "login-message error";
    message.textContent = "Login failed. Please check your email and password.";
  } finally {
    if (button) button.disabled = false;
  }
});


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
    const result = await signInWithEmailAndPassword(auth, email, password);
    console.log("Login successful:", result.user.uid);
    window.location.href = "./admindashboard.html";
  } catch (error) {
    console.error("Login error:", error);
    alert(`Login failed: ${error.message}`);
  } finally {
    if (button) button.disabled = false;
  }
});

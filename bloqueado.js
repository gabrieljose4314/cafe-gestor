import { auth } from "./firebase.js";

import {
  signOut
} from "https://www.gstatic.com/firebasejs/12.10.0/firebase-auth.js";

const botaoLogout = document.getElementById("logout-btn");

botaoLogout.addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "login.html";
});
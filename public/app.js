// app.js
//
// "Acting as" identity: this project doesn't implement a full login flow
// (out of scope for this exercise), but it does simulate one so the
// admin-vs-regular-user permission check can actually be exercised.
// Whichever user is selected in the top-right dropdown becomes the
// "logged in" identity, sent to the server as the x-user-id header on
// every request. The SERVER is what decides whether that user is allowed
// to do admin things - it always re-checks is_admin in the database
// rather than trusting anything the browser claims.

let users = [];
let currentUserId = null;

const currentUserSelect = document.getElementById("current-user");
const recipientSelect = document.getElementById("recipient");
const kudosForm = document.getElementById("kudos-form");
const messageInput = document.getElementById("message");
const charCount = document.getElementById("char-count");
const formError = document.getElementById("form-error");
const feedList = document.getElementById("feed");
const feedEmpty = document.getElementById("feed-empty");
const refreshButton = document.getElementById("refresh-feed");
const adminPanel = document.getElementById("admin-panel");
const adminList = document.getElementById("admin-list");

function authHeaders() {
  return currentUserId ? { "x-user-id": String(currentUserId) } : {};
}

function timeAgo(isoString) {
  const then = new Date(isoString.replace(" ", "T") + "Z");
  const seconds = Math.floor((Date.now() - then.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

async function loadUsers() {
  const res = await fetch("/api/users");
  users = await res.json();

  const savedId = Number(localStorage.getItem("kudos-current-user-id"));
  currentUserId = users.find((u) => u.id === savedId) ? savedId : users[0]?.id;

  currentUserSelect.innerHTML = users
    .map((u) => `<option value="${u.id}">${u.name}${u.is_admin ? " (admin)" : ""}</option>`)
    .join("");
  currentUserSelect.value = String(currentUserId);

  recipientSelect.innerHTML = users
    .map((u) => `<option value="${u.id}">${u.name}</option>`)
    .join("");

  updateAdminVisibility();
}

function updateAdminVisibility() {
  const current = users.find((u) => u.id === currentUserId);
  const isAdmin = Boolean(current && current.is_admin);
  adminPanel.hidden = !isAdmin;
  if (isAdmin) loadAdminKudos();
}

currentUserSelect.addEventListener("change", (e) => {
  currentUserId = Number(e.target.value);
  localStorage.setItem("kudos-current-user-id", String(currentUserId));
  updateAdminVisibility();
});

messageInput.addEventListener("input", () => {
  charCount.textContent = String(messageInput.value.length);
});

kudosForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  formError.hidden = true;

  const res = await fetch("/api/kudos", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({
      recipient_id: Number(recipientSelect.value),
      message: messageInput.value,
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    formError.textContent = body.error || "Couldn't send that kudos. Try again.";
    formError.hidden = false;
    return;
  }

  messageInput.value = "";
  charCount.textContent = "0";
  loadFeed();
});

async function loadFeed() {
  const res = await fetch("/api/kudos");
  const items = await res.json();

  feedEmpty.hidden = items.length > 0;
  feedList.innerHTML = items
    .map(
      (k) => `
      <li>
        <div class="kudos-line"><strong>${k.sender_name}</strong> → <strong>${k.recipient_name}</strong></div>
        <p class="kudos-message">${escapeHtml(k.message)}</p>
        <div class="kudos-meta">${timeAgo(k.created_at)}</div>
      </li>`
    )
    .join("");
}

async function loadAdminKudos() {
  const res = await fetch("/api/admin/kudos", { headers: authHeaders() });
  if (!res.ok) {
    adminList.innerHTML = `<li>Couldn't load admin data.</li>`;
    return;
  }
  const items = await res.json();

  adminList.innerHTML = items
    .map((k) => {
      const isVisible = Boolean(k.is_visible);
      return `
      <li class="${isVisible ? "visible-item" : "hidden-item"}" data-id="${k.id}">
        <div class="kudos-line"><strong>${k.sender_name}</strong> → <strong>${k.recipient_name}</strong></div>
        <p class="kudos-message">${escapeHtml(k.message)}</p>
        <div class="kudos-meta">${timeAgo(k.created_at)} · ${isVisible ? "Visible" : "Hidden"}</div>
        ${
          !isVisible && k.reason_for_moderation
            ? `<div class="moderation-note">Hidden by ${k.moderated_by_name || "an admin"}: ${escapeHtml(k.reason_for_moderation)}</div>`
            : ""
        }
        <div class="admin-actions">
          ${
            isVisible
              ? `<button class="hide-btn" data-action="hide" data-id="${k.id}">Hide</button>`
              : `<button class="unhide-btn" data-action="unhide" data-id="${k.id}">Unhide</button>`
          }
          <button class="delete-btn" data-action="delete" data-id="${k.id}">Delete</button>
        </div>
      </li>`;
    })
    .join("");
}

adminList.addEventListener("click", async (e) => {
  const button = e.target.closest("button[data-action]");
  if (!button) return;

  const { action, id } = button.dataset;

  if (action === "hide") {
    const reason = prompt("Why is this kudos being hidden? (optional)") || "";
    await fetch(`/api/admin/kudos/${id}/hide`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ reason_for_moderation: reason }),
    });
  } else if (action === "unhide") {
    await fetch(`/api/admin/kudos/${id}/unhide`, { method: "PATCH", headers: authHeaders() });
  } else if (action === "delete") {
    if (!confirm("Permanently delete this kudos? This can't be undone.")) return;
    await fetch(`/api/admin/kudos/${id}`, { method: "DELETE", headers: authHeaders() });
  }

  loadAdminKudos();
  loadFeed();
});

refreshButton.addEventListener("click", loadFeed);

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

(async function init() {
  await loadUsers();
  await loadFeed();
})();

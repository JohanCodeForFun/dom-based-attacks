const API = "http://localhost:3000";
let currentUser = null;
let safeRender = false;

const el = (id) => document.getElementById(id);
const cols = {
  todo: el("col-todo"),
  doing: el("col-doing"),
  done: el("col-done"),
};

function msg(text, bad = false) {
  const m = el("msg");
  m.textContent = text;
  m.className = bad ? "error" : "ok";
}

// ----- Auth -----
async function doLogin(path) {
  const u = el("u").value.trim();
  const p = el("p").value;
  if (!/^[a-z0-9_]{3,32}$/i.test(u)) return msg("Bad username", true);
  try {
    const res = await fetch(API + path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: u, password: p }),
    });
    const data = await res.json();
    if (!res.ok) return msg(data.message || "Login failed", true);
    currentUser = data.token || u; // demo only
    localStorage.setItem("token", currentUser);
    el("who").textContent = `— logged in as ${currentUser}`;
    el("loginCard").classList.add("hidden");
    el("appCard").classList.remove("hidden");
    await refreshTasks();
  } catch (e) {
    msg("Network error", true);
  }
}

function doLogout() {
  localStorage.removeItem("token");
  currentUser = null;
  el("appCard").classList.add("hidden");
  el("loginCard").classList.remove("hidden");
  el("who").textContent = "";
}

// On page load, check for token
window.addEventListener("DOMContentLoaded", () => {
  const token = localStorage.getItem("token");
  if (token) {
    currentUser = token;
    el("who").textContent = `— logged in as ${currentUser}`;
    el("loginCard").classList.add("hidden");
    el("appCard").classList.remove("hidden");
    refreshTasks();
  }
  // Attach logout button event if present
  const logoutBtn = el("logoutBtn");
  if (logoutBtn) logoutBtn.addEventListener("click", doLogout);

  // Restore safeRender toggle state
  const safeToggle = el("safeToggle");
  const savedSafe = localStorage.getItem("safeRender");
  if (safeToggle) {
    safeRender = savedSafe === "1";
    safeToggle.checked = safeRender;
  }
});
el("loginBtn").addEventListener("click", () => doLogin("/api/login"));
el("loginVulnBtn").addEventListener("click", () =>
  doLogin("/api/login-vulnerable")
);

// ----- Tasks -----
async function refreshTasks() {
  if (!currentUser) return;
  const res = await fetch(
    `${API}/api/tasks?username=${encodeURIComponent(currentUser)}`
  );
  const data = await res.json();
  Object.values(cols).forEach((c) => (c.innerHTML = ""));
  (data.tasks || []).forEach((t) => appendTask(t));
}

async function addTask() {
  const payload = {
    username: currentUser,
    title: el("tTitle").value.trim(),
    description: el("tDesc").value, // intentionally un-sanitized; DOM-XSS is on render
    status: el("tStatus").value,
  };
  if (!payload.title) return setSaveMsg("Title required", true);
  const res = await fetch(API + "/api/tasks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) return setSaveMsg(data.message || "Error", true);
  appendTask(data.task, true);
  el("tTitle").value = "";
  el("tDesc").value = "";
  setSaveMsg("Saved");
}
function setSaveMsg(text, bad = false) {
  const m = el("saveMsg");
  m.textContent = text;
  m.className = bad ? "error" : "muted";
  setTimeout(() => {
    m.textContent = "";
  }, 1500);
}
el("addTaskBtn").addEventListener("click", addTask);

// Toggle safe renderer
el("safeToggle").addEventListener("change", (e) => {
  safeRender = e.target.checked;
  localStorage.setItem("safeRender", safeRender ? "1" : "0");
  refreshTasks();
});

// ----- Rendering (unsafe vs safe) -----
function appendTask(task, toTop = false) {
  const container = cols[task.status] || cols.todo;
  const card = document.createElement("div");
  card.className = "task";
  const title = document.createElement("div");
  title.className = "title";
  title.textContent = task.title;

  const desc = document.createElement("div");
  desc.className = "desc";

  if (safeRender) {
    // ✅ SAFE: treat description as text, not HTML
    desc.textContent = task.description;
  } else {
    // ❌ VULNERABLE: render as HTML (DOM-based XSS demo)
    // e.g., <img src=x onerror=alert('XSS')>
    desc.innerHTML = task.description;
  }

  const actions = document.createElement("div");
  actions.className = "bar";
  const left = document.createElement("button");
  left.className = "ghost";
  left.textContent = "←";
  const right = document.createElement("button");
  right.className = "ghost";
  right.textContent = "→";

  left.onclick = () => move(task, -1);
  right.onclick = () => move(task, +1);

  actions.append(left, right);

  card.append(title, desc, actions);
  if (toTop && container.firstChild)
    container.insertBefore(card, container.firstChild);
  else container.appendChild(card);
}

async function move(task, dir) {
  const order = ["todo", "doing", "done"];
  const idx = order.indexOf(task.status);
  const next = order[idx + dir];
  if (!next) return;
  // Update backend then refresh
  await fetch(`${API}/api/tasks/${task.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: next }),
  });
  await refreshTasks();
}

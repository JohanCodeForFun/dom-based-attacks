# Project Kanban: Security Demo

This project is an educational Kanban board app designed to demonstrate three common web security issues:

- **SQL Injection (SQLi)**
- **CORS (Cross-Origin Resource Sharing)**
- **DOM-based XSS (Cross-Site Scripting)**

## Educational Purpose Only

This project is for learning and demonstration. Do **not** use these vulnerabilities in production code!

Use this project responsibly and refrain from any harmful, unauthorized, or illegal activities against any systems or users.

## Getting Started

1. **Install dependencies**
   ```sh
   cd server
   npm install
   ```
2. **Start the server**
   ```sh
   npm start
   ```
   The API will run at http://localhost:3000
3. **Open the client**
   Open `client/index.html` in your browser (use Live Server or similar for CORS to work).

---

## Default Users

- `alice` / `wonderland` (admin)
- `bob` / `builder` (user)
- `charlie` / `chocolate` (user)

---

## 1. SQL Injection (SQLi)

The app has two login endpoints:

- **Safe login** (`/api/login`): uses parameterized queries (not vulnerable)
- **Vulnerable login** (`/api/login-vulnerable`): uses string concatenation (vulnerable to SQLi)

### Demo: Bypass Login with SQLi

- Click **Login (vulnerable SQL)**
- Use this as username:
  ```
  ' OR 1=1 --
  ```
- Use any password.
- You will be logged in as the first user in the database (SQLi bypass).

---

## 2. CORS (Cross-Origin Resource Sharing)

- The backend uses CORS to allow requests from `localhost:5500` and `127.0.0.1:5500` (for Live Server).
- Try making API requests from other origins and see them fail due to CORS policy.
- This demonstrates how CORS protects APIs from unauthorized cross-origin requests.

---

## 3. DOM-based XSS

- Task descriptions are rendered **unsafely** by default using `innerHTML` (toggle to safe mode to use `textContent`).
- You can inject JavaScript payloads into the description field to execute code in the browser.

### Demo: Fetch and Display Data from a Public API

Paste this payload into the task description (with unsafe rendering enabled):

```html
<img
  src="x"
  onerror="
fetch('https://collectionapi.metmuseum.org/public/collection/v1/objects/1')
  .then(r => r.json())
  .then(d => {
    document.body.insertAdjacentHTML('beforeend', '<div style='color:blue'>Met Title: ' + d.title + '</div>');
  });
"
/>
```

- This will fetch and display the title of an artwork from the Met Museum API.
- Try other payloads to see the risks of DOM-based XSS.

---

## Resetting the Database

- The database is in-memory and resets every time you restart the server.
- To reset: stop the server (`Ctrl+C`) and start it again (`npm start`).

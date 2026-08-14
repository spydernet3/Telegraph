# 📝 Telegraph-Style Editor

A minimal, **Telegra.ph-inspired** writing app that runs entirely in the browser — **no server, no database, no backend**. Write a rich article, hit **Publish**, and share a single link. The whole article is packed *inside the URL*, so anyone who opens it can read it.

Perfect for hosting free on **GitHub Pages**.

---

## ✨ Features

- **Clean, distraction-free editor** — Title, Author, and Story fields, just like Telegra.ph.
- **Selection formatting toolbar** (appears when you highlight text), laid out in two rows:
  - **Bold, Italic, Underline, Strikethrough, Link, Heading, Subheading, Quote, Code**
  - **Bullet list, Numbered list, Align (left/center/right), Text color, Highlight color, Divider, Table, Clear formatting**
- **Quote → pull-quote toggle** — tap the quote button again for a centered pull-quote style.
- **Dividers** — choose **solid**, **dashed**, or **double** line from a popover.
- **Tables** — insert custom rows × columns; remove them with the **✕** button or backspace when empty.
- **Media upload** 📷 — add images/videos (embedded directly into the article).
- **Embed** `<>` — paste a YouTube URL or link to embed content.
- **Password-protected "Subscribe to view" blocks** 🔒 — show a preview and hide the rest behind a password.
- **✕ Remove buttons** on tables and locked blocks for easy deletion.
- **Serverless Publish** — generates a shareable link containing the compressed article.
- **Edit after publish** — reopen a published article back into the editor and re-publish.

---

## 🚀 Host it on GitHub Pages (free)

1. **Create a new repository** on GitHub (e.g. `telegraph-editor`).
2. **Upload the file** and make sure it is named **`index.html`** in the repo **root**.
   > ⚠️ The file *must* be called `index.html`, otherwise GitHub Pages shows only the repo name.
3. Go to **Settings → Pages**.
4. Under **Build and deployment**, set:
   - **Source:** `Deploy from a branch`
   - **Branch:** `main`  •  **Folder:** `/ (root)`
5. Click **Save** and wait ~1 minute.
6. Your site goes live at:
   ```
   https://<your-username>.github.io/<repo-name>/
   ```

---

## 🖊️ How to use

1. Open your published site.
2. Tap the fields to write your **Title**, **name**, and **story**.
3. **Highlight text** to reveal the formatting toolbar.
4. Use the 📷 / `<>` / 🔒 icons on an empty line to add media, embeds, or a password block.
5. Press **PUBLISH**.
6. **Copy the link** and share it anywhere — WhatsApp, Telegram, X, email, etc.
7. Anyone who opens the link sees a clean, read-only version of your article.

---

## ✏️ Editing a published article

- Open your published link — an **✏️ Edit** bar appears at the bottom.
- Tap **Edit** to load the article back into the editor.
- Make changes and press **PUBLISH** again to get an updated link.

---

## ⚙️ How it works

- The article (HTML) is serialized to JSON and **gzip-compressed** using the browser's `CompressionStream` API.
- The compressed data is **Base64URL-encoded** and stored in the URL hash: `#read=...`.
- Opening a `#read=` link decodes and renders the article in **read-only mode**.
- Because everything lives in the link, **no server or storage is required**.

---

## ⚠️ Limitations

- **Links can be long.** Uploaded images are embedded as data — keep photos small for shareable links.
- **Password blocks are casual gating only.** Since the content is inside the URL, hidden text is **not cryptographically secure**. Use it for "subscribe to view" teasers, not confidential data.
- **No true recall.** A link you already shared can't be deleted from the internet — anyone who saved it can still open it.
- Best viewed on modern browsers that support `CompressionStream` (Chrome, Edge, Brave, recent Firefox/Safari). A plain fallback is included for older browsers.

---

## 📄 License

Free to use and modify. Attribution appreciated but not required.

---

> Made as a lightweight, self-hostable alternative to Telegra.ph. 💛

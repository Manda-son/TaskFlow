# Deploying & Testing TaskFlow

Since TaskFlow is a static web app (HTML/CSS/JS only), you have multiple easy ways to test it on your phone or share it with others. Here are the two main methods:

## Option 1: Running Locally (Fastest for testing)
**Best for**: Quick checks on your own Wi-Fi. No internet needed.

1.  **Open your terminal** in the project folder.
2.  **Start a local server**:
    ```bash
    python3 -m http.server
    ```
    *(Or if you have Node.js installed: `npx http-server`)*

3.  **Find your computer's IP address**:
    *   **Linux/Mac**: Run `ifconfig` in a new terminal tab. Look for `inet` followed by numbers like `192.168.1.X`.
    *   **Windows**: Run `ipconfig`.

4.  **Open on your phone**:
    *   Make sure your phone is on the **same Wi-Fi** as your computer.
    *   Type the IP and port into your phone's browser:
        `http://YOUR_COMPUTER_IP:8000` 
        (Example: `http://192.168.1.45:8000`)

---

## Option 2: GitHub Pages (Best for sharing)
**Best for**: Permanent link, sharing with friends, always online.

1.  **Go to your GitHub Repo**: [https://github.com/Manda-son/TaskFlow](https://github.com/Manda-son/TaskFlow)
2.  Click **Settings** (top tab).
3.  Scroll down to **Pages** (on the left sidebar).
4.  Under **Build and deployment** -> **Source**, select **Deploy from a branch**.
5.  Under **Branch**, select `main` and ensure the folder is `/ (root)`.
6.  Click **Save**.

**Wait 1-2 minutes**, refresh the page, and GitHub will show you your live link at the top (usually `https://manda-son.github.io/TaskFlow`).

---

## Note on "Add to Home Screen"
Since you added the PWA meta tags in `index.html`:
1.  Open TaskFlow on your phone (Safari on iOS, Chrome on Android).
2.  Tap the **Share** button (iOS) or **Menu** dots (Android).
3.  Tap **"Add to Home Screen"**.
4.  It will look and feel like a native app without the browser bar!

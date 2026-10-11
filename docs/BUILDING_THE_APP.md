# Putting Nook on your phone as a real app

Right now you run Nook inside **Expo Go**, a stand-in app. That's why the home-screen icon is Expo's, and why
real push notifications can't work. A **development build** is Nook as its own app, with its own icon, that you
install on your phone. It works like Expo Go while you're building: you start the dev server on your computer and
the app loads from it.

Nothing here changes how Nook works. You only do this once (and again whenever we add a new native package).

## What you need

| Thing | Cost | Needed for |
|---|---|---|
| An **Expo account** (expo.dev) | Free | Building in the cloud (you don't need a Mac) |
| An **Apple Developer account** | **$99 / year** | Putting an app on an iPhone. Apple requires it; there's no way around it |
| An Android phone | — | Optional. Android builds are free and need no Google account to install on your own phone |

Your icon is already set up (a cozy fireplace in an arch). The one thing to decide: the **app ID** in
[app.json](../app.json) is `app.mynookapp.nook`. It's the app's permanent name inside Apple and Google. **It can
be changed any time before your first build, but not after the app is published.** If you buy a domain for sign-in
emails, many people use it backwards as the app ID (e.g. `com.yourdomain.nook`). Tell me and I'll change it.

## Step 1 — Free setup (about 10 minutes)

1. Make a free account at **expo.dev**.
2. In the terminal, in the Nook folder:
   ```
   npx eas-cli login
   npx eas-cli init
   ```
   `init` connects this project to your Expo account. It adds a project ID to `app.json` — tell me when it has,
   and I'll save that change.
3. Give the cloud builder your Supabase details (it can't see your private `.env` file). On expo.dev open your
   **Nook project → Environment variables → Create**, and add these two, with **Visibility: Plain text** and **all
   three environments ticked** (development, preview, production):
   - `EXPO_PUBLIC_SUPABASE_URL` — the same value as in your `.env`
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY` — the same value as in your `.env`

   (The anon key is meant to be public — it's inside every app. Never add your **service_role** key or your Resend
   key here.)

## Step 2 — Android (free, optional, good for practice)

```
npx eas-cli build --profile development --platform android
```
It takes about 10–20 minutes in the cloud. When it finishes you get a link; open it on your Android phone to
install. If you want to see what a build feels like before paying Apple, start here.

## Step 3 — iPhone

1. **Join the Apple Developer Program** at developer.apple.com/programs ($99/year). Approval can take from a few
   minutes to a couple of days.
2. Tell Apple about your iPhone, so it's allowed to run your app:
   ```
   npx eas-cli device:create
   ```
   It shows a link or QR code. Open it on your iPhone and install the little profile it offers. (You'll need
   **Developer Mode** on: iPhone Settings → Privacy & Security → Developer Mode. It restarts the phone.)
3. Build:
   ```
   npx eas-cli build --profile development --platform ios
   ```
   It will ask you to sign in to your Apple account and say yes to creating certificates — answer **yes** to each
   one. Wait about 15–25 minutes. You get a link; open it on your iPhone to install **Nook** with its new icon.
4. Each day, start the dev server and open the Nook app (not Expo Go):
   ```
   npx expo start --dev-client
   ```

## Later: TestFlight (so family can install it)

When Nook is ready for family, the **production** profile builds the real thing, and Apple's **TestFlight** lets you
invite family to install it with a link — no cables, no developer accounts for them:
```
npx eas-cli build --profile production --platform ios
npx eas-cli submit --platform ios
```
Before that: sign-in emails must reach family (Q-023) and we need account deletion (Q-020), which Apple requires.

## Until then: the icon on your home screen

You can still use the new icon right now with the Shortcuts trick from earlier — use `assets/icon.png` as the
picture.

## If something goes wrong

Copy the error text from the terminal (or the build page on expo.dev) and send it to me. Build errors almost always
say exactly what's missing.

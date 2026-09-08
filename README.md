# Kudos

An internal tool for giving colleagues kudos, with admin moderation. Built from
[`SPECIFICATION.md`](./SPECIFICATION.md) using a spec-driven development process.

## Running it locally

You need [Node.js](https://nodejs.org) installed (v18 or newer). That's it —
there is no separate database to install or start. This project uses SQLite,
which stores all data in a single file (`kudos.db`) that gets created
automatically the first time you run the server.

```bash
# 1. Install dependencies (only needs to be done once)
npm install

# 2. Start the app
npm start
```

Then open **http://localhost:3000** in your browser.

The first run automatically creates `kudos.db` and seeds it with 4 sample
users (one of them, Alex Chen, is an admin) and a few sample kudos.

## Trying it out

- Use the **"Acting as"** dropdown (top right) to switch between users —
  this simulates being logged in as different people, since a full login
  system is out of scope for this exercise.
- Pick **Alex Chen** to see the **Admin: moderate kudos** section appear at
  the bottom of the page, where you can hide, unhide, or permanently delete
  any kudos.
- Regular users never see the admin section, and the server independently
  re-checks admin status on every admin request — it doesn't just trust the
  browser.

## Resetting the data

Stop the server, delete `kudos.db`, and run `npm start` again — a fresh
database with the original seed data will be created.

## Project structure

```
server.js       Express app + all API routes
db.js           SQLite setup, schema, and seed data
public/         Frontend (plain HTML/CSS/JS, no build step)
SPECIFICATION.md  The approved requirements + technical design
```

# Orange Countlandia Congress

A live voting app for the Articles of Confederation / Constitution simulation. Students
log in as their state (tap the state, then enter that delegation's passcode) on their
own device, read their public profile and private dossier, debate and propose
amendments, and vote. You run a presenter screen you can project, showing results
update live and handling the procedural moves (opening votes, switching from the
Articles to the Constitution, signing or vetoing bills).

It ships pre-loaded with your Orange Countlandia states and the National Railway Act
(all three options), so it works out of the box. Everything is editable **right from
the presenter screen** -- state profiles, dossiers, bills, and legislative options --
see **Editing content from the presenter screen** below. Editing `seed.js` by hand
still works too, if you'd rather script a whole new unit.

Every file in this project sits flat in one folder -- there are no subfolders at all.
That's deliberate: GitHub's basic "upload files" page doesn't reliably preserve
folder structure (dragging individual files in flattens them, and that's fine here
because there's nothing to flatten).

## What it gets right procedurally

- **Articles of Confederation mode**: one vote per state, 9 of 13 needed to pass (you
  can also pick a simple majority or unanimous threshold for other votes).
- **Constitution mode**: a real bicameral vote from the same single ballot each state
  casts -- it's tallied both as a **House** vote (seats apportioned by each state's
  population, using the same largest-remainder method the real Congress once used)
  and a **Senate** vote (one state, one vote), and a bill needs a majority in *both*
  to pass. It then goes to you as President to sign or veto, with a
  two-thirds-of-both-chambers override vote if vetoed.
- **Delegations don't vote as one bloc.** Real House delegations routinely split --
  not every seat from a state votes the same way. When a Constitution-mode vote
  closes, each state's House seats are rolled independently: a state that voted
  "yea" usually sends most, but not necessarily all, of its seats that way. How often
  a seat breaks from its state's declared position is controlled by the **Delegation
  unity** setting (Solid / Realistic / Chaotic) in the presenter screen's Congress
  Settings panel. The split is only rolled once, at the moment you close the vote --
  a live "reveal votes" preview beforehand shows a placeholder full-bloc projection,
  not the final random result, so it doesn't flicker while votes are still coming in.
  The debrief view shows the full per-state seat breakdown afterward, which is great
  material for "why didn't every seat from your state vote together?"
- **House size is adjustable and always reapportioned automatically.** Change the
  total House size, or any state's population, from the presenter screen and every
  state's seat count recalculates immediately -- nothing to hand-compute.
- **Amendments**: any state can propose one; you approve which ones come to a vote;
  adopted amendments show up in the record.
- **Public vs. private**: every state's industries/priorities are visible to everyone
  in the State Directory; each state's private dossier is only visible to that
  state's own login.
- **Each state has its own login passcode**, so students have to actually know their
  delegation's passcode to vote as that state rather than any state being a free tap.
  It's a light lock, not real security (see the limitations at the bottom), but it
  stops the obvious case of one delegation casually voting as another.
- **Bills can carry maps, reports, or other reference materials** (images or PDFs)
  that show up right on *The Floor* for students to open before they vote.
- **You can send a pop-up message to every logged-in student** ("Voting begins in 5
  minutes," "A new amendment has just been proposed," etc.) right from the presenter
  screen -- see **Messaging the class** below.

## Before you touch any code: this needs to run somewhere online

Your campus WiFi blocks device-to-device traffic, so running this on your own laptop
during class won't let students reach it. You'll need to put it on a small free
hosting service instead. The steps below get you a real `https://something.onrender.com`
link using only a web browser -- no command line required.

### 1. Put the code on GitHub (5 minutes, one time)

1. Go to [github.com](https://github.com) and create a free account if you don't have one.
2. Click **New repository**. Name it `orange-countlandia-congress`, keep it Public, and click **Create repository**.
3. On the new repo's page, click **uploading an existing file**.
4. Unzip the folder I sent you. You'll see about 10 files (`server.js`, `seed.js`,
   `index.html`, and so on) -- **no folders inside**, just files. Select all of them
   and drag them into GitHub's upload box, or use the "choose your files" link and
   select them all at once. Since there are no folders to worry about, it doesn't
   matter whether your browser preserves folder structure or not -- every file just
   needs to land in the root of the repo, which is what a plain multi-file upload
   does automatically.
5. Scroll down and click **Commit changes**.

Double-check afterward that your repo's file list shows `server.js`, `seed.js`,
`index.html`, `presenter.html`, `app.js`, `presenter.js`, `styles.css`,
`package.json`, `package-lock.json`, and `README.md` all sitting directly in the
repo (not inside a folder icon, and not one level down inside a repo named after
the zip file). If you see a folder in there, open it, select everything inside, and
move it up to the top level.

### 2. Deploy it on Render (5 minutes, one time)

1. Go to [render.com](https://render.com) and sign up for free (no credit card needed).
2. Click **New +** -> **Web Service**.
3. Connect your GitHub account and select the `orange-countlandia-congress` repo.
4. Render will detect it's a Node app. Confirm these settings:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance Type:** Free
5. Click **Create Web Service**. After a minute or two, Render gives you a link like
   `https://orange-countlandia-congress.onrender.com` -- that's your class link.

**One quirk of the free tier:** if nobody visits for 15 minutes, it goes to sleep and
takes about a minute to wake back up. So open your link yourself 5-10 minutes before
class starts to wake it up -- after that it'll respond instantly for everyone.

Whenever you want to update the content (edit `seed.js`), upload the changed file to
GitHub the same way (drag it into the repo, commit) -- Render redeploys automatically
within a minute or two.

### 3. (Optional, but recommended) Connect a free database so nothing resets between classes

Without this step, everything works fine, but with one catch: Render's free tier
spins your instance down completely after about 15 minutes with no visitors, and
spinning back up starts a fresh instance rather than resuming the old one. Since
there's almost always more than 15 minutes between class periods, that means every
vote, amendment, in-class edit, and uploaded map or report you made from the
presenter screen is gone by your next class -- you'd be starting over from `seed.js`
every single time.

This step fixes that completely -- state *and* uploaded materials both -- for free,
in about 5 minutes, one time:

1. Go to [console.upstash.com](https://console.upstash.com) and sign up for free (no
   credit card needed).
2. Click the **Redis** tab, then **Create Database**. Give it any name (e.g.
   `orange-countlandia`), pick a region close to you, and choose the free plan.
   Click **Create**.
3. On the new database's page, find the **Connect** section and click its **REST**
   tab. You'll see two values: `UPSTASH_REDIS_REST_URL` and
   `UPSTASH_REDIS_REST_TOKEN` -- hover over each to get a copy button.
4. Back in your Render dashboard, open your web service and click **Environment** in
   the left sidebar. Click **+ Add Environment Variable** twice, once for each value:
   - Key: `UPSTASH_REDIS_REST_URL` -- Value: (paste what you copied)
   - Key: `UPSTASH_REDIS_REST_TOKEN` -- Value: (paste what you copied)
5. Save. Render redeploys automatically with the new settings.

That's it -- nothing else in the app changes. From then on, every bill, vote,
passcode edit, setting, *and uploaded map or report* is saved to that free database
instead of the instance's temporary disk, so all of it survives spin-downs, restarts,
and redeploys. You can check it worked by opening `/presenter`: a small **Saved to
database** badge appears next to "Reveal votes live" in the top bar (it says
**Temporary storage** instead if the database isn't connected). Upstash's free tier
gives you 500,000 commands a month and 256MB of storage, which is far more than this
app will ever use for a class.

The one trade-off: uploaded files are stored base64-encoded inside the database
itself (there's no separate file host involved), and Upstash's free tier caps a
single request at 10MB. Base64 makes a file about a third larger, so **the per-file
limit drops from 15MB to 7MB** once the database is connected -- plenty for a map
image or a text-based PDF report, less room for a huge scanned document. Without the
database, uploads stay at the original 15MB cap (but reset on a spin-down, same as
today). See **Danger zone** below for how to wipe everything back to a clean slate on
purpose now that nothing resets on its own.

## Running it on your own computer (for previewing/editing only)

Useful for previewing changes before you upload them, not for class day.

1. Install [Node.js](https://nodejs.org) if you don't have it (the LTS installer -- next, next, finish).
2. Unzip the project folder, open a terminal in it, and run:
   ```
   npm install
   npm start
   ```
3. Open `http://localhost:3000` for the student view and `http://localhost:3000/presenter` for the presenter view (passcode below).

## Before class

- **Change the presenter passcode.** It ships set to `unitas13`. Open `seed.js`, find
  `presenterPasscode: "unitas13"`, and change it to whatever you like. Re-upload the
  file to GitHub before class.
- **Look up (or change) each state's student passcode.** Every state ships with its
  own default passcode (a plain word tied to its motto -- Anaheimland is `frontier`,
  Danaford is `gateway`, and so on; the full list is in `seed.js`, or open the
  presenter screen's **Manage states** panel, which shows each one). Change any of
  them from that same panel if you'd rather pick your own, and write up a simple
  handout or slide mapping each state to its passcode so students can log in.
- **Wake up the free instance** by opening your class link 5-10 minutes early.
- **If you set up the optional database**, open `/presenter` once after your first
  deploy and check for the green **Saved to database** badge in the top bar, just to
  confirm it's actually wired up before you rely on it.
- **Share the class link** with students (write it on the board, or make a QR code
  with any free QR generator pointed at your Render URL) along with the state
  passcode handout.
- **Open `/presenter`** on your own laptop/projector and log in with your passcode.

## Running the activity

This maps directly onto the flow you already use:

1. **Meet your state.** Students open the link, tap their state, enter that
   delegation's passcode (from your handout), and explore the *State Directory*
   (public profiles) and *My Dossier* (private) tabs.
2. **Congress is in session.** On the presenter screen, pick an option for the
   National Railway Act (or leave the Main Line Plan active) and click **Open final
   vote on this bill**. Students vote from *The Floor* tab.
3. **Let's vote.** Watch votes come in on the presenter screen (turn on **Reveal
   votes live** if you want the class to watch the count in real time, or leave it
   off for a reveal moment). Click **Close this vote & tally** when everyone's in.
4. **Debrief.** The *Debrief / History* tab on every student's device shows the full
   per-state breakdown once a vote closes -- perfect for "why did your state vote
   that way?" In Constitution mode it also shows how each state's House seats split,
   since real delegations rarely vote as one bloc.
5. **Try another option**, or let students **propose amendments** (approve the ones
   worth a vote, then open a vote on them) and run it again.
6. **Switch to the Constitution.** Click **The Constitution** in the presenter header.
   Click **Reset this bill** first if you want a clean slate. Now the same vote is
   tallied as a House-and-Senate bicameral vote, and a passing bill lands on your
   desk to sign or veto.
7. Between class sections, click **Log out all students** and **Reset this bill** to
   start fresh for the next group.

## Editing content from the presenter screen

You no longer need to touch any code to change what's in the simulation:

- **Manage states** (collapsible panel near the bottom of the presenter screen) lets
  you edit any state's name, motto, student login passcode, color, population, public
  industries/priorities, public blurb, and private dossier text, all from a form --
  click **Edit**, change what you like, and **Save**. Changing a state's population
  immediately reapportions the House in Constitution mode; nothing else needs to be
  touched. Each state's current passcode is also shown right on its tile (no need to
  click Edit) so you can quickly read off the full list for a handout.
- **Edit bill** (on the active bill's card) lets you rewrite its title and summary,
  and add, edit, or delete its legislative options (name, description, cost, and
  which states each option serves) -- all live, between votes. **+ New bill** still
  works the same way for spinning up a bill with no options at all, handy for
  drafting something live with the class.
- **Congress settings** lets you change the total House size and the **Delegation
  unity** setting that controls how often individual House seats break from their
  state's declared position in Constitution mode (see above).
- **Materials**, inside **Edit bill**, lets you upload maps, reports, or other
  reference images/PDFs for the active bill. Add a short label, choose a file
  (PNG, JPG, GIF, WEBP, or PDF, up to 15MB -- 7MB if you've connected the optional
  database, see above), and click **Upload** -- it shows up immediately on every
  student's *Floor* tab, and you can delete it the same way.

Changes made this way don't get written back to `seed.js` -- if you want a change to
be part of the permanent starting point for every future class, make it in `seed.js`
as described next and re-upload. Where they *do* live depends on whether you set up
the optional database above: with it connected, everything here survives restarts and
redeploys indefinitely; without it, everything lives only in that instance's temporary
`data.json` and resets whenever Render spins the instance down (which is often,
between classes -- see **Connect a free database** above).

## Customizing for a different unit from `seed.js`

For a bigger overhaul than the presenter screen's editor is meant for -- like
swapping in a whole new set of states for a different unit -- everything
content-related lives in `seed.js`:

- The `STATES` array: each state's name, motto, color, population, public profile,
  and private dossier. House seats are no longer stored here at all -- they're
  always computed automatically from population and the house-size setting, so you
  never have to keep a seat count in sync by hand.
- The `RAILWAY_OPTIONS` / `RAILWAY_BILL` objects: the specific bill this ships with.
  You can also just click **+ New bill** in the presenter screen during class to spin
  up a fresh, optionless bill (a title and summary) without touching any code at all.

After editing `seed.js` locally, re-upload it to GitHub (as a single file this time --
click into the repo, click `seed.js`, click the pencil/edit icon, paste in your
changes, and commit -- no need to re-upload everything) and Render redeploys
automatically. Note that redeploying resets any in-class edits made from the
presenter screen back to whatever `seed.js` says.

## Messaging the class

Near the top of the presenter screen is a **Message the class** box. Type
something -- "A new amendment has just been proposed," "Voting will commence in 5
minutes," "Class is starting, log in now" -- and click **Send to all students**. It
pops up as a full-screen message on every student's device (they'll see it within a
couple of seconds, even mid-vote or mid-typing), and they click **Dismiss** to clear
it and get back to the app. Each student only has to dismiss it once -- it won't
reappear for them on that device even if they refresh. **Clear current message**
takes it down for anyone who hasn't seen it yet (handy if you sent it by mistake or
it's no longer relevant). Sending a new message always replaces whatever's currently
showing.

## Starting over: the Danger zone

If you connected the optional database above, state no longer resets on its own
between classes -- which is the point, but it also means there's no more "just wait
for Render to restart it" way back to a clean slate for a new semester. A red
**Danger zone** card near the bottom of the presenter screen has a **Factory reset
everything** button for exactly that: it wipes every state, bill, vote, amendment,
uploaded material, and passcode back to precisely what `seed.js` currently says, and
logs out every student (your own presenter login stays active, so you're not booted
out along with everyone else). There's a confirmation prompt because there's no undo.
If you're running on temporary storage without the database, you don't really need
this button -- a spin-down does the same thing for you -- but it's there either way.

## A couple of honest limitations

- State passcodes are a light lock, not real security: there's no limit on login
  attempts, so someone with the class link and enough patience could eventually guess
  a short, simple passcode. They're meant to stop the casual case (a delegation
  absent-mindedly tapping the wrong state, or the obvious troll move of voting as
  someone else), not a determined attacker. Don't reuse a real password as a state's
  passcode, and treat the whole thing as classroom-appropriate rather than genuinely
  secure.
- The free Render tier's disk is temporary: if the service redeploys or restarts
  between class sessions, anything living only on that disk resets to whatever's in
  `seed.js`. If you connected the optional free database (see above), that no longer
  applies to anything -- votes, amendments, passcodes, other in-class edits, and
  uploaded materials are all safe, since materials are stored in that same database
  rather than on disk. Without the database, everything (including materials) still
  resets on a spin-down as before; keep your own copy of any map or report and
  re-upload it if it disappears. Either way, if a bill ever does end up remembering a
  file that's genuinely gone, the app notices and quietly drops the reference rather
  than showing students a dead link.
- With the database connected, uploaded files are capped at 7MB instead of 15MB (see
  **Connect a free database** above for why) -- plenty for a typical map or report,
  but worth knowing if you're used to the larger limit.
- There's a brief window -- a fraction of a second -- after any action where, if the
  server crashed at that exact instant before the save reached the database, that one
  action could be lost. In practice this basically never comes up in a live class; it's
  worth knowing about rather than worth worrying about.
- The browser tab icon is a plain orange (🍊), just for a friendly touch -- nothing
  to configure there.

const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const multer = require("multer");
const { createInitialState, STATES: SEED_STATES } = require("./seed");

const DATA_FILE = path.join(__dirname, "data.json");
const PORT = process.env.PORT || 3000;

// ---------------------------------------------------------------------------
// Persistence: two modes.
//
//   - "database" -- if UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are
//     set (as Render environment variables), the whole state is stored as one
//     JSON blob in a free Upstash Redis database, over its plain HTTP REST
//     API (no client library needed -- just fetch). This survives Render's
//     free-tier instance spinning down between classes, which local disk
//     does not. Uploaded bill materials (maps, reports) go to the SAME
//     database in this mode too -- each file base64-encoded under its own
//     key -- so they survive restarts as well. Upstash's free tier caps a
//     single request at 10MB, and base64 inflates a file by about a third,
//     so the per-file limit is lower in this mode (7MB) than in file mode.
//   - "file" -- otherwise, falls back to the original behavior: state lives
//     in data.json and uploads live in uploads/, both next to this file.
//     Fine for local previewing, but everything resets whenever the Render
//     instance restarts (see the README).
//
// Either way the rest of this file just calls save() after a state mutation,
// or the attachment helpers below after an upload/delete, and never touches
// the storage details directly.
// ---------------------------------------------------------------------------
const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const PERSISTENCE_MODE = UPSTASH_URL && UPSTASH_TOKEN ? "database" : "file";
const REDIS_STATE_KEY = "orange-countlandia-state";

// ---------------------------------------------------------------------------
// Uploaded bill materials (maps, reports).
// ---------------------------------------------------------------------------
const UPLOADS_DIR = path.join(__dirname, "uploads");
fs.mkdirSync(UPLOADS_DIR, { recursive: true });
const ALLOWED_UPLOAD_MIME = ["image/png", "image/jpeg", "image/gif", "image/webp", "application/pdf"];
const MAX_UPLOAD_BYTES = PERSISTENCE_MODE === "database" ? 7 * 1024 * 1024 : 15 * 1024 * 1024;
const MAX_UPLOAD_LABEL = MAX_UPLOAD_BYTES >= 1024 * 1024 ? `${Math.round(MAX_UPLOAD_BYTES / (1024 * 1024))}MB` : `${Math.round(MAX_UPLOAD_BYTES / 1024)}KB`;
const upload = multer({
  // In database mode the file needs to end up in memory so it can be
  // base64-encoded and sent to Upstash; in file mode it goes straight to
  // disk, same as before.
  storage:
    PERSISTENCE_MODE === "database"
      ? multer.memoryStorage()
      : multer.diskStorage({
          destination: UPLOADS_DIR,
          filename: (req, file, cb) => {
            const ext = path.extname(file.originalname || "").toLowerCase().slice(0, 10);
            cb(null, crypto.randomBytes(12).toString("hex") + ext);
          },
        }),
  limits: { fileSize: MAX_UPLOAD_BYTES },
  fileFilter: (req, file, cb) => cb(null, ALLOWED_UPLOAD_MIME.includes(file.mimetype)),
});

function attachmentRedisKey(storedKey) {
  return `orange-countlandia-attachment:${storedKey}`;
}

// Stores one file's bytes and returns the `storedFilename`-equivalent key to
// remember on the attachment record. In file mode this is multer's own job
// (see `upload` above) -- this function only runs in database mode.
async function saveAttachmentBytes(buffer, ext) {
  const key = crypto.randomBytes(12).toString("hex") + ext;
  const res = await fetch(`${UPSTASH_URL}/set/${attachmentRedisKey(key)}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${UPSTASH_TOKEN}`, "Content-Type": "text/plain" },
    body: buffer.toString("base64"),
  });
  if (!res.ok) throw new Error(`Upstash SET failed: ${res.status}`);
  return key;
}

async function readAttachmentBytes(storedKey) {
  const res = await fetch(`${UPSTASH_URL}/get/${attachmentRedisKey(storedKey)}`, {
    headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
  });
  if (!res.ok) throw new Error(`Upstash GET failed: ${res.status}`);
  const body = await res.json();
  if (!body || typeof body.result !== "string") return null;
  return Buffer.from(body.result, "base64");
}

async function deleteAttachmentBytes(storedKey) {
  await fetch(`${UPSTASH_URL}/del/${attachmentRedisKey(storedKey)}`, {
    headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
  }).catch(() => {}); // best-effort, same spirit as the local fs.unlink cleanup
}

// One entry point for removing an attachment's underlying bytes, used by both
// the delete-attachment route and factory-reset, so neither has to know which
// storage mode is active.
async function deleteAttachmentFile(attachment) {
  if (PERSISTENCE_MODE === "database") {
    await deleteAttachmentBytes(attachment.storedFilename);
  } else {
    await fs.promises.unlink(path.join(UPLOADS_DIR, attachment.storedFilename)).catch(() => {});
  }
}

async function loadState() {
  if (PERSISTENCE_MODE === "database") {
    try {
      const res = await fetch(`${UPSTASH_URL}/get/${REDIS_STATE_KEY}`, {
        headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
      });
      if (!res.ok) throw new Error(`Upstash GET failed: ${res.status}`);
      const body = await res.json();
      if (body && typeof body.result === "string") {
        return JSON.parse(body.result);
      }
      return createInitialState(); // key doesn't exist yet -- first run
    } catch (err) {
      console.error("Could not reach the database, starting from a fresh seed instead:", err.message);
      return createInitialState();
    }
  }
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  } catch {
    return createInitialState();
  }
}

// Saves are chained (never run two at once) so a slower network write can't
// finish out of order and clobber a newer one with stale data. Each save
// reads whatever `state` looks like at the moment it actually runs, so
// mutations that land while a save is already in flight are never lost --
// they just ride along on the next write in the chain.
let saveChain = Promise.resolve();
function save() {
  saveChain = saveChain.then(persistNow).catch((err) => {
    console.error("Failed to persist state:", err.message);
  });
}

async function persistNow() {
  const json = JSON.stringify(state);
  if (PERSISTENCE_MODE === "database") {
    const res = await fetch(`${UPSTASH_URL}/set/${REDIS_STATE_KEY}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${UPSTASH_TOKEN}`, "Content-Type": "text/plain" },
      body: json,
    });
    if (!res.ok) throw new Error(`Upstash SET failed: ${res.status}`);
    return;
  }
  await fs.promises.writeFile(DATA_FILE, JSON.stringify(state, null, 2));
}

// Fields added after the first release -- backfill so an older saved state
// (from either storage mode) still works.
function backfillState() {
  if (!state.houseSizeTarget) state.houseSizeTarget = 50;
  if (!state.delegationUnity) state.delegationUnity = "realistic";
  // A saved state from before student passcodes existed won't have one per
  // state -- fall back to that state's passcode from seed.js (or its id) so
  // nobody gets permanently locked out after an upgrade.
  for (const seedState of SEED_STATES) {
    const s = state.states[seedState.id];
    if (s && !s.passcode) s.passcode = seedState.passcode || seedState.id;
  }
  if (state.announcement === undefined) state.announcement = null;
  for (const bill of Object.values(state.bills)) {
    if (!bill.attachments) bill.attachments = [];
  }
}

// In file mode, state can persist (if it happens to survive) while uploads/
// doesn't -- Render's disk resets uploads/ far more casually than a database
// key ever disappears. Drop any attachment whose actual file is gone so
// students see a clean Floor tab instead of a broken image/PDF link. Only
// relevant to file mode: in database mode the bytes live right alongside the
// state that references them, so there's nothing to self-heal here.
function pruneMissingAttachments() {
  if (PERSISTENCE_MODE === "database") return;
  let removed = 0;
  for (const bill of Object.values(state.bills)) {
    if (!bill.attachments || !bill.attachments.length) continue;
    const kept = bill.attachments.filter((a) => {
      const exists = fs.existsSync(path.join(UPLOADS_DIR, a.storedFilename));
      if (!exists) removed++;
      return exists;
    });
    bill.attachments = kept;
  }
  if (removed) console.log(`Pruned ${removed} attachment(s) whose file didn't survive a restart.`);
}

let state;
async function bootstrap() {
  state = await loadState();
  backfillState();
  pruneMissingAttachments();
  save();
  app.listen(PORT, () => {
    console.log(`Orange Countlandia Congress is running on port ${PORT}`);
    console.log(
      `Storage: ${
        PERSISTENCE_MODE === "database"
          ? "external database (Upstash) -- state AND uploaded materials both persist"
          : "local file (data.json + uploads/) -- resets on restart"
      }`
    );
    console.log(`Student view:   http://localhost:${PORT}/`);
    console.log(`Presenter view: http://localhost:${PORT}/presenter  (passcode: ${state.presenterPasscode})`);
  });
}

// ---------------------------------------------------------------------------
// House apportionment -- seats are ALWAYS derived from current population,
// Hamilton (largest-remainder) method with a guaranteed floor of 1 seat per
// state. Editing a state's population in the content editor immediately
// reapportions the House on the next read; nothing else to update by hand.
// ---------------------------------------------------------------------------
function apportionSeats(stateOrder, populationById, totalSeats) {
  const ids = stateOrder;
  const n = ids.length;
  const seats = {};
  if (totalSeats <= n) {
    const sorted = [...ids].sort((a, b) => (populationById[b] || 0) - (populationById[a] || 0));
    ids.forEach((id) => (seats[id] = 0));
    sorted.slice(0, totalSeats).forEach((id) => (seats[id] = 1));
    return seats;
  }
  const totalPop = ids.reduce((sum, id) => sum + (populationById[id] || 0), 0) || 1;
  const remainingSeats = totalSeats - n;
  const quotas = {};
  const floors = {};
  let usedSeats = 0;
  for (const id of ids) {
    const q = (remainingSeats * (populationById[id] || 0)) / totalPop;
    quotas[id] = q;
    floors[id] = Math.floor(q);
    usedSeats += floors[id];
  }
  let leftover = remainingSeats - usedSeats;
  const byRemainder = ids
    .map((id) => ({ id, frac: quotas[id] - floors[id] }))
    .sort((a, b) => b.frac - a.frac);
  for (let i = 0; i < leftover; i++) floors[byRemainder[i].id]++;
  for (const id of ids) seats[id] = 1 + floors[id];
  return seats;
}

function deriveHouse() {
  const pops = {};
  for (const id of state.stateOrder) pops[id] = state.states[id].population;
  const seatsByState = apportionSeats(state.stateOrder, pops, state.houseSizeTarget);
  return { seatsByState, total: state.houseSizeTarget };
}

// ---------------------------------------------------------------------------
// Voting math
// ---------------------------------------------------------------------------
const TOTAL_STATES = 13;
const UNITY_PROBABILITY = { solid: 0.95, realistic: 0.75, chaotic: 0.55 };

function majorityOf(total) {
  return Math.floor(total / 2) + 1;
}
function twoThirdsOf(total) {
  return Math.ceil((total * 2) / 3);
}

function thresholdNeeded(mode, thresholdType, totalHouseSeats) {
  if (mode === "AOC") {
    if (thresholdType === "super9") return { states: 9 };
    if (thresholdType === "unanimous13") return { states: 13 };
    return { states: majorityOf(TOTAL_STATES) }; // majority (default)
  }
  // CONST
  if (thresholdType === "twothirds") {
    return { states: twoThirdsOf(TOTAL_STATES), seats: twoThirdsOf(totalHouseSeats) };
  }
  return { states: majorityOf(TOTAL_STATES), seats: majorityOf(totalHouseSeats) }; // simple (default)
}

// Splits one state's House delegation across yea/nay for a CLOSED vote: real
// delegations rarely vote as one bloc, so each seat is rolled independently,
// leaning toward the state's declared position by the current "delegation
// unity" setting. Abstaining states send no House vote at all.
function rollDelegation(seats, choice, unity) {
  if (choice === "abstain" || seats <= 0) return { yea: 0, nay: 0, abstain: seats };
  const p = UNITY_PROBABILITY[unity] ?? UNITY_PROBABILITY.realistic;
  let matching = 0;
  for (let i = 0; i < seats; i++) {
    if (Math.random() < p) matching++;
  }
  const dissenting = seats - matching;
  return choice === "yea" ? { yea: matching, nay: dissenting, abstain: 0 } : { yea: dissenting, nay: matching, abstain: 0 };
}

// `finalizeHouse: true` (only ever used once, at the moment a round CLOSES)
// rolls each state's delegation and that becomes the permanent, stored
// result. Any other read (an open round's live-reveal preview) must stay
// deterministic across repeated polls, so it shows a "projected" House count
// -- each voting state's full bloc -- with no randomness yet.
function computeTally(round, { finalizeHouse = false } = {}) {
  const votes = round.votes || {};
  let yea = 0,
    nay = 0,
    abstain = 0;
  for (const sid of state.stateOrder) {
    const v = votes[sid];
    if (v === "yea") yea++;
    else if (v === "nay") nay++;
    else if (v === "abstain") abstain++;
  }
  const house = deriveHouse();
  const needed = thresholdNeeded(round.mode, round.thresholdType, house.total);

  if (round.mode === "AOC") {
    return {
      mode: "AOC",
      yea,
      nay,
      abstain,
      totalStates: TOTAL_STATES,
      neededStates: needed.states,
      passed: yea >= needed.states,
    };
  }

  let houseYeaSeats = 0,
    houseNaySeats = 0,
    houseAbstainSeats = 0;
  const houseBreakdown = {};
  for (const sid of state.stateOrder) {
    const v = votes[sid];
    const seats = house.seatsByState[sid] || 0;
    if (!v) {
      houseBreakdown[sid] = { seats, yea: 0, nay: 0, abstain: 0, voted: false };
      continue;
    }
    const split = finalizeHouse
      ? rollDelegation(seats, v, state.delegationUnity)
      : v === "abstain"
      ? { yea: 0, nay: 0, abstain: seats }
      : v === "yea"
      ? { yea: seats, nay: 0, abstain: 0 }
      : { yea: 0, nay: seats, abstain: 0 };
    houseBreakdown[sid] = { seats, voted: true, ...split };
    houseYeaSeats += split.yea;
    houseNaySeats += split.nay;
    houseAbstainSeats += split.abstain;
  }
  const senatePassed = yea >= needed.states;
  const housePassed = houseYeaSeats >= needed.seats;
  return {
    mode: "CONST",
    yea,
    nay,
    abstain,
    totalStates: TOTAL_STATES,
    neededStates: needed.states,
    senatePassed,
    yeaSeats: houseYeaSeats,
    naySeats: houseNaySeats,
    abstainSeats: houseAbstainSeats,
    totalHouseSeats: house.total,
    neededSeats: needed.seats,
    housePassed,
    passed: senatePassed && housePassed,
    houseBreakdown,
    houseFinal: finalizeHouse,
    delegationUnity: state.delegationUnity,
  };
}

function billById(id) {
  return state.bills[id];
}

function openRoundFor(bill) {
  return bill.rounds.find((r) => r.status === "open") || null;
}

function attachmentPublicView(a) {
  return {
    id: a.id,
    label: a.label,
    mimeType: a.mimeType,
    sizeBytes: a.sizeBytes,
    originalName: a.originalName,
    url: "/attachments/" + a.id,
  };
}

function findAttachment(attachmentId) {
  for (const bill of Object.values(state.bills)) {
    const a = (bill.attachments || []).find((x) => x.id === attachmentId);
    if (a) return { bill, attachment: a };
  }
  return null;
}

// ---------------------------------------------------------------------------
// App + sessions
// ---------------------------------------------------------------------------
const app = express();
app.use(express.json());

function newToken() {
  return crypto.randomBytes(18).toString("hex");
}

function getSession(req) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return null;
  return state.sessions[token] ? { token, ...state.sessions[token] } : null;
}

function requireState(req, res, next) {
  const session = getSession(req);
  if (!session || !session.stateId) {
    return res.status(401).json({ error: "Log in as a state first." });
  }
  req.session = session;
  next();
}

function requirePresenter(req, res, next) {
  const session = getSession(req);
  if (!session || session.role !== "presenter") {
    return res.status(401).json({ error: "Presenter login required." });
  }
  req.session = session;
  next();
}

// ---------------------------------------------------------------------------
// Public / shared reads
// ---------------------------------------------------------------------------

function publicStateView(revealOverride, viewerStateId, includeAllDossiers) {
  const revealLive = revealOverride ?? state.revealVotesLive;
  const house = deriveHouse();
  const statesOut = {};
  for (const id of state.stateOrder) {
    const s = state.states[id];
    statesOut[id] = {
      id: s.id,
      name: s.name,
      motto: s.motto,
      color: s.color,
      population: s.population,
      houseSeats: house.seatsByState[id],
      profile: s.profile,
    };
    // Every state's private dossier and login passcode are only for that
    // state's own login (see /api/my-dossier) or the presenter's own screen
    // -- never the general public feed a student's browser polls, so both
    // only get attached when explicitly requested.
    if (includeAllDossiers) {
      statesOut[id].dossier = s.dossier;
      statesOut[id].passcode = s.passcode;
    }
  }
  const bills = {};
  for (const [id, bill] of Object.entries(state.bills)) {
    bills[id] = {
      id: bill.id,
      title: bill.title,
      summary: bill.summary,
      status: bill.status,
      activeOptionId: bill.activeOptionId,
      options: bill.options,
      attachments: (bill.attachments || []).map(attachmentPublicView),
      amendments: bill.amendments,
      presidentialAction: bill.presidentialAction,
      rounds: bill.rounds.map((r) => roundPublicView(r, revealLive, viewerStateId)),
    };
  }
  return {
    mode: state.mode,
    revealVotesLive: state.revealVotesLive,
    houseSizeTarget: state.houseSizeTarget,
    delegationUnity: state.delegationUnity,
    totalHouseSeats: house.total,
    stateOrder: state.stateOrder,
    states: statesOut,
    bills,
    activeBillId: state.activeBillId,
    announcement: state.announcement,
  };
}

function roundPublicView(round, revealLive, viewerStateId) {
  const votedStateIds = Object.keys(round.votes || {});
  const base = {
    id: round.id,
    billId: round.billId,
    kind: round.kind,
    amendmentId: round.amendmentId || null,
    mode: round.mode,
    thresholdType: round.thresholdType,
    status: round.status,
    openedAt: round.openedAt,
    closedAt: round.closedAt || null,
    votedStateIds, // who has voted, never how, while open + hidden
    myVote: (viewerStateId && round.votes[viewerStateId]) || null,
  };
  if (round.status === "closed") {
    base.result = round.result;
    base.votes = round.votes; // reveal all once closed -- this is the debrief moment
  } else if (revealLive) {
    base.votes = round.votes;
    base.result = computeTally(round, { finalizeHouse: false }); // projected only
  }
  return base;
}

app.get("/api/public", (req, res) => {
  const session = getSession(req);
  res.json(publicStateView(undefined, session && session.stateId));
});

app.get("/api/my-dossier", requireState, (req, res) => {
  const s = state.states[req.session.stateId];
  if (!s) return res.status(404).json({ error: "Unknown state." });
  res.json({ stateId: s.id, name: s.name, dossier: s.dossier });
});

app.get("/api/presenter/full", requirePresenter, (req, res) => {
  // Same shape as /api/public but always reveals live votes, for the
  // presenter's own screen regardless of the class-facing reveal setting.
  res.json(publicStateView(true, undefined, true));
});

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------
app.post("/api/login", (req, res) => {
  const { stateId, passcode } = req.body || {};
  const s = state.states[stateId];
  if (!s) return res.status(400).json({ error: "Pick a valid state." });
  const given = String(passcode || "").trim().toLowerCase();
  const expected = String(s.passcode || "").trim().toLowerCase();
  if (!given || given !== expected) {
    return res.status(401).json({ error: `That's not the right passcode for ${s.name}.` });
  }
  const token = newToken();
  state.sessions[token] = { stateId };
  save();
  res.json({ token, state: { id: s.id, name: s.name, color: s.color } });
});

app.post("/api/presenter/login", (req, res) => {
  const { passcode } = req.body || {};
  if (passcode !== state.presenterPasscode) {
    return res.status(401).json({ error: "Wrong passcode." });
  }
  const token = newToken();
  state.sessions[token] = { role: "presenter" };
  save();
  res.json({ token });
});

// ---------------------------------------------------------------------------
// Student actions
// ---------------------------------------------------------------------------
app.post("/api/vote", requireState, (req, res) => {
  const { billId, roundId, choice } = req.body || {};
  if (!["yea", "nay", "abstain"].includes(choice)) {
    return res.status(400).json({ error: "Invalid choice." });
  }
  const bill = billById(billId);
  if (!bill) return res.status(404).json({ error: "Unknown bill." });
  const round = bill.rounds.find((r) => r.id === roundId);
  if (!round || round.status !== "open") {
    return res.status(400).json({ error: "That vote isn't open right now." });
  }
  round.votes[req.session.stateId] = choice;
  save();
  res.json({ ok: true });
});

app.post("/api/amendments", requireState, (req, res) => {
  const { billId, text } = req.body || {};
  const bill = billById(billId);
  if (!bill) return res.status(404).json({ error: "Unknown bill." });
  const clean = String(text || "").trim().slice(0, 600);
  if (!clean) return res.status(400).json({ error: "Write an amendment first." });
  const amendment = {
    id: crypto.randomBytes(8).toString("hex"),
    billId,
    text: clean,
    proposedByStateId: req.session.stateId,
    status: "pending", // pending | approved | rejected | adopted | failed
    createdAt: Date.now(),
  };
  bill.amendments.push(amendment);
  save();
  res.json({ ok: true, amendment });
});

// ---------------------------------------------------------------------------
// Presenter actions -- running the session
// ---------------------------------------------------------------------------
app.post("/api/presenter/mode", requirePresenter, (req, res) => {
  const { mode } = req.body || {};
  if (!["AOC", "CONST"].includes(mode)) return res.status(400).json({ error: "Invalid mode." });
  state.mode = mode;
  save();
  res.json({ ok: true });
});

app.post("/api/presenter/reveal", requirePresenter, (req, res) => {
  state.revealVotesLive = !!(req.body || {}).revealVotesLive;
  save();
  res.json({ ok: true });
});

app.post("/api/presenter/house-size", requirePresenter, (req, res) => {
  const size = Math.round(Number((req.body || {}).size));
  if (!Number.isFinite(size) || size < TOTAL_STATES || size > 435) {
    return res.status(400).json({ error: `House size must be between ${TOTAL_STATES} and 435.` });
  }
  state.houseSizeTarget = size;
  save();
  res.json({ ok: true });
});

app.post("/api/presenter/delegation-unity", requirePresenter, (req, res) => {
  const { unity } = req.body || {};
  if (!Object.keys(UNITY_PROBABILITY).includes(unity)) {
    return res.status(400).json({ error: "Invalid unity setting." });
  }
  state.delegationUnity = unity;
  save();
  res.json({ ok: true });
});

app.post("/api/presenter/active-option", requirePresenter, (req, res) => {
  const { billId, optionId } = req.body || {};
  const bill = billById(billId);
  if (!bill) return res.status(404).json({ error: "Unknown bill." });
  if (openRoundFor(bill)) return res.status(400).json({ error: "Close the open vote first." });
  if (!bill.options || !bill.options.some((o) => o.id === optionId)) {
    return res.status(400).json({ error: "Unknown option." });
  }
  bill.activeOptionId = optionId;
  if (bill.status === "failed" || bill.status === "vetoed") bill.status = "floor";
  save();
  res.json({ ok: true });
});

app.post("/api/presenter/amendments/:id/status", requirePresenter, (req, res) => {
  const { status } = req.body || {};
  if (!["approved", "rejected"].includes(status)) {
    return res.status(400).json({ error: "Invalid status." });
  }
  for (const bill of Object.values(state.bills)) {
    const amendment = bill.amendments.find((a) => a.id === req.params.id);
    if (amendment) {
      amendment.status = status;
      save();
      return res.json({ ok: true, amendment });
    }
  }
  res.status(404).json({ error: "Unknown amendment." });
});

app.post("/api/presenter/rounds/open", requirePresenter, (req, res) => {
  const { billId, kind, amendmentId, thresholdType } = req.body || {};
  const bill = billById(billId);
  if (!bill) return res.status(404).json({ error: "Unknown bill." });
  if (openRoundFor(bill)) return res.status(400).json({ error: "A vote is already open on this bill." });
  if (!["amendment", "final", "override"].includes(kind)) {
    return res.status(400).json({ error: "Invalid round kind." });
  }
  if (kind === "override" && (!bill.presidentialAction || bill.presidentialAction.decision !== "veto")) {
    return res.status(400).json({ error: "There's no veto to override." });
  }
  if (kind === "amendment") {
    const amendment = bill.amendments.find((a) => a.id === amendmentId);
    if (!amendment) return res.status(400).json({ error: "Unknown amendment." });
    amendment.status = "approved";
  }
  const round = {
    id: crypto.randomBytes(8).toString("hex"),
    billId,
    kind,
    amendmentId: kind === "amendment" ? amendmentId : null,
    mode: state.mode,
    thresholdType: kind === "override" ? "twothirds" : thresholdType || (state.mode === "AOC" ? "super9" : "simple"),
    status: "open",
    votes: {},
    openedAt: Date.now(),
    closedAt: null,
    result: null,
  };
  bill.rounds.push(round);
  if (kind === "final") bill.status = "voting";
  else if (kind === "override") bill.status = "override_voting";
  else if (kind === "amendment") bill.status = "floor";
  save();
  res.json({ ok: true, round });
});

app.post("/api/presenter/rounds/:id/close", requirePresenter, (req, res) => {
  for (const bill of Object.values(state.bills)) {
    const round = bill.rounds.find((r) => r.id === req.params.id);
    if (round) {
      if (round.status !== "open") return res.status(400).json({ error: "Already closed." });
      round.status = "closed";
      round.closedAt = Date.now();
      round.result = computeTally(round, { finalizeHouse: true }); // the one-time real roll

      if (round.kind === "amendment") {
        const amendment = bill.amendments.find((a) => a.id === round.amendmentId);
        if (amendment) amendment.status = round.result.passed ? "adopted" : "failed";
      } else if (round.kind === "final") {
        bill.presidentialAction = null;
        if (round.result.passed) {
          bill.status = state.mode === "CONST" ? "passed_awaiting_president" : "enacted";
        } else {
          bill.status = "failed";
        }
      } else if (round.kind === "override") {
        bill.status = round.result.passed ? "enacted" : "vetoed";
      }
      save();
      return res.json({ ok: true, round });
    }
  }
  res.status(404).json({ error: "Unknown round." });
});

app.post("/api/presenter/president", requirePresenter, (req, res) => {
  const { billId, decision } = req.body || {};
  if (!["sign", "veto"].includes(decision)) return res.status(400).json({ error: "Invalid decision." });
  const bill = billById(billId);
  if (!bill) return res.status(404).json({ error: "Unknown bill." });
  if (bill.status !== "passed_awaiting_president") {
    return res.status(400).json({ error: "This bill isn't awaiting presidential action." });
  }
  bill.presidentialAction = { decision, at: Date.now() };
  bill.status = decision === "sign" ? "enacted" : "vetoed";
  save();
  res.json({ ok: true, bill });
});

app.post("/api/presenter/active-bill", requirePresenter, (req, res) => {
  const { billId } = req.body || {};
  if (!billById(billId)) return res.status(404).json({ error: "Unknown bill." });
  state.activeBillId = billId;
  save();
  res.json({ ok: true });
});

app.post("/api/presenter/reset-bill", requirePresenter, (req, res) => {
  const { billId } = req.body || {};
  const bill = billById(billId);
  if (!bill) return res.status(404).json({ error: "Unknown bill." });
  bill.status = "floor";
  bill.amendments = [];
  bill.rounds = [];
  bill.presidentialAction = null;
  if (bill.options && bill.options.length) bill.activeOptionId = bill.options[0].id;
  save();
  res.json({ ok: true });
});

app.post("/api/presenter/logout-all", requirePresenter, (req, res) => {
  for (const [token, sess] of Object.entries(state.sessions)) {
    if (sess.stateId) delete state.sessions[token];
  }
  save();
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Presenter actions -- editing content (states, dossiers, legislation)
// ---------------------------------------------------------------------------
function cleanList(v) {
  if (Array.isArray(v)) return v.map((s) => String(s).trim()).filter(Boolean);
  if (typeof v === "string") return v.split("\n").map((s) => s.trim()).filter(Boolean);
  return [];
}

app.post("/api/presenter/states/:id", requirePresenter, (req, res) => {
  const s = state.states[req.params.id];
  if (!s) return res.status(404).json({ error: "Unknown state." });
  const b = req.body || {};
  if (typeof b.name === "string" && b.name.trim()) s.name = b.name.trim();
  if (typeof b.motto === "string") s.motto = b.motto.trim();
  if (typeof b.passcode === "string" && b.passcode.trim()) s.passcode = b.passcode.trim();
  if (typeof b.color === "string" && /^#[0-9a-fA-F]{6}$/.test(b.color)) s.color = b.color;
  if (b.population !== undefined) {
    const p = Math.round(Number(b.population));
    if (Number.isFinite(p) && p >= 0) s.population = p;
  }
  if (b.profile) {
    s.profile = s.profile || {};
    if (typeof b.profile.blurb === "string") s.profile.blurb = b.profile.blurb.trim();
    if (b.profile.industries !== undefined) s.profile.industries = cleanList(b.profile.industries);
    if (b.profile.priorities !== undefined) s.profile.priorities = cleanList(b.profile.priorities);
  }
  if (b.dossier && typeof b.dossier.text === "string") {
    s.dossier = s.dossier || {};
    s.dossier.text = b.dossier.text.trim();
  }
  save();
  res.json({ ok: true, state: s });
});

app.post("/api/presenter/bills/:id", requirePresenter, (req, res) => {
  const bill = billById(req.params.id);
  if (!bill) return res.status(404).json({ error: "Unknown bill." });
  const b = req.body || {};
  if (typeof b.title === "string" && b.title.trim()) bill.title = b.title.trim();
  if (typeof b.summary === "string") bill.summary = b.summary.trim();
  save();
  res.json({ ok: true, bill });
});

app.post("/api/presenter/bills/:id/delete", requirePresenter, (req, res) => {
  const bill = billById(req.params.id);
  if (!bill) return res.status(404).json({ error: "Unknown bill." });
  const ids = Object.keys(state.bills);
  if (ids.length <= 1) return res.status(400).json({ error: "You need at least one bill." });
  delete state.bills[req.params.id];
  if (state.activeBillId === req.params.id) {
    state.activeBillId = Object.keys(state.bills)[0];
  }
  save();
  res.json({ ok: true, activeBillId: state.activeBillId });
});

app.post("/api/presenter/bills/:id/options/add", requirePresenter, (req, res) => {
  const bill = billById(req.params.id);
  if (!bill) return res.status(404).json({ error: "Unknown bill." });
  if (openRoundFor(bill)) return res.status(400).json({ error: "Close the open vote first." });
  const b = req.body || {};
  const name = String(b.name || "").trim();
  if (!name) return res.status(400).json({ error: "Give the option a name." });
  const option = {
    id: "opt-" + crypto.randomBytes(6).toString("hex"),
    name,
    detail: String(b.detail || "").trim(),
    cost: b.cost === "" || b.cost === undefined || b.cost === null ? null : Math.round(Number(b.cost)),
    servedStateIds: Array.isArray(b.servedStateIds) ? b.servedStateIds.filter((id) => state.states[id]) : [],
  };
  bill.options = bill.options || [];
  bill.options.push(option);
  if (!bill.activeOptionId) bill.activeOptionId = option.id;
  save();
  res.json({ ok: true, option });
});

app.post("/api/presenter/bills/:id/options/:optionId", requirePresenter, (req, res) => {
  const bill = billById(req.params.id);
  if (!bill) return res.status(404).json({ error: "Unknown bill." });
  if (openRoundFor(bill)) return res.status(400).json({ error: "Close the open vote first." });
  const option = (bill.options || []).find((o) => o.id === req.params.optionId);
  if (!option) return res.status(404).json({ error: "Unknown option." });
  const b = req.body || {};
  if (typeof b.name === "string" && b.name.trim()) option.name = b.name.trim();
  if (typeof b.detail === "string") option.detail = b.detail.trim();
  if (b.cost !== undefined) option.cost = b.cost === "" || b.cost === null ? null : Math.round(Number(b.cost));
  if (Array.isArray(b.servedStateIds)) option.servedStateIds = b.servedStateIds.filter((id) => state.states[id]);
  save();
  res.json({ ok: true, option });
});

app.post("/api/presenter/bills/:id/options/:optionId/delete", requirePresenter, (req, res) => {
  const bill = billById(req.params.id);
  if (!bill) return res.status(404).json({ error: "Unknown bill." });
  if (openRoundFor(bill)) return res.status(400).json({ error: "Close the open vote first." });
  bill.options = (bill.options || []).filter((o) => o.id !== req.params.optionId);
  if (bill.activeOptionId === req.params.optionId) {
    bill.activeOptionId = bill.options.length ? bill.options[0].id : null;
  }
  save();
  res.json({ ok: true });
});

app.post("/api/presenter/new-bill", requirePresenter, (req, res) => {
  const { title, summary } = req.body || {};
  const clean = String(title || "").trim();
  if (!clean) return res.status(400).json({ error: "Give the bill a title." });
  const id = "bill-" + crypto.randomBytes(6).toString("hex");
  state.bills[id] = {
    id,
    title: clean,
    summary: String(summary || "").trim(),
    status: "floor",
    activeOptionId: null,
    options: [],
    attachments: [],
    amendments: [],
    rounds: [],
    presidentialAction: null,
  };
  state.activeBillId = id;
  save();
  res.json({ ok: true, billId: id });
});

// ---------------------------------------------------------------------------
// Presenter actions -- bill materials (maps, reports: images and PDFs)
// ---------------------------------------------------------------------------
app.post("/api/presenter/bills/:id/attachments", requirePresenter, (req, res) => {
  const bill = billById(req.params.id);
  if (!bill) return res.status(404).json({ error: "Unknown bill." });
  upload.single("file")(req, res, async (err) => {
    if (err) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({ error: `That file is larger than the ${MAX_UPLOAD_LABEL} limit.` });
      }
      return res.status(400).json({ error: "Could not upload that file." });
    }
    if (!req.file) {
      return res.status(400).json({ error: `Please attach an image (PNG/JPG/GIF/WEBP) or a PDF, up to ${MAX_UPLOAD_LABEL}.` });
    }
    try {
      let storedFilename;
      if (PERSISTENCE_MODE === "database") {
        const ext = path.extname(req.file.originalname || "").toLowerCase().slice(0, 10);
        storedFilename = await saveAttachmentBytes(req.file.buffer, ext);
      } else {
        storedFilename = req.file.filename;
      }
      const label = String((req.body || {}).label || req.file.originalname || "Attachment").trim().slice(0, 120);
      const attachment = {
        id: crypto.randomBytes(8).toString("hex"),
        label: label || req.file.originalname,
        originalName: req.file.originalname,
        storedFilename,
        mimeType: req.file.mimetype,
        sizeBytes: req.file.size,
        uploadedAt: Date.now(),
      };
      bill.attachments = bill.attachments || [];
      bill.attachments.push(attachment);
      save();
      res.json({ ok: true, attachment: attachmentPublicView(attachment) });
    } catch (uploadErr) {
      console.error("Attachment upload failed:", uploadErr.message);
      res.status(502).json({ error: "Could not save that file to the database. Try again in a moment." });
    }
  });
});

app.post("/api/presenter/bills/:id/attachments/:attachmentId/delete", requirePresenter, async (req, res) => {
  const bill = billById(req.params.id);
  if (!bill) return res.status(404).json({ error: "Unknown bill." });
  const idx = (bill.attachments || []).findIndex((a) => a.id === req.params.attachmentId);
  if (idx === -1) return res.status(404).json({ error: "Unknown attachment." });
  const [removed] = bill.attachments.splice(idx, 1);
  await deleteAttachmentFile(removed); // best-effort cleanup
  save();
  res.json({ ok: true });
});

// Serving the actual file: unauthenticated by design, like the class link
// itself -- these are meant to be shared with every student, not a secret.
// Access still requires knowing the attachment's random id, same security
// model as everything else in this app (see the README's limitations).
app.get("/attachments/:id", async (req, res) => {
  const found = findAttachment(req.params.id);
  if (!found) return res.status(404).send("Not found.");
  res.type(found.attachment.mimeType);
  if (PERSISTENCE_MODE === "database") {
    try {
      const bytes = await readAttachmentBytes(found.attachment.storedFilename);
      if (!bytes) return res.status(404).send("Not found.");
      return res.send(bytes);
    } catch (err) {
      console.error("Attachment fetch failed:", err.message);
      return res.status(502).send("Could not load that file right now.");
    }
  }
  res.sendFile(path.join(UPLOADS_DIR, found.attachment.storedFilename), (err) => {
    if (err && !res.headersSent) res.status(404).send("Not found.");
  });
});

// ---------------------------------------------------------------------------
// Presenter actions -- message the class ("a message from the Capitol")
// ---------------------------------------------------------------------------
app.post("/api/presenter/announcement", requirePresenter, (req, res) => {
  const text = String((req.body || {}).text || "").trim().slice(0, 500);
  if (!text) return res.status(400).json({ error: "Write a message first." });
  state.announcement = { id: crypto.randomBytes(8).toString("hex"), text, createdAt: Date.now() };
  save();
  res.json({ ok: true, announcement: state.announcement });
});

app.post("/api/presenter/announcement/clear", requirePresenter, (req, res) => {
  state.announcement = null;
  save();
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Presenter actions -- storage status + factory reset
//
// With state now potentially living in an external database, "delete
// data.json" is no longer a way to get back to a clean slate between
// semesters. This is the equivalent: wipe everything (states, bills, votes,
// passcodes, sessions) back to exactly what seed.js says, and clear out any
// uploaded materials along with it.
// ---------------------------------------------------------------------------
app.get("/api/presenter/storage-status", requirePresenter, (req, res) => {
  res.json({ mode: PERSISTENCE_MODE, maxUploadMB: Math.round((MAX_UPLOAD_BYTES / (1024 * 1024)) * 10) / 10 });
});

app.post("/api/presenter/factory-reset", requirePresenter, async (req, res) => {
  // Delete every currently-known attachment's underlying bytes first, while
  // we still have the old state around to know what they were. In file mode
  // also sweep uploads/ directly afterward, as a safety net for anything
  // that wasn't referenced by any bill.
  const oldBills = Object.values(state.bills);
  for (const bill of oldBills) {
    for (const attachment of bill.attachments || []) {
      await deleteAttachmentFile(attachment);
    }
  }
  if (PERSISTENCE_MODE === "file") {
    for (const file of fs.readdirSync(UPLOADS_DIR)) {
      fs.unlink(path.join(UPLOADS_DIR, file), () => {});
    }
  }
  const presenterToken = req.session.token;
  state = createInitialState();
  backfillState();
  // A factory reset should log out every student, but not boot the
  // presenter who just clicked the button back to their own login screen.
  state.sessions[presenterToken] = { role: "presenter" };
  save();
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Static frontend -- everything lives flat in this same folder (no `public/`
// subfolder) so the whole project can be uploaded to GitHub as one batch of
// files with no folder structure required. Each front-end file is served by
// its own explicit route rather than `express.static` over the project root,
// so things like server.js, seed.js, and package.json are never accidentally
// servable to a browser.
// ---------------------------------------------------------------------------
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});
app.get("/presenter", (req, res) => {
  res.sendFile(path.join(__dirname, "presenter.html"));
});
app.get("/app.js", (req, res) => {
  res.sendFile(path.join(__dirname, "app.js"));
});
app.get("/presenter.js", (req, res) => {
  res.sendFile(path.join(__dirname, "presenter.js"));
});
app.get("/styles.css", (req, res) => {
  res.sendFile(path.join(__dirname, "styles.css"));
});

bootstrap().catch((err) => {
  console.error("Failed to start:", err);
  process.exit(1);
});

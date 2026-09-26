const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { createInitialState } = require("./seed");

const DATA_FILE = path.join(__dirname, "data.json");
const PORT = process.env.PORT || 3000;

// ---------------------------------------------------------------------------
// Persistence: load from disk if present, else seed fresh. Saved after every
// mutation so a restart during a class period doesn't lose the session.
// ---------------------------------------------------------------------------
let state;
try {
  state = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
} catch {
  state = createInitialState();
}
// Fields added after the first release -- backfill so old data.json files
// (or ones missing a key) still work.
if (!state.houseSizeTarget) state.houseSizeTarget = 50;
if (!state.delegationUnity) state.delegationUnity = "realistic";

function save() {
  fs.writeFile(DATA_FILE, JSON.stringify(state, null, 2), (err) => {
    if (err) console.error("Failed to persist data.json:", err.message);
  });
}
save();

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
    // Every state's private dossier is only for that state's own login (see
    // /api/my-dossier) or the presenter's own screen -- never the general
    // public feed, so this only attaches it when explicitly requested.
    if (includeAllDossiers) statesOut[id].dossier = s.dossier;
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
  const { stateId } = req.body || {};
  const s = state.states[stateId];
  if (!s) return res.status(400).json({ error: "Pick a valid state." });
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
    amendments: [],
    rounds: [],
    presidentialAction: null,
  };
  state.activeBillId = id;
  save();
  res.json({ ok: true, billId: id });
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

app.listen(PORT, () => {
  console.log(`Orange Countlandia Congress is running on port ${PORT}`);
  console.log(`Student view:   http://localhost:${PORT}/`);
  console.log(`Presenter view: http://localhost:${PORT}/presenter  (passcode: ${state.presenterPasscode})`);
});

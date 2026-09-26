(() => {
  "use strict";

  const root = document.getElementById("root");
  const toastEl = document.getElementById("toast");

  const store = {
    token: localStorage.getItem("occ_token") || null,
    stateId: localStorage.getItem("occ_stateId") || null,
    stateName: localStorage.getItem("occ_stateName") || null,
    data: null,
    dossier: null,
    activeTab: "floor",
    amendDraft: "",
    pendingStateId: null, // tile tapped, waiting on its passcode
    dismissedAnnouncementId: localStorage.getItem("occ_dismissedAnnouncementId") || null,
  };

  function isEditingText() {
    const ae = document.activeElement;
    return !!ae && (ae.tagName === "TEXTAREA" || ae.tagName === "INPUT");
  }

  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    setTimeout(() => toastEl.classList.remove("show"), 2200);
  }

  async function api(path, opts = {}) {
    const headers = Object.assign({ "Content-Type": "application/json" }, opts.headers || {});
    if (store.token) headers.Authorization = "Bearer " + store.token;
    const res = await fetch(path, Object.assign({}, opts, { headers }));
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || "Something went wrong.");
    return body;
  }

  function esc(s) {
    return String(s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function money(n) {
    return Number(n).toLocaleString() + " crowns";
  }

  function fileSize(bytes) {
    if (bytes == null) return "";
    if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  }

  function materialsHtml(attachments) {
    if (!attachments || !attachments.length) return "";
    return `
      <div class="section-title">Materials</div>
      <div class="materials-grid">
        ${attachments
          .map((a) =>
            a.mimeType && a.mimeType.startsWith("image/")
              ? `<a class="material-item" href="${a.url}" target="_blank" rel="noopener">
                  <img src="${a.url}" alt="${esc(a.label)}" />
                  <div class="material-label">${esc(a.label)}</div>
                  <div class="material-meta">${fileSize(a.sizeBytes)}</div>
                </a>`
              : `<a class="material-item" href="${a.url}" target="_blank" rel="noopener">
                  <div class="material-pdf-icon">📄</div>
                  <div class="material-label">${esc(a.label)}</div>
                  <div class="material-meta">PDF &middot; ${fileSize(a.sizeBytes)}</div>
                </a>`
          )
          .join("")}
      </div>
    `;
  }

  function modeLabel(mode) {
    return mode === "CONST" ? "The Constitution" : "The Articles of Confederation";
  }

  function statusLabel(status) {
    return {
      floor: "On the floor",
      voting: "Final vote open",
      passed_awaiting_president: "Awaiting the President",
      enacted: "Enacted into law",
      override_voting: "Override vote open",
      vetoed: "Vetoed",
      failed: "Failed",
    }[status] || status;
  }

  function statusPillClass(status) {
    if (status === "enacted") return "status-enacted";
    if (status === "failed" || status === "vetoed") return "status-failed";
    if (status === "voting" || status === "override_voting") return "status-open";
    return "status-pending";
  }

  // ---- login -----------------------------------------------------------
  function renderLogin() {
    const states = store.data
      ? store.data.stateOrder.map((id) => store.data.states[id])
      : [];
    const pending = store.pendingStateId && store.data ? store.data.states[store.pendingStateId] : null;

    if (pending) {
      root.innerHTML = `
        <div class="center-wrap">
          <div class="card" style="max-width:420px;width:100%">
            <div class="hero" style="margin-top:0">
              <div class="swatch" style="background:${pending.color};height:8px;border-radius:4px;margin-bottom:14px"></div>
              <h1 style="font-size:1.6rem">${esc(pending.name)}</h1>
              <p class="muted" style="font-style:italic">${esc(pending.motto)}</p>
            </div>
            <div class="field">
              <label for="statePasscode">Your delegation's passcode</label>
              <input id="statePasscode" type="password" placeholder="passcode" autofocus />
            </div>
            <button class="btn orange" id="stateLoginBtn" style="width:100%">Log in as ${esc(pending.name)}</button>
            <button class="btn ghost small" id="backToGridBtn" style="width:100%;margin-top:10px">&larr; Choose a different state</button>
          </div>
        </div>
      `;
      const go = async () => {
        try {
          const result = await api("/api/login", {
            method: "POST",
            body: JSON.stringify({ stateId: pending.id, passcode: document.getElementById("statePasscode").value }),
          });
          store.token = result.token;
          store.stateId = result.state.id;
          store.stateName = result.state.name;
          store.pendingStateId = null;
          localStorage.setItem("occ_token", store.token);
          localStorage.setItem("occ_stateId", store.stateId);
          localStorage.setItem("occ_stateName", store.stateName);
          await refresh();
          render();
          checkAnnouncement(); // don't make them wait up to 2s to see an already-active message
        } catch (e) {
          toast(e.message);
        }
      };
      document.getElementById("stateLoginBtn").addEventListener("click", go);
      document.getElementById("statePasscode").addEventListener("keydown", (e) => {
        if (e.key === "Enter") go();
      });
      document.getElementById("backToGridBtn").addEventListener("click", () => {
        store.pendingStateId = null;
        render();
      });
      return;
    }

    root.innerHTML = `
      <div class="center-wrap">
        <div style="max-width:760px;width:100%">
          <div class="hero">
            <div class="fruit-big"></div>
            <h1>United States of Orange Countlandia</h1>
            <p class="muted">Congress of the Federation &mdash; delegate log-in</p>
          </div>
          <div class="card">
            <h3>Which state do you represent?</h3>
            <p class="muted">Tap your state, then enter your delegation's passcode. Everyone in your delegation can use the same one.</p>
            <div class="login-grid" id="loginGrid">
              ${states
                .map(
                  (s) => `
                <button class="state-tile" data-id="${s.id}">
                  <div class="swatch" style="background:${s.color}"></div>
                  <div class="name">${esc(s.name)}</div>
                  <div class="motto">${esc(s.motto)}</div>
                </button>`
                )
                .join("")}
            </div>
          </div>
        </div>
      </div>
    `;
    root.querySelectorAll(".state-tile").forEach((btn) => {
      btn.addEventListener("click", () => {
        store.pendingStateId = btn.dataset.id;
        render();
      });
    });
  }

  // ---- shared bits -------------------------------------------------------
  function tallyBarHtml(result, mode) {
    if (!result) return "";
    const total = result.totalStates || 13;
    const pct = (n) => (n / total) * 100;
    let seatsRow = "";
    if (mode === "CONST") {
      const seatPct = (n) => (n / result.totalHouseSeats) * 100;
      const houseNeededPct = seatPct(result.neededSeats);
      seatsRow = `
        <div class="muted" style="margin-top:12px;font-size:0.8rem">House (by seats) &mdash; needs ${result.neededSeats} of ${result.totalHouseSeats}</div>
        <div class="threshold-mark"><div class="tick" style="left:${houseNeededPct}%"><span class="label">need ${result.neededSeats}</span></div></div>
        <div class="tally-bar" style="margin-top:30px">
          <div class="seg yea" style="width:${seatPct(result.yeaSeats)}%"></div>
          <div class="seg" style="width:${100 - seatPct(result.yeaSeats)}%;background:transparent"></div>
        </div>
        <div class="muted" style="font-size:0.8rem">${result.yeaSeats} of ${result.totalHouseSeats} seats yea &mdash; ${result.housePassed ? "passes" : "short"}</div>
        <div class="muted" style="margin-top:12px;font-size:0.8rem">Senate (one vote per state) &mdash; needs ${result.neededStates} of 13</div>
      `;
    }
    const neededPct = pct(result.neededStates);
    return `
      ${seatsRow}
      <div class="threshold-mark"><div class="tick" style="left:${neededPct}%"><span class="label">need ${result.neededStates}</span></div></div>
      <div class="tally-bar" style="margin-top:30px">
        <div class="seg yea" style="width:${pct(result.yea)}%"></div>
        <div class="seg nay" style="width:${pct(result.nay)}%"></div>
        <div class="seg abstain" style="width:${pct(result.abstain)}%"></div>
      </div>
      <div class="tally-legend">
        <span><span class="dot yea"></span> Yea ${result.yea}</span>
        <span><span class="dot nay"></span> Nay ${result.nay}</span>
        <span><span class="dot abstain"></span> Abstain ${result.abstain}</span>
      </div>
      <p style="margin-top:10px"><strong>${result.passed ? "Passes" : "Does not pass"}</strong></p>
    `;
  }

  function roundKindLabel(round, bill) {
    if (round.kind === "final") return "Final vote";
    if (round.kind === "override") return "Override vote (needs two-thirds)";
    if (round.kind === "amendment") {
      const a = bill.amendments.find((x) => x.id === round.amendmentId);
      return "Amendment vote: " + (a ? a.text : "");
    }
    return round.kind;
  }

  function thresholdBadge(t) {
    return { majority: "Simple majority", super9: "9 of 13 states", unanimous13: "Unanimous (13 of 13)", simple: "Majority, both chambers", twothirds: "Two-thirds, both chambers" }[t] || t;
  }

  // ---- Floor tab -----------------------------------------------------
  function renderFloor(bill) {
    const d = store.data;
    const openRound = bill.rounds.find((r) => r.status === "open");
    const iVotedAlready = openRound && openRound.myVote;
    const votedCount = openRound ? openRound.votedStateIds.length : 0;

    let routeHtml = "";
    if (bill.options && bill.options.length) {
      routeHtml = `
        <div class="section-title">Proposed option</div>
        ${bill.options
          .map(
            (o) => `
          <div class="route-option${o.id === bill.activeOptionId ? " active" : ""}">
            <strong>${esc(o.name)}</strong>${o.cost != null ? ` &mdash; ${money(o.cost)}` : ""}
            <p style="margin:6px 0 4px">${esc(o.detail)}</p>
            ${o.servedStateIds && o.servedStateIds.length ? `<div class="muted" style="font-size:0.82rem">Serves: ${o.servedStateIds.map((id) => esc(d.states[id].name)).join(", ")}</div>` : ""}
            ${
              o.id === bill.activeOptionId
                ? '<span class="tag" style="margin-top:6px">Currently on the floor</span>'
                : ""
            }
          </div>`
          )
          .join("")}
      `;
    }

    let voteHtml = "";
    if (openRound) {
      voteHtml = `
        <div class="card" style="border-color:var(--orange)">
          <span class="pill status-open">${esc(roundKindLabel(openRound, bill))}</span>
          <p class="muted" style="margin-top:8px">Threshold: ${thresholdBadge(openRound.thresholdType)} &middot; ${votedCount} of 13 states have voted</p>
          ${
            iVotedAlready
              ? `<p><strong>Your vote is recorded: ${openRound.myVote.toUpperCase()}.</strong> You can change it until the presenter closes the vote.</p>`
              : `<p>Cast ${esc(store.stateName)}'s vote:</p>`
          }
          <div class="vote-row">
            <button class="btn green" data-vote="yea">Yea</button>
            <button class="btn red" data-vote="nay">Nay</button>
            <button class="btn ghost" data-vote="abstain">Abstain</button>
          </div>
        </div>
      `;
    } else {
      voteHtml = `<div class="card"><p class="muted">No vote is open right now. Watch the front of the room.</p></div>`;
    }

    const pendingAmendments = bill.amendments.filter((a) => a.status === "pending");
    const otherAmendments = bill.amendments.filter((a) => a.status !== "pending");

    root.innerHTML = shell(`
      <div class="two-col">
        <div>
          <div class="card">
            <span class="pill ${statusPillClass(bill.status)}">${statusLabel(bill.status)}</span>
            <h2 style="margin-top:10px">${esc(bill.title)}</h2>
            <p>${esc(bill.summary)}</p>
            ${materialsHtml(bill.attachments)}
            ${routeHtml}
            ${bill.presidentialAction ? `<p class="muted">The President has ${bill.presidentialAction.decision === "sign" ? "signed" : "vetoed"} this bill.</p>` : ""}
          </div>
          ${voteHtml}
        </div>
        <div>
          <div class="card">
            <h3>Propose an amendment</h3>
            <p class="muted">Any delegation can propose a change. The presenter decides which amendments come to a vote.</p>
            <div class="field">
              <textarea id="amendText" rows="3" placeholder="e.g. Add a spur line to Breaheim before final passage.">${esc(store.amendDraft)}</textarea>
            </div>
            <button class="btn orange" id="submitAmendment">Submit amendment</button>
            <hr class="divider" />
            <div class="section-title">Pending</div>
            ${pendingAmendments.length ? pendingAmendments.map(amendmentHtml).join("") : '<p class="muted">None yet.</p>'}
            <div class="section-title" style="margin-top:14px">Decided</div>
            ${otherAmendments.length ? otherAmendments.slice().reverse().map(amendmentHtml).join("") : '<p class="muted">None yet.</p>'}
          </div>
        </div>
      </div>
    `);

    root.querySelectorAll("[data-vote]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        try {
          await api("/api/vote", {
            method: "POST",
            body: JSON.stringify({ billId: bill.id, roundId: openRound.id, choice: btn.dataset.vote }),
          });
          toast("Vote recorded.");
          await refresh();
          render();
        } catch (e) {
          toast(e.message);
        }
      });
    });
    const submitBtn = root.querySelector("#submitAmendment");
    const amendTextEl = root.querySelector("#amendText");
    if (amendTextEl) {
      amendTextEl.addEventListener("input", () => {
        store.amendDraft = amendTextEl.value;
      });
    }
    if (submitBtn) {
      submitBtn.addEventListener("click", async () => {
        const text = (amendTextEl.value || "").trim();
        if (!text) return toast("Write an amendment first.");
        try {
          await api("/api/amendments", { method: "POST", body: JSON.stringify({ billId: bill.id, text }) });
          store.amendDraft = "";
          toast("Amendment submitted.");
          await refresh();
          render();
        } catch (e) {
          toast(e.message);
        }
      });
    }
  }

  function amendmentHtml(a) {
    const d = store.data;
    const proposer = d.states[a.proposedByStateId];
    const statusPill = { pending: "status-pending", approved: "status-open", adopted: "status-passed", rejected: "status-failed", failed: "status-failed" }[a.status];
    return `
      <div class="amendment-item">
        <div>${esc(a.text)}</div>
        <div class="meta">Proposed by ${proposer ? esc(proposer.name) : "?"} &middot; <span class="pill ${statusPill}">${a.status}</span></div>
      </div>
    `;
  }

  // ---- Directory tab ---------------------------------------------------
  function renderDirectory(bill) {
    const d = store.data;
    const activeOption = bill && bill.options ? bill.options.find((o) => o.id === bill.activeOptionId) : null;
    root.innerHTML = shell(`
      <div class="card">
        <h2>State directory</h2>
        <p class="muted">Public profiles for every state in the Federation. Your own private dossier is under "My Dossier".</p>
      </div>
      <div class="grid states">
        ${d.stateOrder
          .map((id) => {
            const s = d.states[id];
            const served = activeOption && activeOption.servedStateIds && activeOption.servedStateIds.includes(id);
            return `
            <div class="card" style="margin-bottom:0">
              <div class="swatch" style="background:${s.color};height:6px;border-radius:4px;margin-bottom:8px"></div>
              <h3 style="margin-bottom:2px">${esc(s.name)} ${id === store.stateId ? '<span class="badge-you">YOU</span>' : ""}</h3>
              <div class="muted" style="font-style:italic;margin-bottom:8px">${esc(s.motto)}</div>
              ${served ? '<span class="tag">On the current route</span>' : ""}
              <p style="margin-top:8px">${esc(s.profile.blurb)}</p>
              <div class="section-title">Industries</div>
              <div>${s.profile.industries.map((i) => `<span class="tag">${esc(i)}</span>`).join("")}</div>
              <div class="section-title" style="margin-top:10px">Priorities</div>
              <ul style="margin:0;padding-left:18px">${s.profile.priorities.map((p) => `<li>${esc(p)}</li>`).join("")}</ul>
              <div class="muted" style="margin-top:10px;font-size:0.8rem">Population ${s.population.toLocaleString()} &middot; ${s.houseSeats} House seats</div>
            </div>`;
          })
          .join("")}
      </div>
    `);
  }

  // ---- Dossier tab -------------------------------------------------------
  function renderDossier() {
    const d = store.dossier;
    root.innerHTML = shell(`
      <div class="card">
        <h2>${esc(store.stateName)}'s private dossier</h2>
        <p class="muted">For your delegation's eyes only. Other states cannot see this.</p>
        <div class="dossier-box">
          <div class="label">Confidential</div>
          <p style="margin-top:8px">${d ? esc(d.dossier.text) : "Loading…"}</p>
        </div>
      </div>
    `);
  }

  // ---- History tab ---------------------------------------------------
  function houseBreakdownTable(result) {
    if (!result || result.mode !== "CONST" || !result.houseBreakdown) return "";
    const d = store.data;
    return `
      <div class="section-title" style="margin-top:16px">How each delegation split its House seats</div>
      <p class="muted" style="font-size:0.82rem;margin-top:-6px">Real delegations rarely vote as one bloc &mdash; each seat was rolled independently (unity: ${esc(result.delegationUnity || "realistic")}).</p>
      <table class="vote-table">
        <thead><tr><th>State</th><th>Seats</th><th>Yea</th><th>Nay</th><th>Abstain</th></tr></thead>
        <tbody>
          ${d.stateOrder
            .map((id) => {
              const b = result.houseBreakdown[id] || { seats: 0, yea: 0, nay: 0, abstain: 0 };
              return `<tr><td>${esc(d.states[id].name)}</td><td>${b.seats}</td><td>${b.yea}</td><td>${b.nay}</td><td>${b.abstain}</td></tr>`;
            })
            .join("")}
        </tbody>
      </table>
    `;
  }

  function renderHistory(bill) {
    const closed = bill.rounds.filter((r) => r.status === "closed").slice().reverse();
    root.innerHTML = shell(`
      <div class="card">
        <h2>Debrief: past votes</h2>
        <p class="muted">Why did your state vote the way it did? What would change your vote?</p>
      </div>
      ${
        closed.length
          ? closed
              .map(
                (r) => `
        <div class="card">
          <span class="pill ${r.result.passed ? "status-passed" : "status-failed"}">${r.result.passed ? "Passed" : "Failed"}</span>
          <h3 style="margin-top:8px">${esc(roundKindLabel(r, bill))}</h3>
          <p class="muted">Under ${modeLabel(r.mode)} &middot; ${thresholdBadge(r.thresholdType)}</p>
          ${tallyBarHtml(r.result, r.mode)}
          <table class="vote-table" style="margin-top:10px">
            <thead><tr><th>State</th><th>Vote</th></tr></thead>
            <tbody>
              ${store.data.stateOrder
                .map((id) => `<tr><td>${esc(store.data.states[id].name)}</td><td>${(r.votes[id] || "—").toUpperCase()}</td></tr>`)
                .join("")}
            </tbody>
          </table>
          ${houseBreakdownTable(r.result)}
        </div>`
              )
              .join("")
          : '<div class="card"><p class="muted">No votes have closed yet.</p></div>'
      }
    `);
  }

  // ---- shell / tabs ------------------------------------------------------
  function shell(inner) {
    const d = store.data;
    return `
      <div class="topbar">
        <div class="brand"><span class="fruit"></span> Orange Countlandia</div>
        <span class="pill ${d.mode === "CONST" ? "mode-const" : "mode-aoc"}">${modeLabel(d.mode)}</span>
        <div class="spacer"></div>
        <span class="pill">You are: ${esc(store.stateName)}</span>
        <button class="btn ghost small" id="logoutBtn" style="background:transparent;color:#fff;border-color:#fff">Switch state</button>
      </div>
      <div class="app-shell">
        <nav class="controls-bar" style="margin:18px 0">
          ${tabBtn("floor", "The Floor")}
          ${tabBtn("directory", "State Directory")}
          ${tabBtn("dossier", "My Dossier")}
          ${tabBtn("history", "Debrief / History")}
        </nav>
        ${inner}
      </div>
    `;
  }

  function tabBtn(id, label) {
    const active = store.activeTab === id;
    return `<button class="btn ${active ? "orange" : "ghost"} small" data-tab="${id}">${label}</button>`;
  }

  function bindShellEvents() {
    const logout = document.getElementById("logoutBtn");
    if (logout) {
      logout.addEventListener("click", () => {
        localStorage.removeItem("occ_token");
        localStorage.removeItem("occ_stateId");
        localStorage.removeItem("occ_stateName");
        store.token = null;
        store.stateId = null;
        store.stateName = null;
        render();
      });
    }
    root.querySelectorAll("[data-tab]").forEach((btn) => {
      btn.addEventListener("click", () => {
        store.activeTab = btn.dataset.tab;
        render();
      });
    });
  }

  async function refresh() {
    try {
      store.data = await api("/api/public");
      if (store.token && store.stateId) {
        try {
          store.dossier = await api("/api/my-dossier");
        } catch {
          // token invalid -- force re-login
          localStorage.removeItem("occ_token");
          store.token = null;
          store.stateId = null;
        }
      }
    } catch (e) {
      // keep last known data on transient network errors
    }
  }

  function render() {
    if (!store.token || !store.stateId) {
      renderLogin();
      return;
    }
    if (!store.data) {
      root.innerHTML = '<div class="center-wrap"><p class="muted">Loading Orange Countlandia…</p></div>';
      return;
    }
    const bill = store.data.bills[store.data.activeBillId];
    if (store.activeTab === "directory") renderDirectory(bill);
    else if (store.activeTab === "dossier") renderDossier();
    else if (store.activeTab === "history") renderHistory(bill);
    else renderFloor(bill);
    bindShellEvents();
  }

  // ---- "Message from the Capitol" broadcast -------------------------------
  // Lives outside #root (its own overlay div) so it survives every re-render
  // of the main content, and is checked independently of which tab a student
  // is on -- an announcement should interrupt regardless of what's showing.
  function checkAnnouncement() {
    const overlay = document.getElementById("announcementOverlay");
    if (!overlay || !store.token || !store.stateId) return;
    const a = store.data && store.data.announcement;
    if (!a || a.id === store.dismissedAnnouncementId) {
      return;
    }
    if (overlay.dataset.showingId === a.id) return; // already up, don't rebuild it under the reader
    overlay.dataset.showingId = a.id;
    overlay.innerHTML = `
      <div class="announce-backdrop">
        <div class="announce-card">
          <div class="announce-badge">📯 Message from the Capitol</div>
          <p class="announce-text">${esc(a.text)}</p>
          <button class="btn orange" id="dismissAnnounceBtn">Got it</button>
        </div>
      </div>
    `;
    document.getElementById("dismissAnnounceBtn").addEventListener("click", () => {
      store.dismissedAnnouncementId = a.id;
      localStorage.setItem("occ_dismissedAnnouncementId", a.id);
      overlay.innerHTML = "";
      delete overlay.dataset.showingId;
    });
  }

  async function boot() {
    await refresh();
    render();
    checkAnnouncement();
    setInterval(async () => {
      await refresh();
      if (!isEditingText()) render();
      checkAnnouncement();
    }, 2000);
  }

  boot();
})();

(() => {
  "use strict";

  const root = document.getElementById("root");
  const toastEl = document.getElementById("toast");

  const store = {
    token: sessionStorage.getItem("occ_presenter_token") || null,
    data: null,
    newBillOpen: false,
    manageBillOpen: false,
    newOptionOpen: false,
    editingOptionId: null,
    statesManagerOpen: false,
    editingStateId: null,
    uploadingAttachment: false,
    storageMode: null, // "database" | "file" -- fetched once after login, see refresh()
    maxUploadMB: 15, // fetched alongside storageMode; default matches file mode until then
  };

  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    setTimeout(() => toastEl.classList.remove("show"), 2400);
  }

  async function api(path, opts = {}) {
    const headers = Object.assign({ "Content-Type": "application/json" }, opts.headers || {});
    if (store.token) headers.Authorization = "Bearer " + store.token;
    const res = await fetch(path, Object.assign({}, opts, { headers }));
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || "Something went wrong.");
    return body;
  }

  // Multipart upload -- distinct from api() because a FormData body must NOT
  // get a manual Content-Type header (the browser sets the multipart
  // boundary itself); everything else about error handling matches api().
  async function apiUpload(path, formData) {
    const headers = {};
    if (store.token) headers.Authorization = "Bearer " + store.token;
    const res = await fetch(path, { method: "POST", headers, body: formData });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || "Something went wrong.");
    return body;
  }

  function fileSize(bytes) {
    if (bytes == null) return "";
    if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  }

  function esc(s) {
    return String(s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  function money(n) {
    return Number(n).toLocaleString() + " crowns";
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
  function thresholdBadge(t) {
    return { majority: "Simple majority (7 of 13)", super9: "9 of 13 states", unanimous13: "Unanimous (13 of 13)", simple: "Majority, both chambers", twothirds: "Two-thirds, both chambers" }[t] || t;
  }
  function roundKindLabel(round, bill) {
    if (round.kind === "final") return "Final vote";
    if (round.kind === "override") return "Override vote";
    if (round.kind === "amendment") {
      const a = bill.amendments.find((x) => x.id === round.amendmentId);
      return "Amendment vote: " + (a ? a.text : "");
    }
    return round.kind;
  }

  function tallyBarBig(result, mode) {
    if (!result) return "";
    const total = result.totalStates || 13;
    const pct = (n) => (n / total) * 100;
    let seatsBlock = "";
    if (mode === "CONST") {
      const seatPct = (n) => (n / result.totalHouseSeats) * 100;
      seatsBlock = `
        <div class="muted" style="margin:16px 0 2px;font-weight:700">House of Delegates &mdash; by population (needs ${result.neededSeats} of ${result.totalHouseSeats} seats)</div>
        <div class="threshold-mark"><div class="tick" style="left:${seatPct(result.neededSeats)}%"><span class="label">need ${result.neededSeats}</span></div></div>
        <div class="tally-bar" style="margin-top:30px;height:34px">
          <div class="seg yea" style="width:${seatPct(result.yeaSeats)}%"></div>
        </div>
        <p style="margin:4px 0 0"><strong>${result.yeaSeats} / ${result.totalHouseSeats} seats yea</strong> &mdash; ${result.housePassed ? "House passes" : "House falls short"}</p>
        <div class="muted" style="margin:18px 0 2px;font-weight:700">Senate &mdash; one vote per state (needs ${result.neededStates} of 13)</div>
      `;
    }
    return `
      ${seatsBlock}
      <div class="threshold-mark"><div class="tick" style="left:${pct(result.neededStates)}%"><span class="label">need ${result.neededStates}</span></div></div>
      <div class="tally-bar" style="margin-top:30px;height:34px">
        <div class="seg yea" style="width:${pct(result.yea)}%"></div>
        <div class="seg nay" style="width:${pct(result.nay)}%"></div>
        <div class="seg abstain" style="width:${pct(result.abstain)}%"></div>
      </div>
      <div class="tally-legend" style="font-size:1rem;margin-top:10px">
        <span><span class="dot yea"></span> Yea ${result.yea}</span>
        <span><span class="dot nay"></span> Nay ${result.nay}</span>
        <span><span class="dot abstain"></span> Abstain ${result.abstain}</span>
      </div>
      <p style="margin-top:12px;font-size:1.2rem"><strong>${result.passed ? "✓ Passes" : "✗ Does not pass"}</strong>${mode === "CONST" ? (result.passed ? "" : ` — ${result.senatePassed ? "" : "Senate short. "}${result.housePassed ? "" : "House short."}`) : ""}</p>
    `;
  }

  function houseBreakdownTableBig(result) {
    if (!result || result.mode !== "CONST" || !result.houseBreakdown) return "";
    const d = store.data;
    return `
      <div class="section-title" style="margin-top:16px">Delegation splits ${result.houseFinal ? "(final roll)" : "(projected &mdash; each state's seats roll for real when the vote closes)"}</div>
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

  // ---- login -------------------------------------------------------------
  function renderLogin() {
    root.innerHTML = `
      <div class="center-wrap">
        <div class="card" style="max-width:420px;width:100%">
          <div class="hero" style="margin-top:0">
            <div class="fruit-big"></div>
            <h1>Presenter Login</h1>
            <p class="muted">Congress of the Federation control room</p>
          </div>
          <div class="field">
            <label for="pass">Presenter passcode</label>
            <input id="pass" type="password" placeholder="passcode" />
          </div>
          <button class="btn orange" id="loginBtn" style="width:100%">Enter</button>
        </div>
      </div>
    `;
    const go = async () => {
      try {
        const result = await api("/api/presenter/login", { method: "POST", body: JSON.stringify({ passcode: document.getElementById("pass").value }) });
        store.token = result.token;
        sessionStorage.setItem("occ_presenter_token", store.token);
        await refresh();
        render();
      } catch (e) {
        toast(e.message);
      }
    };
    document.getElementById("loginBtn").addEventListener("click", go);
    document.getElementById("pass").addEventListener("keydown", (e) => {
      if (e.key === "Enter") go();
    });
  }

  // ---- action helpers ------------------------------------------------------
  async function act(fn) {
    try {
      await fn();
      await refresh();
      render();
    } catch (e) {
      toast(e.message);
    }
  }

  // ---- main render ---------------------------------------------------------
  function render() {
    if (!store.token) return renderLogin();
    if (!store.data) {
      root.innerHTML = '<div class="center-wrap"><p class="muted">Loading…</p></div>';
      return;
    }
    const d = store.data;
    const bill = d.bills[d.activeBillId];
    const openRound = bill.rounds.find((r) => r.status === "open");
    const lastClosed = bill.rounds.filter((r) => r.status === "closed").slice(-1)[0];
    const joinUrl = window.location.origin + "/";

    root.innerHTML = `
      <div class="topbar">
        <div class="brand"><span class="fruit"></span> Orange Countlandia &mdash; Presenter</div>
        <div class="spacer"></div>
        ${storageBadge()}
        <label class="pill" style="cursor:pointer">
          <input type="checkbox" id="revealToggle" ${d.revealVotesLive ? "checked" : ""} style="margin-right:6px" />
          Reveal votes live
        </label>
        <button class="btn ghost small" id="logoutAllBtn" style="background:transparent;color:#fff;border-color:#fff">Log out all students</button>
      </div>
      <div class="app-shell">
        <div class="card" style="margin-top:18px">
          <div class="controls-bar" style="justify-content:space-between">
            <div>
              <div class="section-title">Students join at</div>
              <div style="font-family:monospace;font-size:1.1rem">${esc(joinUrl)}</div>
            </div>
            <div>
              <div class="section-title">Governing document</div>
              <div class="controls-bar">
                <button class="btn ${d.mode === "AOC" ? "orange" : "ghost"} small" data-mode="AOC">Articles of Confederation</button>
                <button class="btn ${d.mode === "CONST" ? "orange" : "ghost"} small" data-mode="CONST">The Constitution</button>
              </div>
            </div>
          </div>
        </div>

        ${announceCard(d)}
        ${congressSettingsCard(d)}

        <div class="card">
          <div class="controls-bar" style="justify-content:space-between">
            <div>
              <label style="margin-bottom:2px">Active bill</label>
              <select id="billSelect">
                ${Object.values(d.bills).map((b) => `<option value="${b.id}" ${b.id === d.activeBillId ? "selected" : ""}>${esc(b.title)}</option>`).join("")}
              </select>
            </div>
            <button class="btn ghost small" id="newBillBtn">+ New bill</button>
          </div>
          ${
            store.newBillOpen
              ? `<div style="margin-top:14px">
                  <div class="field"><label>Title</label><input id="newBillTitle" placeholder="e.g. The Coastal Trade Act" /></div>
                  <div class="field"><label>Summary</label><textarea id="newBillSummary" rows="2"></textarea></div>
                  <button class="btn orange small" id="createBillBtn">Create &amp; switch to it</button>
                </div>`
              : ""
          }
        </div>

        ${billCard(bill, d)}
        ${amendmentsCard(bill, d)}
        ${votingCard(bill, d, openRound)}
        ${resultCard(bill, lastClosed)}
        ${historyCard(bill, d)}
        ${statesManagerCard(d)}
        ${dangerZoneCard()}
      </div>
    `;
    bindEvents(bill, d, openRound);
  }

  // ---- storage status badge --------------------------------------------------
  function storageBadge() {
    if (store.storageMode === "database") {
      return `<span class="pill" title="Everything -- bills, votes, passcodes, settings, AND uploaded materials up to ${store.maxUploadMB}MB -- is saved to an external database and survives a restart." style="background:#1e8449;color:#fff">💾 Saved to database</span>`;
    }
    if (store.storageMode === "file") {
      return `<span class="pill" title="Everything lives only on this instance's temporary disk -- it resets if the server restarts or redeploys (see the README to connect a free database instead)." style="background:#a04000;color:#fff">⚠️ Temporary storage</span>`;
    }
    return ""; // not loaded yet
  }

  // ---- danger zone -----------------------------------------------------------
  function dangerZoneCard() {
    return `
      <div class="card" style="border:1px solid #c0392b">
        <h3 style="color:#c0392b">Danger zone</h3>
        <p class="muted">Wipes every state, bill, vote, amendment, uploaded material, and passcode back to exactly what <code>seed.js</code> defines, and logs out every student. Use this to start a brand-new semester from a clean slate -- there's no undo.</p>
        <button class="btn ghost small" id="factoryResetBtn" style="border-color:#c0392b;color:#c0392b">Factory reset everything</button>
      </div>
    `;
  }

  // ---- Message the class ("a message from the Capitol") --------------------
  function announceCard(d) {
    const a = d.announcement;
    return `
      <div class="card">
        <h3>Message the class</h3>
        <p class="muted">Pops up on every logged-in student's screen until they dismiss it &mdash; good for "Voting starts in 5 minutes" or "A new amendment was just proposed."</p>
        <div class="field">
          <textarea id="announceText" rows="2" placeholder="e.g. Voting on the Railway Act begins in 5 minutes."></textarea>
        </div>
        <div class="controls-bar">
          <button class="btn orange small" id="sendAnnounceBtn">Send to all students</button>
          <button class="btn ghost small" id="clearAnnounceBtn" ${a ? "" : "disabled"}>Clear current message</button>
        </div>
        ${
          a
            ? `<p class="muted" style="margin-top:8px">Current message (sent ${esc(new Date(a.createdAt).toLocaleTimeString())}): &ldquo;${esc(a.text)}&rdquo;</p>`
            : `<p class="muted" style="margin-top:8px">No message is currently showing.</p>`
        }
      </div>
    `;
  }

  // ---- Congress settings (house size / delegation unity) -------------------
  function congressSettingsCard(d) {
    return `
      <div class="card">
        <h3>Congress settings</h3>
        <div class="controls-bar" style="align-items:flex-end">
          <div class="field" style="max-width:170px;margin-bottom:0">
            <label>House size (total seats)</label>
            <input type="number" id="houseSizeInput" min="13" max="435" value="${d.houseSizeTarget}" />
          </div>
          <button class="btn ghost small" id="houseSizeSaveBtn">Update</button>
          <div class="field" style="max-width:260px;margin-bottom:0">
            <label>Delegation unity (Constitution mode)</label>
            <select id="unitySelect">
              <option value="solid" ${d.delegationUnity === "solid" ? "selected" : ""}>Solid &mdash; seats rarely split</option>
              <option value="realistic" ${d.delegationUnity === "realistic" ? "selected" : ""}>Realistic &mdash; some seats break away</option>
              <option value="chaotic" ${d.delegationUnity === "chaotic" ? "selected" : ""}>Chaotic &mdash; delegations badly split</option>
            </select>
          </div>
          <button class="btn ghost small" id="unitySaveBtn">Update</button>
        </div>
        <p class="muted" style="margin-top:10px">${d.totalHouseSeats} House seats are currently apportioned automatically by state population (largest-remainder method). In Constitution mode, when a vote closes, each state's own seats are rolled independently &mdash; real delegations rarely vote as one bloc, and this setting controls how often a seat breaks from its state's declared position.</p>
      </div>
    `;
  }

  // ---- Bill card + editing ---------------------------------------------------
  function servedCheckboxes(d, selectedIds) {
    const sel = selectedIds || [];
    return `<div class="grid states" style="grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:4px">
      ${d.stateOrder
        .map(
          (id) => `
        <label style="display:flex;align-items:center;gap:6px;font-weight:400;font-size:0.85rem;margin-bottom:0">
          <input type="checkbox" data-served="${id}" ${sel.includes(id) ? "checked" : ""} style="width:auto" />
          ${esc(d.states[id].name)}
        </label>`
        )
        .join("")}
    </div>`;
  }

  function optionAddForm(d) {
    return `
      <div class="amendment-item" id="newOptionForm">
        <div class="field"><label>Name</label><input id="newOptName" placeholder="e.g. Coastal Spur Plan" /></div>
        <div class="field"><label>Detail</label><textarea id="newOptDetail" rows="2"></textarea></div>
        <div class="field"><label>Cost in crowns (optional)</label><input id="newOptCost" type="number" placeholder="leave blank for none" /></div>
        <div class="field"><label>Serves</label>${servedCheckboxes(d, [])}</div>
        <div class="controls-bar">
          <button class="btn orange small" id="createOptionBtn">Add option</button>
          <button class="btn ghost small" id="cancelNewOptionBtn">Cancel</button>
        </div>
      </div>`;
  }

  function optionEditRow(o, d, roundOpen) {
    if (store.editingOptionId === o.id) {
      return `
        <div class="amendment-item" id="optionEditForm_${o.id}">
          <div class="field"><label>Name</label><input id="optName_${o.id}" value="${esc(o.name)}" /></div>
          <div class="field"><label>Detail</label><textarea id="optDetail_${o.id}" rows="2">${esc(o.detail)}</textarea></div>
          <div class="field"><label>Cost in crowns (optional)</label><input id="optCost_${o.id}" type="number" value="${o.cost != null ? o.cost : ""}" /></div>
          <div class="field"><label>Serves</label>${servedCheckboxes(d, o.servedStateIds || [])}</div>
          <div class="controls-bar">
            <button class="btn orange small" data-save-option="${o.id}">Save option</button>
            <button class="btn ghost small" data-cancel-option="${o.id}">Cancel</button>
          </div>
        </div>`;
    }
    return `
      <div class="route-option" style="cursor:default">
        <strong>${esc(o.name)}</strong>${o.cost != null ? ` &mdash; ${money(o.cost)}` : ""}
        <p style="margin:6px 0 4px">${esc(o.detail)}</p>
        ${o.servedStateIds && o.servedStateIds.length ? `<div class="muted" style="font-size:0.82rem">Serves: ${o.servedStateIds.map((id) => esc(d.states[id].name)).join(", ")}</div>` : ""}
        <div class="controls-bar" style="margin-top:8px">
          <button class="btn ghost small" data-edit-option="${o.id}" ${roundOpen ? "disabled" : ""}>Edit</button>
          <button class="btn red small" data-delete-option="${o.id}" ${roundOpen ? "disabled" : ""}>Delete</button>
        </div>
      </div>`;
  }

  function materialsReadOnlyHtml(attachments) {
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

  function materialsEditHtml(bill) {
    const attachments = bill.attachments || [];
    return `
      <div class="section-title">Materials (maps, reports &mdash; images or PDFs)</div>
      ${
        attachments.length
          ? `<div class="materials-grid">
              ${attachments
                .map(
                  (a) => `
                <div class="material-item">
                  ${
                    a.mimeType && a.mimeType.startsWith("image/")
                      ? `<img src="${a.url}" alt="${esc(a.label)}" />`
                      : `<div class="material-pdf-icon">📄</div>`
                  }
                  <div class="material-label">${esc(a.label)}</div>
                  <div class="material-meta">${fileSize(a.sizeBytes)}</div>
                  <div class="controls-bar" style="margin-top:6px">
                    <a class="btn ghost small" href="${a.url}" target="_blank" rel="noopener">View</a>
                    <button class="btn red small" data-delete-attachment="${a.id}">Delete</button>
                  </div>
                </div>`
                )
                .join("")}
            </div>`
          : '<p class="muted">No materials attached yet.</p>'
      }
      <div id="attachmentUploadForm" style="margin-top:10px">
        <div class="field"><label>Label</label><input id="newAttachmentLabel" placeholder="e.g. Proposed Route Map" /></div>
        <div class="field"><label>File (image or PDF, up to ${store.maxUploadMB}MB)</label><input id="newAttachmentFile" type="file" accept="image/png,image/jpeg,image/gif,image/webp,application/pdf" /></div>
        <button class="btn orange small" id="uploadAttachmentBtn" ${store.uploadingAttachment ? "disabled" : ""}>${store.uploadingAttachment ? "Uploading…" : "Upload"}</button>
      </div>
    `;
  }

  function billEditForm(bill, d, roundOpen) {
    return `
      <div class="field"><label>Title</label><input id="editBillTitle" value="${esc(bill.title)}" /></div>
      <div class="field"><label>Summary</label><textarea id="editBillSummary" rows="2">${esc(bill.summary)}</textarea></div>
      <div class="controls-bar">
        <button class="btn orange small" id="saveBillBtn">Save title &amp; summary</button>
        <button class="btn red small" id="deleteBillBtn" ${Object.keys(d.bills).length <= 1 ? "disabled" : ""}>Delete this bill</button>
      </div>
      <hr class="divider" />
      ${materialsEditHtml(bill)}
      <hr class="divider" />
      <div class="section-title">Options${roundOpen ? " (close the open vote to edit)" : ""}</div>
      ${(bill.options || []).map((o) => optionEditRow(o, d, roundOpen)).join("") || '<p class="muted">No options yet.</p>'}
      ${
        store.newOptionOpen
          ? optionAddForm(d)
          : `<button class="btn ghost small" id="addOptionBtn" ${roundOpen ? "disabled" : ""}>+ Add option</button>`
      }
    `;
  }

  function billCard(bill, d) {
    const roundOpen = !!bill.rounds.find((r) => r.status === "open");
    return `
      <div class="card">
        <div class="controls-bar" style="justify-content:space-between">
          <span class="pill ${statusPillClass(bill.status)}">${statusLabel(bill.status)}</span>
          <button class="btn ghost small" id="toggleManageBillBtn">${store.manageBillOpen ? "Done editing" : "Edit bill"}</button>
        </div>
        ${
          store.manageBillOpen
            ? billEditForm(bill, d, roundOpen)
            : `
          <h2 style="margin-top:10px">${esc(bill.title)}</h2>
          <p>${esc(bill.summary)}</p>
          ${materialsReadOnlyHtml(bill.attachments)}
          ${
            bill.options && bill.options.length
              ? `
            <div class="section-title">Option on the floor (change freely between votes)</div>
            ${bill.options
              .map(
                (o) => `
              <div class="route-option${o.id === bill.activeOptionId ? " active" : ""}" data-option="${o.id}" style="${roundOpen ? "opacity:.6;cursor:not-allowed" : ""}">
                <strong>${esc(o.name)}</strong>${o.cost != null ? ` &mdash; ${money(o.cost)}` : ""}
                <p style="margin:6px 0 4px">${esc(o.detail)}</p>
                ${o.servedStateIds && o.servedStateIds.length ? `<div class="muted" style="font-size:0.82rem">Serves: ${o.servedStateIds.map((id) => esc(d.states[id].name)).join(", ")} &middot; ${13 - o.servedStateIds.length} states unserved</div>` : ""}
              </div>`
              )
              .join("")}
          `
              : '<p class="muted">This bill has no defined options yet &mdash; click "Edit bill" to add some, or just vote it up or down as written.</p>'
          }
        `
        }
        ${
          bill.status === "passed_awaiting_president"
            ? `
          <div class="card" style="background:#fdf7ea;border-color:var(--gold);margin-top:12px;margin-bottom:0">
            <h3>The bill is on the President's desk</h3>
            <p class="muted">Both chambers passed it. As President, sign it into law or veto it.</p>
            <div class="controls-bar">
              <button class="btn green" id="signBtn">Sign into law</button>
              <button class="btn red" id="vetoBtn">Veto</button>
            </div>
          </div>`
            : ""
        }
        ${
          bill.status === "vetoed" && !roundOpen
            ? `
          <div class="card" style="background:#fdece9;border-color:var(--red);margin-top:12px;margin-bottom:0">
            <h3>Vetoed</h3>
            <p class="muted">Congress may attempt to override with two-thirds of both chambers.</p>
            <button class="btn orange" id="openOverrideBtn">Open override vote</button>
          </div>`
            : ""
        }
        <div class="controls-bar" style="margin-top:14px">
          <button class="btn ghost small" id="resetBillBtn">Reset this bill (clear votes &amp; amendments)</button>
        </div>
      </div>
    `;
  }

  function amendmentsCard(bill, d) {
    const pending = bill.amendments.filter((a) => a.status === "pending");
    const approved = bill.amendments.filter((a) => a.status === "approved");
    const decided = bill.amendments.filter((a) => ["adopted", "rejected", "failed"].includes(a.status));
    const roundOpen = !!bill.rounds.find((r) => r.status === "open");
    function row(a, actions) {
      const proposer = d.states[a.proposedByStateId];
      return `
        <div class="amendment-item">
          <div>${esc(a.text)}</div>
          <div class="meta">Proposed by ${proposer ? esc(proposer.name) : "?"} &middot; ${a.status}</div>
          <div class="controls-bar" style="margin-top:6px">${actions}</div>
        </div>`;
    }
    return `
      <div class="card">
        <h3>Amendments</h3>
        <div class="section-title">Pending review</div>
        ${
          pending.length
            ? pending
                .map((a) =>
                  row(
                    a,
                    `<button class="btn green small" data-amend-approve="${a.id}">Approve</button>
                     <button class="btn red small" data-amend-reject="${a.id}">Reject</button>`
                  )
                )
                .join("")
            : '<p class="muted">None right now.</p>'
        }
        <div class="section-title" style="margin-top:14px">Approved &mdash; ready for a vote</div>
        ${
          approved.length
            ? approved
                .map((a) =>
                  row(
                    a,
                    `<select data-threshold-for="${a.id}">
                      ${thresholdOptions(d.mode, "majority")}
                    </select>
                    <button class="btn orange small" data-amend-vote="${a.id}" ${roundOpen ? "disabled" : ""}>Open vote on this amendment</button>`
                  )
                )
                .join("")
            : '<p class="muted">None right now.</p>'
        }
        <div class="section-title" style="margin-top:14px">Decided</div>
        ${decided.length ? decided.slice().reverse().map((a) => row(a, "")).join("") : '<p class="muted">None yet.</p>'}
      </div>
    `;
  }

  function thresholdOptions(mode, selected) {
    const opts =
      mode === "CONST"
        ? [
            ["simple", "Simple majority, both chambers"],
            ["twothirds", "Two-thirds, both chambers"],
          ]
        : [
            ["majority", "Simple majority (7 of 13)"],
            ["super9", "9 of 13 states"],
            ["unanimous13", "Unanimous (13 of 13)"],
          ];
    return opts.map(([v, label]) => `<option value="${v}" ${v === selected ? "selected" : ""}>${label}</option>`).join("");
  }

  function votingCard(bill, d, openRound) {
    if (openRound) {
      const votedIds = openRound.votedStateIds;
      return `
        <div class="card" style="border-color:var(--orange)">
          <span class="pill status-open">${esc(roundKindLabel(openRound, bill))}</span>
          <p class="muted" style="margin-top:8px">Threshold: ${thresholdBadge(openRound.thresholdType)} under ${modeLabel(openRound.mode)}</p>
          <h2 style="margin:6px 0">${votedIds.length} of 13 states have voted</h2>
          <div class="grid states" style="grid-template-columns:repeat(auto-fill,minmax(140px,1fr))">
            ${d.stateOrder
              .map((id) => {
                const s = d.states[id];
                const voted = votedIds.includes(id);
                return `<div class="tag" style="padding:6px 10px;${voted ? "border-color:var(--green);background:#eafaf0" : ""}">${voted ? "✓ " : "… "}${esc(s.name)}</div>`;
              })
              .join("")}
          </div>
          ${d.revealVotesLive && openRound.result ? tallyBarBig(openRound.result, openRound.mode) + houseBreakdownTableBig(openRound.result) : ""}
          <button class="btn red" id="closeRoundBtn" style="margin-top:16px">Close this vote &amp; tally</button>
        </div>
      `;
    }
    return `
      <div class="card">
        <h3>Open a vote</h3>
        <div class="controls-bar">
          <select id="finalThreshold">${thresholdOptions(d.mode, d.mode === "CONST" ? "simple" : "super9")}</select>
          <button class="btn orange" id="openFinalBtn">Open final vote on this bill</button>
        </div>
      </div>
    `;
  }

  function resultCard(bill, lastClosed) {
    if (!lastClosed) return "";
    return `
      <div class="card">
        <span class="pill ${lastClosed.result.passed ? "status-passed" : "status-failed"}">Most recent result</span>
        <h3 style="margin-top:8px">${esc(roundKindLabel(lastClosed, bill))}</h3>
        ${tallyBarBig(lastClosed.result, lastClosed.mode)}
        ${houseBreakdownTableBig(lastClosed.result)}
      </div>
    `;
  }

  function historyCard(bill, d) {
    const closed = bill.rounds.filter((r) => r.status === "closed").slice().reverse();
    if (!closed.length) return "";
    return `
      <div class="card">
        <h3>Full history on this bill</h3>
        ${closed
          .map(
            (r) => `
          <div style="padding:10px 0;border-bottom:1px solid var(--border)">
            <span class="pill ${r.result.passed ? "status-passed" : "status-failed"}">${r.result.passed ? "Passed" : "Failed"}</span>
            <strong style="margin-left:8px">${esc(roundKindLabel(r, bill))}</strong>
            <span class="muted"> &middot; ${modeLabel(r.mode)} &middot; ${thresholdBadge(r.thresholdType)} &middot; Yea ${r.result.yea} / Nay ${r.result.nay} / Abstain ${r.result.abstain}${r.mode === "CONST" ? ` &middot; ${r.result.yeaSeats}/${r.result.totalHouseSeats} seats` : ""}</span>
          </div>`
          )
          .join("")}
      </div>
    `;
  }

  // ---- Manage states -------------------------------------------------------
  function stateManagerTile(s) {
    if (store.editingStateId === s.id) {
      return `
        <div class="card" id="stateEditForm_${s.id}" style="margin-bottom:0">
          <div class="field"><label>Name</label><input id="stName_${s.id}" value="${esc(s.name)}" /></div>
          <div class="field"><label>Motto</label><input id="stMotto_${s.id}" value="${esc(s.motto)}" /></div>
          <div class="field"><label>Student login passcode</label><input id="stPasscode_${s.id}" value="${esc(s.passcode || "")}" /></div>
          <div class="field"><label>Color</label><input id="stColor_${s.id}" type="color" value="${s.color}" style="height:38px;padding:2px" /></div>
          <div class="field"><label>Population</label><input id="stPop_${s.id}" type="number" min="0" value="${s.population}" /></div>
          <div class="field"><label>Industries (one per line)</label><textarea id="stInd_${s.id}" rows="3">${esc((s.profile.industries || []).join("\n"))}</textarea></div>
          <div class="field"><label>Priorities (one per line)</label><textarea id="stPri_${s.id}" rows="3">${esc((s.profile.priorities || []).join("\n"))}</textarea></div>
          <div class="field"><label>Public blurb (shown in the State Directory)</label><textarea id="stBlurb_${s.id}" rows="3">${esc(s.profile.blurb)}</textarea></div>
          <div class="field"><label>Private dossier (visible only to this state's own login)</label><textarea id="stDossier_${s.id}" rows="4">${esc(s.dossier ? s.dossier.text : "")}</textarea></div>
          <div class="controls-bar">
            <button class="btn orange small" data-save-state="${s.id}">Save</button>
            <button class="btn ghost small" data-cancel-state="${s.id}">Cancel</button>
          </div>
        </div>`;
    }
    return `
      <div class="card" style="margin-bottom:0">
        <div class="swatch" style="background:${s.color};height:6px;border-radius:4px;margin-bottom:8px"></div>
        <h4 style="margin-bottom:2px">${esc(s.name)}</h4>
        <div class="muted" style="font-style:italic;margin-bottom:6px">${esc(s.motto)} &middot; pop. ${s.population.toLocaleString()}</div>
        <div class="muted" style="margin-bottom:6px">Passcode: <strong style="font-family:monospace">${esc(s.passcode || "(none set)")}</strong></div>
        <div class="dossier-box"><p style="margin:0">${esc(s.dossier ? s.dossier.text : "")}</p></div>
        <div class="controls-bar" style="margin-top:10px">
          <button class="btn ghost small" data-edit-state="${s.id}">Edit</button>
        </div>
      </div>`;
  }

  function statesManagerCard(d) {
    return `
      <details class="card" id="statesManager" ${store.statesManagerOpen ? "open" : ""}>
        <summary style="cursor:pointer;font-weight:700;font-family:'Fraunces',serif;font-size:1.1rem">Manage states (profiles, dossiers &amp; population)</summary>
        <p class="muted" style="margin-top:10px">Population drives House apportionment automatically &mdash; change it here and seats reapportion on the next vote.</p>
        <div class="grid states" style="margin-top:14px">
          ${d.stateOrder.map((id) => stateManagerTile(d.states[id])).join("")}
        </div>
      </details>
    `;
  }

  // ---- events ----------------------------------------------------------
  function bindEvents(bill, d, openRound) {
    const rebind = (sel, evt, fn) => root.querySelectorAll(sel).forEach((el) => el.addEventListener(evt, fn));

    document.getElementById("revealToggle").addEventListener("change", (e) =>
      act(() => api("/api/presenter/reveal", { method: "POST", body: JSON.stringify({ revealVotesLive: e.target.checked }) }))
    );
    document.getElementById("logoutAllBtn").addEventListener("click", () =>
      act(() => api("/api/presenter/logout-all", { method: "POST" })).then(() => toast("All student logins cleared."))
    );
    document.getElementById("factoryResetBtn").addEventListener("click", () => {
      if (!confirm("This wipes every state, bill, vote, and passcode back to seed.js and cannot be undone. Continue?")) return;
      act(() => api("/api/presenter/factory-reset", { method: "POST" })).then(() => toast("Reset to a fresh start."));
    });
    rebind("[data-mode]", "click", (e) => act(() => api("/api/presenter/mode", { method: "POST", body: JSON.stringify({ mode: e.currentTarget.dataset.mode }) })));

    document.getElementById("sendAnnounceBtn").addEventListener("click", () => {
      const text = document.getElementById("announceText").value.trim();
      if (!text) return toast("Write a message first.");
      act(() => api("/api/presenter/announcement", { method: "POST", body: JSON.stringify({ text }) })).then(() => toast("Sent to all students."));
    });
    document.getElementById("clearAnnounceBtn").addEventListener("click", () =>
      act(() => api("/api/presenter/announcement/clear", { method: "POST" }))
    );

    document.getElementById("houseSizeSaveBtn").addEventListener("click", () =>
      act(() => api("/api/presenter/house-size", { method: "POST", body: JSON.stringify({ size: Number(document.getElementById("houseSizeInput").value) }) })).then(() => toast("House size updated."))
    );
    document.getElementById("unitySaveBtn").addEventListener("click", () =>
      act(() => api("/api/presenter/delegation-unity", { method: "POST", body: JSON.stringify({ unity: document.getElementById("unitySelect").value }) })).then(() => toast("Delegation unity updated."))
    );

    document.getElementById("billSelect").addEventListener("change", (e) =>
      act(() => api("/api/presenter/active-bill", { method: "POST", body: JSON.stringify({ billId: e.target.value }) }))
    );
    document.getElementById("newBillBtn").addEventListener("click", () => {
      store.newBillOpen = !store.newBillOpen;
      render();
    });
    const createBillBtn = document.getElementById("createBillBtn");
    if (createBillBtn) {
      createBillBtn.addEventListener("click", () =>
        act(() =>
          api("/api/presenter/new-bill", {
            method: "POST",
            body: JSON.stringify({
              title: document.getElementById("newBillTitle").value,
              summary: document.getElementById("newBillSummary").value,
            }),
          })
        ).then(() => {
          store.newBillOpen = false;
        })
      );
    }

    const roundOpen = !!openRound;

    // Bill editing toggle
    document.getElementById("toggleManageBillBtn").addEventListener("click", () => {
      store.manageBillOpen = !store.manageBillOpen;
      store.newOptionOpen = false;
      store.editingOptionId = null;
      render();
    });

    if (store.manageBillOpen) {
      const saveBillBtn = document.getElementById("saveBillBtn");
      if (saveBillBtn) {
        saveBillBtn.addEventListener("click", () =>
          act(() =>
            api(`/api/presenter/bills/${bill.id}`, {
              method: "POST",
              body: JSON.stringify({
                title: document.getElementById("editBillTitle").value,
                summary: document.getElementById("editBillSummary").value,
              }),
            })
          ).then(() => toast("Bill updated."))
        );
      }
      const deleteBillBtn = document.getElementById("deleteBillBtn");
      if (deleteBillBtn) {
        deleteBillBtn.addEventListener("click", () => {
          if (!confirm(`Delete "${bill.title}" entirely? This can't be undone.`)) return;
          act(() => api(`/api/presenter/bills/${bill.id}/delete`, { method: "POST" })).then(() => {
            store.manageBillOpen = false;
          });
        });
      }
      const uploadAttachmentBtn = document.getElementById("uploadAttachmentBtn");
      if (uploadAttachmentBtn) {
        uploadAttachmentBtn.addEventListener("click", async () => {
          const fileInput = document.getElementById("newAttachmentFile");
          const file = fileInput.files[0];
          if (!file) return toast("Choose a file first.");
          const label = document.getElementById("newAttachmentLabel").value;
          const fd = new FormData();
          fd.append("file", file);
          if (label) fd.append("label", label);
          store.uploadingAttachment = true;
          render();
          try {
            await apiUpload(`/api/presenter/bills/${bill.id}/attachments`, fd);
            toast("Uploaded.");
          } catch (e) {
            toast(e.message);
          }
          store.uploadingAttachment = false;
          await refresh();
          render();
        });
      }
      rebind("[data-delete-attachment]", "click", (e) => {
        const id = e.currentTarget.dataset.deleteAttachment;
        if (!confirm("Delete this material?")) return;
        act(() => api(`/api/presenter/bills/${bill.id}/attachments/${id}/delete`, { method: "POST" }));
      });
      const addOptionBtn = document.getElementById("addOptionBtn");
      if (addOptionBtn) {
        addOptionBtn.addEventListener("click", () => {
          store.newOptionOpen = true;
          render();
        });
      }
      const cancelNewOptionBtn = document.getElementById("cancelNewOptionBtn");
      if (cancelNewOptionBtn) {
        cancelNewOptionBtn.addEventListener("click", () => {
          store.newOptionOpen = false;
          render();
        });
      }
      const createOptionBtn = document.getElementById("createOptionBtn");
      if (createOptionBtn) {
        createOptionBtn.addEventListener("click", () => {
          const form = document.getElementById("newOptionForm");
          const servedStateIds = Array.from(form.querySelectorAll("[data-served]:checked")).map((el) => el.dataset.served);
          act(() =>
            api(`/api/presenter/bills/${bill.id}/options/add`, {
              method: "POST",
              body: JSON.stringify({
                name: document.getElementById("newOptName").value,
                detail: document.getElementById("newOptDetail").value,
                cost: document.getElementById("newOptCost").value,
                servedStateIds,
              }),
            })
          ).then(() => {
            store.newOptionOpen = false;
          });
        });
      }
      rebind("[data-edit-option]", "click", (e) => {
        store.editingOptionId = e.currentTarget.dataset.editOption;
        render();
      });
      rebind("[data-cancel-option]", "click", () => {
        store.editingOptionId = null;
        render();
      });
      rebind("[data-save-option]", "click", (e) => {
        const id = e.currentTarget.dataset.saveOption;
        const form = document.getElementById(`optionEditForm_${id}`);
        const servedStateIds = Array.from(form.querySelectorAll("[data-served]:checked")).map((el) => el.dataset.served);
        act(() =>
          api(`/api/presenter/bills/${bill.id}/options/${id}`, {
            method: "POST",
            body: JSON.stringify({
              name: document.getElementById(`optName_${id}`).value,
              detail: document.getElementById(`optDetail_${id}`).value,
              cost: document.getElementById(`optCost_${id}`).value,
              servedStateIds,
            }),
          })
        ).then(() => {
          store.editingOptionId = null;
        });
      });
      rebind("[data-delete-option]", "click", (e) => {
        const id = e.currentTarget.dataset.deleteOption;
        if (!confirm("Delete this option?")) return;
        act(() => api(`/api/presenter/bills/${bill.id}/options/${id}/delete`, { method: "POST" }));
      });
    } else {
      rebind("[data-option]", "click", (e) => {
        if (roundOpen) return;
        act(() => api("/api/presenter/active-option", { method: "POST", body: JSON.stringify({ billId: bill.id, optionId: e.currentTarget.dataset.option }) }));
      });
    }

    rebind("[data-amend-approve]", "click", (e) => act(() => api(`/api/presenter/amendments/${e.currentTarget.dataset.amendApprove}/status`, { method: "POST", body: JSON.stringify({ status: "approved" }) })));
    rebind("[data-amend-reject]", "click", (e) => act(() => api(`/api/presenter/amendments/${e.currentTarget.dataset.amendReject}/status`, { method: "POST", body: JSON.stringify({ status: "rejected" }) })));
    rebind("[data-amend-vote]", "click", (e) => {
      const id = e.currentTarget.dataset.amendVote;
      const thresholdType = root.querySelector(`[data-threshold-for="${id}"]`).value;
      act(() => api("/api/presenter/rounds/open", { method: "POST", body: JSON.stringify({ billId: bill.id, kind: "amendment", amendmentId: id, thresholdType }) }));
    });

    const openFinalBtn = document.getElementById("openFinalBtn");
    if (openFinalBtn) {
      openFinalBtn.addEventListener("click", () =>
        act(() =>
          api("/api/presenter/rounds/open", {
            method: "POST",
            body: JSON.stringify({ billId: bill.id, kind: "final", thresholdType: document.getElementById("finalThreshold").value }),
          })
        )
      );
    }
    const closeRoundBtn = document.getElementById("closeRoundBtn");
    if (closeRoundBtn) {
      closeRoundBtn.addEventListener("click", () => act(() => api(`/api/presenter/rounds/${openRound.id}/close`, { method: "POST" })));
    }
    const signBtn = document.getElementById("signBtn");
    if (signBtn) signBtn.addEventListener("click", () => act(() => api("/api/presenter/president", { method: "POST", body: JSON.stringify({ billId: bill.id, decision: "sign" }) })));
    const vetoBtn = document.getElementById("vetoBtn");
    if (vetoBtn) vetoBtn.addEventListener("click", () => act(() => api("/api/presenter/president", { method: "POST", body: JSON.stringify({ billId: bill.id, decision: "veto" }) })));
    const openOverrideBtn = document.getElementById("openOverrideBtn");
    if (openOverrideBtn)
      openOverrideBtn.addEventListener("click", () =>
        act(() => api("/api/presenter/rounds/open", { method: "POST", body: JSON.stringify({ billId: bill.id, kind: "override" }) }))
      );
    const resetBillBtn = document.getElementById("resetBillBtn");
    if (resetBillBtn)
      resetBillBtn.addEventListener("click", () => {
        if (!confirm("Clear all votes and amendments on this bill? This can't be undone.")) return;
        act(() => api("/api/presenter/reset-bill", { method: "POST", body: JSON.stringify({ billId: bill.id }) }));
      });

    // States manager
    const statesManagerEl = document.getElementById("statesManager");
    if (statesManagerEl) {
      statesManagerEl.addEventListener("toggle", () => {
        store.statesManagerOpen = statesManagerEl.open;
      });
    }
    rebind("[data-edit-state]", "click", (e) => {
      store.editingStateId = e.currentTarget.dataset.editState;
      store.statesManagerOpen = true;
      render();
    });
    rebind("[data-cancel-state]", "click", () => {
      store.editingStateId = null;
      render();
    });
    rebind("[data-save-state]", "click", (e) => {
      const id = e.currentTarget.dataset.saveState;
      act(() =>
        api(`/api/presenter/states/${id}`, {
          method: "POST",
          body: JSON.stringify({
            name: document.getElementById(`stName_${id}`).value,
            motto: document.getElementById(`stMotto_${id}`).value,
            passcode: document.getElementById(`stPasscode_${id}`).value,
            color: document.getElementById(`stColor_${id}`).value,
            population: document.getElementById(`stPop_${id}`).value,
            profile: {
              industries: document.getElementById(`stInd_${id}`).value,
              priorities: document.getElementById(`stPri_${id}`).value,
              blurb: document.getElementById(`stBlurb_${id}`).value,
            },
            dossier: { text: document.getElementById(`stDossier_${id}`).value },
          }),
        })
      ).then(() => {
        store.editingStateId = null;
        store.statesManagerOpen = true;
        toast("State updated.");
      });
    });
  }

  async function refresh() {
    if (!store.token) return;
    try {
      store.data = await api("/api/presenter/full");
      // Static for the life of the deployed instance -- fetch once, not on
      // every 2-second poll.
      if (!store.storageMode) {
        const status = await api("/api/presenter/storage-status");
        store.storageMode = status.mode;
        store.maxUploadMB = status.maxUploadMB;
      }
    } catch (e) {
      if (String(e.message).toLowerCase().includes("presenter")) {
        store.token = null;
        sessionStorage.removeItem("occ_presenter_token");
      }
    }
  }

  function isEditingText() {
    const ae = document.activeElement;
    return !!ae && (ae.tagName === "TEXTAREA" || ae.tagName === "INPUT" || ae.tagName === "SELECT");
  }

  async function boot() {
    await refresh();
    render();
    setInterval(async () => {
      await refresh();
      if (!isEditingText()) render();
    }, 2000);
  }

  boot();
})();

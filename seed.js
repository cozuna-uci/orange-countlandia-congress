// Seed content for the United States of Orange Countlandia.
// Edit this file to swap in your own states, dossiers, and legislation
// for a different unit -- nothing else in the app needs to change.
//
// Each state's `passcode` is what a student types (alongside tapping their
// state) to log in as that delegation -- it's not a real security boundary,
// just enough friction to stop one state from casually voting as another.
// Change any of them here, or from the presenter screen's "Manage states"
// panel, without touching anything else.

const STATES = [
  {
    id: "anaheimland",
    name: "Anaheimland",
    motto: "First to the Frontier",
    passcode: "frontier",
    color: "#e2711d",
    population: 350000,
    profile: {
      industries: ["Entertainment & tourism", "Light manufacturing", "Hospitality"],
      priorities: [
        "Faster inland freight and passenger links to grow the tourist trade",
        "Broadly pro-infrastructure, but wary of taxes on hospitality revenue",
      ],
      blurb:
        "The largest state in Orange Countlandia, built around the great amusement grounds of the Kingdom of the Mouse. Anaheimland's innkeepers and merchants are used to being the center of attention -- and expect any national project to run through them, not around them.",
    },
    dossier: {
      text:
        "Leadership is quietly worried that a national railway mostly helps neighboring states pass through Anaheimland's territory on the way to somewhere else, rather than terminating here. The delegation will support a plan that guarantees Anaheimland a full terminal and rail yard; without that guarantee, expect a lukewarm or split vote. The innkeepers' guild and the Kingdom of the Mouse are lobbying hard for yes; wagon-road tollkeepers are lobbying just as hard for no.",
    },
  },
  {
    id: "santa-anatolia",
    name: "Santa Anatolia",
    motto: "Seat of the Courts",
    passcode: "courts",
    color: "#c0392b",
    population: 310000,
    profile: {
      industries: ["Garment & textile trade", "Civic administration", "Produce markets"],
      priorities: [
        "Modernizing trade routes to move goods to market faster",
        "Protecting local authority over commerce from federal encroachment",
      ],
      blurb:
        "Home to the regional courts and a booming textile trade, Santa Anatolia sits at the crossroads of nearly every proposed line. Its markets move enormous volumes of cloth and produce, and its council prides itself on independence from any distant capital.",
    },
    dossier: {
      text:
        "The textile guild sees enormous profit in faster shipping and is pushing hard for a yes vote. But several old-guard council members distrust ceding any planning authority to 'the Federation' and will only back the bill if Santa Anatolia keeps full control of its own rail yard and hiring. Watch for an amendment demanding exactly that.",
    },
  },
  {
    id: "irvingshire",
    name: "Irvingshire",
    motto: "Cultivated by Design",
    passcode: "design",
    color: "#27ae60",
    population: 300000,
    profile: {
      industries: ["Grain & citrus agriculture", "An emerging scholars' academy"],
      priorities: [
        "Getting crops to market before they spoil",
        "Linking new infrastructure to investment in the Academy",
      ],
      blurb:
        "A carefully planned state of orchards, grain fields, and a young academy that dreams of becoming the intellectual center of the nation. Irvingshire's farmers want speed to market; its scholars want relevance.",
    },
    dossier: {
      text:
        "Farmers are enthusiastic about any route that touches Irvingshire and are prepared to vote yes on all three plans. The complication is procedural, not political: the Academy's founding charter forbids the state from taking on public debt without the full faculty senate's approval, which could delay funding even after a floor vote passes. The delegation may need to vote yes and then explain a slow start.",
    },
  },
  {
    id: "huntingtonford",
    name: "Huntingtonford",
    motto: "Salt, Surf, and Oil",
    passcode: "oil",
    color: "#2980b9",
    population: 200000,
    profile: {
      industries: ["Coastal fishing fleets", "Whale-oil refining", "Surf-plank craftsmen"],
      priorities: [
        "Protecting the coastal fishing economy",
        "Deep skepticism of inland projects that never touch the coast",
      ],
      blurb:
        "A harbor state built on fishing fleets and whale-oil refineries, proud of its coastline and suspicious of any national project drawn up by inland surveyors who have never smelled low tide.",
    },
    dossier: {
      text:
        "Every proposed line bypasses Huntingtonford's harbor entirely, and leadership is privately furious about it. The delegation is instructed to vote no on all three routes as a matter of principle unless an amendment adds a coastal spur. Several council members are drafting a rival 'Coastal Line' proposal of their own to introduce as an amendment if given the chance.",
    },
  },
  {
    id: "mission-vejoa",
    name: "Mission Vejoa",
    motto: "Land of the Lake",
    passcode: "lake",
    color: "#8e44ad",
    population: 95000,
    profile: {
      industries: ["Cattle ranching", "Orchard estates", "Lake tourism"],
      priorities: [
        "Rising land values and ranch export routes",
        "Fair compensation for any rail right-of-way through grazing land",
      ],
      blurb:
        "Rolling ranchland around a scenic lake, home to cattle families who have worked the same hills for generations and increasingly to lakeside vacation cottages for the wealthy of neighboring states.",
    },
    dossier: {
      text:
        "The ranching families are split: some want the railway to ship cattle faster, others fear a rail line cutting through grazing land with no compensation. The delegation is instructed to push for a right-of-way compensation clause as a condition of a yes vote -- a natural amendment for them to propose.",
    },
  },
  {
    id: "newportia",
    name: "Newportia",
    motto: "Harbor of Fortune",
    passcode: "fortune",
    color: "#16a085",
    population: 85000,
    profile: {
      industries: ["Harbor trade", "Fashion Island luxury markets", "Banking"],
      priorities: [
        "Protecting its status as the region's premier seaport",
        "Fiscal caution toward large national spending projects",
      ],
      blurb:
        "The wealthiest harbor in Orange Countlandia, home to the glittering markets of Fashion Island and the bankers who finance half the nation's trade. Newportia already has everything a railway might offer -- which makes it want the railway least of all.",
    },
    dossier: {
      text:
        "Newportia's bankers are quietly funding opposition to the Railway Act: an inland rail network would let other states ship goods directly rather than through Newportia's docks, cutting into harbor fees and banking fortunes. Publicly, the delegation will cite 'fiscal responsibility' and the cost to taxpayers rather than admit the real motive.",
    },
  },
  {
    id: "tustinburg",
    name: "Tustinburg",
    motto: "Grove and Garrison",
    passcode: "garrison",
    color: "#d4ac0d",
    population: 80000,
    profile: {
      industries: ["Citrus groves", "Militia armory & airship mooring yards"],
      priorities: [
        "Faster export routes for citrus growers",
        "Federal support for maintaining the armory and mooring yards",
      ],
      blurb:
        "Best known for its citrus groves and the great mooring yards where the militia's airships are kept. A small state that punches above its weight whenever national defense spending comes up.",
    },
    dossier: {
      text:
        "The armory commandant will only back the bill if the chosen route also funds a spur line to the mooring yards for shipping matériel -- a very specific ask. The grove owners, by contrast, want a railway on almost any route and don't much care about the spur. The delegation is internally divided on how hard to push an amendment for it.",
    },
  },
  {
    id: "lakeforestia",
    name: "Lakeforestia",
    motto: "Timber and Tide",
    passcode: "timber",
    color: "#1e8449",
    population: 85000,
    profile: {
      industries: ["Timber", "Lake fisheries", "Resort cabins"],
      priorities: [
        "Becoming a hub of the national railway for jobs and toll revenue",
        "Making sure hosting a hub doesn't mean footing most of the bill",
      ],
      blurb:
        "A forested lake state that has quietly positioned itself as the natural crossroads of any national rail network -- and stands to gain the most jobs and toll revenue if the biggest, most ambitious plan goes through.",
    },
    dossier: {
      text:
        "Town council is thrilled at the idea of becoming the railway's central hub under the largest plan, but privately worried that hub status also means the most construction disruption and the largest local funding ask under the Articles' voluntary-contribution system. They want the Federation (or wealthier states) to cover a larger share of Lakeforestia's portion specifically -- a good opening for an amendment.",
    },
  },
  {
    id: "yorbania",
    name: "Yorbania",
    motto: "Gracious Living",
    passcode: "gracious",
    color: "#a04000",
    population: 68000,
    profile: {
      industries: ["Horse ranching", "Orchard estates", "Gentry landholdings"],
      priorities: [
        "Prestige and connectivity for its landed estates",
        "Preserving the character of the countryside",
      ],
      blurb:
        "Rolling hills of horse ranches and orchard estates owned by Orange Countlandia's landed gentry, who prize their tranquil, gracious way of life above almost everything else.",
    },
    dossier: {
      text:
        "The gentry are quietly fine with a railway so long as it does not run through their finest estates. The delegation carries a marked-up map of exactly which parcels are off-limits, and any route change could reopen that fight even after a plan seems settled.",
    },
  },
  {
    id: "laguna-hills",
    name: "Laguna Hills",
    motto: "Small but Sovereign",
    passcode: "sovereign",
    color: "#7f8c8d",
    population: 32000,
    profile: {
      industries: ["Artisan pottery", "Small hillside farms"],
      priorities: [
        "Not being taxed for a project that barely touches the state",
        "Any investment at all, given how rarely it comes",
      ],
      blurb:
        "One of the smallest states in the union, known for its hillside potters and modest farms. Laguna Hills rarely gets a say in national plans and has learned to make the most of the leverage it does have.",
    },
    dossier: {
      text:
        "This small delegation knows it has almost no leverage on its own. They are instructed to vote however secures the best deal for the state's tiny treasury, and are privately willing to trade their vote for a promise of a future farm-to-market road -- a cheap concession for a bigger state to offer in exchange for support.",
    },
  },
  {
    id: "breaheim",
    name: "Breaheim",
    motto: "Never Overlooked Again",
    passcode: "overlooked",
    color: "#5d4037",
    population: 47000,
    profile: {
      industries: ["Oil seeps & tar pits", "Small foundries"],
      priorities: [
        "Finally receiving federal investment after being passed over before",
        "Being included on the map, literally",
      ],
      blurb:
        "A small state built around its oil seeps and tar pits, long overlooked by planners who route new projects around it rather than through it.",
    },
    dossier: {
      text:
        "Breaheim is left off every proposed route, and the delegation is deeply resentful about it. They are prepared to vote no on all three plans as a protest unless an amendment adds even a small spur to Breaheim -- and may propose exactly that amendment themselves the moment the floor opens.",
    },
  },
  {
    id: "alisovieja",
    name: "Alisovieja",
    motto: "A New Start",
    passcode: "newstart",
    color: "#f39c12",
    population: 50000,
    profile: {
      industries: ["New commerce district", "Small workshops"],
      priorities: [
        "Attracting settlers and trade to a young state",
        "Growth, almost at any cost",
      ],
      blurb:
        "The newest and least established state in the union, little more than a commerce district and a handful of workshops -- but growing fast, and eager to be noticed.",
    },
    dossier: {
      text:
        "Leadership is told to vote yes on almost anything that brings settlers and trade to Alisovieja. But the state's brand-new treasury is thin, and some officials privately worry about taking on debt before the treasury is even fully established -- a tension between ambition and caution the delegation hasn't resolved.",
    },
  },
  {
    id: "danaford",
    name: "Danaford",
    motto: "Gateway to the Sea",
    passcode: "gateway",
    color: "#2471a3",
    population: 33000,
    profile: {
      industries: ["Whaling & fishing harbor", "Boat works"],
      priorities: [
        "A coastal terminus to move fish and goods inland faster",
        "Fair treatment for a very small state under any funding formula",
      ],
      blurb:
        "The smallest state in the union, anchored by a small but busy whaling and fishing harbor at the southern edge of the nation.",
    },
    dossier: {
      text:
        "Danaford is thrilled to be the southern terminus in every proposed plan, and the harbor guild is fully behind the bill. But the state's tiny population means its 'voluntary' funding contribution under the Articles would be disproportionately painful, and the delegation hopes wealthier states will quietly agree to cover more of the cost.",
    },
  },
];

// National Railway Act -- three escalating options, matching the classroom
// slides. `servedStateIds` and `cost` are both optional on an option: leave
// either out (e.g. for a plain yes/no bill with no map or price tag) and the
// UI just won't show that line.
const RAILWAY_OPTIONS = [
  {
    id: "route-1",
    name: "Main Line Plan",
    cost: 15000000,
    detail:
      "A direct line from Anaheimland through Santa Anatolia, Irvingshire, and Lakeforestia down to Mission Vejoa and Danaford.",
    servedStateIds: [
      "anaheimland",
      "santa-anatolia",
      "irvingshire",
      "lakeforestia",
      "mission-vejoa",
      "danaford",
    ],
  },
  {
    id: "route-2",
    name: "Yorbania Detour Plan",
    cost: 22000000,
    detail:
      "The Main Line, rerouted north through Yorbania and Tustinburg before rejoining the line at Irvingshire.",
    servedStateIds: [
      "anaheimland",
      "santa-anatolia",
      "yorbania",
      "tustinburg",
      "irvingshire",
      "lakeforestia",
      "mission-vejoa",
      "danaford",
    ],
  },
  {
    id: "route-3",
    name: "Lakeforestia Transfer Plan",
    cost: 36000000,
    detail:
      "The most ambitious plan: a central transfer hub at Lakeforestia feeding spokes out to Laguna Hills, Alisovieja, Mission Vejoa, and Danaford, on top of the full northern route.",
    servedStateIds: [
      "anaheimland",
      "santa-anatolia",
      "yorbania",
      "tustinburg",
      "irvingshire",
      "lakeforestia",
      "laguna-hills",
      "mission-vejoa",
      "alisovieja",
      "danaford",
    ],
  },
];

const RAILWAY_BILL = {
  id: "national-railway-act",
  title: "The National Railway Act",
  summary:
    "Proposed construction of a national railway connecting key states of Orange Countlandia. Congress must choose a route and decide whether the benefits are worth the cost -- and, under the Articles, whether states will voluntarily fund their share.",
  benefitLabel: "On the current route", // this bill really is about a route, so it keeps the specific wording rather than the generic default
  activeOptionId: "route-1",
  options: RAILWAY_OPTIONS,
  attachments: [], // maps/reports uploaded from the presenter screen land here
};

function createInitialState() {
  const states = {};
  for (const s of STATES) {
    states[s.id] = s;
  }
  return {
    mode: "AOC", // "AOC" | "CONST"
    revealVotesLive: false,
    presenterPasscode: "unitas13",
    // Constitution-mode-only settings (see the House apportionment /
    // delegation-split logic in server.js):
    houseSizeTarget: 50, // total House seats, apportioned by population
    delegationUnity: "realistic", // "solid" | "realistic" | "chaotic"
    states,
    stateOrder: STATES.map((s) => s.id),
    bills: {
      [RAILWAY_BILL.id]: {
        ...RAILWAY_BILL,
        status: "floor", // floor | voting | passed_awaiting_president | enacted | override_voting | vetoed | failed
        amendments: [],
        rounds: [],
        presidentialAction: null, // { decision: 'sign'|'veto', at }
      },
    },
    activeBillId: RAILWAY_BILL.id,
    announcement: null, // { id, text, createdAt } -- the current "message from the Capitol", if any
    sessions: {},
  };
}

module.exports = { createInitialState, STATES, RAILWAY_BILL };

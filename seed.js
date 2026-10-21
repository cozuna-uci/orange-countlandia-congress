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
    motto: "The Heart of Wonder",
    passcode: "frontier",
    color: "#e2711d",
    population: 325000,
    profile: {
      industries: ["Entertainment & amusement parks", "Tourism & hospitality"],
      priorities: [
        "Protecting the entertainment economy from new national taxes",
        "Keeping infrastructure decisions at the state level, not the Federation's",
      ],
      blurb:
        "The largest state in Orange Countlandia, built around the sprawling Great Adventure Park and the entertainment economy that surrounds it. Anaheimland is proud of its tourist draw and deeply skeptical of any national project or tax that might slow it down.",
    },
    dossier: {
      text:
        "Anaheimland is the railway's starting point and a willing supporter at ¤750,000 -- but only on narrow terms. The delegation will hold out for a dedicated Anaheimland station, a route that keeps travel time to the coast as short as possible, a lower contribution if anyone will grant it, and firm limits on how much say Los Angelland gets in exchange for its funding. Any amendment touching those four points is worth watching closely.",
    },
  },
  {
    id: "santa-anatolia",
    name: "Santa Anatolia",
    motto: "To Lead is to Serve",
    passcode: "courts",
    color: "#c0392b",
    population: 340000,
    profile: {
      industries: ["Governance & civil service", "Regional courts and administration"],
      priorities: [
        "Strengthening national governance and institutional stability",
        "Generally wary of new taxes, except where they fund stronger governance",
      ],
      blurb:
        "The political heart of Orange Countlandia and its most populous state, home to the regional courts and much of the Confederation's civil service. Santa Anatolia takes governing seriously -- including the hard parts.",
    },
    dossier: {
      text:
        "As a key stop on the line, Santa Anatolia supports the act and is prepared to contribute generously at ¤1,250,000, despite some concern about route changes. As the political center, their delegation tends to see stable national projects as good for the Confederation's credibility -- expect them to argue forcefully for the bill on the floor rather than just voting yes quietly.",
    },
  },
  {
    id: "irvingshire",
    name: "Irvingshire",
    motto: "Knowledge is Power",
    passcode: "design",
    color: "#27ae60",
    population: 290000,
    profile: {
      industries: ["Academia & higher education"],
      priorities: [
        "Targeted investment in education over general national spending",
        "Neutral on most taxation, more open to it when it funds intellectual growth",
      ],
      blurb:
        "Home to the most prestigious university in Orange Countlandia, Irvingshire sees itself as the nation's mind, even if it doesn't always act like its muscle.",
    },
    dossier: {
      text:
        "Irvingshire keeps a station on the main line for a minimal ¤250,000 contribution, and the delegation currently supports the bill on those terms. Their support is conditional, though -- lose the stop, or get asked to contribute more, and a reform-minded faction in the delegation is ready to argue for flipping to no.",
    },
  },
  {
    id: "huntingtonford",
    name: "Huntingtonford",
    motto: "By the Ocean, For the People",
    passcode: "oil",
    color: "#2980b9",
    population: 185000,
    profile: {
      industries: ["Fisheries", "Coastal tourism"],
      priorities: [
        "Opposed to national taxes on an economy they consider purely local",
        "Rebuilding a tourism trade recently hurt by piracy",
      ],
      blurb:
        "A fishing and tourism economy along a coastline that has seen better years -- recent piracy has left Huntingtonford more protective of its own resources, not less.",
    },
    dossier: {
      text:
        "As a large state with no stop anywhere on the railway, Huntingtonford opposes the bill outright and has said it won't support any version of the act unless a station is added or its ¤250,000 contribution is waived entirely. With tourism revenue already down from piracy along the coast, the delegation has little patience for a 'voluntary' contribution to a project they'll never use.",
    },
  },
  {
    id: "mission-vejoa",
    name: "Mission Vejoa",
    motto: "From the Soil, We Rise",
    passcode: "lake",
    color: "#8e44ad",
    population: 110000,
    profile: {
      industries: ["Citrus groves & organic farming", "Sustainable agriculture"],
      priorities: [
        "Fast, reliable routes to get crops to market before they spoil",
        "Willing to accept national taxes, but only ones that support agriculture and sustainability",
      ],
      blurb:
        "A state of vast citrus groves and sustainable farms that has built its identity around harmony with the land. Mission Vejoa backs national projects readily when they visibly help its farmers.",
    },
    dossier: {
      text:
        "Mission Vejoa contributes ¤1,000,000 and supports the act, seeing it as vital infrastructure for its agricultural economy -- even though the current route gives them no station of their own. In exchange they want a dedicated stop to move citrus and produce quickly, firm guarantees that rural growers get fair access to the line, and some relief on the taxes their farmers pay. Delays worry them, but they remain firmly in favor unless those terms erode.",
    },
  },
  {
    id: "newportia",
    name: "Newportia",
    motto: "To Sail is To Prosper",
    passcode: "fortune",
    color: "#16a085",
    population: 200000,
    profile: {
      industries: ["Luxury goods & yacht manufacturing", "Upscale fashion trade (Fashion Island)", "Banking"],
      priorities: [
        "Protecting its status as the region's premier seaport",
        "Open to national taxes, but only when they clearly grow trade and luxury industries",
      ],
      blurb:
        "The wealthiest harbor in Orange Countlandia, home to the glittering markets of Fashion Island, a thriving yacht trade, and the bankers who finance much of the nation's commerce. Newportia is unusually willing to fund the Federation -- when it sees something in return.",
    },
    dossier: {
      text:
        "Newportia is asked for the single largest state contribution, ¤2,000,000, despite having no stop on the proposed route -- and the delegation opposes the bill as written. They want priority rail access for Newportia-shipped goods, a much smaller contribution paired with a station of their own, firm guarantees the line will boost coastal trade, and assurance that the Los Angelland loan buys no say over national trade routes. Meet those asks and Newportia's usual willingness to fund the Federation could flip this to a yes.",
    },
  },
  {
    id: "tustinburg",
    name: "Tustinburg",
    motto: "Reach for the Skies",
    passcode: "garrison",
    color: "#d4ac0d",
    population: 80000,
    profile: {
      industries: ["Aviation & aeronautics research", "Locomotive & rolling-stock manufacturing"],
      priorities: [
        "Opposed to national taxes unless they directly fund aeronautical research",
        "Protecting and growing its manufacturing contracts",
      ],
      blurb:
        "Home to the national aeronautics research center and a growing locomotive works, Tustinburg is small but increasingly indispensable to anything the Confederation tries to build.",
    },
    dossier: {
      text:
        "Tustinburg stands to profit twice over: its contribution is a modest ¤500,000, and its workshops are the ones building the railway's locomotives. The delegation fully backs the project and sees little downside, as long as construction stays on schedule -- a delay anywhere else on the line could cost Tustinburg a manufacturing contract, so watch them push hard against any amendment that slows things down.",
    },
  },
  {
    id: "lakeforestia",
    name: "Lakeforestia",
    motto: "From Forests, We Prosper",
    passcode: "timber",
    color: "#1e8449",
    population: 150000,
    profile: {
      industries: ["Forestry & woodworking", "Fine furniture"],
      priorities: [
        "Open to taxes that fund sustainable forestry and environmental protection",
        "Becoming a hub for national infrastructure, without footing a hub's share of the bill",
      ],
      blurb:
        "A forested state built on timber and fine woodworking, Lakeforestia has quietly started angling to become the crossroads of anything the Confederation builds next.",
    },
    dossier: {
      text:
        "Lakeforestia's ¤250,000 contribution buys a station on the main line, and the delegation is an enthusiastic -- if financially stretched -- yes. They're also the ones who proposed the larger hub-and-spoke plan that would put Lakeforestia at the center of the whole network; they argue that hosting that much traffic is contribution enough, and shouldn't come with a bigger bill. Delays or route changes could cool their enthusiasm fast.",
    },
  },
  {
    id: "yorbania",
    name: "Yorbania",
    motto: "In Precision, We Trust",
    passcode: "gracious",
    color: "#a04000",
    population: 70000,
    profile: {
      industries: ["Precision manufacturing", "Machine tooling"],
      priorities: [
        "Self-reliant manufacturing, free of federal interference",
        "Wary of growing foreign influence from neighboring colonies",
      ],
      blurb:
        "A state of exacting machinists and toolmakers who trust their own precision more than anyone else's promises -- including the Federation's.",
    },
    dossier: {
      text:
        "Yorbania opposes the main-line bill: a route that excludes their state doesn't justify even their ¤250,000 minimum contribution, and they're uneasy about the Federation leaning on outside funding from Los Angelland to make the numbers work. But they've signaled real interest in a detour that reaches Yorbania -- and have hinted they'd put up significantly more money for it -- which is exactly the trade an alternate-route amendment could offer them.",
    },
  },
  {
    id: "laguna-hills",
    name: "Laguna Hills",
    motto: "Creativity Through Community",
    passcode: "sovereign",
    color: "#7f8c8d",
    population: 95000,
    profile: {
      industries: ["Fine arts & artisan crafts", "Tapestry weaving"],
      priorities: [
        "Reluctant to accept taxation unless it directly benefits the arts and crafts community",
        "Preserving its small but tight-knit creative economy",
      ],
      blurb:
        "Known across the Confederation for its intricate tapestry weaving and a thriving community of artisans, the Commonwealth of Laguna Hills measures prosperity differently than its larger neighbors.",
    },
    dossier: {
      text:
        "Laguna Hills falls under the Act's ¤250,000 minimum-contribution clause and firmly opposes the bill, arguing it sees no direct benefit from a line that doesn't come near it. They've said plainly they won't pay the contribution if it's simply mandated -- but they do contribute to national projects when the money is earmarked for something that touches their artisan economy, which could be a useful opening for an amendment.",
    },
  },
  {
    id: "breaheim",
    name: "Breaheim",
    motto: "Fueling the Future",
    passcode: "overlooked",
    color: "#5d4037",
    population: 65000,
    profile: {
      industries: ["Oil & energy production"],
      priorities: [
        "Open to national taxes on infrastructure, but wary of any tax that targets energy production directly",
        "Modernizing the energy industry, carefully",
      ],
      blurb:
        "The primary source of fuel for all of Orange Countlandia, Breaheim has quietly become one of the states the rest of the Confederation can least afford to ignore.",
    },
    dossier: {
      text:
        "Breaheim is asked for ¤1,000,000 and currently opposes the bill, arguing the railway mostly benefits states it doesn't serve. That's a notable shift from their usual posture -- Breaheim is normally one of the more reliable contributors to the national treasury when energy or infrastructure money is involved, so a station, a spur, or simply a smaller ask could bring them back in line with their usual yes.",
    },
  },
  {
    id: "alisovieja",
    name: "Alisovieja",
    motto: "Tomorrow, Today",
    passcode: "newstart",
    color: "#f39c12",
    population: 85000,
    profile: {
      industries: ["High-tech startups", "Virtual reality & applied research"],
      priorities: [
        "Open to taxation, provided it funds tech infrastructure and innovation",
        "Attracting new settlers and investment to a still-young state",
      ],
      blurb:
        "The youngest and most forward-looking state in the union, built on a fast-growing cluster of tech startups and virtual-reality research. Alisovieja wants to be known for tomorrow, not yesterday.",
    },
    dossier: {
      text:
        "Alisovieja's ¤500,000 contribution buys it no stop on the main line, and the delegation currently opposes the bill on exactly those grounds -- a small state paying in for a project that runs past it. They are generally one of the more tax-friendly delegations in the Confederation, so a station, a reduced ask, or a tech-infrastructure sweetener could move them, even though none of that is on the table in the current proposal.",
    },
  },
  {
    id: "danaford",
    name: "Danaford",
    motto: "Anchored in Tradition",
    passcode: "gateway",
    color: "#2471a3",
    population: 45000,
    profile: {
      industries: ["Maritime engineering & shipbuilding"],
      priorities: [
        "Strongly opposed to national taxes that could burden the maritime trade",
        "Fair treatment for a very small state under any funding formula",
      ],
      blurb:
        "A small maritime state anchored by its shipbuilding yards and a deep-rooted respect for the old ways of doing things. Danaford moves carefully, even when it stands to benefit.",
    },
    dossier: {
      text:
        "Danaford is the railway's southern terminus and still opposes the bill: a ¤1,000,000 contribution feels steep for a state its size, and the delegation worries openly about delays and runaway costs eating into that investment. They are not against the project in principle -- a smaller or phased contribution could well bring them around.",
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
      "The Act's base proposal: begins in Anaheimland and runs through Santa Anatolia and Irvingshire to a station at Lakeforestia, terminating in Danaford. Total cost ¤15,000,000, funded by ¤5,750,000 from the national treasury, named contributions from eight states, and a Confederation bond covering the rest. Mission Vejoa and Tustinburg both contribute funding under this plan despite having no station of their own.",
    servedStateIds: [
      "anaheimland",
      "santa-anatolia",
      "irvingshire",
      "lakeforestia",
      "danaford",
    ],
  },
  {
    id: "route-2",
    name: "Yorbania Detour Plan",
    cost: 22000000,
    detail:
      "The Main Line, extended north through Yorbania and Tustinburg before rejoining the route at Irvingshire -- with Los Angelland offering ¤5,000,000 to push the line further north into their own southernmost city. Yorbania has signaled it would raise its own contribution substantially to secure a stop. Several states see the Los Angelland money as a foreign foot in the door on a domestic project.",
    servedStateIds: [
      "anaheimland",
      "santa-anatolia",
      "yorbania",
      "tustinburg",
      "irvingshire",
      "lakeforestia",
      "danaford",
    ],
  },
  {
    id: "route-3",
    name: "Lakeforestia Transfer Plan",
    cost: 36000000,
    detail:
      "The most ambitious plan on the table: a full rework of the network around a central transfer hub at Lakeforestia, with spokes reaching Laguna Hills, Alisovieja, Mission Vejoa, and Danaford on top of the full northern route. It more than doubles the Act's base cost. Lakeforestia argues that hosting the hub is contribution enough and shouldn't mean a bigger bill, while Anaheimland, Santa Anatolia, and Irvingshire are uneasy about the network's center sitting so far from them.",
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
    "The Congress of the Federation's proposal for a ¤15,000,000 railway linking the states of Orange Countlandia, funded by the national treasury, named state contributions, and a Confederation bond. Congress must choose a route, weigh outside funding offers from Los Angelland and Yorbania, and decide -- under the Articles -- whether enough states will voluntarily fund their share to make it real.",
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

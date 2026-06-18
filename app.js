// Categories sourced from docs/team_trumps.md
const CATEGORIES = [
  "Defense",
  "Attack",
  "Cool Strip",
  "Keepy Uppy Skills",
  "Penalty Taking",
  "Fan Singing Skills",
  "Best Stadium Food"
];

// Points config sourced from docs/config.md
const CONFIG = {
  totalPoints: 50,
  pointsWin: 2,
  pointsDraw: 1,
  pointsLoss: 0
};

// Teams sourced from docs/teams.md
let TEAMS = [];
let TEAMS_A = [];
let TEAMS_B = [];
let LEAGUE_MATCHES = 0;
const KNOCKOUT_MATCHES = 4; // SF(2) + 3rd place(1) + Final(1)
let TOTAL_MATCHES = 0;

const el = {
  playNextBtn: document.getElementById("play-next-btn"),
  autoPlayBtn: document.getElementById("auto-play-btn"),
  resetBtn: document.getElementById("reset-btn"),
  statusPill: document.getElementById("status-pill"),
  fixtureCounter: document.getElementById("fixture-counter"),
  stageLabel: document.getElementById("stage-label"),
  teamACard: document.getElementById("team-a-card"),
  teamBCard: document.getElementById("team-b-card"),
  categoryChip: document.getElementById("category-chip"),
  resultChip: document.getElementById("result-chip"),
  commentary: document.getElementById("commentary"),
  standingsGrid: document.getElementById("standings-grid"),
  knockoutGrid: document.getElementById("knockout-grid"),
  setupSection: document.getElementById("setup-section"),
  setupInputs: document.getElementById("setup-inputs"),
  setupTotal: document.getElementById("setup-total"),
  setupNextBtn: document.getElementById("setup-next-btn"),
  setupTeamHeader: document.getElementById("setup-team-header"),
};

let state = null;

function hashString(input) {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function buildStats(teamName) {
  const seed = hashString(teamName);
  const n = CATEGORIES.length;
  const raw = Array.from({ length: n }, (_, idx) => ((seed >> (idx * 3)) & 15) + 1);
  const rawSum = raw.reduce((sum, v) => sum + v, 0);

  const minPerCategory = 2;
  const remaining = CONFIG.totalPoints - minPerCategory * n;
  const scaled = raw.map((v) => (v / rawSum) * remaining);
  const pts = scaled.map((v) => Math.floor(v));

  let allocated = pts.reduce((sum, v) => sum + v, 0);
  const remainders = scaled
    .map((v, idx) => ({ idx, rem: v - Math.floor(v) }))
    .sort((a, b) => b.rem - a.rem);

  for (let i = 0; allocated < remaining; i += 1) {
    pts[remainders[i % remainders.length].idx] += 1;
    allocated += 1;
  }

  return CATEGORIES.reduce((obj, cat, i) => {
    obj[cat] = pts[i] + minPerCategory;
    return obj;
  }, {});
}

function createTeams(allocations) {
  const teams = {};
  TEAMS.forEach((name) => {
    teams[name] = { name, stats: allocations[name] };
  });
  return teams;
}

function createEmptyStandings(teams) {
  const standings = {};
  teams.forEach((name) => {
    standings[name] = {
      team: name,
      played: 0,
      points: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      categoryFor: 0,
      categoryAgainst: 0,
      duelDiff: 0
    };
  });
  return standings;
}

function buildGroupFixtures(teams, leagueLabel) {
  // For odd team counts add a BYE slot so every team gets a round-off partner;
  // fixtures involving BYE are simply skipped (those teams have a bye that round).
  const list = teams.length % 2 === 0 ? [...teams] : [...teams, null];
  const m = list.length; // always even
  const fixed = list[0];
  const rotating = list.slice(1);
  const fixtures = [];

  for (let round = 0; round < m - 1; round++) {
    const pairs = [[fixed, rotating[0]]];
    for (let i = 1; i < m / 2; i++) {
      pairs.push([rotating[i], rotating[m - 1 - i]]);
    }
    for (const [home, away] of pairs) {
      if (home !== null && away !== null) {
        fixtures.push({ stage: "League", league: leagueLabel, home, away });
      }
    }
    rotating.unshift(rotating.pop());
  }

  return fixtures;
}

function buildLeagueFixtures() {
  const fixturesA = buildGroupFixtures(TEAMS_A, "A");
  const fixturesB = buildGroupFixtures(TEAMS_B, "B");
  const interleaved = [];
  const maxLen = Math.max(fixturesA.length, fixturesB.length);
  for (let i = 0; i < maxLen; i++) {
    if (i < fixturesA.length) interleaved.push(fixturesA[i]);
    if (i < fixturesB.length) interleaved.push(fixturesB[i]);
  }
  return interleaved;
}

function sortStandingRows(rows) {
  return [...rows].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.duelDiff !== a.duelDiff) return b.duelDiff - a.duelDiff;
    if (b.categoryFor !== a.categoryFor) return b.categoryFor - a.categoryFor;
    return a.team.localeCompare(b.team);
  });
}

function chooseRandomCategory() {
  return CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)];
}

function playCategoryDuel(teamA, teamB) {
  const category = chooseRandomCategory();
  const valueA = teamA.stats[category];
  const valueB = teamB.stats[category];

  if (valueA === valueB) {
    return {
      category,
      winner: null,
      loser: null,
      aDisplay: valueA,
      bDisplay: valueB,
      isDraw: true,
      tiebreakInfo: ""
    };
  }

  const winner = valueA > valueB ? teamA.name : teamB.name;
  const loser = winner === teamA.name ? teamB.name : teamA.name;

  return {
    category,
    winner,
    loser,
    aDisplay: valueA,
    bDisplay: valueB,
    isDraw: false,
    tiebreakInfo: ""
  };
}

function resolvePenaltyShootout(teamA, teamB) {
  const penA = teamA.stats["Penalty Taking"];
  const penB = teamB.stats["Penalty Taking"];

  if (penA !== penB) {
    const winner = penA > penB ? teamA.name : teamB.name;
    return { winner, loser: winner === teamA.name ? teamB.name : teamA.name, coinFlip: false, penA, penB };
  }

  const winner = Math.random() < 0.5 ? teamA.name : teamB.name;
  return { winner, loser: winner === teamA.name ? teamB.name : teamA.name, coinFlip: true, penA, penB };
}

function applyLeagueResult(match) {
  const standings = match.league === "A" ? state.standingsA : state.standingsB;
  const homeRow = standings[match.home];
  const awayRow = standings[match.away];

  homeRow.played += 1;
  awayRow.played += 1;

  homeRow.categoryFor += match.homeValue;
  homeRow.categoryAgainst += match.awayValue;
  awayRow.categoryFor += match.awayValue;
  awayRow.categoryAgainst += match.homeValue;

  homeRow.duelDiff += match.homeValue - match.awayValue;
  awayRow.duelDiff += match.awayValue - match.homeValue;

  if (match.isDraw) {
    homeRow.draws += 1;
    awayRow.draws += 1;
    homeRow.points += CONFIG.pointsDraw;
    awayRow.points += CONFIG.pointsDraw;
  } else if (match.winner === match.home) {
    homeRow.wins += 1;
    awayRow.losses += 1;
    homeRow.points += CONFIG.pointsWin;
    awayRow.points += CONFIG.pointsLoss;
  } else {
    awayRow.wins += 1;
    homeRow.losses += 1;
    awayRow.points += CONFIG.pointsWin;
    homeRow.points += CONFIG.pointsLoss;
  }
}

function resolveLeagueQualification() {
  const top2A = sortStandingRows(Object.values(state.standingsA)).slice(0, 2).map((r) => r.team);
  const top2B = sortStandingRows(Object.values(state.standingsB)).slice(0, 2).map((r) => r.team);
  return { top2A, top2B };
}

// 1st League A vs 2nd League B, 1st League B vs 2nd League A
function makeSemiFinalFixtures(top2A, top2B) {
  return [
    { stage: "Semi Finals", home: top2A[0], away: top2B[1] },
    { stage: "Semi Finals", home: top2B[0], away: top2A[1] }
  ];
}

function createInitialState() {
  return {
    teams: {},
    standingsA: createEmptyStandings(TEAMS_A),
    standingsB: createEmptyStandings(TEAMS_B),
    leagueFixtures: buildLeagueFixtures(),
    leagueFixtureIndex: 0,
    totalPlayed: 0,
    phase: "SETUP",
    setupTeamIndex: 0,
    setupAllocations: {},
    knockoutRounds: [],
    currentRoundIndex: 0,
    currentRoundFixtureIndex: 0,
    roundWinners: [],
    semiFinalLosers: [],
    latestMatch: null,
    commentary: "Tournament not started.",
    autoPlay: false,
    revealStep: null,
    pendingCommentary: "",
    pendingLeagueMatch: null,
    completedMatches: []
  };
}

function processFixture(fixture) {
  const teamA = state.teams[fixture.home];
  const teamB = state.teams[fixture.away];
  const duel = playCategoryDuel(teamA, teamB);

  let winner = duel.winner;
  let loser = duel.loser;
  let isDraw = duel.isDraw;
  let penaltyInfo = null;

  if (isDraw && fixture.stage !== "League") {
    const shootout = resolvePenaltyShootout(teamA, teamB);
    penaltyInfo = shootout;
    winner = shootout.winner;
    loser = shootout.loser;
    isDraw = false;
  }

  const match = {
    ...fixture,
    category: duel.category,
    winner,
    loser,
    isDraw,
    penaltyInfo,
    homeValue: duel.aDisplay,
    awayValue: duel.bDisplay,
    line: `${fixture.home} (${duel.aDisplay}) vs ${fixture.away} (${duel.bDisplay})`
  };

  state.latestMatch = match;
  state.totalPlayed += 1;
  state.completedMatches.push(match);

  return match;
}

function triggerConfetti(cardElement) {
  const canvas = document.createElement("canvas");
  canvas.className = "confetti-canvas";
  canvas.width = cardElement.offsetWidth;
  canvas.height = cardElement.offsetHeight;
  cardElement.appendChild(canvas);

  const ctx = canvas.getContext("2d");
  const colors = ["#ff8c42", "#39c0ba", "#53e17d", "#ffce8f", "#ff5a76", "#ffffff"];
  const totalDuration = TIMINGS.confettiDuration;
  const startTime = Date.now();

  setTimeout(() => canvas.remove(), totalDuration);

  function makeParticles() {
    return Array.from({ length: 70 }, () => ({
      x: canvas.width * (0.3 + Math.random() * 0.4),
      y: canvas.height * 0.5,
      vx: (Math.random() - 0.5) * 10,
      vy: -(Math.random() * 8 + 3),
      size: Math.random() * 9 + 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      rot: Math.random() * 360,
      rotV: (Math.random() - 0.5) * 12,
      rect: Math.random() < 0.6
    }));
  }

  function runBurst() {
    if (!canvas.isConnected) return;
    const particles = makeParticles();
    const maxFrames = 100;
    let frame = 0;

    function animate() {
      if (!canvas.isConnected) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach((p) => {
        p.vy += 0.35;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.rotV;
        ctx.save();
        ctx.globalAlpha = Math.max(0, 1 - frame / maxFrames);
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rot * Math.PI) / 180);
        ctx.fillStyle = p.color;
        if (p.rect) {
          ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        } else {
          ctx.beginPath();
          ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      });
      frame += 1;
      if (frame < maxFrames) {
        requestAnimationFrame(animate);
      } else if (Date.now() - startTime < totalDuration) {
        runBurst();
      }
    }

    requestAnimationFrame(animate);
  }

  runBurst();
}

function advanceReveal() {
  if (state.revealStep === 0) {
    state.revealStep = 1;
    render();
    if (state.autoPlay) setTimeout(advanceReveal, TIMINGS.categoryDelay);
  } else if (state.revealStep === 1) {
    state.revealStep = 2;
    state.commentary = state.pendingCommentary;
    render();
    if (state.latestMatch && !state.latestMatch.isDraw) {
      const winnerCard = state.latestMatch.winner === state.latestMatch.home
        ? el.teamACard
        : el.teamBCard;
      triggerConfetti(winnerCard);
    }
    if (state.autoPlay) setTimeout(advanceReveal, TIMINGS.scoresDelay);
  } else if (state.revealStep === 2) {
    state.revealStep = null;
    if (state.pendingLeagueMatch) {
      applyLeagueResult(state.pendingLeagueMatch);
      state.pendingLeagueMatch = null;
    }
    render();
    if (state.autoPlay) playNextMatch();
  }
}

function startReveal(commentaryText) {
  state.pendingCommentary = commentaryText;
  state.revealStep = 0;
  state.commentary = "";
  render();
  if (state.autoPlay) setTimeout(advanceReveal, TIMINGS.namesDelay);
}

function playNextMatch() {
  if (!state || state.phase === "DONE" || state.phase === "SETUP") return;

  if (state.revealStep !== null) {
    if (!state.autoPlay) advanceReveal();
    return;
  }

  if (state.phase === "LEAGUE") {
    const fixture = state.leagueFixtures[state.leagueFixtureIndex];

    if (!fixture) {
      const { top2A, top2B } = resolveLeagueQualification();
      state.knockoutRounds = [{
        name: "Semi Finals",
        fixtures: makeSemiFinalFixtures(top2A, top2B),
        completed: []
      }];
      state.phase = "KNOCKOUT";
      state.currentRoundIndex = 0;
      state.currentRoundFixtureIndex = 0;
      state.roundWinners = [];
      state.revealStep = null;
      state.commentary = `League stage complete! ${top2A[0]} & ${top2A[1]} advance from League A. ${top2B[0]} & ${top2B[1]} advance from League B. Semi Finals next!`;
      render();
      return;
    }

    const match = processFixture(fixture);
    state.pendingLeagueMatch = match;
    state.leagueFixtureIndex += 1;

    const leagueTag = `[League ${match.league}]`;
    let commentary = match.isDraw
      ? `${leagueTag} Draw on ${match.category} (${match.homeValue}-${match.awayValue}). One point each.`
      : `${leagueTag} ${match.winner} beat ${match.loser} on ${match.category} (${match.homeValue}-${match.awayValue}).`;

    if (state.leagueFixtureIndex >= state.leagueFixtures.length) {
      commentary += " League stage finished. Next click reveals the Semi Finals.";
    }

    startReveal(commentary);
    return;
  }

  if (state.phase === "KNOCKOUT") {
    const round = state.knockoutRounds[state.currentRoundIndex];
    const fixture = round.fixtures[state.currentRoundFixtureIndex];

    if (!fixture) {
      if (round.name === "Semi Finals") {
        state.knockoutRounds.push({
          name: "3rd Place",
          fixtures: [{ stage: "3rd Place", home: state.semiFinalLosers[0], away: state.semiFinalLosers[1] }],
          completed: []
        });
        state.knockoutRounds.push({
          name: "Final",
          fixtures: [{ stage: "Final", home: state.roundWinners[0], away: state.roundWinners[1] }],
          completed: []
        });
        state.currentRoundIndex += 1;
        state.currentRoundFixtureIndex = 0;
        state.roundWinners = [];
        state.commentary = "Semi finals complete. 3rd place playoff is next.";
        render();
        return;
      }

      if (round.name === "3rd Place") {
        state.currentRoundIndex += 1;
        state.currentRoundFixtureIndex = 0;
        state.commentary = "3rd place decided. The final is up next!";
        render();
        return;
      }

      if (round.name === "Final") {
        state.phase = "DONE";
        const champion = round.completed[0]?.winner;
        state.commentary = `${champion} are your Top Trumps World Cup 2026 champions!`;
        setAutoPlay(false);
        render();
        return;
      }

      return;
    }

    const match = processFixture(fixture);
    round.completed.push(match);
    state.roundWinners.push(match.winner);

    if (round.name === "Semi Finals") {
      state.semiFinalLosers.push(match.loser);
    }

    state.currentRoundFixtureIndex += 1;

    let commentary;
    if (match.penaltyInfo) {
      const pen = match.penaltyInfo;
      const penDetail = pen.coinFlip
        ? `sudden death coin flip`
        : `Penalty Taking ${pen.penA > pen.penB ? pen.penA : pen.penB}–${pen.penA > pen.penB ? pen.penB : pen.penA}`;
      commentary = `Draw on ${match.category} (${match.homeValue}-${match.awayValue})! ${match.winner} goes through on penalties (${penDetail}).`;
    } else {
      commentary = `${match.winner} beat ${match.loser} via ${match.category} (${match.homeValue}-${match.awayValue}).`;
    }

    startReveal(commentary);
  }
}

function getCurrentFixturePreview() {
  if (state.phase === "LEAGUE") {
    return state.leagueFixtures[state.leagueFixtureIndex] || null;
  }

  if (state.phase === "KNOCKOUT") {
    const round = state.knockoutRounds[state.currentRoundIndex];
    if (!round) return null;
    return round.fixtures[state.currentRoundFixtureIndex] || null;
  }

  return null;
}

function renderTeamCard(teamName) {
  if (!teamName) return "<h3>TBD</h3>";

  const team = state.teams[teamName];
  const step = state.revealStep;
  const category = state.latestMatch?.category;

  if (step === null || step === 0) {
    return `<h3>${team.name}</h3>`;
  }

  if (step === 1) {
    return `
      <h3>${team.name}</h3>
      <div class="reveal-category">${category}</div>
      <div class="reveal-score pending">?</div>
    `;
  }

  return `
    <h3>${team.name}</h3>
    <div class="reveal-category">${category}</div>
    <div class="reveal-score">${team.stats[category]}</div>
  `;
}

function renderLeagueTable(standings, leagueLabel) {
  const sorted = sortStandingRows(Object.values(standings));

  const rowsHtml = sorted.map((row, idx) => {
    const qualifyClass = idx < 2 ? "qualify-spot" : "";
    return `
      <tr class="${qualifyClass}">
        <td>${idx + 1}. ${row.team}</td>
        <td>${row.points}</td>
        <td>${row.played}</td>
        <td>${row.wins}</td>
        <td>${row.draws}</td>
        <td>${row.duelDiff}</td>
      </tr>
    `;
  }).join("");

  return `
    <article class="league-table">
      <div class="league-table-header">League ${leagueLabel}</div>
      <table>
        <thead>
          <tr>
            <th>Team</th>
            <th>Pts</th>
            <th>P</th>
            <th>W</th>
            <th>D</th>
            <th>Diff</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
      <p class="qualify-note">Top 2 advance to Semi Finals — Win: ${CONFIG.pointsWin} pts · Draw: ${CONFIG.pointsDraw} pt</p>
    </article>
  `;
}

function renderStandings() {
  el.standingsGrid.innerHTML =
    renderLeagueTable(state.standingsA, "A") +
    renderLeagueTable(state.standingsB, "B");
}

function updateSetupTotal() {
  const inputs = el.setupInputs.querySelectorAll(".setup-input");
  let total = 0;
  inputs.forEach((inp) => { total += parseInt(inp.value, 10) || 0; });
  el.setupTotal.textContent = `Total: ${total} / 50`;
  el.setupTotal.className = "setup-total " + (total === 50 ? "complete" : "over");
  el.setupNextBtn.disabled = total !== 50;
}

function renderSetup() {
  const teamName = TEAMS[state.setupTeamIndex];
  const defaults = state.setupAllocations[teamName] || buildStats(teamName);
  if (!state.setupAllocations[teamName]) {
    state.setupAllocations[teamName] = { ...defaults };
  }

  el.setupTeamHeader.textContent = `Team ${state.setupTeamIndex + 1} of ${TEAMS.length}: ${teamName}`;

  el.setupInputs.innerHTML = CATEGORIES.map((cat) => `
    <div class="setup-row">
      <label>${cat}</label>
      <input type="number" class="setup-input" data-cat="${cat}"
             min="0" max="50" value="${defaults[cat]}" />
    </div>
  `).join("");

  const isLast = state.setupTeamIndex === TEAMS.length - 1;
  el.setupNextBtn.textContent = isLast ? "Start Tournament" : "Next Team →";
  updateSetupTotal();
}

function confirmSetup() {
  state.teams = createTeams(state.setupAllocations);
  state.phase = "LEAGUE";
  render();
}

function renderKnockout() {
  if (state.knockoutRounds.length === 0) {
    el.knockoutGrid.innerHTML = "<p>Knockout bracket appears after the league stage.</p>";
    return;
  }

  const roundsHtml = state.knockoutRounds.map((round) => {
    const lines = round.fixtures.map((fixture, idx) => {
      const played = round.completed[idx];
      if (!played) {
        return `<div class="match-line">${fixture.home} vs ${fixture.away}</div>`;
      }
      const isRevealing = state.revealStep !== null && played === state.latestMatch;
      if (isRevealing) {
        return `<div class="match-line">${played.home} vs ${played.away}</div>`;
      }
      return `<div class="match-line">${played.home} vs ${played.away} <span class="match-winner">— ${played.winner}</span></div>`;
    }).join("");

    return `<article class="round-card"><h3>${round.name}</h3>${lines}</article>`;
  }).join("");

  el.knockoutGrid.innerHTML = roundsHtml;
}

function setAutoPlay(nextValue) {
  state.autoPlay = nextValue;

  if (state.autoPlay && state.phase !== "DONE" && state.phase !== "SETUP") {
    if (state.revealStep !== null) {
      // Mid-reveal: resume auto-advancing from the current step
      const delay = state.revealStep === 0 ? TIMINGS.namesDelay
                  : state.revealStep === 1 ? TIMINGS.categoryDelay
                  : TIMINGS.scoresDelay;
      setTimeout(advanceReveal, delay);
    } else {
      playNextMatch();
    }
  }

  el.autoPlayBtn.textContent = `Auto Play: ${state.autoPlay ? "On" : "Off"}`;
}

function render() {
  const step = state.revealStep;
  const latest = state.latestMatch;
  const fixture = getCurrentFixturePreview();

  const displayHome = (step !== null && latest) ? latest.home : (fixture?.home || null);
  const displayAway = (step !== null && latest) ? latest.away : (fixture?.away || null);

  let leftClass = "";
  let rightClass = "";
  if (step === 2 && latest) {
    if (latest.isDraw) {
      leftClass = rightClass = "draw";
    } else if (latest.winner === latest.home) {
      leftClass = "win";
      rightClass = "lose";
    } else {
      leftClass = "lose";
      rightClass = "win";
    }
  }

  el.teamACard.className = `team-card ${leftClass}`.trim();
  el.teamBCard.className = `team-card ${rightClass}`.trim();
  el.teamACard.innerHTML = renderTeamCard(displayHome);
  el.teamBCard.innerHTML = renderTeamCard(displayAway);

  if (step !== null && step >= 1 && latest) {
    el.categoryChip.textContent = `Category: ${latest.category}`;
  } else {
    el.categoryChip.textContent = "Category: —";
  }

  if (step === 2 && latest) {
    el.resultChip.textContent = latest.isDraw ? "Draw — 1pt each" : `${latest.winner} won`;
  } else if (step !== null) {
    el.resultChip.textContent = "...";
  } else {
    el.resultChip.textContent = "Press Play Next Match";
  }

  el.commentary.textContent = state.commentary;
  el.fixtureCounter.textContent = `Match ${state.totalPlayed} / ${TOTAL_MATCHES}`;

  if (state.phase === "SETUP") {
    el.stageLabel.textContent = "Team Setup";
    el.statusPill.textContent = `Setup: ${state.setupTeamIndex} / ${TEAMS.length}`;
  } else if (state.phase === "LEAGUE") {
    const currentFixture = state.leagueFixtures[state.leagueFixtureIndex];
    const leagueLabel = currentFixture ? `League ${currentFixture.league}` : "League Stage";
    el.stageLabel.textContent = leagueLabel;
    el.statusPill.textContent = `League: ${state.leagueFixtureIndex} / ${LEAGUE_MATCHES}`;
  } else if (state.phase === "KNOCKOUT") {
    const round = state.knockoutRounds[state.currentRoundIndex];
    el.stageLabel.textContent = round?.name || "Knockout";
    el.statusPill.textContent = round?.name || "Knockout";
  } else {
    el.stageLabel.textContent = "Tournament Complete";
    const champion = state.knockoutRounds[state.knockoutRounds.length - 1]?.completed?.[0]?.winner || "Champion";
    el.statusPill.textContent = `Winner: ${champion}`;
  }

  el.setupSection.style.display = state.phase === "SETUP" ? "" : "none";

  renderStandings();
  renderKnockout();
  updateButtonStates();

  const knockoutSection = document.getElementById("knockout-section");
  const leagueSection = document.getElementById("league-section");
  if (state.phase === "KNOCKOUT" || state.phase === "DONE") {
    if (knockoutSection.nextElementSibling !== leagueSection) {
      leagueSection.parentNode.insertBefore(knockoutSection, leagueSection);
    }
  } else {
    if (leagueSection.nextElementSibling !== knockoutSection) {
      leagueSection.parentNode.insertBefore(knockoutSection, leagueSection.nextElementSibling);
    }
  }
}

function resetTournament() {
  state = createInitialState();
  setAutoPlay(false);
  render();
  renderSetup();
}

function updateButtonStates() {
  const blocked = !state || state.phase === "DONE" || state.phase === "SETUP";
  el.playNextBtn.disabled = blocked;
}

el.playNextBtn.addEventListener("click", () => playNextMatch());
el.autoPlayBtn.addEventListener("click", () => { if (state) setAutoPlay(!state.autoPlay); });
el.resetBtn.addEventListener("click", () => resetTournament());

el.setupInputs.addEventListener("input", updateSetupTotal);

el.setupNextBtn.addEventListener("click", () => {
  const teamName = TEAMS[state.setupTeamIndex];
  const stats = {};
  el.setupInputs.querySelectorAll(".setup-input").forEach((inp) => {
    stats[inp.dataset.cat] = parseInt(inp.value, 10) || 0;
  });
  state.setupAllocations[teamName] = stats;

  if (state.setupTeamIndex === TEAMS.length - 1) {
    confirmSetup();
  } else {
    state.setupTeamIndex += 1;
    renderSetup();
  }
});

const FALLBACK_TEAMS = [
  "Ballador", "Fern Island", "Sparta Island", "Portalala", "Niolet",
  "Mepcot Island", "Rodyland", "Tecky", "Eggland", "Pintin"
];

function initWithTeams(teams) {
  TEAMS = teams;
  TEAMS_A = TEAMS.slice(0, 5);
  TEAMS_B = TEAMS.slice(5, 10);
  LEAGUE_MATCHES = 2 * ((TEAMS_A.length * (TEAMS_A.length - 1)) / 2);
  TOTAL_MATCHES = LEAGUE_MATCHES + KNOCKOUT_MATCHES;
  resetTournament();
}

fetch("docs/teams.md")
  .then((r) => r.text())
  .then((text) => {
    const teams = text.split("\n").map((l) => l.trim()).filter(Boolean);
    initWithTeams(teams.length >= 10 ? teams : FALLBACK_TEAMS);
  })
  .catch(() => initWithTeams(FALLBACK_TEAMS));

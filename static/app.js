let ws = null;
let myPlayerId = localStorage.getItem("rokugan_pid") || null;
let gameState = null;
let selectedTokenId = null;
let pendingBorderId = null;
let toastTimeout = null;

// Sound Effects Synthesizer (Web Audio API)
let audioCtx = null;
let soundEnabled = true;

function getAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }
  return audioCtx;
}

function playSound(type) {
  if (!soundEnabled) return;
  try {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === "click") {
      osc.type = "sine";
      osc.frequency.setValueAtTime(550, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(750, ctx.currentTime + 0.05);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05);
      osc.start();
      osc.stop(ctx.currentTime + 0.05);
    } else if (type === "place") {
      osc.type = "triangle";
      osc.frequency.setValueAtTime(220, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.16);
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.16);
      osc.start();
      osc.stop(ctx.currentTime + 0.16);
    } else if (type === "error") {
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(160, ctx.currentTime);
      osc.frequency.setValueAtTime(120, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    }
  } catch (e) {}
}

const lobbyScreen = document.getElementById("lobby-screen");
const gameScreen = document.getElementById("game-screen");
const nameInput = document.getElementById("player-name-input");
const joinBtn = document.getElementById("join-btn");
const clanSelection = document.getElementById("clan-selection");
const clanGrid = document.getElementById("clan-grid");
const readyBtn = document.getElementById("ready-btn");
const lobbyPlayerList = document.getElementById("lobby-player-list");

const leftSidebar = document.getElementById("left-sidebar");
const rightSidebar = document.getElementById("right-sidebar");
const toggleLeftBtn = document.getElementById("toggle-left-btn");
const toggleRightBtn = document.getElementById("toggle-right-btn");
const closeLeftHud = document.getElementById("close-left-hud");
const closeRightHud = document.getElementById("close-right-hud");
const fullscreenBtn = document.getElementById("fullscreen-btn");
const soundBtn = document.getElementById("sound-btn");
const toastEl = document.getElementById("toast-notification");
const tooltipEl = document.getElementById("province-tooltip");

// Territory Banners & Clan Boundaries Configuration (Landscape 1200x800)
// Adjusted coordinates so banners never collide with province nodes
const TERRITORIES = {
  "Unicorn Lands": {
    name: "UNICORN STEPPES",
    icon: "🐎",
    color: "#7209b7",
    bannerX: 180,
    bannerY: 115,
    provs: ["unicorn_1", "unicorn_2", "unicorn_3"]
  },
  "Dragon Lands": {
    name: "DRAGON PEAKS",
    icon: "🐉",
    color: "#2d6a4f",
    bannerX: 530,
    bannerY: 50,
    provs: ["dragon_1", "dragon_2", "dragon_3"]
  },
  "Phoenix Lands": {
    name: "PHOENIX PROVINCES",
    icon: "🦅",
    color: "#e76f51",
    bannerX: 820,
    bannerY: 55,
    provs: ["phoenix_1", "phoenix_2", "phoenix_3"]
  },
  "Lion Lands": {
    name: "LION HEARTLAND",
    icon: "🦁",
    color: "#d4a373",
    bannerX: 485,
    bannerY: 275,
    provs: ["lion_1", "lion_2", "lion_3"]
  },
  "Crane Lands": {
    name: "CRANE COAST",
    icon: "🪶",
    color: "#6ec5e9",
    bannerX: 860,
    bannerY: 390,
    provs: ["crane_1", "crane_2", "crane_3"]
  },
  "Scorpion Lands": {
    name: "SCORPION REALM",
    icon: "🦂",
    color: "#9b2226",
    bannerX: 230,
    bannerY: 460,
    provs: ["scorpion_1", "scorpion_2", "scorpion_3"]
  },
  "Crab Lands": {
    name: "CRAB LANDS & KAIU WALL",
    icon: "🦀",
    color: "#2b4c7e",
    bannerX: 555,
    bannerY: 625,
    provs: ["crab_1", "crab_2", "crab_3"]
  },
  "Shadowlands": {
    name: "THE SHADOWLANDS",
    icon: "👹",
    color: "#c1121f",
    bannerX: 105,
    bannerY: 645,
    provs: ["shadow_1", "shadow_2"]
  },
  "Silk and Spice": {
    name: "SILK & SPICE ISLES",
    icon: "🌴",
    color: "#00b4d8",
    bannerX: 1090,
    bannerY: 520,
    provs: ["island_1", "island_2", "island_3"]
  }
};

function showToast(msg) {
  playSound("error");
  if (toastTimeout) clearTimeout(toastTimeout);
  toastEl.textContent = msg;
  toastEl.classList.remove("hidden");
  toastTimeout = setTimeout(() => {
    toastEl.classList.add("hidden");
  }, 3200);
}

function showProvinceTooltip(p, e) {
  if (!tooltipEl || !gameState) return;
  const ctrlPlayer = p.controller ? gameState.players[p.controller] : null;
  const ctrlName = ctrlPlayer ? `${ctrlPlayer.name} (${ctrlPlayer.clan})` : "Neutral Province";
  const totalDef = p.defense + p.bonus_defense;

  let statusText = "Active Territory";
  if (p.scorched) statusText = "🔥 Scorched Earth";
  if (p.peace) statusText = "🕊 Protected by Peace";

  tooltipEl.innerHTML = `
    <div class="tooltip-title">${p.capital_of ? "👑 " : ""}${p.name}</div>
    <div class="tooltip-row"><span>Territory:</span><strong>${p.territory}</strong></div>
    <div class="tooltip-row"><span>Controller:</span><strong style="color:${ctrlPlayer && ctrlPlayer.clan ? gameState.clans[ctrlPlayer.clan].color : '#aaa'}">${ctrlName}</strong></div>
    <div class="tooltip-row"><span>Defense:</span><strong>⚔ ${totalDef}</strong></div>
    <div class="tooltip-row"><span>Honor:</span><strong style="color:#ffd166">★ ${p.honor}</strong></div>
    <div class="tooltip-row"><span>Coastal:</span><strong>${p.coastal ? "⚓ Yes (Navy eligible)" : "No (Landlocked)"}</strong></div>
    <div class="tooltip-row"><span>Status:</span><strong>${statusText}</strong></div>
  `;
  tooltipEl.classList.remove("hidden");
  updateTooltipPos(e);
}

function updateTooltipPos(e) {
  if (!tooltipEl || tooltipEl.classList.contains("hidden")) return;
  const container = document.querySelector(".map-container");
  const rect = container.getBoundingClientRect();
  let x = e.clientX - rect.left + 15;
  let y = e.clientY - rect.top + 15;
  if (x + 240 > rect.width) x -= 255;
  if (y + 190 > rect.height) y -= 190;
  tooltipEl.style.left = `${Math.max(10, x)}px`;
  tooltipEl.style.top = `${Math.max(10, y)}px`;
}

function hideTooltip() {
  if (tooltipEl) tooltipEl.classList.add("hidden");
}

function connectWebSocket() {
  const proto = window.location.protocol === "https:" ? "wss" : "ws";
  ws = new WebSocket(`${proto}://${window.location.host}/ws`);

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.type === "JOINED") {
      myPlayerId = msg.player_id;
      localStorage.setItem("rokugan_pid", myPlayerId);
      clanSelection.classList.remove("hidden");
      playSound("click");
    } else if (msg.type === "STATE_UPDATE") {
      gameState = msg.state;
      renderUI();
    } else if (msg.type === "ERROR") {
      showToast(msg.message);
    }
  };

  ws.onclose = () => {
    setTimeout(connectWebSocket, 2000);
  };
}

connectWebSocket();

joinBtn.addEventListener("click", () => {
  playSound("click");
  const name = nameInput.value.trim() || "Samurai";
  ws.send(JSON.stringify({ action: "JOIN", player_id: myPlayerId, name }));
});

readyBtn.addEventListener("click", () => {
  playSound("click");
  ws.send(JSON.stringify({ action: "TOGGLE_READY" }));
});

document.getElementById("next-round-btn").addEventListener("click", () => {
  playSound("click");
  ws.send(JSON.stringify({ action: "NEXT_ROUND" }));
});

document.getElementById("reset-btn").addEventListener("click", () => {
  if (confirm("Reset the entire game back to Lobby?")) {
    playSound("click");
    ws.send(JSON.stringify({ action: "RESET_GAME" }));
  }
});

document.getElementById("cancel-border-btn").addEventListener("click", () => {
  pendingBorderId = null;
  document.getElementById("border-modal").classList.add("hidden");
});

// Fullscreen, Sound & HUD Toggles
if (soundBtn) {
  soundBtn.addEventListener("click", () => {
    soundEnabled = !soundEnabled;
    soundBtn.textContent = soundEnabled ? "🔊" : "🔇";
    soundBtn.classList.toggle("active", soundEnabled);
  });
}

if (fullscreenBtn) {
  fullscreenBtn.addEventListener("click", () => {
    playSound("click");
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      fullscreenBtn.textContent = "⛶ Exit Full";
    } else {
      document.exitFullscreen().catch(() => {});
      fullscreenBtn.textContent = "⛶ Fullscreen";
    }
  });
}

if (toggleLeftBtn) {
  toggleLeftBtn.addEventListener("click", () => {
    playSound("click");
    const isCollapsed = leftSidebar.classList.toggle("collapsed");
    toggleLeftBtn.classList.toggle("active", !isCollapsed);
  });
}

if (toggleRightBtn) {
  toggleRightBtn.addEventListener("click", () => {
    playSound("click");
    const isCollapsed = rightSidebar.classList.toggle("collapsed");
    toggleRightBtn.classList.toggle("active", !isCollapsed);
  });
}

if (closeLeftHud) {
  closeLeftHud.addEventListener("click", () => {
    playSound("click");
    leftSidebar.classList.add("collapsed");
    toggleLeftBtn.classList.remove("active");
  });
}

if (closeRightHud) {
  closeRightHud.addEventListener("click", () => {
    playSound("click");
    rightSidebar.classList.add("collapsed");
    toggleRightBtn.classList.remove("active");
  });
}

// --- TUTORIAL SYSTEM ---
let currentTutStep = 0;
const totalTutSteps = 5;
const tutorialModal = document.getElementById("tutorial-modal");
const closeTutorialBtn = document.getElementById("close-tutorial-btn");
const lobbyTutorialBtn = document.getElementById("lobby-tutorial-btn");
const gameTutorialBtn = document.getElementById("game-tutorial-btn");
const tutPrevBtn = document.getElementById("tut-prev-btn");
const tutNextBtn = document.getElementById("tut-next-btn");
const tutTabs = document.querySelectorAll(".tutorial-tab");
const tutDots = document.querySelectorAll(".tut-dot");

function openTutorial(step = 0) {
  playSound("click");
  setTutorialStep(step);
  tutorialModal.classList.remove("hidden");
  localStorage.setItem("rokugan_tut_seen", "true");
}

function closeTutorial() {
  playSound("click");
  tutorialModal.classList.add("hidden");
}

function setTutorialStep(idx) {
  currentTutStep = Math.max(0, Math.min(totalTutSteps - 1, idx));

  for (let i = 0; i < totalTutSteps; i++) {
    const stepEl = document.getElementById(`tutorial-step-${i}`);
    if (stepEl) {
      stepEl.classList.toggle("hidden", i !== currentTutStep);
    }
  }

  tutTabs.forEach((tab) => {
    tab.classList.toggle("active", parseInt(tab.dataset.step) === currentTutStep);
  });

  tutDots.forEach((dot) => {
    dot.classList.toggle("active", parseInt(dot.dataset.step) === currentTutStep);
  });

  tutPrevBtn.disabled = currentTutStep === 0;
  tutNextBtn.textContent = currentTutStep === totalTutSteps - 1 ? "Got It! Start Playing" : "Next \u2192";
}

if (lobbyTutorialBtn) lobbyTutorialBtn.addEventListener("click", () => openTutorial(0));
if (gameTutorialBtn) gameTutorialBtn.addEventListener("click", () => openTutorial(0));
if (closeTutorialBtn) closeTutorialBtn.addEventListener("click", closeTutorial);

tutPrevBtn.addEventListener("click", () => {
  playSound("click");
  if (currentTutStep > 0) setTutorialStep(currentTutStep - 1);
});

tutNextBtn.addEventListener("click", () => {
  playSound("click");
  if (currentTutStep < totalTutSteps - 1) {
    setTutorialStep(currentTutStep + 1);
  } else {
    closeTutorial();
  }
});

tutTabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    playSound("click");
    setTutorialStep(parseInt(tab.dataset.step));
  });
});

tutDots.forEach((dot) => {
  dot.addEventListener("click", () => {
    playSound("click");
    setTutorialStep(parseInt(dot.dataset.step));
  });
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !tutorialModal.classList.contains("hidden")) {
    closeTutorial();
  }
});

if (!localStorage.getItem("rokugan_tut_seen")) {
  setTimeout(() => openTutorial(0), 400);
}

// --- LEGAL MOVE VALIDATOR FOR CLIENT UI ---
function checkProvinceLegality(token, provId) {
  if (!token || !gameState) return { ok: false, reason: "No token selected" };
  const prov = gameState.board.provinces[provId];
  if (!prov) return { ok: false, reason: "Invalid province" };

  if (prov.scorched) return { ok: false, reason: `${prov.name} is Scorched Earth.` };
  if (prov.peace) return { ok: false, reason: `${prov.name} is at Peace.` };

  const ttype = token.type;
  if (ttype === "Army") {
    if (prov.controller !== myPlayerId) {
      return { ok: false, reason: "Armies placed in a province can only defend a province you control. (To attack, place on a border)." };
    }
  } else if (ttype === "Navy") {
    if (!prov.coastal) {
      return { ok: false, reason: "Navy tokens can only be placed on coastal provinces or coastal borders." };
    }
  } else if (ttype === "Diplomat" || ttype === "Blessing") {
    if (prov.controller !== myPlayerId) {
      return { ok: false, reason: `${ttype} tokens can only be placed inside a province you control.` };
    }
  }
  return { ok: true };
}

function checkBorderLegality(token, borderId, attackTargetId) {
  if (!token || !gameState) return { ok: false, reason: "No token selected" };
  const border = gameState.board.borders[borderId];
  if (!border) return { ok: false, reason: "Invalid border" };

  // Occupied border check
  const isOccupied = gameState.board.placed_tokens.some(
    (pt) => pt.target_type === "border" && pt.target_id === borderId
  );
  if (isOccupied) return { ok: false, reason: "Border is already occupied by a combat token." };

  const ttype = token.type;
  if (["Shinobi", "Raid", "Diplomat", "Blessing"].includes(ttype)) {
    return { ok: false, reason: `${ttype} tokens must be placed in a province center, not on a border.` };
  }

  if (ttype === "Navy" && !border.coastal) {
    return { ok: false, reason: "Navy tokens can only be placed on coastal borders." };
  }

  if (attackTargetId) {
    const targetProv = gameState.board.provinces[attackTargetId];
    const originId = attackTargetId === border.p1 ? border.p2 : border.p1;
    const originProv = gameState.board.provinces[originId];

    if (targetProv.scorched) return { ok: false, reason: `Cannot attack into scorched ${targetProv.name}.` };
    if (targetProv.peace) return { ok: false, reason: `Cannot attack into peaceful ${targetProv.name}.` };

    if (ttype === "Army") {
      if (originProv.controller !== myPlayerId && targetProv.controller !== myPlayerId) {
        return { ok: false, reason: `Army attack must launch from a province you control (${originProv.name}) or defend your own (${targetProv.name}).` };
      }
    }
  } else {
    const p1 = gameState.board.provinces[border.p1];
    const p2 = gameState.board.provinces[border.p2];
    const canAttackP1 = !p1.scorched && !p1.peace && (ttype !== "Army" || p2.controller === myPlayerId || p1.controller === myPlayerId);
    const canAttackP2 = !p2.scorched && !p2.peace && (ttype !== "Army" || p1.controller === myPlayerId || p2.controller === myPlayerId);
    if (!canAttackP1 && !canAttackP2) {
      return { ok: false, reason: "No legal attack vector across this border." };
    }
  }

  return { ok: true };
}

function renderUI() {
  if (!gameState) return;

  if (gameState.phase === "LOBBY") {
    lobbyScreen.classList.remove("hidden");
    gameScreen.classList.add("hidden");
    renderLobby();
  } else {
    lobbyScreen.classList.add("hidden");
    gameScreen.classList.remove("hidden");
    renderGame();
  }
}

function renderLobby() {
  const me = gameState.players[myPlayerId];
  const takenClans = Object.values(gameState.players)
    .filter((p) => p.id !== myPlayerId && p.clan)
    .map((p) => p.clan);

  clanGrid.innerHTML = "";
  Object.entries(gameState.clans).forEach(([clanName, cData]) => {
    const isTaken = takenClans.includes(clanName);
    const isSelected = me && me.clan === clanName;
    const div = document.createElement("div");
    div.className = `clan-option ${isSelected ? "selected" : ""} ${isTaken ? "taken" : ""}`;
    div.style.borderLeft = `6px solid ${cData.color}`;
    div.innerHTML = `<strong>${clanName}</strong><p style="font-size:0.75rem;color:#bbb;margin-top:4px">${cData.ability}</p>`;
    if (!isTaken && me) {
      div.onclick = () => {
        playSound("click");
        ws.send(JSON.stringify({ action: "SELECT_CLAN", clan: clanName }));
      };
    }
    clanGrid.appendChild(div);
  });

  if (me) {
    readyBtn.disabled = !me.clan;
    readyBtn.textContent = me.ready ? "Waiting for Others (Click to Unready)" : "Ready for War";
  }

  lobbyPlayerList.innerHTML = "";
  Object.values(gameState.players).forEach((p) => {
    const li = document.createElement("li");
    li.innerHTML = `
      <span>${p.name} ${p.clan ? `<strong>[${p.clan}]</strong>` : "(Choosing Clan...)"}</span>
      <span style="color:${p.ready ? "#06d6a0" : "#e09f3e"}">${p.ready ? "READY" : "Not Ready"}</span>
    `;
    lobbyPlayerList.appendChild(li);
  });
}

function renderGame() {
  const me = gameState.players[myPlayerId];
  document.getElementById("round-display").textContent = `Round ${gameState.round} / 5`;
  document.getElementById("phase-display").textContent = gameState.phase;

  const turnBanner = document.getElementById("turn-banner");
  const handInstruction = document.getElementById("hand-instruction");

  if (gameState.phase === "PLACEMENT") {
    const turnPlayer = gameState.players[gameState.turn_player_id];
    if (gameState.turn_player_id === myPlayerId) {
      turnBanner.textContent = "YOUR TURN — Select a Combat Token & Deploy";
      turnBanner.style.color = "#06d6a0";
      if (selectedTokenId) {
        handInstruction.innerHTML = `<strong style="color:#06d6a0">Token Selected!</strong> Click a pulsing green/gold target on the map:`;
      } else {
        handInstruction.textContent = "Select a token from your hand below to reveal legal targets:";
      }
    } else {
      turnBanner.textContent = `Waiting for ${turnPlayer ? turnPlayer.name : "..."} (${turnPlayer ? turnPlayer.clan : ""})`;
      turnBanner.style.color = "#ffd166";
      handInstruction.textContent = "Waiting for other warlords to place tokens...";
    }
  } else if (gameState.phase === "RESOLUTION") {
    turnBanner.textContent = "Round Resolved! Inspect Revealed Tokens & Battle Results";
    turnBanner.style.color = "#e09f3e";
    handInstruction.textContent = "Review battle results in the Chronicle Log.";
  } else if (gameState.phase === "GAME_OVER") {
    turnBanner.textContent = "GAME OVER — Final Honor Standings";
    handInstruction.textContent = "Game completed. Check the winner in the Scoreboard!";
  }

  const nextBtn = document.getElementById("next-round-btn");
  if (gameState.phase === "RESOLUTION" && gameState.round < 5) {
    nextBtn.classList.remove("hidden");
  } else {
    nextBtn.classList.add("hidden");
  }

  // Scoreboard
  const sb = document.getElementById("scoreboard");
  sb.innerHTML = "";
  gameState.player_order.forEach((pid) => {
    const p = gameState.players[pid];
    const clanColor = p.clan ? gameState.clans[p.clan].color : "#888";
    const card = document.createElement("div");
    card.className = "score-card";
    card.style.borderLeftColor = clanColor;
    card.innerHTML = `
      <div style="display:flex;justify-content:space-between">
        <strong>${p.name} (${p.clan})</strong>
        <span style="color:#ffd166;font-weight:bold">${p.score} Honor</span>
      </div>
      <div style="font-size:0.75rem;color:#aaa;margin-top:3px">${gameState.clans[p.clan].ability}</div>
    `;
    sb.appendChild(card);
  });

  // Secret Objective
  const objBox = document.getElementById("secret-objective-card");
  if (me && me.secret_objective) {
    objBox.innerHTML = `<strong style="color:#ffd166">${me.secret_objective.name}</strong><p style="margin-top:4px">${me.secret_objective.desc}</p>`;
  }

  // Action Log
  const logContainer = document.getElementById("action-log");
  logContainer.innerHTML = gameState.logs.map((l) => `<div class="log-entry">${l}</div>`).join("");
  logContainer.scrollTop = logContainer.scrollHeight;

  // Hand Tray
  const handContainer = document.getElementById("hand-tokens");
  handContainer.innerHTML = "";
  if (me) {
    document.getElementById("pool-counter").textContent = `Remaining Pool: ${me.pool_count}`;
    me.hand.forEach((token) => {
      const div = document.createElement("div");
      div.className = `combat-token ${selectedTokenId === token.id ? "selected-token" : ""}`;
      div.draggable = true;
      div.innerHTML = `
        <span class="token-type">${token.type}</span>
        <span class="token-str">${token.strength > 0 ? `+${token.strength}` : "★"}</span>
      `;
      div.onclick = () => {
        if (gameState.turn_player_id !== myPlayerId) {
          showToast("It is not your turn to place a token!");
          return;
        }
        playSound("click");
        selectedTokenId = selectedTokenId === token.id ? null : token.id;
        renderGame();
      };
      div.ondragstart = () => {
        if (gameState.turn_player_id === myPlayerId) {
          playSound("click");
          selectedTokenId = token.id;
          renderGame();
        }
      };
      handContainer.appendChild(div);
    });
  }

  renderMap();
}

function renderMap() {
  const territoriesGroup = document.getElementById("map-territories");
  const bannersGroup = document.getElementById("map-clan-banners");
  const bordersGroup = document.getElementById("map-borders");
  const provincesGroup = document.getElementById("map-provinces");
  const tokensGroup = document.getElementById("map-tokens");

  territoriesGroup.innerHTML = "";
  bannersGroup.innerHTML = "";
  bordersGroup.innerHTML = "";
  provincesGroup.innerHTML = "";
  tokensGroup.innerHTML = "";

  const provs = gameState.board.provinces;
  const me = gameState.players[myPlayerId];
  const selectedToken = me ? me.hand.find((t) => t.id === selectedTokenId) : null;
  const isMyTurn = gameState.phase === "PLACEMENT" && gameState.turn_player_id === myPlayerId;

  // 1. Organic Watercolor Shaded Territory Auras (NO BOXES)
  Object.entries(TERRITORIES).forEach(([tName, tData]) => {
    const tProvs = tData.provs.map((pid) => provs[pid]).filter(Boolean);
    if (tProvs.length >= 2) {
      const avgX = tProvs.reduce((sum, p) => sum + p.x, 0) / tProvs.length;
      const avgY = tProvs.reduce((sum, p) => sum + p.y, 0) / tProvs.length;
      const rx = Math.max(...tProvs.map((p) => Math.abs(p.x - avgX))) + 58;
      const ry = Math.max(...tProvs.map((p) => Math.abs(p.y - avgY))) + 58;

      const ellipse = document.createElementNS("http://www.w3.org/2000/svg", "ellipse");
      ellipse.setAttribute("cx", avgX);
      ellipse.setAttribute("cy", avgY);
      ellipse.setAttribute("rx", Math.max(rx, 80));
      ellipse.setAttribute("ry", Math.max(ry, 65));
      ellipse.setAttribute("fill", tData.color);
      ellipse.setAttribute("fill-opacity", "0.24");
      ellipse.setAttribute("filter", "url(#territory-blur)");
      territoriesGroup.appendChild(ellipse);
    }

    // Calligraphy Territory Banner in sleek pill badge (never overlaps province nodes)
    const gBanner = document.createElementNS("http://www.w3.org/2000/svg", "g");
    const bannerText = `${tData.icon} ${tData.name}`;
    const pillWidth = bannerText.length * 7.5 + 24;

    const bgPill = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    bgPill.setAttribute("x", tData.bannerX - pillWidth / 2);
    bgPill.setAttribute("y", tData.bannerY - 12);
    bgPill.setAttribute("width", pillWidth);
    bgPill.setAttribute("height", "24");
    bgPill.setAttribute("rx", "12");
    bgPill.setAttribute("fill", "rgba(16, 14, 13, 0.88)");
    bgPill.setAttribute("stroke", tData.color);
    bgPill.setAttribute("stroke-width", "1.5");
    bgPill.setAttribute("filter", "url(#node-shadow)");
    gBanner.appendChild(bgPill);

    const banner = document.createElementNS("http://www.w3.org/2000/svg", "text");
    banner.setAttribute("x", tData.bannerX);
    banner.setAttribute("y", tData.bannerY + 4);
    banner.setAttribute("text-anchor", "middle");
    banner.setAttribute("class", "territory-banner");
    banner.setAttribute("fill", tData.color);
    banner.textContent = bannerText;
    gBanner.appendChild(banner);

    bannersGroup.appendChild(gBanner);
  });

  // 2. Render Borders & Midpoint Hotspots with Legality Highlighting
  Object.values(gameState.board.borders).forEach((b) => {
    const p1 = provs[b.p1];
    const p2 = provs[b.p2];
    if (!p1 || !p2) return;

    const midX = (p1.x + p2.x) / 2;
    const midY = (p1.y + p2.y) / 2;

    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", p1.x);
    line.setAttribute("y1", p1.y);
    line.setAttribute("x2", p2.x);
    line.setAttribute("y2", p2.y);
    line.setAttribute("stroke", b.coastal ? "#00d4ff" : "#e0c38c");
    line.setAttribute("stroke-width", b.coastal ? "3" : "1.8");
    line.setAttribute("stroke-opacity", "0.6");
    line.setAttribute("stroke-dasharray", b.coastal ? "6,4" : "none");
    bordersGroup.appendChild(line);

    // Only render hotspot circle if border is NOT occupied by a placed token
    const isOccupied = gameState.board.placed_tokens.some(
      (pt) => pt.target_type === "border" && pt.target_id === b.id
    );

    if (!isOccupied) {
      const hotspot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      hotspot.setAttribute("cx", midX);
      hotspot.setAttribute("cy", midY);
      hotspot.setAttribute("r", "11");
      hotspot.setAttribute("stroke", "#1b1b1e");
      hotspot.setAttribute("stroke-width", "2");

      let isLegal = true;
      let illegalReason = "";

      if (selectedToken && isMyTurn) {
        const leg = checkBorderLegality(selectedToken, b.id);
        isLegal = leg.ok;
        illegalReason = leg.reason || "Illegal border target";
      }

      if (selectedToken && isMyTurn) {
        if (isLegal) {
          hotspot.setAttribute("fill", "#06d6a0");
          hotspot.setAttribute("class", "drop-target border-hotspot legal-target");
        } else {
          hotspot.setAttribute("fill", "#555");
          hotspot.setAttribute("class", "drop-target border-hotspot illegal-target");
        }
      } else {
        hotspot.setAttribute("fill", b.coastal ? "#00b4d8" : "#cca05a");
        hotspot.setAttribute("class", "drop-target border-hotspot");
      }

      hotspot.onclick = () => {
        if (!selectedTokenId) {
          showToast("Select a token from your hand first!");
          return;
        }
        if (!isLegal) {
          showToast(illegalReason);
          return;
        }
        handleBorderSelect(b);
      };

      hotspot.ondragover = (e) => e.preventDefault();
      hotspot.ondrop = () => {
        if (isLegal) handleBorderSelect(b);
        else showToast(illegalReason);
      };

      bordersGroup.appendChild(hotspot);
    }
  });

  // 3. Render Province Nodes with Name Pill ABOVE and Stats INSIDE (Zero Overlap)
  Object.values(provs).forEach((p) => {
    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    g.setAttribute("class", "province-node");
    const ctrlPlayer = p.controller ? gameState.players[p.controller] : null;

    // Territory native color
    const tData = TERRITORIES[p.territory] || { color: "#8e8071", icon: "⛩" };

    let fillColor = "rgba(28, 25, 23, 0.85)";
    let strokeColor = tData.color;
    let strokeWidth = p.capital_of ? "4" : "2.5";

    if (p.scorched) {
      fillColor = "rgba(18, 18, 18, 0.92)";
      strokeColor = "#e63946";
      strokeWidth = "3";
    } else if (ctrlPlayer && ctrlPlayer.clan) {
      fillColor = gameState.clans[ctrlPlayer.clan].color;
      strokeColor = p.capital_of ? "#ffd166" : "#ffffff";
      strokeWidth = p.capital_of ? "4.5" : "3";
    }

    let isLegal = true;
    let illegalReason = "";

    if (selectedToken && isMyTurn) {
      const leg = checkProvinceLegality(selectedToken, p.id);
      isLegal = leg.ok;
      illegalReason = leg.reason || "Illegal province target";
    }

    // A. Province Name Pill (Placed cleanly ABOVE circle at p.y - 34)
    const nameStr = p.capital_of ? `★ ${p.name}` : p.name;
    const pillW = nameStr.length * 6.6 + 18;

    const nameBg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    nameBg.setAttribute("x", p.x - pillW / 2);
    nameBg.setAttribute("y", p.y - 43);
    nameBg.setAttribute("width", pillW);
    nameBg.setAttribute("height", "17");
    nameBg.setAttribute("rx", "5");
    nameBg.setAttribute("fill", "rgba(14, 12, 11, 0.92)");
    nameBg.setAttribute("stroke", strokeColor);
    nameBg.setAttribute("stroke-width", "1");
    nameBg.setAttribute("class", "province-pill-bg");
    g.appendChild(nameBg);

    const nameText = document.createElementNS("http://www.w3.org/2000/svg", "text");
    nameText.setAttribute("x", p.x);
    nameText.setAttribute("y", p.y - 30);
    nameText.setAttribute("text-anchor", "middle");
    nameText.setAttribute("class", "province-title");
    nameText.textContent = nameStr;
    g.appendChild(nameText);

    // B. Province Circle (Center at p.x, p.y)
    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("cx", p.x);
    circle.setAttribute("cy", p.y);
    circle.setAttribute("r", p.capital_of ? "26" : "23");
    circle.setAttribute("fill", fillColor);
    circle.setAttribute("stroke", strokeColor);
    circle.setAttribute("stroke-width", strokeWidth);
    circle.setAttribute("filter", "url(#node-shadow)");

    if (selectedToken && isMyTurn) {
      if (isLegal) {
        circle.setAttribute("class", "province-circle drop-target legal-target");
      } else {
        circle.setAttribute("class", "province-circle drop-target illegal-target");
      }
    } else {
      circle.setAttribute("class", "province-circle drop-target");
    }

    // Hover Tooltip Handlers
    circle.onmouseenter = (e) => showProvinceTooltip(p, e);
    circle.onmousemove = (e) => updateTooltipPos(e);
    circle.onmouseleave = hideTooltip;

    circle.onclick = () => {
      if (!selectedTokenId) {
        showToast("Select a token from your hand first!");
        return;
      }
      if (!isLegal) {
        showToast(illegalReason);
        return;
      }
      playSound("place");
      handleProvinceSelect(p.id);
    };

    circle.ondragover = (e) => e.preventDefault();
    circle.ondrop = () => {
      if (isLegal) {
        playSound("place");
        handleProvinceSelect(p.id);
      } else {
        showToast(illegalReason);
      }
    };

    g.appendChild(circle);

    // C. Icon inside circle (Upper half: p.y - 4)
    const iconText = document.createElementNS("http://www.w3.org/2000/svg", "text");
    iconText.setAttribute("x", p.x);
    iconText.setAttribute("y", p.y - 4);
    iconText.setAttribute("text-anchor", "middle");
    iconText.setAttribute("class", "province-mon-icon");
    if (p.scorched) {
      iconText.textContent = "🔥";
    } else if (p.peace) {
      iconText.textContent = "🕊";
    } else if (p.capital_of) {
      iconText.textContent = "👑";
    } else {
      iconText.textContent = tData.icon;
    }
    g.appendChild(iconText);

    // D. Defense & Honor stats inside circle (Lower half: p.y + 12)
    const stats = document.createElementNS("http://www.w3.org/2000/svg", "text");
    stats.setAttribute("x", p.x);
    stats.setAttribute("y", p.y + 12);
    stats.setAttribute("text-anchor", "middle");
    stats.setAttribute("class", "province-stats");

    if (!p.scorched) {
      const totalDef = p.defense + p.bonus_defense;
      stats.textContent = `⚔${totalDef} ★${p.honor}`;
    }
    g.appendChild(stats);

    provincesGroup.appendChild(g);
  });

  // 4. Render Placed Combat Tokens (BELOW province circle at p.y + 36, ZERO overlap)
  const provTokensMap = {};
  const borderTokensList = [];

  gameState.board.placed_tokens.forEach((pt) => {
    if (pt.target_type === "province") {
      provTokensMap[pt.target_id] = provTokensMap[pt.target_id] || [];
      provTokensMap[pt.target_id].push(pt);
    } else {
      borderTokensList.push(pt);
    }
  });

  // A. Placed Tokens inside Provinces (docked neatly below circle)
  Object.entries(provTokensMap).forEach(([provId, tokens]) => {
    const p = provs[provId];
    if (!p) return;
    const count = tokens.length;
    const tokenW = 32;
    const gap = 4;
    const startX = p.x - ((count - 1) * (tokenW + gap)) / 2;
    const tokenY = p.y + 36; // 12px below R=24 circle, never overlaps!

    tokens.forEach((pt, idx) => {
      const tokenX = startX + idx * (tokenW + gap);
      const owner = gameState.players[pt.owner];
      const color = owner && owner.clan ? gameState.clans[owner.clan].color : "#444";

      const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
      g.setAttribute("class", "placed-token-group");

      const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      rect.setAttribute("x", tokenX - 16);
      rect.setAttribute("y", tokenY - 10);
      rect.setAttribute("width", "32");
      rect.setAttribute("height", "20");
      rect.setAttribute("rx", "4");
      rect.setAttribute("fill", color);
      rect.setAttribute("stroke", "#ffd166");
      rect.setAttribute("stroke-width", "1.8");
      rect.setAttribute("class", "placed-token-badge");
      g.appendChild(rect);

      const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
      label.setAttribute("x", tokenX);
      label.setAttribute("y", tokenY + 4);
      label.setAttribute("text-anchor", "middle");
      label.setAttribute("fill", "#fff");
      label.setAttribute("font-size", "9.5");
      label.setAttribute("font-weight", "bold");

      if (pt.is_face_down && pt.owner !== myPlayerId) {
        label.textContent = "???";
      } else if (pt.token) {
        const shortType = pt.token.type.substring(0, 3).toUpperCase();
        label.textContent = `${shortType}${pt.token.strength || ""}`;
      }
      g.appendChild(label);
      tokensGroup.appendChild(g);
    });
  });

  // B. Placed Tokens on Borders
  borderTokensList.forEach((pt) => {
    const b = gameState.board.borders[pt.target_id];
    if (!b) return;
    const p1 = provs[b.p1];
    const p2 = provs[b.p2];
    const midX = (p1.x + p2.x) / 2;
    const midY = (p1.y + p2.y) / 2;
    const owner = gameState.players[pt.owner];
    const color = owner && owner.clan ? gameState.clans[owner.clan].color : "#444";

    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    g.setAttribute("class", "placed-token-group");

    const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    rect.setAttribute("x", midX - 17);
    rect.setAttribute("y", midY - 11);
    rect.setAttribute("width", "34");
    rect.setAttribute("height", "22");
    rect.setAttribute("rx", "4");
    rect.setAttribute("fill", color);
    rect.setAttribute("stroke", "#ffd166");
    rect.setAttribute("stroke-width", "2");
    rect.setAttribute("class", "placed-token-badge");
    g.appendChild(rect);

    const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
    label.setAttribute("x", midX);
    label.setAttribute("y", midY + 4);
    label.setAttribute("text-anchor", "middle");
    label.setAttribute("fill", "#fff");
    label.setAttribute("font-size", "10");
    label.setAttribute("font-weight", "bold");

    if (pt.is_face_down && pt.owner !== myPlayerId) {
      label.textContent = "???";
    } else if (pt.token) {
      const shortType = pt.token.type.substring(0, 3).toUpperCase();
      label.textContent = `${shortType}${pt.token.strength || ""}`;
    }
    g.appendChild(label);
    tokensGroup.appendChild(g);
  });
}

function handleProvinceSelect(provId) {
  if (!selectedTokenId) return;
  playSound("place");
  ws.send(
    JSON.stringify({
      action: "PLACE_TOKEN",
      token_id: selectedTokenId,
      target_type: "province",
      target_id: provId,
      attack_target: provId,
    })
  );
  selectedTokenId = null;
  renderGame();
}

function handleBorderSelect(border) {
  if (!selectedTokenId) return;
  pendingBorderId = border.id;
  const p1 = gameState.board.provinces[border.p1];
  const p2 = gameState.board.provinces[border.p2];
  const me = gameState.players[myPlayerId];
  const selectedToken = me ? me.hand.find((t) => t.id === selectedTokenId) : null;

  const btnContainer = document.getElementById("border-target-buttons");
  btnContainer.innerHTML = "";

  [p1, p2].forEach((targetProv) => {
    const leg = checkBorderLegality(selectedToken, border.id, targetProv.id);
    const btn = document.createElement("button");
    btn.textContent = `Attack / Support ${targetProv.name}`;
    if (!leg.ok) {
      btn.disabled = true;
      btn.title = leg.reason;
      btn.style.opacity = "0.45";
    }
    btn.onclick = () => {
      playSound("place");
      ws.send(
        JSON.stringify({
          action: "PLACE_TOKEN",
          token_id: selectedTokenId,
          target_type: "border",
          target_id: pendingBorderId,
          attack_target: targetProv.id,
        })
      );
      selectedTokenId = null;
      pendingBorderId = null;
      document.getElementById("border-modal").classList.add("hidden");
      renderGame();
    };
    btnContainer.appendChild(btn);
  });

  document.getElementById("border-modal").classList.remove("hidden");
}

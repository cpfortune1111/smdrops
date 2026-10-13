import {Match3Engine, makeVariant, COLOR_NAMES} from "./engine.mjs";

const $ = selector => document.querySelector(selector);
const boardEl = $("#board");
let baseStage, engine, selected = null, hintTimer, busy = false, mode = "score";

async function boot() {
  baseStage = await fetch("./data/lvl_F_0001_00.json").then(r => {
    if (!r.ok) throw new Error(`Stage data ${r.status}`);
    return r.json();
  });
  setupNavigation();
  $("#stage-select").addEventListener("change", event => start(event.target.value));
  $("#restart").addEventListener("click", () => start(mode));
  $("#skill-button").addEventListener("click", useSkill);
  $("#result-close").addEventListener("click", () => $("#result-dialog").close());
  start("score");
  updateCollection();
}

function start(nextMode) {
  mode = nextMode;
  const stage = makeVariant(baseStage, mode);
  engine = new Match3Engine(stage);
  selected = null;
  const names = {score: ["1", "Moonlit Beginning"], collect: ["Lab", "Color Gathering"], clean: ["Lab", "Crystal Clearing"]};
  $("#stage-number").textContent = names[mode][0];
  $("#stage-title").textContent = names[mode][1];
  $("#identity-readout").textContent = `${stage.identity.series.name} / ${stage.identity.mainStage}-${stage.identity.subStage}`;
  $("#rules-readout").textContent = `${stage.rules.winCondition} / ${stage.rules.loseCondition}`;
  $("#hash-readout").textContent = stage.source.sha256.slice(0, 16) + "…";
  render(true);
  resetHintTimer();
}

function render(rebuild = false) {
  const stage = engine.stage;
  if (rebuild) {
    boardEl.innerHTML = "";
    boardEl.style.setProperty("--cols", engine.width);
    boardEl.style.setProperty("--rows", engine.height);
    boardEl.setAttribute("aria-rowcount", engine.height);
    boardEl.setAttribute("aria-colcount", engine.width);
    for (let y = 0; y < engine.height; y++) for (let x = 0; x < engine.width; x++) {
      const button = document.createElement("button");
      button.className = "cell" + (engine.isPlayable(x, y) ? "" : " hole");
      button.dataset.x = x; button.dataset.y = y;
      button.setAttribute("role", "gridcell");
      button.addEventListener("click", () => selectCell(x, y));
      boardEl.append(button);
    }
  }
  for (const cell of boardEl.children) {
    const x = Number(cell.dataset.x), y = Number(cell.dataset.y), piece = engine.piece(x, y);
    cell.classList.toggle("selected", selected?.x === x && selected?.y === y);
    cell.innerHTML = "";
    if (piece) {
      const gem = document.createElement("i");
      gem.className = `piece ${piece.special || ""}`;
      gem.dataset.color = piece.color;
      gem.setAttribute("aria-label", `${COLOR_NAMES[piece.color]}${piece.special ? ` ${piece.special}` : ""}`);
      cell.append(gem);
    }
    const layers = engine.obstacles[y]?.[x] || 0;
    if (layers) {
      const obstacle = document.createElement("span");
      obstacle.className = "obstacle" + (layers === 1 ? " damaged" : "");
      cell.append(obstacle);
    }
  }
  $("#moves").textContent = engine.moves;
  $("#score").textContent = engine.score.toLocaleString();
  $("#bronze").textContent = stage.rules.starScores.bronze.toLocaleString();
  $("#silver").textContent = stage.rules.starScores.silver.toLocaleString();
  $("#gold").textContent = stage.rules.starScores.gold.toLocaleString();
  const starPercent = Math.min(100, engine.score / Math.max(1, stage.rules.starScores.gold) * 100);
  $("#star-progress").style.width = `${starPercent}%`;
  $("#skill-fill").style.width = `${engine.energy}%`;
  $("#skill-button").disabled = engine.energy < 100 || engine.status !== "playing";
  $("#board-size").textContent = `${stage.board.width}×${stage.board.height} / ${engine.width}×${engine.height}`;
  updateObjective();
}

function updateObjective() {
  const {winCondition, targets} = engine.stage.rules;
  const targetList = $("#target-list");
  targetList.innerHTML = "";
  if (winCondition === "SCORE") $("#objective-label").textContent = `取得 ${engine.stage.rules.starScores.bronze.toLocaleString()} 分`;
  if (winCondition === "CLEAN") {
    $("#objective-label").textContent = "清除所有水晶障礙";
    targetList.append(targetRow("水晶障礙", engine.cleanRemaining, "#9cdef1"));
  }
  if (winCondition === "COLLECT") {
    $("#objective-label").textContent = "收集指定棋子";
    targets.colors.forEach((amount, color) => { if (amount) targetList.append(targetRow(COLOR_NAMES[color], Math.max(0, amount - engine.collected[color]), gemColor(color))); });
  }
}

function targetRow(label, remain, color) {
  const row = document.createElement("div");
  row.className = "target-row";
  row.innerHTML = `<span><i class="target-gem" style="background:${color}"></i>${label}</span><b>${remain}</b>`;
  return row;
}

async function selectCell(x, y) {
  if (busy || engine.status !== "playing" || !engine.isPlayable(x, y)) return;
  resetHintTimer();
  if (!selected) { selected = {x, y}; render(); return; }
  if (selected.x === x && selected.y === y) { selected = null; render(); return; }
  const from = selected, to = {x, y}; selected = null;
  if (!engine.isAdjacent(from, to)) { selected = to; render(); return; }
  busy = true;
  const result = engine.tryMove(from, to);
  if (!result.valid) {
    boardEl.classList.add("shake");
    setTimeout(() => boardEl.classList.remove("shake"), 360);
  } else {
    $("#combo").textContent = result.combo > 1 ? `COMBO ×${result.combo}` : `+${result.scoreDelta}`;
    floatScore(result.scoreDelta, to);
  }
  render();
  busy = false;
  if (result.valid && result.status !== "playing") showResult(result.status);
}

function useSkill() {
  const result = engine.useSkill();
  if (!result.valid) return;
  $("#combo").textContent = `SKILL · ${COLOR_NAMES[result.color]}`;
  render();
  if (result.status !== "playing") showResult(result.status);
}

function floatScore(value, position) {
  if (!value) return;
  const cell = [...boardEl.children].find(el => Number(el.dataset.x) === position.x && Number(el.dataset.y) === position.y);
  const boardRect = boardEl.getBoundingClientRect(), rect = cell.getBoundingClientRect();
  const text = document.createElement("span");
  text.className = "float-text"; text.textContent = `+${value}`;
  text.style.left = `${rect.left - boardRect.left + rect.width / 3}px`;
  text.style.top = `${rect.top - boardRect.top}px`;
  $("#float-layer").append(text);
  setTimeout(() => text.remove(), 850);
}

function showResult(status) {
  const won = status === "won";
  $("#result-kicker").textContent = won ? "STAGE CLEAR" : "TRY AGAIN";
  $("#result-title").textContent = won ? "Mission Complete!" : "Out of moves";
  const thresholds = Object.values(engine.stage.rules.starScores);
  const stars = thresholds.filter(value => engine.score >= value).length;
  $("#result-stars").textContent = won ? "★".repeat(Math.max(1, stars)) + "☆".repeat(3 - Math.max(1, stars)) : "☆☆☆";
  $("#result-summary").textContent = `${engine.score.toLocaleString()} 分 · ${engine.turn} 次操作`;
  if (won) awardPuzzlePiece(mode);
  $("#result-dialog").showModal();
}

function setupNavigation() {
  document.querySelectorAll(".tab").forEach(tab => tab.addEventListener("click", () => {
    document.querySelectorAll(".tab,.panel").forEach(el => el.classList.remove("active"));
    tab.classList.add("active");
    $(`#${tab.dataset.panel}-panel`).classList.add("active");
    if (tab.dataset.panel === "collection") updateCollection();
  }));
}

function awardPuzzlePiece(key) {
  const progress = JSON.parse(localStorage.getItem("moonlit-progress") || "{}");
  progress[key] = true;
  localStorage.setItem("moonlit-progress", JSON.stringify(progress));
  updateCollection();
}

function updateCollection() {
  const progress = JSON.parse(localStorage.getItem("moonlit-progress") || "{}");
  const found = ["score", "collect", "clean"].filter(key => progress[key]).length;
  const grid = $("#puzzle-grid"); grid.innerHTML = "";
  for (let i = 0; i < 9; i++) { const piece = document.createElement("i"); if (i < found * 3) piece.className = "found"; grid.append(piece); }
  $("#wallpaper").classList.toggle("locked", found < 3);
  $("#wallpaper-label").textContent = found === 3 ? "Wallpaper 已解鎖" : `尚欠 ${3 - found} 塊`;
}

function resetHintTimer() {
  clearTimeout(hintTimer);
  document.querySelectorAll(".hint").forEach(el => el.classList.remove("hint"));
  hintTimer = setTimeout(() => {
    const hint = engine?.findHint();
    if (!hint) return;
    for (const p of hint) [...boardEl.children].find(el => Number(el.dataset.x) === p.x && Number(el.dataset.y) === p.y)?.classList.add("hint");
  }, 5000);
}

function gemColor(index) { return ["#e94d93", "#43a8e4", "#efbd35", "#46b68a", "#8c59d8", "#f08464", "#4ac5c4"][index]; }

boot().catch(error => {
  console.error(error);
  document.body.innerHTML = `<main style="padding:40px;font-family:system-ui"><h1>載入失敗</h1><p>${error.message}</p></main>`;
});


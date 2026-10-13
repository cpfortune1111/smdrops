const COLOR_NAMES = ["Rose", "Mercury", "Solar", "Jade", "Violet", "Coral", "Aqua"];

export class Match3Engine {
  constructor(stage, random = Math.random) {
    this.stage = stage;
    this.random = random;
    this.score = 0;
    this.moves = stage.rules.limits.moves || 20;
    this.energy = 0;
    this.turn = 0;
    this.collected = Array(7).fill(0);
    this.cleanRemaining = 0;
    this.selected = null;
    this.status = "playing";
    this.lastCombo = 0;
    this.#buildBoard();
    this.#stabilizeInitialBoard();
  }

  #buildBoard() {
    const source = this.stage.board;
    const playable = source.cells.filter(cell => cell.attributes && !["SPAWN", "EXIT", "WALL", "EDGE"].includes(cell.attributes.kind.name));
    const minX = Math.min(...playable.map(c => c.x));
    const maxX = Math.max(...playable.map(c => c.x));
    const minY = Math.min(...playable.map(c => c.y));
    const maxY = Math.max(...playable.map(c => c.y));
    this.width = maxX - minX + 1;
    this.height = maxY - minY + 1;
    this.mask = Array.from({length: this.height}, () => Array(this.width).fill(false));
    this.board = Array.from({length: this.height}, () => Array(this.width).fill(null));
    this.obstacles = Array.from({length: this.height}, () => Array(this.width).fill(0));
    const cleanPattern = this.stage.prototypeCleanPattern || [];
    for (const cell of playable) {
      const x = cell.x - minX, y = cell.y - minY;
      this.mask[y][x] = true;
      const kind = cell.tile?.kind?.name || "";
      const form = cell.tile?.form?.name || "NORMAL";
      if (/^COLOR[0-6]$/.test(kind)) this.board[y][x] = {color: Number(kind.at(-1)), special: formToSpecial(form)};
      const attr = cell.attributes.kind.name;
      if (/THROUGH_WALL|BROKEN_WALL|CAPTURE/.test(attr)) this.obstacles[y][x] = attr.endsWith("2") ? 3 : attr.endsWith("1") ? 2 : 1;
    }
    for (const [x, y, layers = 1] of cleanPattern) {
      if (this.mask[y]?.[x]) this.obstacles[y][x] = layers;
    }
    this.cleanRemaining = this.obstacles.flat().filter(Boolean).length;
    for (let y = 0; y < this.height; y++) for (let x = 0; x < this.width; x++) {
      if (this.mask[y][x] && !this.board[y][x]) this.board[y][x] = this.#newPiece(x, y, true);
    }
  }

  #newPiece(x, y, avoidMatch = false) {
    const enabled = this.stage.rules.colors.enabled.map((v, i) => v ? i : -1).filter(i => i >= 0);
    const colors = enabled.length >= 3 ? enabled : [0, 1, 2, 3, 4];
    let color;
    for (let tries = 0; tries < 20; tries++) {
      color = colors[Math.floor(this.random() * colors.length)];
      if (!avoidMatch || !this.#wouldMatch(x, y, color)) break;
    }
    return {color, special: null};
  }

  #wouldMatch(x, y, color) {
    const same = (cx, cy) => this.board[cy]?.[cx]?.color === color;
    return (same(x - 1, y) && same(x - 2, y)) || (same(x, y - 1) && same(x, y - 2));
  }

  #stabilizeInitialBoard() {
    for (let guard = 0; guard < 20; guard++) {
      const matches = this.findMatches();
      if (!matches.cells.size) break;
      for (const key of matches.cells) {
        const [x, y] = parseKey(key);
        this.board[y][x] = this.#newPiece(x, y, true);
      }
    }
    if (!this.hasValidMove()) this.shuffle();
  }

  piece(x, y) { return this.board[y]?.[x] || null; }
  isPlayable(x, y) { return Boolean(this.mask[y]?.[x]); }
  isAdjacent(a, b) { return Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1; }

  tryMove(a, b) {
    if (this.status !== "playing" || !this.isPlayable(a.x, a.y) || !this.isPlayable(b.x, b.y) || !this.isAdjacent(a, b)) return {valid: false, reason: "invalid-cell"};
    this.#swap(a, b);
    let firstMatches = this.findMatches();
    const rainbowMove = this.piece(a.x, a.y)?.special === "rainbow" || this.piece(b.x, b.y)?.special === "rainbow";
    if (!firstMatches.cells.size && !rainbowMove) {
      this.#swap(a, b);
      return {valid: false, reason: "no-match"};
    }
    this.moves--;
    this.turn++;
    const result = this.#resolve(a, b, rainbowMove);
    this.#updateStatus();
    if (this.status === "playing" && !this.hasValidMove()) this.shuffle();
    return {valid: true, ...result, status: this.status};
  }

  #resolve(a, b, rainbowMove = false) {
    let combo = 0, scoreDelta = 0, totalCleared = 0;
    let forced = new Set();
    if (rainbowMove) {
      const pa = this.piece(a.x, a.y), pb = this.piece(b.x, b.y);
      const rainbow = pa?.special === "rainbow" ? a : b;
      const other = rainbow === a ? pb : pa;
      forced.add(keyOf(rainbow.x, rainbow.y));
      if (other) for (let y = 0; y < this.height; y++) for (let x = 0; x < this.width; x++) if (this.piece(x, y)?.color === other.color) forced.add(keyOf(x, y));
    }
    for (let guard = 0; guard < 30; guard++) {
      const matches = this.findMatches();
      if (!matches.cells.size && !forced.size) break;
      combo++;
      const clear = new Set([...matches.cells, ...forced]);
      forced = new Set();
      const creation = this.#chooseSpecial(matches, combo === 1 ? b : null);
      if (creation) clear.delete(keyOf(creation.x, creation.y));
      this.#expandSpecialEffects(clear);
      let cleared = 0;
      for (const key of clear) {
        const [x, y] = parseKey(key), piece = this.piece(x, y);
        if (!piece) continue;
        this.collected[piece.color]++;
        this.board[y][x] = null;
        if (this.obstacles[y][x] > 0) {
          this.obstacles[y][x]--;
          if (this.obstacles[y][x] === 0) this.cleanRemaining--;
        }
        cleared++;
      }
      if (creation) this.board[creation.y][creation.x] = {color: creation.color, special: creation.special};
      const gained = cleared * 60 * combo;
      this.score += gained;
      scoreDelta += gained;
      totalCleared += cleared;
      this.energy = Math.min(100, this.energy + cleared * 3);
      this.#collapseAndFill();
    }
    this.lastCombo = combo;
    return {combo, cleared: totalCleared, scoreDelta};
  }

  #chooseSpecial(matches, preferred) {
    if (!matches.groups.length) return null;
    const intersections = new Map();
    for (const group of matches.groups) for (const p of group.cells) intersections.set(keyOf(p.x, p.y), (intersections.get(keyOf(p.x, p.y)) || 0) + 1);
    const cross = [...intersections].find(([, count]) => count > 1);
    if (cross) {
      const [x, y] = parseKey(cross[0]);
      return {x, y, color: this.piece(x, y).color, special: "bomb"};
    }
    const best = [...matches.groups].sort((a, b) => b.cells.length - a.cells.length)[0];
    if (best.cells.length < 4) return null;
    const chosen = preferred && best.cells.some(p => p.x === preferred.x && p.y === preferred.y) ? preferred : best.cells[Math.floor(best.cells.length / 2)];
    return {x: chosen.x, y: chosen.y, color: this.piece(chosen.x, chosen.y).color, special: best.cells.length >= 5 ? "rainbow" : best.axis === "h" ? "line-h" : "line-v"};
  }

  #expandSpecialEffects(clear) {
    const queue = [...clear];
    const add = (x, y) => { if (this.piece(x, y) && !clear.has(keyOf(x, y))) { clear.add(keyOf(x, y)); queue.push(keyOf(x, y)); } };
    while (queue.length) {
      const [x, y] = parseKey(queue.shift()), piece = this.piece(x, y);
      if (!piece?.special) continue;
      if (piece.special === "line-h") for (let cx = 0; cx < this.width; cx++) add(cx, y);
      if (piece.special === "line-v") for (let cy = 0; cy < this.height; cy++) add(x, cy);
      if (piece.special === "bomb") for (let cy = y - 1; cy <= y + 1; cy++) for (let cx = x - 1; cx <= x + 1; cx++) add(cx, cy);
    }
  }

  #collapseAndFill() {
    for (let x = 0; x < this.width; x++) {
      const playableRows = [];
      for (let y = this.height - 1; y >= 0; y--) if (this.mask[y][x]) playableRows.push(y);
      const pieces = playableRows.map(y => this.board[y][x]).filter(Boolean);
      for (let i = 0; i < playableRows.length; i++) this.board[playableRows[i]][x] = pieces[i] || null;
      for (let i = pieces.length; i < playableRows.length; i++) {
        const y = playableRows[i];
        this.board[y][x] = this.#newPiece(x, y, false);
      }
    }
  }

  findMatches() {
    const groups = [], cells = new Set();
    const scan = (axis) => {
      const outer = axis === "h" ? this.height : this.width;
      const inner = axis === "h" ? this.width : this.height;
      for (let a = 0; a < outer; a++) {
        let run = [];
        const flush = () => { if (run.length >= 3) { groups.push({axis, cells: [...run]}); run.forEach(p => cells.add(keyOf(p.x, p.y))); } run = []; };
        for (let b = 0; b <= inner; b++) {
          const x = axis === "h" ? b : a, y = axis === "h" ? a : b;
          const piece = b < inner ? this.piece(x, y) : null;
          if (piece && (!run.length || this.piece(run[0].x, run[0].y)?.color === piece.color)) run.push({x, y}); else { flush(); if (piece) run.push({x, y}); }
        }
      }
    };
    scan("h"); scan("v");
    return {groups, cells};
  }

  #swap(a, b) { [this.board[a.y][a.x], this.board[b.y][b.x]] = [this.board[b.y][b.x], this.board[a.y][a.x]]; }

  hasValidMove() {
    for (let y = 0; y < this.height; y++) for (let x = 0; x < this.width; x++) {
      for (const [dx, dy] of [[1, 0], [0, 1]]) {
        const b = {x: x + dx, y: y + dy}, a = {x, y};
        if (!this.isPlayable(b.x, b.y)) continue;
        this.#swap(a, b); const valid = this.findMatches().cells.size > 0; this.#swap(a, b);
        if (valid) return true;
      }
    }
    return false;
  }

  findHint() {
    for (let y = 0; y < this.height; y++) for (let x = 0; x < this.width; x++) for (const [dx, dy] of [[1, 0], [0, 1]]) {
      const a = {x, y}, b = {x: x + dx, y: y + dy};
      if (!this.isPlayable(b.x, b.y)) continue;
      this.#swap(a, b); const valid = this.findMatches().cells.size > 0; this.#swap(a, b);
      if (valid) return [a, b];
    }
    return null;
  }

  shuffle() {
    const positions = [], pieces = [];
    for (let y = 0; y < this.height; y++) for (let x = 0; x < this.width; x++) if (this.isPlayable(x, y)) { positions.push({x, y}); pieces.push(this.piece(x, y)); }
    for (let guard = 0; guard < 50; guard++) {
      for (let i = pieces.length - 1; i; i--) { const j = Math.floor(this.random() * (i + 1)); [pieces[i], pieces[j]] = [pieces[j], pieces[i]]; }
      positions.forEach((p, i) => this.board[p.y][p.x] = pieces[i]);
      if (!this.findMatches().cells.size && this.hasValidMove()) return;
    }
    positions.forEach(p => this.board[p.y][p.x] = this.#newPiece(p.x, p.y, true));
  }

  useSkill() {
    if (this.status !== "playing" || this.energy < 100) return {valid: false};
    const counts = Array(7).fill(0);
    for (const row of this.board) for (const piece of row) if (piece) counts[piece.color]++;
    const color = counts.indexOf(Math.max(...counts));
    let cleared = 0;
    for (let y = 0; y < this.height; y++) for (let x = 0; x < this.width; x++) if (this.piece(x, y)?.color === color) { this.collected[color]++; this.board[y][x] = null; cleared++; }
    this.score += cleared * 90; this.energy = 0; this.#collapseAndFill(); this.#resolve(null, null, false); this.#updateStatus();
    return {valid: true, color, cleared, status: this.status};
  }

  #updateStatus() {
    const win = this.stage.rules.winCondition;
    const targets = this.stage.rules.targets.colors;
    const won = win === "SCORE" ? this.score >= this.stage.rules.starScores.bronze
      : win === "COLLECT" ? targets.every((target, i) => !target || this.collected[i] >= target)
      : win === "CLEAN" ? this.cleanRemaining <= 0 : false;
    if (won) this.status = "won";
    else if (this.moves <= 0) this.status = "lost";
  }

  objectiveProgress() {
    const win = this.stage.rules.winCondition;
    if (win === "SCORE") return {current: this.score, target: this.stage.rules.starScores.bronze};
    if (win === "CLEAN") return {current: Math.max(0, this.stage.initialCleanCount - this.cleanRemaining), target: this.stage.initialCleanCount};
    const target = this.stage.rules.targets.colors.reduce((a, b) => a + b, 0);
    const current = this.stage.rules.targets.colors.reduce((sum, value, i) => sum + Math.min(value, this.collected[i]), 0);
    return {current, target};
  }
}

export function makeVariant(base, mode) {
  const stage = structuredClone(base);
  stage.prototypeMode = mode;
  stage.rules.limits.moves = mode === "score" ? 11 : 18;
  if (mode === "collect") {
    stage.rules.winCondition = "COLLECT";
    stage.rules.starScores = {bronze: 1800, silver: 2800, gold: 4000};
    stage.rules.targets.colors = [12, 0, 10, 0, 8, 0, 0];
  } else if (mode === "clean") {
    stage.rules.winCondition = "CLEAN";
    stage.rules.starScores = {bronze: 1500, silver: 2500, gold: 3600};
    stage.rules.targets.colors = Array(7).fill(0);
    stage.prototypeCleanPattern = [[1,1,1],[2,1,1],[3,1,2],[4,1,1],[5,1,1],[2,2,1],[3,2,2],[4,2,1],[3,3,2]];
    stage.initialCleanCount = stage.prototypeCleanPattern.length;
  }
  if (mode !== "clean") stage.initialCleanCount = 0;
  return stage;
}

export {COLOR_NAMES};

function formToSpecial(form) {
  return ({WAVE_H: "line-h", WAVE_V: "line-v", BOMB: "bomb", BOMB_B: "bomb", RAINBOW: "rainbow"})[form] || null;
}
function keyOf(x, y) { return `${x},${y}`; }
function parseKey(key) { return key.split(",").map(Number); }


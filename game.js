const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const TILE = 32;
const COLS = 40;
const ROWS = 20;
canvas.width = TILE * COLS;
canvas.height = TILE * ROWS;

const GRAVITY = 0.7;
const JUMP_FORCE = -11;
const MOVE_SPEED = 4;

const BLOCKS = {
  AIR:      { id: 0, color: '#87CEEB', solid: false, name: 'Ar' },
  GRASS:    { id: 1, color: '#4ade80', solid: true,  name: 'Grama', topColor: '#22c55e' },
  DIRT:     { id: 2, color: '#8B4513', solid: true,  name: 'Terra' },
  STONE:    { id: 3, color: '#6b7280', solid: true,  name: 'Pedra' },
  WOOD:     { id: 4, color: '#92400e', solid: true,  name: 'Madeira' },
  LEAVES:   { id: 5, color: '#16a34a', solid: false, name: 'Folhas' },
  SAND:     { id: 6, color: '#fde68a', solid: true,  name: 'Areia' },
  COAL:     { id: 7, color: '#1f2937', solid: true,  name: 'Carvão' },
  GOLD:     { id: 8, color: '#fbbf24', solid: true,  name: 'Ouro' },
  DIAMOND:  { id: 9, color: '#22d3ee', solid: true,  name: 'Diamante' },
};

let world = [];

function generateWorld() {
  world = [];
  const seed = Math.random() * 1000;
  const heights = [];
  for (let x = 0; x < COLS; x++) {
    const h = Math.floor(
      ROWS * 0.55 + 
      Math.sin((x + seed) * 0.3) * 3 + 
      Math.sin((x + seed) * 0.7) * 1.5
    );
    heights.push(Math.max(6, Math.min(ROWS - 4, h)));
  }

  for (let y = 0; y < ROWS; y++) {
    const row = [];
    for (let x = 0; x < COLS; x++) {
      const groundY = heights[x];
      if (y < groundY) row.push(BLOCKS.AIR.id);
      else if (y === groundY) row.push(BLOCKS.GRASS.id);
      else if (y < groundY + 3) row.push(BLOCKS.DIRT.id);
      else if (y === ROWS - 1) row.push(BLOCKS.DIRT.id);
      else {
        const r = Math.random();
        if (y > groundY + 8 && r < 0.03) row.push(BLOCKS.DIAMOND.id);
        else if (y > groundY + 5 && r < 0.08) row.push(BLOCKS.GOLD.id);
        else if (y > groundY + 3 && r < 0.15) row.push(BLOCKS.COAL.id);
        else row.push(BLOCKS.STONE.id);
      }
    }
    world.push(row);
  }

  for (let x = 2; x < COLS - 2; x += 4) {
    if (Math.random() < 0.5) {
      const groundY = heights[x];
      for (let i = 1; i <= 4; i++) {
        if (groundY - i >= 0) world[groundY - i][x] = BLOCKS.WOOD.id;
      }
      const top = groundY - 5;
      for (let dy = -2; dy <= 1; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const ny = top + dy, nx = x + dx;
          if (ny >= 0 && ny < ROWS && nx >= 0 && nx < COLS) {
            if (world[ny][nx] === BLOCKS.AIR.id) world[ny][nx] = BLOCKS.LEAVES.id;
          }
        }
      }
    }
  }
}
generateWorld();

const player = {
  x: TILE * 5, y: TILE * 3,
  w: TILE * 0.7, h: TILE * 1.6,
  vx: 0, vy: 0,
  onGround: false,
  facing: 1,
};

const INVENTORY = [
  { block: BLOCKS.DIRT.id, count: 20 },
  { block: BLOCKS.STONE.id, count: 20 },
  { block: BLOCKS.WOOD.id, count: 10 },
  { block: BLOCKS.SAND.id, count: 10 },
  { block: BLOCKS.LEAVES.id, count: 5 },
  { block: BLOCKS.COAL.id, count: 0 },
  { block: BLOCKS.GOLD.id, count: 0 },
  { block: BLOCKS.DIAMOND.id, count: 0 },
];
let selectedSlot = 0;

const keys = {};
let mouse = { x: 0, y: 0, clicked: false, rightClicked: false };

window.addEventListener('keydown', e => {
  keys[e.key.toLowerCase()] = true;
  if (e.key >= '1' && e.key <= '8') {
    selectedSlot = parseInt(e.key) - 1;
    renderHotbar();
  }
  if (e.key === 'r') { generateWorld(); player.x = TILE*5; player.y = TILE*3; player.vy = 0; }
});
window.addEventListener('keyup', e => keys[e.key.toLowerCase()] = false);

canvas.addEventListener('mousemove', e => {
  const rect = canvas.getBoundingClientRect();
  mouse.x = Math.floor((e.clientX - rect.left) / TILE);
  mouse.y = Math.floor((e.clientY - rect.top) / TILE);
});
canvas.addEventListener('mousedown', e => {
  if (e.button === 0) mouse.clicked = true;
  if (e.button === 2) mouse.rightClicked = true;
});
canvas.addEventListener('mouseup', () => { mouse.clicked = false; mouse.rightClicked = false; });
canvas.addEventListener('contextmenu', e => e.preventDefault());

function isSolid(x, y) {
  if (x < 0 || x >= COLS || y < 0 || y >= ROWS) return true;
  const id = world[y][x];
  return BLOCKS[Object.keys(BLOCKS).find(k => BLOCKS[k].id === id)]?.solid ?? false;
}

function movePlayer() {
  let move = 0;
  if (keys['a'] || keys['arrowleft']) move -= 1;
  if (keys['d'] || keys['arrowright']) move += 1;
  player.vx = move * MOVE_SPEED;
  if (move !== 0) player.facing = move;

  player.x += player.vx;
  if (player.vx > 0) {
    const tx = Math.floor((player.x + player.w) / TILE);
    const tyTop = Math.floor(player.y / TILE);
    const tyBot = Math.floor((player.y + player.h - 1) / TILE);
    if (isSolid(tx, tyTop) || isSolid(tx, tyBot)) player.x = tx * TILE - player.w;
  } else if (player.vx < 0) {
    const tx = Math.floor(player.x / TILE);
    const tyTop = Math.floor(player.y / TILE);
    const tyBot = Math.floor((player.y + player.h - 1) / TILE);
    if (isSolid(tx, tyTop) || isSolid(tx, tyBot)) player.x = (tx + 1) * TILE;
  }

  player.vy += GRAVITY;
  if (player.vy > 15) player.vy = 15;

  if ((keys['w'] || keys['arrowup'] || keys[' ']) && player.onGround) {
    player.vy = JUMP_FORCE;
    player.onGround = false;
  }

  player.y += player.vy;
  player.onGround = false;

  if (player.vy > 0) {
    const ty = Math.floor((player.y + player.h) / TILE);
    const txL = Math.floor(player.x / TILE);
    const txR = Math.floor((player.x + player.w - 1) / TILE);
    if (isSolid(txL, ty) || isSolid(txR, ty)) {
      player.y = ty * TILE - player.h;
      player.vy = 0;
      player.onGround = true;
    }
  } else if (player.vy < 0) {
    const ty = Math.floor(player.y / TILE);
    const txL = Math.floor(player.x / TILE);
    const txR = Math.floor((player.x + player.w - 1) / TILE);
    if (isSolid(txL, ty) || isSolid(txR, ty)) {
      player.y = (ty + 1) * TILE;
      player.vy = 0;
    }
  }

  player.x = Math.max(0, Math.min(canvas.width - player.w, player.x));
  if (player.y > canvas.height + 200) {
    player.x = TILE * 5; player.y = TILE * 3; player.vy = 0;
  }
}

function getBlockName(id) {
  return Object.values(BLOCKS).find(b => b.id === id)?.name || '?';
}

function mineBlock(tx, ty) {
  if (tx < 0 || tx >= COLS || ty < 0 || ty >= ROWS) return;
  const id = world[ty][tx];
  if (id === BLOCKS.AIR.id) return;

  const px1 = player.x, px2 = player.x + player.w;
  const py1 = player.y, py2 = player.y + player.h;
  const bx1 = tx * TILE, bx2 = (tx+1) * TILE;
  const by1 = ty * TILE, by2 = (ty+1) * TILE;
  if (px2 > bx1 && px1 < bx2 && py2 > by1 && py1 < by2) return;

  const slot = INVENTORY.find(s => s.block === id);
  if (slot) slot.count++;
  else {
    const free = INVENTORY.find(s => s.count === 0);
    if (free) { free.block = id; free.count = 1; }
    else return;
  }

  world[ty][tx] = BLOCKS.AIR.id;
  renderHotbar();
}

function placeBlock(tx, ty) {
  if (tx < 0 || tx >= COLS || ty < 0 || ty >= ROWS) return;
  if (world[ty][tx] !== BLOCKS.AIR.id) return;

  const slot = INVENTORY[selectedSlot];
  if (!slot || slot.count <= 0) return;

  const px1 = player.x, px2 = player.x + player.w;
  const py1 = player.y, py2 = player.y + player.h;
  const bx1 = tx * TILE, bx2 = (tx+1) * TILE;
  const by1 = ty * TILE, by2 = (ty+1) * TILE;
  if (px2 > bx1 && px1 < bx2 && py2 > by1 && py1 < by2) return;

  world[ty][tx] = slot.block;
  slot.count--;
  renderHotbar();
}

function drawBlock(x, y, block) {
  const px = x * TILE, py = y * TILE;
  if (block.id === BLOCKS.AIR.id) {
    const grad = ctx.createLinearGradient(0, py, 0, py + TILE);
    grad.addColorStop(0, '#87CEEB');
    grad.addColorStop(1, '#b0e0ff');
    ctx.fillStyle = grad;
    ctx.fillRect(px, py, TILE, TILE);
    return;
  }
  ctx.fillStyle = block.color;
  ctx.fillRect(px, py, TILE, TILE);

  if (block.id === BLOCKS.GRASS.id) {
    ctx.fillStyle = block.topColor;
    ctx.fillRect(px, py, TILE, TILE * 0.3);
  }
  if (block.id === BLOCKS.STONE.id || block.id === BLOCKS.COAL.id || 
      block.id === BLOCKS.GOLD.id || block.id === BLOCKS.DIAMOND.id) {
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    for (let i = 0; i < 4; i++) {
      ctx.fillRect(px + Math.random()*TILE*0.7, py + Math.random()*TILE*0.7, 4, 4);
    }
  }
  if (block.id === BLOCKS.GOLD.id || block.id === BLOCKS.DIAMOND.id) {
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.fillRect(px + 6, py + 6, 6, 6);
    ctx.fillRect(px + 18, py + 18, 4, 4);
  }
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.strokeRect(px + 0.5, py + 0.5, TILE - 1, TILE - 1);
}

function render() {
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const id = world[y][x];
      const block = Object.values(BLOCKS).find(b => b.id === id);
      drawBlock(x, y, block);
    }
  }

  if (mouse.x >= 0 && mouse.x < COLS && mouse.y >= 0 && mouse.y < ROWS) {
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.strokeRect(mouse.x * TILE + 1, mouse.y * TILE + 1, TILE - 2, TILE - 2);
  }

  ctx.fillStyle = '#3b82f6';
  ctx.fillRect(player.x, player.y, player.w, player.h);
  ctx.fillStyle = '#fff';
  const eyeX = player.facing > 0 ? player.x + player.w * 0.55 : player.x + player.w * 0.2;
  ctx.fillRect(eyeX, player.y + player.h * 0.2, player.w * 0.18, player.h * 0.12);
  ctx.fillStyle = '#000';
  ctx.fillRect(eyeX + 2, player.y + player.h * 0.2 + 2, player.w * 0.08, player.h * 0.08);
}

function renderHotbar() {
  const hotbar = document.getElementById('hotbar');
  hotbar.innerHTML = '';
  const icons = { 1:'🟩', 2:'🟫', 3:'⬜', 4:'🪵', 5:'🌿', 6:'🟨', 7:'⚫', 8:'🟡', 9:'💎' };
  INVENTORY.forEach((slot, i) => {
    const div = document.createElement('div');
    div.className = 'slot' + (i === selectedSlot ? ' active' : '');
    div.innerHTML = `<span>${icons[slot.block] || '❓'}</span>` +
      (slot.count > 0 ? `<span class="count">${slot.count}</span>` : '');
    div.title = getBlockName(slot.block);
    div.onclick = () => { selectedSlot = i; renderHotbar(); };
    hotbar.appendChild(div);
  });
}
renderHotbar();

let lastClickTime = 0;
function gameLoop(timestamp) {
  if (mouse.clicked && timestamp - lastClickTime > 150) {
    mineBlock(mouse.x, mouse.y);
    lastClickTime = timestamp;
  }
  if (mouse.rightClicked && timestamp - lastClickTime > 150) {
    placeBlock(mouse.x, mouse.y);
    lastClickTime = timestamp;
  }

  movePlayer();
  render();
  requestAnimationFrame(gameLoop);
}

document.addEventListener('contextmenu', e => e.preventDefault());

requestAnimationFrame(gameLoop);

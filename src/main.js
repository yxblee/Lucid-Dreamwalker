import '@fontsource/cormorant-garamond/latin-400.css';
import '@fontsource/cormorant-garamond/latin-500.css';
import '@fontsource/cormorant-garamond/latin-600.css';
import '@fontsource/dm-sans/latin-400.css';
import '@fontsource/dm-sans/latin-500.css';
import '@fontsource/dm-sans/latin-600.css';
import './style.css';
import { RuinHub } from './game/hub.js';
import { DreamPlatformer } from './game/platformer.js';
import { DreamAudio } from './game/audio.js';
import { DREAMS } from './game/levels.js';
import { SAVE_KEY, UPGRADES, DREAM_ORDER, createNewGame, addExperience, purchaseUpgrade, completeDream, getStats, validateSave, CLUES } from './game/progression.js';

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

class Input {
  constructor() {
    this.keys = new Set();
    this.pressed = new Set();
    window.addEventListener('keydown', (event) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab'].includes(event.code)) event.preventDefault();
      if (!event.repeat) this.pressed.add(event.code);
      this.keys.add(event.code);
    });
    window.addEventListener('keyup', (event) => this.keys.delete(event.code));
    window.addEventListener('blur', () => this.clear());
    $$('#touch-controls [data-key]').forEach((button) => {
      const code = button.dataset.key;
      button.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        button.setPointerCapture(event.pointerId);
        this.keys.add(code);
        this.pressed.add(code);
      });
      const release = (event) => { event.preventDefault(); this.keys.delete(code); };
      button.addEventListener('pointerup', release);
      button.addEventListener('pointercancel', release);
    });
  }
  down(...codes) { return codes.some((code) => this.keys.has(code)); }
  consume(code) { const value = this.pressed.has(code); this.pressed.delete(code); return value; }
  clear() { this.keys.clear(); this.pressed.clear(); }
}

const input = new Input();
const audio = new DreamAudio();
let state = createNewGame();
let mode = 'title';
let currentDream = null;
let dream = null;
let paused = false;
let modalType = null;
let previousLevel = 1;
let lastTime = performance.now();
let saveClock = 0;
let toastTimer;
let runtimeHud = {};

const hub = new RuinHub($('#world-canvas'), {
  onEnterDream: enterDream,
  onReward: reward,
  onDamage: damageFlash,
  onDefeat: showDefeat,
  onDialogue: showDialogue,
  onWin: showWin,
  onHud: updateVitals
}, audio);

function loadSave() {
  try { return validateSave(JSON.parse(localStorage.getItem(SAVE_KEY))); }
  catch { return null; }
}

function save() {
  if (mode === 'title') return;
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); }
  catch { /* The game remains fully playable when storage is unavailable. */ }
}

function setScreen(id) {
  if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  window.scrollTo(0, 0);
  ['#title-screen', '#dream-intro', '#gameover-screen', '#win-screen', '#modal-overlay', '#dialogue'].forEach((selector) => { $(selector).hidden = selector !== id; });
}

function updateContinue() {
  const saved = loadSave();
  $('#continue-button').hidden = !saved;
  $('#continue-meta').textContent = saved ? `${saved.completed.length} of 3 dreams restored · Dream level ${saved.level}` : '';
}

function startNew() {
  state = createNewGame();
  previousLevel = 1;
  save();
  enterHub();
  audio.narrate('narration-opening');
  notify('Find Mara’s dream beneath the cyan arch.');
}

async function continueGame() {
  state = loadSave() || createNewGame();
  previousLevel = state.level;
  enterHub();
}

function showTitle() {
  clearNotification();
  audio.stopNarration();
  mode = 'title';
  paused = false;
  modalType = null;
  dream = null;
  currentDream = null;
  $('#game').removeAttribute('data-dream');
  hub.setTitle();
  $('#world-canvas').hidden = false;
  $('#dream-canvas').hidden = true;
  $('#game-ui').hidden = true;
  $('#touch-controls').classList.remove('playing');
  setScreen('#title-screen');
  audio.setMode('title');
  updateContinue();
  input.clear();
}

function transition(action) {
  const fade = $('#fade');
  fade.classList.add('active');
  window.setTimeout(() => {
    action();
    window.setTimeout(() => fade.classList.remove('active'), 60);
  }, 330);
}

function enterHub() {
  if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  audio.stopNarration();
  mode = 'hub';
  paused = false;
  modalType = null;
  dream = null;
  currentDream = null;
  $('#game').removeAttribute('data-dream');
  $('#world-canvas').hidden = false;
  $('#dream-canvas').hidden = true;
  $('#game-ui').hidden = false;
  $('#touch-controls').classList.add('playing');
  setScreen(null);
  hub.enter(state);
  audio.setMode('hub');
  $('#location-kicker').textContent = 'The waking world';
  $('#location-name').textContent = 'Somnus Ruins';
  $('#dream-progress').hidden = true;
  $('#interaction-prompt').hidden = false;
  updateObjective();
  updateResources();
  updateAbilities();
  input.clear();
  save();
}

function enterDream(id) {
  if (!state.unlocked.includes(id)) return;
  clearNotification();
  if (id === 'archivist' && !state.abilities.time) {
    state = { ...state, abilities: { ...state.abilities, time: true } };
    save();
  }
  audio.sfx('portal');
  transition(() => {
    mode = 'dream';
    currentDream = id;
    paused = true;
    modalType = 'intro';
    $('#world-canvas').hidden = true;
    $('#dream-canvas').hidden = false;
    $('#game-ui').hidden = false;
    $('#touch-controls').classList.add('playing');
    dream = new DreamPlatformer($('#dream-canvas'), id, state, {
      onHud: updateVitals,
      onReward: reward,
      onDamage: damageFlash,
      onDefeat: showDefeat,
      onComplete: finishDream,
      onMessage: notify
    }, audio);
    const data = DREAMS[id];
    const lawIcons = { bellwright: 'gravity', archivist: 'time', cartographer: 'fly' };
    $('#game').dataset.dream = id;
    $('#intro-law-icon').setAttribute('href', `#icon-${lawIcons[id]}`);
    $('#location-kicker').textContent = data.dreamer;
    $('#location-name').textContent = data.name;
    $('#intro-number').textContent = `Dream ${['I', 'II', 'III'][['bellwright', 'archivist', 'cartographer'].indexOf(id)]}`;
    $('#intro-dreamer').textContent = data.dreamer;
    $('#intro-name').textContent = data.name;
    $('#intro-subtitle').textContent = data.subtitle;
    $('#intro-rule').textContent = data.rule;
    $('#dream-progress').hidden = false;
    $('#interaction-prompt').hidden = true;
    setScreen('#dream-intro');
    $('#dream-intro [data-action="resume"]').focus({ preventScroll: true });
    audio.setMode(id);
    audio.narrate(`voice-${id}-intro`);
    updateObjective();
    updateAbilities();
    input.clear();
  });
}

function resume() {
  if (mode === 'title' || mode === 'win') return;
  if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  audio.stopNarration();
  paused = false;
  modalType = null;
  setScreen(null);
  input.clear();
}

function reward({ xp = 0, crystals = 0, enemy = false }) {
  state = addExperience(state, xp);
  state.crystals += crystals;
  state.crystalsCollected += crystals;
  if (enemy) state.enemiesDefeated += 1;
  if (dream) { dream.state = state; dream.stats = getStats(state); }
  if (state.level > previousLevel) {
    notify(`Dream level ${state.level}. Your thread grows stronger.`);
    audio.sfx('level');
    previousLevel = state.level;
  } else if (crystals > 1) notify(`+${crystals} moon crystals`);
  updateResources();
  save();
}

function finishDream(id) {
  const wasComplete = state.completed.includes(id);
  state = completeDream(state, id);
  save();
  paused = true;
  modalType = 'story';
  const titles = {
    bellwright: 'The final note',
    archivist: 'The name in the margin',
    cartographer: 'The promise beneath the map'
  };
  const unlockText = wasComplete ? 'This memory is already woven into your journal.' : id === 'bellwright'
    ? 'Unlocked: double jump, slide, and the Archivist’s dream.'
    : id === 'archivist' ? 'Mastered: time slow and rewind. Unlocked: flight and the Cartographer’s dream.'
    : 'The Somnus Lens is yours. Return it to the central dais.';
  openModal(`
    <h2 id="modal-title">${titles[id]}</h2>
    <p class="modal-deck">Memory restored · ${DREAMS[id].dreamer}</p>
    <div class="journal-entry"><p>“${CLUES[id]}”</p></div>
    <p class="modal-deck" style="margin-top:22px">${unlockText}</p>
    <div class="modal-actions"><button class="primary-button" data-action="hub"><span>Wake in the ruins</span><svg class="icon"><use href="#icon-arrow" /></svg></button></div>
  `, 'story');
  audio.sfx('memory');
  audio.narrate(`clue-${id}`);
}

function showDefeat(reason) {
  if (mode !== 'hub' && mode !== 'dream') return;
  audio.stopNarration();
  state.deaths += 1;
  save();
  paused = true;
  modalType = 'defeat';
  $('#defeat-reason').textContent = reason;
  setScreen('#gameover-screen');
  $('#gameover-screen [data-action="retry"]').focus({ preventScroll: true });
  input.clear();
}

function showWin() {
  clearTimeout(toastTimer);
  $('#toast').hidden = true;
  mode = 'win';
  paused = false;
  dream = null;
  $('#game-ui').hidden = true;
  $('#touch-controls').classList.remove('playing');
  $('#world-canvas').hidden = false;
  $('#dream-canvas').hidden = true;
  hub.setTitle();
  setScreen('#win-screen');
  $('#win-screen [data-action="new"]').focus({ preventScroll: true });
  const minutes = Math.floor(state.playTime / 60);
  const seconds = Math.floor(state.playTime % 60).toString().padStart(2, '0');
  $('#win-time').textContent = `${minutes}:${seconds}`;
  $('#win-level').textContent = state.level;
  $('#win-crystals').textContent = state.crystalsCollected;
  $('#win-enemies').textContent = state.enemiesDefeated;
  audio.setMode('win');
  audio.sfx('win');
  audio.narrate('narration-win');
  save();
  input.clear();
}

function updateObjective() {
  let objective = '';
  if (mode === 'hub') {
    if (state.artifact) objective = 'Return the Somnus Lens to the central dais';
    else if (!state.completed.includes('bellwright')) objective = 'Enter Mara’s dream beneath the cyan arch';
    else if (!state.completed.includes('archivist')) objective = 'Follow the final note to the violet archive';
    else objective = 'Enter Sera’s shifting world and recover the Lens';
  } else if (currentDream) {
    const count = runtimeHud.memories || 0;
    objective = count < 3 ? `Recover the dreamer’s memories · ${count} / 3` : 'All memories found · Reach the waking gate';
  }
  $('#objective').textContent = objective;
}

function updateResources() {
  $('#level-value').textContent = state.level;
  $('#crystal-value').textContent = state.crystals;
  $('#xp-label').textContent = `${state.xp} / ${state.level * 100} resonance`;
  $('#xp-fill').style.width = `${state.xp / (state.level * 100) * 100}%`;
  updateObjective();
}

function updateVitals(data) {
  runtimeHud = data;
  $('.vitals').classList.toggle('critical', data.health / data.maxHealth <= 0.3);
  $('#health-fill').style.width = `${Math.max(0, data.health / data.maxHealth * 100)}%`;
  $('#health-text').textContent = `${Math.ceil(Math.max(0, data.health))} / ${data.maxHealth}`;
  $('#focus-fill').style.width = `${data.focus / data.maxFocus * 100}%`;
  $('#focus-text').textContent = `${Math.ceil(data.focus)} / ${data.maxFocus}`;
  if (mode === 'hub') {
    const prompt = $('#interaction-prompt');
    const message = data.prompt || '';
    if (prompt.dataset.message !== message) {
      prompt.dataset.message = message;
      prompt.replaceChildren();
      if (message.startsWith('E  ')) {
        const key = document.createElement('kbd');
        key.textContent = 'E';
        prompt.append(key, document.createTextNode(message.slice(3)));
      } else prompt.textContent = message;
    }
    prompt.hidden = !message;
  }
  if (mode === 'dream') {
    $('[data-ability="time"]').classList.toggle('active', data.timeActive);
    $('#memory-count').textContent = `${data.memories} of 3 memories`;
    $$('#memory-pips i').forEach((pip, index) => pip.classList.toggle('filled', index < data.memories));
    const seconds = Math.max(0, Math.ceil(data.remaining));
    $('#dream-timer').textContent = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
    $('#dream-timer').classList.toggle('urgent', seconds <= 20);
    if (updateVitals.lastMemories !== data.memories) { updateObjective(); updateVitals.lastMemories = data.memories; }
  }
}

function updateAbilities() {
  $$('#abilities [data-ability]').forEach((slot) => {
    const ability = slot.dataset.ability;
    const unlocked = ability === 'attack' || ability === 'rewind' ? (ability === 'attack' || state.abilities.time) : state.abilities[ability];
    slot.classList.toggle('locked', !unlocked);
    slot.classList.toggle('context-hidden', mode === 'hub' && ability !== 'attack');
  });
  const touchVisibility = {
    KeyE: mode === 'hub', KeyJ: mode === 'hub', KeyG: mode === 'dream',
    ShiftLeft: mode === 'dream' && state.abilities.slide,
    KeyQ: mode === 'dream' && state.abilities.time,
    KeyR: mode === 'dream' && state.abilities.time,
    KeyF: mode === 'dream' && state.abilities.fly
  };
  Object.entries(touchVisibility).forEach(([code, visible]) => { $(`#touch-controls [data-key="${code}"]`).hidden = !visible; });
}

function clearNotification() {
  clearTimeout(toastTimer);
  $('#toast').hidden = true;
}

function notify(message) {
  clearTimeout(toastTimer);
  const toast = $('#toast');
  toast.textContent = message;
  toast.hidden = false;
  toastTimer = window.setTimeout(() => { toast.hidden = true; }, 3400);
}

function damageFlash() {
  const flash = $('#damage-flash');
  flash.classList.remove('flash');
  void flash.offsetWidth;
  flash.classList.add('flash');
}

function showDialogue(title, text, narration) {
  paused = true;
  modalType = 'dialogue';
  $('#dialogue-title').textContent = title;
  $('#dialogue-text').textContent = text;
  setScreen('#dialogue');
  $('#dialogue [data-action="resume"]').focus({ preventScroll: true });
  if (narration) audio.narrate(narration);
}

function openModal(content, type) {
  clearNotification();
  audio.stopNarration();
  paused = true;
  modalType = type;
  $('#modal').innerHTML = content;
  setScreen('#modal-overlay');
  $('#modal .primary-button')?.focus({ preventScroll: true });
  input.clear();
}

function showPause() {
  if (mode === 'title' || mode === 'win') return;
  openModal(`
    <h2 id="modal-title">Between moments</h2>
    <p class="modal-deck">The Hollow Hour waits. Your current dream restarts from its threshold.<br />Campaign progress and crystals are saved.</p>
    <div class="modal-actions">
      <button class="primary-button" data-action="resume"><span>Return to the dream</span><svg class="icon"><use href="#icon-arrow" /></svg></button>
      <button class="text-button" data-action="retry">Restart ${mode === 'dream' ? 'dream' : 'at the ruins'}</button>
      <button class="text-button" data-action="controls">Controls</button>
      <button class="text-button" data-action="title">Save & return to title</button>
    </div>
  `, 'pause');
}

function showUpgrades() {
  const stats = getStats(state);
  const icons = { blade: 'strike', vitality: 'thread', focus: 'focus' };
  const rows = Object.entries(UPGRADES).map(([id, upgrade]) => {
    const level = state.upgrades[id];
    const disabled = state.crystals < upgrade.cost || level >= upgrade.max;
    return `<div class="upgrade-row"><svg class="upgrade-icon icon"><use href="#icon-${icons[id]}" /></svg><div><h3>${upgrade.name}</h3><span class="upgrade-level">Attunement ${level} / ${upgrade.max}</span><p>${upgrade.detail}</p></div><button data-upgrade="${id}" ${disabled ? 'disabled' : ''}>${level >= upgrade.max ? 'Attuned' : `<svg class="icon"><use href="#icon-crystal" /></svg>${upgrade.cost} crystals`}</button></div>`;
  }).join('');
  openModal(`
    <h2 id="modal-title">Strengthen the thread</h2>
    <p class="modal-deck">Moon crystal attunement · ${state.crystals} crystals available<br />${stats.damage} strike damage · ${stats.maxHealth} health · ${stats.maxFocus} focus</p>
    <div class="upgrade-list">${rows}</div>
    <div class="modal-actions"><button class="primary-button" data-action="resume"><span>Return</span><svg class="icon"><use href="#icon-arrow" /></svg></button></div>
  `, 'upgrades');
}

function showJournal() {
  const atlas = DREAM_ORDER.map((id) => {
    const status = state.completed.includes(id) ? 'restored' : state.unlocked.includes(id) ? 'available' : 'sealed';
    return `<article class="atlas-node" data-state="${status}"><span class="atlas-marker" aria-hidden="true"><i></i></span><div><h3>${DREAMS[id].name}</h3><p>${DREAMS[id].dreamer}</p></div><small>${status}</small></article>`;
  }).join('');
  const entries = state.clues.length ? state.clues.map((clue, index) => {
    const id = DREAM_ORDER[index];
    return `<article class="journal-entry"><h3>${DREAMS[id].dreamer}</h3><p>${clue}</p></article>`;
  }).join('') : '<div class="journal-empty">No memories have answered you yet.<br />Enter the cyan arch and listen to the bellwright.</div>';
  openModal(`
    <h2 id="modal-title">The dream atlas</h2>
    <p class="modal-deck">Interconnected memories · ${state.completed.length} of 3 dreams restored ${state.artifact ? '· Somnus Lens recovered' : ''}</p>
    <div class="atlas-path">${atlas}</div>
    ${entries}<div class="modal-actions"><button class="primary-button" data-action="resume"><span>Close journal</span><svg class="icon"><use href="#icon-arrow" /></svg></button></div>
  `, 'journal');
}

function showControls() {
  openModal(`
    <h2 id="modal-title">Dreamwalker’s field notes</h2>
    <p class="modal-deck">Controls for the ruins and the three dreams.</p>
    <div class="controls-grid">
      <div><span>Move</span><kbd>WASD / arrows</kbd></div><div><span>Interact</span><kbd>E</kbd></div>
      <div><span>Jump / double jump</span><kbd>W / ↑</kbd></div><div><span>Moonblade strike</span><kbd>Space</kbd></div>
      <div><span>Invert gravity</span><kbd>G</kbd></div><div><span>Slide</span><kbd>Shift</kbd></div>
      <div><span>Slow time</span><kbd>Hold Q</kbd></div><div><span>Rewind two seconds</span><kbd>R</kbd></div>
      <div><span>Fly</span><kbd>Hold F</kbd></div><div><span>Attune upgrades</span><kbd>U</kbd></div>
      <div><span>Journal</span><kbd>Tab</kbd></div><div><span>Pause</span><kbd>Esc</kbd></div>
    </div>
    <p class="modal-deck" style="margin-top:24px">Collect all three memory sigils in each dream to open its waking gate. Time limits keep falling while you play, but menus pause the dream.</p>
    <div class="modal-actions"><button class="primary-button" data-action="resume"><span>Return</span><svg class="icon"><use href="#icon-arrow" /></svg></button></div>
  `, 'controls');
}

function retry() {
  if (mode === 'dream' && currentDream) enterDream(currentDream);
  else enterHub();
}

function handleAction(action) {
  void audio.start().catch(() => {});
  audio.sfx('click');
  const actions = {
    new: () => transition(startNew), continue: continueGame, title: () => { save(); showTitle(); },
    resume, hub: () => transition(enterHub), retry, pause: showPause,
    upgrades: showUpgrades, journal: showJournal, controls: showControls,
    mute: () => { audio.toggle(); updateMuteLabels(); }
  };
  actions[action]?.();
}

function updateMuteLabels() {
  $$('.mute-label').forEach((label) => { label.textContent = label.closest('.topbar') ? (audio.muted ? 'Sound off' : 'Sound on') : (audio.muted ? 'off' : 'on'); });
  $$('[data-action="mute"]').forEach((button) => {
    button.setAttribute('aria-pressed', String(audio.muted));
    button.classList.toggle('muted', audio.muted);
  });
}

document.addEventListener('click', (event) => {
  const action = event.target.closest('[data-action]');
  if (action) handleAction(action.dataset.action);
  const upgrade = event.target.closest('[data-upgrade]');
  if (upgrade) {
    const before = state;
    state = purchaseUpgrade(state, upgrade.dataset.upgrade);
    if (state !== before) {
      if (dream) { dream.state = state; dream.stats = getStats(state); }
      audio.sfx('level'); notify('Attunement complete.'); save();
    }
    showUpgrades();
    updateResources();
  }
});

window.addEventListener('keydown', (event) => {
  if (event.repeat) return;
  if (event.code === 'KeyM') { audio.toggle(); updateMuteLabels(); }
  if (mode === 'title' && event.code === 'Enter') { handleAction(loadSave() ? 'continue' : 'new'); return; }
  if (mode === 'title' || mode === 'win') return;
  if (event.code === 'Escape') {
    if (paused && modalType !== 'defeat' && modalType !== 'story') resume();
    else if (!paused) showPause();
  }
  if (!paused && event.code === 'KeyU') showUpgrades();
  if (!paused && event.code === 'Tab') showJournal();
});

window.addEventListener('resize', () => { hub.resize(); dream?.resize(); });
window.addEventListener('blur', () => { if ((mode === 'hub' || mode === 'dream') && !paused) showPause(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && (mode === 'hub' || mode === 'dream') && !paused) showPause(); });

function frame(now) {
  const dt = Math.min(0.033, Math.max(0.001, (now - lastTime) / 1000));
  lastTime = now;
  if ((mode === 'hub' || mode === 'dream') && !paused) {
    state.playTime += dt;
    saveClock += dt;
    if (saveClock > 12) { saveClock = 0; save(); }
    if (mode === 'hub') hub.update(dt, input, state);
    else dream?.update(dt, input);
  } else if (mode === 'title' || mode === 'win') {
    hub.update(dt, input, state);
  }
  input.pressed.clear();
  requestAnimationFrame(frame);
}

updateMuteLabels();
updateContinue();
requestAnimationFrame(frame);

if (import.meta.env.DEV) {
  window.__LUCID__ = {
    getState: () => structuredClone(state),
    getMode: () => mode,
    getPaused: () => paused,
    getDream: () => dream,
    getHub: () => hub,
    getInput: () => input,
    getAudio: () => audio,
    enterDream: (id) => { state.unlocked = [...new Set([...state.unlocked, id])]; enterDream(id); },
    enterHub
  };
}

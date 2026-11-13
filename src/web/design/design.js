// Mock-up behaviour (spec 004). Plain DOM code only: textContent, attributes, createElement and `hidden`, never
// innerHTML, so the pages run under the production CSP and Trusted Types (R2).
(function () {
  'use strict';
  const root = document.documentElement;
  const params = new URLSearchParams(location.search);
  const SCHEMES = ['auto', 'light', 'dark'];

  // ?scheme=light|dark forces a color scheme; the URL is untrusted input, so only known values count.
  const scheme = SCHEMES.includes(params.get('scheme')) ? params.get('scheme') : 'auto';
  if (scheme === 'auto') delete root.dataset['scheme'];
  else root.dataset['scheme'] = scheme;

  // Links to other mock-ups keep the forced scheme; the switcher links mark the current one.
  for (const link of document.querySelectorAll('a[href]')) {
    const url = new URL(link.href);
    if (url.origin !== location.origin) continue;
    const set = link.dataset['set'];
    if (set) {
      const value = set.split('=')[1];
      url.search = `?scheme=${value}`;
      if (value === scheme) link.setAttribute('aria-current', 'true');
      else link.removeAttribute('aria-current');
    } else if (scheme !== 'auto') {
      url.searchParams.set('scheme', scheme);
    }
    link.href = url.href;
  }

  if (root.dataset['page'] === 'communicate') liczenie();
  root.dataset['js'] = 'ready';

  /*
   * Liczenie (R7, R8). A throwaway simulator of the counting mode from docs/interaction-model.md, NOT the real state
   * machine (stage 2 builds and tests that one in TypeScript). It only shows how each state looks and reads.
   * Every state is a URL fragment (communicate.html#asking-row), so the catalog can link to it.
   */
  function liczenie() {
    const $ = (selector) => document.querySelector(selector);
    const question = $('#question');
    const step = $('[data-step]');
    const tally = $('[data-tally]');
    const hint = $('[data-hint]');
    const audio = $('[data-audio]');
    const audioText = $('[data-audio-text]');
    const caption = $('[data-caption]');
    const sentence = $('[data-sentence]');
    const announce = $('[data-announce]');
    const pause = $('[data-pause]');
    const modeText = $('[data-mode-text]');
    const faceLabel = $('[data-face-label]');
    const board = $('.board');
    const COLUMNS = 7;
    const ROWS = 5;
    // He signals, then stops: Blinker asks after a short pause (tuned at the trial, stage 6).
    const ASK_AFTER_MS = 1200;
    const START_TEXT = sentence.textContent;

    /** The mock-up state. step: column | row | speak; phase: waiting | counting | asking | rejected | added | speaking. */
    let s;
    let added = []; // the letters added in this session, so undo removes a whole cell ("SZ")
    let timer = 0;

    const STATES = {
      'waiting-column': () => ({}),
      counting: () => ({ phase: 'counting', parts: [5, 1, 1] }),
      'asking-column': () => ({ phase: 'asking', parts: [5, 1, 1] }),
      rejected: () => ({ phase: 'rejected', note: 'Nie, to nie 7.' }),
      'waiting-row': () => ({ step: 'row', column: 7 }),
      'asking-row': () => ({ step: 'row', column: 7, phase: 'asking', parts: [1, 1, 1] }),
      'letter-added': () => ({ phase: 'added', letter: 'W', text: START_TEXT + 'W' }),
      'confirm-speak': () => ({ step: 'speak', phase: 'asking', text: START_TEXT + 'WODY' }),
      speaking: () => ({ step: 'speak', phase: 'speaking', text: START_TEXT + 'WODY' }),
      paused: () => ({ paused: true }),
      'no-face': () => ({ face: false }),
      caregiver: () => ({ phase: 'asking', parts: [5, 1, 1], caregiver: true }),
    };

    function reset(preset) {
      clearTimeout(timer);
      s = {
        step: 'column',
        phase: 'waiting',
        parts: [],
        column: 0,
        letter: '',
        note: '',
        paused: false,
        face: true,
        caregiver: false,
        ...preset,
      };
      sentence.textContent = s.text ?? START_TEXT;
      added = s.letter ? [s.letter] : [];
      delete s.text;
    }

    const sum = () => s.parts.reduce((a, b) => a + b, 0);
    const say = (text) => {
      announce.textContent = text;
    };

    /** The cell at row r, column c (1-based), or null for an empty cell. */
    function cellAt(r, c) {
      const td = board.tBodies[0].rows[r - 1]?.cells[c];
      return td?.querySelector('.cell-btn') ? td : null;
    }

    function addLetter(letter) {
      added.push(letter);
      sentence.textContent += letter;
      say(`Dodano ${letter}`);
    }

    function undoLetter() {
      // A trailing space (after a word) stays, so the next letter starts the next word.
      const text = sentence.textContent.trimEnd();
      const trailing = sentence.textContent.slice(text.length);
      const last = added.pop() ?? text.slice(-1);
      if (!last || !text.endsWith(last)) return;
      sentence.textContent = text.slice(0, -last.length) + trailing;
      say(`Usunięto ${last}`);
    }

    // ---- signals -------------------------------------------------------------------------------------------------

    function count(value) {
      if (s.step === 'speak') return;
      if (s.phase !== 'counting' && s.phase !== 'asking') s.parts = [];
      s.parts.push(value);
      s.phase = 'counting';
      s.note = '';
      clearTimeout(timer);
      timer = setTimeout(ask, ASK_AFTER_MS);
    }

    function ask() {
      const max = s.step === 'column' ? COLUMNS : ROWS;
      const n = sum();
      if (n > max) {
        s.phase = 'rejected';
        s.note = s.step === 'column' ? `Nie ma kolumny ${n}.` : `Nie ma wiersza ${n}.`;
        s.parts = [];
      } else if (s.step === 'row' && !cellAt(n, s.column)) {
        s.phase = 'rejected';
        s.note = `Wiersz ${n} w kolumnie ${s.column} jest pusty.`;
        s.parts = [];
      } else {
        s.phase = 'asking';
      }
      render();
    }

    function nod() {
      if (s.phase !== 'asking') return;
      if (s.step === 'column') {
        s = { ...s, step: 'row', column: sum(), phase: 'waiting', parts: [] };
      } else if (s.step === 'row') {
        const letter = cellAt(sum(), s.column).textContent.trim();
        addLetter(letter);
        s = { ...s, step: 'column', column: 0, phase: 'added', letter, parts: [] };
      } else {
        s.phase = 'speaking';
        say('Czytam zdanie na głos');
      }
    }

    function shake() {
      clearTimeout(timer);
      if (s.phase === 'asking' || s.phase === 'counting') {
        if (s.step === 'speak') {
          s = { ...s, step: 'column', phase: 'waiting', parts: [] };
          return;
        }
        const n = sum();
        s = { ...s, phase: 'rejected', parts: [], note: `Nie, to nie ${n}.` };
      } else if (s.step === 'row') {
        // No / back one step: from rows back to columns.
        s = { ...s, step: 'column', column: 0, phase: 'waiting', parts: [], note: '' };
      } else if (s.step === 'column') {
        // At the columns, no deletes the last letter: undo is always one signal away.
        undoLetter();
        s = { ...s, phase: 'waiting', letter: '', note: '' };
      } else {
        s = { ...s, step: 'column', phase: 'waiting' };
      }
    }

    /** Head right, or the "Przeczytaj" button: finish the sentence and ask first; nothing is read without a yes. */
    function finish() {
      clearTimeout(timer);
      s = { ...s, step: 'speak', phase: 'asking', parts: [], note: '' };
    }

    function signal(name) {
      if (name === 'pause') s.paused = !s.paused;
      else if (name === 'face') s.face = !s.face;
      else if (s.paused || !s.face)
        return; // signals are ignored while paused or without a face
      else if (name === 'blink') count(1);
      else if (name === 'hand') count(5);
      else if (name === 'nod') nod();
      else if (name === 'shake') shake();
      else if (name === 'right') finish();
      render();
    }

    // ---- rendering -----------------------------------------------------------------------------------------------

    function view() {
      const n = sum();
      const where = s.step === 'row' ? 'wiersz' : 'kolumnę';
      if (s.paused)
        return ['Odpoczynek', 'Pauza', 'Sygnały nie działają. Naciśnij Pauza, żeby wrócić.'];
      if (!s.face)
        return ['Kamera', 'Nie widzę twarzy', 'Ustaw telefon na wprost twarzy. Liczenie czeka.'];
      if (s.step === 'speak') {
        if (s.phase === 'speaking')
          return ['Zdanie', 'Czytam na głos', 'Potem możesz pisać dalej.'];
        return [
          'Zdanie',
          'Przeczytać na głos?',
          'Kiwnij głową = przeczytaj · Pokręć głową = pisz dalej',
        ];
      }
      const label =
        s.step === 'row' ? `Krok 2 z 2 · wiersz w kolumnie ${s.column}` : 'Krok 1 z 2 · kolumna';
      if (s.caregiver) {
        return [
          'Telefon trzyma opiekun · aparat z tyłu',
          `Kolumna ${n}?`,
          'Zapytaj go na głos i patrz, czy kiwa głową.',
        ];
      }
      switch (s.phase) {
        case 'counting':
          return [
            label,
            `Liczę: ${n}`,
            `Po przerwie zapytam o ${s.step === 'row' ? 'wiersz' : 'kolumnę'}.`,
          ];
        case 'asking':
          return s.step === 'row'
            ? [
                label,
                `Wiersz ${n}?`,
                `To litera ${cellAt(n, s.column).textContent.trim()} · Kiwnij = tak · Pokręć = nie`,
              ]
            : [label, `Kolumna ${n}?`, 'Kiwnij głową = tak · Pokręć głową = nie'];
        case 'rejected':
          return [label, 'Jeszcze raz', `${s.note} Podaj ${where} od nowa.`];
        case 'added':
          return [
            label,
            `Dodano ${s.letter}`,
            'Mrugaj dalej: następna kolumna · Pokręć głową = cofnij literę',
          ];
        default:
          return s.step === 'row'
            ? [label, 'Podaj wiersz', 'Mrugnij = +1 · Ręka = +5 · Pokręć głową = wróć do kolumn']
            : [label, 'Podaj kolumnę', 'Mrugnij = +1 · Ręka = +5 · Przeczytaj = głowa w prawo'];
      }
    }

    function renderTally() {
      tally.replaceChildren();
      const showCount = s.phase === 'counting' || s.phase === 'asking';
      tally.hidden = !showCount || s.step === 'speak' || s.paused || !s.face;
      if (tally.hidden) return;
      const n = sum();
      const words = s.parts.map((p) => (p === 5 ? 'ręka' : 'mrugnięcie')).join(', ');
      const add = (text, className, hidden = true) => {
        const span = document.createElement('span');
        span.className = className;
        span.textContent = text;
        if (hidden) span.setAttribute('aria-hidden', 'true');
        tally.append(span);
      };
      add(`Policzone: ${words}, razem ${n}.`, 'sr-only', false);
      for (const p of s.parts) add(p === 5 ? 'ręka +5' : '+1', 'tally');
      add(`= ${n}`, 'font-bold');
    }

    /** The pointer: the column (and row) being counted and one cell, where the count has got to (R4). */
    function renderPointer() {
      for (const el of board.querySelectorAll('.is-active')) {
        el.classList.remove('is-active');
        el.removeAttribute('aria-current');
      }
      const mark = (el) => {
        if (!el) return;
        el.classList.add('is-active');
        el.setAttribute('aria-current', 'true');
      };
      const n = sum();
      const live = s.face && !s.paused && s.step !== 'speak';
      let where = 'brak';
      if (live && s.step === 'column' && n > 0) {
        const c = Math.min(n, COLUMNS);
        mark(board.tHead.rows[0].cells[c]);
        mark(board.tBodies[0].rows[0].cells[c]);
        where = `kolumna ${c}, litera ${board.tBodies[0].rows[0].cells[c].textContent.trim()}`;
      } else if (live && s.step === 'row') {
        mark(board.tHead.rows[0].cells[s.column]);
        where = `kolumna ${s.column}`;
        if (n > 0) {
          const r = Math.min(n, ROWS);
          mark(board.tBodies[0].rows[r - 1].cells[0]);
          const cell = board.tBodies[0].rows[r - 1].cells[s.column];
          mark(cell);
          where += `, wiersz ${r}, ${cell.textContent.trim() ? `litera ${cell.textContent.trim()}` : 'puste pole'}`;
        }
      }
      caption.textContent = `Tablica liter: kolumny od 1 do ${COLUMNS}, wiersze od 1 do ${ROWS}. Wskaźnik: ${where}. Dotknij litery, żeby dodać ją do zdania.`;
    }

    function render() {
      const [label, text, help] = view();
      step.textContent = label;
      question.textContent = text;
      hint.textContent = help;
      renderTally();
      renderPointer();

      const speaking = s.phase === 'speaking' || s.phase === 'added' || s.caregiver;
      audio.hidden = !speaking || s.paused || !s.face;
      audioText.textContent =
        s.phase === 'speaking'
          ? `Mówię na głos: „${sentence.textContent.trim()}”`
          : s.caregiver
            ? `Mówię na głos: „${text}”`
            : `Mówię na głos: „${s.letter}”`;

      pause.setAttribute('aria-pressed', String(s.paused));
      modeText.textContent = s.paused
        ? 'Wstrzymane'
        : s.face
          ? 'Automat: widzę twarz'
          : 'Automat: brak twarzy';
      if (faceLabel) faceLabel.textContent = s.face ? 'znika' : 'wraca';
      if (s.caregiver) root.dataset['layout'] = 'caregiver';
      else delete root.dataset['layout'];
      document.title = `Liczenie: ${text} (makieta)`;
    }

    // ---- wiring --------------------------------------------------------------------------------------------------

    function fromHash() {
      const name = location.hash.slice(1);
      // The fragment is untrusted input: only known state names count; anything else is the default state.
      const preset = Object.hasOwn(STATES, name) ? STATES[name]() : STATES['asking-column']();
      reset(preset);
      render();
    }

    for (const cell of board.querySelectorAll('.cell-btn')) {
      cell.addEventListener('click', () => addLetter(cell.textContent.trim()));
    }
    $('[data-undo]').addEventListener('click', undoLetter);
    $('[data-read]').addEventListener('click', () => {
      finish();
      render();
    });
    pause.addEventListener('click', () => signal('pause'));
    for (const button of document.querySelectorAll('[data-signal]')) {
      button.addEventListener('click', () => signal(button.dataset['signal']));
    }

    const KEYS = {
      ' ': 'blink',
      h: 'hand',
      n: 'nod',
      s: 'shake',
      r: 'right',
      p: 'pause',
      f: 'face',
    };
    document.addEventListener('keydown', (event) => {
      if (event.repeat || event.ctrlKey || event.altKey || event.metaKey) return;
      // Space and Enter on a focused button or link keep their native meaning (activate it).
      const onControl = event.target.closest?.('button, a, input, select, textarea');
      if (onControl && (event.key === ' ' || event.key === 'Enter')) return;
      const name = KEYS[event.key.toLowerCase()];
      if (!name) return;
      event.preventDefault();
      signal(name);
    });

    if (params.get('sim') === '1') {
      $('[data-sim]').hidden = false;
      root.dataset['sim'] = 'on';
    }
    window.addEventListener('hashchange', fromHash);
    fromHash();
  }
})();

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

  const page = root.dataset['page'];
  if (page === 'communicate') liczenie();
  if ('wizard' in root.dataset) wizard();
  else if (page === 'boards') boards();
  else if (page === 'settings') settings();
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
      // Only letters added in this session can be undone, so undo never eats text it did not write.
      const last = added.pop();
      if (!last || !text.endsWith(last)) {
        say('Nie ma litery do cofnięcia');
        return;
      }
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
      } else if (s.phase === 'rejected') {
        // Right after a rejected number, another no only confirms it: it never deletes a letter or leaves the step,
        // so a shake out of habit costs nothing (review of T4).
        s = { ...s, phase: 'waiting', parts: [], note: '' };
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
          // Short: the audio line below says what is being read.
          return ['Zdanie', 'Czytam', ''];
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
      hint.hidden = !help;
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

  // ---- T5: caregiver pages -------------------------------------------------------------------------------------

  /** A small inline icon (createElementNS, no markup strings): "alert" for errors, "check" for success. */
  function icon(kind) {
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    for (const [k, v] of Object.entries({
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': '2.5',
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      'aria-hidden': 'true',
    })) {
      svg.setAttribute(k, v);
    }
    const d = kind === 'check' ? ['M5 12l5 5L20 7'] : ['M12 8v5', 'M12 16.5v.01', 'M12 3 2 21h20z'];
    for (const path of d) {
      const p = document.createElementNS(NS, 'path');
      p.setAttribute('d', path);
      svg.append(p);
    }
    return svg;
  }

  /** Polish plural: 1 kolumna, 2–4 kolumny, 5+ kolumn (12–14 are "many"). */
  function plural(n, one, few, many) {
    if (n === 1) return `${n} ${one}`;
    const tens = n % 100;
    return n % 10 >= 2 && n % 10 <= 4 && (tens < 12 || tens > 14) ? `${n} ${few}` : `${n} ${many}`;
  }

  /*
   * The calibration wizard: one step at a time, each step a URL fragment, so the browser Back button works. On a
   * step change focus moves to the step heading and the title says the step (WAI multi-page forms tutorial).
   */
  function wizard() {
    const steps = [...document.querySelectorAll('.wizard-step')];
    const progress = document.querySelector('[data-wizard-progress]');
    const back = document.querySelector('[data-wizard-back]');
    const next = document.querySelector('[data-wizard-next]');
    const skip = document.querySelector('[data-wizard-skip]');
    const save = document.querySelector('[data-wizard-save]');
    const restart = document.querySelector('[data-wizard-restart]');
    const NEXT_LABEL = { intro: 'Zacznij', camera: 'Włącz kamerę' };
    let index = 0;

    for (const step of steps) step.querySelector('h2').setAttribute('tabindex', '-1');

    function show(focus) {
      // The fragment is untrusted input: only a known step id counts.
      index = Math.max(
        0,
        steps.findIndex((step) => step.id === location.hash.slice(1)),
      );
      const step = steps[index];
      const last = index === steps.length - 1;
      steps.forEach((s, i) => (s.hidden = i !== index));
      progress.textContent = `Krok ${index + 1} z ${steps.length}`;
      back.hidden = index === 0;
      next.hidden = last;
      save.hidden = !last;
      restart.hidden = !last;
      skip.hidden = step.id !== 'hand-right';
      next.textContent = NEXT_LABEL[step.id] ?? 'Dalej';
      document.title = `Kalibracja: krok ${index + 1} z ${steps.length}, ${step.dataset['stepTitle']} (makieta)`;
      if (focus) step.querySelector('h2').focus();
    }

    const go = (delta) => {
      location.hash = steps[index + delta].id;
    };
    back.addEventListener('click', () => go(-1));
    next.addEventListener('click', () => go(1));
    skip.addEventListener('click', () => go(1));
    window.addEventListener('hashchange', () => show(true));
    show(false);
  }

  /*
   * Board import. The file is untrusted input (security.md): size-limited before reading, parsed with JSON.parse,
   * checked field by field, and shown only with textContent. Nothing is saved in the mock-up.
   */
  const BOARD_LIMITS = { bytes: 64 * 1024, size: 10, cell: 3, name: 40 };

  /** The errors in a board file (an empty list = valid), in plain Polish, at most 10. */
  function boardErrors(text) {
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      return ['To nie jest poprawny plik JSON. Sprawdź nawiasy, przecinki i cudzysłowy.'];
    }
    if (typeof data !== 'object' || data === null || Array.isArray(data)) {
      return ['Plik musi zawierać obiekt z polami "name" i "rows".'];
    }
    const errors = [];
    const name = typeof data.name === 'string' ? data.name.trim() : '';
    if (!name) errors.push('Brak nazwy tablicy: pole "name" musi być niepustym tekstem.');
    else if (name.length > BOARD_LIMITS.name) {
      errors.push(`Nazwa jest za długa: ${name.length} znaków, najwyżej ${BOARD_LIMITS.name}.`);
    }
    const rows = data.rows;
    if (!Array.isArray(rows) || rows.length === 0) {
      errors.push('Brak wierszy: pole "rows" musi być listą wierszy, a każdy wiersz listą pól.');
      return errors;
    }
    if (rows.length > BOARD_LIMITS.size) {
      errors.push(`Za dużo wierszy: ${rows.length}, najwyżej ${BOARD_LIMITS.size}.`);
    }
    const width = Array.isArray(rows[0]) ? rows[0].length : 0;
    if (width > BOARD_LIMITS.size) {
      errors.push(`Za dużo kolumn: ${width}, najwyżej ${BOARD_LIMITS.size}.`);
    }
    rows.slice(0, BOARD_LIMITS.size).forEach((row, r) => {
      if (!Array.isArray(row) || row.length === 0) {
        errors.push(`Wiersz ${r + 1} nie jest listą pól.`);
        return;
      }
      if (row.length !== width) {
        errors.push(
          `Wiersz ${r + 1} ma ${plural(row.length, 'pole', 'pola', 'pól')}, a wiersz 1 ma ${width}. Wszystkie wiersze muszą być równe.`,
        );
      }
      row.slice(0, BOARD_LIMITS.size).forEach((cell, c) => {
        if (typeof cell !== 'string') {
          errors.push(`Wiersz ${r + 1}, kolumna ${c + 1}: pole musi być tekstem w cudzysłowie.`);
        } else if ([...cell].length > BOARD_LIMITS.cell) {
          errors.push(
            `Wiersz ${r + 1}, kolumna ${c + 1}: pole może mieć najwyżej ${BOARD_LIMITS.cell} znaki.`,
          );
        }
      });
    });
    return errors.slice(0, 10);
  }

  function boards() {
    const input = document.querySelector('[data-board-file]');
    const result = document.querySelector('[data-board-result]');

    function report(errors, summary) {
      result.replaceChildren();
      input.setAttribute('aria-invalid', String(errors.length > 0));
      const p = document.createElement('p');
      p.className = errors.length ? 'field-error mt-2' : 'field-ok mt-2';
      p.append(icon(errors.length ? 'alert' : 'check'), document.createTextNode(summary));
      result.append(p);
      if (!errors.length) return;
      const list = document.createElement('ul');
      list.className = 'mt-1 list-disc pl-8 text-sm';
      for (const error of errors) {
        const li = document.createElement('li');
        li.textContent = error;
        list.append(li);
      }
      result.append(list);
    }

    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (!file) return;
      if (file.size > BOARD_LIMITS.bytes) {
        report(
          [`Plik ma ${Math.ceil(file.size / 1024)} KB, a najwyżej może mieć 64 KB.`],
          'Błąd: nie można użyć tego pliku.',
        );
        return;
      }
      const text = await file.text();
      const errors = boardErrors(text);
      if (errors.length) {
        report(
          errors,
          `Błąd: nie można użyć tego pliku (${plural(errors.length, 'problem', 'problemy', 'problemów')}).`,
        );
        return;
      }
      const board = JSON.parse(text);
      const cols = plural(board.rows[0].length, 'kolumna', 'kolumny', 'kolumn');
      const rows = plural(board.rows.length, 'wiersz', 'wiersze', 'wierszy');
      report(
        [],
        `Tablica „${board.name.trim()}” jest poprawna: ${cols}, ${rows}. W makiecie nie zapisuje się.`,
      );
    });
  }

  /* Settings: range checks with errors linked to the field, switches, the speech rate and the theme. */
  function settings() {
    const decimal = (n) => String(n).replace('.', ',');

    for (const input of document.querySelectorAll('[data-range-field]')) {
      // Each field's error has the id "<field id>-error" (settings.html), so the lookup does not depend on the
      // order of the ids in aria-describedby.
      const error = document.getElementById(`${input.id}-error`);
      const check = () => {
        const value = input.valueAsNumber;
        const ok = !Number.isNaN(value) && value >= Number(input.min) && value <= Number(input.max);
        input.setAttribute('aria-invalid', String(!ok));
        error.hidden = ok;
        error.replaceChildren();
        if (!ok) {
          error.append(
            icon('alert'),
            document.createTextNode(
              `Błąd: podaj liczbę od ${decimal(input.min)} do ${decimal(input.max)}. Do tego czasu działa poprzednia wartość.`,
            ),
          );
        }
      };
      input.addEventListener('input', check);
      input.addEventListener('change', check);
    }

    for (const button of document.querySelectorAll('[data-switch]')) {
      button.addEventListener('click', () => {
        const on = button.getAttribute('aria-checked') !== 'true';
        button.setAttribute('aria-checked', String(on));
        const word = button.querySelector('[data-switch-word]');
        if (word) word.textContent = on ? 'Wł.' : 'Wył.';
      });
    }

    const rate = document.querySelector('[data-rate]');
    const rateValue = document.querySelector('[data-rate-value]');
    rate.addEventListener('input', () => {
      const value = rate.valueAsNumber;
      rateValue.textContent = `${decimal(value.toFixed(1))} ×${value === 1 ? ', zwykłe tempo' : ''}`;
    });

    // The theme applies at once, like ?scheme= on the catalog.
    for (const radio of document.querySelectorAll('[data-theme]')) {
      radio.checked = radio.value === scheme;
      radio.addEventListener('change', () => {
        if (radio.value === 'auto') delete root.dataset['scheme'];
        else root.dataset['scheme'] = radio.value;
      });
    }
  }
})();

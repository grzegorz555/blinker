import { TestBed } from '@angular/core/testing';
import { translocoTesting } from '../../../testing/transloco';
import { SPEAKER, TICK_SCHEDULER, type TickScheduler } from '../../core/counting/counting.service';
import { FakeSpeaker } from '../../core/speech/fake-speaker';
import { SettingsService } from '../../core/settings/settings.service';
import { ConfirmService } from '../../shared/confirm-dialog/confirm-dialog';
import { TopBar } from '../../shell/top-bar';
import { CountingPage } from './counting-page';

describe('CountingPage (spec 007, R4, R5)', () => {
  let answer = true;
  let speaker: FakeSpeaker;
  afterEach(() => TestBed.resetTestingModule());

  async function render() {
    const scheduler: TickScheduler = { every: () => () => undefined };
    await TestBed.configureTestingModule({
      imports: [CountingPage, translocoTesting()],
      providers: [
        { provide: TICK_SCHEDULER, useValue: scheduler },
        { provide: SPEAKER, useValue: (speaker = new FakeSpeaker()) },
        { provide: ConfirmService, useValue: { confirm: async () => answer } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(CountingPage);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    const button = (name: string) =>
      [...root.querySelectorAll('button')].find((b) => b.textContent?.trim() === name)!;
    const text = (id: string) => root.querySelector(`[data-testid="${id}"]`)?.textContent?.trim();
    return { fixture, root, button, text };
  }

  it('shows the prompt, the board and an empty sentence', async () => {
    const { root, text } = await render();
    expect(text('question')).toBe('Give the column');
    expect(root.querySelectorAll('table button').length).toBe(33);
    expect(text('sentence')).toBe('');
  });

  it('a tap on a cell adds it through the machine and fills the live region', async () => {
    const { fixture, button, text } = await render();
    button('W').click();
    await fixture.whenStable();
    expect(text('sentence')).toBe('W');
    expect(text('announcer')).toBe('Added W');
  });

  it('clears only after the confirmation', async () => {
    const { fixture, button, text } = await render();
    button('A').click();
    answer = false;
    button('Clear').click();
    await fixture.whenStable();
    expect(text('sentence')).toBe('A');
    answer = true;
    button('Clear').click();
    await fixture.whenStable();
    expect(text('sentence')).toBe('');
  });

  it('puts the Pause button into the top bar and takes it out when the screen goes', async () => {
    const { fixture } = await render();
    const topBar = TestBed.inject(TopBar);
    expect(topBar.actions()).not.toBeNull();
    fixture.destroy();
    expect(topBar.actions()).toBeNull();
  });

  it('the hint says what a nod and a shake do now: a space and undo at the columns, yes and no on a question', async () => {
    const { fixture, button, text } = await render();
    expect(text('hint')).toBe(
      'Nod without a number = space (end of a word) · Shake your head = undo the last letter',
    );
    button('Blink +1').click();
    await fixture.whenStable();
    expect(text('hint')).toBe('Nod = yes · Shake your head = no');
  });

  it('Space adds a space after a word, never at the start or twice (author, 2026-11-13)', async () => {
    const { fixture, button, text } = await render();
    button('Space').click();
    await fixture.whenStable();
    expect(text('sentence')).toBe('');
    button('A').click();
    button('Space').click();
    button('Space').click();
    await fixture.whenStable();
    expect(text('announcer')).toContain('No space');
    button('B').click();
    await fixture.whenStable();
    expect(text('sentence')).toBe('A B');
  });

  it('the signal buttons send his signals (R6) and can be hidden by the setting', async () => {
    const { fixture, root, button, text } = await render();
    expect(root.querySelectorAll('app-signal-panel button')).toHaveLength(5);
    button('Hand +5').click();
    button('Blink +1').click();
    await fixture.whenStable();
    expect(text('tally')).toContain('= 6');
    TestBed.inject(SettingsService).update({ signalButtons: false });
    await fixture.whenStable();
    expect(root.querySelector('app-signal-panel')).toBeNull();
  });

  it('listens to the keys only when the keyboard mapping is on (SC 2.1.4)', async () => {
    const { fixture, text } = await render();
    const press = (key: string) =>
      document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
    press('h');
    await fixture.whenStable();
    expect(text('tally')).toBeUndefined();
    TestBed.inject(SettingsService).update({ keyboard: true });
    press('h');
    await fixture.whenStable();
    expect(text('tally')).toContain('= 5');
    fixture.destroy();
    press('h'); // no listener left after the screen goes
  });

  it('turns Read aloud into Stop while speaking, and shows a missing voice in text (R7)', async () => {
    const { fixture, button, text } = await render();
    button('A').click();
    button('Read aloud').click();
    await fixture.whenStable();
    expect(button('Read aloud')).toBeUndefined();
    button('Stop').click();
    await fixture.whenStable();
    expect(speaker.cancels).toBeGreaterThan(0);
    expect(button('Read aloud')).toBeDefined();

    speaker.result = 'no-local-voice';
    button('Read aloud').click();
    await fixture.whenStable();
    expect(text('voice-status')).toBe('No Polish voice on this device');
  });
});

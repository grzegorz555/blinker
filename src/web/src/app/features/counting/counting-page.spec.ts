import { TestBed } from '@angular/core/testing';
import { translocoTesting } from '../../../testing/transloco';
import { SPEAKER, TICK_SCHEDULER, type TickScheduler } from '../../core/counting/counting.service';
import { FakeSpeaker } from '../../core/speech/fake-speaker';
import { ConfirmService } from '../../shared/confirm-dialog/confirm-dialog';
import { TopBar } from '../../shell/top-bar';
import { CountingPage } from './counting-page';

describe('CountingPage (spec 007, R4, R5)', () => {
  let answer = true;

  async function render() {
    const scheduler: TickScheduler = { every: () => () => undefined };
    await TestBed.configureTestingModule({
      imports: [CountingPage, translocoTesting()],
      providers: [
        { provide: TICK_SCHEDULER, useValue: scheduler },
        { provide: SPEAKER, useValue: new FakeSpeaker() },
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

  it('shows the hint line', async () => {
    const { text } = await render();
    expect(text('hint')).toBe('Nod = yes · Shake your head = no');
  });
});

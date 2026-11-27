// Spec 018, T1: the ToastService (R1–R4, R6) on the real MatSnackBar, with fake timers.
import { TestBed } from '@angular/core/testing';
import { MATERIAL_ANIMATIONS } from '@angular/material/core';
import { Router, provideRouter } from '@angular/router';
import { translocoTesting } from '../../../testing/transloco';
import { TOAST_MS, ToastService } from './toast';

describe('ToastService (spec 018)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({
      imports: [translocoTesting()],
      providers: [
        provideRouter([{ path: 'other', children: [] }]),
        // jsdom fires no animationend, so the snack bar would never finish closing with animations on.
        { provide: MATERIAL_ANIMATIONS, useValue: { animationsDisabled: true } },
      ],
    });
  });
  afterEach(async () => {
    TestBed.inject(ToastService).dismiss();
    TestBed.tick();
    await Promise.resolve();
    vi.useRealTimers();
    document.documentElement.style.removeProperty('--toast-offset');
    document.querySelector('app-nav')?.remove();
    TestBed.resetTestingModule();
  });

  const toasts = () => TestBed.inject(ToastService);
  const text = () => document.querySelector('[data-testid="toast-text"]')?.textContent?.trim();
  const action = () => document.querySelector<HTMLButtonElement>('[data-testid="toast-action"]');
  const host = () => document.querySelector<HTMLElement>('app-toast')!;
  /** The snack bar closes after the next render, in a microtask (animations off). */
  const settle = async () => {
    TestBed.tick();
    for (let i = 0; i < 3; i++) await Promise.resolve();
    TestBed.tick();
  };
  const advance = async (ms: number) => {
    vi.advanceTimersByTime(ms);
    await settle();
  };
  const show = async (...args: Parameters<ToastService['show']>) => {
    toasts().show(...args);
    await settle();
  };
  const gone = () => document.querySelector('app-toast') === null;

  it('shows the text and announces it once, politely, through the snack bar live region', async () => {
    await show('toast.dataDeleted');
    expect(text()).toBe('All data was deleted from this device.');
    await advance(200); // the snack bar moves its content into the live region after a short delay
    const live = document.querySelector('.mat-mdc-snack-bar-label [aria-live]')!;
    expect(live.getAttribute('aria-live')).toBe('polite');
    // The text has moved into the live region (role="status" is added only in Firefox).
    expect(live.textContent).toContain('All data was deleted');
    expect(document.querySelector('.app-toast')).not.toBeNull();
  });

  it('a toast without an action stays 6 s', async () => {
    await show('toast.dataDeleted');
    await advance(TOAST_MS.plain - 1);
    expect(host()).not.toBeNull();
    await advance(1);
    expect(gone()).toBe(true);
  });

  it('a toast with an action stays 10 s; the action runs once and closes the toast', async () => {
    const run = vi.fn();
    await show('toast.dataDeleted', undefined, { label: 'common.cancel', run });
    expect(action()?.textContent?.trim()).toBe('Cancel');
    await advance(TOAST_MS.plain);
    expect(host()).not.toBeNull();
    action()!.click();
    action()?.click();
    await settle();
    expect(run).toHaveBeenCalledTimes(1);
    expect(gone()).toBe(true);
  });

  it('pauses while the pointer is over it, and goes on with the time that was left (R3)', async () => {
    await show('toast.dataDeleted');
    await advance(5000);
    host().dispatchEvent(new Event('pointerenter'));
    await advance(60_000);
    expect(host()).not.toBeNull();
    host().dispatchEvent(new Event('pointerleave'));
    await advance(999);
    expect(host()).not.toBeNull();
    await advance(1);
    expect(gone()).toBe(true);
  });

  it('pauses while the keyboard focus is in it, also when the pointer leaves meanwhile', async () => {
    const run = vi.fn();
    await show('toast.dataDeleted', undefined, { label: 'common.cancel', run });
    await advance(9000);
    host().dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    host().dispatchEvent(new Event('pointerenter'));
    host().dispatchEvent(new Event('pointerleave'));
    await advance(60_000);
    expect(host()).not.toBeNull();
    host().dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    await advance(1000);
    expect(gone()).toBe(true);
    expect(run).not.toHaveBeenCalled();
  });

  it('Esc in the toast closes it, without running the action', async () => {
    const run = vi.fn();
    await show('toast.dataDeleted', undefined, { label: 'common.cancel', run });
    host().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await settle();
    expect(gone()).toBe(true);
    expect(run).not.toHaveBeenCalled();
  });

  it('the close button (✕) closes it sooner, without running the action; it has a name and comes after the action', async () => {
    const run = vi.fn();
    await show('toast.dataDeleted', undefined, { label: 'toast.undo', run });
    const close = document.querySelector<HTMLButtonElement>('[data-testid="toast-close"]')!;
    expect(close.getAttribute('aria-label')).toBe('Close the notification');
    expect(close.querySelector('svg')!.getAttribute('aria-hidden')).toBe('true');
    expect(
      action()!.compareDocumentPosition(close) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    close.click();
    await settle();
    expect(gone()).toBe(true);
    expect(run).not.toHaveBeenCalled();

    await show('toast.dataDeleted');
    expect(document.querySelector('[data-testid="toast-close"]')).not.toBeNull();
  });

  it('a new toast replaces the old one, and the old action can no longer run (R1, R6)', async () => {
    const run = vi.fn();
    await show('toast.dataDeleted', undefined, { label: 'common.cancel', run });
    const oldAction = action()!;
    await show('settings.data.failed');
    oldAction.click();
    await settle();
    expect(run).not.toHaveBeenCalled();
    expect(document.querySelectorAll('app-toast')).toHaveLength(1);
    expect(text()).toContain('could not');
  });

  it('leaving the screen ends a toast with Cofnij (Undo), but not a plain one (R6)', async () => {
    await show('toast.dataDeleted', undefined, { label: 'common.cancel', run: vi.fn() });
    await TestBed.inject(Router).navigateByUrl('/other');
    await settle();
    expect(gone()).toBe(true);

    await show('toast.dataDeleted');
    await TestBed.inject(Router).navigateByUrl('/');
    await settle();
    expect(host()).not.toBeNull();
  });

  it('sits above a navigation bar at the bottom, and above a focused control near the bottom (R1)', async () => {
    vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(640);
    const bar = document.createElement('app-nav');
    const nav = document.createElement('nav');
    bar.append(nav);
    document.body.append(bar);
    vi.spyOn(nav, 'getBoundingClientRect').mockReturnValue({ top: 560 } as DOMRect);
    await show('toast.dataDeleted');
    expect(document.documentElement.style.getPropertyValue('--toast-offset')).toBe('80px');

    const button = document.createElement('button');
    document.body.append(button);
    button.focus();
    vi.spyOn(button, 'getBoundingClientRect').mockReturnValue({ top: 500, bottom: 544 } as DOMRect);
    await show('toast.dataDeleted');
    expect(document.documentElement.style.getPropertyValue('--toast-offset')).toBe('148px');
    button.remove();
  });

  const bar = () => document.querySelector<HTMLElement>('[data-testid="toast-bar"]')!;

  it('a bar along the bottom edge runs for as long as the toast stays, decorative (R3)', async () => {
    await show('toast.dataDeleted', undefined, { label: 'toast.undo', run: vi.fn() });
    expect(bar().style.animationDuration).toBe('10000ms');
    expect(bar().style.animationTimingFunction).toBe('linear');
    // Decorative: the live region must not change while the toast is shown.
    expect(bar().getAttribute('aria-hidden')).toBe('true');
    await show('toast.dataDeleted');
    expect(bar().style.animationDuration).toBe('6000ms');
  });

  it('held, the bar stands still and nothing else in the toast changes; let go, it goes on (R3)', async () => {
    await show('toast.dataDeleted');
    host().dispatchEvent(new Event('pointerenter'));
    await advance(200);
    expect(bar().classList).toContain('held');
    expect(host().querySelectorAll('svg')).toHaveLength(1); // the ✕ only: no pause mark

    host().dispatchEvent(new Event('pointerleave'));
    await advance(200);
    expect(bar().classList).not.toContain('held');
  });

  it('a rail at the side (600 px and wider) needs no offset', async () => {
    vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(800);
    const bar = document.createElement('app-nav');
    const nav = document.createElement('nav');
    bar.append(nav);
    document.body.append(bar);
    vi.spyOn(nav, 'getBoundingClientRect').mockReturnValue({ top: 0 } as DOMRect);
    await show('toast.dataDeleted');
    expect(document.documentElement.style.getPropertyValue('--toast-offset')).toBe('0px');
  });
});

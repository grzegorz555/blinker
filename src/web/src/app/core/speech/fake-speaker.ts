// A Speaker for tests (spec 006, R8): records what would be said, and can pretend there is no local voice.
import type { SayOptions, SpeakResult, Speaker } from './speaker';

export class FakeSpeaker implements Speaker {
  readonly said: { text: string; options: SayOptions }[] = [];
  cancels = 0;
  result: SpeakResult = 'started';
  private isSpeaking = false;
  private readonly listeners = new Set<(speaking: boolean) => void>();

  get speaking() {
    return this.isSpeaking;
  }

  say(text: string, options: SayOptions): SpeakResult {
    if (this.result !== 'started') return this.result;
    this.said.push({ text, options });
    this.set(true);
    return 'started';
  }

  cancel(): void {
    this.cancels++;
    this.set(false);
  }

  /** Ends the current speech, as the browser does when it has finished. */
  finish(): void {
    this.set(false);
  }

  subscribe(listener: (speaking: boolean) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private set(value: boolean) {
    if (this.isSpeaking === value) return;
    this.isSpeaking = value;
    for (const l of this.listeners) l(value);
  }
}

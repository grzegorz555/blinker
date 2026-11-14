import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { translocoTesting } from '../../../testing/transloco';
import { NotFound } from './not-found';

describe('NotFound', () => {
  it('explains the page is missing and links back to Liczenie (Counting); the heading is in the shell (spec 007, R2)', async () => {
    await TestBed.configureTestingModule({
      imports: [NotFound, translocoTesting()],
      providers: [provideRouter([])],
    }).compileComponents();
    const fixture = TestBed.createComponent(NotFound);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelector('h1')).toBeNull();
    expect(root.textContent).toContain("This page doesn't exist.");
    expect(root.querySelector('a')?.getAttribute('href')).toBe('/');
  });
});

import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { translocoTesting } from '../../../testing/transloco';
import { NotFound } from './not-found';

describe('NotFound', () => {
  it('renders a heading and a link back to the home page', async () => {
    await TestBed.configureTestingModule({
      imports: [NotFound, translocoTesting()],
      providers: [provideRouter([])],
    }).compileComponents();
    const fixture = TestBed.createComponent(NotFound);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelector('h1')?.textContent?.trim()).toBe('Page not found');
    expect(root.querySelector('a')?.getAttribute('href')).toBe('/');
  });
});

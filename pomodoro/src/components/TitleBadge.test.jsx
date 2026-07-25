import { render, screen } from '@testing-library/react';
import TitleBadge from './TitleBadge.jsx';

/*
 * Sample component test — verifies the Vitest + Testing Library setup end to end:
 * JSX transform, jsdom DOM, jest-dom matchers, and CSS imports all work.
 *
 * Assertions follow the title thresholds in services/gamification.js
 * (The Anchor 1000 → ... → The Paragon 16000).
 */
describe('TitleBadge', () => {
  it('shows "Unranked" and the first title as the next goal at zero points', () => {
    render(<TitleBadge lifetimePoints={0} />);

    expect(screen.getByText('Unranked')).toBeInTheDocument();
    expect(screen.getByText('Next · The Anchor')).toBeInTheDocument();
    expect(screen.getByText('1,000 lifetime pts to The Anchor')).toBeInTheDocument();
  });

  it('names the earned title and reports progress toward the next one', () => {
    render(<TitleBadge lifetimePoints={1000} />);

    expect(screen.getByText('The Anchor')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute(
      'aria-label',
      'Progress toward The Pace Setter'
    );
  });

  it('reports max rank once every title is earned', () => {
    render(<TitleBadge lifetimePoints={16000} />);

    expect(screen.getByText('The Paragon')).toBeInTheDocument();
    expect(screen.getByText('Max rank')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
  });
});

import { fireEvent, render, screen } from '@testing-library/react';
import TimerEngineTile from '../../components/timer/TimerEngineTile.jsx';

/*
 * Suite A2 — the control enablement matrix.
 *
 * The tile is presentational: every piece of timer state arrives as props, so the
 * contract worth proving is which controls exist in each lifecycle phase and what
 * they dispatch. `Start` is the only control gated by a `disabled` attribute (via
 * `canStart`); the other four are phase-scoped renders, absent from the DOM
 * entirely outside their phase.
 *
 * Controls are queried by accessible role and name. Class names, copy, the clock
 * format, and the progress geometry are out of scope here.
 */

const DEFAULT_MS = 25 * 60 * 1000;

// The tile takes a lot of props; this keeps each row of the matrix readable and
// keeps the same spy instances across rerenders.
function tileProps(overrides = {}) {
  return {
    phase: 'idle',
    isIdle: true,
    isRunning: false,
    isPaused: false,
    remainingMs: DEFAULT_MS,
    totalMs: DEFAULT_MS,
    canStart: false,
    hasBacklog: true,
    activeTaskTitle: 'Write the spec',
    onStart: vi.fn(),
    onPause: vi.fn(),
    onResume: vi.fn(),
    onRestart: vi.fn(),
    onTerminate: vi.fn(),
    ...overrides,
  };
}

describe('A2. Control enablement matrix (TimerEngineTile)', () => {
  it('A2.1 offers only Start while idle, disabled until a task is bound', () => {
    const props = tileProps({ canStart: false });
    const { rerender } = render(<TimerEngineTile {...props} />);

    expect(screen.getByRole('button', { name: 'Start' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Pause' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Resume' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Restart' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Terminate' })).not.toBeInTheDocument();

    rerender(<TimerEngineTile {...props} canStart />);

    expect(screen.getByRole('button', { name: 'Start' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: 'Pause' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Resume' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Restart' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Terminate' })).not.toBeInTheDocument();
  });

  it('A2.2 offers Pause, Restart and Terminate while running, in both work and break', () => {
    const props = tileProps({
      phase: 'work',
      isIdle: false,
      isRunning: true,
      canStart: true,
    });
    const { rerender } = render(<TimerEngineTile {...props} />);

    expect(screen.queryByRole('button', { name: 'Start' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Resume' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Restart' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Terminate' })).toBeInTheDocument();

    // The running row is phase-agnostic: a break offers exactly the same controls.
    rerender(<TimerEngineTile {...props} phase="break" />);

    expect(screen.queryByRole('button', { name: 'Start' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Resume' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Restart' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Terminate' })).toBeInTheDocument();
  });

  it('A2.3 swaps Pause for Resume while paused, keeping Restart and Terminate', () => {
    const props = tileProps({
      phase: 'work',
      isIdle: false,
      isPaused: true,
      canStart: true,
    });
    render(<TimerEngineTile {...props} />);

    expect(screen.queryByRole('button', { name: 'Start' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Pause' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Resume' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Restart' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Terminate' })).toBeInTheDocument();
  });

  it('A2.4 dispatches each rendered control once and dispatches nothing from a disabled Start', () => {
    const props = tileProps({ canStart: true });
    const { rerender } = render(<TimerEngineTile {...props} />);

    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    expect(props.onStart).toHaveBeenCalledTimes(1);

    rerender(<TimerEngineTile {...props} phase="work" isIdle={false} isRunning />);

    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
    fireEvent.click(screen.getByRole('button', { name: 'Restart' }));
    fireEvent.click(screen.getByRole('button', { name: 'Terminate' }));
    expect(props.onPause).toHaveBeenCalledTimes(1);
    expect(props.onRestart).toHaveBeenCalledTimes(1);
    expect(props.onTerminate).toHaveBeenCalledTimes(1);

    rerender(<TimerEngineTile {...props} phase="work" isIdle={false} isPaused />);

    fireEvent.click(screen.getByRole('button', { name: 'Resume' }));
    expect(props.onResume).toHaveBeenCalledTimes(1);

    // Back to idle with no task bound: Start is inert.
    rerender(<TimerEngineTile {...props} canStart={false} />);

    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    expect(props.onStart).toHaveBeenCalledTimes(1);
  });
});

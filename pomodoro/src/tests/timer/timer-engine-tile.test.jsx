import { fireEvent, render, screen } from '@testing-library/react';
import TimerEngineTile from '../../components/timer/TimerEngineTile.jsx';

/*
 * Suite A2 — the control enablement matrix.
 *
 * The tile is presentational: every piece of timer state arrives as props, so the
 * contract worth proving is which controls exist in each lifecycle phase and what
 * they dispatch. `Start` is the only control gated by a `disabled` attribute (via
 * `canStart`); the rest are phase-scoped renders, absent from the DOM entirely
 * outside their phase.
 *
 * The fifth slot is the one that carries meaning: a focus block ends with
 * `Terminate`, which asks for a reason and writes a terminated record, while a
 * break ends with `Skip break`, which asks nothing. Leaving a rest early is not
 * an outcome worth explaining, and prompting for one would train people to lie
 * to the dialog.
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
    onSkipBreak: vi.fn(),
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
    expect(screen.queryByRole('button', { name: 'Skip break' })).not.toBeInTheDocument();
  });

  it('A2.2 offers Pause and Restart while running, and an exit that matches the phase', () => {
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
    // Focus: the exit is the one that asks why.
    expect(screen.getByRole('button', { name: 'Terminate' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Skip break' })).not.toBeInTheDocument();

    rerender(<TimerEngineTile {...props} phase="break" />);

    // The first four slots are phase-agnostic...
    expect(screen.queryByRole('button', { name: 'Start' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Resume' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Restart' })).toBeInTheDocument();

    // ...but the exit is not. Offering Terminate here would demand a termination reason for
    // declining a rest, and the reason list has no honest answer to that.
    expect(screen.getByRole('button', { name: 'Skip break' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Terminate' })).not.toBeInTheDocument();
  });

  it('A2.3 swaps Pause for Resume while paused, keeping Restart and the phase exit', () => {
    const props = tileProps({
      phase: 'work',
      isIdle: false,
      isPaused: true,
      canStart: true,
    });
    const { rerender } = render(<TimerEngineTile {...props} />);

    expect(screen.queryByRole('button', { name: 'Start' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Pause' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Resume' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Restart' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Terminate' })).toBeInTheDocument();

    // Pausing does not change which exit a phase owns — a paused break is still a break.
    rerender(<TimerEngineTile {...props} phase="break" />);

    expect(screen.getByRole('button', { name: 'Resume' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Skip break' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Terminate' })).not.toBeInTheDocument();
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

    rerender(<TimerEngineTile {...props} phase="break" isIdle={false} isRunning />);

    fireEvent.click(screen.getByRole('button', { name: 'Skip break' }));
    expect(props.onSkipBreak).toHaveBeenCalledTimes(1);
    // The break exit is its own handler: routing it through onTerminate would land a terminated
    // record with a reason nobody gave.
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

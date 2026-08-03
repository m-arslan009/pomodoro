import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ProfilePage from '../../pages/ProfilePage.jsx';
import { ApiError } from '../../services/api.js';
import { changePassword, detectTimeZone } from '../../services/auth.js';
import { prepareAvatar } from '../../services/image.js';
import {
  fetchAvatarImage,
  fetchProfile,
  updateProfile,
  uploadAvatar,
} from '../../services/profile.js';
import { AuthTestProvider } from '../helpers/authTestContext.jsx';

/*
 * Suite J — the profile page, over the real hook, the real slice and the real reducer.
 *
 * SCOPE NOTE. Suite I covers the transport underneath this. What this suite asserts is the page's
 * side of the contract: that the form shows the account as it is *now* rather than as it was when
 * the token was minted, that a save sends only what changed and adopts what came back, and that a
 * refusal lands on the field it belongs to without the page claiming a change it did not make.
 *
 * Only the network layer is doubled. The store, the reducer and every component below the page are
 * real, so "the account was synchronised" is asserted where a user would see it — in the identity
 * summary, which reads from Redux and not from this form's state.
 */

vi.mock('../../services/profile.js', () => ({
  fetchProfile: vi.fn(),
  updateProfile: vi.fn(),
  fetchAvatarImage: vi.fn(),
  uploadAvatar: vi.fn(),
  removeAvatar: vi.fn(),
}));

vi.mock('../../services/auth.js', async (importOriginal) => ({
  ...(await importOriginal()),
  changePassword: vi.fn(),
  // Doubled so the zone the browser reports is something a test can state. The real one reads
  // Intl, which makes "does the page offer the detected zone?" depend on where it runs.
  detectTimeZone: vi.fn(),
}));

vi.mock('../../services/image.js', async (importOriginal) => ({
  ...(await importOriginal()),
  // jsdom has neither createImageBitmap nor canvas encoding, so the crop is doubled and the
  // staging behaviour around it is what gets tested.
  prepareAvatar: vi.fn(),
}));

const SAVED = {
  id: '018f-user',
  email: 'ada@evergrove.app',
  username: 'ada_l',
  firstName: 'Ada',
  lastName: 'Lovelace',
  timezone: 'Europe/London',
  emailVerified: false,
  avatarUpdatedAt: null,
  createdAt: '2026-07-28T09:00:00.000Z',
};

const CURRENT_PASSWORD = 'correct horse battery staple';
const NEW_PASSWORD = 'a long enough new one';

/** Resolves only when the test says so, so the in-flight state can be observed. */
function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function renderProfile({ user = SAVED } = {}) {
  const view = render(
    <MemoryRouter>
      <AuthTestProvider user={user}>
        <ProfilePage />
      </AuthTestProvider>
    </MemoryRouter>
  );

  // The page re-reads the profile on arrival. Let that settle first, so nothing below is measured
  // against a page that is still starting up.
  await waitFor(() => expect(fetchProfile).toHaveBeenCalled());
  return view;
}

const firstNameBox = () => screen.getByLabelText('First name');
const lastNameBox = () => screen.getByLabelText('Last name');
const usernameBox = () => screen.getByLabelText('Username');
const emailBox = () => screen.getByLabelText('Email');
const summary = () => screen.getByRole('region', { name: 'Account summary' });

// Matched on the exact accessible name: the avatar field also has a Save and a Cancel, and both
// read "Saving…" mid-flight.
const saveButton = () => screen.getByRole('button', { name: /^(Save changes|Saving…)$/ });
const cancelButton = () => screen.getByRole('button', { name: /^Cancel$/ });

const currentPasswordBox = () => screen.getByLabelText('Current password');
const newPasswordBox = () => screen.getByLabelText('New password');
const confirmPasswordBox = () => screen.getByLabelText('Confirm new password');
const updatePasswordButton = () =>
  screen.getByRole('button', { name: /^(Update password|Updating…)$/ });

/** Controlled inputs need a change event; typing character by character adds nothing here. */
function fill(element, value) {
  fireEvent.change(element, { target: { value } });
}

beforeEach(() => {
  vi.clearAllMocks();
  detectTimeZone.mockReturnValue(SAVED.timezone);
  fetchProfile.mockResolvedValue(SAVED);
  fetchAvatarImage.mockResolvedValue(null);
});

describe('Suite J1 — What the page shows', () => {
  it('J1.1 — shows the signed-in account in both the summary and the form', async () => {
    await renderProfile();

    expect(screen.getByRole('heading', { level: 1, name: 'Profile' })).toBeInTheDocument();

    expect(firstNameBox()).toHaveValue('Ada');
    expect(lastNameBox()).toHaveValue('Lovelace');
    expect(usernameBox()).toHaveValue('ada_l');
    expect(emailBox()).toHaveValue('ada@evergrove.app');

    expect(summary()).toHaveTextContent('Ada Lovelace');
    expect(summary()).toHaveTextContent('@ada_l');
    expect(summary()).toHaveTextContent('ada@evergrove.app');
  });

  it('J1.2 — presents the email as read-only, and says how to change it truthfully', async () => {
    await renderProfile();

    expect(emailBox()).toHaveAttribute('readonly');
    fill(emailBox(), 'someone.else@evergrove.app');
    expect(emailBox()).toHaveValue('ada@evergrove.app');

    // There is no self-service email change and no recovery flow behind one. The hint has to say
    // what is actually true, not that the address is immutable.
    expect(emailBox()).toHaveAccessibleDescription('Contact support to change your email address.');
  });

  it('J1.3 — renders a loader instead of dereferencing an account that is not there', async () => {
    // RequireAuth resolves before this page mounts, so a null user means the session ended
    // underneath it. That has to be a loading state, not a white screen.
    await renderProfile({ user: null });

    expect(screen.getByRole('status')).toHaveTextContent('Loading your profile…');
    expect(screen.queryByLabelText('First name')).not.toBeInTheDocument();
  });
});

describe('Suite J2 — Staying current with the server', () => {
  it('J2.1 — adopts a profile that changed since the token was issued', async () => {
    fetchProfile.mockResolvedValue({ ...SAVED, firstName: 'Grace', username: 'grace_h' });

    await renderProfile();

    await waitFor(() => expect(firstNameBox()).toHaveValue('Grace'));
    expect(usernameBox()).toHaveValue('grace_h');
    expect(summary()).toHaveTextContent('@grace_h');
  });

  it('J2.2 — says nothing when that re-read fails, because the page already has data', async () => {
    fetchProfile.mockRejectedValue(
      new ApiError(500, 'Internal server error', 'Something went wrong.')
    );

    await renderProfile();

    expect(firstNameBox()).toHaveValue('Ada');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('J2.3 — keeps what is being typed while adopting the fields nobody touched', async () => {
    const read = deferred();
    fetchProfile.mockReturnValue(read.promise);
    await renderProfile();

    fill(firstNameBox(), 'Augusta');
    read.resolve({ ...SAVED, firstName: 'Grace', lastName: 'Hopper' });

    // An untouched field takes the new value; an edited one is left alone. Copying the profile
    // into state on mount would strand both on whatever the form was seeded with.
    await waitFor(() => expect(lastNameBox()).toHaveValue('Hopper'));
    expect(firstNameBox()).toHaveValue('Augusta');
  });
});

describe('Suite J3 — Editing and client-side validation', () => {
  it('J3.1 — enables the actions only once something has changed, and Cancel puts it back', async () => {
    await renderProfile();

    expect(saveButton()).toBeDisabled();
    expect(cancelButton()).toBeDisabled();

    fill(firstNameBox(), 'Augusta');
    expect(saveButton()).toBeEnabled();

    fireEvent.click(cancelButton());
    expect(firstNameBox()).toHaveValue('Ada');
    expect(saveButton()).toBeDisabled();
  });

  it('J3.2 — reports a bad value on blur and ties the message to the field', async () => {
    await renderProfile();

    fill(firstNameBox(), 'A');
    fireEvent.blur(firstNameBox());

    expect(
      await screen.findByText('First name must be at least 2 characters.')
    ).toBeInTheDocument();
    expect(firstNameBox()).toHaveAttribute('aria-invalid', 'true');
    // Adjacency is not association: a screen reader has to reach the message from the input.
    expect(firstNameBox()).toHaveAccessibleDescription('First name must be at least 2 characters.');
  });

  it('J3.3 — refuses to spend a request on a value it already knows is invalid', async () => {
    await renderProfile();

    fill(usernameBox(), 'ab');
    fireEvent.click(saveButton());

    expect(await screen.findByText('Username must be at least 3 characters.')).toBeInTheDocument();
    expect(screen.getByText(/fix the highlighted fields/i)).toBeInTheDocument();
    expect(updateProfile).not.toHaveBeenCalled();
  });
});

describe('Suite J4 — Saving', () => {
  it('J4.1 — sends only what changed, adopts the answer, and syncs it app-wide', async () => {
    updateProfile.mockResolvedValue({ ...SAVED, firstName: 'Grace', username: 'grace_h' });
    await renderProfile();

    fill(firstNameBox(), 'Grace');
    fill(usernameBox(), '  grace_h  ');
    fireEvent.click(saveButton());

    expect(await screen.findByText(/your profile has been updated/i)).toBeInTheDocument();

    // The untouched surname is absent: sending it back would be a write nobody asked for.
    expect(updateProfile).toHaveBeenCalledWith({ firstName: 'Grace', username: '  grace_h  ' });

    // The server trimmed it, so the form shows the stored value rather than the typed one.
    expect(usernameBox()).toHaveValue('grace_h');

    // The summary reads the account from Redux, so this is the proof the save reached state that
    // the rest of the app shares — not just this form.
    expect(summary()).toHaveTextContent('Grace Lovelace');
    expect(summary()).toHaveTextContent('@grace_h');

    expect(saveButton()).toBeDisabled();
  });

  it('J4.2 — offers the zone the browser reports and saves it when accepted', async () => {
    detectTimeZone.mockReturnValue('Asia/Karachi');
    updateProfile.mockResolvedValue({ ...SAVED, timezone: 'Asia/Karachi' });
    await renderProfile();

    expect(screen.getByText('Europe/London')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Use Asia/Karachi' }));
    expect(screen.getByText('Asia/Karachi')).toBeInTheDocument();

    fireEvent.click(saveButton());

    expect(await screen.findByText(/your profile has been updated/i)).toBeInTheDocument();
    expect(updateProfile).toHaveBeenCalledWith({ timezone: 'Asia/Karachi' });
    // Nothing left to offer once the two agree.
    expect(screen.queryByRole('button', { name: /^Use / })).not.toBeInTheDocument();
  });

  it('J4.3 — offers no zone change when the browser already agrees with the account', async () => {
    await renderProfile();

    expect(screen.getByText('Europe/London')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Use / })).not.toBeInTheDocument();
  });
});

describe('Suite J5 — While the save is in flight', () => {
  it('J5.1 — locks the form until the request settles', async () => {
    const call = deferred();
    updateProfile.mockReturnValue(call.promise);
    await renderProfile();

    fill(firstNameBox(), 'Grace');
    fireEvent.click(saveButton());

    await waitFor(() => expect(saveButton()).toHaveTextContent('Saving…'));
    expect(saveButton()).toBeDisabled();
    expect(cancelButton()).toBeDisabled();
    // The inputs lock too: a value edited mid-flight would not be the value that was sent.
    expect(firstNameBox()).toBeDisabled();
    expect(usernameBox()).toBeDisabled();

    call.resolve({ ...SAVED, firstName: 'Grace' });

    expect(await screen.findByText(/your profile has been updated/i)).toBeInTheDocument();
    expect(firstNameBox()).toBeEnabled();
  });

  it('J5.2 — sends one request when save is clicked twice', async () => {
    const call = deferred();
    updateProfile.mockReturnValue(call.promise);
    await renderProfile();

    fill(firstNameBox(), 'Grace');
    fireEvent.click(saveButton());
    fireEvent.click(saveButton());

    // Two writes of the whole profile in flight would let the slower answer overwrite the faster.
    expect(updateProfile).toHaveBeenCalledTimes(1);

    call.resolve({ ...SAVED, firstName: 'Grace' });
    expect(await screen.findByText(/your profile has been updated/i)).toBeInTheDocument();
  });
});

describe('Suite J6 — When the server refuses', () => {
  it('J6.1 — puts a taken username on the username field and claims no partial success', async () => {
    updateProfile.mockRejectedValue(
      new ApiError(409, 'Username taken', 'That username is already in use.', {
        username: 'That username is already taken.',
      })
    );
    await renderProfile();

    fill(firstNameBox(), 'Grace');
    fill(usernameBox(), 'grace_h');
    fireEvent.click(saveButton());

    await waitFor(() =>
      expect(usernameBox()).toHaveAccessibleDescription('That username is already taken.')
    );
    expect(usernameBox()).toHaveAttribute('aria-invalid', 'true');

    // The PATCH rolled back whole, so both edits have to survive for the retry…
    expect(usernameBox()).toHaveValue('grace_h');
    expect(firstNameBox()).toHaveValue('Grace');
    // …and nothing on the page may show the name as though it had been saved.
    expect(summary()).toHaveTextContent('Ada Lovelace');
  });

  it.each([
    [
      'a refusal with no field to blame',
      new ApiError(422, 'Validation failed', 'That change could not be applied.'),
      /that change could not be applied/i,
    ],
    [
      'an unreachable server',
      new ApiError(0, 'Network error', 'We could not reach the server. Check your connection.'),
      /could not reach the server/i,
    ],
    [
      'a failure that is not an ApiError at all',
      new TypeError('boom'),
      /could not save your profile/i,
    ],
  ])('J6.2 — explains %s and leaves the edit intact', async (_case, failure, expected) => {
    updateProfile.mockRejectedValue(failure);
    await renderProfile();

    fill(firstNameBox(), 'Grace');
    fireEvent.click(saveButton());

    expect(await screen.findByText(expected)).toBeInTheDocument();
    expect(firstNameBox()).toHaveValue('Grace');
    expect(saveButton()).toBeEnabled();
  });
});

describe('Suite J7 — The profile photo', () => {
  it('J7.1 — shows initials, and asks for no image, when the account has no photo', async () => {
    await renderProfile();

    expect(screen.getByText('AL')).toBeInTheDocument();
    expect(fetchAvatarImage).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Add photo')).toBeInTheDocument();
  });

  it('J7.2 — shows the stored photo in place of the initials when there is one', async () => {
    fetchAvatarImage.mockResolvedValue('data:image/png;base64,STORED');

    const { container } = await renderProfile({
      user: { ...SAVED, avatarUpdatedAt: '2026-07-29T18:44:16.315Z' },
    });

    await waitFor(() =>
      expect(container.querySelector('img')).toHaveAttribute('src', 'data:image/png;base64,STORED')
    );
    expect(screen.queryByText('AL')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Change photo')).toBeInTheDocument();
  });

  it('J7.3 — stages a chosen photo before sending it, then saves it and syncs the account', async () => {
    prepareAvatar.mockResolvedValue({
      blob: new Blob(['cropped'], { type: 'image/webp' }),
      dataUrl: 'data:image/webp;base64,PREVIEW',
    });
    uploadAvatar.mockResolvedValue({ ...SAVED, avatarUpdatedAt: '2026-07-30T10:00:00.000Z' });

    const { container } = await renderProfile();

    fireEvent.change(screen.getByLabelText('Add photo'), {
      target: { files: [new File(['bytes'], 'photo.png', { type: 'image/png' })] },
    });

    // The crop is centre-square, so the preview is where someone finds out what it did to their
    // photo. Nothing is sent until they accept it.
    await waitFor(() =>
      expect(container.querySelector('img')).toHaveAttribute(
        'src',
        'data:image/webp;base64,PREVIEW'
      )
    );
    expect(uploadAvatar).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /^(Save photo|Saving…)$/ }));

    await waitFor(() => expect(uploadAvatar).toHaveBeenCalledTimes(1));
    // The staging controls are gone, the image stands, and the account now carries a photo — so
    // the page re-reads it rather than trusting the local copy indefinitely.
    expect(screen.queryByRole('button', { name: 'Save photo' })).not.toBeInTheDocument();
    expect(container.querySelector('img')).toHaveAttribute('src', 'data:image/webp;base64,PREVIEW');
    await waitFor(() => expect(fetchAvatarImage).toHaveBeenCalled());
  });

  it('J7.4 — explains a file it cannot use and stages nothing', async () => {
    prepareAvatar.mockRejectedValue(new Error('Choose a PNG, JPEG, or WebP image.'));
    await renderProfile();

    fireEvent.change(screen.getByLabelText('Add photo'), {
      target: { files: [new File(['notes'], 'notes.txt', { type: 'text/plain' })] },
    });

    expect(await screen.findByText('Choose a PNG, JPEG, or WebP image.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save photo' })).not.toBeInTheDocument();
    expect(uploadAvatar).not.toHaveBeenCalled();
    // The initials are still what stands in for a photo, because none was accepted.
    expect(screen.getByText('AL')).toBeInTheDocument();
  });
});

describe('Suite J8 — Changing the password', () => {
  it('J8.1 — catches a mismatch before spending a request on it', async () => {
    await renderProfile();

    fill(currentPasswordBox(), CURRENT_PASSWORD);
    fill(newPasswordBox(), NEW_PASSWORD);
    fill(confirmPasswordBox(), `${NEW_PASSWORD} but different`);
    fireEvent.click(updatePasswordButton());

    expect(await screen.findByText('Passwords do not match.')).toBeInTheDocument();
    expect(changePassword).not.toHaveBeenCalled();
  });

  it('J8.2 — sends the change and empties the form on success', async () => {
    changePassword.mockResolvedValue(undefined);
    await renderProfile();

    fill(currentPasswordBox(), CURRENT_PASSWORD);
    fill(newPasswordBox(), NEW_PASSWORD);
    fill(confirmPasswordBox(), NEW_PASSWORD);
    fireEvent.click(updatePasswordButton());

    expect(await screen.findByText(/your password has been changed/i)).toBeInTheDocument();
    expect(changePassword).toHaveBeenCalledWith({
      currentPassword: CURRENT_PASSWORD,
      newPassword: NEW_PASSWORD,
    });
    // Nothing is left on screen for the next person at the keyboard.
    expect(currentPasswordBox()).toHaveValue('');
    expect(newPasswordBox()).toHaveValue('');
    expect(confirmPasswordBox()).toHaveValue('');
  });

  it('J8.3 — puts a rejected current password on its own field', async () => {
    changePassword.mockRejectedValue(
      new ApiError(422, 'Validation failed', 'Your current password is incorrect.', {
        currentPassword: 'Your current password is incorrect.',
      })
    );
    await renderProfile();

    fill(currentPasswordBox(), 'not the right one at all');
    fill(newPasswordBox(), NEW_PASSWORD);
    fill(confirmPasswordBox(), NEW_PASSWORD);
    fireEvent.click(updatePasswordButton());

    // Whether the current password is right is the server's answer to give; the page has no copy
    // of it to check against.
    await waitFor(() =>
      expect(currentPasswordBox()).toHaveAccessibleDescription(
        'Your current password is incorrect.'
      )
    );
    expect(updatePasswordButton()).toBeEnabled();
  });
});

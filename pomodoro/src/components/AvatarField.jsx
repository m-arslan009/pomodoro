import { useEffect, useState } from 'react';
import { ApiError } from '../services/api.js';
import { prepareAvatar } from '../services/image.js';
import { fetchAvatarImage, uploadAvatar } from '../services/profile.js';
import '../styles/AvatarField.css';

/*
 * AvatarField — the profile photo and the controls that change it.
 *
 * Choosing a file stages it: the crop is applied locally and shown as a preview, and nothing is
 * sent until Save photo. That extra step is deliberate — the image is centre-cropped to a square,
 * so this is where someone finds out what the crop did to their photo.
 *
 * Removal is the exception: the button lives here, but the confirmation and the request are the
 * page's, because the dialog cannot render inside this component. `.profile-identity` carries a
 * backdrop-filter, which makes it the containing block for fixed-position descendants — a modal
 * mounted under it would be trapped inside the card instead of covering the viewport.
 */

function describeFailure(error) {
  if (error instanceof ApiError) {
    if (error.fieldErrors.avatar) return error.fieldErrors.avatar;
    if (error.isNetworkError) return error.message;
    if (error.detail) return error.detail;
  }
  return 'Could not update your photo. Please try again.';
}

function AvatarField({
  user,
  initials,
  onUpdated,
  onBusyChange,
  onRemoveRequest,
  disabled = false,
}) {
  const [savedImage, setSavedImage] = useState(null);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const { avatarUpdatedAt } = user;

  // Re-read whenever the server says the image changed. A failure leaves the initials showing
  // rather than reporting anything: the photo is decoration, and the page works without it.
  useEffect(() => {
    if (!avatarUpdatedAt) return undefined;
    let cancelled = false;
    fetchAvatarImage()
      .then((image) => {
        if (!cancelled && image) setSavedImage(image);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [avatarUpdatedAt]);

  async function handleSelect(event) {
    const file = event.target.files?.[0];
    // Clear the input so picking the same file twice still fires a change.
    event.target.value = '';
    if (!file) return;

    setError('');
    setBusy(true);
    try {
      setPreview(await prepareAvatar(file));
    } catch (failure) {
      setPreview(null);
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleSave() {
    if (!preview || busy) return;

    setError('');
    setBusy(true);
    onBusyChange?.(true);
    try {
      const updated = await uploadAvatar(preview.blob);
      // Adopt the preview directly: it is the image that was just stored, so the page shows the
      // new photo without waiting for the round trip the effect above will make anyway.
      setSavedImage(preview.dataUrl);
      setPreview(null);
      onUpdated(updated);
    } catch (failure) {
      setError(describeFailure(failure));
    } finally {
      setBusy(false);
      onBusyChange?.(false);
    }
  }

  function handleCancel() {
    setPreview(null);
    setError('');
  }

  function handleRemove() {
    // Asking is all this does; the page owns the confirmation and the request itself.
    setError('');
    onRemoveRequest();
  }

  /*
   * The marker gates the fetched image rather than a separate "is it gone" flag: once the server
   * says there is no avatar — after a removal, or because another session removed it — the bytes
   * held here are stale by definition, and the initials are what belongs in the circle.
   */
  const shown = preview?.dataUrl ?? (avatarUpdatedAt ? savedImage : null);
  const locked = disabled || busy;
  /*
   * `avatarUpdatedAt` is the server's answer to "is there a stored photo", and the only one worth
   * asking: the bytes may still be in flight, or may have failed to load, and neither of those
   * means there is nothing to remove. While a chosen file is staged the control is hidden instead
   * — Cancel discards that, and offering both would blur what each one throws away.
   */
  const removable = Boolean(avatarUpdatedAt) && !preview && Boolean(onRemoveRequest);

  return (
    <div className="avatar-field" aria-busy={busy || undefined}>
      <div className="profile-avatar">
        {shown ? (
          <img className="profile-avatar__image" src={shown} alt="" />
        ) : (
          <span aria-hidden="true">{initials}</span>
        )}
      </div>

      <div className="avatar-field__controls">
        <input
          id="avatar"
          type="file"
          className="avatar-field__input"
          accept="image/png,image/jpeg,image/webp"
          onChange={handleSelect}
          disabled={locked}
        />
        <label className="profile-btn profile-btn--ghost avatar-field__label" htmlFor="avatar">
          {shown ? 'Change photo' : 'Add photo'}
        </label>

        {preview && (
          <>
            <button
              type="button"
              className="profile-btn profile-btn--primary"
              onClick={handleSave}
              disabled={busy}
            >
              {busy ? 'Saving…' : 'Save photo'}
            </button>
            <button
              type="button"
              className="profile-btn profile-btn--ghost"
              onClick={handleCancel}
              disabled={busy}
            >
              Cancel
            </button>
          </>
        )}

        {removable && (
          <button
            type="button"
            className="profile-btn avatar-field__remove"
            onClick={handleRemove}
            disabled={locked}
          >
            Remove photo
          </button>
        )}
      </div>

      {error && (
        <p className="avatar-field__error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export default AvatarField;

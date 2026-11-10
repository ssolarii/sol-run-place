const link = document.getElementById('private-link');
const dialog = document.getElementById('private-dialog');
const form = document.getElementById('private-form');
const status = document.getElementById('private-status');
const button = form.querySelector('[type="submit"]');
let clientPromise, timer;

if (typeof dialog.showModal === 'function') {
  link.addEventListener('click', event => {
    event.preventDefault();
    dialog.showModal();
    document.getElementById('private-body').focus();
  });
  dialog.querySelector('.private-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => link.focus());
  button.disabled = false;
  status.textContent = '';
}

form.addEventListener('input', () => {
  form.elements.body.setCustomValidity('');
  form.elements.body.removeAttribute('aria-invalid');
  form.elements.displayName.removeAttribute('aria-invalid');
});
form.addEventListener('submit', async event => {
  event.preventDefault();
  if (button.disabled) return;
  const body = form.elements.body.value.trim();
  if (!body) {
    form.elements.body.setCustomValidity('Write a message before sending.');
    form.elements.body.reportValidity();
    return;
  }
  if (!form.reportValidity()) return;
  button.disabled = true;
  for (const field of form.querySelectorAll('input,textarea')) field.readOnly = true;
  form.setAttribute('aria-busy', 'true');
  button.textContent = 'Sending…';
  status.dataset.state = 'pending';
  status.textContent = 'Sending your message…';
  let service;
  try {
    clientPromise ??= import('./world-draft/assets/submissions/submissions-client.js')
      .then(({createSubmissionsClient}) => createSubmissionsClient({configUrl: new URL('./firebase/web-app-config.json', import.meta.url).href}))
      .catch(error => { clientPromise = null; throw error; });
    service = await clientPromise;
    await service.submit('private', {body, displayName: form.elements.displayName.value});
    form.reset();
    status.dataset.state = 'success';
    status.textContent = 'Your message was sent to Sol.';
  } catch (error) {
    status.dataset.state = 'error';
    status.textContent = error?.uncertain
      ? 'Delivery could not be confirmed. Your text is still here. Wait before sending again to avoid a duplicate.'
      : error?.name === 'SubmissionError'
        ? error.retryAfterSeconds ? `Please wait ${error.retryAfterSeconds} seconds before sending another note.` : error.message
        : 'Messages could not connect. Your text is still here. Check your connection and try again.';
    if (error?.field === 'body' || error?.field === 'displayName') {
      form.elements[error.field].setAttribute('aria-invalid', 'true');
      form.elements[error.field].focus();
    }
  } finally {
    form.removeAttribute('aria-busy');
    for (const field of form.querySelectorAll('input,textarea')) field.readOnly = false;
    clearInterval(timer);
    const sync = () => {
      const seconds = service?.getCooldown().remainingSeconds || 0;
      button.disabled = seconds > 0;
      button.textContent = seconds ? `Send again in ${seconds}s` : 'Send private message';
      if (!seconds) clearInterval(timer);
    };
    sync();
    if (service?.getCooldown().remainingSeconds) timer = setInterval(sync, 1000);
  }
});

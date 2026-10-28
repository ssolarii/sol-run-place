const forms = ['private', 'guestbook'].map(kind => ({
  kind, form: document.getElementById(`${kind}-form`),
  status: document.getElementById(`${kind}-status`)
}));
let clientPromise, busy = false, timer;
function client() {
  return clientPromise ??= import('./assets/submissions/submissions-client.js')
    .then(({createSubmissionsClient}) => createSubmissionsClient({
      configUrl: new URL('../firebase/web-app-config.json', import.meta.url).href
    })).catch(error => { clientPromise = null; throw error; });
}

for (const item of forms) {
  const {kind, form, status} = item;
  item.button = form.querySelector('[type=submit]');
  item.label = item.button.firstChild;
  item.originalLabel = item.label.textContent;
  item.wait = document.createElement('p');
  item.wait.id = `${kind}-wait`;
  item.wait.className = 'send-wait';
  item.wait.hidden = true;
  item.wait.setAttribute('aria-live', 'off');
  status.after(item.wait);
  item.button.setAttribute('aria-describedby', `${kind}-status ${kind}-wait`);
  item.button.disabled = false;
  status.textContent = '';
  form.addEventListener('input', () => {
    form.elements.body.setCustomValidity('');
    form.elements.body.removeAttribute('aria-invalid');
    form.elements.displayName.removeAttribute('aria-invalid');
  });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (busy || item.button.disabled) return;
    const body = form.elements.body.value.trim();
    if (!body) {
      form.elements.body.setCustomValidity('Write a message before sending.');
      form.elements.body.reportValidity();
      return;
    }
    if (!form.reportValidity()) return;
    busy = true;
    for (const row of forms) {
      row.button.disabled = true;
      for (const input of row.form.querySelectorAll('input,textarea')) input.readOnly = true;
    }
    form.setAttribute('aria-busy', 'true');
    item.label.textContent = 'Sending… ';
    status.dataset.state = 'pending';
    status.textContent = 'Sending your message…';
    let service;
    try {
      service = await client();
      await service.submit(kind, {body, displayName: form.elements.displayName.value});
      form.reset();
      form.elements.body.dispatchEvent(new Event('input', {bubbles:true}));
      status.dataset.state = 'success';
      status.textContent = kind === 'private'
        ? 'Your message was sent to Sol.'
        : 'Your note was sent for review. It will appear here if Sol approves it.';
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
      busy = false;
      form.removeAttribute('aria-busy');
      item.label.textContent = item.originalLabel;
      for (const row of forms) for (const input of row.form.querySelectorAll('input,textarea')) input.readOnly = false;
      clearInterval(timer);
      const sync = () => {
        const seconds = service?.getCooldown().remainingSeconds || 0;
        for (const row of forms) {
          row.button.disabled = busy || seconds > 0;
          row.wait.hidden = seconds === 0;
          row.wait.textContent = seconds ? `You can send another note in ${seconds} seconds.` : '';
        }
        if (!seconds) clearInterval(timer);
      };
      sync();
      if (service?.getCooldown().remainingSeconds) timer = setInterval(sync, 1000);
    }
  });
}

const list = document.getElementById('guestbook-entries');
const message = document.getElementById('guestbook-message');
const refresh = document.getElementById('guestbook-refresh');
let reading = false, loaded = false;
async function readGuestbook() {
  if (reading) return;
  reading = true;
  refresh.disabled = true;
  message.textContent = 'Loading the guestbook…';
  try {
    const entries = await (await client()).listPublished();
    list.replaceChildren();
    for (const entry of entries) {
      const li = document.createElement('li');
      const name = document.createElement('h4');
      name.textContent = entry.displayName || 'Anonymous';
      const body = document.createElement('p');
      body.textContent = entry.body;
      li.append(name, body);
      if (Number.isFinite(entry.createdAt)) {
        const time = document.createElement('time');
        time.dateTime = new Date(entry.createdAt).toISOString();
        time.textContent = new Intl.DateTimeFormat(undefined, {dateStyle:'medium'}).format(entry.createdAt);
        li.append(time);
      }
      list.append(li);
    }
    message.textContent = entries.length ? '' : 'No public notes yet. You can leave the first one.';
    loaded = true;
  } catch {
    message.textContent = 'The guestbook could not load. Check your connection, then choose Refresh.';
  } finally { reading = false; refresh.disabled = false; }
}
refresh.disabled = false;
message.textContent = '';
refresh.addEventListener('click', readGuestbook);
if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver(entries => {
    if (entries.some(entry => entry.isIntersecting) && !loaded) {
      observer.disconnect();
      readGuestbook();
    }
  }, {rootMargin:'120px'});
  observer.observe(list.parentElement);
} else readGuestbook();

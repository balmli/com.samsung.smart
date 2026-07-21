/* global document, EventSource, saveProfileForm */

let state = {profiles: [], logs: []};

const element = id => document.getElementById(id);
const escapeHtml = value =>
    String(value ?? '').replace(
        /[&<>'"]/g,
        character => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'})[character],
    );

async function request(path, body) {
    const response = await fetch(path, {
        method: 'POST',
        headers: {'content-type': 'application/json'},
        body: JSON.stringify(body || {}),
    });
    const value = await response.json();
    if (!response.ok) throw new Error(value.error || `Request failed (${response.status})`);
    return value;
}

function toast(message) {
    const target = element('toast');
    target.textContent = message;
    target.classList.add('visible');
    setTimeout(() => target.classList.remove('visible'), 4500);
}

function render() {
    element('profiles').innerHTML = state.profiles.length
        ? state.profiles
              .map(
                  profile => `
            <article class="profile">
                <div><strong>${escapeHtml(profile.id)}</strong><p>${escapeHtml(profile.ipAddress)} · ${escapeHtml(profile.modelName || 'Not inspected')}</p><p>${escapeHtml(profile.clientName)}</p></div>
                <button data-connect="${encodeURIComponent(profile.id)}">Connect & accept on TV</button>
                <em>${profile.tokenAuthSupport === false ? 'NO TOKEN REQUIRED' : profile.paired ? 'TOKEN SAVED' : 'PAIRING NEEDED'}</em>
            </article>`,
              )
              .join('')
        : '<p class="section-heading">No TV profiles saved yet.</p>';

    const active = state.activeProfile;
    element('active-summary').textContent = active
        ? `${active.modelName || 'Samsung TV'} at ${active.ipAddress} · connected as ${active.clientName}`
        : 'Connect a profile to begin.';
    element('run-options').hidden = !active;
    element('actions').innerHTML = !active
        ? '<button disabled>Test Homey operations</button>'
        : '<button class="danger" data-action="operations">Test Homey operations</button>';

    const pending = state.run?.pending;
    element('checkpoint').innerHTML = pending
        ? `
        <div class="checkpoint">
            <p class="label">HUMAN CHECK REQUIRED</p>
            <h3>${escapeHtml(pending.prompt)}</h3>
            <textarea id="answer-note" placeholder="Optional observation note"></textarea>
            <div class="checkpoint-buttons">
                <button class="yes" data-answer="yes">Yes</button>
                <button data-answer="no">No</button>
                <button data-answer="skip">Cannot determine</button>
            </div>
        </div>`
        : '';

    element('tests').innerHTML =
        state.run?.tests
            ?.map(
                test => `
        <li class="${escapeHtml(test.status)}"><span class="status-dot"></span><span>${escapeHtml(test.title)}${test.note ? `<small> — ${escapeHtml(test.note)}</small>` : ''}</span><span class="test-status">${escapeHtml(test.status)}</span></li>`,
            )
            .join('') || '';
    element('download').hidden = !state.run || !['passed', 'failed', 'error'].includes(state.run.status);
    element('logs').textContent = state.logs?.length
        ? state.logs
              .map(log => `${log.timestamp.slice(11, 19)} ${log.level.toUpperCase().padEnd(7)} ${log.message}`)
              .join('\n')
        : 'Waiting for a connection…';
    element('logs').scrollTop = element('logs').scrollHeight;
}

element('profile-form').addEventListener('submit', async event => {
    event.preventDefault();
    const profileForm = event.currentTarget;
    try {
        await saveProfileForm(profileForm, profile => request('/api/profiles', profile));
    } catch (error) {
        toast(error.message);
    }
});

document.addEventListener('click', async event => {
    const button = event.target.closest('button');
    if (!button) return;
    try {
        if (button.dataset.connect) {
            button.disabled = true;
            button.textContent = 'Waiting for TV approval…';
            await request(`/api/profiles/${button.dataset.connect}/connect`);
        } else if (button.dataset.action === 'operations') {
            await request(`/api/profiles/${encodeURIComponent(state.activeProfile.id)}/run`, {
                browserUrl: element('browser-url').value,
                channel: element('channel').value,
                restoreChannel: element('restore-channel').value,
            });
        } else if (button.dataset.answer) {
            await request('/api/answer', {
                checkpointId: state.run.pending.id,
                outcome: button.dataset.answer,
                note: element('answer-note').value,
            });
        }
    } catch (error) {
        toast(error.message);
        render();
    }
});

const events = new EventSource('/api/events');
events.onmessage = event => {
    state = JSON.parse(event.data);
    render();
};
events.onerror = () => toast('The local runner connection was interrupted.');
fetch('/api/state')
    .then(response => response.json())
    .then(value => {
        state = value;
        render();
    });

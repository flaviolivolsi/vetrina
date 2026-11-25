/**
 * vetrina answers
 *
 * A page that asks the human something loads this with one script tag whose
 * src is /_vetrina/answers.js, and the daemon inlines it at serve time exactly
 * as it does the kit. Then any form marked up as
 *
 *   <form data-vetrina-answers> ... </form>
 *
 * is wired. (The tag is not spelled out here because this file is inlined into
 * a script element, where that text would end it early.)
 *
 * On Submit the answers are POSTed to the daemon, which writes them next to the
 * page as <name>.answers.json. The agent that asked reads that file. Nobody has
 * to copy anything back into chat, which on a phone was the part that failed.
 *
 * What it does, and why each part exists:
 *
 *   - Restores the last saved answers on load, so a page reopened tomorrow says
 *     what was already decided instead of showing the agent's picks again.
 *   - Keeps a draft in localStorage on every keystroke. Live reload is the whole
 *     product, which means the agent rewriting the page mid-answer is the normal
 *     case. Without the draft that reload wiped whatever was being typed.
 *   - Falls back to a copyable dump when it cannot save: the page opened off
 *     disk, the daemon down, an older daemon with no endpoint. An answer that
 *     cannot be saved must still be recoverable, never just an error.
 *
 * Field shape, so the agent knows what it will read: a checkbox group is always
 * an array of the checked values (possibly empty), a radio group is the checked
 * value or null, and anything else is its string value. Fields are keyed by
 * name; unnamed fields and buttons are skipped.
 *
 * One form per page. A second one is ignored with a console warning, because
 * two forms writing one file would silently overwrite each other.
 *
 * Plain script, no module, no dependencies. It must never contain the text of
 * a script tag, opening or closing, since it is inlined into one; the daemon
 * checks and serves it as a plain link instead if it ever does.
 *
 * MIT, same as the rest of vetrina.
 */
(() => {
  'use strict';

  const ENDPOINT = '/__vetrina/answers' + location.pathname;
  const DRAFT_KEY = 'vetrina:answers:' + location.pathname;
  const OFF_DISK = location.protocol === 'file:';

  // Storage can throw outright (private mode, blocked site data), so every
  // touch is guarded. Losing the draft is a shame; losing the page is not okay.
  const draft = {
    get() {
      try {
        const d = JSON.parse(localStorage.getItem(DRAFT_KEY));
        return d && typeof d.at === 'number' && d.answers ? d : null;
      } catch {
        return null;
      }
    },
    set(answers) {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify({ at: Date.now(), answers }));
      } catch {
        /* no storage: the form still works, it just forgets on reload */
      }
    },
    clear() {
      try {
        localStorage.removeItem(DRAFT_KEY);
      } catch {
        /* nothing to clear */
      }
    },
  };

  const SKIP = new Set(['submit', 'button', 'reset', 'file', 'image']);

  function collect(form) {
    const out = {};
    for (const el of form.elements) {
      if (!el.name || el.disabled || SKIP.has(el.type)) continue;
      if (el.type === 'checkbox') {
        if (!Array.isArray(out[el.name])) out[el.name] = [];
        if (el.checked) out[el.name].push(el.value);
      } else if (el.type === 'radio') {
        if (!(el.name in out)) out[el.name] = null;
        if (el.checked) out[el.name] = el.value;
      } else if (el.tagName === 'SELECT' && el.multiple) {
        out[el.name] = [...el.selectedOptions].map((o) => o.value);
      } else {
        out[el.name] = el.value;
      }
    }
    return out;
  }

  // Only fields present in the stored answers are touched. A question the agent
  // added after the last save keeps the pick the agent prefilled.
  function apply(form, answers) {
    if (!answers || typeof answers !== 'object') return;
    for (const el of form.elements) {
      if (!el.name || SKIP.has(el.type) || !(el.name in answers)) continue;
      const v = answers[el.name];
      if (el.type === 'checkbox') el.checked = Array.isArray(v) ? v.includes(el.value) : !!v;
      else if (el.type === 'radio') el.checked = el.value === v;
      else if (el.tagName === 'SELECT' && el.multiple) {
        for (const o of el.options) o.selected = Array.isArray(v) && v.includes(o.value);
      } else el.value = v == null ? '' : String(v);
    }
  }

  const hhmm = (t) => {
    const d = new Date(t);
    return isNaN(d) ? '' : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // State is carried by a glyph and a word as well as colour: the kit styles
  // [data-state], the text says it.
  const GLYPH = { saved: '✓', error: '✕', draft: '○', saving: '…' };

  function statusEl(form) {
    let el = form.querySelector('[data-vetrina-status]');
    if (el) return el;
    el = document.createElement('p');
    el.className = 'v-status';
    el.setAttribute('data-vetrina-status', '');
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    const submit = form.querySelector('[type=submit], button:not([type])');
    if (submit) submit.insertAdjacentElement('afterend', el);
    else form.append(el);
    return el;
  }

  function say(form, state, text) {
    const el = statusEl(form);
    el.dataset.state = state;
    el.textContent = `${GLYPH[state] ?? ''} ${text}`.trim();
  }

  function copyText(area, button) {
    const done = () => {
      button.textContent = 'Copied';
      setTimeout(() => (button.textContent = 'Copy answers'), 2000);
    };
    // navigator.clipboard only exists in a secure context, and a tailnet IP over
    // plain http is not one. So the old select-and-copy path is the main path
    // here, not a legacy fallback.
    area.focus();
    area.select();
    try {
      if (document.execCommand('copy')) return done();
    } catch {
      /* try the async API */
    }
    navigator.clipboard?.writeText(area.value).then(done, () => {
      button.textContent = 'Select and copy by hand';
    });
  }

  function dump(form, answers, reason) {
    let box = form.querySelector('.v-dump');
    if (!box) {
      box = document.createElement('div');
      box.className = 'v-dump';
      box.innerHTML =
        '<p>Not saved to the agent. Copy this and paste it into chat instead.</p>' +
        '<textarea class="v-note" readonly rows="8" aria-label="Your answers as text"></textarea>' +
        '<button type="button" class="v-submit">Copy answers</button>';
      // After the sticky action bar, not inside it: a textarea pinned to the
      // bottom of a phone screen would cover the questions it is a copy of.
      const status = statusEl(form);
      (status.closest('.v-actions') ?? status).insertAdjacentElement('afterend', box);
      const area = box.querySelector('textarea');
      box.querySelector('button').addEventListener('click', (e) => copyText(area, e.currentTarget));
    }
    const page = decodeURIComponent(location.pathname.replace(/^\/+/, ''));
    box.querySelector('textarea').value =
      `Answers for ${page} (not saved: ${reason})\n` + JSON.stringify(answers, null, 2);
  }

  async function load(form) {
    const d = draft.get();
    let saved = null;
    if (!OFF_DISK) {
      try {
        const r = await fetch(ENDPOINT, { cache: 'no-store' });
        if (r.ok) saved = await r.json();
      } catch {
        /* daemon down or old: fall through to the draft */
      }
    }
    const savedAt = saved ? Date.parse(saved.savedAt) || 0 : 0;
    if (d && d.at > savedAt) {
      apply(form, d.answers);
      say(form, 'draft', 'Draft on this device, not sent yet');
    } else if (saved) {
      apply(form, saved.answers);
      say(form, 'saved', `Saved ${hhmm(saved.savedAt)}`);
      draft.clear();
    }
  }

  async function submit(form, e) {
    e.preventDefault();
    const answers = collect(form);
    draft.set(answers);
    if (OFF_DISK) {
      say(form, 'error', 'Opened from disk, so it cannot save');
      dump(form, answers, 'page opened from disk');
      return;
    }
    say(form, 'saving', 'Saving');
    const buttons = form.querySelectorAll('[type=submit], button:not([type])');
    buttons.forEach((b) => (b.disabled = true));
    try {
      const r = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(answers),
      });
      if (!r.ok) throw new Error(`${r.status} ${(await r.text()).slice(0, 80)}`.trim());
      const { savedAt } = await r.json();
      draft.clear();
      say(form, 'saved', `Saved ${hhmm(savedAt)}`);
      form.querySelector('.v-dump')?.remove();
    } catch (err) {
      say(form, 'error', 'Not saved');
      dump(form, answers, err?.message || 'network error');
    } finally {
      buttons.forEach((b) => (b.disabled = false));
    }
  }

  function wire() {
    const forms = document.querySelectorAll('form[data-vetrina-answers]');
    if (!forms.length) return;
    if (forms.length > 1) console.warn('vetrina answers: one form per page; wiring the first only');
    const form = forms[0];

    let t = null;
    const keep = () => {
      clearTimeout(t);
      t = setTimeout(() => {
        draft.set(collect(form));
        say(form, 'draft', 'Draft on this device, not sent yet');
      }, 300);
    };
    form.addEventListener('input', keep);
    form.addEventListener('change', keep);
    form.addEventListener('submit', (e) => submit(form, e));
    load(form);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire);
  else wire();
})();

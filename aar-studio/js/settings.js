// Azure configuration: stored in localStorage only, edited via a <dialog>.
// Calls go browser → Azure directly; there is no backend to hold keys.

import { h, clear, toast } from './ui.js';
import { testConnection, LlmError } from './lib/llm.js';

const KEY = 'aarstudio.settings';

export const DEFAULT_SETTINGS = {
  // Azure OpenAI (Azure AI Foundry deployment)
  llmEndpoint: '',
  llmKey: '',
  llmDeployment: '',        // live extraction, e.g. gpt-4o / gpt-4.1-mini
  reportDeployment: '',     // optional larger model for report generation
  apiVersion: '2024-10-21',
  // Azure AI Speech (Stage 4 — live audio)
  speechKey: '',
  speechRegion: 'australiaeast',
  language: 'en-AU',
  diarization: true,
};

export function getSettings() {
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings) {
  localStorage.setItem(KEY, JSON.stringify(settings));
}

function field(labelText, input, help) {
  return h('label', { class: 'field' },
    h('span', { class: 'field__label' }, labelText),
    input,
    help ? h('span', { class: 'field__help' }, help) : null,
  );
}

export function openSettingsDialog() {
  const s = getSettings();
  const dialog = document.getElementById('settings-dialog');
  clear(dialog);

  const inputs = {};
  const text = (key, attrs = {}) => (inputs[key] = h('input', { type: 'text', value: s[key], ...attrs }));

  const status = h('div', { class: 'settings__status' });

  const collect = () => ({
    ...s,
    llmEndpoint: inputs.llmEndpoint.value.trim(),
    llmKey: inputs.llmKey.value.trim(),
    llmDeployment: inputs.llmDeployment.value.trim(),
    reportDeployment: inputs.reportDeployment.value.trim(),
    apiVersion: inputs.apiVersion.value.trim() || DEFAULT_SETTINGS.apiVersion,
    speechKey: inputs.speechKey.value.trim(),
    speechRegion: inputs.speechRegion.value.trim() || DEFAULT_SETTINGS.speechRegion,
    language: inputs.language.value.trim() || DEFAULT_SETTINGS.language,
    diarization: inputs.diarization.checked,
  });

  const testBtn = h('button', {
    class: 'btn',
    type: 'button',
    onclick: async () => {
      status.textContent = 'Testing…';
      status.className = 'settings__status';
      testBtn.disabled = true;
      try {
        await testConnection(collect());
        status.textContent = '✓ Connected — the deployment answered correctly.';
        status.classList.add('settings__status--ok');
      } catch (err) {
        const hint = err instanceof LlmError && err.hint ? ` ${err.hint}` : '';
        status.textContent = `✗ ${err.message}.${hint}`;
        status.classList.add('settings__status--err');
      } finally {
        testBtn.disabled = false;
      }
    },
  }, 'Test connection');

  dialog.append(
    h('form', {
      method: 'dialog',
      onsubmit: () => {
        saveSettings(collect());
        toast('Settings saved (this browser only)');
      },
    },
      h('h2', {}, 'Settings'),
      h('p', { class: 'settings__note' },
        'Keys are stored in this browser’s localStorage only and sent directly to your Azure resources. Use scoped keys you can rotate.'),
      h('h3', {}, 'Azure OpenAI (Foundry)'),
      field('Endpoint', text('llmEndpoint', { placeholder: 'https://myresource.openai.azure.com', autocomplete: 'off' })),
      field('API key', (inputs.llmKey = h('input', { type: 'password', value: s.llmKey, autocomplete: 'off' }))),
      field('Chat deployment (live extraction)', text('llmDeployment', { placeholder: 'gpt-4.1-mini' })),
      field('Report deployment (optional)', text('reportDeployment', { placeholder: 'gpt-4o' }), 'Falls back to the chat deployment when empty.'),
      field('API version', text('apiVersion', { placeholder: DEFAULT_SETTINGS.apiVersion })),
      h('div', { class: 'settings__row' }, testBtn, status),
      h('h3', {}, 'Azure AI Speech (live audio — coming in Stage 4)'),
      field('Speech key', (inputs.speechKey = h('input', { type: 'password', value: s.speechKey, autocomplete: 'off' }))),
      field('Region', text('speechRegion', { placeholder: 'australiaeast' })),
      field('Language', text('language', { placeholder: 'en-AU' })),
      h('label', { class: 'field field--check' },
        (inputs.diarization = h('input', { type: 'checkbox', checked: s.diarization })),
        h('span', {}, 'Diarization (separate speakers)'),
      ),
      h('div', { class: 'dialog__actions' },
        h('button', { class: 'btn', type: 'button', onclick: () => dialog.close() }, 'Cancel'),
        h('button', { class: 'btn btn--primary', type: 'submit' }, 'Save'),
      ),
    ),
  );
  dialog.showModal();
}

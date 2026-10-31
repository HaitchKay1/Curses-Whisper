import { test, expect } from '@playwright/test';
import { Translation_WhisperService } from '../src/server/services/translation/services/whisper';
import { captureWhisperTranslation, WhisperAudio } from '../src/server/services/stt/whisper_audio';
import { WHISPER_MODELS, whisperLanguagesForModel, whisperSupportsTranslation } from '../src/server/services/stt/whisper_models';
import { Translation_State } from '../src/server/services/translation/schema';
import { TextEventType } from '../src/types';

let service: Translation_WhisperService;
let published: any[];
let errors: (string | undefined)[];
let starts: number;
const state = { whisper: { interim: false, language: "auto" } } as Translation_State;
const audio = (overrides: Partial<WhisperAudio> = {}): WhisperAudio => ({
  model: 'small', language: 'no', isFinal: true,
  translate: async () => 'Hello from Norway', isCurrent: () => true, ...overrides,
});

test.beforeEach(() => {
  published = []; errors = []; starts = 0;
  (globalThis as any).window = {
    ApiServer: { translation: { serviceState: { whisperProgress: "", whisperLastResult: "" } }, state: { services: { stt: { data: {
      backend: 'whisper', whisper: { model: 'small', language: 'no' },
    } } } } },
    ApiShared: { pubsub: { publishText: (...args: any[]) => published.push(args) } },
  };
  service = new Translation_WhisperService({
    onStart: () => starts++, onStop: e => errors.push(e),
    onTranslation: () => { throw new Error('Audio must use the translation output directly'); },
  });
});
test.afterEach(() => service.dispose());

test('routes translated audio to final translation output, ignores typed text', async () => {
  service.start(state);
  service.translate(0, { value: 'typed words', type: TextEventType.final });
  expect(published).toEqual([]);
  await captureWhisperTranslation()(audio());
  expect(starts).toBe(1);
  expect(published).toEqual([['text.translation', { value: 'Hello from Norway', type: TextEventType.final }]]);
});

test('rejects all English-only models and Turbo; accepts multilingual models', () => {
  for (const model of WHISPER_MODELS) {
    expect(whisperSupportsTranslation(model.id)).toBe(!model.english && model.id !== 'large-v3-turbo');
  }
  window.ApiServer.state.services.stt.data.whisper.model = 'large-v3-turbo';
  service.start(state);
  expect(starts).toBe(0);
  expect(errors[0]).toContain('Turbo');
  expect(whisperSupportsTranslation('missing')).toBe(false);
});

test('exposes all model-supported language tokens', () => {
  expect(whisperLanguagesForModel('small')).toHaveLength(100); // 99 + auto
  expect(whisperLanguagesForModel('large-v3')).toHaveLength(101);
  expect(whisperLanguagesForModel('small').some(l => l.value === 'yue')).toBe(false);
});

test('rejects non-Whisper input and unsupported language/model combinations', () => {
  window.ApiServer.state.services.stt.data.backend = 'azure' as any;
  service.start(state);
  expect(starts).toBe(0);
  window.ApiServer.state.services.stt.data.backend = 'whisper' as any;
  window.ApiServer.state.services.stt.data.whisper.language = 'yue';
  service.start({ ...state, whisper: { ...state.whisper, language: "yue" } });
  expect(starts).toBe(0);
  expect(errors[1]).toContain('source language');
});

test('skips interim audio by default and supports it when enabled', async () => {
  let calls = 0;
  const interim = audio({ isFinal: false, translate: async () => { calls++; return 'Hi'; } });
  service.start(state);
  await captureWhisperTranslation()(interim);
  expect(calls).toBe(0);
  service.stop();
  service.start({ ...state, whisper: { interim: true, language: "auto" } });
  await captureWhisperTranslation()(interim);
  expect(calls).toBe(1);
  expect(published[0][1].type).toBe(TextEventType.interim);
});

test('reuses an already English STT result without additional inference', async () => {
  service.start(state);
  await captureWhisperTranslation()(audio({ englishText: 'English already', translate: async () => { throw new Error('must not run'); } }));
  expect(published[0][1].value).toBe('English already');
});

test('stopping/restarting drops in-flight results and pre-start audio', async () => {
  const beforeStart = captureWhisperTranslation();
  service.start(state);
  await beforeStart(audio());
  expect(published).toEqual([]);
  let resolve!: (value: string) => void;
  const pending = captureWhisperTranslation()(audio({ translate: () => new Promise(r => { resolve = r; }) }));
  service.stop();
  service.start(state);
  resolve('stale');
  await pending;
  expect(published).toEqual([]);
});

test('drops audio that is muted/stopped, including during inference', async () => {
  service.start(state);
  let current = false;
  let calls = 0;
  await captureWhisperTranslation()(audio({ isCurrent: () => current, translate: async () => { calls++; return 'no'; } }));
  expect(calls).toBe(0);
  current = true;
  await captureWhisperTranslation()(audio({ isCurrent: () => current, translate: async () => { current = false; return 'muted'; } }));
  expect(published).toEqual([]);
});

test('reports inference errors and disconnects, without publishing source text as English', async () => {
  service.start(state);
  await captureWhisperTranslation()(audio({ translate: async () => { throw new Error('inference failed'); } }));
  expect(errors).toEqual(['inference failed']);
  await captureWhisperTranslation()(audio());
  expect(published).toEqual([]);
});

test('rejects changed incompatible model and ignores empty translations', async () => {
  service.start(state);
  await captureWhisperTranslation()(audio({ translate: async () => '  ' }));
  expect(published).toEqual([]);
  await captureWhisperTranslation()(audio({ model: 'tiny.en' }));
  expect(errors[0]).toContain('English-only');
});


test('translation auto-detects independently of an English STT source setting', async () => {
  window.ApiServer.state.services.stt.data.whisper.language = 'en';
  service.start(state);
  let requestedLanguage: string | undefined;
  await captureWhisperTranslation()(audio({ language: 'en', translate: async language => {
    requestedLanguage = language;
    return 'Good morning';
  } }));
  expect(requestedLanguage).toBe('auto');
  expect(window.ApiServer.translation.serviceState.whisperLastResult).toBe('Good morning');
});

test('explicit translation source language is passed to audio inference', async () => {
  service.start({ ...state, whisper: { ...state.whisper, language: 'no' } });
  let requestedLanguage: string | undefined;
  await captureWhisperTranslation()(audio({ translate: async language => {
    requestedLanguage = language;
    return 'Hello';
  } }));
  expect(requestedLanguage).toBe('no');
});

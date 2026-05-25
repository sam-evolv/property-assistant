/**
 * Voice input — smoke test (Sprint 5, audio input).
 *
 * Plain TypeScript, no test runner. Exercises the framework-agnostic
 * VoiceInputController and the transcribeAudioBlob helper (lib/assistant/
 * voice-input-controller.ts) with injected fakes — no DOM, no network, no React.
 *
 * Run:
 *   npx tsx apps/unified-portal/scripts/smoke/voice-input.smoke.ts
 *
 * Exit 0 = all cases pass. Exit 1 = a case failed.
 *
 * Covers:
 *   1. transcribeAudioBlob posts audio + language and returns the transcript
 *   2. transcribeAudioBlob throws on a non-2xx (e.g. 502) response
 *   3. controller: record → stop → transcript delivered via onTranscriptReady
 *   4. controller: failed transcription → status 'error', no onTranscriptReady
 *   5. controller: 2s of silence auto-stops the recording
 */

import {
  VoiceInputController,
  transcribeAudioBlob,
  SILENCE_TIMEOUT_MS,
  type MicSession,
  type RecorderHandle,
  type VoiceInputDeps,
} from '../../lib/assistant/voice-input-controller';

let failures = 0;

function check(name: string, condition: boolean, detail?: string): void {
  if (condition) {
    console.log(`  PASS  ${name}`);
  } else {
    failures += 1;
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

function audioBlob(): Blob {
  return new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'audio/webm;codecs=opus' });
}

// A fake MediaRecorder: stop() emits one data chunk then fires onstop, exactly
// like the real recorder's final flush.
function fakeRecorder(): RecorderHandle & { stopCount: number } {
  let state = 'inactive';
  const rec = {
    stopCount: 0,
    ondataavailable: null as ((event: { data: Blob }) => void) | null,
    onstop: null as (() => void) | null,
    mimeType: 'audio/webm;codecs=opus',
    get state() {
      return state;
    },
    start() {
      state = 'recording';
    },
    stop() {
      rec.stopCount += 1;
      state = 'inactive';
      rec.ondataavailable?.({ data: audioBlob() });
      rec.onstop?.();
    },
  };
  return rec;
}

function fakeSession(sampleLevel: () => number): MicSession & {
  recorder: RecorderHandle & { stopCount: number };
  released: boolean;
} {
  const recorder = fakeRecorder();
  const session = {
    recorder,
    released: false,
    sampleLevel,
    release() {
      session.released = true;
    },
  };
  return session;
}

// ── 1 + 2. transcribeAudioBlob ────────────────────────────────────────────────
async function testTranscribeHelper(): Promise<void> {
  console.log('transcribeAudioBlob');

  let captured: { url: string; body: FormData } | null = null;
  const okFetch = (async (url: string, init: RequestInit) => {
    captured = { url: String(url), body: init.body as FormData };
    return {
      ok: true,
      status: 200,
      json: async () => ({ transcript: '  Hello from the kitchen  ', provider: 'deepgram' }),
    };
  }) as unknown as typeof fetch;

  const transcript = await transcribeAudioBlob(audioBlob(), {
    languageHint: 'ga',
    fetchImpl: okFetch,
  });

  check('returns the trimmed transcript', transcript === 'Hello from the kitchen', JSON.stringify(transcript));
  check(
    'posts to the transcribe endpoint',
    captured?.url === '/api/agent/intelligence/transcribe',
    captured?.url,
  );
  check('sends the audio field as a Blob', captured?.body.get('audio') instanceof Blob);
  check('forwards the language hint', captured?.body.get('language') === 'ga', String(captured?.body.get('language')));

  // No hint → no language field (providers auto-detect).
  let noHintBody: FormData | null = null;
  const noHintFetch = (async (_url: string, init: RequestInit) => {
    noHintBody = init.body as FormData;
    return { ok: true, status: 200, json: async () => ({ transcript: 'x' }) };
  }) as unknown as typeof fetch;
  await transcribeAudioBlob(audioBlob(), { fetchImpl: noHintFetch });
  check('omits language when no hint given', noHintBody?.get('language') === null);

  // 502 → throws.
  const badFetch = (async () => ({
    ok: false,
    status: 502,
    json: async () => ({ error: 'provider down' }),
  })) as unknown as typeof fetch;
  let threw = false;
  try {
    await transcribeAudioBlob(audioBlob(), { fetchImpl: badFetch });
  } catch {
    threw = true;
  }
  check('throws on a 502 response', threw);
}

// ── 3. record → stop → transcript ──────────────────────────────────────────────
async function testHappyPath(): Promise<void> {
  console.log('controller: record → stop → transcript');

  const transcripts: string[] = [];
  const statuses: string[] = [];
  const session = fakeSession(() => 0.5); // loud enough to never silence-stop

  const deps: VoiceInputDeps = {
    requestPermission: async () => 'granted',
    openMic: async () => session,
    transcribe: async () => 'turn the heating up',
    scheduleTicks: () => () => {},
    now: () => 0,
  };

  const controller = new VoiceInputController(
    deps,
    {
      onChange: (s) => statuses.push(s.status),
      onTranscriptReady: (t) => transcripts.push(t),
    },
  );

  await controller.start();
  check('enters recording', controller.getSnapshot().status === 'recording');

  const result = await controller.stop();
  check('stop() resolves the transcript', result === 'turn the heating up', String(result));
  check('fires onTranscriptReady once', transcripts.length === 1 && transcripts[0] === 'turn the heating up');
  check('ends back at idle', controller.getSnapshot().status === 'idle');
  check('passed through a transcribing state', statuses.includes('transcribing'));
  check('released the mic session', session.released === true);
}

// ── 4. failed transcription → error, no transcript ─────────────────────────────
async function testTranscriptionFailure(): Promise<void> {
  console.log('controller: failed transcription');

  const transcripts: string[] = [];
  const session = fakeSession(() => 0.5);

  const deps: VoiceInputDeps = {
    requestPermission: async () => 'granted',
    openMic: async () => session,
    transcribe: async () => {
      throw new Error('502 from provider');
    },
    scheduleTicks: () => () => {},
    now: () => 0,
  };

  const controller = new VoiceInputController(deps, {
    onTranscriptReady: (t) => transcripts.push(t),
  });

  await controller.start();
  const result = await controller.stop();

  check('stop() resolves null on failure', result === null);
  check('status becomes error', controller.getSnapshot().status === 'error');
  check('surfaces an error message', !!controller.getSnapshot().errorMessage);
  check('does NOT fire onTranscriptReady', transcripts.length === 0);
}

// ── 5. silence auto-stop ───────────────────────────────────────────────────────
async function testSilenceAutoStop(): Promise<void> {
  console.log('controller: 2s silence auto-stops');

  let clock = 0;
  let tickCb: (() => void) | null = null;
  const transcripts: string[] = [];
  const session = fakeSession(() => 0); // permanent silence

  const deps: VoiceInputDeps = {
    requestPermission: async () => 'granted',
    openMic: async () => session,
    transcribe: async () => 'auto stopped',
    scheduleTicks: (cb) => {
      tickCb = cb;
      return () => {
        tickCb = null;
      };
    },
    now: () => clock,
  };

  const controller = new VoiceInputController(deps, {
    onTranscriptReady: (t) => transcripts.push(t),
  });

  await controller.start();
  check('recording started, tick scheduled', controller.getSnapshot().status === 'recording' && tickCb !== null);

  // Below the silence window → no stop yet.
  clock = SILENCE_TIMEOUT_MS - 500;
  tickCb?.();
  check('does not stop before the silence window elapses', session.recorder.stopCount === 0);

  // Past the silence window → auto-stop.
  clock = SILENCE_TIMEOUT_MS + 500;
  tickCb?.();
  check('auto-stops after 2s of silence', session.recorder.stopCount === 1);

  await flush();
  check('auto-stop still delivers the transcript', transcripts.length === 1 && transcripts[0] === 'auto stopped');
}

async function main(): Promise<void> {
  await testTranscribeHelper();
  await testHappyPath();
  await testTranscriptionFailure();
  await testSilenceAutoStop();

  console.log('');
  if (failures === 0) {
    console.log('All voice-input smoke cases passed.');
    process.exit(0);
  } else {
    console.log(`${failures} voice-input smoke case(s) failed.`);
    process.exit(1);
  }
}

void main();

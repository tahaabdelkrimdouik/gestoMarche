'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { resolveVoiceSearch, uniqueTranscripts } from '@/lib/search';

export type VoiceSearchStatus =
  | 'idle'
  | 'requesting-permission'
  | 'listening'
  | 'processing'
  | 'error';

export type VoiceSearchErrorKind =
  | 'unsupported'
  | 'insecure'
  | 'permission'
  | 'silence'
  | 'unintelligible'
  | 'network'
  | 'microphone'
  | 'busy'
  | 'generic';

interface SpeechRecognitionAlternativeLike {
  transcript: string;
  confidence?: number;
}

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  length: number;
  [index: number]: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionEventLike {
  results: {
    length: number;
    [index: number]: SpeechRecognitionResultLike;
  };
}

interface SpeechRecognitionInstance {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

const NO_SPEECH_MS = 8000;
const SILENCE_AFTER_SPEECH_MS = 700;
const MAX_LISTEN_MS = 15000;
const PERMISSION_MS = 10000;

export const VOICE_ERROR_MESSAGES: Record<VoiceSearchErrorKind, string> = {
  unsupported: 'La recherche vocale n’est pas disponible sur ce navigateur. Essayez Chrome ou Safari.',
  insecure: 'La recherche vocale nécessite une connexion sécurisée (HTTPS).',
  permission: 'Autorisez le microphone dans les réglages du navigateur pour dicter un produit.',
  silence: 'Je n’ai pas bien compris. Réessayez.',
  unintelligible: 'Je n’ai pas bien compris. Réessayez.',
  network: 'La reconnaissance vocale a besoin d’une connexion internet. Vérifiez le réseau et réessayez.',
  microphone: 'Impossible d’accéder au microphone. Vérifiez qu’aucun autre onglet ne l’utilise.',
  busy: 'Patientez un instant avant de relancer le microphone.',
  generic: 'La recherche vocale n’a pas fonctionné. Réessayez.',
};

let microphoneReady = false;

function getSpeechRecognitionConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') return null;
  const speechWindow = window as Window & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition || null;
}

function isIOSDevice() {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/i.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function getSpeechRecognitionLang() {
  if (typeof document === 'undefined') return 'fr-FR';
  const lang = (document.documentElement.lang || 'fr').toLowerCase();
  if (lang.startsWith('fr')) return 'fr-FR';
  return lang;
}

function mapEngineError(error: string): VoiceSearchErrorKind {
  switch (error) {
    case 'not-allowed':
    case 'service-not-allowed':
      return 'permission';
    case 'no-speech':
      return 'silence';
    case 'network':
      return 'network';
    case 'audio-capture':
      return 'microphone';
    default:
      return 'generic';
  }
}

async function hasGrantedMicrophone() {
  try {
    const status = await navigator.permissions?.query({ name: 'microphone' as PermissionName });
    return status?.state === 'granted';
  } catch {
    return false;
  }
}

async function ensureMicrophoneAccess() {
  if (microphoneReady || await hasGrantedMicrophone()) {
    microphoneReady = true;
    return;
  }

  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    throw new DOMException('Permission denied', 'NotAllowedError');
  }

  const stream = await Promise.race([
    navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
      },
    }),
    new Promise<MediaStream>((_, reject) => {
      window.setTimeout(() => {
        reject(new DOMException('Permission timed out', 'NotAllowedError'));
      }, PERMISSION_MS);
    }),
  ]);

  stream.getTracks().forEach((track) => track.stop());
  microphoneReady = true;
}

export interface UseVoiceSearchOptions {
  productNames?: string[];
  onSearch: (query: string) => void;
}

export function useVoiceSearch({ productNames = [], onSearch }: UseVoiceSearchOptions) {
  const [status, setStatus] = useState<VoiceSearchStatus>('idle');
  const [liveTranscript, setLiveTranscript] = useState('');
  const [errorKind, setErrorKind] = useState<VoiceSearchErrorKind | null>(null);

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const sessionRef = useRef(0);
  const startingRef = useRef(false);
  const stopRequestedRef = useRef(false);
  const settledRef = useRef(false);
  const iosRef = useRef(false);
  const transcriptRef = useRef('');
  const alternativesRef = useRef<string[]>([]);
  const confidenceRef = useRef<number | null>(null);
  const silenceTimerRef = useRef<number | null>(null);
  const noSpeechTimerRef = useRef<number | null>(null);
  const maxTimerRef = useRef<number | null>(null);
  const startWatchRef = useRef<number | null>(null);
  const productNamesRef = useRef(productNames);
  const onSearchRef = useRef(onSearch);
  const finishRef = useRef<(raw: string, alts: string[], conf: number | null) => void>(() => {});
  const stopRef = useRef<() => void>(() => {});

  useEffect(() => {
    productNamesRef.current = productNames;
  }, [productNames]);

  useEffect(() => {
    onSearchRef.current = onSearch;
  }, [onSearch]);

  const isSupported = typeof window !== 'undefined' && !!getSpeechRecognitionConstructor();

  const clearTimers = useCallback(() => {
    if (silenceTimerRef.current) window.clearTimeout(silenceTimerRef.current);
    if (noSpeechTimerRef.current) window.clearTimeout(noSpeechTimerRef.current);
    if (maxTimerRef.current) window.clearTimeout(maxTimerRef.current);
    if (startWatchRef.current) window.clearTimeout(startWatchRef.current);
    silenceTimerRef.current = null;
    noSpeechTimerRef.current = null;
    maxTimerRef.current = null;
    startWatchRef.current = null;
  }, []);

  const abortEngine = useCallback(() => {
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    if (!recognition) return;
    recognition.onstart = null;
    recognition.onresult = null;
    recognition.onerror = null;
    recognition.onend = null;
    try {
      recognition.abort();
    } catch {
      // Already stopped.
    }
  }, []);

  const resetSessionState = useCallback(() => {
    transcriptRef.current = '';
    alternativesRef.current = [];
    confidenceRef.current = null;
    setLiveTranscript('');
    setErrorKind(null);
  }, []);

  const close = useCallback(() => {
    sessionRef.current += 1;
    startingRef.current = false;
    stopRequestedRef.current = false;
    settledRef.current = true;
    clearTimers();
    abortEngine();
    resetSessionState();
    setStatus('idle');
  }, [abortEngine, clearTimers, resetSessionState]);

  const finishWithTranscript = useCallback((rawTranscript: string, alts: string[], conf: number | null) => {
    if (settledRef.current) return;
    settledRef.current = true;
    clearTimers();

    const decision = resolveVoiceSearch(
      uniqueTranscripts([rawTranscript, ...alts]),
      productNamesRef.current,
      conf
    );

    if (decision.action === 'clarify') {
      setErrorKind(decision.reason === 'empty' ? 'silence' : 'unintelligible');
      setStatus('error');
      return;
    }

    onSearchRef.current(decision.query);
    close();
  }, [clearTimers, close]);

  useEffect(() => {
    finishRef.current = finishWithTranscript;
  }, [finishWithTranscript]);

  const stopEngine = useCallback(() => {
    stopRequestedRef.current = true;
    clearTimers();
    const recognition = recognitionRef.current;
    if (!recognition) {
      if (transcriptRef.current) {
        finishRef.current(transcriptRef.current, alternativesRef.current, confidenceRef.current);
      } else {
        close();
      }
      return;
    }
    setStatus((current) => (current === 'listening' || current === 'requesting-permission' ? 'processing' : current));
    try {
      recognition.stop();
    } catch {
      finishRef.current(transcriptRef.current, alternativesRef.current, confidenceRef.current);
    }
  }, [clearTimers, close]);

  useEffect(() => {
    stopRef.current = stopEngine;
  }, [stopEngine]);

  const fail = useCallback((kind: VoiceSearchErrorKind) => {
    if (settledRef.current) return;
    settledRef.current = true;
    startingRef.current = false;
    clearTimers();
    abortEngine();
    setErrorKind(kind);
    setStatus('error');
  }, [abortEngine, clearTimers]);

  const start = useCallback(async () => {
    if (startingRef.current) return;
    startingRef.current = true;

    sessionRef.current += 1;
    const session = sessionRef.current;
    stopRequestedRef.current = false;
    settledRef.current = false;
    iosRef.current = isIOSDevice();
    clearTimers();
    abortEngine();
    resetSessionState();

    if (typeof window !== 'undefined' && !window.isSecureContext) {
      fail('insecure');
      return;
    }

    const SpeechRecognition = getSpeechRecognitionConstructor();
    if (!SpeechRecognition) {
      fail('unsupported');
      return;
    }

    if (!microphoneReady) {
      setStatus('requesting-permission');
      try {
        await ensureMicrophoneAccess();
      } catch (error) {
        if (session !== sessionRef.current) return;
        const name = error instanceof DOMException ? error.name : '';
        fail(name === 'NotFoundError' || name === 'NotReadableError' ? 'microphone' : 'permission');
        return;
      }
    }

    if (session !== sessionRef.current) return;

    const recognition = new SpeechRecognition();
    recognition.lang = getSpeechRecognitionLang();
    recognition.continuous = !iosRef.current;
    recognition.interimResults = true;
    recognition.maxAlternatives = 3;
    recognitionRef.current = recognition;

    startWatchRef.current = window.setTimeout(() => {
      if (session !== sessionRef.current) return;
      if (startingRef.current && recognitionRef.current) {
        startingRef.current = false;
        setStatus('listening');
      }
    }, 1500);

    recognition.onstart = () => {
      if (session !== sessionRef.current) return;
      if (startWatchRef.current) {
        window.clearTimeout(startWatchRef.current);
        startWatchRef.current = null;
      }
      startingRef.current = false;
      setStatus('listening');
      noSpeechTimerRef.current = window.setTimeout(() => {
        if (session !== sessionRef.current) return;
        if (!transcriptRef.current) stopRef.current();
      }, NO_SPEECH_MS);
      maxTimerRef.current = window.setTimeout(() => {
        if (session !== sessionRef.current) return;
        stopRef.current();
      }, MAX_LISTEN_MS);
    };

    recognition.onresult = (event) => {
      if (session !== sessionRef.current) return;

      let finalText = '';
      let interimText = '';
      const altSet: string[] = [];
      let bestConfidence: number | null = null;

      for (let i = 0; i < event.results.length; i += 1) {
        const result = event.results[i];
        const first = result[0];
        if (!first) continue;
        if (result.isFinal) {
          finalText += `${first.transcript} `;
          if (typeof first.confidence === 'number' && first.confidence > 0) {
            bestConfidence = bestConfidence == null
              ? first.confidence
              : Math.min(bestConfidence, first.confidence);
          }
          for (let a = 0; a < result.length; a += 1) {
            if (result[a]?.transcript) altSet.push(result[a].transcript);
          }
        } else {
          interimText += `${first.transcript} `;
        }
      }

      const combined = `${finalText}${interimText}`.trim();
      if (combined) {
        transcriptRef.current = combined;
        alternativesRef.current = altSet;
        confidenceRef.current = bestConfidence;
        setLiveTranscript(combined);
      }

      if (silenceTimerRef.current) window.clearTimeout(silenceTimerRef.current);
      if (!combined) return;

      if (noSpeechTimerRef.current) {
        window.clearTimeout(noSpeechTimerRef.current);
        noSpeechTimerRef.current = null;
      }

      const utteranceComplete = Boolean(finalText.trim()) && !interimText.trim();
      if (utteranceComplete && iosRef.current) {
        stopRef.current();
        return;
      }

      silenceTimerRef.current = window.setTimeout(() => {
        if (session !== sessionRef.current) return;
        stopRef.current();
      }, SILENCE_AFTER_SPEECH_MS);
    };

    recognition.onerror = (event) => {
      if (session !== sessionRef.current) return;
      if (event.error === 'aborted') return;
      if (event.error === 'no-speech' && transcriptRef.current) return;
      fail(mapEngineError(event.error));
    };

    recognition.onend = () => {
      if (session !== sessionRef.current) return;
      startingRef.current = false;
      recognitionRef.current = null;
      if (settledRef.current) return;
      finishRef.current(transcriptRef.current, alternativesRef.current, confidenceRef.current);
    };

    try {
      recognition.start();
    } catch {
      fail('busy');
    }
  }, [abortEngine, clearTimers, fail, resetSessionState]);

  const retry = useCallback(() => {
    void start();
  }, [start]);

  const toggle = useCallback(() => {
    if (status === 'listening' || status === 'requesting-permission' || status === 'processing') {
      stopEngine();
      return;
    }
    void start();
  }, [start, status, stopEngine]);

  useEffect(() => {
    return () => {
      sessionRef.current += 1;
      clearTimers();
      abortEngine();
    };
  }, [abortEngine, clearTimers]);

  return {
    status,
    isOpen: status !== 'idle',
    isSupported,
    liveTranscript,
    errorKind,
    errorMessage: errorKind ? VOICE_ERROR_MESSAGES[errorKind] : null,
    start,
    stop: stopEngine,
    retry,
    cancel: close,
    toggle,
  };
}

export type VoiceSearchController = ReturnType<typeof useVoiceSearch>;

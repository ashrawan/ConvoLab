/**
 * Browser STT Provider
 * Uses Web Speech Recognition API
 */

import { STTProvider, STTOptions } from '../types';
import { getSpeechLang } from '../tts/utils';

export class BrowserSTTProvider implements STTProvider {
    name = 'browser';
    private recognition: any = null;
    private _isListening = false;
    private _shouldListen = false; // Track intent

    isAvailable(): boolean {
        return typeof window !== 'undefined' &&
            ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);
    }

    isListening(): boolean {
        return this._isListening;
    }

    async startListening(lang: string, options: STTOptions): Promise<void> {
        if (!this.isAvailable()) {
            const error = new Error('Speech recognition not supported in this browser');
            if (options.onError) options.onError(error);
            throw error;
        }

        // Update intent
        this._shouldListen = true;

        if (this._isListening) {
            console.warn('⚠️ Already listening');
            return;
        }

        console.log(`🎤 Browser STT: Starting (${lang})`);

        // @ts-ignore
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        this.recognition = new SpeechRecognition();
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.recognition.lang = getSpeechLang(lang);

        this.recognition.onresult = (event: any) => {
            let transcript = '';
            let isFinal = false;

            for (let i = event.resultIndex; i < event.results.length; i++) {
                transcript += event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    isFinal = true;
                }
            }

            if (transcript) {
                options.onTranscript(transcript, isFinal);
            }
        };

        this.recognition.onerror = (event: any) => {
            if (event.error === 'no-speech' || event.error === 'aborted') {
                return; // Ignore common non-critical errors
            }
            console.error('🔴 Speech recognition error:', event.error);

            // STOP LOOP: Persistent permission errors
            if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
                this._shouldListen = false;
                console.error('🛑 Speech recognition permission denied. Stopping auto-restart.');
            }

            if (options.onError) {
                options.onError(new Error(event.error));
            }
        };

        this.recognition.onend = () => {
            console.log('⏹️ Speech recognition ended');
            this._isListening = false;

            // Restart ONLY if allowed and intentional
            if (this._shouldListen) {
                console.log('🔄 Auto-restarting speech recognition in 100ms...');
                setTimeout(() => {
                    if (!this._shouldListen) return; // double check

                    try {
                        this.recognition.start();
                        this._isListening = true;
                    } catch (e) {
                        console.error('Failed to restart recognition:', e);
                        // Do not disable _shouldListen here, retry one more time? 
                        // Or just let it fail if it's a hard error. 
                        // For now, let's just log. If it fails hard, onerror should catch it.
                    }
                }, 100);
            }
        };

        try {
            this.recognition.start();
            this._isListening = true;
            console.log('▶️ Speech recognition started');
        } catch (e) {
            this._shouldListen = false;
            throw e;
        }
    }

    stopListening(): void {
        this._shouldListen = false; // Stop intent

        if (this.recognition) {
            console.log('⏹️ Stopping speech recognition');
            this.recognition.stop();
            // _isListening will be set to false in onend
        }
    }
}

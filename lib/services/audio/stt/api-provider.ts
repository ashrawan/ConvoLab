/**
 * API STT Provider
 * Calls backend STT API (backend chooses AI model like Whisper)
 */

import { STTProvider, STTOptions } from '../types';
import { getSpeechLang } from '../tts/utils';

import { API_BASE_URL } from '@/lib/config/api';

export class APISTTProvider implements STTProvider {
    name = 'api';
    private mediaRecorder: MediaRecorder | null = null;
    private audioChunks: Blob[] = [];
    private _isListening = false;
    private currentOptions: STTOptions | null = null;
    private currentLang: string = 'en-US';

    isAvailable(): boolean {
        return typeof window !== 'undefined' &&
            'MediaRecorder' in window &&
            'navigator' in window &&
            'mediaDevices' in navigator;
    }

    isListening(): boolean {
        return this._isListening;
    }

    async startListening(lang: string, options: STTOptions): Promise<void> {
        if (!this.isAvailable()) {
            const error = new Error('Media recording not supported in this browser');
            if (options.onError) options.onError(error);
            throw error;
        }

        if (this._isListening) {
            console.warn('⚠️ Already listening');
            return;
        }

        console.log(`🎤 API STT: Starting (${lang})`);

        this.currentOptions = options;
        this.currentLang = getSpeechLang(lang);
        this.audioChunks = [];

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

            this.mediaRecorder = new MediaRecorder(stream);

            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.audioChunks.push(event.data);
                }
            };

            this.mediaRecorder.onstop = async () => {
                console.log('🎤 Recording stopped, sending to API...');
                await this.sendAudioToAPI();
            };

            this.mediaRecorder.onerror = (event: any) => {
                console.error('🔴 MediaRecorder error:', event.error);
                this._isListening = false;
                if (options.onError) {
                    options.onError(new Error(event.error));
                }
            };

            // Record in chunks (e.g., every 3 seconds)
            this.mediaRecorder.start(3000);
            this._isListening = true;
            console.log('▶️ API recording started');

        } catch (error) {
            console.error('❌ Failed to start recording:', error);
            throw error;
        }
    }

    stopListening(): void {
        if (this.mediaRecorder && this._isListening) {
            console.log('⏹️ Stopping API recording');
            this._isListening = false;
            this.mediaRecorder.stop();

            // Stop all tracks
            this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
            this.mediaRecorder = null;
        }
    }

    private async sendAudioToAPI(): Promise<void> {
        if (this.audioChunks.length === 0 || !this.currentOptions) {
            return;
        }

        try {
            const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
            this.audioChunks = [];

            const formData = new FormData();
            formData.append('audio', audioBlob);
            formData.append('language', this.currentLang);

            const provider = localStorage.getItem('active_provider_stt') || 'openai';
            let apiKey = '';

            if (provider === 'deepgram') {
                apiKey = localStorage.getItem('key_deepgram') || '';
            } else {
                // OpenAI
                apiKey = localStorage.getItem('key_openai_audio') || localStorage.getItem('key_openai') || localStorage.getItem('user_openai_api_key') || '';
            }

            const response = await fetch(`${API_BASE_URL}/api/audio/stt`, {
                method: 'POST',
                headers: {
                    'ngrok-skip-browser-warning': 'true',
                    'x-provider': provider,
                    'x-api-key': apiKey
                },
                body: formData
            });

            if (!response.ok) {
                throw new Error(`STT API error: ${response.statusText}`);
            }

            const data = await response.json();

            if (data.text) {
                this.currentOptions.onTranscript(data.text, true);
            }

        } catch (error) {
            console.error('❌ API STT error:', error);
            if (this.currentOptions?.onError) {
                this.currentOptions.onError(error as Error);
            }
        }
    }
}

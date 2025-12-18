import { sendGAEvent } from '@next/third-parties/google';

type EventType =
    | 'conversation_spark'
    | 'context_submitted'
    | 'message_sent'
    | 'suggestion_selected';

interface AnalyticsEvent {
    action: EventType;
    params?: Record<string, string | number | boolean>;
}

export const sendEvent = ({ action, params }: AnalyticsEvent) => {
    // 1. Log to console in Development
    if (process.env.NODE_ENV === 'development') {
        console.log(`[Analytics] Event: ${action}`, params);
        return;
    }

    // 2. Send to Google Analytics in Production
    if (process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID) {
        sendGAEvent('event', action, params || {});
    }
};

import { useEffect, useRef } from 'react';

interface TurnstileWidgetProps {
  siteKey: string;
  onToken: (token: string | undefined) => void;
  resetCounter?: number;
}

export function TurnstileWidget({ siteKey, onToken, resetCounter = 0 }: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | undefined>(undefined);
  const onTokenRef = useRef(onToken);

  useEffect(() => {
    onTokenRef.current = onToken;
  }, [onToken]);

  useEffect(() => {
    if (!siteKey || !containerRef.current) return;
    let cancelled = false;

    const renderWidget = () => {
      if (cancelled || !containerRef.current || !window.turnstile || widgetIdRef.current) return;
      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        callback: (token) => onTokenRef.current(token),
        'expired-callback': () => onTokenRef.current(undefined),
        'error-callback': () => onTokenRef.current(undefined),
      });
    };

    if (window.turnstile) {
      renderWidget();
    } else {
      const existing = document.querySelector<HTMLScriptElement>(
        'script[src^="https://challenges.cloudflare.com/turnstile/v0/api.js"]',
      );
      if (existing) {
        existing.addEventListener('load', renderWidget, { once: true });
      } else {
        const script = document.createElement('script');
        script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
        script.async = true;
        script.defer = true;
        script.addEventListener('load', renderWidget, { once: true });
        document.head.appendChild(script);
      }
    }

    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = undefined;
      }
    };
  }, [siteKey]);

  useEffect(() => {
    if (resetCounter > 0 && widgetIdRef.current && window.turnstile) {
      window.turnstile.reset(widgetIdRef.current);
      onTokenRef.current(undefined);
    }
  }, [resetCounter]);

  return <div ref={containerRef} />;
}

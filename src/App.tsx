import { useState, useEffect, useMemo } from 'react';
import pcHtml from '../pc.html?raw';
import mobileHtml from '../mobile.html?raw';

declare global {
  interface Window {
    __BOOKING_WEBHOOK_URL__?: string;
    __BOOKING_WEBHOOK_TEST_URL__?: string;
  }
}

const WEBHOOK_PROD_URL =
  (import.meta.env.VITE_BOOKING_WEBHOOK_URL as string) ||
  'https://foamy-foxhound.pikapod.net/webhook/galaxy-booking';
const WEBHOOK_TEST_URL =
  (import.meta.env.VITE_BOOKING_WEBHOOK_TEST_URL as string) ||
  'https://foamy-foxhound.pikapod.net/webhook-test/galaxy-booking';

if (typeof window !== 'undefined') {
  window.__BOOKING_WEBHOOK_URL__ = WEBHOOK_PROD_URL;
  window.__BOOKING_WEBHOOK_TEST_URL__ = WEBHOOK_TEST_URL;
}

function parseTemplate(htmlString: string) {
  const styleMatch = htmlString.match(/<style>([\s\S]*?)<\/style>/i);
  const style = styleMatch ? styleMatch[1].trim() : '';

  const scriptMatches = Array.from(htmlString.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi));
  const scripts = scriptMatches.map((m) => m[1].trim());

  const bodyMatch = htmlString.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  let body = bodyMatch ? bodyMatch[1] : htmlString;
  body = body.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '').trim();

  return { style, body, scripts };
}

export default function App() {
  const pcData = useMemo(() => parseTemplate(pcHtml), []);
  const mobileData = useMemo(() => parseTemplate(mobileHtml), []);

  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth <= 768;
    }
    return false;
  });

  // Listen to viewport changes when toggled in the AI Studio preview bar (Current screen size vs Mobile vs Tablet)
  useEffect(() => {
    const checkSize = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    checkSize();
    window.addEventListener('resize', checkSize);

    const mql = window.matchMedia('(max-width: 768px)');
    const handleMql = (e: MediaQueryListEvent) => {
      setIsMobile(e.matches);
    };
    mql.addEventListener('change', handleMql);

    return () => {
      window.removeEventListener('resize', checkSize);
      mql.removeEventListener('change', handleMql);
    };
  }, []);

  const activeData = isMobile ? mobileData : pcData;

  // Update native stylesheet and run scripts directly in document (NO IFRAME)
  useEffect(() => {
    let styleTag = document.getElementById('native-view-style') as HTMLStyleElement | null;
    if (!styleTag) {
      styleTag = document.createElement('style');
      styleTag.id = 'native-view-style';
      document.head.appendChild(styleTag);
    }
    styleTag.textContent = activeData.style;

    // Small delay to ensure DOM is fully painted before attaching listeners and observers
    const timer = setTimeout(() => {
      activeData.scripts.forEach((scriptCode) => {
        try {
          const runScript = new Function(scriptCode);
          runScript();
        } catch (err) {
          console.error('Error executing template script:', err);
        }
      });
    }, 20);

    return () => {
      clearTimeout(timer);
    };
  }, [isMobile, activeData]);

  // Render elements directly into top-level DOM so the AI Studio Edit tool can pick any element
  return (
    <div
      id="app-content-root"
      key={isMobile ? 'mobile-dom-view' : 'pc-dom-view'}
      className="w-full min-h-screen"
      dangerouslySetInnerHTML={{ __html: activeData.body }}
    />
  );
}

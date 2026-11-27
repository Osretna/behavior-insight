import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

const rootEl = document.getElementById('root');

function renderFatalFallback(message: string) {
  if (!rootEl) return;
  rootEl.innerHTML = '';
  const wrapper = document.createElement('div');
  wrapper.dir = 'rtl';
  wrapper.style.cssText =
    'min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;background:#071120;color:#f1f5f9;font-family:system-ui,sans-serif;';
  const card = document.createElement('div');
  card.style.cssText =
    'max-width:440px;width:100%;padding:24px;border-radius:16px;background:#0d192d;border:1px solid rgba(255,255,255,0.12);text-align:center;';
  const title = document.createElement('h2');
  title.textContent = 'تعذر تحميل التطبيق';
  title.style.cssText = 'margin:0 0 10px 0;font-size:18px;font-weight:700;';
  const body = document.createElement('p');
  body.textContent = message;
  body.style.cssText = 'margin:0 0 16px 0;font-size:13px;color:#cbd5e1;line-height:1.6;';
  const btn = document.createElement('button');
  btn.textContent = 'إعادة المحاولة';
  btn.style.cssText =
    'padding:10px 20px;border-radius:10px;border:none;background:#059669;color:#fff;font-weight:700;cursor:pointer;';
  btn.onclick = () => window.location.reload();
  card.appendChild(title);
  card.appendChild(body);
  card.appendChild(btn);
  wrapper.appendChild(card);
  rootEl.appendChild(wrapper);
}

window.addEventListener('error', (event) => {
  if (rootEl && rootEl.childElementCount === 0) {
    renderFatalFallback(event.message || 'حدث خطأ غير متوقع أثناء تشغيل التطبيق.');
  }
});

window.addEventListener('unhandledrejection', (event) => {
  if (rootEl && rootEl.childElementCount === 0) {
    const reason = event.reason instanceof Error ? event.reason.message : String(event.reason || '');
    renderFatalFallback(reason || 'حدث خطأ أثناء تهيئة الاتصال.');
  }
});

if (rootEl) {
  try {
    createRoot(rootEl).render(<App />);
  } catch (err) {
    renderFatalFallback(err instanceof Error ? err.message : 'تعذر بدء واجهة التطبيق.');
  }
}

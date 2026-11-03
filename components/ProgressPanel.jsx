'use client';
import { useEffect, useRef, useState } from 'react';

/**
 * Шкала обработки: заполняется слева направо, сверху — проценты.
 * value — реальный прогресс 0..1 (может отставать, например пока идёт серверная конвертация).
 * Пока новых данных нет, шкала медленно «доползает» не дальше value + 18 %, чтобы не стоять на месте,
 * но и не обещать лишнего.
 */
export default function ProgressPanel({ title = 'Обрабатываю…', value = 0, text = '' }) {
  const [shown, setShown] = useState(0);
  const target = useRef(0);
  target.current = Math.max(0, Math.min(1, value));

  useEffect(() => {
    const id = setInterval(() => {
      setShown((s) => {
        const t = target.current;
        if (s < t) return Math.min(t, s + Math.max(0.01, (t - s) * 0.3)); // догоняем реальное значение
        const cap = t >= 1 ? 1 : Math.min(0.97, t + 0.18);
        return s < cap ? Math.min(cap, s + Math.max(0.0008, (cap - s) * 0.012)) : s; // медленное «доползание»
      });
    }, 120);
    return () => clearInterval(id);
  }, []);

  const pct = Math.min(100, Math.floor(shown * 100));
  return (
    <div className="panel center pp" role="status" aria-live="polite">
      <h2>{title}</h2>
      <div className="pp__pct">{pct}%</div>
      <div className="pbar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
        <div className="pbar__fill" style={{ width: `${pct}%` }} />
      </div>
      {text && <p className="muted pp__text">{text}</p>}
    </div>
  );
}

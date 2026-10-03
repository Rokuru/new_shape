import { useEffect, useState } from 'react';

/** Arrondit et borne une saisie : jamais de valeur négative, NaN ou démesurée. */
export function parseBounded(text: string, max: number, decimals: number): number {
  const n = Number(text.replace(',', '.'));
  if (!Number.isFinite(n) || n <= 0) return 0;
  const f = 10 ** decimals;
  return Math.min(max, Math.round(n * f) / f);
}

const show = (n: number) => (n ? String(n).replace('.', ',') : '');

/**
 * Champ numérique qui garde le texte tapé (« 72, » le temps de taper « 72,5 ») et ne remonte
 * que la valeur bornée. Sans ça, la virgule disparaissait à chaque frappe.
 */
export default function NumField({
  value,
  onChange,
  max,
  decimals,
  ...rest
}: { value: number; onChange: (n: number) => void; max: number; decimals: number } & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>) {
  const [text, setText] = useState(show(value));
  // Valeur changée ailleurs (série recopiée, suggestion appliquée) : on resynchronise le texte.
  useEffect(() => {
    setText((t) => (parseBounded(t, max, decimals) === value ? t : show(value)));
  }, [value, max, decimals]);
  return (
    <input
      inputMode={decimals ? 'decimal' : 'numeric'}
      placeholder="0"
      {...rest}
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        onChange(parseBounded(e.target.value, max, decimals));
      }}
      onBlur={() => setText(show(value))}
    />
  );
}

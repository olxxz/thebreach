/**
 * Marca do compêndio: o Selo do Sopro. Um selo de Thalae de três anéis,
 * desenhado num traço só a partir do ponto de origem — a criação lida do
 * centro para fora. O traço afina a cada anel, como o fôlego que se esgota;
 * o ponto de origem é o ouro da iluminura.
 */
export function Sigil({ size = 22 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="1.3" fill="var(--gold, currentColor)" stroke="none" />
      <path d="M12 12V8.2a3.8 3.8 0 1 1-3.6 5" strokeWidth="1.9" />
      <path d="M8.4 13.2l-2.8.9a6.8 6.8 0 1 1 12 2.3" strokeWidth="1.5" />
      <path d="M17.6 16.4l2.3 1.5a9.6 9.6 0 0 1-15.1.5" strokeWidth="1.1" />
      <circle cx="4.8" cy="18.4" r=".9" strokeWidth="1" />
    </svg>
  );
}

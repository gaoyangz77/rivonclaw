export function BrandLogo({ compact = false }: { compact?: boolean }) {
  return (
    <a className={`brand-logo${compact ? " compact" : ""}`} href="https://www.tkcopilot.com/">
      <img src="/assets/LOGO_EN.png?v=2" alt="TK Copilot" />
    </a>
  );
}

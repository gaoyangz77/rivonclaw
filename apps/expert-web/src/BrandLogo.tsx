export function BrandLogo({ compact = false }: { compact?: boolean }) {
  return (
    <a className={`brand-logo${compact ? " compact" : ""}`} href="https://www.tkcopilot.com/">
      <img src="/assets/tk-copilot-logo.png" alt="TK Copilot" />
    </a>
  );
}

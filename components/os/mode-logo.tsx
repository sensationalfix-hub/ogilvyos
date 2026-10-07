type ModeLogoProps = {
  mode: "work" | "life";
  href: string;
};

export function ModeLogo({ mode, href }: ModeLogoProps) {
  const isWork = mode === "work";

  return (
    <a
      href={href}
      className={"brand-mode-control " + (isWork ? "is-work" : "is-life")}
      aria-label={isWork ? "Cambiar de WorkOS a LifeOS" : "Cambiar de LifeOS a WorkOS"}
      title={isWork ? "Cambiar a LifeOS" : "Cambiar a WorkOS"}
    >
      <span className="brand-mode-wordmark">
        {isWork
          ? <img src="/workos.svg" alt="WorkOS" className="brand-logo" />
          : <span className="life-wordmark">LIFE<sup>OS</sup></span>}
      </span>
      <svg className="brand-mode-switch" viewBox="0 0 104 30" role="img" aria-hidden="true">
        <rect x="1" y="1" width="102" height="28" rx="14" className="brand-mode-track" />
        <text x="17" y="19" className="brand-mode-label">W</text>
        <text x="80" y="19" className="brand-mode-label">L</text>
        <circle cx={isWork ? 37 : 67} cy="15" r="11" className="brand-mode-knob" />
      </svg>
    </a>
  );
}

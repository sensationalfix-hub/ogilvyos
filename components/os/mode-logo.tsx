type AppLogoProps = { mode: "work" | "life" };

// App identity is intentionally static. Navigation now lives in the sidebar.
export function ModeLogo({ mode }: AppLogoProps) {
  return (
    <span className="brand-app-logo" aria-label={mode === "work" ? "WorkOS" : "LifeOS"}>
      {mode === "work"
        ? <img src="/workos.svg" alt="WorkOS" className="brand-logo" />
        : <span className="life-wordmark">LIFE<sup>OS</sup></span>}
    </span>
  );
}

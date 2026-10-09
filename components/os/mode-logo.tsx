type AppLogoProps = { mode: "work" | "life" };

// A static brand mark. Cross-app navigation is kept in each application's sidebar.
export function ModeLogo({ mode }: AppLogoProps) {
  const name=mode==="work"?"Work":"Life";
  return <span className="brand-app-logo"><img
    src={"/app-logos/"+mode+".svg"}
    alt={name+" OS"}
    className="brand-logo brand-app-artwork"
    draggable={false}
  /></span>;
}

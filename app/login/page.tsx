type LoginProps = {
  searchParams: Promise<{ error?: string; setup?: string }>;
};

export default async function LoginPage({ searchParams }: LoginProps) {
  const params = await searchParams;
  const error = params.error === "1";
  const setup = params.setup === "1";

  return (
    <main className="workos-login-shell">
      <section className="workos-login-card">
        <div className="workos-login-mark">W</div>
        <span>ACCESO PRIVADO</span>
        <h1>WorkOS</h1>
        <p>El cockpit está cerrado. Como debe estarlo si desde aquí se puede escribir en Notion.</p>
        <form action="/api/auth/login" method="post">
          <label htmlFor="password">Contraseña</label>
          <input id="password" name="password" type="password" autoComplete="current-password" required autoFocus />
          <button type="submit">Entrar</button>
        </form>
        {error ? <small className="workos-login-error">Contraseña incorrecta.</small> : null}
        {setup ? <small className="workos-login-error">Falta configurar la contraseña privada de WorkOS en el servidor.</small> : null}
      </section>
    </main>
  );
}

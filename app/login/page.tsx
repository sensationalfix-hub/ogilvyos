type LoginProps = {
  searchParams: Promise<{ error?: string; setup?: string; confirmed?: string }>;
};

export default async function LoginPage({ searchParams }: LoginProps) {
  const params = await searchParams;
  const error = params.error === "1";
  const setup = params.setup === "1";
  const confirmed = params.confirmed === "1";

  return (
    <main className="workos-login-shell">
      <section className="workos-login-card">
        <div className="workos-login-mark">W</div>
        <span>ACCESO PRIVADO</span>
        <h1>WorkOS</h1>
        <p>Tu acceso determina qué puedes ver y qué puedes tocar. Milagrosamente, una contraseña ya no tiene que fingir que es un sistema de permisos.</p>
        <form action="/api/auth/login" method="post">
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" autoComplete="email" placeholder="nombre@correo.com" />
          <label htmlFor="password">Contraseña</label>
          <input id="password" name="password" type="password" autoComplete="current-password" required autoFocus />
          <button type="submit">Entrar</button>
        </form>
        {error ? <small className="workos-login-error">Email o contraseña incorrectos.</small> : null}
        {setup ? <small className="workos-login-error">El acceso todavía no está configurado en el servidor.</small> : null}
        {confirmed ? <small className="workos-login-success">Cuenta confirmada. Ya puedes entrar.</small> : null}
        <a className="workos-login-link" href="/register">Crear mi acceso</a>
      </section>
    </main>
  );
}

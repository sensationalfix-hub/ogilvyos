type RegisterProps = {
  searchParams: Promise<{ error?: string; message?: string; sent?: string }>;
};

const errors: Record<string, string> = {
  missing: "Completa email y contraseña.",
  weak: "Usa una contraseña de al menos 10 caracteres.",
  mismatch: "Las contraseñas no coinciden.",
  signup: "No se pudo crear el acceso.",
};

export default async function RegisterPage({ searchParams }: RegisterProps) {
  const params = await searchParams;
  const sent = params.sent === "1";
  const error = params.error ? (errors[params.error] || "No se pudo crear el acceso.") : null;

  return (
    <main className="workos-login-shell">
      <section className="workos-login-card workos-register-card">
        <div className="workos-login-mark">W</div>
        <span>PRIMER ACCESO</span>
        <h1>Crear acceso</h1>

        {sent ? (
          <>
            <p>Te hemos enviado un correo para confirmar tu cuenta. Después podrás entrar en WorkOS con tu email y contraseña.</p>
            <a className="workos-login-link primary" href="/login">Volver al login</a>
          </>
        ) : (
          <>
            <p>Solo funcionan los correos que ya estén autorizados en WorkOS.</p>
            <form action="/api/auth/register" method="post">
              <label htmlFor="email">Email</label>
              <input id="email" name="email" type="email" autoComplete="email" required autoFocus placeholder="nombre@correo.com" />

              <label htmlFor="password">Contraseña</label>
              <input id="password" name="password" type="password" autoComplete="new-password" minLength={10} required />

              <label htmlFor="confirm">Repetir contraseña</label>
              <input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={10} required />

              <button type="submit">Crear acceso</button>
            </form>

            {error ? <small className="workos-login-error">{error}{params.message ? ` · ${params.message}` : ""}</small> : null}
            <a className="workos-login-link" href="/login">Ya tengo acceso</a>
          </>
        )}
      </section>
    </main>
  );
}

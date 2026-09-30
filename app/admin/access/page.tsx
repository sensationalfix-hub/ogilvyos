"use client";

import { useEffect, useMemo, useState } from "react";

type AccessRole = "admin" | "viewer_global" | "employee";
type Account = {
  email: string;
  full_name: string;
  initials: string;
  role: AccessRole;
  employee_name: string | null;
  active: boolean;
};

type TeamPerson = { name: string; email: string | null };

const roleLabel: Record<AccessRole, string> = {
  admin: "Admin",
  viewer_global: "Viewer global",
  employee: "Empleado",
};

export default function AccessAdminPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [team, setTeam] = useState<TeamPerson[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    email: "",
    fullName: "",
    initials: "",
    role: "employee" as AccessRole,
    employeeName: "",
    active: true,
  });

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [accessResponse, stateResponse] = await Promise.all([
        fetch("/api/admin/access", { cache: "no-store" }),
        fetch("/api/notion/state", { cache: "no-store" }),
      ]);
      if (!accessResponse.ok) throw new Error("No tienes permiso para gestionar accesos.");
      const access = await accessResponse.json();
      const state = stateResponse.ok ? await stateResponse.json() : { team: [] };
      setAccounts(Array.isArray(access.accounts) ? access.accounts : []);
      setTeam(Array.isArray(state.team) ? state.team.map((person: any) => ({ name: person.name, email: person.email })) : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron cargar los accesos.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const linkedNames = useMemo(() => new Set(accounts.map((a) => a.employee_name).filter(Boolean)), [accounts]);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/admin/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.message || body?.error || "No se pudo guardar el acceso.");
      setForm({ email: "", fullName: "", initials: "", role: "employee", employeeName: "", active: true });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar el acceso.");
    } finally {
      setSaving(false);
    }
  }

  function edit(account: Account) {
    setForm({
      email: account.email,
      fullName: account.full_name,
      initials: account.initials,
      role: account.role,
      employeeName: account.employee_name || "",
      active: account.active,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function toggle(account: Account) {
    setSaving(true);
    await fetch("/api/admin/access", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: account.email,
        fullName: account.full_name,
        initials: account.initials,
        role: account.role,
        employeeName: account.employee_name,
        active: !account.active,
      }),
    });
    await load();
    setSaving(false);
  }

  return (
    <main className="access-admin-shell">
      <header className="access-admin-header">
        <a href="/" className="access-back">← WorkOS</a>
        <div><span>ADMINISTRACIÓN</span><h1>Accesos</h1><p>Usuarios, roles y vínculo con el equipo real. Sin peregrinaje por Supabase.</p></div>
      </header>

      <section className="access-admin-grid">
        <form className="access-form-card" onSubmit={save}>
          <div className="access-card-kicker">NUEVO / EDITAR</div>
          <h2>Dar acceso</h2>

          <label>Email<input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="nombre@correo.com" /></label>
          <div className="access-form-row">
            <label>Nombre<input required value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} placeholder="Nombre" /></label>
            <label>Iniciales<input required maxLength={3} value={form.initials} onChange={(e) => setForm({ ...form, initials: e.target.value.toUpperCase() })} placeholder="NG" /></label>
          </div>

          <label>Rol
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as AccessRole })}>
              <option value="employee">Empleado</option>
              <option value="viewer_global">Viewer global</option>
              <option value="admin">Admin</option>
            </select>
          </label>

          {form.role === "employee" && (
            <label>Persona vinculada
              <select required value={form.employeeName} onChange={(e) => setForm({ ...form, employeeName: e.target.value })}>
                <option value="">Selecciona una persona</option>
                {team.map((person) => <option key={person.name} value={person.name}>{person.name}{linkedNames.has(person.name) && person.name !== form.employeeName ? " · ya vinculado" : ""}</option>)}
              </select>
            </label>
          )}

          <label className="access-active"><input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} /> Acceso activo</label>

          <button disabled={saving} type="submit">{saving ? "Guardando…" : "Guardar acceso"}</button>
          <small>El usuario se registra después desde <strong>/register</strong>. Si ya existe, el cambio de rol se aplica también a su perfil.</small>
          {error && <p className="access-error">{error}</p>}
        </form>

        <section className="access-list-card">
          <div className="access-card-kicker">USUARIOS</div>
          <h2>{loading ? "Cargando…" : `${accounts.length} accesos`}</h2>
          <div className="access-list">
            {accounts.map((account) => (
              <article className={`access-row ${account.active ? "" : "disabled"}`} key={account.email}>
                <span className="access-avatar">{account.initials}</span>
                <div className="access-person"><strong>{account.full_name}</strong><small>{account.email}</small></div>
                <div className="access-role"><strong>{roleLabel[account.role]}</strong><small>{account.employee_name || "Acceso global"}</small></div>
                <span className={account.active ? "access-status on" : "access-status"}>{account.active ? "Activo" : "Pausado"}</span>
                <button onClick={() => edit(account)} type="button">Editar</button>
                <button onClick={() => void toggle(account)} type="button">{account.active ? "Pausar" : "Activar"}</button>
              </article>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}

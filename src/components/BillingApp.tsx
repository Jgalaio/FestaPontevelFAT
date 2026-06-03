"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import {
  Building2,
  CalendarDays,
  Euro,
  KeyRound,
  LogOut,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  UserRound,
  Users,
  WalletCards,
  X
} from "lucide-react";
import { createBrowserSupabaseClient, hasSupabaseConfig } from "@/lib/supabase";
import { formatCurrency, formatDateLabel, formatDateTimeLabel, parseMoney, todayISO } from "@/lib/format";
import type { AppSession, Posto, Registo, RegistoForm, RegistoRow, RegistoRpc, Utilizador } from "@/lib/types";

type DemoStore = {
  postos: Posto[];
  registos: RegistoRow[];
};

type SideTab = "postos" | "utilizadores";

type UserForm = {
  id: string | null;
  username: string;
  nome: string;
  password: string;
  ativo: boolean;
  role: "admin" | "operador";
};

const STORAGE_KEY = "pontevel-faturacao-mvp";
const DEMO_OPERATOR_KEY = "pontevel-faturacao-operador";
const APP_SESSION_KEY = "pontevel-faturacao-sessao";

const basePostos: Posto[] = [
  {
    id: "demo-bar-central",
    nome: "Bar Central",
    responsavel: "Equipa A",
    ativo: true,
    created_at: "2026-06-03T00:00:00.000Z"
  },
  {
    id: "demo-bilheteira",
    nome: "Bilheteira",
    responsavel: "Tesouraria",
    ativo: true,
    created_at: "2026-06-03T00:00:00.000Z"
  },
  {
    id: "demo-restaurante",
    nome: "Restaurante",
    responsavel: "Equipa B",
    ativo: true,
    created_at: "2026-06-03T00:00:00.000Z"
  }
];

function makeId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function emptyForm(date = todayISO()): RegistoForm {
  return {
    postoId: "",
    data: date,
    dinheiro: "",
    multibanco: "",
    mbway: "",
    observacoes: ""
  };
}

function emptyUserForm(): UserForm {
  return {
    id: null,
    username: "",
    nome: "",
    password: "",
    ativo: true,
    role: "operador"
  };
}

function readDemoStore(): DemoStore {
  if (typeof window === "undefined") {
    return { postos: basePostos, registos: [] };
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);

  if (!raw) {
    return { postos: basePostos, registos: [] };
  }

  try {
    const parsed = JSON.parse(raw) as DemoStore;
    return {
      postos: parsed.postos?.length ? parsed.postos : basePostos,
      registos: parsed.registos ?? []
    };
  } catch {
    return { postos: basePostos, registos: [] };
  }
}

function writeDemoStore(store: DemoStore) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

function readDemoOperator() {
  if (typeof window === "undefined") {
    return "Demonstração";
  }

  return window.localStorage.getItem(DEMO_OPERATOR_KEY) || "Demonstração";
}

function writeDemoOperator(nome: string) {
  window.localStorage.setItem(DEMO_OPERATOR_KEY, nome);
}

function readStoredSession() {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(APP_SESSION_KEY);

  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as AppSession;

    if (!parsed.token || new Date(parsed.expires_at).getTime() <= Date.now()) {
      window.localStorage.removeItem(APP_SESSION_KEY);
      return null;
    }

    return parsed;
  } catch {
    window.localStorage.removeItem(APP_SESSION_KEY);
    return null;
  }
}

function writeStoredSession(session: AppSession) {
  window.localStorage.setItem(APP_SESSION_KEY, JSON.stringify(session));
}

function clearStoredSession() {
  window.localStorage.removeItem(APP_SESSION_KEY);
}

function attachPostos(registos: RegistoRow[], postos: Posto[]): Registo[] {
  return registos
    .map((registo) => ({
      ...registo,
      postos: postos.find((posto) => posto.id === registo.posto_id) ?? null
    }))
    .sort((a, b) => {
      const byPosto = (a.postos?.nome ?? "").localeCompare(b.postos?.nome ?? "");
      return byPosto || a.created_at.localeCompare(b.created_at);
    });
}

function mapRegistoRpc(row: RegistoRpc): Registo {
  const { posto_nome: postoNome, posto_responsavel: postoResponsavel, ...registo } = row;

  return {
    ...registo,
    postos: {
      id: row.posto_id,
      nome: postoNome ?? "Posto removido",
      responsavel: postoResponsavel
    }
  };
}

export function BillingApp() {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const isDemoMode = !hasSupabaseConfig || !supabase;
  const startDate = useMemo(() => todayISO(), []);

  const [appSession, setAppSession] = useState<AppSession | null>(null);
  const [authLoading, setAuthLoading] = useState(Boolean(supabase));
  const [authUsername, setAuthUsername] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [selectedDate, setSelectedDate] = useState(startDate);
  const [form, setForm] = useState<RegistoForm>(() => emptyForm(startDate));
  const [postos, setPostos] = useState<Posto[]>([]);
  const [registos, setRegistos] = useState<Registo[]>([]);
  const [utilizadores, setUtilizadores] = useState<Utilizador[]>([]);
  const [userForm, setUserForm] = useState<UserForm>(() => emptyUserForm());
  const [sideTab, setSideTab] = useState<SideTab>("postos");
  const [newPostoName, setNewPostoName] = useState("");
  const [newPostoResponsavel, setNewPostoResponsavel] = useState("");
  const [demoOperator, setDemoOperator] = useState("Demonstração");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [userSaving, setUserSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const activePostos = useMemo(
    () => postos.filter((posto) => posto.ativo).sort((a, b) => a.nome.localeCompare(b.nome)),
    [postos]
  );

  const totals = useMemo(() => {
    return registos.reduce(
      (acc, registo) => {
        acc.dinheiro += Number(registo.dinheiro);
        acc.multibanco += Number(registo.multibanco);
        acc.mbway += Number(registo.mbway);
        acc.total += Number(registo.dinheiro) + Number(registo.multibanco) + Number(registo.mbway);
        return acc;
      },
      { dinheiro: 0, multibanco: 0, mbway: 0, total: 0 }
    );
  }, [registos]);

  const postosRegistados = useMemo(
    () => new Set(registos.map((registo) => registo.posto_id)).size,
    [registos]
  );

  const currentUserName = appSession?.nome ?? demoOperator;
  const sessionToken = appSession?.token ?? "";
  const isLoggedIn = isDemoMode || Boolean(appSession);
  const canManageUsers = isDemoMode || appSession?.role === "admin";

  const loadUsers = useCallback(async () => {
    if (isDemoMode) {
      setUtilizadores([
        {
          id: "demo-jgalaio",
          username: "Jgalaio",
          nome: "Jgalaio",
          ativo: true,
          role: "admin",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        {
          id: "demo-alopes",
          username: "ALopes",
          nome: "ALopes",
          ativo: true,
          role: "operador",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ]);
      return;
    }

    if (!supabase || !sessionToken) {
      setUtilizadores([]);
      return;
    }

    const { data, error: usersError } = await supabase.rpc("app_listar_utilizadores", {
      p_token: sessionToken
    });

    if (usersError) {
      setError(usersError.message);
      return;
    }

    setUtilizadores(data ?? []);
  }, [isDemoMode, sessionToken, supabase]);

  const loadData = useCallback(async () => {
    setError("");

    if (isDemoMode) {
      const store = readDemoStore();
      writeDemoStore(store);
      setPostos(store.postos);
      setRegistos(attachPostos(store.registos.filter((registo) => registo.data === selectedDate), store.postos));
      return;
    }

    if (!supabase || !sessionToken) {
      return;
    }

    setLoading(true);

    const [postosResult, registosResult] = await Promise.all([
      supabase.rpc("app_listar_postos", { p_token: sessionToken }),
      supabase.rpc("app_listar_registos", { p_token: sessionToken, p_data: selectedDate })
    ]);

    setLoading(false);

    if (postosResult.error) {
      setError(postosResult.error.message);
      return;
    }

    if (registosResult.error) {
      setError(registosResult.error.message);
      return;
    }

    setPostos(postosResult.data ?? []);
    setRegistos((registosResult.data ?? []).map(mapRegistoRpc));
  }, [isDemoMode, selectedDate, sessionToken, supabase]);

  useEffect(() => {
    if (!supabase) {
      setAuthLoading(false);
      setDemoOperator(readDemoOperator());
      return;
    }

    const storedSession = readStoredSession();

    if (!storedSession) {
      setAuthLoading(false);
      return;
    }

    async function validateStoredSession() {
      try {
        const { data, error: sessionError } = await supabase.rpc("app_utilizador_por_token", {
          p_token: storedSession.token
        });

        if (sessionError || !data?.[0]) {
          clearStoredSession();
          setAppSession(null);
          return;
        }

        const validatedSession: AppSession = {
          token: storedSession.token,
          utilizador_id: data[0].utilizador_id,
          username: data[0].username,
          nome: data[0].nome,
          role: data[0].role,
          expires_at: data[0].expires_at
        };

        setAppSession(validatedSession);
        writeStoredSession(validatedSession);
      } finally {
        setAuthLoading(false);
      }
    }

    void validateStoredSession();
  }, [supabase]);

  useEffect(() => {
    if (isLoggedIn) {
      void loadData();
    }
  }, [isLoggedIn, loadData]);

  useEffect(() => {
    if (isLoggedIn && sideTab === "utilizadores" && canManageUsers) {
      void loadUsers();
    }
  }, [canManageUsers, isLoggedIn, loadUsers, sideTab]);

  useEffect(() => {
    if (!canManageUsers) {
      setUtilizadores([]);
      setUserForm(emptyUserForm());
    }
  }, [canManageUsers]);

  useEffect(() => {
    if (!form.postoId && activePostos[0]) {
      setForm((current) => ({ ...current, postoId: activePostos[0].id }));
    }
  }, [activePostos, form.postoId]);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");

    if (!supabase || !authUsername.trim() || !authPassword) {
      return;
    }

    setAuthLoading(true);

    const { data, error: loginError } = await supabase.rpc("app_login", {
      p_username: authUsername.trim(),
      p_password: authPassword
    });

    setAuthLoading(false);

    if (loginError || !data?.[0]) {
      setError(loginError?.message ?? "Não foi possível iniciar sessão.");
      return;
    }

    const nextSession = data[0];
    setAppSession(nextSession);
    writeStoredSession(nextSession);
    setAuthPassword("");
    setNotice("Sessão iniciada.");
  }

  async function handleSignOut() {
    if (supabase && appSession) {
      await supabase.rpc("app_logout", { p_token: appSession.token });
    }

    clearStoredSession();
    setAppSession(null);
    setRegistos([]);
    setPostos([]);
    setUtilizadores([]);
  }

  function handleDateChange(value: string) {
    setSelectedDate(value);
    setForm((current) => ({ ...current, data: value }));
  }

  async function handleAddPosto(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");

    const nome = newPostoName.trim();

    if (!nome) {
      setError("Indica o nome do posto.");
      return;
    }

    if (isDemoMode) {
      const store = readDemoStore();
      const exists = store.postos.some((posto) => posto.nome.toLowerCase() === nome.toLowerCase());

      if (exists) {
        setError("Esse posto já existe.");
        return;
      }

      const nextPosto: Posto = {
        id: makeId("posto"),
        nome,
        responsavel: newPostoResponsavel.trim() || null,
        ativo: true,
        created_at: new Date().toISOString()
      };

      writeDemoStore({ ...store, postos: [...store.postos, nextPosto] });
      setNewPostoName("");
      setNewPostoResponsavel("");
      setNotice("Posto adicionado.");
      await loadData();
      return;
    }

    if (!supabase || !sessionToken) {
      return;
    }

    const { error: insertError } = await supabase.rpc("app_criar_posto", {
      p_token: sessionToken,
      p_nome: nome,
      p_responsavel: newPostoResponsavel.trim() || null
    });

    if (insertError) {
      setError(insertError.message);
      return;
    }

    setNewPostoName("");
    setNewPostoResponsavel("");
    setNotice("Posto adicionado.");
    await loadData();
  }

  async function handleSaveRegisto(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");

    if (!form.postoId) {
      setSaving(false);
      setError("Escolhe um posto.");
      return;
    }

    const payload = {
      posto_id: form.postoId,
      data: form.data,
      dinheiro: parseMoney(form.dinheiro),
      multibanco: parseMoney(form.multibanco),
      mbway: parseMoney(form.mbway),
      observacoes: form.observacoes.trim() || null
    };

    if (isDemoMode) {
      const store = readDemoStore();
      const existingIndex = store.registos.findIndex(
        (registo) => registo.posto_id === payload.posto_id && registo.data === payload.data
      );
      const existingRegisto = existingIndex >= 0 ? store.registos[existingIndex] : null;
      const now = new Date().toISOString();
      const nextRegisto: RegistoRow = {
        id: existingRegisto?.id ?? makeId("registo"),
        created_at: existingRegisto?.created_at ?? now,
        updated_at: now,
        criado_por_id: existingRegisto?.criado_por_id ?? null,
        criado_por_nome: existingRegisto?.criado_por_nome ?? currentUserName,
        atualizado_por_id: null,
        atualizado_por_nome: currentUserName,
        ...payload
      };

      const nextRegistos =
        existingIndex >= 0
          ? store.registos.map((registo, index) => (index === existingIndex ? nextRegisto : registo))
          : [...store.registos, nextRegisto];

      writeDemoStore({ ...store, registos: nextRegistos });
      setNotice("Registo guardado.");
      setForm((current) => ({ ...emptyForm(current.data), postoId: current.postoId }));
      setSaving(false);
      await loadData();
      return;
    }

    if (!supabase || !sessionToken) {
      setSaving(false);
      return;
    }

    const { error: saveError } = await supabase.rpc("app_guardar_registo", {
      p_token: sessionToken,
      p_posto_id: payload.posto_id,
      p_data: payload.data,
      p_dinheiro: payload.dinheiro,
      p_multibanco: payload.multibanco,
      p_mbway: payload.mbway,
      p_observacoes: payload.observacoes
    });

    setSaving(false);

    if (saveError) {
      setError(saveError.message);
      return;
    }

    setNotice("Registo guardado.");
    setForm((current) => ({ ...emptyForm(current.data), postoId: current.postoId }));
    await loadData();
  }

  async function handleDeleteRegisto(id: string) {
    const shouldDelete = window.confirm("Apagar este registo?");

    if (!shouldDelete) {
      return;
    }

    setError("");
    setNotice("");

    if (isDemoMode) {
      const store = readDemoStore();
      writeDemoStore({
        ...store,
        registos: store.registos.filter((registo) => registo.id !== id)
      });
      setNotice("Registo apagado.");
      await loadData();
      return;
    }

    if (!supabase || !sessionToken) {
      return;
    }

    const { error: deleteError } = await supabase.rpc("app_apagar_registo", {
      p_token: sessionToken,
      p_id: id
    });

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    setNotice("Registo apagado.");
    await loadData();
  }

  function handleEditRegisto(registo: Registo) {
    setForm({
      postoId: registo.posto_id,
      data: registo.data,
      dinheiro: String(Number(registo.dinheiro).toFixed(2)),
      multibanco: String(Number(registo.multibanco).toFixed(2)),
      mbway: String(Number(registo.mbway).toFixed(2)),
      observacoes: registo.observacoes ?? ""
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSaveUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");

    if (!userForm.username.trim() || !userForm.nome.trim()) {
      setError("Indica username e nome.");
      return;
    }

    if (!userForm.id && !userForm.password) {
      setError("Indica a password inicial.");
      return;
    }

    if (!canManageUsers) {
      setError("Apenas administradores podem gerir utilizadores.");
      return;
    }

    if (isDemoMode) {
      writeDemoOperator(userForm.nome.trim());
      setDemoOperator(userForm.nome.trim());
      setNotice("Utilizador guardado em modo demonstração.");
      setUserForm(emptyUserForm());
      return;
    }

    if (!supabase || !sessionToken) {
      return;
    }

    setUserSaving(true);

    const { data, error: userError } = await supabase.rpc("app_guardar_utilizador", {
      p_token: sessionToken,
      p_id: userForm.id,
      p_username: userForm.username.trim(),
      p_nome: userForm.nome.trim(),
      p_password: userForm.password || null,
      p_ativo: userForm.ativo,
      p_role: userForm.role
    });

    setUserSaving(false);

    if (userError || !data?.[0]) {
      setError(userError?.message ?? "Não foi possível guardar o utilizador.");
      return;
    }

    const savedUser = data[0];

    if (appSession?.utilizador_id === savedUser.id) {
      const nextSession = {
        ...appSession,
        username: savedUser.username,
        nome: savedUser.nome,
        role: savedUser.role
      };
      setAppSession(nextSession);
      writeStoredSession(nextSession);
    }

    setNotice("Utilizador guardado.");
    setUserForm(emptyUserForm());
    await loadUsers();
  }

  function handleEditUser(user: Utilizador) {
    setUserForm({
      id: user.id,
      username: user.username,
      nome: user.nome,
      password: "",
      ativo: user.ativo,
      role: user.role
    });
  }

  if (authLoading) {
    return (
      <main className="app-shell auth-shell">
        <section className="auth-panel">
          <RefreshCw className="spin" aria-hidden="true" />
          <h1>A preparar sessão</h1>
        </section>
      </main>
    );
  }

  if (!isDemoMode && !appSession) {
    return (
      <main className="app-shell auth-shell">
        <section className="auth-panel">
          <div>
            <p className="eyebrow">Festa de Pontével</p>
            <h1>Entrada da equipa</h1>
          </div>

          <form className="auth-form" onSubmit={handleLogin}>
            <label>
              Username
              <input
                value={authUsername}
                onChange={(event) => setAuthUsername(event.target.value)}
                placeholder="Jgalaio"
                autoComplete="username"
                required
              />
            </label>
            <label>
              Password
              <input
                type="password"
                value={authPassword}
                onChange={(event) => setAuthPassword(event.target.value)}
                autoComplete="current-password"
                required
              />
            </label>
            <button className="primary-button" type="submit">
              <KeyRound size={18} aria-hidden="true" />
              Entrar
            </button>
          </form>

          {error ? <div className="alert error">{error}</div> : null}
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Festa de Pontével</p>
          <h1>Faturação diária</h1>
        </div>

        <div className="top-actions">
          <label className="date-control">
            <CalendarDays size={18} aria-hidden="true" />
            <input type="date" value={selectedDate} onChange={(event) => handleDateChange(event.target.value)} />
          </label>

          {isDemoMode ? <span className="status-chip">Demonstração</span> : null}
          <span className="status-chip">{currentUserName}</span>
          {!isDemoMode && appSession ? <span className="status-chip">{appSession.role}</span> : null}

          {!isDemoMode ? (
            <button className="icon-text-button" type="button" onClick={() => void handleSignOut()}>
              <LogOut size={18} aria-hidden="true" />
              Sair
            </button>
          ) : null}
        </div>
      </header>

      <section className="summary-grid" aria-label="Totais do dia">
        <article className="metric metric-total">
          <span>Total do dia</span>
          <strong>{formatCurrency(totals.total)}</strong>
          <small>{formatDateLabel(selectedDate)}</small>
        </article>
        <article className="metric">
          <span>Dinheiro</span>
          <strong>{formatCurrency(totals.dinheiro)}</strong>
        </article>
        <article className="metric">
          <span>Multibanco</span>
          <strong>{formatCurrency(totals.multibanco)}</strong>
        </article>
        <article className="metric">
          <span>MB Way</span>
          <strong>{formatCurrency(totals.mbway)}</strong>
        </article>
        <article className="metric">
          <span>Postos fechados</span>
          <strong>
            {postosRegistados}/{activePostos.length}
          </strong>
        </article>
      </section>

      <div className="messages">
        {notice ? <div className="alert success">{notice}</div> : null}
        {error ? <div className="alert error">{error}</div> : null}
      </div>

      <div className="workspace-grid">
        <section className="panel entry-panel">
          <div className="panel-heading">
            <div className="heading-icon">
              <Euro size={20} aria-hidden="true" />
            </div>
            <div>
              <p className="eyebrow">Registo</p>
              <h2>Valores por posto</h2>
            </div>
          </div>

          <form className="form-grid" onSubmit={handleSaveRegisto}>
            <label>
              Posto
              <select
                value={form.postoId}
                onChange={(event) => setForm((current) => ({ ...current, postoId: event.target.value }))}
                required
              >
                <option value="">Escolher posto</option>
                {activePostos.map((posto) => (
                  <option key={posto.id} value={posto.id}>
                    {posto.nome}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Data
              <input type="date" value={form.data} onChange={(event) => handleDateChange(event.target.value)} />
            </label>

            <label>
              Dinheiro
              <input
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={form.dinheiro}
                onChange={(event) => setForm((current) => ({ ...current, dinheiro: event.target.value }))}
              />
            </label>

            <label>
              Multibanco
              <input
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={form.multibanco}
                onChange={(event) => setForm((current) => ({ ...current, multibanco: event.target.value }))}
              />
            </label>

            <label>
              MB Way
              <input
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={form.mbway}
                onChange={(event) => setForm((current) => ({ ...current, mbway: event.target.value }))}
              />
            </label>

            <label className="wide-field">
              Observações
              <textarea
                value={form.observacoes}
                onChange={(event) => setForm((current) => ({ ...current, observacoes: event.target.value }))}
                rows={3}
              />
            </label>

            <button className="primary-button wide-field" type="submit" disabled={saving || !activePostos.length}>
              <Save size={18} aria-hidden="true" />
              {saving ? "A guardar" : "Guardar registo"}
            </button>
          </form>
        </section>

        <section className="panel side-panel">
          <div className="side-tabs" role="tablist" aria-label="Gestão">
            <button
              className={`tab-button ${sideTab === "postos" ? "active" : ""}`}
              type="button"
              onClick={() => setSideTab("postos")}
            >
              <Building2 size={18} aria-hidden="true" />
              Postos
            </button>
            <button
              className={`tab-button ${sideTab === "utilizadores" ? "active" : ""}`}
              type="button"
              onClick={() => setSideTab("utilizadores")}
            >
              <Users size={18} aria-hidden="true" />
              Utilizadores
            </button>
          </div>

          {sideTab === "postos" ? (
            <>
              <div className="panel-heading">
                <div className="heading-icon">
                  <Building2 size={20} aria-hidden="true" />
                </div>
                <div>
                  <p className="eyebrow">Postos</p>
                  <h2>Pontos de faturação</h2>
                </div>
              </div>

              <form className="posto-form" onSubmit={handleAddPosto}>
                <label>
                  Nome
                  <input
                    value={newPostoName}
                    onChange={(event) => setNewPostoName(event.target.value)}
                    placeholder="Ex.: Bar palco"
                  />
                </label>
                <label>
                  Responsável
                  <input
                    value={newPostoResponsavel}
                    onChange={(event) => setNewPostoResponsavel(event.target.value)}
                    placeholder="Nome ou equipa"
                  />
                </label>
                <button className="secondary-button" type="submit">
                  <Plus size={18} aria-hidden="true" />
                  Adicionar
                </button>
              </form>

              <div className="posto-list">
                {activePostos.map((posto) => (
                  <div className="posto-row" key={posto.id}>
                    <div>
                      <strong>{posto.nome}</strong>
                      <span>{posto.responsavel || "Sem responsável"}</span>
                    </div>
                    <WalletCards size={18} aria-hidden="true" />
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              <div className="panel-heading">
                <div className="heading-icon">
                  <UserRound size={20} aria-hidden="true" />
                </div>
                <div>
                  <p className="eyebrow">Equipa</p>
                  <h2>Criação e edição</h2>
                </div>
              </div>

              {canManageUsers ? (
                <form className="user-form" onSubmit={handleSaveUser}>
                  <label>
                    Username
                    <input
                      value={userForm.username}
                      onChange={(event) => setUserForm((current) => ({ ...current, username: event.target.value }))}
                      placeholder="Username"
                      autoComplete="off"
                      required
                    />
                  </label>
                  <label>
                    Nome
                    <input
                      value={userForm.nome}
                      onChange={(event) => setUserForm((current) => ({ ...current, nome: event.target.value }))}
                      placeholder="Nome"
                      required
                    />
                  </label>
                  <label>
                    Password
                    <input
                      type="password"
                      value={userForm.password}
                      onChange={(event) => setUserForm((current) => ({ ...current, password: event.target.value }))}
                      placeholder={userForm.id ? "Manter atual" : "Password inicial"}
                      autoComplete="new-password"
                    />
                  </label>
                  <label>
                    Papel
                    <select
                      value={userForm.role}
                      onChange={(event) =>
                        setUserForm((current) => ({
                          ...current,
                          role: event.target.value === "admin" ? "admin" : "operador"
                        }))
                      }
                    >
                      <option value="operador">Operador</option>
                      <option value="admin">Admin</option>
                    </select>
                  </label>
                  <label className="checkbox-row">
                    <input
                      type="checkbox"
                      checked={userForm.ativo}
                      onChange={(event) => setUserForm((current) => ({ ...current, ativo: event.target.checked }))}
                    />
                    Ativo
                  </label>
                  <div className="user-form-actions">
                    <button className="secondary-button" type="submit" disabled={userSaving}>
                      <Save size={18} aria-hidden="true" />
                      {userSaving ? "A guardar" : userForm.id ? "Guardar" : "Criar"}
                    </button>
                    {userForm.id ? (
                      <button className="icon-text-button" type="button" onClick={() => setUserForm(emptyUserForm())}>
                        <X size={18} aria-hidden="true" />
                        Cancelar
                      </button>
                    ) : null}
                  </div>
                </form>
              ) : (
                <div className="empty-state">Sem permissão para editar utilizadores.</div>
              )}

              <div className="user-list">
                {utilizadores.map((user) => (
                  <div className="user-row" key={user.id}>
                    <div>
                      <strong>{user.nome}</strong>
                      <span>
                        {user.username} · {user.role} · {user.ativo ? "ativo" : "inativo"}
                      </span>
                    </div>
                    {canManageUsers ? (
                      <button
                        className="icon-button"
                        type="button"
                        title="Editar utilizador"
                        aria-label="Editar utilizador"
                        onClick={() => handleEditUser(user)}
                      >
                        <Pencil size={17} aria-hidden="true" />
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
            </>
          )}
        </section>
      </div>

      <section className="panel">
        <div className="panel-heading table-heading">
          <div>
            <p className="eyebrow">Movimentos</p>
            <h2>{formatDateLabel(selectedDate)}</h2>
          </div>
          <button className="icon-text-button" type="button" onClick={() => void loadData()} disabled={loading}>
            <RefreshCw size={18} className={loading ? "spin" : ""} aria-hidden="true" />
            Atualizar
          </button>
        </div>

        {loading ? (
          <div className="empty-state">A carregar registos.</div>
        ) : registos.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Posto</th>
                  <th>Dinheiro</th>
                  <th>Multibanco</th>
                  <th>MB Way</th>
                  <th>Total</th>
                  <th>Alterado por</th>
                  <th>Observações</th>
                  <th aria-label="Ações" />
                </tr>
              </thead>
              <tbody>
                {registos.map((registo) => {
                  const total =
                    Number(registo.dinheiro) + Number(registo.multibanco) + Number(registo.mbway);

                  return (
                    <tr key={registo.id}>
                      <td>
                        <strong>{registo.postos?.nome ?? "Posto removido"}</strong>
                        <span>{registo.postos?.responsavel ?? ""}</span>
                      </td>
                      <td>{formatCurrency(Number(registo.dinheiro))}</td>
                      <td>{formatCurrency(Number(registo.multibanco))}</td>
                      <td>{formatCurrency(Number(registo.mbway))}</td>
                      <td>
                        <strong>{formatCurrency(total)}</strong>
                      </td>
                      <td className="audit-cell">
                        <strong>{registo.atualizado_por_nome ?? registo.criado_por_nome ?? "Sem utilizador"}</strong>
                        <span>{formatDateTimeLabel(registo.updated_at)}</span>
                      </td>
                      <td>{registo.observacoes || ""}</td>
                      <td>
                        <div className="row-actions">
                          <button
                            className="icon-button"
                            type="button"
                            title="Editar"
                            aria-label="Editar registo"
                            onClick={() => handleEditRegisto(registo)}
                          >
                            <Pencil size={17} aria-hidden="true" />
                          </button>
                          <button
                            className="icon-button danger"
                            type="button"
                            title="Apagar"
                            aria-label="Apagar registo"
                            onClick={() => void handleDeleteRegisto(registo.id)}
                          >
                            <Trash2 size={17} aria-hidden="true" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">Sem registos para este dia.</div>
        )}
      </section>
    </main>
  );
}

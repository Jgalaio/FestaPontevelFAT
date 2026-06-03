"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  Building2,
  CalendarDays,
  Euro,
  LogOut,
  Mail,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  UserRound,
  WalletCards
} from "lucide-react";
import { createBrowserSupabaseClient, hasSupabaseConfig } from "@/lib/supabase";
import { formatCurrency, formatDateLabel, formatDateTimeLabel, parseMoney, todayISO } from "@/lib/format";
import type { Posto, Registo, RegistoForm, RegistoRow, Utilizador } from "@/lib/types";

type DemoStore = {
  postos: Posto[];
  registos: RegistoRow[];
};

const STORAGE_KEY = "pontevel-faturacao-mvp";
const DEMO_OPERATOR_KEY = "pontevel-faturacao-operador";

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

function getSessionFallbackName(session: Session | null) {
  if (!session) {
    return "Utilizador";
  }

  const metadata = session.user.user_metadata ?? {};
  const metadataName =
    typeof metadata.nome === "string"
      ? metadata.nome
      : typeof metadata.name === "string"
        ? metadata.name
        : "";

  return metadataName || session.user.email?.split("@")[0] || "Utilizador";
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

export function BillingApp() {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const isDemoMode = !hasSupabaseConfig || !supabase;
  const startDate = useMemo(() => todayISO(), []);

  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(Boolean(supabase));
  const [authEmail, setAuthEmail] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [profile, setProfile] = useState<Utilizador | null>(null);
  const [profileName, setProfileName] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [selectedDate, setSelectedDate] = useState(startDate);
  const [form, setForm] = useState<RegistoForm>(() => emptyForm(startDate));
  const [postos, setPostos] = useState<Posto[]>([]);
  const [registos, setRegistos] = useState<Registo[]>([]);
  const [newPostoName, setNewPostoName] = useState("");
  const [newPostoResponsavel, setNewPostoResponsavel] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
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

  const currentUserName = useMemo(() => {
    const nome = profile?.nome || profileName.trim();
    return nome || (isDemoMode ? "Demonstração" : getSessionFallbackName(session));
  }, [isDemoMode, profile, profileName, session]);

  const currentUserEmail = session?.user.email ?? (isDemoMode ? "Modo demonstração" : "");

  const loadProfile = useCallback(async () => {
    if (isDemoMode) {
      setProfile(null);
      setProfileName(readDemoOperator());
      return;
    }

    if (!supabase || !session) {
      setProfile(null);
      setProfileName("");
      return;
    }

    const fallbackName = getSessionFallbackName(session);
    const email = session.user.email ?? "";

    const { data, error: profileError } = await supabase
      .from("utilizadores")
      .select("*")
      .eq("id", session.user.id)
      .maybeSingle();

    if (profileError) {
      setProfileName(fallbackName);
      setError(profileError.message);
      return;
    }

    if (data) {
      setProfile(data);
      setProfileName(data.nome);
      return;
    }

    const { data: createdProfile, error: createProfileError } = await supabase
      .from("utilizadores")
      .upsert({ id: session.user.id, email, nome: fallbackName }, { onConflict: "id" })
      .select()
      .single();

    if (createProfileError) {
      setProfileName(fallbackName);
      setError(createProfileError.message);
      return;
    }

    setProfile(createdProfile);
    setProfileName(createdProfile.nome);
  }, [isDemoMode, session, supabase]);

  const loadData = useCallback(async () => {
    setError("");

    if (isDemoMode) {
      const store = readDemoStore();
      writeDemoStore(store);
      setPostos(store.postos);
      setRegistos(attachPostos(store.registos.filter((registo) => registo.data === selectedDate), store.postos));
      return;
    }

    if (!supabase || !session) {
      return;
    }

    setLoading(true);

    const [postosResult, registosResult] = await Promise.all([
      supabase.from("postos").select("*").order("nome", { ascending: true }),
      supabase
        .from("registos_faturacao")
        .select("*, postos(id,nome,responsavel)")
        .eq("data", selectedDate)
        .order("created_at", { ascending: true })
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
    setRegistos((registosResult.data ?? []) as Registo[]);
  }, [isDemoMode, selectedDate, session, supabase]);

  useEffect(() => {
    if (!supabase) {
      setAuthLoading(false);
      return;
    }

    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) {
        return;
      }

      setSession(data.session);
      setAuthLoading(false);
    });

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    if (!form.postoId && activePostos[0]) {
      setForm((current) => ({ ...current, postoId: activePostos[0].id }));
    }
  }, [activePostos, form.postoId]);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setAuthMessage("");

    if (!supabase || !authEmail.trim()) {
      return;
    }

    const { error: signInError } = await supabase.auth.signInWithOtp({
      email: authEmail.trim(),
      options: {
        emailRedirectTo: window.location.origin
      }
    });

    if (signInError) {
      setError(signInError.message);
      return;
    }

    setAuthMessage("Ligação enviada para o email.");
  }

  async function handleSignOut() {
    if (!supabase) {
      return;
    }

    await supabase.auth.signOut();
    setRegistos([]);
    setPostos([]);
    setProfile(null);
    setProfileName("");
  }

  async function handleSaveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");

    const nome = profileName.trim();

    if (!nome) {
      setError("Indica o nome do utilizador.");
      return;
    }

    if (isDemoMode) {
      writeDemoOperator(nome);
      setNotice("Utilizador guardado.");
      return;
    }

    if (!supabase || !session) {
      return;
    }

    setProfileSaving(true);

    const { data, error: saveProfileError } = await supabase
      .from("utilizadores")
      .upsert(
        {
          id: session.user.id,
          email: session.user.email ?? "",
          nome
        },
        { onConflict: "id" }
      )
      .select()
      .single();

    setProfileSaving(false);

    if (saveProfileError) {
      setError(saveProfileError.message);
      return;
    }

    setProfile(data);
    setProfileName(data.nome);
    setNotice("Utilizador guardado.");
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

      const nextStore = { ...store, postos: [...store.postos, nextPosto] };
      writeDemoStore(nextStore);
      setNewPostoName("");
      setNewPostoResponsavel("");
      setNotice("Posto adicionado.");
      await loadData();
      return;
    }

    if (!supabase) {
      return;
    }

    const { error: insertError } = await supabase.from("postos").insert({
      nome,
      responsavel: newPostoResponsavel.trim() || null
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

    if (!supabase) {
      setSaving(false);
      return;
    }

    const actorId = session?.user.id ?? null;
    const actorName = currentUserName;
    const { data: existingRegisto, error: lookupError } = await supabase
      .from("registos_faturacao")
      .select("id, criado_por_id, criado_por_nome")
      .eq("posto_id", payload.posto_id)
      .eq("data", payload.data)
      .maybeSingle();

    if (lookupError) {
      setSaving(false);
      setError(lookupError.message);
      return;
    }

    const saveResult = existingRegisto
      ? await supabase
          .from("registos_faturacao")
          .update({
            ...payload,
            atualizado_por_id: actorId,
            atualizado_por_nome: actorName
          })
          .eq("id", existingRegisto.id)
      : await supabase.from("registos_faturacao").insert({
          ...payload,
          criado_por_id: actorId,
          criado_por_nome: actorName,
          atualizado_por_id: actorId,
          atualizado_por_nome: actorName
        });

    setSaving(false);

    if (saveResult.error) {
      setError(saveResult.error.message);
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

    if (!supabase) {
      return;
    }

    const { error: deleteError } = await supabase.from("registos_faturacao").delete().eq("id", id);

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

  if (!isDemoMode && !session) {
    return (
      <main className="app-shell auth-shell">
        <section className="auth-panel">
          <div>
            <p className="eyebrow">Festa de Pontével</p>
            <h1>Entrada da equipa</h1>
          </div>

          <form className="auth-form" onSubmit={handleLogin}>
            <label>
              Email
              <input
                type="email"
                value={authEmail}
                onChange={(event) => setAuthEmail(event.target.value)}
                placeholder="nome@exemplo.pt"
                required
              />
            </label>
            <button className="primary-button" type="submit">
              <Mail size={18} aria-hidden="true" />
              Enviar ligação
            </button>
          </form>

          {authMessage ? <div className="alert success">{authMessage}</div> : null}
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
          {!isDemoMode || currentUserName !== "Demonstração" ? (
            <span className="status-chip">{currentUserName}</span>
          ) : null}

          {!isDemoMode ? (
            <button className="icon-text-button" type="button" onClick={handleSignOut}>
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

        <section className="panel user-panel">
          <div className="panel-heading">
            <div className="heading-icon">
              <UserRound size={20} aria-hidden="true" />
            </div>
            <div>
              <p className="eyebrow">Utilizador</p>
              <h2>Operador atual</h2>
            </div>
          </div>

          <form className="profile-form" onSubmit={handleSaveProfile}>
            <label>
              Nome
              <input
                value={profileName}
                onChange={(event) => setProfileName(event.target.value)}
                placeholder="Nome da pessoa"
                required
              />
            </label>

            <div className="profile-meta">
              <span>Sessão</span>
              <strong>{currentUserName}</strong>
              <small>{currentUserEmail}</small>
            </div>

            <button className="secondary-button" type="submit" disabled={profileSaving}>
              <Save size={18} aria-hidden="true" />
              {profileSaving ? "A guardar" : "Guardar nome"}
            </button>
          </form>
        </section>

        <section className="panel">
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

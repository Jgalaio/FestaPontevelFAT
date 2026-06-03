"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import {
  Building2,
  CalendarDays,
  Euro,
  Home,
  KeyRound,
  LogOut,
  Pencil,
  Plus,
  Receipt,
  RefreshCw,
  Save,
  Settings,
  Tags,
  Trash2,
  UserRound,
  Users,
  X
} from "lucide-react";
import { createBrowserSupabaseClient, hasSupabaseConfig } from "@/lib/supabase";
import { formatCurrency, formatDateLabel, formatDateTimeLabel, parseMoney, todayISO } from "@/lib/format";
import type {
  AppSession,
  Despesa,
  DespesaForm,
  DespesaRow,
  DespesaRpc,
  DiaFesta,
  Posto,
  Registo,
  RegistoForm,
  RegistoRow,
  RegistoRpc,
  TipoDespesa,
  Utilizador
} from "@/lib/types";

type DemoStore = {
  diasFesta: DiaFesta[];
  postos: Posto[];
  registos: RegistoRow[];
  despesas: DespesaRow[];
  tiposDespesa: TipoDespesa[];
};

type EntryTab = "faturacao" | "despesas";
type SideTab = "dias" | "postos" | "tipos" | "utilizadores";
type BillingAppMode = "overview" | "register" | "management";

type BillingAppProps = {
  mode?: BillingAppMode;
};

type PostoForm = {
  id: string | null;
  nome: string;
  responsavel: string;
  ativo: boolean;
};

type TipoDespesaForm = {
  id: string | null;
  nome: string;
  ativo: boolean;
};

type DiaForm = {
  data: string;
  nome: string;
};

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
const DELETE_DAY_PASSWORD = "21051986Gz!";

const EXPENSE_TYPES = [
  "Produtos",
  "Serviços",
  "Equipamento",
  "Licenças",
  "Segurança",
  "Música",
  "Limpeza",
  "Outros"
];

const baseTiposDespesa: TipoDespesa[] = EXPENSE_TYPES.map((nome, index) => ({
  id: `demo-tipo-despesa-${index + 1}`,
  nome,
  ativo: true,
  criado_por_id: null,
  criado_por_nome: "Sistema",
  atualizado_por_id: null,
  atualizado_por_nome: "Sistema",
  created_at: "2026-06-03T00:00:00.000Z",
  updated_at: "2026-06-03T00:00:00.000Z"
}));

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

const baseDiasFesta: DiaFesta[] = [
  {
    id: "demo-dia-inicial",
    data: todayISO(),
    nome: "Dia inicial",
    fechado: false,
    fechado_por_id: null,
    fechado_por_nome: null,
    fechado_at: null,
    criado_por_id: null,
    criado_por_nome: "Sistema",
    atualizado_por_id: null,
    atualizado_por_nome: "Sistema",
    created_at: "2026-06-03T00:00:00.000Z",
    updated_at: "2026-06-03T00:00:00.000Z"
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

function emptyDespesaForm(date = todayISO()): DespesaForm {
  return {
    id: null,
    postoId: "",
    data: date,
    tipoDespesa: EXPENSE_TYPES[0],
    numeroDespesa: "",
    valor: "",
    faturaPaga: false,
    numeroFatura: "",
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

function emptyPostoForm(): PostoForm {
  return {
    id: null,
    nome: "",
    responsavel: "",
    ativo: true
  };
}

function emptyTipoDespesaForm(): TipoDespesaForm {
  return {
    id: null,
    nome: "",
    ativo: true
  };
}

function emptyDiaForm(date = todayISO()): DiaForm {
  return {
    data: date,
    nome: ""
  };
}

function buildDemoDias(registos: RegistoRow[], despesas: DespesaRow[]) {
  const dates = Array.from(new Set([...registos.map((registo) => registo.data), ...despesas.map((despesa) => despesa.data)]))
    .filter(Boolean)
    .sort();

  if (!dates.length) {
    return baseDiasFesta;
  }

  return dates.map((data, index) => ({
    id: `demo-dia-${data}`,
    data,
    nome: `Dia ${index + 1}`,
    fechado: false,
    fechado_por_id: null,
    fechado_por_nome: null,
    fechado_at: null,
    criado_por_id: null,
    criado_por_nome: "Sistema",
    atualizado_por_id: null,
    atualizado_por_nome: "Sistema",
    created_at: "2026-06-03T00:00:00.000Z",
    updated_at: "2026-06-03T00:00:00.000Z"
  }));
}

function sortDiasFesta(dias: DiaFesta[]) {
  return dias.slice().sort((a, b) => a.data.localeCompare(b.data));
}

function resolveSelectedDate(dias: DiaFesta[], currentDate: string) {
  if (!dias.length) {
    return "";
  }

  if (dias.some((dia) => dia.data === currentDate)) {
    return currentDate;
  }

  const openDay = dias.find((dia) => !dia.fechado);
  return openDay?.data ?? dias[0].data;
}

function formatDiaLabel(dia: DiaFesta | null) {
  if (!dia) {
    return "Sem dia criado";
  }

  return `${dia.nome} · ${formatDateLabel(dia.data)}`;
}

function readDemoStore(): DemoStore {
  if (typeof window === "undefined") {
    return { diasFesta: baseDiasFesta, postos: basePostos, registos: [], despesas: [], tiposDespesa: baseTiposDespesa };
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);

  if (!raw) {
    return { diasFesta: baseDiasFesta, postos: basePostos, registos: [], despesas: [], tiposDespesa: baseTiposDespesa };
  }

  try {
    const parsed = JSON.parse(raw) as Partial<DemoStore>;
    const registos = parsed.registos ?? [];
    const despesas = parsed.despesas ?? [];
    const diasFesta = parsed.diasFesta?.length ? sortDiasFesta(parsed.diasFesta) : buildDemoDias(registos, despesas);

    return {
      diasFesta,
      postos: parsed.postos?.length ? parsed.postos : basePostos,
      registos,
      despesas,
      tiposDespesa: parsed.tiposDespesa?.length ? parsed.tiposDespesa : baseTiposDespesa
    };
  } catch {
    return { diasFesta: baseDiasFesta, postos: basePostos, registos: [], despesas: [], tiposDespesa: baseTiposDespesa };
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

function attachPostosToDespesas(despesas: DespesaRow[], postos: Posto[]): Despesa[] {
  return despesas
    .map((despesa) => ({
      ...despesa,
      postos: postos.find((posto) => posto.id === despesa.posto_id) ?? null
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

function mapDespesaRpc(row: DespesaRpc): Despesa {
  const { posto_nome: postoNome, posto_responsavel: postoResponsavel, ...despesa } = row;

  return {
    ...despesa,
    postos: {
      id: row.posto_id,
      nome: postoNome ?? "Posto removido",
      responsavel: postoResponsavel
    }
  };
}

export function BillingApp({ mode = "overview" }: BillingAppProps) {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const isDemoMode = !hasSupabaseConfig || !supabase;
  const isOverviewMode = mode === "overview";
  const isRegisterMode = mode === "register";
  const isManagementMode = mode === "management";
  const startDate = useMemo(() => todayISO(), []);

  const [appSession, setAppSession] = useState<AppSession | null>(null);
  const [authLoading, setAuthLoading] = useState(Boolean(supabase));
  const [authUsername, setAuthUsername] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [selectedDate, setSelectedDate] = useState(startDate);
  const [form, setForm] = useState<RegistoForm>(() => emptyForm(startDate));
  const [despesaForm, setDespesaForm] = useState<DespesaForm>(() => emptyDespesaForm(startDate));
  const [diasFesta, setDiasFesta] = useState<DiaFesta[]>(baseDiasFesta);
  const [postos, setPostos] = useState<Posto[]>([]);
  const [registos, setRegistos] = useState<Registo[]>([]);
  const [despesas, setDespesas] = useState<Despesa[]>([]);
  const [tiposDespesa, setTiposDespesa] = useState<TipoDespesa[]>(baseTiposDespesa);
  const [utilizadores, setUtilizadores] = useState<Utilizador[]>([]);
  const [userForm, setUserForm] = useState<UserForm>(() => emptyUserForm());
  const [postoForm, setPostoForm] = useState<PostoForm>(() => emptyPostoForm());
  const [tipoDespesaForm, setTipoDespesaForm] = useState<TipoDespesaForm>(() => emptyTipoDespesaForm());
  const [diaForm, setDiaForm] = useState<DiaForm>(() => emptyDiaForm(startDate));
  const [entryTab, setEntryTab] = useState<EntryTab>("faturacao");
  const [sideTab, setSideTab] = useState<SideTab>("dias");
  const [demoOperator, setDemoOperator] = useState("Demonstração");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expenseSaving, setExpenseSaving] = useState(false);
  const [postoSaving, setPostoSaving] = useState(false);
  const [userSaving, setUserSaving] = useState(false);
  const [tipoDespesaSaving, setTipoDespesaSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const activePostos = useMemo(
    () => postos.filter((posto) => posto.ativo).sort((a, b) => a.nome.localeCompare(b.nome)),
    [postos]
  );

  const orderedDiasFesta = useMemo(() => sortDiasFesta(diasFesta), [diasFesta]);

  const selectedDia = useMemo(
    () => orderedDiasFesta.find((dia) => dia.data === selectedDate) ?? orderedDiasFesta[0] ?? null,
    [orderedDiasFesta, selectedDate]
  );

  const selectedDayLabel = useMemo(() => formatDiaLabel(selectedDia), [selectedDia]);
  const isSelectedDayClosed = Boolean(selectedDia?.fechado);
  const canEditSelectedDay = Boolean(selectedDia) && !isSelectedDayClosed;

  const orderedPostos = useMemo(
    () => postos.slice().sort((a, b) => Number(b.ativo) - Number(a.ativo) || a.nome.localeCompare(b.nome)),
    [postos]
  );

  const selectedPosto = useMemo(
    () => activePostos.find((posto) => posto.id === form.postoId) ?? activePostos[0] ?? null,
    [activePostos, form.postoId]
  );

  const selectedRegistos = useMemo(
    () => (selectedPosto ? registos.filter((registo) => registo.posto_id === selectedPosto.id) : []),
    [registos, selectedPosto]
  );

  const selectedDespesas = useMemo(
    () => (selectedPosto ? despesas.filter((despesa) => despesa.posto_id === selectedPosto.id) : []),
    [despesas, selectedPosto]
  );

  const postoFinancials = useMemo(() => {
    const next = new Map<
      string,
      {
        despesas: number;
        dinheiro: number;
        faturacao: number;
        mbway: number;
        multibanco: number;
      }
    >();

    for (const registo of registos) {
      const current = next.get(registo.posto_id) ?? {
        despesas: 0,
        dinheiro: 0,
        faturacao: 0,
        mbway: 0,
        multibanco: 0
      };
      current.dinheiro += Number(registo.dinheiro);
      current.multibanco += Number(registo.multibanco);
      current.mbway += Number(registo.mbway);
      current.faturacao += Number(registo.dinheiro) + Number(registo.multibanco) + Number(registo.mbway);
      next.set(registo.posto_id, current);
    }

    for (const despesa of despesas) {
      const current = next.get(despesa.posto_id) ?? {
        despesas: 0,
        dinheiro: 0,
        faturacao: 0,
        mbway: 0,
        multibanco: 0
      };
      current.despesas += Number(despesa.valor);
      next.set(despesa.posto_id, current);
    }

    return next;
  }, [despesas, registos]);

  const activeTiposDespesa = useMemo(
    () => tiposDespesa.filter((tipo) => tipo.ativo).sort((a, b) => a.nome.localeCompare(b.nome)),
    [tiposDespesa]
  );

  const dailyTotals = useMemo(() => {
    return registos.reduce(
      (acc, registo) => {
        acc.dinheiro += Number(registo.dinheiro);
        acc.multibanco += Number(registo.multibanco);
        acc.mbway += Number(registo.mbway);
        acc.total += Number(registo.dinheiro) + Number(registo.multibanco) + Number(registo.mbway);
        return acc;
      },
      { dinheiro: 0, mbway: 0, multibanco: 0, total: 0 }
    );
  }, [registos]);

  const selectedTotals = useMemo(() => {
    return selectedRegistos.reduce(
      (acc, registo) => {
        acc.dinheiro += Number(registo.dinheiro);
        acc.multibanco += Number(registo.multibanco);
        acc.mbway += Number(registo.mbway);
        acc.total += Number(registo.dinheiro) + Number(registo.multibanco) + Number(registo.mbway);
        return acc;
      },
      { dinheiro: 0, multibanco: 0, mbway: 0, total: 0 }
    );
  }, [selectedRegistos]);

  const selectedDespesasTotal = useMemo(() => {
    return selectedDespesas.reduce((acc, despesa) => acc + Number(despesa.valor), 0);
  }, [selectedDespesas]);

  const dailyDespesasTotal = useMemo(() => {
    return despesas.reduce((acc, despesa) => acc + Number(despesa.valor), 0);
  }, [despesas]);

  const postosRegistados = useMemo(
    () => new Set(registos.map((registo) => registo.posto_id)).size,
    [registos]
  );

  const registeredPostoIds = useMemo(
    () => new Set(registos.map((registo) => registo.posto_id)),
    [registos]
  );

  const dailySaldo = dailyTotals.total - dailyDespesasTotal;
  const selectedSaldo = selectedTotals.total - selectedDespesasTotal;

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
      const nextDias = sortDiasFesta(store.diasFesta);
      const effectiveDate = resolveSelectedDate(nextDias, selectedDate);

      setDiasFesta(nextDias);
      if (effectiveDate !== selectedDate) {
        setSelectedDate(effectiveDate);
        setForm((current) => ({ ...current, data: effectiveDate }));
        setDespesaForm((current) => ({ ...current, data: effectiveDate }));
      }
      setPostos(store.postos);
      setTiposDespesa(store.tiposDespesa);
      setRegistos(attachPostos(store.registos.filter((registo) => registo.data === effectiveDate), store.postos));
      setDespesas(
        attachPostosToDespesas(store.despesas.filter((despesa) => despesa.data === effectiveDate), store.postos)
      );
      return;
    }

    if (!supabase || !sessionToken) {
      return;
    }

    setLoading(true);

    const [diasResult, postosResult, tiposDespesaResult] = await Promise.all([
      supabase.rpc("app_listar_dias", { p_token: sessionToken }),
      supabase.rpc("app_listar_postos", { p_token: sessionToken }),
      supabase.rpc("app_listar_tipos_despesa", { p_token: sessionToken })
    ]);

    if (diasResult.error) {
      setLoading(false);
      setError(diasResult.error.message);
      return;
    }

    if (postosResult.error) {
      setLoading(false);
      setError(postosResult.error.message);
      return;
    }

    const nextDias = sortDiasFesta(diasResult.data ?? []);
    const effectiveDate = resolveSelectedDate(nextDias, selectedDate);

    setDiasFesta(nextDias);
    if (effectiveDate !== selectedDate) {
      setSelectedDate(effectiveDate);
      setForm((current) => ({ ...current, data: effectiveDate }));
      setDespesaForm((current) => ({ ...current, data: effectiveDate }));
    }
    setPostos(postosResult.data ?? []);

    if (tiposDespesaResult.error) {
      setLoading(false);
      setTiposDespesa(baseTiposDespesa);
      setError(tiposDespesaResult.error.message);
      return;
    }

    setTiposDespesa(tiposDespesaResult.data?.length ? tiposDespesaResult.data : baseTiposDespesa);

    if (!effectiveDate) {
      setRegistos([]);
      setDespesas([]);
      setLoading(false);
      return;
    }

    const [registosResult, despesasResult] = await Promise.all([
      supabase.rpc("app_listar_registos", { p_token: sessionToken, p_data: effectiveDate }),
      supabase.rpc("app_listar_despesas", { p_token: sessionToken, p_data: effectiveDate })
    ]);

    setLoading(false);

    if (registosResult.error) {
      setError(registosResult.error.message);
      return;
    }

    if (despesasResult.error) {
      setError(despesasResult.error.message);
      return;
    }

    setRegistos((registosResult.data ?? []).map(mapRegistoRpc));
    setDespesas((despesasResult.data ?? []).map(mapDespesaRpc));
  }, [isDemoMode, selectedDate, sessionToken, supabase]);

  useEffect(() => {
    if (!supabase) {
      setAuthLoading(false);
      setDemoOperator(readDemoOperator());
      return;
    }

    const client = supabase;
    const storedSession = readStoredSession();

    if (!storedSession) {
      setAuthLoading(false);
      return;
    }

    const storedToken = storedSession.token;

    async function validateStoredSession() {
      try {
        const { data, error: sessionError } = await client.rpc("app_utilizador_por_token", {
          p_token: storedToken
        });

        if (sessionError || !data?.[0]) {
          clearStoredSession();
          setAppSession(null);
          return;
        }

        const validatedSession: AppSession = {
          token: storedToken,
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
    setForm((current) => ({ ...current, data: selectedDate }));
    setDespesaForm((current) => ({ ...current, data: selectedDate }));
  }, [selectedDate]);

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
    const hasSelectedPosto = activePostos.some((posto) => posto.id === form.postoId);

    if (!hasSelectedPosto && activePostos[0]) {
      setForm((current) => ({ ...current, postoId: activePostos[0].id }));
    }
  }, [activePostos, form.postoId]);

  useEffect(() => {
    const hasSelectedPosto = activePostos.some((posto) => posto.id === despesaForm.postoId);

    if (!hasSelectedPosto && activePostos[0]) {
      setDespesaForm((current) => ({ ...current, postoId: activePostos[0].id }));
    }
  }, [activePostos, despesaForm.postoId]);

  useEffect(() => {
    if (despesaForm.id) {
      return;
    }

    if (!activeTiposDespesa.length && despesaForm.tipoDespesa) {
      setDespesaForm((current) => ({ ...current, tipoDespesa: "" }));
      return;
    }

    if (activeTiposDespesa[0]) {
      const hasSelectedType = activeTiposDespesa.some((tipo) => tipo.nome === despesaForm.tipoDespesa);

      if (!hasSelectedType) {
        setDespesaForm((current) => ({ ...current, tipoDespesa: activeTiposDespesa[0].nome }));
      }
    }
  }, [activeTiposDespesa, despesaForm.id, despesaForm.tipoDespesa]);

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
    setDespesas([]);
    setDiasFesta(baseDiasFesta);
    setPostos([]);
    setTiposDespesa(baseTiposDespesa);
    setUtilizadores([]);
  }

  function handleSelectDia(value: string) {
    setSelectedDate(value);
    setForm((current) => ({ ...current, data: value }));
    setDespesaForm((current) => ({ ...current, data: value }));
  }

  function handleSelectPosto(postoId: string) {
    setForm((current) => ({ ...current, postoId }));
    setDespesaForm((current) => ({ ...current, postoId }));
  }

  async function handleSaveDia(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");

    if (!diaForm.data) {
      setError("Indica a data do dia da festa.");
      return;
    }

    const nome = diaForm.nome.trim() || formatDateLabel(diaForm.data);

    if (isDemoMode) {
      const store = readDemoStore();
      const exists = store.diasFesta.some((dia) => dia.data === diaForm.data);

      if (exists) {
        setError("Esse dia já existe.");
        return;
      }

      const now = new Date().toISOString();
      const nextDia: DiaFesta = {
        id: makeId("dia"),
        data: diaForm.data,
        nome,
        fechado: false,
        fechado_por_id: null,
        fechado_por_nome: null,
        fechado_at: null,
        criado_por_id: null,
        criado_por_nome: currentUserName,
        atualizado_por_id: null,
        atualizado_por_nome: currentUserName,
        created_at: now,
        updated_at: now
      };
      const nextDias = sortDiasFesta([...store.diasFesta, nextDia]);

      writeDemoStore({ ...store, diasFesta: nextDias });
      setDiasFesta(nextDias);
      setDiaForm(emptyDiaForm(diaForm.data));
      handleSelectDia(nextDia.data);
      setRegistos([]);
      setDespesas([]);
      setNotice("Dia criado.");
      return;
    }

    if (!supabase || !sessionToken) {
      return;
    }

    const { data, error: diaError } = await supabase.rpc("app_guardar_dia", {
      p_token: sessionToken,
      p_data: diaForm.data,
      p_nome: nome
    });

    if (diaError || !data?.[0]) {
      setError(diaError?.message ?? "Não foi possível criar o dia.");
      return;
    }

    const savedDia = data[0];

    setDiaForm(emptyDiaForm(diaForm.data));
    setDiasFesta((current) =>
      sortDiasFesta([...current.filter((dia) => dia.id !== savedDia.id && dia.data !== savedDia.data), savedDia])
    );
    handleSelectDia(savedDia.data);
    setRegistos([]);
    setDespesas([]);
    setNotice("Dia criado.");
  }

  async function handleCloseDia(dia: DiaFesta) {
    const shouldClose = window.confirm(`Fechar "${dia.nome}"? Depois de fechado deixa de ser possível alterar registos desse dia.`);

    if (!shouldClose) {
      return;
    }

    setError("");
    setNotice("");

    if (isDemoMode) {
      const store = readDemoStore();
      const now = new Date().toISOString();
      const nextDias = sortDiasFesta(
        store.diasFesta.map((item) =>
          item.id === dia.id
            ? {
                ...item,
                fechado: true,
                fechado_por_nome: currentUserName,
                fechado_at: now,
                atualizado_por_nome: currentUserName,
                updated_at: now
              }
            : item
        )
      );

      writeDemoStore({ ...store, diasFesta: nextDias });
      setDiasFesta(nextDias);
      setNotice("Dia fechado.");
      await loadData();
      return;
    }

    if (!supabase || !sessionToken) {
      return;
    }

    const { error: closeError } = await supabase.rpc("app_fechar_dia", {
      p_token: sessionToken,
      p_id: dia.id
    });

    if (closeError) {
      setError(closeError.message);
      return;
    }

    setNotice("Dia fechado.");
    await loadData();
  }

  async function handleDeleteDia(dia: DiaFesta) {
    const password = window.prompt(`Password para apagar "${dia.nome}" e todos os movimentos desse dia`);

    if (password === null) {
      return;
    }

    setError("");
    setNotice("");

    if (isDemoMode) {
      if (password !== DELETE_DAY_PASSWORD) {
        setError("Password inválida.");
        return;
      }

      const store = readDemoStore();
      const nextDias = sortDiasFesta(store.diasFesta.filter((item) => item.id !== dia.id));
      const nextDate = resolveSelectedDate(nextDias, selectedDate === dia.data ? "" : selectedDate);

      writeDemoStore({
        ...store,
        diasFesta: nextDias,
        registos: store.registos.filter((registo) => registo.data !== dia.data),
        despesas: store.despesas.filter((despesa) => despesa.data !== dia.data)
      });
      setDiasFesta(nextDias);
      handleSelectDia(nextDate);
      setNotice("Dia apagado.");
      await loadData();
      return;
    }

    if (!supabase || !sessionToken) {
      return;
    }

    const { error: deleteError } = await supabase.rpc("app_apagar_dia", {
      p_token: sessionToken,
      p_id: dia.id,
      p_password: password
    });

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    setNotice("Dia apagado.");
    await loadData();
  }

  async function handleSavePosto(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");

    const nome = postoForm.nome.trim();

    if (!nome) {
      setError("Indica o nome do posto.");
      return;
    }

    if (isDemoMode) {
      const store = readDemoStore();
      const exists = store.postos.some(
        (posto) => posto.id !== postoForm.id && posto.nome.toLowerCase() === nome.toLowerCase()
      );

      if (exists) {
        setError("Esse posto já existe.");
        return;
      }

      const existingIndex = postoForm.id ? store.postos.findIndex((posto) => posto.id === postoForm.id) : -1;
      const existingPosto = existingIndex >= 0 ? store.postos[existingIndex] : null;
      const nextPosto: Posto = {
        id: existingPosto?.id ?? makeId("posto"),
        nome,
        responsavel: postoForm.responsavel.trim() || null,
        ativo: postoForm.ativo,
        created_at: existingPosto?.created_at ?? new Date().toISOString()
      };

      const nextPostos =
        existingIndex >= 0
          ? store.postos.map((posto, index) => (index === existingIndex ? nextPosto : posto))
          : [...store.postos, nextPosto];

      writeDemoStore({ ...store, postos: nextPostos });
      setPostoForm(emptyPostoForm());
      setNotice("Posto guardado.");
      await loadData();
      return;
    }

    if (!supabase || !sessionToken) {
      return;
    }

    setPostoSaving(true);

    const { error: saveError } = await supabase.rpc("app_guardar_posto", {
      p_token: sessionToken,
      p_id: postoForm.id,
      p_nome: nome,
      p_responsavel: postoForm.responsavel.trim() || null,
      p_ativo: postoForm.ativo
    });

    setPostoSaving(false);

    if (saveError) {
      setError(saveError.message);
      return;
    }

    setPostoForm(emptyPostoForm());
    setNotice("Posto guardado.");
    await loadData();
  }

  async function handleDeletePosto(posto: Posto) {
    const shouldDelete = window.confirm(`Eliminar o posto "${posto.nome}"?`);

    if (!shouldDelete) {
      return;
    }

    setError("");
    setNotice("");

    if (isDemoMode) {
      const store = readDemoStore();
      writeDemoStore({
        ...store,
        postos: store.postos.map((item) => (item.id === posto.id ? { ...item, ativo: false } : item))
      });
      setPostoForm((current) => (current.id === posto.id ? emptyPostoForm() : current));
      setNotice("Posto eliminado.");
      await loadData();
      return;
    }

    if (!supabase || !sessionToken) {
      return;
    }

    const { error: deleteError } = await supabase.rpc("app_apagar_posto", {
      p_token: sessionToken,
      p_id: posto.id
    });

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    setPostoForm((current) => (current.id === posto.id ? emptyPostoForm() : current));
    setNotice("Posto eliminado.");
    await loadData();
  }

  function handleEditPosto(posto: Posto) {
    setPostoForm({
      id: posto.id,
      nome: posto.nome,
      responsavel: posto.responsavel ?? "",
      ativo: posto.ativo
    });
  }

  async function handleSaveTipoDespesa(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");

    const nome = tipoDespesaForm.nome.trim();

    if (!nome) {
      setError("Indica o nome do tipo de despesa.");
      return;
    }

    if (isDemoMode) {
      const store = readDemoStore();
      const exists = store.tiposDespesa.some(
        (tipo) => tipo.id !== tipoDespesaForm.id && tipo.nome.toLowerCase() === nome.toLowerCase()
      );

      if (exists) {
        setError("Esse tipo de despesa já existe.");
        return;
      }

      const existingIndex = tipoDespesaForm.id
        ? store.tiposDespesa.findIndex((tipo) => tipo.id === tipoDespesaForm.id)
        : -1;
      const existingTipo = existingIndex >= 0 ? store.tiposDespesa[existingIndex] : null;
      const now = new Date().toISOString();
      const nextTipo: TipoDespesa = {
        id: existingTipo?.id ?? makeId("tipo-despesa"),
        nome,
        ativo: tipoDespesaForm.ativo,
        criado_por_id: existingTipo?.criado_por_id ?? null,
        criado_por_nome: existingTipo?.criado_por_nome ?? currentUserName,
        atualizado_por_id: null,
        atualizado_por_nome: currentUserName,
        created_at: existingTipo?.created_at ?? now,
        updated_at: now
      };

      const nextTipos =
        existingIndex >= 0
          ? store.tiposDespesa.map((tipo, index) => (index === existingIndex ? nextTipo : tipo))
          : [...store.tiposDespesa, nextTipo];

      writeDemoStore({ ...store, tiposDespesa: nextTipos });
      setTiposDespesa(nextTipos);
      setTipoDespesaForm(emptyTipoDespesaForm());
      setNotice("Tipo de despesa guardado.");
      return;
    }

    if (!supabase || !sessionToken) {
      return;
    }

    setTipoDespesaSaving(true);

    const { error: tipoError } = await supabase.rpc("app_guardar_tipo_despesa", {
      p_token: sessionToken,
      p_id: tipoDespesaForm.id,
      p_nome: nome,
      p_ativo: tipoDespesaForm.ativo
    });

    setTipoDespesaSaving(false);

    if (tipoError) {
      setError(tipoError.message);
      return;
    }

    setTipoDespesaForm(emptyTipoDespesaForm());
    setNotice("Tipo de despesa guardado.");
    await loadData();
  }

  function handleEditTipoDespesa(tipo: TipoDespesa) {
    setTipoDespesaForm({
      id: tipo.id,
      nome: tipo.nome,
      ativo: tipo.ativo
    });
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

    if (!selectedDia) {
      setSaving(false);
      setError("Cria ou seleciona um dia da festa.");
      return;
    }

    if (isSelectedDayClosed) {
      setSaving(false);
      setError("Este dia está fechado e já não permite alterações.");
      return;
    }

    const payload = {
      posto_id: form.postoId,
      data: selectedDia.data,
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
    if (isSelectedDayClosed) {
      setError("Este dia está fechado e já não permite alterações.");
      return;
    }

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
    if (isSelectedDayClosed) {
      setError("Este dia está fechado e já não permite alterações.");
      return;
    }

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

  async function handleSaveDespesa(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setExpenseSaving(true);
    setError("");
    setNotice("");

    if (!despesaForm.postoId) {
      setExpenseSaving(false);
      setError("Escolhe um posto para a despesa.");
      return;
    }

    if (!selectedDia) {
      setExpenseSaving(false);
      setError("Cria ou seleciona um dia da festa.");
      return;
    }

    if (isSelectedDayClosed) {
      setExpenseSaving(false);
      setError("Este dia está fechado e já não permite alterações.");
      return;
    }

    if (!despesaForm.tipoDespesa.trim()) {
      setExpenseSaving(false);
      setError("Escolhe o tipo de despesa.");
      return;
    }

    if (!despesaForm.numeroDespesa.trim()) {
      setExpenseSaving(false);
      setError("Indica o número da despesa.");
      return;
    }

    if (despesaForm.faturaPaga && !despesaForm.numeroFatura.trim()) {
      setExpenseSaving(false);
      setError("Indica o número da fatura paga.");
      return;
    }

    const valor = parseMoney(despesaForm.valor);

    if (valor < 0) {
      setExpenseSaving(false);
      setError("O valor da despesa não pode ser negativo.");
      return;
    }

    const payload = {
      id: despesaForm.id,
      posto_id: despesaForm.postoId,
      data: selectedDia.data,
      tipo_despesa: despesaForm.tipoDespesa.trim(),
      numero_despesa: despesaForm.numeroDespesa.trim(),
      valor,
      fatura_paga: despesaForm.faturaPaga,
      numero_fatura: despesaForm.faturaPaga ? despesaForm.numeroFatura.trim() || null : null,
      observacoes: despesaForm.observacoes.trim() || null
    };

    if (isDemoMode) {
      const store = readDemoStore();
      const existingIndex = payload.id
        ? store.despesas.findIndex((despesa) => despesa.id === payload.id)
        : -1;
      const existingDespesa = existingIndex >= 0 ? store.despesas[existingIndex] : null;
      const now = new Date().toISOString();
      const nextDespesa: DespesaRow = {
        ...payload,
        id: existingDespesa?.id ?? makeId("despesa"),
        created_at: existingDespesa?.created_at ?? now,
        updated_at: now,
        criado_por_id: existingDespesa?.criado_por_id ?? null,
        criado_por_nome: existingDespesa?.criado_por_nome ?? currentUserName,
        atualizado_por_id: null,
        atualizado_por_nome: currentUserName
      };

      const nextDespesas =
        existingIndex >= 0
          ? store.despesas.map((despesa, index) => (index === existingIndex ? nextDespesa : despesa))
          : [...store.despesas, nextDespesa];

      writeDemoStore({ ...store, despesas: nextDespesas });
      setNotice("Despesa guardada.");
      setDespesaForm((current) => ({ ...emptyDespesaForm(current.data), postoId: current.postoId }));
      setExpenseSaving(false);
      await loadData();
      return;
    }

    if (!supabase || !sessionToken) {
      setExpenseSaving(false);
      return;
    }

    const { error: saveError } = await supabase.rpc("app_guardar_despesa", {
      p_token: sessionToken,
      p_id: payload.id,
      p_posto_id: payload.posto_id,
      p_data: payload.data,
      p_tipo_despesa: payload.tipo_despesa,
      p_numero_despesa: payload.numero_despesa,
      p_valor: payload.valor,
      p_fatura_paga: payload.fatura_paga,
      p_numero_fatura: payload.numero_fatura,
      p_observacoes: payload.observacoes
    });

    setExpenseSaving(false);

    if (saveError) {
      setError(saveError.message);
      return;
    }

    setNotice("Despesa guardada.");
    setDespesaForm((current) => ({ ...emptyDespesaForm(current.data), postoId: current.postoId }));
    await loadData();
  }

  async function handleDeleteDespesa(id: string) {
    if (isSelectedDayClosed) {
      setError("Este dia está fechado e já não permite alterações.");
      return;
    }

    const shouldDelete = window.confirm("Apagar esta despesa?");

    if (!shouldDelete) {
      return;
    }

    setError("");
    setNotice("");

    if (isDemoMode) {
      const store = readDemoStore();
      writeDemoStore({
        ...store,
        despesas: store.despesas.filter((despesa) => despesa.id !== id)
      });
      setNotice("Despesa apagada.");
      await loadData();
      return;
    }

    if (!supabase || !sessionToken) {
      return;
    }

    const { error: deleteError } = await supabase.rpc("app_apagar_despesa", {
      p_token: sessionToken,
      p_id: id
    });

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    setNotice("Despesa apagada.");
    await loadData();
  }

  function handleEditDespesa(despesa: Despesa) {
    if (isSelectedDayClosed) {
      setError("Este dia está fechado e já não permite alterações.");
      return;
    }

    setEntryTab("despesas");
    setDespesaForm({
      id: despesa.id,
      postoId: despesa.posto_id,
      data: despesa.data,
      tipoDespesa: despesa.tipo_despesa,
      numeroDespesa: despesa.numero_despesa,
      valor: String(Number(despesa.valor).toFixed(2)),
      faturaPaga: despesa.fatura_paga,
      numeroFatura: despesa.numero_fatura ?? "",
      observacoes: despesa.observacoes ?? ""
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
          <h1>{isOverviewMode ? "Overview diário" : isRegisterMode ? "Registo diário" : "Gestão"}</h1>
        </div>

        <div className="top-actions">
          {!isManagementMode ? (
            <label className="date-control">
              <CalendarDays size={18} aria-hidden="true" />
              <select value={selectedDia?.data ?? ""} onChange={(event) => handleSelectDia(event.target.value)}>
                {orderedDiasFesta.length ? null : <option value="">Criar dia na Gestão</option>}
                {orderedDiasFesta.map((dia) => (
                  <option key={dia.id} value={dia.data}>
                    {dia.nome} · {formatDateLabel(dia.data)} {dia.fechado ? "· fechado" : ""}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

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

      <nav className="app-nav" aria-label="Navegação principal">
        <Link className={`app-nav-link ${isOverviewMode ? "active" : ""}`} href="/">
          <Home size={18} aria-hidden="true" />
          Overview
        </Link>
        <Link className={`app-nav-link ${isRegisterMode ? "active" : ""}`} href="/registo">
          <Euro size={18} aria-hidden="true" />
          Registo
        </Link>
        <Link className={`app-nav-link ${isManagementMode ? "active" : ""}`} href="/gestao">
          <Settings size={18} aria-hidden="true" />
          Gestão
        </Link>
      </nav>

      {isOverviewMode ? (
        <section className="summary-grid" aria-label="Totais do dia">
          <article className="metric metric-total">
            <span>Total do dia</span>
            <strong>{formatCurrency(dailyTotals.total)}</strong>
            <small>{selectedDayLabel}</small>
          </article>
          <article className="metric">
            <span>Despesas</span>
            <strong>{formatCurrency(dailyDespesasTotal)}</strong>
          </article>
          <article className="metric">
            <span>Saldo</span>
            <strong>{formatCurrency(dailySaldo)}</strong>
          </article>
          <article className="metric">
            <span>Dinheiro</span>
            <strong>{formatCurrency(dailyTotals.dinheiro)}</strong>
          </article>
          <article className="metric">
            <span>Multibanco</span>
            <strong>{formatCurrency(dailyTotals.multibanco)}</strong>
          </article>
          <article className="metric">
            <span>MB Way</span>
            <strong>{formatCurrency(dailyTotals.mbway)}</strong>
          </article>
          <article className="metric">
            <span>Postos registados</span>
            <strong>
              {postosRegistados}/{activePostos.length}
            </strong>
          </article>
          <article className="metric">
            <span>Estado do dia</span>
            <strong>{isSelectedDayClosed ? "Fechado" : selectedDia ? "Aberto" : "Sem dia"}</strong>
          </article>
        </section>
      ) : null}

      {isRegisterMode ? (
        <section className="summary-grid" aria-label="Totais do dia">
          <article className="metric metric-total">
            <span>Total do posto</span>
            <strong>{formatCurrency(selectedTotals.total)}</strong>
            <small>{selectedPosto?.nome ?? selectedDayLabel}</small>
          </article>
          <article className="metric">
            <span>Despesas</span>
            <strong>{formatCurrency(selectedDespesasTotal)}</strong>
          </article>
          <article className="metric">
            <span>Saldo</span>
            <strong>{formatCurrency(selectedSaldo)}</strong>
          </article>
          <article className="metric">
            <span>Dinheiro</span>
            <strong>{formatCurrency(selectedTotals.dinheiro)}</strong>
          </article>
          <article className="metric">
            <span>Multibanco</span>
            <strong>{formatCurrency(selectedTotals.multibanco)}</strong>
          </article>
          <article className="metric">
            <span>MB Way</span>
            <strong>{formatCurrency(selectedTotals.mbway)}</strong>
          </article>
          <article className="metric">
            <span>Estado do dia</span>
            <strong>{isSelectedDayClosed ? "Fechado" : selectedRegistos.length ? "Registado" : "Aberto"}</strong>
            <small>{selectedDayLabel}</small>
          </article>
        </section>
      ) : null}

      <div className="messages">
        {isRegisterMode && !selectedDia ? (
          <div className="alert error">Cria primeiro um dia da festa na Gestão.</div>
        ) : null}
        {isRegisterMode && isSelectedDayClosed ? (
          <div className="alert success">Dia fechado: podes consultar, mas já não é possível alterar.</div>
        ) : null}
        {notice ? <div className="alert success">{notice}</div> : null}
        {error ? <div className="alert error">{error}</div> : null}
      </div>

      {isOverviewMode ? (
        <section className="panel">
          <div className="panel-heading table-heading">
            <div>
              <p className="eyebrow">Overview</p>
              <h2>{selectedDayLabel}</h2>
            </div>
            <Link className="icon-text-button" href="/registo">
              <Euro size={18} aria-hidden="true" />
              Registar
            </Link>
          </div>

          {loading ? (
            <div className="empty-state">A carregar overview.</div>
          ) : !selectedDia ? (
            <div className="empty-state">Cria primeiro um dia da festa na Gestão.</div>
          ) : activePostos.length ? (
            <div className="table-wrap">
              <table className="overview-table">
                <thead>
                  <tr>
                    <th>Posto</th>
                    <th>Faturação</th>
                    <th>Despesas</th>
                    <th>Saldo</th>
                    <th>Dinheiro</th>
                    <th>Multibanco</th>
                    <th>MB Way</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {activePostos.map((posto) => {
                    const summary = postoFinancials.get(posto.id) ?? {
                      despesas: 0,
                      dinheiro: 0,
                      faturacao: 0,
                      mbway: 0,
                      multibanco: 0
                    };
                    const saldo = summary.faturacao - summary.despesas;

                    return (
                      <tr key={posto.id}>
                        <td>
                          <strong>{posto.nome}</strong>
                          <span>{posto.responsavel || "Sem responsável"}</span>
                        </td>
                        <td>
                          <strong>{formatCurrency(summary.faturacao)}</strong>
                        </td>
                        <td>{formatCurrency(summary.despesas)}</td>
                        <td>
                          <strong>{formatCurrency(saldo)}</strong>
                        </td>
                        <td>{formatCurrency(summary.dinheiro)}</td>
                        <td>{formatCurrency(summary.multibanco)}</td>
                        <td>{formatCurrency(summary.mbway)}</td>
                        <td>{registeredPostoIds.has(posto.id) ? "Registado" : "Por registar"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state">Sem postos ativos.</div>
          )}
        </section>
      ) : null}

      {isRegisterMode ? (
        <section className="posto-folder" aria-label="Postos">
          {activePostos.length ? (
            <div className="posto-tabs" role="tablist" aria-label="Selecionar posto">
              {activePostos.map((posto) => {
                const postoSummary = postoFinancials.get(posto.id) ?? { despesas: 0, faturacao: 0 };

                return (
                  <button
                    className={`posto-tab ${selectedPosto?.id === posto.id ? "active" : ""}`}
                    type="button"
                    key={posto.id}
                    onClick={() => handleSelectPosto(posto.id)}
                  >
                    <strong>{posto.nome}</strong>
                    <span>{posto.responsavel || "Sem responsável"}</span>
                    <small>
                      {formatCurrency(postoSummary.faturacao)} / {formatCurrency(postoSummary.despesas)}
                    </small>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="empty-state">Sem postos ativos.</div>
          )}
        </section>
      ) : null}

      {!isOverviewMode ? (
        <div className={`workspace-grid ${isManagementMode ? "management-workspace" : "home-workspace"}`}>
          {isRegisterMode ? (
            <section className="panel entry-panel">
              <div className="side-tabs entry-tabs" role="tablist" aria-label="Tipo de registo">
                <button
                  className={`tab-button ${entryTab === "faturacao" ? "active" : ""}`}
                  type="button"
                  onClick={() => setEntryTab("faturacao")}
                >
                  <Euro size={18} aria-hidden="true" />
                  Faturação
                </button>
                <button
                  className={`tab-button ${entryTab === "despesas" ? "active" : ""}`}
                  type="button"
                  onClick={() => setEntryTab("despesas")}
                >
                  <Receipt size={18} aria-hidden="true" />
                  Despesas
                </button>
              </div>

              <div className="panel-heading">
                <div className="heading-icon">
                  {entryTab === "faturacao" ? (
                    <Euro size={20} aria-hidden="true" />
                  ) : (
                    <Receipt size={20} aria-hidden="true" />
                  )}
                </div>
                <div>
                  <p className="eyebrow">{selectedPosto?.nome ?? "Sem posto selecionado"}</p>
                  <h2>{entryTab === "faturacao" ? "Faturação" : "Despesas"}</h2>
                  {selectedPosto?.responsavel ? (
                    <span className="panel-subtitle">{selectedPosto.responsavel}</span>
                  ) : null}
                </div>
              </div>

              {entryTab === "faturacao" ? (
                <form className="form-grid" onSubmit={handleSaveRegisto}>
                  <label>
                    Dia
                    <input value={selectedDayLabel} readOnly disabled />
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

              <button
                className="primary-button wide-field"
                type="submit"
                disabled={saving || !activePostos.length || !canEditSelectedDay}
              >
                <Save size={18} aria-hidden="true" />
                {isSelectedDayClosed ? "Dia fechado" : saving ? "A guardar" : "Guardar registo"}
              </button>
            </form>
          ) : (
            <form className="form-grid" onSubmit={handleSaveDespesa}>
              <label>
                Dia
                <input value={selectedDayLabel} readOnly disabled />
              </label>

              <label>
                Tipo de despesa
                <select
                  value={despesaForm.tipoDespesa}
                  onChange={(event) =>
                    setDespesaForm((current) => ({ ...current, tipoDespesa: event.target.value }))
                  }
                  required
                >
                  <option value="">Escolher tipo</option>
                  {despesaForm.id &&
                  despesaForm.tipoDespesa &&
                  !activeTiposDespesa.some((tipo) => tipo.nome === despesaForm.tipoDespesa) ? (
                    <option value={despesaForm.tipoDespesa}>{despesaForm.tipoDespesa}</option>
                  ) : null}
                  {activeTiposDespesa.map((tipo) => (
                    <option key={tipo.id} value={tipo.nome}>
                      {tipo.nome}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Nº despesa
                <input
                  value={despesaForm.numeroDespesa}
                  onChange={(event) =>
                    setDespesaForm((current) => ({ ...current, numeroDespesa: event.target.value }))
                  }
                  placeholder="Ex.: D-001"
                  required
                />
              </label>

              <label>
                Valor
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={despesaForm.valor}
                  onChange={(event) => setDespesaForm((current) => ({ ...current, valor: event.target.value }))}
                />
              </label>

              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={despesaForm.faturaPaga}
                  onChange={(event) =>
                    setDespesaForm((current) => ({
                      ...current,
                      faturaPaga: event.target.checked,
                      numeroFatura: event.target.checked ? current.numeroFatura : ""
                    }))
                  }
                />
                Fatura paga
              </label>

              <label>
                Nº fatura
                <input
                  value={despesaForm.numeroFatura}
                  onChange={(event) =>
                    setDespesaForm((current) => ({ ...current, numeroFatura: event.target.value }))
                  }
                  placeholder="Ex.: FT 2026/001"
                  disabled={!despesaForm.faturaPaga}
                  required={despesaForm.faturaPaga}
                />
              </label>

              <label className="wide-field">
                Observações
                <textarea
                  value={despesaForm.observacoes}
                  onChange={(event) =>
                    setDespesaForm((current) => ({ ...current, observacoes: event.target.value }))
                  }
                  rows={3}
                />
              </label>

              <div className="form-actions wide-field">
                <button
                  className="primary-button"
                  type="submit"
                  disabled={
                    expenseSaving ||
                    !activePostos.length ||
                    !canEditSelectedDay ||
                    (!despesaForm.id && !activeTiposDespesa.length)
                  }
                >
                  <Save size={18} aria-hidden="true" />
                  {isSelectedDayClosed
                    ? "Dia fechado"
                    : expenseSaving
                      ? "A guardar"
                      : despesaForm.id
                        ? "Guardar despesa"
                        : "Criar despesa"}
                </button>
                {despesaForm.id ? (
                  <button
                    className="icon-text-button"
                    type="button"
                    onClick={() =>
                      setDespesaForm((current) => ({ ...emptyDespesaForm(current.data), postoId: current.postoId }))
                    }
                  >
                    <X size={18} aria-hidden="true" />
                    Cancelar
                  </button>
                ) : null}
              </div>
            </form>
          )}
            </section>
          ) : null}

          {isManagementMode ? (
            <section className="panel side-panel">
              <div className="side-tabs" role="tablist" aria-label="Gestão">
                <button
                  className={`tab-button ${sideTab === "dias" ? "active" : ""}`}
                  type="button"
                  onClick={() => setSideTab("dias")}
                >
                  <CalendarDays size={18} aria-hidden="true" />
                  Dias
                </button>
                <button
                  className={`tab-button ${sideTab === "postos" ? "active" : ""}`}
                  type="button"
                  onClick={() => setSideTab("postos")}
                >
                  <Building2 size={18} aria-hidden="true" />
                  Postos
                </button>
                <button
                  className={`tab-button ${sideTab === "tipos" ? "active" : ""}`}
                  type="button"
                  onClick={() => setSideTab("tipos")}
                >
                  <Tags size={18} aria-hidden="true" />
                  Tipos
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

          {sideTab === "dias" ? (
            <>
              <div className="panel-heading">
                <div className="heading-icon">
                  <CalendarDays size={20} aria-hidden="true" />
                </div>
                <div>
                  <p className="eyebrow">Dias da festa</p>
                  <h2>Criação e fecho diário</h2>
                </div>
              </div>

              <form className="dia-form" onSubmit={handleSaveDia}>
                <label>
                  Data
                  <input
                    type="date"
                    value={diaForm.data}
                    onChange={(event) => setDiaForm((current) => ({ ...current, data: event.target.value }))}
                    required
                  />
                </label>
                <label>
                  Nome do dia
                  <input
                    value={diaForm.nome}
                    onChange={(event) => setDiaForm((current) => ({ ...current, nome: event.target.value }))}
                    placeholder="Ex.: Sexta-feira"
                  />
                </label>
                <div className="user-form-actions">
                  <button className="secondary-button" type="submit">
                    <Plus size={18} aria-hidden="true" />
                    Criar dia
                  </button>
                </div>
              </form>

              <div className="dia-list">
                {orderedDiasFesta.length ? (
                  orderedDiasFesta.map((dia) => (
                    <div className="dia-row" key={dia.id}>
                      <div>
                        <strong>{dia.nome}</strong>
                        <span>
                          {formatDateLabel(dia.data)} · {dia.fechado ? "fechado" : "aberto"}
                          {dia.fechado_por_nome ? ` por ${dia.fechado_por_nome}` : ""}
                        </span>
                      </div>
                      <div className="row-actions">
                        <button
                          className="icon-text-button"
                          type="button"
                          onClick={() => void handleCloseDia(dia)}
                          disabled={dia.fechado}
                        >
                          <X size={18} aria-hidden="true" />
                          Fechar
                        </button>
                        <button
                          className="icon-button danger"
                          type="button"
                          title="Apagar dia"
                          aria-label="Apagar dia"
                          onClick={() => void handleDeleteDia(dia)}
                        >
                          <Trash2 size={17} aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="empty-state">Sem dias criados.</div>
                )}
              </div>
            </>
          ) : sideTab === "postos" ? (
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

              <form className="posto-form" onSubmit={handleSavePosto}>
                <label>
                  Nome
                  <input
                    value={postoForm.nome}
                    onChange={(event) => setPostoForm((current) => ({ ...current, nome: event.target.value }))}
                    placeholder="Ex.: Bar palco"
                    required
                  />
                </label>
                <label>
                  Responsável
                  <input
                    value={postoForm.responsavel}
                    onChange={(event) =>
                      setPostoForm((current) => ({ ...current, responsavel: event.target.value }))
                    }
                    placeholder="Nome ou equipa"
                  />
                </label>
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={postoForm.ativo}
                    onChange={(event) => setPostoForm((current) => ({ ...current, ativo: event.target.checked }))}
                  />
                  Ativo
                </label>
                <div className="user-form-actions">
                  <button className="secondary-button" type="submit" disabled={postoSaving}>
                    {postoForm.id ? <Save size={18} aria-hidden="true" /> : <Plus size={18} aria-hidden="true" />}
                    {postoSaving ? "A guardar" : postoForm.id ? "Guardar" : "Criar"}
                  </button>
                  {postoForm.id ? (
                    <button className="icon-text-button" type="button" onClick={() => setPostoForm(emptyPostoForm())}>
                      <X size={18} aria-hidden="true" />
                      Cancelar
                    </button>
                  ) : null}
                </div>
              </form>

              <div className="posto-list">
                {orderedPostos.map((posto) => (
                  <div className="posto-row" key={posto.id}>
                    <div>
                      <strong>{posto.nome}</strong>
                      <span>
                        {posto.responsavel || "Sem responsável"} · {posto.ativo ? "ativo" : "inativo"}
                      </span>
                    </div>
                    <div className="row-actions">
                      <button
                        className="icon-button"
                        type="button"
                        title="Editar posto"
                        aria-label="Editar posto"
                        onClick={() => handleEditPosto(posto)}
                      >
                        <Pencil size={17} aria-hidden="true" />
                      </button>
                      <button
                        className="icon-button danger"
                        type="button"
                        title="Eliminar posto"
                        aria-label="Eliminar posto"
                        onClick={() => void handleDeletePosto(posto)}
                        disabled={!posto.ativo}
                      >
                        <Trash2 size={17} aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : sideTab === "tipos" ? (
            <>
              <div className="panel-heading">
                <div className="heading-icon">
                  <Tags size={20} aria-hidden="true" />
                </div>
                <div>
                  <p className="eyebrow">Despesas</p>
                  <h2>Tipos de despesa</h2>
                </div>
              </div>

              <form className="tipo-form" onSubmit={handleSaveTipoDespesa}>
                <label>
                  Nome
                  <input
                    value={tipoDespesaForm.nome}
                    onChange={(event) =>
                      setTipoDespesaForm((current) => ({ ...current, nome: event.target.value }))
                    }
                    placeholder="Ex.: Alimentação"
                    required
                  />
                </label>
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={tipoDespesaForm.ativo}
                    onChange={(event) =>
                      setTipoDespesaForm((current) => ({ ...current, ativo: event.target.checked }))
                    }
                  />
                  Ativo
                </label>
                <div className="user-form-actions">
                  <button className="secondary-button" type="submit" disabled={tipoDespesaSaving}>
                    <Save size={18} aria-hidden="true" />
                    {tipoDespesaSaving ? "A guardar" : tipoDespesaForm.id ? "Guardar" : "Criar"}
                  </button>
                  {tipoDespesaForm.id ? (
                    <button
                      className="icon-text-button"
                      type="button"
                      onClick={() => setTipoDespesaForm(emptyTipoDespesaForm())}
                    >
                      <X size={18} aria-hidden="true" />
                      Cancelar
                    </button>
                  ) : null}
                </div>
              </form>

              <div className="tipo-list">
                {tiposDespesa
                  .slice()
                  .sort((a, b) => Number(b.ativo) - Number(a.ativo) || a.nome.localeCompare(b.nome))
                  .map((tipo) => (
                    <div className="tipo-row" key={tipo.id}>
                      <div>
                        <strong>{tipo.nome}</strong>
                        <span>
                          {tipo.ativo ? "ativo" : "inativo"} · atualizado por{" "}
                          {tipo.atualizado_por_nome ?? tipo.criado_por_nome ?? "Sistema"}
                        </span>
                      </div>
                      <button
                        className="icon-button"
                        type="button"
                        title="Editar tipo de despesa"
                        aria-label="Editar tipo de despesa"
                        onClick={() => handleEditTipoDespesa(tipo)}
                      >
                        <Pencil size={17} aria-hidden="true" />
                      </button>
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
          ) : null}
        </div>
      ) : null}

      {isRegisterMode ? (
        <>
          <section className="panel">
            <div className="panel-heading table-heading">
              <div>
                <p className="eyebrow">Movimentos</p>
                <h2>{selectedPosto?.nome ?? selectedDayLabel}</h2>
              </div>
              <button className="icon-text-button" type="button" onClick={() => void loadData()} disabled={loading}>
                <RefreshCw size={18} className={loading ? "spin" : ""} aria-hidden="true" />
                Atualizar
              </button>
            </div>

        {loading ? (
          <div className="empty-state">A carregar registos.</div>
        ) : selectedRegistos.length ? (
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
                {selectedRegistos.map((registo) => {
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
                            disabled={!canEditSelectedDay}
                          >
                            <Pencil size={17} aria-hidden="true" />
                          </button>
                          <button
                            className="icon-button danger"
                            type="button"
                            title="Apagar"
                            aria-label="Apagar registo"
                            onClick={() => void handleDeleteRegisto(registo.id)}
                            disabled={!canEditSelectedDay}
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
          <div className="empty-state">Sem registos para este posto neste dia.</div>
        )}
          </section>

          <section className="panel">
            <div className="panel-heading table-heading">
              <div>
                <p className="eyebrow">Despesas</p>
                <h2>{formatCurrency(selectedDespesasTotal)}</h2>
              </div>
            </div>

        {loading ? (
          <div className="empty-state">A carregar despesas.</div>
        ) : selectedDespesas.length ? (
          <div className="table-wrap">
            <table className="expenses-table">
              <thead>
                <tr>
                  <th>Posto</th>
                  <th>Tipo</th>
                  <th>Nº despesa</th>
                  <th>Valor</th>
                  <th>Fatura</th>
                  <th>Alterado por</th>
                  <th>Observações</th>
                  <th aria-label="Ações" />
                </tr>
              </thead>
              <tbody>
                {selectedDespesas.map((despesa) => (
                  <tr key={despesa.id}>
                    <td>
                      <strong>{despesa.postos?.nome ?? "Posto removido"}</strong>
                      <span>{despesa.postos?.responsavel ?? ""}</span>
                    </td>
                    <td>{despesa.tipo_despesa}</td>
                    <td>{despesa.numero_despesa}</td>
                    <td>
                      <strong>{formatCurrency(Number(despesa.valor))}</strong>
                    </td>
                    <td className="audit-cell">
                      <strong>{despesa.fatura_paga ? "Paga" : "Por pagar"}</strong>
                      <span>{despesa.numero_fatura ?? ""}</span>
                    </td>
                    <td className="audit-cell">
                      <strong>{despesa.atualizado_por_nome ?? despesa.criado_por_nome ?? "Sem utilizador"}</strong>
                      <span>{formatDateTimeLabel(despesa.updated_at)}</span>
                    </td>
                    <td>{despesa.observacoes || ""}</td>
                    <td>
                      <div className="row-actions">
                        <button
                          className="icon-button"
                          type="button"
                          title="Editar despesa"
                          aria-label="Editar despesa"
                          onClick={() => handleEditDespesa(despesa)}
                          disabled={!canEditSelectedDay}
                        >
                          <Pencil size={17} aria-hidden="true" />
                        </button>
                        <button
                          className="icon-button danger"
                          type="button"
                          title="Apagar despesa"
                          aria-label="Apagar despesa"
                          onClick={() => void handleDeleteDespesa(despesa.id)}
                          disabled={!canEditSelectedDay}
                        >
                          <Trash2 size={17} aria-hidden="true" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">Sem despesas para este posto neste dia.</div>
        )}
          </section>
        </>
      ) : null}
    </main>
  );
}

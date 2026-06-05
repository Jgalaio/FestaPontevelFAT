"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import {
  Beer,
  Building2,
  CalendarDays,
  Euro,
  FileText,
  HandCoins,
  Home,
  KeyRound,
  LogOut,
  Pencil,
  Plus,
  Printer,
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
  AgenteConfig,
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
  NovadisBarril,
  NovadisConfig,
  NovadisConsumo,
  NovadisTipo,
  PagamentoAgente,
  TabaqueiraEntrada,
  TabaqueiraSaida,
  TipoDespesa,
  Utilizador
} from "@/lib/types";

type DemoStore = {
  diasFesta: DiaFesta[];
  postos: Posto[];
  registos: RegistoRow[];
  despesas: DespesaRow[];
  tiposDespesa: TipoDespesa[];
  agenteConfig: AgenteConfig;
  pagamentosAgente: PagamentoAgente[];
  novadisConfig: NovadisConfig;
  novadisBarris: NovadisBarril[];
  novadisConsumos: NovadisConsumo[];
  tabaqueiraEntradas: TabaqueiraEntrada[];
  tabaqueiraSaidas: TabaqueiraSaida[];
};

type EntryTab = "faturacao" | "despesas";
type SideTab = "agente" | "dias" | "postos" | "tipos" | "utilizadores";
type StockTab = "novadis" | "tabaqueira";
type BillingAppMode = "agent" | "novadis" | "stocks" | "overview" | "register" | "management" | "reports";
type TipoPagamentoDespesa = "dinheiro" | "transferencia";

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

type AgenteConfigForm = {
  valorEventosAnual: string;
  valorPatrocinios: string;
  valorPeditorio: string;
  valorNecessarioAgente: string;
};

type PagamentoAgenteForm = {
  valor: string;
};

type NovadisConfigForm = {
  imperialValorUnitario: string;
  imperialValorTara: string;
  cidraValorUnitario: string;
  cidraValorTara: string;
  sangriaValorUnitario: string;
  sangriaValorTara: string;
  co2ValorUnitario: string;
  co2ValorTara: string;
};

type NovadisBarrilForm = {
  tipo: NovadisTipo;
  quantidade: string;
};

type NovadisConsumoForm = {
  data: string;
  tipo: NovadisTipo;
  quantidade: string;
};

type TabaqueiraEntradaForm = {
  marca: string;
  quantidade: string;
  precoFornecedor: string;
  pvp: string;
};

type TabaqueiraSaidaForm = {
  id: string | null;
  data: string;
  marca: string;
  quantidade: string;
  levadoPor: string;
  postoId: string;
  justificacao: string;
};

type NovadisValorKey =
  | "imperial_valor_unitario"
  | "cidra_valor_unitario"
  | "sangria_valor_unitario"
  | "co2_valor_unitario";
type NovadisTaraKey = "imperial_valor_tara" | "cidra_valor_tara" | "sangria_valor_tara" | "co2_valor_tara";
type NovadisConfigFormKey = keyof NovadisConfigForm;

const STORAGE_KEY = "pontevel-faturacao-mvp";
const DEMO_OPERATOR_KEY = "pontevel-faturacao-operador";
const APP_SESSION_KEY = "pontevel-faturacao-sessao";
const DELETE_DAY_PASSWORD = "21051986Gz!";
const MAX_INVOICE_IMAGE_BYTES = 8 * 1024 * 1024;
const INVOICE_IMAGE_MAX_SIDE = 1400;

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

const NOVADIS_TIPOS: {
  tipo: NovadisTipo;
  label: string;
  valorKey: NovadisValorKey;
  taraKey: NovadisTaraKey;
  valorFormKey: NovadisConfigFormKey;
  taraFormKey: NovadisConfigFormKey;
}[] = [
  {
    tipo: "imperial",
    label: "Imperial",
    valorKey: "imperial_valor_unitario",
    taraKey: "imperial_valor_tara",
    valorFormKey: "imperialValorUnitario",
    taraFormKey: "imperialValorTara"
  },
  {
    tipo: "cidra",
    label: "Cidra",
    valorKey: "cidra_valor_unitario",
    taraKey: "cidra_valor_tara",
    valorFormKey: "cidraValorUnitario",
    taraFormKey: "cidraValorTara"
  },
  {
    tipo: "sangria",
    label: "Sangria",
    valorKey: "sangria_valor_unitario",
    taraKey: "sangria_valor_tara",
    valorFormKey: "sangriaValorUnitario",
    taraFormKey: "sangriaValorTara"
  },
  {
    tipo: "co2",
    label: "Garrafas de CO2",
    valorKey: "co2_valor_unitario",
    taraKey: "co2_valor_tara",
    valorFormKey: "co2ValorUnitario",
    taraFormKey: "co2ValorTara"
  }
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

const baseAgenteConfig: AgenteConfig = {
  id: true,
  valor_eventos_anual: 0,
  valor_patrocinios: 0,
  valor_peditorio: 0,
  valor_necessario_agente: 0,
  atualizado_por_id: null,
  atualizado_por_nome: "Sistema",
  created_at: "2026-06-03T00:00:00.000Z",
  updated_at: "2026-06-03T00:00:00.000Z"
};

const baseNovadisConfig: NovadisConfig = {
  id: true,
  imperial_valor_unitario: 0,
  imperial_valor_tara: 0,
  cidra_valor_unitario: 0,
  cidra_valor_tara: 0,
  sangria_valor_unitario: 0,
  sangria_valor_tara: 0,
  co2_valor_unitario: 0,
  co2_valor_tara: 0,
  atualizado_por_id: null,
  atualizado_por_nome: "Sistema",
  created_at: "2026-06-03T00:00:00.000Z",
  updated_at: "2026-06-03T00:00:00.000Z"
};

function normalizeAgenteConfig(config?: Partial<AgenteConfig> | null): AgenteConfig {
  return {
    ...baseAgenteConfig,
    ...config,
    valor_eventos_anual: Number(config?.valor_eventos_anual ?? 0),
    valor_patrocinios: Number(config?.valor_patrocinios ?? 0),
    valor_peditorio: Number(config?.valor_peditorio ?? 0),
    valor_necessario_agente: Number(config?.valor_necessario_agente ?? 0)
  };
}

function normalizeNovadisConfig(config?: Partial<NovadisConfig> | null): NovadisConfig {
  const legacyConfig = config as
    | (Partial<NovadisConfig> & { valor_barril?: number; valor_tara?: number })
    | null
    | undefined;
  const legacyValorUnitario = Number(legacyConfig?.valor_barril ?? 0);
  const legacyValorTara = Number(legacyConfig?.valor_tara ?? 0);

  return {
    ...baseNovadisConfig,
    ...config,
    imperial_valor_unitario: Number(config?.imperial_valor_unitario ?? legacyValorUnitario),
    imperial_valor_tara: Number(config?.imperial_valor_tara ?? legacyValorTara),
    cidra_valor_unitario: Number(config?.cidra_valor_unitario ?? 0),
    cidra_valor_tara: Number(config?.cidra_valor_tara ?? 0),
    sangria_valor_unitario: Number(config?.sangria_valor_unitario ?? 0),
    sangria_valor_tara: Number(config?.sangria_valor_tara ?? 0),
    co2_valor_unitario: Number(config?.co2_valor_unitario ?? 0),
    co2_valor_tara: Number(config?.co2_valor_tara ?? 0)
  };
}

function makeId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Não foi possível ler a imagem da fatura."));
    reader.readAsDataURL(file);
  });
}

function loadImage(dataUrl: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();

    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Não foi possível preparar a imagem da fatura."));
    image.src = dataUrl;
  });
}

async function prepareInvoiceImage(file: File) {
  if (!file.type.startsWith("image/")) {
    throw new Error("Escolhe um ficheiro de imagem para a fatura.");
  }

  if (file.size > MAX_INVOICE_IMAGE_BYTES) {
    throw new Error("A imagem da fatura deve ter no máximo 8 MB.");
  }

  const dataUrl = await readFileAsDataUrl(file);
  const image = await loadImage(dataUrl);
  const maxSide = Math.max(image.naturalWidth, image.naturalHeight);
  const scale = maxSide > INVOICE_IMAGE_MAX_SIDE ? INVOICE_IMAGE_MAX_SIDE / maxSide : 1;
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) {
    return dataUrl;
  }

  canvas.width = width;
  canvas.height = height;
  context.drawImage(image, 0, 0, width, height);

  return canvas.toDataURL("image/jpeg", 0.78);
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
    fatComNif: false,
    tipoPagamento: "dinheiro",
    faturaPaga: false,
    numeroFatura: "",
    faturaImagem: "",
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

function agenteConfigToForm(config: AgenteConfig): AgenteConfigForm {
  return {
    valorEventosAnual: String(Number(config.valor_eventos_anual).toFixed(2)),
    valorPatrocinios: String(Number(config.valor_patrocinios).toFixed(2)),
    valorPeditorio: String(Number(config.valor_peditorio).toFixed(2)),
    valorNecessarioAgente: String(Number(config.valor_necessario_agente).toFixed(2))
  };
}

function emptyPagamentoAgenteForm(): PagamentoAgenteForm {
  return {
    valor: ""
  };
}

function novadisConfigToForm(config: NovadisConfig): NovadisConfigForm {
  return {
    imperialValorUnitario: String(Number(config.imperial_valor_unitario).toFixed(2)),
    imperialValorTara: String(Number(config.imperial_valor_tara).toFixed(2)),
    cidraValorUnitario: String(Number(config.cidra_valor_unitario).toFixed(2)),
    cidraValorTara: String(Number(config.cidra_valor_tara).toFixed(2)),
    sangriaValorUnitario: String(Number(config.sangria_valor_unitario).toFixed(2)),
    sangriaValorTara: String(Number(config.sangria_valor_tara).toFixed(2)),
    co2ValorUnitario: String(Number(config.co2_valor_unitario).toFixed(2)),
    co2ValorTara: String(Number(config.co2_valor_tara).toFixed(2))
  };
}

function emptyNovadisBarrilForm(): NovadisBarrilForm {
  return {
    tipo: "imperial",
    quantidade: ""
  };
}

function emptyNovadisConsumoForm(date = todayISO()): NovadisConsumoForm {
  return {
    data: date,
    tipo: "imperial",
    quantidade: ""
  };
}

function emptyTabaqueiraEntradaForm(): TabaqueiraEntradaForm {
  return {
    marca: "",
    quantidade: "",
    precoFornecedor: "",
    pvp: ""
  };
}

function emptyTabaqueiraSaidaForm(date = todayISO()): TabaqueiraSaidaForm {
  return {
    id: null,
    data: date,
    marca: "",
    quantidade: "",
    levadoPor: "",
    postoId: "",
    justificacao: ""
  };
}

function normalizeTabaqueiraMarca(value: string | null | undefined) {
  return (value ?? "").trim().replace(/\s+/g, " ");
}

function normalizeNovadisTipo(value: string | null | undefined): NovadisTipo {
  return NOVADIS_TIPOS.some((item) => item.tipo === value) ? (value as NovadisTipo) : "imperial";
}

function getNovadisTipoLabel(value: string | null | undefined) {
  const tipo = normalizeNovadisTipo(value);
  return NOVADIS_TIPOS.find((item) => item.tipo === tipo)?.label ?? "Imperial";
}

function getNovadisUnitLabel(value: string | null | undefined, quantidade: number) {
  const tipo = normalizeNovadisTipo(value);

  if (tipo === "co2") {
    return quantidade === 1 ? "garrafa" : "garrafas";
  }

  return quantidade === 1 ? "barril" : "barris";
}

function normalizeNovadisBarril(barril: NovadisBarril): NovadisBarril {
  const rawBarril = barril as NovadisBarril & { tipo?: string | null };

  return {
    ...barril,
    tipo: normalizeNovadisTipo(rawBarril.tipo)
  };
}

function normalizeNovadisConsumo(consumo: NovadisConsumo): NovadisConsumo {
  const rawConsumo = consumo as NovadisConsumo & { tipo?: string | null };

  return {
    ...consumo,
    tipo: normalizeNovadisTipo(rawConsumo.tipo)
  };
}

function normalizeTabaqueiraEntrada(entrada: TabaqueiraEntrada): TabaqueiraEntrada {
  return {
    ...entrada,
    marca: normalizeTabaqueiraMarca(entrada.marca),
    quantidade: Number(entrada.quantidade),
    preco_fornecedor: Number(entrada.preco_fornecedor ?? 0),
    pvp: Number(entrada.pvp ?? 0)
  };
}

function normalizeTabaqueiraSaida(saida: TabaqueiraSaida): TabaqueiraSaida {
  return {
    ...saida,
    data: saida.data ?? null,
    marca: normalizeTabaqueiraMarca(saida.marca),
    quantidade: Number(saida.quantidade),
    posto_id: saida.posto_id ?? null,
    posto_nome: saida.posto_nome || "Posto removido",
    justificacao_edicao: saida.justificacao_edicao ?? null,
    atualizado_por_id: saida.atualizado_por_id ?? null,
    atualizado_por_nome: saida.atualizado_por_nome ?? null
  };
}

function sumNovadisQuantidade<T extends { quantidade: number; tipo: NovadisTipo }>(items: T[], tipo: NovadisTipo) {
  return items
    .filter((item) => normalizeNovadisTipo(item.tipo) === tipo)
    .reduce((acc, item) => acc + Number(item.quantidade), 0);
}

function applyNovadisConsumoTotal(
  consumos: NovadisConsumo[],
  tipo: NovadisTipo,
  targetTotal: number,
  data: string,
  userName: string
) {
  const currentTotal = sumNovadisQuantidade(consumos, tipo);

  if (targetTotal === currentTotal) {
    return consumos;
  }

  if (targetTotal > currentTotal) {
    const nextConsumo: NovadisConsumo = {
      id: makeId("novadis-consumo"),
      data,
      tipo,
      quantidade: targetTotal - currentTotal,
      criado_por_id: null,
      criado_por_nome: userName,
      created_at: new Date().toISOString()
    };

    return [nextConsumo, ...consumos];
  }

  let remainingToRemove = currentTotal - targetTotal;

  return consumos.reduce<NovadisConsumo[]>((next, consumo) => {
    if (remainingToRemove <= 0 || normalizeNovadisTipo(consumo.tipo) !== tipo) {
      next.push(consumo);
      return next;
    }

    if (consumo.quantidade <= remainingToRemove) {
      remainingToRemove -= consumo.quantidade;
      return next;
    }

    next.push({
      ...consumo,
      quantidade: consumo.quantidade - remainingToRemove
    });
    remainingToRemove = 0;

    return next;
  }, []);
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

function normalizeTipoPagamento(value: string | null | undefined): TipoPagamentoDespesa {
  return value === "transferencia" ? "transferencia" : "dinheiro";
}

function formatTipoPagamento(value: string | null | undefined) {
  return normalizeTipoPagamento(value) === "transferencia" ? "Transferência" : "Dinheiro";
}

function normalizeDespesaRow(despesa: DespesaRow): DespesaRow {
  const rawDespesa = despesa as DespesaRow &
    Partial<Pick<DespesaRow, "fat_com_nif" | "fatura_imagem" | "tipo_pagamento">>;

  return {
    ...despesa,
    fat_com_nif: Boolean(rawDespesa.fat_com_nif),
    fatura_imagem: rawDespesa.fatura_imagem ?? null,
    tipo_pagamento: normalizeTipoPagamento(rawDespesa.tipo_pagamento)
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

function formatDespesaNumber(sequence: number) {
  return `D-${String(sequence).padStart(3, "0")}`;
}

function getDespesaSequence(numeroDespesa: string) {
  const match = numeroDespesa.match(/^D-(\d+)$/i);

  return match ? Number(match[1]) : null;
}

function getNextDespesaNumber(despesas: Pick<DespesaRow, "data" | "numero_despesa" | "posto_id">[], postoId: string, data: string) {
  const maxSequence = despesas.reduce((max, despesa) => {
    if (despesa.posto_id !== postoId || despesa.data !== data) {
      return max;
    }

    const sequence = getDespesaSequence(despesa.numero_despesa);
    return sequence && sequence > max ? sequence : max;
  }, 0);

  return formatDespesaNumber(maxSequence + 1);
}

function readDemoStore(): DemoStore {
  if (typeof window === "undefined") {
    return {
      agenteConfig: normalizeAgenteConfig(baseAgenteConfig),
      novadisConfig: normalizeNovadisConfig(baseNovadisConfig),
      diasFesta: baseDiasFesta,
      postos: basePostos,
      registos: [],
      despesas: [],
      pagamentosAgente: [],
      novadisBarris: [],
      novadisConsumos: [],
      tabaqueiraEntradas: [],
      tabaqueiraSaidas: [],
      tiposDespesa: baseTiposDespesa
    };
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);

  if (!raw) {
    return {
      agenteConfig: normalizeAgenteConfig(baseAgenteConfig),
      novadisConfig: normalizeNovadisConfig(baseNovadisConfig),
      diasFesta: baseDiasFesta,
      postos: basePostos,
      registos: [],
      despesas: [],
      pagamentosAgente: [],
      novadisBarris: [],
      novadisConsumos: [],
      tabaqueiraEntradas: [],
      tabaqueiraSaidas: [],
      tiposDespesa: baseTiposDespesa
    };
  }

  try {
    const parsed = JSON.parse(raw) as Partial<DemoStore>;
    const registos = parsed.registos ?? [];
    const despesas = (parsed.despesas ?? []).map(normalizeDespesaRow);
    const diasFesta = parsed.diasFesta?.length ? sortDiasFesta(parsed.diasFesta) : buildDemoDias(registos, despesas);

    return {
      diasFesta,
      agenteConfig: normalizeAgenteConfig(parsed.agenteConfig),
      novadisConfig: normalizeNovadisConfig(parsed.novadisConfig),
      postos: parsed.postos?.length ? parsed.postos : basePostos,
      registos,
      despesas,
      pagamentosAgente: parsed.pagamentosAgente ?? [],
      novadisBarris: (parsed.novadisBarris ?? []).map(normalizeNovadisBarril),
      novadisConsumos: (parsed.novadisConsumos ?? []).map(normalizeNovadisConsumo),
      tabaqueiraEntradas: (parsed.tabaqueiraEntradas ?? []).map(normalizeTabaqueiraEntrada),
      tabaqueiraSaidas: (parsed.tabaqueiraSaidas ?? []).map(normalizeTabaqueiraSaida),
      tiposDespesa: parsed.tiposDespesa?.length ? parsed.tiposDespesa : baseTiposDespesa
    };
  } catch {
    return {
      agenteConfig: normalizeAgenteConfig(baseAgenteConfig),
      novadisConfig: normalizeNovadisConfig(baseNovadisConfig),
      diasFesta: baseDiasFesta,
      postos: basePostos,
      registos: [],
      despesas: [],
      pagamentosAgente: [],
      novadisBarris: [],
      novadisConsumos: [],
      tabaqueiraEntradas: [],
      tabaqueiraSaidas: [],
      tiposDespesa: baseTiposDespesa
    };
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
    .map((despesa) => {
      const normalizedDespesa = normalizeDespesaRow(despesa);

      return {
        ...normalizedDespesa,
        postos: postos.find((posto) => posto.id === normalizedDespesa.posto_id) ?? null
      };
    })
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
  const normalizedDespesa = normalizeDespesaRow(despesa);

  return {
    ...normalizedDespesa,
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
  const isReportsMode = mode === "reports";
  const isAgentMode = mode === "agent";
  const isStocksMode = mode === "stocks" || mode === "novadis";
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
  const [editingRegisto, setEditingRegisto] = useState<Registo | null>(null);
  const [editingDespesa, setEditingDespesa] = useState<Despesa | null>(null);
  const [editingNovadisConsumoTipo, setEditingNovadisConsumoTipo] = useState<NovadisTipo | null>(null);
  const [agenteConfig, setAgenteConfig] = useState<AgenteConfig>(baseAgenteConfig);
  const [pagamentosAgente, setPagamentosAgente] = useState<PagamentoAgente[]>([]);
  const [novadisConfig, setNovadisConfig] = useState<NovadisConfig>(baseNovadisConfig);
  const [novadisBarris, setNovadisBarris] = useState<NovadisBarril[]>([]);
  const [novadisConsumos, setNovadisConsumos] = useState<NovadisConsumo[]>([]);
  const [tabaqueiraEntradas, setTabaqueiraEntradas] = useState<TabaqueiraEntrada[]>([]);
  const [tabaqueiraSaidas, setTabaqueiraSaidas] = useState<TabaqueiraSaida[]>([]);
  const [agenteConfigForm, setAgenteConfigForm] = useState<AgenteConfigForm>(() =>
    agenteConfigToForm(baseAgenteConfig)
  );
  const [pagamentoAgenteForm, setPagamentoAgenteForm] = useState<PagamentoAgenteForm>(() =>
    emptyPagamentoAgenteForm()
  );
  const [novadisConfigForm, setNovadisConfigForm] = useState<NovadisConfigForm>(() =>
    novadisConfigToForm(baseNovadisConfig)
  );
  const [novadisBarrilForm, setNovadisBarrilForm] = useState<NovadisBarrilForm>(() => emptyNovadisBarrilForm());
  const [novadisConsumoForm, setNovadisConsumoForm] = useState<NovadisConsumoForm>(() =>
    emptyNovadisConsumoForm(startDate)
  );
  const [tabaqueiraEntradaForm, setTabaqueiraEntradaForm] = useState<TabaqueiraEntradaForm>(() =>
    emptyTabaqueiraEntradaForm()
  );
  const [tabaqueiraSaidaForm, setTabaqueiraSaidaForm] = useState<TabaqueiraSaidaForm>(() =>
    emptyTabaqueiraSaidaForm(startDate)
  );
  const [userForm, setUserForm] = useState<UserForm>(() => emptyUserForm());
  const [postoForm, setPostoForm] = useState<PostoForm>(() => emptyPostoForm());
  const [tipoDespesaForm, setTipoDespesaForm] = useState<TipoDespesaForm>(() => emptyTipoDespesaForm());
  const [diaForm, setDiaForm] = useState<DiaForm>(() => emptyDiaForm(startDate));
  const [entryTab, setEntryTab] = useState<EntryTab>("faturacao");
  const [sideTab, setSideTab] = useState<SideTab>("dias");
  const [stockTab, setStockTab] = useState<StockTab>("novadis");
  const [demoOperator, setDemoOperator] = useState("Demonstração");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expenseSaving, setExpenseSaving] = useState(false);
  const [postoSaving, setPostoSaving] = useState(false);
  const [userSaving, setUserSaving] = useState(false);
  const [tipoDespesaSaving, setTipoDespesaSaving] = useState(false);
  const [agenteConfigSaving, setAgenteConfigSaving] = useState(false);
  const [pagamentoAgenteSaving, setPagamentoAgenteSaving] = useState(false);
  const [novadisConfigSaving, setNovadisConfigSaving] = useState(false);
  const [novadisBarrilSaving, setNovadisBarrilSaving] = useState(false);
  const [novadisConsumoSaving, setNovadisConsumoSaving] = useState(false);
  const [tabaqueiraEntradaSaving, setTabaqueiraEntradaSaving] = useState(false);
  const [tabaqueiraSaidaSaving, setTabaqueiraSaidaSaving] = useState(false);
  const [overviewOnlyFestaTotal, setOverviewOnlyFestaTotal] = useState(false);
  const [overviewOnlyFestaSaldo, setOverviewOnlyFestaSaldo] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const isNovadisMode = isStocksMode && stockTab === "novadis";
  const isTabaqueiraMode = isStocksMode && stockTab === "tabaqueira";

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
  const isEditingNovadisConsumoTotal = Boolean(editingNovadisConsumoTipo);

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

  const nextDespesaNumber = useMemo(() => {
    if (despesaForm.id) {
      return despesaForm.numeroDespesa || "Sem número";
    }

    if (!despesaForm.postoId || !selectedDia) {
      return "Automático";
    }

    return getNextDespesaNumber(despesas, despesaForm.postoId, selectedDia.data);
  }, [despesaForm.id, despesaForm.numeroDespesa, despesaForm.postoId, despesas, selectedDia]);

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

  const reportPostoRows = useMemo(() => {
    const postoIds = new Set<string>();

    for (const posto of activePostos) {
      postoIds.add(posto.id);
    }

    for (const registo of registos) {
      postoIds.add(registo.posto_id);
    }

    for (const despesa of despesas) {
      postoIds.add(despesa.posto_id);
    }

    return Array.from(postoIds)
      .map((postoId) => {
        const posto =
          postos.find((item) => item.id === postoId) ??
          registos.find((registo) => registo.posto_id === postoId)?.postos ??
          despesas.find((despesa) => despesa.posto_id === postoId)?.postos ??
          null;
        const registo = registos.find((item) => item.posto_id === postoId) ?? null;
        const postoDespesas = despesas.filter((despesa) => despesa.posto_id === postoId);
        const dinheiro = Number(registo?.dinheiro ?? 0);
        const multibanco = Number(registo?.multibanco ?? 0);
        const mbway = Number(registo?.mbway ?? 0);
        const faturacao = dinheiro + multibanco + mbway;
        const despesasTotal = postoDespesas.reduce((acc, despesa) => acc + Number(despesa.valor), 0);

        return {
          postoId,
          nome: posto?.nome ?? "Posto removido",
          responsavel: posto?.responsavel ?? "",
          dinheiro,
          multibanco,
          mbway,
          faturacao,
          despesas: despesasTotal,
          saldo: faturacao - despesasTotal
        };
      })
      .sort((a, b) => a.nome.localeCompare(b.nome));
  }, [activePostos, despesas, postos, registos]);

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

  const dailyExpensePaymentTotals = useMemo(() => {
    return despesas.reduce(
      (acc, despesa) => {
        if (normalizeTipoPagamento(despesa.tipo_pagamento) === "transferencia") {
          acc.transferencia += Number(despesa.valor);
        } else {
          acc.dinheiro += Number(despesa.valor);
        }

        return acc;
      },
      { dinheiro: 0, transferencia: 0 }
    );
  }, [despesas]);

  const overviewDayFinancials = useMemo(() => {
    const next = new Map<
      string,
      {
        despesas: number;
        despesasDinheiro: number;
        despesasTransferencia: number;
        dinheiro: number;
        faturacao: number;
        mbway: number;
        multibanco: number;
        postosRegistados: number;
      }
    >();
    const postosPorDia = new Map<string, Set<string>>();

    function ensureSummary(data: string) {
      const current =
        next.get(data) ??
        {
          despesas: 0,
          despesasDinheiro: 0,
          despesasTransferencia: 0,
          dinheiro: 0,
          faturacao: 0,
          mbway: 0,
          multibanco: 0,
          postosRegistados: 0
        };

      next.set(data, current);
      return current;
    }

    for (const registo of registos) {
      const current = ensureSummary(registo.data);
      const postos = postosPorDia.get(registo.data) ?? new Set<string>();

      postos.add(registo.posto_id);
      postosPorDia.set(registo.data, postos);
      current.postosRegistados = postos.size;
      current.dinheiro += Number(registo.dinheiro);
      current.multibanco += Number(registo.multibanco);
      current.mbway += Number(registo.mbway);
      current.faturacao += Number(registo.dinheiro) + Number(registo.multibanco) + Number(registo.mbway);
    }

    for (const despesa of despesas) {
      const current = ensureSummary(despesa.data);
      const valor = Number(despesa.valor);

      current.despesas += valor;

      if (normalizeTipoPagamento(despesa.tipo_pagamento) === "transferencia") {
        current.despesasTransferencia += valor;
      } else {
        current.despesasDinheiro += valor;
      }
    }

    return next;
  }, [despesas, registos]);

  const dailySaldo = dailyTotals.total - dailyDespesasTotal;
  const selectedSaldo = selectedTotals.total - selectedDespesasTotal;
  const isEditingRegisto = Boolean(editingRegisto);
  const isEditingDespesa = Boolean(editingDespesa);
  const isEditingTabaqueiraSaida = Boolean(tabaqueiraSaidaForm.id);
  const agenteValoresBase =
    Number(agenteConfig.valor_eventos_anual) +
    Number(agenteConfig.valor_patrocinios) +
    Number(agenteConfig.valor_peditorio);
  const agenteTotalCalculado = agenteValoresBase + dailySaldo;
  const agenteValorNecessario = Number(agenteConfig.valor_necessario_agente);
  const agenteTotalEntregue = pagamentosAgente.reduce((acc, pagamento) => acc + Number(pagamento.valor), 0);
  const agenteFaltaPagar = Math.max(agenteValorNecessario - agenteTotalEntregue, 0);
  const agentePagoAMais = Math.max(agenteTotalEntregue - agenteValorNecessario, 0);
  const saldoAcumuladoReal = agenteTotalCalculado - agenteTotalEntregue;
  const overviewTotalComExtras = dailyTotals.total + agenteValoresBase;
  const overviewTotalApresentado = overviewOnlyFestaTotal ? dailyTotals.total : overviewTotalComExtras;
  const overviewSaldoReal = overviewTotalComExtras - dailyDespesasTotal - agenteTotalEntregue;
  const overviewSaldoApresentado = overviewOnlyFestaSaldo ? dailySaldo : overviewSaldoReal;
  const novadisPorTipo = NOVADIS_TIPOS.map((item) => {
    const quantidade = novadisBarris
      .filter((barril) => normalizeNovadisTipo(barril.tipo) === item.tipo)
      .reduce((acc, barril) => acc + Number(barril.quantidade), 0);
    const gasto = novadisConsumos
      .filter((consumo) => normalizeNovadisTipo(consumo.tipo) === item.tipo)
      .reduce((acc, consumo) => acc + Number(consumo.quantidade), 0);
    const valorUnitario = Number(novadisConfig[item.valorKey]);
    const valorTara = Number(novadisConfig[item.taraKey]);
    const cheiosADevolver = Math.max(quantidade - gasto, 0);
    const vaziosADevolver = Math.min(gasto, quantidade);

    return {
      ...item,
      quantidade,
      gasto,
      cheiosADevolver,
      vaziosADevolver,
      valorTotal: quantidade * valorUnitario,
      taraTotal: quantidade * valorTara,
      valorCheiosADevolver: cheiosADevolver * valorUnitario,
      valorVaziosADevolver: vaziosADevolver * valorTara
    };
  });
  const novadisTotalBarris = novadisPorTipo.reduce((acc, item) => acc + item.quantidade, 0);
  const novadisValorBarris = novadisPorTipo.reduce((acc, item) => acc + item.valorTotal, 0);
  const novadisTotalGasto = novadisPorTipo.reduce((acc, item) => acc + item.gasto, 0);
  const novadisTotalCheiosADevolver = novadisPorTipo.reduce((acc, item) => acc + item.cheiosADevolver, 0);
  const novadisTotalVaziosADevolver = novadisPorTipo.reduce((acc, item) => acc + item.vaziosADevolver, 0);
  const novadisValorCheiosADevolver = novadisPorTipo.reduce((acc, item) => acc + item.valorCheiosADevolver, 0);
  const novadisValorVaziosADevolver = novadisPorTipo.reduce((acc, item) => acc + item.valorVaziosADevolver, 0);
  const novadisValorDevolucao = novadisValorCheiosADevolver + novadisValorVaziosADevolver;
  const tabaqueiraPorMarca = useMemo(() => Array.from(
    new Set([
      ...tabaqueiraEntradas.map((entrada) => normalizeTabaqueiraMarca(entrada.marca)),
      ...tabaqueiraSaidas.map((saida) => normalizeTabaqueiraMarca(saida.marca))
    ])
  )
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b))
    .map((marca) => {
      const entradasMarca = tabaqueiraEntradas.filter((entrada) => normalizeTabaqueiraMarca(entrada.marca) === marca);
      const saidasMarca = tabaqueiraSaidas.filter((saida) => normalizeTabaqueiraMarca(saida.marca) === marca);
      const recebido = entradasMarca.reduce((acc, entrada) => acc + Number(entrada.quantidade), 0);
      const saido = saidasMarca.reduce((acc, saida) => acc + Number(saida.quantidade), 0);
      const stock = Math.max(recebido - saido, 0);
      const latestEntrada = entradasMarca
        .slice()
        .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
      const precoFornecedor = Number(latestEntrada?.preco_fornecedor ?? 0);
      const pvp = Number(latestEntrada?.pvp ?? 0);

      return {
        marca,
        recebido,
        saido,
        stock,
        precoFornecedor,
        pvp,
        valorFornecedorStock: stock * precoFornecedor,
        valorPvpStock: stock * pvp
      };
    }), [tabaqueiraEntradas, tabaqueiraSaidas]);
  const tabaqueiraTotalRecebido = tabaqueiraPorMarca.reduce((acc, item) => acc + item.recebido, 0);
  const tabaqueiraTotalSaido = tabaqueiraPorMarca.reduce((acc, item) => acc + item.saido, 0);
  const tabaqueiraTotalStock = tabaqueiraPorMarca.reduce((acc, item) => acc + item.stock, 0);
  const tabaqueiraValorFornecedorStock = tabaqueiraPorMarca.reduce((acc, item) => acc + item.valorFornecedorStock, 0);
  const tabaqueiraValorPvpStock = tabaqueiraPorMarca.reduce((acc, item) => acc + item.valorPvpStock, 0);
  const tabaqueiraSaidasPorDia = useMemo(
    () =>
      orderedDiasFesta
        .map((dia) => {
          const saidasDia = tabaqueiraSaidas.filter((saida) => saida.data === dia.data);
          const quantidade = saidasDia.reduce((acc, saida) => acc + Number(saida.quantidade), 0);
          const marcas = Array.from(new Set(saidasDia.map((saida) => saida.marca))).filter(Boolean).sort();

          return {
            dia,
            quantidade,
            marcas
          };
        })
        .filter((item) => item.quantidade > 0),
    [orderedDiasFesta, tabaqueiraSaidas]
  );

  const currentUserName = appSession?.nome ?? demoOperator;
  const sessionToken = appSession?.token ?? "";
  const isLoggedIn = isDemoMode || Boolean(appSession);
  const canManageUsers = isDemoMode || appSession?.role === "admin";
  const canDeleteData = isDemoMode || appSession?.role === "admin";

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

  const loadAgentData = useCallback(async () => {
    if (isDemoMode) {
      const store = readDemoStore();
      const nextConfig = normalizeAgenteConfig(store.agenteConfig);

      setAgenteConfig(nextConfig);
      setAgenteConfigForm(agenteConfigToForm(nextConfig));
      setPagamentosAgente(store.pagamentosAgente ?? []);
      return;
    }

    if (!supabase || !sessionToken) {
      const nextConfig = normalizeAgenteConfig(baseAgenteConfig);

      setAgenteConfig(nextConfig);
      setAgenteConfigForm(agenteConfigToForm(nextConfig));
      setPagamentosAgente([]);
      return;
    }

    const [configResult, pagamentosResult] = await Promise.all([
      supabase.rpc("app_obter_agente_config", { p_token: sessionToken }),
      supabase.rpc("app_listar_pagamentos_agente", { p_token: sessionToken })
    ]);

    if (configResult.error) {
      setError(configResult.error.message);
      return;
    }

    if (pagamentosResult.error) {
      setError(pagamentosResult.error.message);
      return;
    }

    const nextConfig = normalizeAgenteConfig(configResult.data?.[0]);

    setAgenteConfig(nextConfig);
    setAgenteConfigForm(agenteConfigToForm(nextConfig));
    setPagamentosAgente(pagamentosResult.data ?? []);
  }, [isDemoMode, sessionToken, supabase]);

  const loadNovadisData = useCallback(async () => {
    if (isDemoMode) {
      const store = readDemoStore();
      const nextConfig = normalizeNovadisConfig(store.novadisConfig);

      setNovadisConfig(nextConfig);
      setNovadisConfigForm(novadisConfigToForm(nextConfig));
      setNovadisBarris((store.novadisBarris ?? []).map(normalizeNovadisBarril));
      setNovadisConsumos((store.novadisConsumos ?? []).map(normalizeNovadisConsumo));
      return;
    }

    if (!supabase || !sessionToken) {
      const nextConfig = normalizeNovadisConfig(baseNovadisConfig);

      setNovadisConfig(nextConfig);
      setNovadisConfigForm(novadisConfigToForm(nextConfig));
      setNovadisBarris([]);
      setNovadisConsumos([]);
      return;
    }

    const [configResult, barrisResult, consumosResult] = await Promise.all([
      supabase.rpc("app_obter_novadis_config", { p_token: sessionToken }),
      supabase.rpc("app_listar_novadis_barris", { p_token: sessionToken }),
      supabase.rpc("app_listar_novadis_consumos", { p_token: sessionToken })
    ]);

    if (configResult.error) {
      setError(configResult.error.message);
      return;
    }

    if (barrisResult.error) {
      setError(barrisResult.error.message);
      return;
    }

    if (consumosResult.error) {
      setError(consumosResult.error.message);
      return;
    }

    const nextConfig = normalizeNovadisConfig(configResult.data?.[0]);

    setNovadisConfig(nextConfig);
    setNovadisConfigForm(novadisConfigToForm(nextConfig));
    setNovadisBarris((barrisResult.data ?? []).map(normalizeNovadisBarril));
    setNovadisConsumos((consumosResult.data ?? []).map(normalizeNovadisConsumo));
  }, [isDemoMode, sessionToken, supabase]);

  const loadTabaqueiraData = useCallback(async () => {
    if (isDemoMode) {
      const store = readDemoStore();

      setTabaqueiraEntradas((store.tabaqueiraEntradas ?? []).map(normalizeTabaqueiraEntrada));
      setTabaqueiraSaidas((store.tabaqueiraSaidas ?? []).map(normalizeTabaqueiraSaida));
      return;
    }

    if (!supabase || !sessionToken) {
      setTabaqueiraEntradas([]);
      setTabaqueiraSaidas([]);
      return;
    }

    const [entradasResult, saidasResult] = await Promise.all([
      supabase.rpc("app_listar_tabaqueira_entradas", { p_token: sessionToken }),
      supabase.rpc("app_listar_tabaqueira_saidas", { p_token: sessionToken })
    ]);

    if (entradasResult.error) {
      setError(entradasResult.error.message);
      return;
    }

    if (saidasResult.error) {
      setError(saidasResult.error.message);
      return;
    }

    setTabaqueiraEntradas((entradasResult.data ?? []).map(normalizeTabaqueiraEntrada));
    setTabaqueiraSaidas((saidasResult.data ?? []).map(normalizeTabaqueiraSaida));
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

      if (isOverviewMode || isAgentMode) {
        setRegistos(attachPostos(store.registos, store.postos));
        setDespesas(attachPostosToDespesas(store.despesas, store.postos));
      } else {
        setRegistos(attachPostos(store.registos.filter((registo) => registo.data === effectiveDate), store.postos));
        setDespesas(
          attachPostosToDespesas(store.despesas.filter((despesa) => despesa.data === effectiveDate), store.postos)
        );
      }
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

    if (isOverviewMode || isAgentMode) {
      if (!nextDias.length) {
        setRegistos([]);
        setDespesas([]);
        setLoading(false);
        return;
      }

      const [registosResults, despesasResults] = await Promise.all([
        Promise.all(
          nextDias.map((dia) => supabase.rpc("app_listar_registos", { p_token: sessionToken, p_data: dia.data }))
        ),
        Promise.all(
          nextDias.map((dia) => supabase.rpc("app_listar_despesas", { p_token: sessionToken, p_data: dia.data }))
        )
      ]);

      setLoading(false);

      const registosError = registosResults.find((result) => result.error)?.error;
      const despesasError = despesasResults.find((result) => result.error)?.error;

      if (registosError) {
        setError(registosError.message);
        return;
      }

      if (despesasError) {
        setError(despesasError.message);
        return;
      }

      setRegistos(registosResults.flatMap((result) => result.data ?? []).map(mapRegistoRpc));
      setDespesas(despesasResults.flatMap((result) => result.data ?? []).map(mapDespesaRpc));
      return;
    }

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
  }, [isAgentMode, isDemoMode, isOverviewMode, selectedDate, sessionToken, supabase]);

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
    if (isLoggedIn && (isAgentMode || isManagementMode || isOverviewMode)) {
      void loadAgentData();
    }
  }, [isAgentMode, isLoggedIn, isManagementMode, isOverviewMode, loadAgentData]);

  useEffect(() => {
    if (isLoggedIn && isNovadisMode) {
      void loadNovadisData();
    }
  }, [isLoggedIn, isNovadisMode, loadNovadisData]);

  useEffect(() => {
    if (isLoggedIn && isTabaqueiraMode) {
      void loadTabaqueiraData();
    }
  }, [isLoggedIn, isTabaqueiraMode, loadTabaqueiraData]);

  useEffect(() => {
    setForm((current) => ({ ...current, data: selectedDate }));
    setDespesaForm((current) => ({ ...current, data: selectedDate }));
    setNovadisConsumoForm((current) => ({ ...current, data: selectedDate }));
    setTabaqueiraSaidaForm((current) => (current.id ? current : { ...current, data: selectedDate }));
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
    const hasSelectedPosto = activePostos.some((posto) => posto.id === tabaqueiraSaidaForm.postoId);

    if (!hasSelectedPosto && activePostos[0]) {
      setTabaqueiraSaidaForm((current) => ({ ...current, postoId: activePostos[0].id }));
    }
  }, [activePostos, tabaqueiraSaidaForm.postoId]);

  useEffect(() => {
    const availableMarca = tabaqueiraPorMarca.find((item) => item.stock > 0)?.marca ?? "";

    if (!tabaqueiraSaidaForm.id && availableMarca && !tabaqueiraSaidaForm.marca) {
      setTabaqueiraSaidaForm((current) => ({ ...current, marca: availableMarca }));
    }
  }, [tabaqueiraPorMarca, tabaqueiraSaidaForm.id, tabaqueiraSaidaForm.marca]);

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
    setEditingRegisto(null);
    setEditingDespesa(null);
    setEditingNovadisConsumoTipo(null);
    setAgenteConfig(baseAgenteConfig);
    setAgenteConfigForm(agenteConfigToForm(baseAgenteConfig));
    setPagamentosAgente([]);
    setPagamentoAgenteForm(emptyPagamentoAgenteForm());
    setNovadisConfig(baseNovadisConfig);
    setNovadisConfigForm(novadisConfigToForm(baseNovadisConfig));
    setNovadisBarris([]);
    setNovadisBarrilForm(emptyNovadisBarrilForm());
    setNovadisConsumos([]);
    setNovadisConsumoForm(emptyNovadisConsumoForm(startDate));
    setTabaqueiraEntradas([]);
    setTabaqueiraSaidas([]);
    setTabaqueiraEntradaForm(emptyTabaqueiraEntradaForm());
    setTabaqueiraSaidaForm(emptyTabaqueiraSaidaForm(startDate));
  }

  function handleSelectDia(value: string) {
    setEditingRegisto(null);
    setEditingDespesa(null);
    setSelectedDate(value);
    setForm((current) =>
      isEditingRegisto ? { ...emptyForm(value), postoId: current.postoId } : { ...current, data: value }
    );
    setDespesaForm((current) =>
      isEditingDespesa ? { ...emptyDespesaForm(value), postoId: current.postoId } : { ...current, data: value }
    );
  }

  function handleSelectPosto(postoId: string) {
    setEditingRegisto(null);
    setEditingDespesa(null);
    setForm((current) => (isEditingRegisto ? { ...emptyForm(current.data), postoId } : { ...current, postoId }));
    setDespesaForm((current) =>
      isEditingDespesa ? { ...emptyDespesaForm(current.data), postoId } : { ...current, postoId }
    );
  }

  function handleCancelEditRegisto() {
    setEditingRegisto(null);
    setForm((current) => ({ ...emptyForm(current.data), postoId: current.postoId }));
  }

  function handleCancelEditDespesa() {
    setEditingDespesa(null);
    setDespesaForm((current) => ({ ...emptyDespesaForm(current.data), postoId: current.postoId }));
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

    const existingRegistoForForm =
      registos.find((registo) => registo.posto_id === form.postoId && registo.data === selectedDia.data) ?? null;

    if (existingRegistoForForm && !isEditingRegisto) {
      setSaving(false);
      setError("Este posto já tem faturação neste dia. Usa o botão editar para guardar alterações.");
      return;
    }

    const descricaoAlteracao = form.observacoes.trim();

    if (isEditingRegisto && !descricaoAlteracao) {
      setSaving(false);
      setError("Descreve o que foi alterado antes de guardar as alterações.");
      return;
    }

    const payload = {
      posto_id: form.postoId,
      data: selectedDia.data,
      dinheiro: parseMoney(form.dinheiro),
      multibanco: parseMoney(form.multibanco),
      mbway: parseMoney(form.mbway),
      observacoes: descricaoAlteracao ? `${isEditingRegisto ? "Alteração: " : ""}${descricaoAlteracao}` : null
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
      setNotice(isEditingRegisto ? "Alterações guardadas." : "Registo guardado.");
      setEditingRegisto(null);
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

    setNotice(isEditingRegisto ? "Alterações guardadas." : "Registo guardado.");
    setEditingRegisto(null);
    setForm((current) => ({ ...emptyForm(current.data), postoId: current.postoId }));
    await loadData();
  }

  async function handleDeleteRegisto(id: string) {
    if (isSelectedDayClosed) {
      setError("Este dia está fechado e já não permite alterações.");
      return;
    }

    if (!canDeleteData) {
      setError("Não tem privilégios para apagar dados inseridos.");
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
      if (editingRegisto?.id === id) {
        handleCancelEditRegisto();
      }
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

    if (editingRegisto?.id === id) {
      handleCancelEditRegisto();
    }
    setNotice("Registo apagado.");
    await loadData();
  }

  function handleEditRegisto(registo: Registo) {
    if (isSelectedDayClosed) {
      setError("Este dia está fechado e já não permite alterações.");
      return;
    }

    setEntryTab("faturacao");
    setEditingRegisto(registo);
    setForm({
      postoId: registo.posto_id,
      data: registo.data,
      dinheiro: String(Number(registo.dinheiro).toFixed(2)),
      multibanco: String(Number(registo.multibanco).toFixed(2)),
      mbway: String(Number(registo.mbway).toFixed(2)),
      observacoes: ""
    });

    window.requestAnimationFrame(() => {
      document.getElementById("entry-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  async function handleDespesaImageChange(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];

    if (!file) {
      return;
    }

    setError("");
    setNotice("");

    try {
      const imageDataUrl = await prepareInvoiceImage(file);
      setDespesaForm((current) => ({ ...current, faturaImagem: imageDataUrl }));
    } catch (imageError) {
      setError(imageError instanceof Error ? imageError.message : "Não foi possível carregar a imagem da fatura.");
    } finally {
      input.value = "";
    }
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

    const descricaoAlteracao = despesaForm.observacoes.trim();

    if (isEditingDespesa && !descricaoAlteracao) {
      setExpenseSaving(false);
      setError("Descreve o que foi alterado antes de guardar as alterações da despesa.");
      return;
    }

    const payload = {
      id: despesaForm.id,
      posto_id: despesaForm.postoId,
      data: selectedDia.data,
      tipo_despesa: despesaForm.tipoDespesa.trim(),
      numero_despesa: despesaForm.id ? despesaForm.numeroDespesa.trim() : "",
      valor,
      fat_com_nif: despesaForm.fatComNif,
      tipo_pagamento: despesaForm.tipoPagamento,
      fatura_paga: despesaForm.faturaPaga,
      numero_fatura: despesaForm.numeroFatura.trim() || null,
      fatura_imagem: despesaForm.faturaImagem || null,
      observacoes: descricaoAlteracao ? `${isEditingDespesa ? "Alteração: " : ""}${descricaoAlteracao}` : null
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
        numero_despesa:
          existingDespesa?.numero_despesa ?? getNextDespesaNumber(store.despesas, payload.posto_id, payload.data),
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
      setNotice(isEditingDespesa ? "Alterações da despesa guardadas." : "Despesa guardada.");
      setEditingDespesa(null);
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
      p_fat_com_nif: payload.fat_com_nif,
      p_tipo_pagamento: payload.tipo_pagamento,
      p_fatura_paga: payload.fatura_paga,
      p_numero_fatura: payload.numero_fatura,
      p_fatura_imagem: payload.fatura_imagem,
      p_observacoes: payload.observacoes
    });

    setExpenseSaving(false);

    if (saveError) {
      setError(saveError.message);
      return;
    }

    setNotice(isEditingDespesa ? "Alterações da despesa guardadas." : "Despesa guardada.");
    setEditingDespesa(null);
    setDespesaForm((current) => ({ ...emptyDespesaForm(current.data), postoId: current.postoId }));
    await loadData();
  }

  async function handleDeleteDespesa(id: string) {
    if (isSelectedDayClosed) {
      setError("Este dia está fechado e já não permite alterações.");
      return;
    }

    if (!canDeleteData) {
      setError("Não tem privilégios para apagar dados inseridos.");
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
      if (editingDespesa?.id === id) {
        handleCancelEditDespesa();
      }
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

    if (editingDespesa?.id === id) {
      handleCancelEditDespesa();
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
    setEditingDespesa(despesa);
    setDespesaForm({
      id: despesa.id,
      postoId: despesa.posto_id,
      data: despesa.data,
      tipoDespesa: despesa.tipo_despesa,
      numeroDespesa: despesa.numero_despesa,
      valor: String(Number(despesa.valor).toFixed(2)),
      fatComNif: Boolean(despesa.fat_com_nif),
      tipoPagamento: normalizeTipoPagamento(despesa.tipo_pagamento),
      faturaPaga: despesa.fatura_paga,
      numeroFatura: despesa.numero_fatura ?? "",
      faturaImagem: despesa.fatura_imagem ?? "",
      observacoes: ""
    });

    window.requestAnimationFrame(() => {
      document.getElementById("entry-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function handleEditNovadisResumo(tipo: NovadisTipo, totalGasto: number) {
    setError("");
    setNotice("");
    setEditingNovadisConsumoTipo(tipo);
    setNovadisConsumoForm({
      data: selectedDia?.data ?? selectedDate,
      tipo,
      quantidade: String(totalGasto)
    });

    window.requestAnimationFrame(() => {
      document.getElementById("novadis-consumo-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function handleCancelEditNovadisConsumo() {
    setEditingNovadisConsumoTipo(null);
    setNovadisConsumoForm(emptyNovadisConsumoForm(selectedDia?.data ?? selectedDate));
  }

  async function handleSaveAgenteConfig(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");

    const valorEventosAnual = parseMoney(agenteConfigForm.valorEventosAnual);
    const valorPatrocinios = parseMoney(agenteConfigForm.valorPatrocinios);
    const valorPeditorio = parseMoney(agenteConfigForm.valorPeditorio);
    const valorNecessarioAgente = parseMoney(agenteConfigForm.valorNecessarioAgente);

    if (valorEventosAnual < 0 || valorPatrocinios < 0 || valorPeditorio < 0 || valorNecessarioAgente < 0) {
      setError("Os valores do Pag.Agente não podem ser negativos.");
      return;
    }

    if (isDemoMode) {
      const store = readDemoStore();
      const now = new Date().toISOString();
      const nextConfig: AgenteConfig = {
        ...store.agenteConfig,
        valor_eventos_anual: valorEventosAnual,
        valor_patrocinios: valorPatrocinios,
        valor_peditorio: valorPeditorio,
        valor_necessario_agente: valorNecessarioAgente,
        atualizado_por_id: null,
        atualizado_por_nome: currentUserName,
        updated_at: now
      };

      writeDemoStore({ ...store, agenteConfig: nextConfig });
      setAgenteConfig(nextConfig);
      setAgenteConfigForm(agenteConfigToForm(nextConfig));
      setNotice("Valores do Pag.Agente guardados.");
      return;
    }

    if (!supabase || !sessionToken) {
      return;
    }

    setAgenteConfigSaving(true);

    const { data, error: saveError } = await supabase.rpc("app_guardar_agente_config", {
      p_token: sessionToken,
      p_valor_eventos_anual: valorEventosAnual,
      p_valor_patrocinios: valorPatrocinios,
      p_valor_peditorio: valorPeditorio,
      p_valor_necessario_agente: valorNecessarioAgente
    });

    setAgenteConfigSaving(false);

    if (saveError || !data?.[0]) {
      setError(saveError?.message ?? "Não foi possível guardar os valores do Pag.Agente.");
      return;
    }

    const nextConfig = normalizeAgenteConfig(data[0]);

    setAgenteConfig(nextConfig);
    setAgenteConfigForm(agenteConfigToForm(nextConfig));
    setNotice("Valores do Pag.Agente guardados.");
  }

  async function handleRegisterPagamentoAgente(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");

    const valor = parseMoney(pagamentoAgenteForm.valor);

    if (valor <= 0) {
      setError("Indica um valor entregue ao agente maior que zero.");
      return;
    }

    if (isDemoMode) {
      const store = readDemoStore();
      const nextPagamento: PagamentoAgente = {
        id: makeId("pagamento-agente"),
        valor,
        entregue_por_id: null,
        entregue_por_nome: currentUserName,
        created_at: new Date().toISOString()
      };
      const nextPagamentos = [nextPagamento, ...(store.pagamentosAgente ?? [])];

      writeDemoStore({ ...store, pagamentosAgente: nextPagamentos });
      setPagamentosAgente(nextPagamentos);
      setPagamentoAgenteForm(emptyPagamentoAgenteForm());
      setNotice("Entrega ao agente registada.");
      return;
    }

    if (!supabase || !sessionToken) {
      return;
    }

    setPagamentoAgenteSaving(true);

    const { error: saveError } = await supabase.rpc("app_registar_pagamento_agente", {
      p_token: sessionToken,
      p_valor: valor
    });

    setPagamentoAgenteSaving(false);

    if (saveError) {
      setError(saveError.message);
      return;
    }

    setPagamentoAgenteForm(emptyPagamentoAgenteForm());
    setNotice("Entrega ao agente registada.");
    await loadAgentData();
  }

  async function handleSaveNovadisConfig(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");

    if (!canManageUsers) {
      setError("Não tem privilégios para alterar valores da Novadis.");
      return;
    }

    const nextValues = {
      imperial_valor_unitario: parseMoney(novadisConfigForm.imperialValorUnitario),
      imperial_valor_tara: parseMoney(novadisConfigForm.imperialValorTara),
      cidra_valor_unitario: parseMoney(novadisConfigForm.cidraValorUnitario),
      cidra_valor_tara: parseMoney(novadisConfigForm.cidraValorTara),
      sangria_valor_unitario: parseMoney(novadisConfigForm.sangriaValorUnitario),
      sangria_valor_tara: parseMoney(novadisConfigForm.sangriaValorTara),
      co2_valor_unitario: parseMoney(novadisConfigForm.co2ValorUnitario),
      co2_valor_tara: parseMoney(novadisConfigForm.co2ValorTara)
    };

    if (Object.values(nextValues).some((value) => value < 0)) {
      setError("Os valores da Novadis não podem ser negativos.");
      return;
    }

    if (isDemoMode) {
      const store = readDemoStore();
      const now = new Date().toISOString();
      const nextConfig: NovadisConfig = {
        ...normalizeNovadisConfig(store.novadisConfig),
        ...nextValues,
        atualizado_por_id: null,
        atualizado_por_nome: currentUserName,
        updated_at: now
      };

      writeDemoStore({ ...store, novadisConfig: nextConfig });
      setNovadisConfig(nextConfig);
      setNovadisConfigForm(novadisConfigToForm(nextConfig));
      setNotice("Valores da Novadis guardados.");
      return;
    }

    if (!supabase || !sessionToken) {
      return;
    }

    setNovadisConfigSaving(true);

    const { data, error: saveError } = await supabase.rpc("app_guardar_novadis_config", {
      p_token: sessionToken,
      p_imperial_valor_unitario: nextValues.imperial_valor_unitario,
      p_imperial_valor_tara: nextValues.imperial_valor_tara,
      p_cidra_valor_unitario: nextValues.cidra_valor_unitario,
      p_cidra_valor_tara: nextValues.cidra_valor_tara,
      p_sangria_valor_unitario: nextValues.sangria_valor_unitario,
      p_sangria_valor_tara: nextValues.sangria_valor_tara,
      p_co2_valor_unitario: nextValues.co2_valor_unitario,
      p_co2_valor_tara: nextValues.co2_valor_tara
    });

    setNovadisConfigSaving(false);

    if (saveError || !data?.[0]) {
      setError(saveError?.message ?? "Não foi possível guardar os valores da Novadis.");
      return;
    }

    const nextConfig = normalizeNovadisConfig(data[0]);

    setNovadisConfig(nextConfig);
    setNovadisConfigForm(novadisConfigToForm(nextConfig));
    setNotice("Valores da Novadis guardados.");
  }

  async function handleRegisterNovadisBarril(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");

    const quantidade = Number.parseInt(novadisBarrilForm.quantidade, 10);

    if (!Number.isFinite(quantidade) || quantidade <= 0) {
      setError("Indica uma quantidade de barris maior que zero.");
      return;
    }

    if (isDemoMode) {
      const store = readDemoStore();
      const nextBarril: NovadisBarril = {
        id: makeId("novadis-barril"),
        tipo: novadisBarrilForm.tipo,
        quantidade,
        criado_por_id: null,
        criado_por_nome: currentUserName,
        created_at: new Date().toISOString()
      };
      const nextBarris = [nextBarril, ...(store.novadisBarris ?? [])];

      writeDemoStore({ ...store, novadisBarris: nextBarris });
      setNovadisBarris(nextBarris);
      setNovadisBarrilForm(emptyNovadisBarrilForm());
      setNotice("Barris recebidos registados.");
      return;
    }

    if (!supabase || !sessionToken) {
      return;
    }

    setNovadisBarrilSaving(true);

    const { error: saveError } = await supabase.rpc("app_registar_novadis_barris", {
      p_token: sessionToken,
      p_tipo: novadisBarrilForm.tipo,
      p_quantidade: quantidade
    });

    setNovadisBarrilSaving(false);

    if (saveError) {
      setError(saveError.message);
      return;
    }

    setNovadisBarrilForm(emptyNovadisBarrilForm());
    setNotice("Barris recebidos registados.");
    await loadNovadisData();
  }

  async function handleRegisterNovadisConsumo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");

    const quantidade = Number.parseInt(novadisConsumoForm.quantidade, 10);
    const tipo = normalizeNovadisTipo(novadisConsumoForm.tipo);
    const consumoDia = orderedDiasFesta.find((dia) => dia.data === novadisConsumoForm.data) ?? null;
    const availableItem = novadisPorTipo.find((item) => item.tipo === tipo);
    const isEditingTotal = editingNovadisConsumoTipo === tipo;
    const disponivel = availableItem?.cheiosADevolver ?? 0;
    const maximoTotal = availableItem?.quantidade ?? 0;

    if (!consumoDia) {
      setError("Escolhe um dia da festa para registar o gasto.");
      return;
    }

    if (consumoDia.fechado) {
      setError("Este dia está fechado e já não permite alterações.");
      return;
    }

    if (!Number.isFinite(quantidade) || quantidade < 0 || (!isEditingTotal && quantidade <= 0)) {
      setError(isEditingTotal ? "Indica um total gasto válido." : "Indica uma quantidade maior que zero.");
      return;
    }

    if (isEditingTotal && quantidade > maximoTotal) {
      setError(
        `O total gasto de ${getNovadisTipoLabel(tipo)} não pode ultrapassar ${maximoTotal} ${getNovadisUnitLabel(
          tipo,
          maximoTotal
        )} recebidos.`
      );
      return;
    }

    if (!isEditingTotal && quantidade > disponivel) {
      setError(`Só existem ${disponivel} ${getNovadisUnitLabel(tipo, disponivel)} disponíveis para ${getNovadisTipoLabel(tipo)}.`);
      return;
    }

    if (isDemoMode) {
      const store = readDemoStore();
      const nextConsumos = isEditingTotal
        ? applyNovadisConsumoTotal(
            (store.novadisConsumos ?? []).map(normalizeNovadisConsumo),
            tipo,
            quantidade,
            novadisConsumoForm.data,
            currentUserName
          )
        : [
            {
              id: makeId("novadis-consumo"),
              data: novadisConsumoForm.data,
              tipo,
              quantidade,
              criado_por_id: null,
              criado_por_nome: currentUserName,
              created_at: new Date().toISOString()
            },
            ...(store.novadisConsumos ?? [])
          ];

      writeDemoStore({ ...store, novadisConsumos: nextConsumos });
      setNovadisConsumos(nextConsumos);
      handleCancelEditNovadisConsumo();
      setNotice(isEditingTotal ? "Gasto total Novadis ajustado." : "Gasto Novadis registado.");
      return;
    }

    if (!supabase || !sessionToken) {
      return;
    }

    setNovadisConsumoSaving(true);

    const { error: saveError } = isEditingTotal
      ? await supabase.rpc("app_definir_novadis_consumo_total", {
          p_token: sessionToken,
          p_data: novadisConsumoForm.data,
          p_tipo: tipo,
          p_quantidade: quantidade
        })
      : await supabase.rpc("app_registar_novadis_consumo", {
          p_token: sessionToken,
          p_data: novadisConsumoForm.data,
          p_tipo: tipo,
          p_quantidade: quantidade
        });

    setNovadisConsumoSaving(false);

    if (saveError) {
      setError(saveError.message);
      return;
    }

    handleCancelEditNovadisConsumo();
    setNotice(isEditingTotal ? "Gasto total Novadis ajustado." : "Gasto Novadis registado.");
    await loadNovadisData();
  }

  function getTabaqueiraDisponivel(marca: string, ignoredSaidaId: string | null = null) {
    const normalizedMarca = normalizeTabaqueiraMarca(marca);
    const recebido = tabaqueiraEntradas
      .filter((entrada) => normalizeTabaqueiraMarca(entrada.marca) === normalizedMarca)
      .reduce((acc, entrada) => acc + Number(entrada.quantidade), 0);
    const saido = tabaqueiraSaidas
      .filter((saida) => normalizeTabaqueiraMarca(saida.marca) === normalizedMarca && saida.id !== ignoredSaidaId)
      .reduce((acc, saida) => acc + Number(saida.quantidade), 0);

    return Math.max(recebido - saido, 0);
  }

  async function handleRegisterTabaqueiraEntrada(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");

    const marca = normalizeTabaqueiraMarca(tabaqueiraEntradaForm.marca);
    const quantidade = Number.parseInt(tabaqueiraEntradaForm.quantidade, 10);
    const precoFornecedor = parseMoney(tabaqueiraEntradaForm.precoFornecedor);
    const pvp = parseMoney(tabaqueiraEntradaForm.pvp);

    if (!marca) {
      setError("Indica a marca do tabaco.");
      return;
    }

    if (!Number.isFinite(quantidade) || quantidade <= 0) {
      setError("Indica uma quantidade recebida maior que zero.");
      return;
    }

    if (precoFornecedor < 0 || pvp < 0) {
      setError("Os preços da Tabaqueira não podem ser negativos.");
      return;
    }

    if (isDemoMode) {
      const store = readDemoStore();
      const nextEntrada: TabaqueiraEntrada = {
        id: makeId("tabaqueira-entrada"),
        marca,
        quantidade,
        preco_fornecedor: precoFornecedor,
        pvp,
        criado_por_id: null,
        criado_por_nome: currentUserName,
        created_at: new Date().toISOString()
      };
      const nextEntradas = [nextEntrada, ...(store.tabaqueiraEntradas ?? [])];

      writeDemoStore({ ...store, tabaqueiraEntradas: nextEntradas });
      setTabaqueiraEntradas(nextEntradas.map(normalizeTabaqueiraEntrada));
      setTabaqueiraEntradaForm(emptyTabaqueiraEntradaForm());
      setNotice("Tabaco recebido registado.");
      return;
    }

    if (!supabase || !sessionToken) {
      return;
    }

    setTabaqueiraEntradaSaving(true);

    const { error: saveError } = await supabase.rpc("app_registar_tabaqueira_entrada", {
      p_token: sessionToken,
      p_marca: marca,
      p_quantidade: quantidade,
      p_preco_fornecedor: precoFornecedor,
      p_pvp: pvp
    });

    setTabaqueiraEntradaSaving(false);

    if (saveError) {
      setError(saveError.message);
      return;
    }

    setTabaqueiraEntradaForm(emptyTabaqueiraEntradaForm());
    setNotice("Tabaco recebido registado.");
    await loadTabaqueiraData();
  }

  function handleCancelEditTabaqueiraSaida() {
    setTabaqueiraSaidaForm((current) => ({
      ...emptyTabaqueiraSaidaForm(current.data || selectedDia?.data || selectedDate),
      marca: tabaqueiraPorMarca.find((item) => item.stock > 0)?.marca ?? "",
      postoId: current.postoId || activePostos[0]?.id || ""
    }));
  }

  async function handleSaveTabaqueiraSaida(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");

    const marca = normalizeTabaqueiraMarca(tabaqueiraSaidaForm.marca);
    const quantidade = Number.parseInt(tabaqueiraSaidaForm.quantidade, 10);
    const levadoPor = tabaqueiraSaidaForm.levadoPor.trim();
    const saidaDia = orderedDiasFesta.find((dia) => dia.data === tabaqueiraSaidaForm.data) ?? null;
    const posto = postos.find((current) => current.id === tabaqueiraSaidaForm.postoId) ?? null;
    const justificacao = tabaqueiraSaidaForm.justificacao.trim();
    const editingId = tabaqueiraSaidaForm.id;

    if (!saidaDia) {
      setError("Escolhe o dia da festa em que saiu o tabaco.");
      return;
    }

    if (saidaDia.fechado) {
      setError("Este dia está fechado e já não permite alterações.");
      return;
    }

    if (!marca) {
      setError("Escolhe a marca do tabaco para a saída.");
      return;
    }

    if (!Number.isFinite(quantidade) || quantidade <= 0) {
      setError("Indica uma quantidade de saída maior que zero.");
      return;
    }

    if (!levadoPor) {
      setError("Indica quem levou o tabaco.");
      return;
    }

    if (!posto) {
      setError("Escolhe o posto de destino.");
      return;
    }

    if (editingId && !justificacao) {
      setError("Indica a justificação da alteração antes de guardar.");
      return;
    }

    const disponivel = getTabaqueiraDisponivel(marca, editingId);

    if (quantidade > disponivel) {
      setError(`Só existem ${disponivel} maços/unidades disponíveis para ${marca}.`);
      return;
    }

    if (isDemoMode) {
      const store = readDemoStore();
      const existingIndex = editingId ? store.tabaqueiraSaidas.findIndex((saida) => saida.id === editingId) : -1;
      const existingSaida = existingIndex >= 0 ? normalizeTabaqueiraSaida(store.tabaqueiraSaidas[existingIndex]) : null;
      const now = new Date().toISOString();
      const nextSaida: TabaqueiraSaida = {
        id: existingSaida?.id ?? makeId("tabaqueira-saida"),
        data: saidaDia.data,
        marca,
        quantidade,
        levado_por: levadoPor,
        posto_id: posto.id,
        posto_nome: posto.nome,
        justificacao_edicao: editingId ? justificacao : null,
        criado_por_id: existingSaida?.criado_por_id ?? null,
        criado_por_nome: existingSaida?.criado_por_nome ?? currentUserName,
        atualizado_por_id: editingId ? null : existingSaida?.atualizado_por_id ?? null,
        atualizado_por_nome: editingId ? currentUserName : existingSaida?.atualizado_por_nome ?? null,
        created_at: existingSaida?.created_at ?? now,
        updated_at: now
      };
      const nextSaidas =
        existingIndex >= 0
          ? store.tabaqueiraSaidas.map((saida, index) => (index === existingIndex ? nextSaida : saida))
          : [nextSaida, ...(store.tabaqueiraSaidas ?? [])];

      writeDemoStore({ ...store, tabaqueiraSaidas: nextSaidas });
      setTabaqueiraSaidas(nextSaidas.map(normalizeTabaqueiraSaida));
      handleCancelEditTabaqueiraSaida();
      setNotice(editingId ? "Saída de tabaco alterada." : "Saída de tabaco registada.");
      return;
    }

    if (!supabase || !sessionToken) {
      return;
    }

    setTabaqueiraSaidaSaving(true);

    const { error: saveError } = await supabase.rpc("app_guardar_tabaqueira_saida", {
      p_token: sessionToken,
      p_id: editingId,
      p_data: saidaDia.data,
      p_marca: marca,
      p_quantidade: quantidade,
      p_levado_por: levadoPor,
      p_posto_id: posto.id,
      p_justificacao_edicao: editingId ? justificacao : null
    });

    setTabaqueiraSaidaSaving(false);

    if (saveError) {
      setError(saveError.message);
      return;
    }

    handleCancelEditTabaqueiraSaida();
    setNotice(editingId ? "Saída de tabaco alterada." : "Saída de tabaco registada.");
    await loadTabaqueiraData();
  }

  function handleEditTabaqueiraSaida(saida: TabaqueiraSaida) {
    setError("");
    setNotice("");
    setTabaqueiraSaidaForm({
      id: saida.id,
      data: saida.data ?? selectedDia?.data ?? selectedDate,
      marca: saida.marca,
      quantidade: String(saida.quantidade),
      levadoPor: saida.levado_por,
      postoId: saida.posto_id ?? "",
      justificacao: ""
    });

    window.requestAnimationFrame(() => {
      document.getElementById("tabaqueira-saida-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  async function handleDeleteTabaqueiraSaida(id: string) {
    if (!canDeleteData) {
      setError("Não tem privilégios para apagar dados inseridos.");
      return;
    }

    const shouldDelete = window.confirm("Apagar esta saída de tabaco?");

    if (!shouldDelete) {
      return;
    }

    setError("");
    setNotice("");

    if (isDemoMode) {
      const store = readDemoStore();
      const nextSaidas = (store.tabaqueiraSaidas ?? []).filter((saida) => saida.id !== id);

      writeDemoStore({ ...store, tabaqueiraSaidas: nextSaidas });
      setTabaqueiraSaidas(nextSaidas.map(normalizeTabaqueiraSaida));
      if (tabaqueiraSaidaForm.id === id) {
        handleCancelEditTabaqueiraSaida();
      }
      setNotice("Saída de tabaco apagada.");
      return;
    }

    if (!supabase || !sessionToken) {
      return;
    }

    const { error: deleteError } = await supabase.rpc("app_apagar_tabaqueira_saida", {
      p_token: sessionToken,
      p_id: id
    });

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    if (tabaqueiraSaidaForm.id === id) {
      handleCancelEditTabaqueiraSaida();
    }
    setNotice("Saída de tabaco apagada.");
    await loadTabaqueiraData();
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
            <p className="eyebrow">Entrada da equipa</p>
            <h1>FestaSoft</h1>
            <p className="auth-credit">Criado por João Galaio</p>
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
          <h1>
            {isOverviewMode
              ? "Overview da festa"
              : isRegisterMode
                ? "Registo diário"
                : isReportsMode
                  ? "Relatórios"
                  : isAgentMode
                    ? "Pag.Agente"
                    : isStocksMode
                      ? "Stocks"
                      : "Gestão"}
          </h1>
        </div>

        <div className="top-actions">
          {isRegisterMode || isReportsMode ? (
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
        <Link className={`app-nav-link ${isReportsMode ? "active" : ""}`} href="/relatorios">
          <FileText size={18} aria-hidden="true" />
          Relatórios
        </Link>
        <Link className={`app-nav-link ${isAgentMode ? "active" : ""}`} href="/pag-agente">
          <HandCoins size={18} aria-hidden="true" />
          Pag.Agente
        </Link>
        <Link className={`app-nav-link ${isStocksMode ? "active" : ""}`} href="/stocks">
          <Tags size={18} aria-hidden="true" />
          Stocks
        </Link>
        <Link className={`app-nav-link ${isManagementMode ? "active" : ""}`} href="/gestao">
          <Settings size={18} aria-hidden="true" />
          Gestão
        </Link>
      </nav>

      {isOverviewMode ? (
        <section className="summary-grid" aria-label="Totais da festa">
          <button
            className="metric metric-total metric-button"
            type="button"
            onClick={() => setOverviewOnlyFestaTotal((current) => !current)}
            aria-pressed={overviewOnlyFestaTotal}
            title="Alternar total da festa"
          >
            <span>Total da festa</span>
            <strong>{formatCurrency(overviewTotalApresentado)}</strong>
            <small>
              {overviewOnlyFestaTotal
                ? "Só faturação registada"
                : `Inclui ${formatCurrency(agenteValoresBase)} em valores extra`}
            </small>
          </button>
          <article className="metric metric-total">
            <span>Despesas</span>
            <strong>{formatCurrency(dailyDespesasTotal)}</strong>
          </article>
          <button
            className="metric metric-total metric-button"
            type="button"
            onClick={() => setOverviewOnlyFestaSaldo((current) => !current)}
            aria-pressed={overviewOnlyFestaSaldo}
            title="Alternar saldo real"
          >
            <span>Saldo real</span>
            <strong>{formatCurrency(overviewSaldoApresentado)}</strong>
            <small>
              {overviewOnlyFestaSaldo
                ? "Só faturação menos despesas"
                : `Depois de pagar agente: ${formatCurrency(agenteTotalEntregue)}`}
            </small>
          </button>
          <article className="metric">
            <span>Pago dinheiro</span>
            <strong>{formatCurrency(dailyExpensePaymentTotals.dinheiro)}</strong>
          </article>
          <article className="metric">
            <span>Pago transf.</span>
            <strong>{formatCurrency(dailyExpensePaymentTotals.transferencia)}</strong>
          </article>
          <article className="metric">
            <span>Pago agente</span>
            <strong>{formatCurrency(agenteTotalEntregue)}</strong>
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
            <span>Dias criados</span>
            <strong>{orderedDiasFesta.length}</strong>
          </article>
          <article className="metric">
            <span>Dias fechados</span>
            <strong>
              {orderedDiasFesta.filter((dia) => dia.fechado).length}/{orderedDiasFesta.length}
            </strong>
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
          <article className="metric metric-total">
            <span>Despesas</span>
            <strong>{formatCurrency(selectedDespesasTotal)}</strong>
          </article>
          <article className="metric metric-total">
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
              <h2>Todos os dias</h2>
            </div>
            <Link className="icon-text-button" href="/registo">
              <Euro size={18} aria-hidden="true" />
              Registar
            </Link>
          </div>

          {loading ? (
            <div className="empty-state">A carregar overview.</div>
          ) : !orderedDiasFesta.length ? (
            <div className="empty-state">Cria primeiro um dia da festa na Gestão.</div>
          ) : (
            <div className="table-wrap">
              <table className="overview-table">
                <thead>
                  <tr>
                    <th>Dia</th>
                    <th>Faturação</th>
                    <th>Despesas</th>
                    <th>Saldo</th>
                    <th>Pago dinheiro</th>
                    <th>Pago transf.</th>
                    <th>Dinheiro</th>
                    <th>Multibanco</th>
                    <th>MB Way</th>
                    <th>Postos</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {orderedDiasFesta.map((dia) => {
                    const summary = overviewDayFinancials.get(dia.data) ?? {
                      despesas: 0,
                      despesasDinheiro: 0,
                      despesasTransferencia: 0,
                      dinheiro: 0,
                      faturacao: 0,
                      mbway: 0,
                      multibanco: 0,
                      postosRegistados: 0
                    };
                    const saldo = summary.faturacao - summary.despesas;

                    return (
                      <tr key={dia.id}>
                        <td>
                          <strong>{dia.nome}</strong>
                          <span>{formatDateLabel(dia.data)}</span>
                        </td>
                        <td>
                          <strong>{formatCurrency(summary.faturacao)}</strong>
                        </td>
                        <td>{formatCurrency(summary.despesas)}</td>
                        <td>
                          <strong>{formatCurrency(saldo)}</strong>
                        </td>
                        <td>{formatCurrency(summary.despesasDinheiro)}</td>
                        <td>{formatCurrency(summary.despesasTransferencia)}</td>
                        <td>{formatCurrency(summary.dinheiro)}</td>
                        <td>{formatCurrency(summary.multibanco)}</td>
                        <td>{formatCurrency(summary.mbway)}</td>
                        <td>
                          {summary.postosRegistados}/{activePostos.length}
                        </td>
                        <td>{dia.fechado ? "Fechado" : "Aberto"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}

      {isReportsMode ? (
        <section className="panel report-panel">
          <div className="panel-heading table-heading no-print">
            <div>
              <p className="eyebrow">Relatório de impressão</p>
              <h2>{selectedDayLabel}</h2>
            </div>
            <div className="report-actions">
              <button className="icon-text-button" type="button" onClick={() => void loadData()} disabled={loading}>
                <RefreshCw size={18} className={loading ? "spin" : ""} aria-hidden="true" />
                Atualizar
              </button>
              <button
                className="primary-button"
                type="button"
                onClick={() => window.print()}
                disabled={loading || !selectedDia}
              >
                <Printer size={18} aria-hidden="true" />
                Imprimir
              </button>
            </div>
          </div>

          {loading ? (
            <div className="empty-state">A carregar relatório.</div>
          ) : !selectedDia ? (
            <div className="empty-state">Cria primeiro um dia da festa na Gestão.</div>
          ) : (
            <article className="report-document">
              <header className="report-header">
                <div>
                  <p className="eyebrow">Festa de Pontével</p>
                  <h2>Relatório diário</h2>
                  <span>{selectedDayLabel}</span>
                </div>
                <div className="report-stamp">
                  <strong>{selectedDia.fechado ? "Dia fechado" : "Dia aberto"}</strong>
                  <span>Gerado por {currentUserName}</span>
                  <span>{formatDateTimeLabel(new Date().toISOString())}</span>
                </div>
              </header>

              <section className="report-summary" aria-label="Totais do relatório">
                <div className="report-summary-card featured">
                  <span>Faturação</span>
                  <strong>{formatCurrency(dailyTotals.total)}</strong>
                </div>
                <div className="report-summary-card featured">
                  <span>Despesas</span>
                  <strong>{formatCurrency(dailyDespesasTotal)}</strong>
                </div>
                <div className="report-summary-card featured">
                  <span>Saldo</span>
                  <strong>{formatCurrency(dailySaldo)}</strong>
                </div>
                <div className="report-summary-card">
                  <span>Dinheiro</span>
                  <strong>{formatCurrency(dailyTotals.dinheiro)}</strong>
                </div>
                <div className="report-summary-card">
                  <span>Multibanco</span>
                  <strong>{formatCurrency(dailyTotals.multibanco)}</strong>
                </div>
                <div className="report-summary-card">
                  <span>MB Way</span>
                  <strong>{formatCurrency(dailyTotals.mbway)}</strong>
                </div>
                <div className="report-summary-card">
                  <span>Desp. dinheiro</span>
                  <strong>{formatCurrency(dailyExpensePaymentTotals.dinheiro)}</strong>
                </div>
                <div className="report-summary-card">
                  <span>Desp. transferência</span>
                  <strong>{formatCurrency(dailyExpensePaymentTotals.transferencia)}</strong>
                </div>
              </section>

              <section className="report-section">
                <div className="report-section-heading">
                  <h3>Resumo por posto</h3>
                  <span>{reportPostoRows.length} postos</span>
                </div>
                <div className="table-wrap">
                  <table className="report-table">
                    <thead>
                      <tr>
                        <th>Posto</th>
                        <th>Dinheiro</th>
                        <th>Multibanco</th>
                        <th>MB Way</th>
                        <th>Faturação</th>
                        <th>Despesas</th>
                        <th>Saldo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportPostoRows.map((posto) => (
                        <tr key={posto.postoId}>
                          <td>
                            <strong>{posto.nome}</strong>
                            <span>{posto.responsavel}</span>
                          </td>
                          <td>{formatCurrency(posto.dinheiro)}</td>
                          <td>{formatCurrency(posto.multibanco)}</td>
                          <td>{formatCurrency(posto.mbway)}</td>
                          <td>
                            <strong>{formatCurrency(posto.faturacao)}</strong>
                          </td>
                          <td>{formatCurrency(posto.despesas)}</td>
                          <td>
                            <strong>{formatCurrency(posto.saldo)}</strong>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="report-section">
                <div className="report-section-heading">
                  <h3>Faturação registada</h3>
                  <span>{registos.length} registos</span>
                </div>
                {registos.length ? (
                  <div className="table-wrap">
                    <table className="report-table">
                      <thead>
                        <tr>
                          <th>Posto</th>
                          <th>Dinheiro</th>
                          <th>Multibanco</th>
                          <th>MB Way</th>
                          <th>Total</th>
                          <th>Alterado por</th>
                          <th>Observações</th>
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
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="empty-state compact">Sem faturação registada neste dia.</div>
                )}
              </section>

              <section className="report-section">
                <div className="report-section-heading">
                  <h3>Despesas registadas</h3>
                  <span>{despesas.length} despesas</span>
                </div>
                {despesas.length ? (
                  <div className="table-wrap">
                    <table className="report-table">
                      <thead>
                        <tr>
                          <th>Posto</th>
                          <th>Tipo</th>
                          <th>Nº despesa</th>
                          <th>Valor</th>
                          <th>FAT c/ NIF</th>
                          <th>Pagamento</th>
                          <th>Fatura</th>
                          <th>Imagem</th>
                          <th>Alterado por</th>
                          <th>Observações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {despesas.map((despesa) => (
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
                            <td>{despesa.fat_com_nif ? "Sim" : "Não"}</td>
                            <td>{formatTipoPagamento(despesa.tipo_pagamento)}</td>
                            <td className="audit-cell">
                              <strong>{despesa.fatura_paga ? "Paga" : "Por pagar"}</strong>
                              <span>{despesa.numero_fatura ?? ""}</span>
                            </td>
                            <td>
                              {despesa.fatura_imagem ? (
                                <a
                                  className="invoice-link"
                                  href={despesa.fatura_imagem}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  <img
                                    className="invoice-thumb"
                                    src={despesa.fatura_imagem}
                                    alt={`Fatura ${despesa.numero_fatura ?? despesa.numero_despesa}`}
                                  />
                                  <span>Ver</span>
                                </a>
                              ) : null}
                            </td>
                            <td className="audit-cell">
                              <strong>{despesa.atualizado_por_nome ?? despesa.criado_por_nome ?? "Sem utilizador"}</strong>
                              <span>{formatDateTimeLabel(despesa.updated_at)}</span>
                            </td>
                            <td>{despesa.observacoes || ""}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="empty-state compact">Sem despesas registadas neste dia.</div>
                )}
              </section>
            </article>
          )}
        </section>
      ) : null}

      {isAgentMode ? (
        <>
          <section className="summary-grid" aria-label="Totais Pag.Agente">
            <article className="metric metric-total">
              <span>Valor necessário</span>
              <strong>{formatCurrency(agenteValorNecessario)}</strong>
              <small>Definido na Gestão</small>
            </article>
            <article className="metric metric-total">
              <span>Já pago</span>
              <strong>{formatCurrency(agenteTotalEntregue)}</strong>
              <small>{pagamentosAgente.length} entregas registadas</small>
            </article>
            <article className="metric metric-total">
              <span>Falta pagar</span>
              <strong>{formatCurrency(agenteFaltaPagar)}</strong>
              <small>
                {agentePagoAMais > 0 ? `Pago a mais: ${formatCurrency(agentePagoAMais)}` : "Por liquidar ao agente"}
              </small>
            </article>
            <article className="metric">
              <span>Eventos anual</span>
              <strong>{formatCurrency(Number(agenteConfig.valor_eventos_anual))}</strong>
            </article>
            <article className="metric">
              <span>Patrocínios</span>
              <strong>{formatCurrency(Number(agenteConfig.valor_patrocinios))}</strong>
            </article>
            <article className="metric">
              <span>Peditório</span>
              <strong>{formatCurrency(Number(agenteConfig.valor_peditorio))}</strong>
            </article>
            <article className="metric">
              <span>Saldo acumulado</span>
              <strong>{formatCurrency(saldoAcumuladoReal)}</strong>
              <small>Depois de pagar agente</small>
            </article>
            <article className="metric">
              <span>Total acumulado</span>
              <strong>{formatCurrency(agenteTotalCalculado)}</strong>
              <small>Antes das entregas ao agente</small>
            </article>
          </section>

          <section className="panel">
            <div className="panel-heading table-heading">
              <div>
                <p className="eyebrow">Pag.Agente</p>
                <h2>Entrega de dinheiro ao agente</h2>
                <span className="panel-subtitle">O registo guarda automaticamente dia, hora e utilizador.</span>
              </div>
              <button
                className="icon-text-button"
                type="button"
                onClick={() => {
                  void loadData();
                  void loadAgentData();
                }}
                disabled={loading}
              >
                <RefreshCw size={18} className={loading ? "spin" : ""} aria-hidden="true" />
                Atualizar
              </button>
            </div>

            <form className="agent-payment-form" onSubmit={handleRegisterPagamentoAgente}>
              <label>
                Valor entregue ao agente
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={pagamentoAgenteForm.valor}
                  onChange={(event) => setPagamentoAgenteForm({ valor: event.target.value })}
                  placeholder="0,00"
                  required
                />
              </label>
              <button className="primary-button" type="submit" disabled={pagamentoAgenteSaving}>
                <HandCoins size={18} aria-hidden="true" />
                {pagamentoAgenteSaving ? "A registar" : "Registar entrega"}
              </button>
            </form>
          </section>

          <section className="panel">
            <div className="panel-heading table-heading">
              <div>
                <p className="eyebrow">Histórico</p>
                <h2>Entregas ao agente</h2>
              </div>
            </div>

            {pagamentosAgente.length ? (
              <div className="table-wrap">
                <table className="agent-table">
                  <thead>
                    <tr>
                      <th>Dia e hora</th>
                      <th>Valor</th>
                      <th>Entregue por</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagamentosAgente.map((pagamento) => (
                      <tr key={pagamento.id}>
                        <td>{formatDateTimeLabel(pagamento.created_at)}</td>
                        <td>
                          <strong>{formatCurrency(Number(pagamento.valor))}</strong>
                        </td>
                        <td>{pagamento.entregue_por_nome}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state compact">Ainda não existem entregas ao agente.</div>
            )}
          </section>
        </>
      ) : null}

      {isStocksMode ? (
        <section className="stock-tabs-shell" aria-label="Stocks">
          <div className="side-tabs stock-tabs" role="tablist" aria-label="Secções de stocks">
            <button
              className={`tab-button ${stockTab === "novadis" ? "active" : ""}`}
              type="button"
              role="tab"
              aria-selected={stockTab === "novadis"}
              onClick={() => setStockTab("novadis")}
            >
              <Beer size={18} aria-hidden="true" />
              Novadis
            </button>
            <button
              className={`tab-button ${stockTab === "tabaqueira" ? "active" : ""}`}
              type="button"
              role="tab"
              aria-selected={stockTab === "tabaqueira"}
              onClick={() => setStockTab("tabaqueira")}
            >
              <Receipt size={18} aria-hidden="true" />
              Tabaqueira
            </button>
          </div>
        </section>
      ) : null}

      {isNovadisMode ? (
        <>
          <section className="summary-grid" aria-label="Totais Novadis">
            <article className="metric metric-total">
              <span>Valor recebido</span>
              <strong>{formatCurrency(novadisValorBarris)}</strong>
              <small>{novadisTotalBarris} unidades registadas</small>
            </article>
            <article className="metric metric-total">
              <span>Valor devolução</span>
              <strong>{formatCurrency(novadisValorDevolucao)}</strong>
              <small>
                Cheios {formatCurrency(novadisValorCheiosADevolver)} · Tara{" "}
                {formatCurrency(novadisValorVaziosADevolver)}
              </small>
            </article>
            <article className="metric metric-total">
              <span>Gasto</span>
              <strong>{novadisTotalGasto}</strong>
              <small>
                {novadisTotalCheiosADevolver} cheios · {novadisTotalVaziosADevolver} vazios
              </small>
            </article>
            {novadisPorTipo.map((item) => (
              <article className="metric" key={item.tipo}>
                <span>{item.label}</span>
                <strong>{item.cheiosADevolver}</strong>
                <small>
                  Cheios · {item.vaziosADevolver} vazios · {formatCurrency(item.valorCheiosADevolver + item.valorVaziosADevolver)}
                </small>
              </article>
            ))}
          </section>

          <section className="panel">
            <div className="panel-heading table-heading">
              <div>
                <p className="eyebrow">Novadis</p>
                <h2>Valores por tipo</h2>
                <span className="panel-subtitle">
                  Última alteração por {novadisConfig.atualizado_por_nome ?? "Sistema"} em{" "}
                  {formatDateTimeLabel(novadisConfig.updated_at)}
                </span>
              </div>
              <button
                className="icon-text-button"
                type="button"
                onClick={() => {
                  void loadNovadisData();
                }}
                disabled={novadisConfigSaving || novadisBarrilSaving || novadisConsumoSaving}
              >
                <RefreshCw
                  size={18}
                  className={novadisConfigSaving || novadisBarrilSaving || novadisConsumoSaving ? "spin" : ""}
                  aria-hidden="true"
                />
                Atualizar
              </button>
            </div>

            {!canManageUsers ? (
              <div className="alert info">Apenas administradores podem alterar os valores da Novadis.</div>
            ) : null}

            <form className="novadis-config-form" onSubmit={handleSaveNovadisConfig}>
              <div className="novadis-price-grid">
                {NOVADIS_TIPOS.map((item) => (
                  <div className="novadis-price-card" key={item.tipo}>
                    <h3>{item.label}</h3>
                    <div className="novadis-price-fields">
                      <label>
                        Valor unitário
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          inputMode="decimal"
                          value={novadisConfigForm[item.valorFormKey]}
                          onChange={(event) =>
                            setNovadisConfigForm((current) => ({
                              ...current,
                              [item.valorFormKey]: event.target.value
                            }))
                          }
                          disabled={!canManageUsers || novadisConfigSaving}
                        />
                      </label>
                      <label>
                        Tara
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          inputMode="decimal"
                          value={novadisConfigForm[item.taraFormKey]}
                          onChange={(event) =>
                            setNovadisConfigForm((current) => ({
                              ...current,
                              [item.taraFormKey]: event.target.value
                            }))
                          }
                          disabled={!canManageUsers || novadisConfigSaving}
                        />
                      </label>
                    </div>
                  </div>
                ))}
              </div>
              <div className="form-actions wide-field">
                <button className="secondary-button" type="submit" disabled={!canManageUsers || novadisConfigSaving}>
                  <Save size={18} aria-hidden="true" />
                  {novadisConfigSaving ? "A guardar" : "Guardar valores"}
                </button>
              </div>
            </form>
          </section>

          <section className="panel">
            <div className="panel-heading">
              <div className="heading-icon">
                <Beer size={20} aria-hidden="true" />
              </div>
              <div>
                <p className="eyebrow">Receção</p>
                <h2>Registos recebidos</h2>
                <span className="panel-subtitle">O registo guarda automaticamente dia, hora e utilizador.</span>
              </div>
            </div>

            <form className="novadis-barril-form" onSubmit={handleRegisterNovadisBarril}>
              <label>
                Tipo
                <select
                  value={novadisBarrilForm.tipo}
                  onChange={(event) =>
                    setNovadisBarrilForm((current) => ({
                      ...current,
                      tipo: normalizeNovadisTipo(event.target.value)
                    }))
                  }
                >
                  {NOVADIS_TIPOS.map((item) => (
                    <option key={item.tipo} value={item.tipo}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Quantidade
                <input
                  type="number"
                  min="1"
                  step="1"
                  inputMode="numeric"
                  value={novadisBarrilForm.quantidade}
                  onChange={(event) =>
                    setNovadisBarrilForm((current) => ({ ...current, quantidade: event.target.value }))
                  }
                  placeholder="0"
                  required
                />
              </label>
              <button className="primary-button" type="submit" disabled={novadisBarrilSaving}>
                <Plus size={18} aria-hidden="true" />
                {novadisBarrilSaving ? "A registar" : "Registar"}
              </button>
            </form>
          </section>

          <section className="panel" id="novadis-consumo-panel">
            <div className="panel-heading">
              <div className="heading-icon">
                <Receipt size={20} aria-hidden="true" />
              </div>
              <div>
                <p className="eyebrow">Consignação</p>
                <h2>{isEditingNovadisConsumoTotal ? "Editar gasto total" : "Gasto diário"}</h2>
                <span className="panel-subtitle">
                  {isEditingNovadisConsumoTotal
                    ? "Define o total gasto deste produto para corrigir enganos."
                    : "O gasto desconta no stock cheio e passa a contar como tara."}
                </span>
              </div>
            </div>

            <form className="novadis-consumo-form" onSubmit={handleRegisterNovadisConsumo}>
              {isEditingNovadisConsumoTotal ? (
                <div className="edit-menu wide-field">
                  <div>
                    <strong>Menu de edição</strong>
                    <span>{getNovadisTipoLabel(editingNovadisConsumoTipo)}</span>
                    <small>O valor indicado será o total gasto acumulado deste produto.</small>
                  </div>
                  <button className="icon-text-button" type="button" onClick={handleCancelEditNovadisConsumo}>
                    <X size={18} aria-hidden="true" />
                    Cancelar
                  </button>
                </div>
              ) : null}

              <label>
                Dia
                <select
                  value={orderedDiasFesta.length ? novadisConsumoForm.data : ""}
                  onChange={(event) =>
                    setNovadisConsumoForm((current) => ({
                      ...current,
                      data: event.target.value
                    }))
                  }
                  disabled={!orderedDiasFesta.length || novadisConsumoSaving}
                >
                  {orderedDiasFesta.length ? null : <option value="">Criar dia na Gestão</option>}
                  {orderedDiasFesta.map((dia) => (
                    <option key={dia.id} value={dia.data}>
                      {dia.nome} · {formatDateLabel(dia.data)} {dia.fechado ? "· fechado" : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Tipo
                <select
                  value={novadisConsumoForm.tipo}
                  onChange={(event) =>
                    setNovadisConsumoForm((current) => ({
                      ...current,
                      tipo: normalizeNovadisTipo(event.target.value)
                    }))
                  }
                  disabled={novadisConsumoSaving || isEditingNovadisConsumoTotal}
                >
                  {NOVADIS_TIPOS.map((item) => (
                    <option key={item.tipo} value={item.tipo}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {isEditingNovadisConsumoTotal ? "Total gasto" : "Quantidade gasta"}
                <input
                  type="number"
                  min={isEditingNovadisConsumoTotal ? "0" : "1"}
                  step="1"
                  inputMode="numeric"
                  value={novadisConsumoForm.quantidade}
                  onChange={(event) =>
                    setNovadisConsumoForm((current) => ({ ...current, quantidade: event.target.value }))
                  }
                  placeholder="0"
                  required
                  disabled={novadisConsumoSaving}
                />
              </label>
              <button
                className="primary-button"
                type="submit"
                disabled={novadisConsumoSaving || !orderedDiasFesta.length}
              >
                <Save size={18} aria-hidden="true" />
                {novadisConsumoSaving
                  ? "A guardar"
                  : isEditingNovadisConsumoTotal
                    ? "Guardar ajuste"
                    : "Registar gasto"}
              </button>
            </form>
          </section>

          <section className="panel">
            <div className="panel-heading table-heading">
              <div>
                <p className="eyebrow">Devolução</p>
                <h2>Resumo de consignação</h2>
              </div>
            </div>

            <div className="table-wrap">
              <table className="agent-table">
                <thead>
                  <tr>
                    <th>Produto</th>
                    <th>Recebido</th>
                    <th>Gasto</th>
                    <th>Cheios a devolver</th>
                    <th>Valor cheios</th>
                    <th>Vazios / tara</th>
                    <th>Valor tara</th>
                    <th>Total devolução</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {novadisPorTipo.map((item) => (
                    <tr key={item.tipo}>
                      <td>{item.label}</td>
                      <td>{item.quantidade}</td>
                      <td>{item.gasto}</td>
                      <td>
                        <strong>{item.cheiosADevolver}</strong>
                      </td>
                      <td>{formatCurrency(item.valorCheiosADevolver)}</td>
                      <td>{item.vaziosADevolver}</td>
                      <td>{formatCurrency(item.valorVaziosADevolver)}</td>
                      <td>
                        <strong>{formatCurrency(item.valorCheiosADevolver + item.valorVaziosADevolver)}</strong>
                      </td>
                      <td>
                        <button
                          className="icon-text-button table-action"
                          type="button"
                          onClick={() => handleEditNovadisResumo(item.tipo, item.gasto)}
                        >
                          <Pencil size={16} aria-hidden="true" />
                          Editar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="panel">
            <div className="panel-heading table-heading">
              <div>
                <p className="eyebrow">Histórico</p>
                <h2>Registos recebidos</h2>
              </div>
            </div>

            {novadisBarris.length ? (
              <div className="table-wrap">
                <table className="agent-table">
                  <thead>
                    <tr>
                      <th>Dia e hora</th>
                      <th>Tipo</th>
                      <th>Quantidade</th>
                      <th>Valor total</th>
                      <th>Valor tara</th>
                      <th>Diferença</th>
                      <th>Registado por</th>
                    </tr>
                  </thead>
                  <tbody>
                    {novadisBarris.map((barril) => {
                      const tipo = normalizeNovadisTipo(barril.tipo);
                      const item = NOVADIS_TIPOS.find((current) => current.tipo === tipo) ?? NOVADIS_TIPOS[0];
                      const quantidade = Number(barril.quantidade);
                      const valorBarris = quantidade * Number(novadisConfig[item.valorKey]);
                      const valorTara = quantidade * Number(novadisConfig[item.taraKey]);

                      return (
                        <tr key={barril.id}>
                          <td>{formatDateTimeLabel(barril.created_at)}</td>
                          <td>{getNovadisTipoLabel(tipo)}</td>
                          <td>
                            <strong>{quantidade}</strong>
                            <span>{getNovadisUnitLabel(tipo, quantidade)}</span>
                          </td>
                          <td>{formatCurrency(valorBarris)}</td>
                          <td>{formatCurrency(valorTara)}</td>
                          <td>
                            <strong>{formatCurrency(valorBarris - valorTara)}</strong>
                          </td>
                          <td>{barril.criado_por_nome}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state compact">Ainda não existem registos Novadis.</div>
            )}
          </section>

          <section className="panel">
            <div className="panel-heading table-heading">
              <div>
                <p className="eyebrow">Histórico</p>
                <h2>Gastos por dia</h2>
              </div>
            </div>

            {novadisConsumos.length ? (
              <div className="table-wrap">
                <table className="agent-table">
                  <thead>
                    <tr>
                      <th>Dia</th>
                      <th>Registado em</th>
                      <th>Tipo</th>
                      <th>Quantidade</th>
                      <th>Valor tara</th>
                      <th>Registado por</th>
                    </tr>
                  </thead>
                  <tbody>
                    {novadisConsumos.map((consumo) => {
                      const tipo = normalizeNovadisTipo(consumo.tipo);
                      const item = NOVADIS_TIPOS.find((current) => current.tipo === tipo) ?? NOVADIS_TIPOS[0];
                      const quantidade = Number(consumo.quantidade);
                      const valorTara = quantidade * Number(novadisConfig[item.taraKey]);

                      return (
                        <tr key={consumo.id}>
                          <td>{formatDateLabel(consumo.data)}</td>
                          <td>{formatDateTimeLabel(consumo.created_at)}</td>
                          <td>{getNovadisTipoLabel(tipo)}</td>
                          <td>
                            <strong>{quantidade}</strong>
                            <span>{getNovadisUnitLabel(tipo, quantidade)}</span>
                          </td>
                          <td>{formatCurrency(valorTara)}</td>
                          <td>{consumo.criado_por_nome}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state compact">Ainda não existem gastos Novadis registados.</div>
            )}
          </section>
        </>
      ) : null}

      {isTabaqueiraMode ? (
        <>
          <section className="summary-grid" aria-label="Totais Tabaqueira">
            <article className="metric metric-total">
              <span>Stock atual</span>
              <strong>{tabaqueiraTotalStock}</strong>
              <small>
                {tabaqueiraTotalRecebido} recebidos · {tabaqueiraTotalSaido} saídos
              </small>
            </article>
            <article className="metric metric-total">
              <span>Valor fornecedor</span>
              <strong>{formatCurrency(tabaqueiraValorFornecedorStock)}</strong>
              <small>Valor do stock pelo preço fornecedor</small>
            </article>
            <article className="metric metric-total">
              <span>Valor PVP</span>
              <strong>{formatCurrency(tabaqueiraValorPvpStock)}</strong>
              <small>Valor do stock pelo preço de venda</small>
            </article>
            <article className="metric">
              <span>Marcas</span>
              <strong>{tabaqueiraPorMarca.length}</strong>
              <small>{tabaqueiraSaidas.length} saídas registadas</small>
            </article>
          </section>

          <section className="panel">
            <div className="panel-heading">
              <div className="heading-icon">
                <Plus size={20} aria-hidden="true" />
              </div>
              <div>
                <p className="eyebrow">Tabaqueira</p>
                <h2>Receção de tabaco</h2>
                <span className="panel-subtitle">Regista marca, quantidade recebida, preço fornecedor e PVP.</span>
              </div>
            </div>

            <form className="tabaqueira-entrada-form" onSubmit={handleRegisterTabaqueiraEntrada}>
              <label>
                Marca
                <input
                  type="text"
                  value={tabaqueiraEntradaForm.marca}
                  onChange={(event) =>
                    setTabaqueiraEntradaForm((current) => ({ ...current, marca: event.target.value }))
                  }
                  placeholder="Marca do tabaco"
                  required
                />
              </label>
              <label>
                Quantidade
                <input
                  type="number"
                  min="1"
                  step="1"
                  inputMode="numeric"
                  value={tabaqueiraEntradaForm.quantidade}
                  onChange={(event) =>
                    setTabaqueiraEntradaForm((current) => ({ ...current, quantidade: event.target.value }))
                  }
                  placeholder="0"
                  required
                />
              </label>
              <label>
                Preço fornecedor
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={tabaqueiraEntradaForm.precoFornecedor}
                  onChange={(event) =>
                    setTabaqueiraEntradaForm((current) => ({ ...current, precoFornecedor: event.target.value }))
                  }
                  placeholder="0,00"
                />
              </label>
              <label>
                PVP
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={tabaqueiraEntradaForm.pvp}
                  onChange={(event) =>
                    setTabaqueiraEntradaForm((current) => ({ ...current, pvp: event.target.value }))
                  }
                  placeholder="0,00"
                />
              </label>
              <button className="primary-button" type="submit" disabled={tabaqueiraEntradaSaving}>
                <Save size={18} aria-hidden="true" />
                {tabaqueiraEntradaSaving ? "A registar" : "Registar"}
              </button>
            </form>
          </section>

          <section className="panel" id="tabaqueira-saida-panel">
            <div className="panel-heading table-heading">
              <div className="panel-heading-inline">
                <div className="heading-icon">
                  <Receipt size={20} aria-hidden="true" />
                </div>
                <div>
                  <p className="eyebrow">Saída</p>
                  <h2>{isEditingTabaqueiraSaida ? "Editar saída de tabaco" : "Registo de saída"}</h2>
                  <span className="panel-subtitle">Regista quantos maços/unidades saíram, quem levou e para que posto.</span>
                </div>
              </div>
              <button
                className="icon-text-button"
                type="button"
                onClick={() => {
                  void loadTabaqueiraData();
                }}
                disabled={tabaqueiraEntradaSaving || tabaqueiraSaidaSaving}
              >
                <RefreshCw
                  size={18}
                  className={tabaqueiraEntradaSaving || tabaqueiraSaidaSaving ? "spin" : ""}
                  aria-hidden="true"
                />
                Atualizar
              </button>
            </div>

            <form className="tabaqueira-saida-form" onSubmit={handleSaveTabaqueiraSaida}>
              {isEditingTabaqueiraSaida ? (
                <div className="edit-menu wide-field">
                  <div>
                    <strong>Menu de edição</strong>
                    <span>{tabaqueiraSaidaForm.marca}</span>
                    <small>Descreve a razão da alteração antes de guardar.</small>
                  </div>
                  <button className="icon-text-button" type="button" onClick={handleCancelEditTabaqueiraSaida}>
                    <X size={18} aria-hidden="true" />
                    Cancelar
                  </button>
                </div>
              ) : null}

              <label>
                Dia da festa
                <select
                  value={orderedDiasFesta.length ? tabaqueiraSaidaForm.data : ""}
                  onChange={(event) =>
                    setTabaqueiraSaidaForm((current) => ({ ...current, data: event.target.value }))
                  }
                  disabled={!orderedDiasFesta.length || tabaqueiraSaidaSaving}
                  required
                >
                  {orderedDiasFesta.length ? null : <option value="">Criar dia na Gestão</option>}
                  {orderedDiasFesta.map((dia) => (
                    <option key={dia.id} value={dia.data}>
                      {dia.nome} · {formatDateLabel(dia.data)} {dia.fechado ? "· fechado" : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Marca
                <select
                  value={tabaqueiraSaidaForm.marca}
                  onChange={(event) =>
                    setTabaqueiraSaidaForm((current) => ({ ...current, marca: event.target.value }))
                  }
                  disabled={tabaqueiraSaidaSaving}
                  required
                >
                  {tabaqueiraPorMarca.some((item) => item.stock > 0 || item.marca === tabaqueiraSaidaForm.marca) ? null : (
                    <option value="">Sem stock disponível</option>
                  )}
                  {tabaqueiraPorMarca
                    .filter((item) => item.stock > 0 || item.marca === tabaqueiraSaidaForm.marca)
                    .map((item) => (
                      <option key={item.marca} value={item.marca}>
                        {item.marca} · {getTabaqueiraDisponivel(item.marca, tabaqueiraSaidaForm.id)} disponíveis
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Quantidade
                <input
                  type="number"
                  min="1"
                  step="1"
                  inputMode="numeric"
                  value={tabaqueiraSaidaForm.quantidade}
                  onChange={(event) =>
                    setTabaqueiraSaidaForm((current) => ({ ...current, quantidade: event.target.value }))
                  }
                  placeholder="0"
                  required
                  disabled={tabaqueiraSaidaSaving}
                />
              </label>
              <label>
                Quem levou
                <input
                  type="text"
                  value={tabaqueiraSaidaForm.levadoPor}
                  onChange={(event) =>
                    setTabaqueiraSaidaForm((current) => ({ ...current, levadoPor: event.target.value }))
                  }
                  placeholder="Nome"
                  required
                  disabled={tabaqueiraSaidaSaving}
                />
              </label>
              <label>
                Posto
                <select
                  value={tabaqueiraSaidaForm.postoId}
                  onChange={(event) =>
                    setTabaqueiraSaidaForm((current) => ({ ...current, postoId: event.target.value }))
                  }
                  disabled={!activePostos.length || tabaqueiraSaidaSaving}
                  required
                >
                  {activePostos.length ? null : <option value="">Criar posto na Gestão</option>}
                  {activePostos.map((posto) => (
                    <option key={posto.id} value={posto.id}>
                      {posto.nome}
                    </option>
                  ))}
                </select>
              </label>
              {isEditingTabaqueiraSaida ? (
                <label className="wide-field">
                  Justificação da alteração
                  <textarea
                    value={tabaqueiraSaidaForm.justificacao}
                    onChange={(event) =>
                      setTabaqueiraSaidaForm((current) => ({ ...current, justificacao: event.target.value }))
                    }
                    placeholder="Ex.: quantidade lançada por engano"
                    required
                    disabled={tabaqueiraSaidaSaving}
                  />
                </label>
              ) : null}
              <button
                className="primary-button"
                type="submit"
                disabled={tabaqueiraSaidaSaving || !orderedDiasFesta.length || !activePostos.length || !tabaqueiraPorMarca.length}
              >
                <Save size={18} aria-hidden="true" />
                {tabaqueiraSaidaSaving
                  ? "A guardar"
                  : isEditingTabaqueiraSaida
                    ? "Guardar alteração"
                    : "Registar saída"}
              </button>
            </form>
          </section>

          <section className="panel">
            <div className="panel-heading table-heading">
              <div>
                <p className="eyebrow">Resumo</p>
                <h2>Saídas por dia</h2>
              </div>
            </div>

            {tabaqueiraSaidasPorDia.length ? (
              <div className="table-wrap">
                <table className="agent-table stock-table">
                  <thead>
                    <tr>
                      <th>Dia da festa</th>
                      <th>Quantidade saída</th>
                      <th>Marcas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tabaqueiraSaidasPorDia.map((item) => (
                      <tr key={item.dia.id}>
                        <td>
                          <strong>{item.dia.nome}</strong>
                          <span>{formatDateLabel(item.dia.data)}</span>
                        </td>
                        <td>
                          <strong>{item.quantidade}</strong>
                        </td>
                        <td>{item.marcas.join(", ") || "Sem marcas"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state compact">Ainda não existem saídas por dia da festa.</div>
            )}
          </section>

          <section className="panel">
            <div className="panel-heading table-heading">
              <div>
                <p className="eyebrow">Resumo</p>
                <h2>Stock por marca</h2>
              </div>
            </div>

            {tabaqueiraPorMarca.length ? (
              <div className="table-wrap">
                <table className="agent-table stock-table">
                  <thead>
                    <tr>
                      <th>Marca</th>
                      <th>Recebido</th>
                      <th>Saído</th>
                      <th>Stock</th>
                      <th>Preço fornecedor</th>
                      <th>PVP</th>
                      <th>Valor fornecedor</th>
                      <th>Valor PVP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tabaqueiraPorMarca.map((item) => (
                      <tr key={item.marca}>
                        <td>{item.marca}</td>
                        <td>{item.recebido}</td>
                        <td>{item.saido}</td>
                        <td>
                          <strong>{item.stock}</strong>
                        </td>
                        <td>{formatCurrency(item.precoFornecedor)}</td>
                        <td>{formatCurrency(item.pvp)}</td>
                        <td>{formatCurrency(item.valorFornecedorStock)}</td>
                        <td>
                          <strong>{formatCurrency(item.valorPvpStock)}</strong>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state compact">Ainda não existe stock de tabaco registado.</div>
            )}
          </section>

          <section className="panel">
            <div className="panel-heading table-heading">
              <div>
                <p className="eyebrow">Histórico</p>
                <h2>Receções</h2>
              </div>
            </div>

            {tabaqueiraEntradas.length ? (
              <div className="table-wrap">
                <table className="agent-table stock-table">
                  <thead>
                    <tr>
                      <th>Dia e hora</th>
                      <th>Marca</th>
                      <th>Quantidade</th>
                      <th>Preço fornecedor</th>
                      <th>PVP</th>
                      <th>Valor fornecedor</th>
                      <th>Valor PVP</th>
                      <th>Registado por</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tabaqueiraEntradas.map((entrada) => {
                      const quantidade = Number(entrada.quantidade);
                      const precoFornecedor = Number(entrada.preco_fornecedor);
                      const pvp = Number(entrada.pvp);

                      return (
                        <tr key={entrada.id}>
                          <td>{formatDateTimeLabel(entrada.created_at)}</td>
                          <td>{entrada.marca}</td>
                          <td>
                            <strong>{quantidade}</strong>
                          </td>
                          <td>{formatCurrency(precoFornecedor)}</td>
                          <td>{formatCurrency(pvp)}</td>
                          <td>{formatCurrency(quantidade * precoFornecedor)}</td>
                          <td>{formatCurrency(quantidade * pvp)}</td>
                          <td>{entrada.criado_por_nome}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state compact">Ainda não existem receções da Tabaqueira.</div>
            )}
          </section>

          <section className="panel">
            <div className="panel-heading table-heading">
              <div>
                <p className="eyebrow">Histórico</p>
                <h2>Saídas</h2>
              </div>
            </div>

            {tabaqueiraSaidas.length ? (
              <div className="table-wrap">
                <table className="agent-table stock-table">
                  <thead>
                    <tr>
                      <th>Dia da festa</th>
                      <th>Registado em</th>
                      <th>Marca</th>
                      <th>Quantidade</th>
                      <th>Quem levou</th>
                      <th>Posto</th>
                      <th>Registado por</th>
                      <th>Última alteração</th>
                      <th>Justificação</th>
                      <th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tabaqueiraSaidas.map((saida) => (
                      <tr key={saida.id}>
                        <td>{saida.data ? formatDateLabel(saida.data) : "Sem dia"}</td>
                        <td>{formatDateTimeLabel(saida.created_at)}</td>
                        <td>{saida.marca}</td>
                        <td>
                          <strong>{saida.quantidade}</strong>
                        </td>
                        <td>{saida.levado_por}</td>
                        <td>{saida.posto_nome}</td>
                        <td>{saida.criado_por_nome}</td>
                        <td>{saida.atualizado_por_nome ? `${saida.atualizado_por_nome} · ${formatDateTimeLabel(saida.updated_at)}` : "Sem alterações"}</td>
                        <td>{saida.justificacao_edicao || "Sem justificação"}</td>
                        <td>
                          <div className="row-actions">
                            <button
                              className="icon-button"
                              type="button"
                              aria-label="Editar saída"
                              onClick={() => handleEditTabaqueiraSaida(saida)}
                            >
                              <Pencil size={16} aria-hidden="true" />
                            </button>
                            <button
                              className="icon-button danger"
                              type="button"
                              aria-label="Apagar saída"
                              onClick={() => void handleDeleteTabaqueiraSaida(saida.id)}
                            >
                              <Trash2 size={16} aria-hidden="true" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state compact">Ainda não existem saídas da Tabaqueira.</div>
            )}
          </section>
        </>
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

      {!isOverviewMode && !isReportsMode && !isAgentMode && !isStocksMode ? (
        <div className={`workspace-grid ${isManagementMode ? "management-workspace" : "home-workspace"}`}>
          {isRegisterMode ? (
            <section className="panel entry-panel" id="entry-panel">
              <div className="side-tabs entry-tabs" role="tablist" aria-label="Tipo de registo">
                <button
                  className={`tab-button ${entryTab === "faturacao" ? "active" : ""}`}
                  type="button"
                  onClick={() => {
                    setEntryTab("faturacao");
                    if (isEditingDespesa) {
                      handleCancelEditDespesa();
                    }
                  }}
                >
                  <Euro size={18} aria-hidden="true" />
                  Faturação
                </button>
                <button
                  className={`tab-button ${entryTab === "despesas" ? "active" : ""}`}
                  type="button"
                  onClick={() => {
                    setEntryTab("despesas");
                    if (isEditingRegisto) {
                      handleCancelEditRegisto();
                    }
                  }}
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
                  <h2>
                    {entryTab === "faturacao" && isEditingRegisto
                      ? "Editar faturação"
                      : entryTab === "faturacao"
                        ? "Faturação"
                        : "Despesas"}
                  </h2>
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

                  {isEditingRegisto ? (
                    <div className="edit-menu wide-field">
                      <div>
                        <strong>Menu de edição</strong>
                        <span>
                          {editingRegisto?.postos?.nome ?? selectedPosto?.nome ?? "Posto"} ·{" "}
                          {formatDateLabel(editingRegisto?.data ?? selectedDia?.data ?? selectedDate)}
                        </span>
                        {editingRegisto?.observacoes ? <small>Anterior: {editingRegisto.observacoes}</small> : null}
                      </div>
                      <button className="icon-text-button" type="button" onClick={handleCancelEditRegisto}>
                        <X size={18} aria-hidden="true" />
                        Cancelar
                      </button>
                    </div>
                  ) : null}

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
                {isEditingRegisto ? "Descrição da alteração" : "Observações"}
                <textarea
                  value={form.observacoes}
                  onChange={(event) => setForm((current) => ({ ...current, observacoes: event.target.value }))}
                  placeholder={isEditingRegisto ? "Ex.: Corrigido o valor do dinheiro de 100,00 para 120,00" : ""}
                  required={isEditingRegisto}
                  rows={3}
                />
              </label>

              <div className="form-actions wide-field">
                <button
                  className="primary-button"
                  type="submit"
                  disabled={saving || !activePostos.length || !canEditSelectedDay}
                >
                  <Save size={18} aria-hidden="true" />
                  {isSelectedDayClosed
                    ? "Dia fechado"
                    : saving
                      ? "A guardar"
                      : isEditingRegisto
                        ? "Guardar alterações"
                        : "Guardar registo"}
                </button>
                {isEditingRegisto ? (
                  <button className="icon-text-button" type="button" onClick={handleCancelEditRegisto}>
                    <X size={18} aria-hidden="true" />
                    Cancelar
                  </button>
                ) : null}
              </div>
            </form>
          ) : (
            <form className="form-grid" onSubmit={handleSaveDespesa}>
              <label>
                Dia
                <input value={selectedDayLabel} readOnly disabled />
              </label>

              {isEditingDespesa ? (
                <div className="edit-menu wide-field">
                  <div>
                    <strong>Menu de edição</strong>
                    <span>
                      {editingDespesa?.postos?.nome ?? selectedPosto?.nome ?? "Posto"} ·{" "}
                      {editingDespesa?.numero_despesa ?? nextDespesaNumber}
                    </span>
                    {editingDespesa?.observacoes ? <small>Anterior: {editingDespesa.observacoes}</small> : null}
                  </div>
                  <button className="icon-text-button" type="button" onClick={handleCancelEditDespesa}>
                    <X size={18} aria-hidden="true" />
                    Cancelar
                  </button>
                </div>
              ) : null}

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
                <input value={nextDespesaNumber} readOnly disabled />
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

              <label>
                FAT c/ NIF
                <select
                  value={despesaForm.fatComNif ? "sim" : "nao"}
                  onChange={(event) =>
                    setDespesaForm((current) => ({ ...current, fatComNif: event.target.value === "sim" }))
                  }
                >
                  <option value="nao">Não</option>
                  <option value="sim">Sim</option>
                </select>
              </label>

              <label>
                Tipo de pagamento
                <select
                  value={despesaForm.tipoPagamento}
                  onChange={(event) =>
                    setDespesaForm((current) => ({
                      ...current,
                      tipoPagamento: normalizeTipoPagamento(event.target.value)
                    }))
                  }
                >
                  <option value="dinheiro">Dinheiro</option>
                  <option value="transferencia">Transferência</option>
                </select>
              </label>

              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={despesaForm.faturaPaga}
                  onChange={(event) =>
                    setDespesaForm((current) => ({
                      ...current,
                      faturaPaga: event.target.checked
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
                  required={despesaForm.faturaPaga}
                />
              </label>

              <label className="wide-field">
                Imagem da fatura
                <input type="file" accept="image/*" onChange={(event) => void handleDespesaImageChange(event)} />
              </label>

              {despesaForm.faturaImagem ? (
                <div className="invoice-preview wide-field">
                  <a href={despesaForm.faturaImagem} target="_blank" rel="noreferrer">
                    <img src={despesaForm.faturaImagem} alt="Imagem da fatura" />
                    <span>Ver imagem anexada</span>
                  </a>
                  <button
                    className="icon-text-button"
                    type="button"
                    onClick={() => setDespesaForm((current) => ({ ...current, faturaImagem: "" }))}
                  >
                    <X size={18} aria-hidden="true" />
                    Remover imagem
                  </button>
                </div>
              ) : null}

              <label className="wide-field">
                {isEditingDespesa ? "Descrição da alteração" : "Observações"}
                <textarea
                  value={despesaForm.observacoes}
                  onChange={(event) =>
                    setDespesaForm((current) => ({ ...current, observacoes: event.target.value }))
                  }
                  placeholder={isEditingDespesa ? "Ex.: Corrigido o valor da despesa ou o número da fatura" : ""}
                  required={isEditingDespesa}
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
                      : isEditingDespesa
                        ? "Guardar alterações"
                        : "Criar despesa"}
                </button>
                {isEditingDespesa ? (
                  <button className="icon-text-button" type="button" onClick={handleCancelEditDespesa}>
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
                  className={`tab-button ${sideTab === "agente" ? "active" : ""}`}
                  type="button"
                  onClick={() => setSideTab("agente")}
                >
                  <HandCoins size={18} aria-hidden="true" />
                  Pag.Agente
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
          ) : sideTab === "agente" ? (
            <>
              <div className="panel-heading">
                <div className="heading-icon">
                  <HandCoins size={20} aria-hidden="true" />
                </div>
                <div>
                  <p className="eyebrow">Pag.Agente</p>
                  <h2>Valores base</h2>
                  <span className="panel-subtitle">
                    Define o valor necessário ao agente e os valores de apoio da festa.
                  </span>
                </div>
              </div>

              <form className="agente-form" onSubmit={handleSaveAgenteConfig}>
                <label>
                  Valor necessário ao agente
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    value={agenteConfigForm.valorNecessarioAgente}
                    onChange={(event) =>
                      setAgenteConfigForm((current) => ({ ...current, valorNecessarioAgente: event.target.value }))
                    }
                  />
                </label>
                <label>
                  Valor Eventos Anual
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    value={agenteConfigForm.valorEventosAnual}
                    onChange={(event) =>
                      setAgenteConfigForm((current) => ({ ...current, valorEventosAnual: event.target.value }))
                    }
                  />
                </label>
                <label>
                  Valor Patrocínios
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    value={agenteConfigForm.valorPatrocinios}
                    onChange={(event) =>
                      setAgenteConfigForm((current) => ({ ...current, valorPatrocinios: event.target.value }))
                    }
                  />
                </label>
                <label>
                  Valor Peditório
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    value={agenteConfigForm.valorPeditorio}
                    onChange={(event) =>
                      setAgenteConfigForm((current) => ({ ...current, valorPeditorio: event.target.value }))
                    }
                  />
                </label>
                <div className="user-form-actions">
                  <button className="secondary-button" type="submit" disabled={agenteConfigSaving}>
                    <Save size={18} aria-hidden="true" />
                    {agenteConfigSaving ? "A guardar" : "Guardar valores"}
                  </button>
                </div>
              </form>

              <div className="summary-grid management-summary">
                <article className="metric">
                  <span>Valor necessário</span>
                  <strong>{formatCurrency(agenteValorNecessario)}</strong>
                </article>
                <article className="metric">
                  <span>Eventos anual</span>
                  <strong>{formatCurrency(Number(agenteConfig.valor_eventos_anual))}</strong>
                </article>
                <article className="metric">
                  <span>Patrocínios</span>
                  <strong>{formatCurrency(Number(agenteConfig.valor_patrocinios))}</strong>
                </article>
                <article className="metric">
                  <span>Peditório</span>
                  <strong>{formatCurrency(Number(agenteConfig.valor_peditorio))}</strong>
                </article>
                <article className="metric">
                  <span>Atualizado por</span>
                  <strong>{agenteConfig.atualizado_por_nome ?? "Sistema"}</strong>
                  <small>{formatDateTimeLabel(agenteConfig.updated_at)}</small>
                </article>
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
                  <th>FAT c/ NIF</th>
                  <th>Pagamento</th>
                  <th>Fatura</th>
                  <th>Imagem</th>
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
                    <td>{despesa.fat_com_nif ? "Sim" : "Não"}</td>
                    <td>{formatTipoPagamento(despesa.tipo_pagamento)}</td>
                    <td className="audit-cell">
                      <strong>{despesa.fatura_paga ? "Paga" : "Por pagar"}</strong>
                      <span>{despesa.numero_fatura ?? ""}</span>
                    </td>
                    <td>
                      {despesa.fatura_imagem ? (
                        <a className="invoice-link" href={despesa.fatura_imagem} target="_blank" rel="noreferrer">
                          <img
                            className="invoice-thumb"
                            src={despesa.fatura_imagem}
                            alt={`Fatura ${despesa.numero_fatura ?? despesa.numero_despesa}`}
                          />
                          <span>Ver</span>
                        </a>
                      ) : null}
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

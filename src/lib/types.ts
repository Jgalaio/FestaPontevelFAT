export type Posto = {
  id: string;
  nome: string;
  responsavel: string | null;
  ativo: boolean;
  created_at: string;
};

export type Utilizador = {
  id: string;
  username: string;
  nome: string;
  ativo: boolean;
  role: "admin" | "operador";
  created_at: string;
  updated_at: string;
};

export type TipoDespesa = {
  id: string;
  nome: string;
  ativo: boolean;
  criado_por_id: string | null;
  criado_por_nome: string | null;
  atualizado_por_id: string | null;
  atualizado_por_nome: string | null;
  created_at: string;
  updated_at: string;
};

export type DiaFesta = {
  id: string;
  data: string;
  nome: string;
  fechado: boolean;
  fechado_por_id: string | null;
  fechado_por_nome: string | null;
  fechado_at: string | null;
  criado_por_id: string | null;
  criado_por_nome: string | null;
  atualizado_por_id: string | null;
  atualizado_por_nome: string | null;
  created_at: string;
  updated_at: string;
};

export type RegistoRow = {
  id: string;
  posto_id: string;
  data: string;
  dinheiro: number;
  multibanco: number;
  mbway: number;
  observacoes: string | null;
  criado_por_id: string | null;
  criado_por_nome: string | null;
  atualizado_por_id: string | null;
  atualizado_por_nome: string | null;
  created_at: string;
  updated_at: string;
};

export type Registo = RegistoRow & {
  postos?: Pick<Posto, "id" | "nome" | "responsavel"> | null;
};

export type DespesaRow = {
  id: string;
  posto_id: string;
  data: string;
  tipo_despesa: string;
  numero_despesa: string;
  valor: number;
  fat_com_nif: boolean;
  tipo_pagamento: "dinheiro" | "transferencia";
  fatura_paga: boolean;
  numero_fatura: string | null;
  fatura_imagem: string | null;
  observacoes: string | null;
  criado_por_id: string | null;
  criado_por_nome: string | null;
  atualizado_por_id: string | null;
  atualizado_por_nome: string | null;
  created_at: string;
  updated_at: string;
};

export type Despesa = DespesaRow & {
  postos?: Pick<Posto, "id" | "nome" | "responsavel"> | null;
};

export type AgenteConfig = {
  id: boolean;
  valor_eventos_anual: number;
  valor_patrocinios: number;
  valor_peditorio: number;
  valor_necessario_agente: number;
  atualizado_por_id: string | null;
  atualizado_por_nome: string | null;
  created_at: string;
  updated_at: string;
};

export type PagamentoAgente = {
  id: string;
  valor: number;
  entregue_por_id: string | null;
  entregue_por_nome: string;
  created_at: string;
};

export type NovadisTipo = "imperial" | "cidra" | "sangria" | "co2";

export type NovadisConfig = {
  id: boolean;
  imperial_valor_unitario: number;
  imperial_valor_tara: number;
  cidra_valor_unitario: number;
  cidra_valor_tara: number;
  sangria_valor_unitario: number;
  sangria_valor_tara: number;
  co2_valor_unitario: number;
  co2_valor_tara: number;
  atualizado_por_id: string | null;
  atualizado_por_nome: string | null;
  created_at: string;
  updated_at: string;
};

export type AppConfig = {
  id: boolean;
  favicon_data_url: string | null;
  atualizado_por_id: string | null;
  atualizado_por_nome: string | null;
  created_at: string;
  updated_at: string;
};

export type NovadisBarril = {
  id: string;
  tipo: NovadisTipo;
  quantidade: number;
  criado_por_id: string | null;
  criado_por_nome: string;
  created_at: string;
};

export type NovadisConsumo = {
  id: string;
  data: string;
  tipo: NovadisTipo;
  quantidade: number;
  criado_por_id: string | null;
  criado_por_nome: string;
  created_at: string;
};

export type TabaqueiraEntrada = {
  id: string;
  marca: string;
  quantidade: number;
  preco_fornecedor: number;
  pvp: number;
  criado_por_id: string | null;
  criado_por_nome: string;
  atualizado_por_id: string | null;
  atualizado_por_nome: string | null;
  created_at: string;
  updated_at: string;
};

export type TabaqueiraSaida = {
  id: string;
  data: string | null;
  marca: string;
  quantidade: number;
  levado_por: string;
  posto_id: string | null;
  posto_nome: string;
  justificacao_edicao: string | null;
  criado_por_id: string | null;
  criado_por_nome: string;
  atualizado_por_id: string | null;
  atualizado_por_nome: string | null;
  created_at: string;
  updated_at: string;
};

export type InventarioTipoProduto = {
  id: string;
  nome: string;
  ativo: boolean;
  criado_por_id: string | null;
  criado_por_nome: string | null;
  atualizado_por_id: string | null;
  atualizado_por_nome: string | null;
  created_at: string;
  updated_at: string;
};

export type InventarioProduto = {
  id: string;
  produto: string;
  tipo_id: string | null;
  tipo_nome: string;
  quantidade_recebida: number;
  quantidade_retirada: number;
  responsavel: string;
  criado_por_id: string | null;
  criado_por_nome: string;
  atualizado_por_id: string | null;
  atualizado_por_nome: string | null;
  created_at: string;
  updated_at: string;
};

export type Anotacao = {
  id: string;
  titulo: string;
  texto: string;
  criado_por_id: string | null;
  criado_por_nome: string;
  atualizado_por_id: string | null;
  atualizado_por_nome: string | null;
  created_at: string;
  updated_at: string;
};

export type AuditoriaRegisto = {
  id: string;
  registo_id: string | null;
  acao: "criado" | "editado" | "apagado";
  utilizador_id: string | null;
  utilizador_nome: string;
  utilizador_username: string | null;
  dados_anteriores: Record<string, unknown> | null;
  dados_novos: Record<string, unknown> | null;
  created_at: string;
};

export type AuditoriaDespesa = {
  id: string;
  despesa_id: string | null;
  acao: "criado" | "editado" | "apagado";
  utilizador_id: string | null;
  utilizador_nome: string;
  utilizador_username: string | null;
  dados_anteriores: Record<string, unknown> | null;
  dados_novos: Record<string, unknown> | null;
  created_at: string;
};

export type RegistoForm = {
  postoId: string;
  data: string;
  dinheiro: string;
  multibanco: string;
  mbway: string;
  observacoes: string;
};

export type DespesaForm = {
  id: string | null;
  postoId: string;
  data: string;
  tipoDespesa: string;
  numeroDespesa: string;
  valor: string;
  fatComNif: boolean;
  tipoPagamento: "dinheiro" | "transferencia";
  faturaPaga: boolean;
  numeroFatura: string;
  faturaImagem: string;
  observacoes: string;
};

export type AppSession = {
  token: string;
  utilizador_id: string;
  username: string;
  nome: string;
  role: "admin" | "operador";
  expires_at: string;
};

export type RegistoRpc = RegistoRow & {
  posto_nome: string | null;
  posto_responsavel: string | null;
};

export type DespesaRpc = DespesaRow & {
  posto_nome: string | null;
  posto_responsavel: string | null;
};

export type Database = {
  public: {
    Tables: {
      utilizadores: {
        Row: Utilizador & {
          password_hash: string | null;
        };
        Insert: {
          id?: string;
          username: string;
          nome: string;
          password_hash?: string | null;
          ativo?: boolean;
          role?: "admin" | "operador";
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Utilizador & { password_hash: string | null }>;
        Relationships: [];
      };
      utilizador_sessoes: {
        Row: {
          id: string;
          utilizador_id: string;
          token_hash: string;
          created_at: string;
          expires_at: string;
        };
        Insert: {
          id?: string;
          utilizador_id: string;
          token_hash: string;
          created_at?: string;
          expires_at: string;
        };
        Update: Partial<{
          id: string;
          utilizador_id: string;
          token_hash: string;
          created_at: string;
          expires_at: string;
        }>;
        Relationships: [];
      };
      postos: {
        Row: Posto;
        Insert: {
          id?: string;
          nome: string;
          responsavel?: string | null;
          ativo?: boolean;
          created_at?: string;
        };
        Update: Partial<Posto>;
        Relationships: [];
      };
      tipos_despesa: {
        Row: TipoDespesa;
        Insert: {
          id?: string;
          nome: string;
          ativo?: boolean;
          criado_por_id?: string | null;
          criado_por_nome?: string | null;
          atualizado_por_id?: string | null;
          atualizado_por_nome?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<TipoDespesa>;
        Relationships: [];
      };
      dias_festa: {
        Row: DiaFesta;
        Insert: {
          id?: string;
          data: string;
          nome: string;
          fechado?: boolean;
          fechado_por_id?: string | null;
          fechado_por_nome?: string | null;
          fechado_at?: string | null;
          criado_por_id?: string | null;
          criado_por_nome?: string | null;
          atualizado_por_id?: string | null;
          atualizado_por_nome?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<DiaFesta>;
        Relationships: [];
      };
      registos_faturacao: {
        Row: RegistoRow;
        Insert: {
          id?: string;
          posto_id: string;
          data: string;
          dinheiro?: number;
          multibanco?: number;
          mbway?: number;
          observacoes?: string | null;
          criado_por_id?: string | null;
          criado_por_nome?: string | null;
          atualizado_por_id?: string | null;
          atualizado_por_nome?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<RegistoRow>;
        Relationships: [
          {
            foreignKeyName: "registos_faturacao_posto_id_fkey";
            columns: ["posto_id"];
            referencedRelation: "postos";
            referencedColumns: ["id"];
          }
        ];
      };
      despesas_posto: {
        Row: DespesaRow;
        Insert: {
          id?: string;
          posto_id: string;
          data: string;
          tipo_despesa: string;
          numero_despesa: string;
          valor?: number;
          fat_com_nif?: boolean;
          tipo_pagamento?: "dinheiro" | "transferencia";
          fatura_paga?: boolean;
          numero_fatura?: string | null;
          fatura_imagem?: string | null;
          observacoes?: string | null;
          criado_por_id?: string | null;
          criado_por_nome?: string | null;
          atualizado_por_id?: string | null;
          atualizado_por_nome?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<DespesaRow>;
        Relationships: [
          {
            foreignKeyName: "despesas_posto_posto_id_fkey";
            columns: ["posto_id"];
            referencedRelation: "postos";
            referencedColumns: ["id"];
          }
        ];
      };
      agente_config: {
        Row: AgenteConfig;
        Insert: {
          id?: boolean;
          valor_eventos_anual?: number;
          valor_patrocinios?: number;
          valor_peditorio?: number;
          valor_necessario_agente?: number;
          atualizado_por_id?: string | null;
          atualizado_por_nome?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<AgenteConfig>;
        Relationships: [];
      };
      pagamentos_agente: {
        Row: PagamentoAgente;
        Insert: {
          id?: string;
          valor: number;
          entregue_por_id?: string | null;
          entregue_por_nome: string;
          created_at?: string;
        };
        Update: Partial<PagamentoAgente>;
        Relationships: [];
      };
      novadis_config: {
        Row: NovadisConfig;
        Insert: {
          id?: boolean;
          imperial_valor_unitario?: number;
          imperial_valor_tara?: number;
          cidra_valor_unitario?: number;
          cidra_valor_tara?: number;
          sangria_valor_unitario?: number;
          sangria_valor_tara?: number;
          co2_valor_unitario?: number;
          co2_valor_tara?: number;
          atualizado_por_id?: string | null;
          atualizado_por_nome?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<NovadisConfig>;
        Relationships: [];
      };
      app_config: {
        Row: AppConfig;
        Insert: {
          id?: boolean;
          favicon_data_url?: string | null;
          atualizado_por_id?: string | null;
          atualizado_por_nome?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<AppConfig>;
        Relationships: [];
      };
      novadis_barris: {
        Row: NovadisBarril;
        Insert: {
          id?: string;
          tipo?: NovadisTipo;
          quantidade: number;
          criado_por_id?: string | null;
          criado_por_nome: string;
          created_at?: string;
        };
        Update: Partial<NovadisBarril>;
        Relationships: [];
      };
      novadis_consumos: {
        Row: NovadisConsumo;
        Insert: {
          id?: string;
          data: string;
          tipo?: NovadisTipo;
          quantidade: number;
          criado_por_id?: string | null;
          criado_por_nome: string;
          created_at?: string;
        };
        Update: Partial<NovadisConsumo>;
        Relationships: [];
      };
      tabaqueira_entradas: {
        Row: TabaqueiraEntrada;
        Insert: {
          id?: string;
          marca: string;
          quantidade: number;
          preco_fornecedor?: number;
          pvp?: number;
          criado_por_id?: string | null;
          criado_por_nome: string;
          atualizado_por_id?: string | null;
          atualizado_por_nome?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<TabaqueiraEntrada>;
        Relationships: [];
      };
      tabaqueira_saidas: {
        Row: TabaqueiraSaida;
        Insert: {
          id?: string;
          data: string;
          marca: string;
          quantidade: number;
          levado_por: string;
          posto_id?: string | null;
          posto_nome: string;
          justificacao_edicao?: string | null;
          criado_por_id?: string | null;
          criado_por_nome: string;
          atualizado_por_id?: string | null;
          atualizado_por_nome?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<TabaqueiraSaida>;
        Relationships: [
          {
            foreignKeyName: "tabaqueira_saidas_posto_id_fkey";
            columns: ["posto_id"];
            referencedRelation: "postos";
            referencedColumns: ["id"];
          }
        ];
      };
      inventario_tipos_produto: {
        Row: InventarioTipoProduto;
        Insert: {
          id?: string;
          nome: string;
          ativo?: boolean;
          criado_por_id?: string | null;
          criado_por_nome?: string | null;
          atualizado_por_id?: string | null;
          atualizado_por_nome?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<InventarioTipoProduto>;
        Relationships: [];
      };
      inventario_produtos: {
        Row: InventarioProduto;
        Insert: {
          id?: string;
          produto: string;
          tipo_id?: string | null;
          tipo_nome?: string;
          quantidade_recebida?: number;
          quantidade_retirada?: number;
          responsavel: string;
          criado_por_id?: string | null;
          criado_por_nome: string;
          atualizado_por_id?: string | null;
          atualizado_por_nome?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<InventarioProduto>;
        Relationships: [
          {
            foreignKeyName: "inventario_produtos_tipo_id_fkey";
            columns: ["tipo_id"];
            referencedRelation: "inventario_tipos_produto";
            referencedColumns: ["id"];
          }
        ];
      };
      anotacoes: {
        Row: Anotacao;
        Insert: {
          id?: string;
          titulo: string;
          texto: string;
          criado_por_id?: string | null;
          criado_por_nome: string;
          atualizado_por_id?: string | null;
          atualizado_por_nome?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Anotacao>;
        Relationships: [];
      };
      registos_faturacao_auditoria: {
        Row: AuditoriaRegisto;
        Insert: {
          id?: string;
          registo_id?: string | null;
          acao: "criado" | "editado" | "apagado";
          utilizador_id?: string | null;
          utilizador_nome: string;
          utilizador_username?: string | null;
          dados_anteriores?: Record<string, unknown> | null;
          dados_novos?: Record<string, unknown> | null;
          created_at?: string;
        };
        Update: Partial<AuditoriaRegisto>;
        Relationships: [];
      };
      despesas_posto_auditoria: {
        Row: AuditoriaDespesa;
        Insert: {
          id?: string;
          despesa_id?: string | null;
          acao: "criado" | "editado" | "apagado";
          utilizador_id?: string | null;
          utilizador_nome: string;
          utilizador_username?: string | null;
          dados_anteriores?: Record<string, unknown> | null;
          dados_novos?: Record<string, unknown> | null;
          created_at?: string;
        };
        Update: Partial<AuditoriaDespesa>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      app_apagar_despesa: {
        Args: { p_token: string; p_id: string };
        Returns: null;
      };
      app_apagar_dia: {
        Args: { p_token: string; p_id: string; p_password: string };
        Returns: null;
      };
      app_apagar_posto: {
        Args: { p_token: string; p_id: string };
        Returns: null;
      };
      app_apagar_registo: {
        Args: { p_token: string; p_id: string };
        Returns: null;
      };
      app_obter_config_publica: {
        Args: Record<string, never>;
        Returns: AppConfig[];
      };
      app_criar_posto: {
        Args: { p_token: string; p_nome: string; p_responsavel?: string | null };
        Returns: Posto[];
      };
      app_guardar_despesa: {
        Args: {
          p_token: string;
          p_id?: string | null;
          p_posto_id: string;
          p_data: string;
          p_tipo_despesa: string;
          p_numero_despesa: string;
          p_valor: number;
          p_fat_com_nif?: boolean;
          p_tipo_pagamento?: "dinheiro" | "transferencia";
          p_fatura_paga?: boolean;
          p_numero_fatura?: string | null;
          p_fatura_imagem?: string | null;
          p_observacoes?: string | null;
        };
        Returns: string;
      };
      app_guardar_dia: {
        Args: {
          p_token: string;
          p_data: string;
          p_nome?: string | null;
        };
        Returns: DiaFesta[];
      };
      app_guardar_posto: {
        Args: {
          p_token: string;
          p_id?: string | null;
          p_nome: string;
          p_responsavel?: string | null;
          p_ativo?: boolean;
        };
        Returns: Posto[];
      };
      app_guardar_tipo_despesa: {
        Args: {
          p_token: string;
          p_id?: string | null;
          p_nome: string;
          p_ativo?: boolean;
        };
        Returns: TipoDespesa[];
      };
      app_guardar_registo: {
        Args: {
          p_token: string;
          p_posto_id: string;
          p_data: string;
          p_dinheiro: number;
          p_multibanco: number;
          p_mbway: number;
          p_observacoes?: string | null;
        };
        Returns: string;
      };
      app_guardar_favicon: {
        Args: {
          p_token: string;
          p_favicon_data_url?: string | null;
        };
        Returns: AppConfig[];
      };
      app_guardar_utilizador: {
        Args: {
          p_token: string;
          p_id?: string | null;
          p_username: string;
          p_nome: string;
          p_password?: string | null;
          p_ativo?: boolean;
          p_role?: "admin" | "operador";
        };
        Returns: Utilizador[];
      };
      app_listar_postos: {
        Args: { p_token: string };
        Returns: Posto[];
      };
      app_listar_despesas: {
        Args: { p_token: string; p_data: string };
        Returns: DespesaRpc[];
      };
      app_listar_pagamentos_agente: {
        Args: { p_token: string };
        Returns: PagamentoAgente[];
      };
      app_fechar_dia: {
        Args: { p_token: string; p_id: string };
        Returns: DiaFesta[];
      };
      app_listar_dias: {
        Args: { p_token: string };
        Returns: DiaFesta[];
      };
      app_listar_tipos_despesa: {
        Args: { p_token: string };
        Returns: TipoDespesa[];
      };
      app_listar_registos: {
        Args: { p_token: string; p_data: string };
        Returns: RegistoRpc[];
      };
      app_listar_utilizadores: {
        Args: { p_token: string };
        Returns: Utilizador[];
      };
      app_obter_agente_config: {
        Args: { p_token: string };
        Returns: AgenteConfig[];
      };
      app_guardar_agente_config: {
        Args: {
          p_token: string;
          p_valor_eventos_anual?: number;
          p_valor_patrocinios?: number;
          p_valor_peditorio?: number;
          p_valor_necessario_agente?: number;
        };
        Returns: AgenteConfig[];
      };
      app_registar_pagamento_agente: {
        Args: { p_token: string; p_valor: number };
        Returns: PagamentoAgente[];
      };
      app_obter_novadis_config: {
        Args: { p_token: string };
        Returns: NovadisConfig[];
      };
      app_guardar_novadis_config: {
        Args: {
          p_token: string;
          p_imperial_valor_unitario?: number;
          p_imperial_valor_tara?: number;
          p_cidra_valor_unitario?: number;
          p_cidra_valor_tara?: number;
          p_sangria_valor_unitario?: number;
          p_sangria_valor_tara?: number;
          p_co2_valor_unitario?: number;
          p_co2_valor_tara?: number;
        };
        Returns: NovadisConfig[];
      };
      app_listar_novadis_barris: {
        Args: { p_token: string };
        Returns: NovadisBarril[];
      };
      app_registar_novadis_barris: {
        Args: { p_token: string; p_tipo: NovadisTipo; p_quantidade: number };
        Returns: NovadisBarril[];
      };
      app_listar_novadis_consumos: {
        Args: { p_token: string };
        Returns: NovadisConsumo[];
      };
      app_registar_novadis_consumo: {
        Args: { p_token: string; p_data: string; p_tipo: NovadisTipo; p_quantidade: number };
        Returns: NovadisConsumo[];
      };
      app_definir_novadis_consumo_total: {
        Args: { p_token: string; p_data: string; p_tipo: NovadisTipo; p_quantidade: number };
        Returns: NovadisConsumo[];
      };
      app_listar_tabaqueira_entradas: {
        Args: { p_token: string };
        Returns: TabaqueiraEntrada[];
      };
      app_registar_tabaqueira_entrada: {
        Args: {
          p_token: string;
          p_id?: string | null;
          p_marca: string;
          p_quantidade: number;
          p_preco_fornecedor?: number;
          p_pvp?: number;
        };
        Returns: TabaqueiraEntrada[];
      };
      app_apagar_tabaqueira_entrada: {
        Args: { p_token: string; p_id: string };
        Returns: null;
      };
      app_listar_tabaqueira_saidas: {
        Args: { p_token: string };
        Returns: TabaqueiraSaida[];
      };
      app_guardar_tabaqueira_saida: {
        Args: {
          p_token: string;
          p_id?: string | null;
          p_data: string;
          p_marca: string;
          p_quantidade: number;
          p_levado_por: string;
          p_posto_id?: string | null;
          p_justificacao_edicao?: string | null;
        };
        Returns: TabaqueiraSaida[];
      };
      app_apagar_tabaqueira_saida: {
        Args: { p_token: string; p_id: string };
        Returns: null;
      };
      app_listar_inventario_tipos: {
        Args: { p_token: string };
        Returns: InventarioTipoProduto[];
      };
      app_guardar_inventario_tipo: {
        Args: {
          p_token: string;
          p_id?: string | null;
          p_nome: string;
          p_ativo?: boolean;
        };
        Returns: InventarioTipoProduto[];
      };
      app_apagar_inventario_tipo: {
        Args: { p_token: string; p_id: string };
        Returns: null;
      };
      app_listar_inventario_produtos: {
        Args: { p_token: string };
        Returns: InventarioProduto[];
      };
      app_guardar_inventario_produto: {
        Args: {
          p_token: string;
          p_id?: string | null;
          p_produto: string;
          p_tipo_id?: string | null;
          p_quantidade_recebida?: number;
          p_quantidade_retirada?: number;
          p_responsavel: string;
        };
        Returns: InventarioProduto[];
      };
      app_registar_inventario_retirada: {
        Args: {
          p_token: string;
          p_produto_id: string;
          p_quantidade: number;
          p_responsavel: string;
        };
        Returns: InventarioProduto[];
      };
      app_apagar_inventario_produto: {
        Args: { p_token: string; p_id: string };
        Returns: null;
      };
      app_listar_anotacoes: {
        Args: { p_token: string };
        Returns: Anotacao[];
      };
      app_guardar_anotacao: {
        Args: {
          p_token: string;
          p_id?: string | null;
          p_titulo: string;
          p_texto: string;
        };
        Returns: Anotacao[];
      };
      app_apagar_anotacao: {
        Args: { p_token: string; p_id: string };
        Returns: null;
      };
      app_login: {
        Args: { p_username: string; p_password: string };
        Returns: AppSession[];
      };
      app_logout: {
        Args: { p_token: string };
        Returns: null;
      };
      app_utilizador_por_token: {
        Args: { p_token: string };
        Returns: Omit<AppSession, "token">[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

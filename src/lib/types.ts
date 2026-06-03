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
  fatura_paga: boolean;
  numero_fatura: string | null;
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
  faturaPaga: boolean;
  numeroFatura: string;
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
          fatura_paga?: boolean;
          numero_fatura?: string | null;
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
          p_fatura_paga?: boolean;
          p_numero_fatura?: string | null;
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

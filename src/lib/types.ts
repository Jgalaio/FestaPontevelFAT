export type Posto = {
  id: string;
  nome: string;
  responsavel: string | null;
  ativo: boolean;
  created_at: string;
};

export type Utilizador = {
  id: string;
  nome: string;
  email: string;
  ativo: boolean;
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

export type AuditoriaRegisto = {
  id: string;
  registo_id: string | null;
  acao: "criado" | "editado" | "apagado";
  utilizador_id: string | null;
  utilizador_nome: string;
  utilizador_email: string | null;
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

export type Database = {
  public: {
    Tables: {
      utilizadores: {
        Row: Utilizador;
        Insert: {
          id: string;
          nome: string;
          email: string;
          ativo?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Utilizador>;
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
      registos_faturacao_auditoria: {
        Row: AuditoriaRegisto;
        Insert: {
          id?: string;
          registo_id?: string | null;
          acao: "criado" | "editado" | "apagado";
          utilizador_id?: string | null;
          utilizador_nome: string;
          utilizador_email?: string | null;
          dados_anteriores?: Record<string, unknown> | null;
          dados_novos?: Record<string, unknown> | null;
          created_at?: string;
        };
        Update: Partial<AuditoriaRegisto>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

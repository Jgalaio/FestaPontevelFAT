export type Posto = {
  id: string;
  nome: string;
  responsavel: string | null;
  ativo: boolean;
  created_at: string;
};

export type RegistoRow = {
  id: string;
  posto_id: string;
  data: string;
  dinheiro: number;
  multibanco: number;
  mbway: number;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
};

export type Registo = RegistoRow & {
  postos?: Pick<Posto, "id" | "nome" | "responsavel"> | null;
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
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

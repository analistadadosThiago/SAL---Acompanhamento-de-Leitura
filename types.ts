
export interface LeituraRecord {
  id?: number;
  Ano: number;
  Mes: string;
  rz: string;
  instalacao: string;
  nl: string | number;
  medidor: string;
  rz_ul_lv: string;
  reg: string;
  matr: string;
  l_atual: number;
  consumo: number;
  digitacao: string;
  nosb_impedimento: string;
  nosb_simulacao: string;
  cna: string;
  tipo: string;
}

export enum Menu {
  INICIO = 'INICIO',
  CONSULTA_TECNICA = 'CONSULTA_TECNICA',
  CONTROLE_LEITURISTA = 'CONTROLE_LEITURISTA'
}

export interface FilterState {
  anos: string[];
  meses: string[];
  razoes: string[];
}

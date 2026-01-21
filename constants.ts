
export const IMPEDIMENTO_CODES = [
  "3201", "3205", "3245", "3301", "3312", "3313", "3369", "3370", "3374", "3379", 
  "3901", "3902", "3903", "3904", "3905", "3906", "3907", "3908", "5101", "5102", 
  "5103", "5104", "5105", "5106", "5107", "5108", "5109", "5127", "5260", "5558", 
  "5800", "5802", "3376"
];

// Lista estrita para o menu Controle de Leiturista
export const CONTROLE_LEITURISTA_IMPEDIMENTOS = [
  "3201", "3205", "3245", "3301", "3312", "3313", "3369", "3370", "3374", "3374",
  "3511", "3601", "3700", "3801", "3830", "3865", "3868", "3871", "3878",
  "3901", "3902", "3903", "3904", "3905", "3906", "3907", "3908",
  "5101", "5102", "5103", "5104", "5105", "5106", "5107", "5108", "5109",
  "5127", "5260", "5558", "5800", "5802",
  "3376", "3804", "3867", "3894", "3895", "2000", "6824"
];

export const MONTH_ORDER: Record<string, number> = {
  "JANEIRO": 1, "FEVEREIRO": 2, "MARÇO": 3, "ABRIL": 4, "MAIO": 5, "JUNHO": 6,
  "JULHO": 7, "AGOSTO": 8, "SETEMBRO": 9, "OUTUBRO": 10, "NOVEMBRO": 11, "DEZEMBRO": 12,
  "Janeiro": 1, "Fevereiro": 2, "Março": 3, "Abril": 4, "Maio": 5, "Junho": 6,
  "Julho": 7, "Agosto": 8, "Setembro": 9, "Outubro": 10, "Novembro": 11, "Dezembro": 12
};

export const SUPABASE_URL = "https://mzguwfuncsmgihzmeqoq.supabase.co";
export const SUPABASE_ANON_KEY = "sb_publishable_7ikVHkk3N6N7uv2-cmSsTg_VMgP9IMO";
export const TABLE_NAME = "LeituraGeral";

// RPCs - NÃO ALTERAR AS EXISTENTES NOS MENUS BLOQUEADOS
export const RPC_CL_FILTROS = "rpc_cl_filtros_leiturista";
export const RPC_CL_TABELA_IMPEDIMENTOS = "rpc_controle_leiturista_impedimentos";
export const RPC_CL_GRAFICO_IMPEDIMENTOS = "rpc_controle_leiturista_grafico_impedimentos";

// RPC OFICIAL PARA AUDITORIA DE EVIDÊNCIAS (REGRA V9)
export const RPC_CE_TIPO_V9 = "rpc_indicadores_por_tipo_v9";

// RPCs de Filtros Isoladas (OFICIAIS)
export const RPC_CE_FILTRO_ANO = "rpc_filtro_ano";
export const RPC_CE_FILTRO_MES = "rpc_filtro_mes";
export const RPC_CE_FILTRO_RZ = "rpc_rz";
export const RPC_CE_FILTRO_MATRICULA = "rpc_matriculas";

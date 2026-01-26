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

// RPCs CONTROLE DE EVIDÊNCIAS (REQUISITO V9 ATUAL)
export const RPC_CE_FILTRADO = "rpc_controle_evidencias_filtrado";
export const RPC_CE_POR_RAZAO = "rpc_controle_evidencias_por_razao";
export const RPC_CE_TIPO_V9 = "rpc_controle_evidencias_filtrado";
export const RPC_CE_IMPEDIMENTOS = "rpc_controle_evidencias_impedimentos";
export const RPC_CE_SIMULACAO_NOSB = "rpc_controle_evidencias_simulacao";

// RPCs DE VALIDAÇÃO DE FILTROS (REQUISITO V9)
export const RPC_GET_ANOS = "get_anos_disponiveis";
export const RPC_GET_MESES = "get_meses_disponiveis";
export const RPC_GET_MATRICULAS = "get_matriculas_disponiveis";
export const RPC_GET_ULS = "get_ul_disponiveis";

// NOVAS RPCs SIMPLES PARA CONTROLE DE EVIDÊNCIAS
export const RPC_GET_ANOS_SIMPLES = "get_anos_simples";
export const RPC_GET_MESES_SIMPLES = "get_meses_simples";
export const RPC_GET_MESES_DISTINCT = "get_meses_validos_distinct";
export const RPC_GET_MATRICULAS_SIMPLES = "get_matriculas_simples";
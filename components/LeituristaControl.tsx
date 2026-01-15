
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../services/supabaseClient';
import { TABLE_NAME, CONTROLE_LEITURISTA_IMPEDIMENTOS, MONTH_ORDER } from '../constants';
import { 
  Users, Filter, Play, 
  FileSpreadsheet, FileText, ChevronLeft, ChevronRight,
  TrendingUp, LayoutList, Database, BarChart3, AlertCircle
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, Legend, LabelList 
} from 'recharts';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

interface AggregatedData {
  mes: string;
  ano: string;
  rz: string;
  rz_ul_lv: string;
  tipo: string;
  leituras_em_geral: number;
  impedimentos: number;
  leituras_executadas: number;
  indicador_infm: string;
  infm_numeric: number;
}

// Nomes das RPCs exclusivas para este menu (Devem garantir retorno de 100% da base)
const RPC_FILTERS_EXCLUSIVA = 'rpc_get_leiturista_filters_full';
const RPC_REPORT_EXCLUSIVA = 'rpc_controle_leiturista_report_full';

const LeituristaControl: React.FC = () => {
  // Estados de Filtros
  const [filterAno, setFilterAno] = useState<string>('');
  const [filterMes, setFilterMes] = useState<string>('');
  const [filterMatricula, setFilterMatricula] = useState<string>('');
  const [filterUlDe, setFilterUlDe] = useState<string>('');
  const [filterUlPara, setFilterUlPara] = useState<string>('');

  // Metadados para os filtros (100% da base LeituraGeral)
  const [options, setOptions] = useState<{anos: string[], meses: string[], matriculas: string[]}>({
    anos: [], meses: [], matriculas: []
  });

  // Resultados e Estados de UI
  const [results, setResults] = useState<AggregatedData[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchingOptions, setFetchingOptions] = useState(false);
  const [isGenerated, setIsGenerated] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 50;

  // Sincronização de 100% dos Filtros (REGRA CRÍTICA)
  useEffect(() => {
    const fetchFullFilters = async () => {
      setFetchingOptions(true);
      try {
        // Tentativa via RPC dedicada
        const { data, error } = await supabase.rpc(RPC_FILTERS_EXCLUSIVA);
        
        if (error || !data) {
          // Fallback Select Full (Garante 100% dos dados se a RPC não existir)
          const [anosRes, mesesRes, matrsRes] = await Promise.all([
            supabase.from(TABLE_NAME).select('Ano').order('Ano'),
            supabase.from(TABLE_NAME).select('Mes'),
            supabase.from(TABLE_NAME).select('matr')
          ]);

          const anos = Array.from(new Set((anosRes.data || []).map(i => String(i.Ano)))).sort();
          const meses = Array.from(new Set((mesesRes.data || []).map(i => String(i.Mes)))).sort((a: string, b: string) => (MONTH_ORDER[a] || 0) - (MONTH_ORDER[b] || 0));
          const matriculas = Array.from(new Set((matrsRes.data || []).map(i => String(i.matr)))).filter(m => m && m !== 'null').sort();
          
          setOptions({ anos, meses, matriculas });
        } else {
          setOptions({
            anos: (data.anos || []).sort(),
            meses: (data.meses || []).sort((a: string, b: string) => (MONTH_ORDER[a] || 0) - (MONTH_ORDER[b] || 0)),
            matriculas: (data.matriculas || []).sort()
          });
        }
      } catch (err) {
        console.error("Erro ao sincronizar filtros 100%:", err);
      } finally {
        setFetchingOptions(false);
      }
    };
    fetchFullFilters();
  }, []);

  const handleGenerateReport = async () => {
    setLoading(true);
    setIsGenerated(false);
    setPage(1);
    
    try {
      // REGRA: Carga 100% via RPC sem limites de paginação na origem
      const { data, error } = await supabase.rpc(RPC_REPORT_EXCLUSIVA, {
        p_ano: filterAno ? parseInt(filterAno) : null,
        p_mes: filterMes || null,
        p_matr: filterMatricula || null
      });

      let rawData = data;
      if (error) {
        // Fallback robusto Select Full total
        let query = supabase.from(TABLE_NAME).select('Mes, Ano, rz, rz_ul_lv, tipo, nl, matr, instalacao');
        if (filterAno) query = query.eq('Ano', filterAno);
        if (filterMes) query = query.eq('Mes', filterMes);
        if (filterMatricula) query = query.eq('matr', filterMatricula);
        
        const res = await query;
        if (res.error) throw res.error;
        rawData = res.data;
      }

      if (rawData) {
        // REGRA OBRIGATÓRIA: Intervalo UL (rz_ul_lv >= UL_DE AND rz_ul_lv <= UL_PARA)
        let filtered = rawData;
        if (filterUlDe || filterUlPara) {
          filtered = rawData.filter((item: any) => {
            const ulVal = parseInt(item.rz_ul_lv) || 0;
            const deVal = filterUlDe ? parseInt(filterUlDe) : 0;
            const paraVal = filterUlPara ? parseInt(filterUlPara) : 99999999;
            return ulVal >= deVal && ulVal <= paraVal;
          });
        }

        // Agrupamento exclusivo (Mês, Ano, Rz, UL, Tipo)
        const groupMap: Record<string, AggregatedData> = {};

        filtered.forEach((row: any) => {
          const key = `${row.Mes}-${row.Ano}-${row.rz}-${row.rz_ul_lv}-${row.tipo}`;
          const isImpedimento = CONTROLE_LEITURISTA_IMPEDIMENTOS.includes(String(row.nl));

          if (!groupMap[key]) {
            groupMap[key] = {
              mes: String(row.Mes),
              ano: String(row.Ano),
              rz: String(row.rz),
              rz_ul_lv: String(row.rz_ul_lv),
              tipo: String(row.tipo),
              leituras_em_geral: 0,
              impedimentos: 0,
              leituras_executadas: 0,
              indicador_infm: "0,00%",
              infm_numeric: 0
            };
          }

          groupMap[key].leituras_em_geral += 1;
          if (isImpedimento) groupMap[key].impedimentos += 1;
        });

        // REGRAS DE CÁLCULO (INFM = ((Geral - Impedimentos) / Geral) * 100)
        const finalData = Object.values(groupMap).map(item => {
          const executadas = item.leituras_em_geral - item.impedimentos;
          const infm = item.leituras_em_geral > 0 ? (executadas / item.leituras_em_geral) * 100 : 0;
          return {
            ...item,
            leituras_executadas: executadas,
            infm_numeric: infm,
            indicador_infm: infm.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%'
          };
        });

        setResults(finalData);
        setIsGenerated(true);
      }
    } catch (err) {
      console.error("Erro ao processar relatório total:", err);
      alert("Falha na carga total de dados. Verifique a conexão.");
    } finally {
      setLoading(false);
    }
  };

  const chartDataImpedimentos = useMemo(() => {
    const rzMap: Record<string, number> = {};
    results.forEach(r => {
      rzMap[r.rz] = (rzMap[r.rz] || 0) + r.impedimentos;
    });
    return Object.entries(rzMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a,b) => b.value - a.value)
      .slice(0, 15);
  }, [results]);

  const tableIndicatorByRz = useMemo(() => {
    const rzAgg: Record<string, { total: number, imped: number }> = {};
    results.forEach(r => {
      if (!rzAgg[r.rz]) rzAgg[r.rz] = { total: 0, imped: 0 };
      rzAgg[r.rz].total += r.leituras_em_geral;
      rzAgg[r.rz].imped += r.impedimentos;
    });
    return Object.entries(rzAgg).map(([rz, stats]) => {
      const executadas = stats.total - stats.imped;
      const infm = stats.total > 0 ? (executadas / stats.total) * 100 : 0;
      return {
        rz,
        impedimentos: stats.imped,
        indicador: infm.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%'
      };
    }).sort((a,b) => b.impedimentos - a.impedimentos);
  }, [results]);

  const pagedData = results.slice((page - 1) * pageSize, page * pageSize);
  const totalPages = Math.ceil(results.length / pageSize);

  const exportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(results.map(r => ({
      'Mês': r.mes, 'Ano': r.ano, 'Razão': r.rz, 'UL': r.rz_ul_lv, 'Tipo': r.tipo,
      'Geral': r.leituras_em_geral, 'Executadas': r.leituras_executadas,
      'Impedimentos': r.impedimentos, 'INFM': r.indicador_infm
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Controle Leiturista");
    XLSX.writeFile(wb, "SAL_Controle_Leiturista_Analitico.xlsx");
  };

  const exportPDF = () => {
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.text("Relatório Controle de Leiturista - SAL", 14, 15);
    autoTable(doc, {
      startY: 20,
      head: [['Mês', 'Ano', 'Razão', 'UL', 'Tipo', 'Geral', 'Executadas', 'Imped.', 'INFM']],
      body: results.map(r => [r.mes, r.ano, r.rz, r.rz_ul_lv, r.tipo, r.leituras_em_geral, r.leituras_executadas, r.impedimentos, r.indicador_infm]),
      styles: { fontSize: 7, textColor: [0, 0, 0] },
      headStyles: { fillColor: [0, 0, 0] }
    });
    doc.save("SAL_Controle_Leiturista_Analitico.pdf");
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      
      {/* BLOCO DE FILTROS - COR PRETA #000000 (REGRA 4.2) */}
      <section className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-black text-white rounded-lg"><Filter size={18} /></div>
            <h2 className="text-sm font-black text-black uppercase tracking-tight">Selecione os filtros a serem tratados</h2>
          </div>
          {fetchingOptions && (
            <div className="flex items-center gap-2 text-[10px] font-black text-black uppercase animate-pulse">
              <Database size={12} /> Sincronizando Base Total...
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-black uppercase tracking-widest ml-1">Selecione o Mês</label>
            <select 
              value={filterMes} 
              onChange={e => setFilterMes(e.target.value)} 
              className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 text-xs font-black text-black focus:ring-2 focus:ring-black outline-none transition-all"
            >
              <option value="" className="text-black">Todos</option>
              {options.meses.map(m => <option key={m} value={m} className="text-black">{m}</option>)}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-black uppercase tracking-widest ml-1">Selecione o Ano</label>
            <select 
              value={filterAno} 
              onChange={e => setFilterAno(e.target.value)} 
              className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 text-xs font-black text-black focus:ring-2 focus:ring-black outline-none transition-all"
            >
              <option value="" className="text-black">Todos</option>
              {options.anos.map(a => <option key={a} value={a} className="text-black">{a}</option>)}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-black uppercase tracking-widest ml-1">Selecione a Matrícula</label>
            <select 
              value={filterMatricula} 
              onChange={e => setFilterMatricula(e.target.value)} 
              className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 text-xs font-black text-black focus:ring-2 focus:ring-black outline-none transition-all"
            >
              <option value="" className="text-black">Todos</option>
              {options.matriculas.map(m => <option key={m} value={m} className="text-black">{m}</option>)}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-black uppercase tracking-widest ml-1">UL DE</label>
            <input 
              type="text" 
              maxLength={8} 
              value={filterUlDe} 
              onChange={e => setFilterUlDe(e.target.value.replace(/\D/g, ''))} 
              className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 text-xs font-black text-black focus:ring-2 focus:ring-black outline-none transition-all" 
              placeholder="00000000" 
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-black uppercase tracking-widest ml-1">UL PARA</label>
            <input 
              type="text" 
              maxLength={8} 
              value={filterUlPara} 
              onChange={e => setFilterUlPara(e.target.value.replace(/\D/g, ''))} 
              className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 text-xs font-black text-black focus:ring-2 focus:ring-black outline-none transition-all" 
              placeholder="99999999" 
            />
          </div>
        </div>

        <div className="mt-8 flex justify-center">
          <button 
            onClick={handleGenerateReport}
            disabled={loading}
            className="flex items-center gap-3 px-20 py-4 bg-black text-white rounded-xl font-black text-sm hover:scale-[1.02] shadow-2xl transition-all disabled:opacity-50"
          >
            {loading ? <Database className="animate-spin" size={18} /> : <Play size={16} fill="currentColor" />}
            GERAR RELATÓRIO
          </button>
        </div>
      </section>

      {isGenerated && (
        <div className="space-y-12 animate-in slide-in-from-bottom-6 duration-700">
          
          {/* TABELA DE RESULTADOS (PAGINAÇÃO 50) */}
          <section className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between">
               <h3 className="text-xs font-black text-black uppercase tracking-tight flex items-center gap-2">
                  <LayoutList size={18} className="text-black" />
                  Consolidação Analítica de Leitura
               </h3>
               <div className="flex gap-2">
                  <button onClick={exportExcel} className="flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 rounded-lg text-[10px] font-black uppercase hover:bg-green-100 transition-all">
                    <FileSpreadsheet size={14} /> Excel
                  </button>
                  <button onClick={exportPDF} className="flex items-center gap-2 px-4 py-2 bg-slate-50 text-slate-700 rounded-lg text-[10px] font-black uppercase hover:bg-slate-100 transition-all">
                    <FileText size={14} /> PDF
                  </button>
               </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-[10px] text-left border-collapse">
                <thead className="bg-slate-50 text-black uppercase font-black tracking-wider">
                  <tr>
                    <th className="px-6 py-4 border-b">Mês</th>
                    <th className="px-6 py-4 border-b">Ano</th>
                    <th className="px-6 py-4 border-b">Razão</th>
                    <th className="px-6 py-4 border-b">UL</th>
                    <th className="px-6 py-4 border-b">Tipo</th>
                    <th className="px-6 py-4 border-b text-center">Geral</th>
                    <th className="px-6 py-4 border-b text-center">Executadas</th>
                    <th className="px-6 py-4 border-b text-center">Imped.</th>
                    <th className="px-6 py-4 border-b text-right">INFM</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-black">
                  {pagedData.map((r, i) => (
                    <tr key={i} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-3 font-black">{r.mes}</td>
                      <td className="px-6 py-3">{r.ano}</td>
                      <td className="px-6 py-3 font-bold">{r.rz}</td>
                      <td className="px-6 py-3 font-mono">{r.rz_ul_lv}</td>
                      <td className="px-6 py-3">{r.tipo}</td>
                      <td className="px-6 py-3 font-black text-center">{r.leituras_em_geral}</td>
                      <td className="px-6 py-3 text-green-700 font-black text-center">{r.leituras_executadas}</td>
                      <td className="px-6 py-3 text-red-700 font-black text-center">{r.impedimentos}</td>
                      <td className="px-6 py-3 text-right">
                         <span className="bg-black text-white px-3 py-1 rounded-md font-black text-[9px]">
                           {r.indicador_infm}
                         </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="px-8 py-5 bg-slate-50 flex items-center justify-between border-t border-slate-100">
               <p className="text-[10px] font-black text-black uppercase tracking-widest">
                  Processados: {results.length} registros | Página {page} de {totalPages || 1}
               </p>
               <div className="flex gap-2">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-2 bg-white rounded-lg border border-slate-200 disabled:opacity-30 hover:bg-slate-50 transition-all">
                    <ChevronLeft size={16} className="text-black" />
                  </button>
                  <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-2 bg-white rounded-lg border border-slate-200 disabled:opacity-30 hover:bg-slate-50 transition-all">
                    <ChevronRight size={16} className="text-black" />
                  </button>
               </div>
            </div>
          </section>

          {/* GRÁFICOS OPERACIONAIS */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
             <section className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
                <h3 className="text-xs font-black text-black uppercase tracking-tight mb-6 flex items-center gap-2">
                  <TrendingUp size={18} className="text-black" />
                  Impedimentos por Razão (Volume Total)
                </h3>
                <div className="h-[400px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartDataImpedimentos}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" tick={{fontSize: 9, fontWeight: 'bold', fill: '#000'}} interval={0} angle={-35} textAnchor="end" height={80} />
                      <YAxis tick={{fontSize: 10, fill: '#000'}} />
                      <Tooltip contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 20px rgba(0,0,0,0.1)'}} />
                      <Bar dataKey="value" name="Impedimentos" fill="#000000" radius={[6, 6, 0, 0]}>
                         <LabelList dataKey="value" position="top" style={{fontSize: 10, fontWeight: '900', fill: '#000'}} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
             </section>

             <section className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                <h3 className="text-xs font-black text-black uppercase tracking-tight mb-6 flex items-center gap-2">
                  <BarChart3 size={18} className="text-black" />
                  Performance (INFM) por Razão
                </h3>
                <div className="overflow-y-auto max-h-[400px] pr-2">
                   <table className="w-full text-[10px] text-left">
                      <thead className="sticky top-0 bg-white border-b border-slate-100 text-black font-black uppercase tracking-wider">
                         <tr>
                            <th className="py-4">Razão (rz)</th>
                            <th className="py-4 text-center">Impedimentos</th>
                            <th className="py-4 text-right">Indicador</th>
                         </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50 text-black">
                        {tableIndicatorByRz.map((r, i) => (
                          <tr key={i} className="hover:bg-slate-50 transition-colors">
                             <td className="py-3 font-black">{r.rz}</td>
                             <td className="py-3 text-center text-red-700 font-black">{r.impedimentos}</td>
                             <td className="py-3 text-right">
                                <span className={`px-2 py-1 rounded font-black ${parseFloat(r.indicador.replace(',','.')) > 95 ? 'text-green-700 bg-green-50' : 'text-black bg-slate-100'}`}>
                                  {r.indicador}
                                </span>
                             </td>
                          </tr>
                        ))}
                      </tbody>
                   </table>
                </div>
             </section>
          </div>
        </div>
      )}

      {/* ESTADO INICIAL */}
      {!isGenerated && !loading && (
        <div className="flex flex-col items-center justify-center py-48 bg-white rounded-3xl border-2 border-dashed border-slate-200 text-center">
          <div className="w-20 h-20 bg-black rounded-full flex items-center justify-center mb-6 shadow-xl">
             <Users size={36} className="text-white" />
          </div>
          <h3 className="text-black font-black text-xl mb-2 uppercase tracking-tight">Análise de Leiturista</h3>
          <p className="text-black font-black text-[10px] uppercase tracking-[0.3em] max-w-sm">
            Filtros integrados à tabela LeituraGeral (100% dos dados). Clique em <span className="underline">Gerar Relatório</span>.
          </p>
        </div>
      )}

      {/* CARREGAMENTO TOTAL */}
      {loading && (
        <div className="fixed inset-0 z-[1000] bg-black/80 backdrop-blur-md flex items-center justify-center">
          <div className="bg-white p-16 rounded-[50px] shadow-2xl flex flex-col items-center gap-8 text-center border border-white/20">
             <div className="relative h-20 w-20">
                <div className="absolute inset-0 rounded-full border-[6px] border-slate-50 border-t-black animate-spin"></div>
                <Database size={30} className="absolute inset-0 m-auto text-black animate-pulse" />
             </div>
             <div className="space-y-2">
                <h2 className="text-xl font-black text-black uppercase tracking-tighter">Sincronizando Base de Dados</h2>
                <div className="flex flex-col gap-1">
                  <p className="text-[10px] text-black uppercase font-black tracking-[0.3em]">Buscando Volume Total via RPC</p>
                  <p className="text-[9px] text-black font-black animate-pulse uppercase">Processando Ocorrências e Impedimentos...</p>
                </div>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LeituristaControl;

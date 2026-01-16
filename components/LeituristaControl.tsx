import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../services/supabaseClient';
import { TABLE_NAME, MONTH_ORDER, RPC_LEITURISTA_REPORT } from '../constants';
import { 
  Users, Filter, Play, 
  FileSpreadsheet, FileText, ChevronLeft, ChevronRight,
  TrendingUp, LayoutList, Database, RefreshCw, AlertCircle, PieChart
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, Legend, LabelList 
} from 'recharts';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

interface LeituristaRow {
  mes: string;
  ano: number;
  rz: string;
  rz_ul_lv: string;
  tipo: string;
  leituras_em_geral: number;
  leituras_executadas: number;
  impedimentos: number;
  indicador_infm: number;
  matr?: string;
}

const LeituristaControl: React.FC = () => {
  // Estados de Filtros
  const [filterAno, setFilterAno] = useState<string>('');
  const [filterMes, setFilterMes] = useState<string>('');
  const [filterMatricula, setFilterMatricula] = useState<string>('');
  const [filterUlDe, setFilterUlDe] = useState<string>('');
  const [filterUlPara, setFilterUlPara] = useState<string>('');

  // Metadados para os filtros
  const [options, setOptions] = useState<{anos: string[], meses: string[], matriculas: string[]}>({
    anos: [], meses: [], matriculas: []
  });

  // Resultados e Estados de UI
  const [results, setResults] = useState<LeituristaRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchingOptions, setFetchingOptions] = useState(false);
  const [isGenerated, setIsGenerated] = useState(false);
  const [page, setPage] = useState(1);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const pageSize = 50;

  // Sincronização de Opções de Filtros
  useEffect(() => {
    const fetchOptions = async () => {
      setFetchingOptions(true);
      try {
        const [anosRes, mesesRes, matrsRes] = await Promise.all([
          supabase.from(TABLE_NAME).select('Ano').order('Ano', { ascending: false }),
          supabase.from(TABLE_NAME).select('Mes'),
          supabase.from(TABLE_NAME).select('matr').not('matr', 'is', null)
        ]);

        const rawAnos = (anosRes.data as any[] | null) || [];
        const rawMeses = (mesesRes.data as any[] | null) || [];
        const rawMatrs = (matrsRes.data as any[] | null) || [];

        const anos: string[] = Array.from(new Set(rawAnos.map((i: any) => String(i.Ano)))).sort((a, b) => Number(b) - Number(a));
        const meses: string[] = Array.from(new Set(rawMeses.map((i: any) => String(i.Mes)))).sort((a: string, b: string) => (MONTH_ORDER[a] || 0) - (MONTH_ORDER[b] || 0));
        const matriculas: string[] = Array.from(new Set(rawMatrs.map((i: any) => String(i.matr))))
          .filter((m: any) => m && String(m) !== 'null')
          .map((m: any) => String(m))
          .sort();
        
        setOptions({ anos, meses, matriculas });
      } catch (err) {
        console.error("Erro ao sincronizar filtros:", err);
      } finally {
        setFetchingOptions(false);
      }
    };
    fetchOptions();
  }, []);

  const handleGenerateReport = async () => {
    setLoading(true);
    setIsGenerated(false);
    setErrorMsg(null);
    setPage(1);
    
    try {
      // Parâmetros obrigatórios: p_ano, p_mes, p_matr, p_ul_de, p_ul_para
      const params = {
        p_ano: filterAno ? parseInt(filterAno) : null,
        p_mes: filterMes || null,
        p_matr: filterMatricula || null,
        p_ul_de: filterUlDe ? parseInt(filterUlDe) : null,
        p_ul_para: filterUlPara ? parseInt(filterUlPara) : null
      };

      const { data, error } = await supabase.rpc(RPC_LEITURISTA_REPORT, params);

      if (error) throw error;
      
      setResults(data || []);
      setIsGenerated(true);
    } catch (err: any) {
      console.error("Erro ao executar RPC agregada:", err);
      setErrorMsg("Falha ao gerar relatório: " + (err.message || "Erro de conexão"));
    } finally {
      setLoading(false);
    }
  };

  // Gráfico 1: Quantidade de Impedimentos (Matrícula, Razão, Mês e Ano)
  const chartDataImpedimentos = useMemo(() => {
    return results
      .filter(r => r.impedimentos > 0)
      .sort((a, b) => b.impedimentos - a.impedimentos)
      .slice(0, 15)
      .map(r => ({
        label: `${r.matr || 'N/A'} | ${r.rz} (${r.mes}/${r.ano})`,
        value: r.impedimentos
      }));
  }, [results]);

  // Tabela Resumo: Razão, Qtd Impedimentos, Indicador (%)
  const summaryByRazao = useMemo(() => {
    const map = new Map<string, { rz: string, imped: number, geral: number, exec: number }>();
    
    results.forEach(r => {
      const existing = map.get(r.rz) || { rz: r.rz, imped: 0, geral: 0, exec: 0 };
      existing.imped += (Number(r.impedimentos) || 0);
      existing.geral += (Number(r.leituras_em_geral) || 0);
      existing.exec += (Number(r.leituras_executadas) || 0);
      map.set(r.rz, existing);
    });

    return Array.from(map.values()).map(item => {
      const indicador = item.geral > 0 ? (item.exec / item.geral) * 100 : 0;
      return {
        ...item,
        indicador: indicador.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%'
      };
    }).sort((a, b) => b.imped - a.imped);
  }, [results]);

  const pagedData = useMemo(() => {
    return results.slice((page - 1) * pageSize, page * pageSize);
  }, [results, page]);

  const totalPages = Math.ceil(results.length / pageSize);

  const exportExcel = () => {
    if (results.length === 0) return;
    const ws = XLSX.utils.json_to_sheet(results.map(r => ({
      'Mês': r.mes, 
      'Ano': r.ano, 
      'Razão': r.rz, 
      'UL': r.rz_ul_lv, 
      'Tipo': r.tipo,
      'Leituras em Geral': r.leituras_em_geral, 
      'Leituras Executadas': r.leituras_executadas,
      'Impedimentos': r.impedimentos,
      'Indicador INFM (%)': (Number(r.indicador_infm) || 0).toFixed(2).replace('.', ',') + '%'
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Controle Leiturista");
    XLSX.writeFile(wb, "SAL_Relatorio_Leiturista_Agregado.xlsx");
  };

  const exportPDF = () => {
    if (results.length === 0) return;
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(14);
    doc.text("SAL - Controle de Leiturista Agregado", 14, 15);
    autoTable(doc, {
      startY: 20,
      head: [['Mês', 'Ano', 'Razão', 'UL', 'Tipo', 'Geral', 'Executadas', 'Imped.', 'INFM (%)']],
      body: results.map(r => [
        r.mes, r.ano, r.rz, r.rz_ul_lv, r.tipo, 
        r.leituras_em_geral, r.leituras_executadas, r.impedimentos, 
        (Number(r.indicador_infm) || 0).toFixed(2).replace('.', ',') + '%'
      ]),
      styles: { fontSize: 7 }
    });
    doc.save("SAL_Relatorio_Leiturista.pdf");
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      
      {/* SEÇÃO DE FILTROS */}
      <section className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><Filter size={18} /></div>
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-tight">Selecione os filtros a serem tratados</h2>
          </div>
          {fetchingOptions && <RefreshCw className="animate-spin text-blue-500" size={16} />}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Selecione o Mês:</label>
            <select 
              value={filterMes} 
              onChange={e => setFilterMes(e.target.value)} 
              className="w-full bg-white border border-slate-200 rounded-xl py-3 px-4 text-xs font-bold text-black focus:ring-2 focus:ring-blue-100 outline-none transition-all"
            >
              <option value="">Todos os Meses</option>
              {options.meses.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Selecione o Ano:</label>
            <select 
              value={filterAno} 
              onChange={e => setFilterAno(e.target.value)} 
              className="w-full bg-white border border-slate-200 rounded-xl py-3 px-4 text-xs font-bold text-black focus:ring-2 focus:ring-blue-100 outline-none transition-all"
            >
              <option value="">Todos os Anos</option>
              {options.anos.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Selecione a Matrícula:</label>
            <select 
              value={filterMatricula} 
              onChange={e => setFilterMatricula(e.target.value)} 
              className="w-full bg-white border border-slate-200 rounded-xl py-3 px-4 text-xs font-bold text-black focus:ring-2 focus:ring-blue-100 outline-none transition-all"
            >
              <option value="">Todas as Matrículas</option>
              {options.matriculas.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">UL DE:</label>
            <input 
              type="text" 
              maxLength={8} 
              value={filterUlDe} 
              onChange={e => setFilterUlDe(e.target.value.replace(/\D/g, ''))} 
              className="w-full bg-white border border-slate-200 rounded-xl py-3 px-4 text-xs font-bold text-black focus:ring-2 focus:ring-blue-100 outline-none" 
              placeholder="00000000" 
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">UL PARA:</label>
            <input 
              type="text" 
              maxLength={8} 
              value={filterUlPara} 
              onChange={e => setFilterUlPara(e.target.value.replace(/\D/g, ''))} 
              className="w-full bg-white border border-slate-200 rounded-xl py-3 px-4 text-xs font-bold text-black focus:ring-2 focus:ring-blue-100 outline-none" 
              placeholder="99999999" 
            />
          </div>
        </div>

        <div className="mt-8 flex justify-center">
          <button 
            onClick={handleGenerateReport} 
            disabled={loading} 
            className="flex items-center gap-3 px-20 py-4 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 shadow-xl transition-all disabled:opacity-50"
          >
            {loading ? <Database className="animate-spin" size={18} /> : <Play size={16} fill="currentColor" />}
            PROCESSAR DADOS
          </button>
        </div>

        {errorMsg && (
          <div className="mt-6 p-4 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3 text-red-600 text-[10px] font-bold uppercase">
             <AlertCircle size={16} />
             {errorMsg}
          </div>
        )}
      </section>

      {isGenerated && (
        <div className="space-y-12 animate-in slide-in-from-bottom-6 duration-700">
          
          {/* TABELA DE RESULTADOS */}
          <section className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-8 py-6 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
               <h3 className="text-xs font-bold text-slate-800 uppercase tracking-tight flex items-center gap-2">
                  <LayoutList size={18} className="text-blue-600" />
                  Consolidação de Leitura (RPC Agregada)
               </h3>
               <div className="flex gap-2">
                  <button onClick={exportExcel} className="flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 rounded-lg text-[10px] font-bold uppercase hover:bg-green-100 border border-green-200 transition-all">
                    <FileSpreadsheet size={14} /> Excel
                  </button>
                  <button onClick={exportPDF} className="flex items-center gap-2 px-4 py-2 bg-slate-50 text-slate-700 rounded-lg text-[10px] font-bold uppercase hover:bg-slate-100 border border-slate-200 transition-all">
                    <FileText size={14} /> PDF
                  </button>
               </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-[10px] text-left">
                <thead className="bg-slate-50 text-slate-500 uppercase font-bold tracking-wider">
                  <tr>
                    <th className="px-6 py-4">Mês</th>
                    <th className="px-6 py-4">Ano</th>
                    <th className="px-6 py-4">Razão</th>
                    <th className="px-6 py-4">UL</th>
                    <th className="px-6 py-4">Tipo</th>
                    <th className="px-6 py-4 text-right">Geral</th>
                    <th className="px-6 py-4 text-right">Executadas</th>
                    <th className="px-6 py-4 text-right">Imped.</th>
                    <th className="px-6 py-4 text-right">INFM (%)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {pagedData.map((r, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-3 font-bold">{r.mes}</td>
                      <td className="px-6 py-3">{r.ano}</td>
                      <td className="px-6 py-3 font-semibold">{r.rz}</td>
                      <td className="px-6 py-3">{r.rz_ul_lv}</td>
                      <td className="px-6 py-3 font-medium uppercase">{r.tipo}</td>
                      <td className="px-6 py-3 text-right font-bold">{r.leituras_em_geral}</td>
                      <td className="px-6 py-3 text-right text-green-700 font-bold">{r.leituras_executadas}</td>
                      <td className="px-6 py-3 text-right text-red-600 font-bold">{r.impedimentos}</td>
                      <td className="px-6 py-3 text-right font-black text-blue-600 bg-blue-50/30">
                        {(Number(r.indicador_infm) || 0).toFixed(2).replace('.', ',')}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* PAGINAÇÃO */}
            <div className="px-8 py-4 bg-slate-50 flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                Total: {results.length} registros localizados
              </span>
              <div className="flex items-center gap-4">
                <button 
                  disabled={page === 1} 
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  className="p-2 bg-white border border-slate-200 rounded-lg text-slate-500 disabled:opacity-30 hover:bg-slate-50 transition-all shadow-sm"
                >
                  <ChevronLeft size={16} />
                </button>
                <div className="flex items-center gap-1">
                   <span className="text-xs font-black text-slate-900">{page}</span>
                   <span className="text-xs font-bold text-slate-300">/</span>
                   <span className="text-xs font-bold text-slate-400">{totalPages || 1}</span>
                </div>
                <button 
                  disabled={page === totalPages || totalPages === 0} 
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  className="p-2 bg-white border border-slate-200 rounded-lg text-slate-500 disabled:opacity-30 hover:bg-slate-50 transition-all shadow-sm"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </section>

          {/* GRÁFICO 1: QUANTIDADE DE IMPEDIMENTOS */}
          <section className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
            <h3 className="text-[11px] font-bold text-slate-800 uppercase tracking-tight mb-8 flex items-center gap-2">
              <TrendingUp size={16} className="text-blue-600" />
              Volume de Impedimentos por Matrícula e Razão
            </h3>
            <div className="h-[450px] w-full">
              {chartDataImpedimentos.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartDataImpedimentos} layout="vertical" margin={{ left: 80, right: 30 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                    <XAxis type="number" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8'}} />
                    <YAxis dataKey="label" type="category" axisLine={false} tickLine={false} tick={{fontSize: 9, fontWeight: 'bold', fill: '#64748b'}} width={180} />
                    <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'}} />
                    <Bar dataKey="value" name="Impedimentos" fill="#ef4444" radius={[0, 4, 4, 0]} barSize={20}>
                      <LabelList dataKey="value" position="right" style={{fontSize: 10, fontWeight: '900', fill: '#ef4444'}} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-slate-300 gap-2">
                   <TrendingUp size={40} />
                   <p className="text-[10px] font-bold uppercase">Nenhum dado para o gráfico</p>
                </div>
              )}
            </div>
          </section>

          {/* GRÁFICO 2: TABELA RESUMO POR RAZÃO */}
          <section className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
            <h3 className="text-[11px] font-bold text-slate-800 uppercase tracking-tight mb-8 flex items-center gap-2">
              <PieChart size={16} className="text-blue-600" />
              Tabela Resumo: Desempenho por Razão (rz)
            </h3>
            <div className="overflow-hidden border border-slate-100 rounded-2xl">
              <table className="w-full text-left text-[11px]">
                <thead className="bg-slate-900 text-white uppercase font-bold tracking-wider">
                  <tr>
                    <th className="px-8 py-4">Razão (rz)</th>
                    <th className="px-8 py-4 text-center">Qtd Impedimentos</th>
                    <th className="px-8 py-4 text-right">Indicador (%)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {summaryByRazao.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 transition-colors font-medium">
                      <td className="px-8 py-4 text-slate-900 font-bold uppercase">{item.rz}</td>
                      <td className="px-8 py-4 text-center">
                         <span className="bg-red-50 text-red-600 px-3 py-1 rounded-full font-black">
                           {item.imped.toLocaleString()}
                         </span>
                      </td>
                      <td className="px-8 py-4 text-right text-blue-600 font-black text-xs">
                        {item.indicador}
                      </td>
                    </tr>
                  ))}
                  {summaryByRazao.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-8 py-10 text-center text-slate-400 font-bold uppercase italic">
                        Nenhum dado consolidado disponível
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

        </div>
      )}

      {!isGenerated && !loading && (
        <div className="flex flex-col items-center justify-center py-40 bg-white rounded-3xl border-2 border-dashed border-slate-200">
           <div className="p-6 bg-slate-50 rounded-full mb-6">
              <Users size={48} className="text-slate-200" />
           </div>
           <p className="text-slate-400 font-bold text-[10px] uppercase tracking-[0.3em]">Configure os parâmetros acima e processe o relatório agregado</p>
        </div>
      )}
    </div>
  );
};

export default LeituristaControl;
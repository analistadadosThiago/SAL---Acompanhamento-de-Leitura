import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../services/supabaseClient';
import { TABLE_NAME, MONTH_ORDER, RPC_LEITURISTA_REPORT } from '../constants';
import { 
  Users, Filter, Play, 
  FileSpreadsheet, FileText, ChevronLeft, ChevronRight,
  TrendingUp, LayoutList, Database, BarChart3, RefreshCw
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
  ano: string;
  rz: string;
  rz_ul_lv: string;
  tipo: string;
  leituras_em_geral: number;
  impedimentos: number;
  leituras_executadas: number;
  indicador_infm: string;
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
  const pageSize = 50;

  // Sincronização de Filtros
  useEffect(() => {
    const fetchOptions = async () => {
      setFetchingOptions(true);
      try {
        const [anosRes, mesesRes, matrsRes] = await Promise.all([
          supabase.from(TABLE_NAME).select('Ano'),
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
    setPage(1);
    
    try {
      const { data, error } = await supabase.rpc(RPC_LEITURISTA_REPORT, {
        p_ano: filterAno ? parseInt(filterAno) : null,
        p_mes: filterMes || null,
        p_matr: filterMatricula || null,
        p_ul_de: filterUlDe || null,
        p_ul_para: filterUlPara || null
      });

      if (error) throw error;
      
      setResults(data || []);
      setIsGenerated(true);
    } catch (err: any) {
      console.error("Erro ao executar RPC de relatório:", err);
      alert("Falha ao gerar relatório: " + (err.message || "Erro desconhecido"));
    } finally {
      setLoading(false);
    }
  };

  // Gráfico: Qtd Impedimentos por Matrícula/Razão
  const chartDataImpedimentos = useMemo(() => {
    return [...results]
      .sort((a, b) => b.impedimentos - a.impedimentos)
      .slice(0, 15)
      .map(r => ({
        label: `${r.matr || 'N/A'} - ${r.rz}`,
        value: r.impedimentos
      }));
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
      'Impedimentos': r.impedimentos,
      'Leituras Executadas': r.leituras_executadas, 
      'Indicador INFM': r.indicador_infm
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Controle Leiturista");
    XLSX.writeFile(wb, "SAL_Controle_Leiturista.xlsx");
  };

  const exportPDF = () => {
    if (results.length === 0) return;
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(14);
    doc.text("SAL - Controle de Leiturista", 14, 15);
    autoTable(doc, {
      startY: 20,
      head: [['Mês', 'Ano', 'Razão', 'UL', 'Tipo', 'Geral', 'Imped.', 'Executadas', 'INFM']],
      body: results.map(r => [
        r.mes, r.ano, r.rz, r.rz_ul_lv, r.tipo, 
        r.leituras_em_geral, r.impedimentos, r.leituras_executadas, r.indicador_infm
      ]),
      styles: { fontSize: 7 }
    });
    doc.save("SAL_Controle_Leiturista.pdf");
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      
      {/* SEÇÃO DE FILTROS */}
      <section className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><Filter size={18} /></div>
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-tight">Parâmetros de Análise</h2>
          </div>
          {fetchingOptions && <RefreshCw className="animate-spin text-blue-500" size={16} />}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Mês</label>
            <select value={filterMes} onChange={e => setFilterMes(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 text-xs font-semibold focus:ring-2 focus:ring-blue-100 outline-none">
              <option value="">Todos os Meses</option>
              {options.meses.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Ano</label>
            <select value={filterAno} onChange={e => setFilterAno(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 text-xs font-semibold focus:ring-2 focus:ring-blue-100 outline-none">
              <option value="">Todos os Anos</option>
              {options.anos.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Matrícula</label>
            <select value={filterMatricula} onChange={e => setFilterMatricula(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 text-xs font-semibold focus:ring-2 focus:ring-blue-100 outline-none">
              <option value="">Todas as Matrículas</option>
              {options.matriculas.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">UL DE</label>
            <input type="text" maxLength={8} value={filterUlDe} onChange={e => setFilterUlDe(e.target.value.replace(/\D/g, ''))} className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 text-xs font-semibold" placeholder="00000000" />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">UL PARA</label>
            <input type="text" maxLength={8} value={filterUlPara} onChange={e => setFilterUlPara(e.target.value.replace(/\D/g, ''))} className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 text-xs font-semibold" placeholder="99999999" />
          </div>
        </div>

        <div className="mt-8 flex justify-center">
          <button onClick={handleGenerateReport} disabled={loading} className="flex items-center gap-3 px-20 py-4 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 shadow-xl transition-all disabled:opacity-50">
            {loading ? <Database className="animate-spin" size={18} /> : <Play size={16} fill="currentColor" />}
            PROCESSAR DADOS
          </button>
        </div>
      </section>

      {isGenerated && (
        <div className="space-y-12 animate-in slide-in-from-bottom-6 duration-700">
          
          {/* TABELA DE RESULTADOS */}
          <section className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-8 py-6 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
               <h3 className="text-xs font-bold text-slate-800 uppercase tracking-tight flex items-center gap-2">
                  <LayoutList size={18} className="text-blue-600" />
                  Consolidação Analítica de Leitura
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
                    <th className="px-6 py-4">Mês/Ano</th>
                    <th className="px-6 py-4">Razão</th>
                    <th className="px-6 py-4">UL</th>
                    <th className="px-6 py-4">Tipo</th>
                    <th className="px-6 py-4 text-right">Geral</th>
                    <th className="px-6 py-4 text-right">Imped.</th>
                    <th className="px-6 py-4 text-right">Executadas</th>
                    <th className="px-6 py-4 text-right">INFM (%)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {pagedData.map((r, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-3 font-bold">{r.mes}/{r.ano}</td>
                      <td className="px-6 py-3 font-semibold">{r.rz}</td>
                      <td className="px-6 py-3">{r.rz_ul_lv}</td>
                      <td className="px-6 py-3 font-medium uppercase">{r.tipo}</td>
                      <td className="px-6 py-3 text-right font-bold">{r.leituras_em_geral}</td>
                      <td className="px-6 py-3 text-right text-red-600 font-bold">{r.impedimentos}</td>
                      <td className="px-6 py-3 text-right text-green-700 font-bold">{r.leituras_executadas}</td>
                      <td className="px-6 py-3 text-right font-black text-blue-600 bg-blue-50/30">{r.indicador_infm}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* PAGINAÇÃO */}
            {totalPages > 1 && (
              <div className="px-8 py-4 bg-slate-50 flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Total: {results.length} registros</span>
                <div className="flex items-center gap-4">
                  <button 
                    disabled={page === 1} 
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    className="p-2 bg-white border border-slate-200 rounded-lg text-slate-500 disabled:opacity-30 hover:bg-slate-50 transition-all"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <span className="text-xs font-black text-slate-900">Página {page} de {totalPages}</span>
                  <button 
                    disabled={page === totalPages} 
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    className="p-2 bg-white border border-slate-200 rounded-lg text-slate-500 disabled:opacity-30 hover:bg-slate-50 transition-all"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* GRÁFICO DE TOP IMPEDIMENTOS */}
          <section className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
            <h3 className="text-[11px] font-bold text-slate-800 uppercase tracking-tight mb-8 flex items-center gap-2">
              <TrendingUp size={16} className="text-blue-600" />
              Maiores Ocorrências por Unidade de Leitura
            </h3>
            <div className="h-[450px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartDataImpedimentos} layout="vertical" margin={{ left: 50, right: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                  <XAxis type="number" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8'}} />
                  <YAxis dataKey="label" type="category" axisLine={false} tickLine={false} tick={{fontSize: 9, fontWeight: 'bold', fill: '#64748b'}} width={150} />
                  <Tooltip cursor={{fill: '#f8fafc'}} />
                  <Bar dataKey="value" name="Impedimentos" fill="#ef4444" radius={[0, 4, 4, 0]} barSize={20}>
                    <LabelList dataKey="value" position="right" style={{fontSize: 10, fontWeight: '900', fill: '#ef4444'}} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

        </div>
      )}

      {!isGenerated && !loading && (
        <div className="flex flex-col items-center justify-center py-40 bg-white rounded-3xl border-2 border-dashed border-slate-200">
           <Users size={48} className="text-slate-100 mb-6" />
           <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest">Selecione os filtros e clique em gerar relatório</p>
        </div>
      )}
    </div>
  );
};

export default LeituristaControl;
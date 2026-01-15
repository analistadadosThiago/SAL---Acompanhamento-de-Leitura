
import React, { useState, useMemo } from 'react';
import { supabase } from '../services/supabaseClient';
import { TABLE_NAME, MONTH_ORDER, IMPEDIMENTO_CODES } from '../constants';
import { LeituraRecord } from '../types';
import { Search, Hash, Cpu, History, TrendingUp, AlertCircle, LayoutList, FileSpreadsheet, FileText, RotateCcw } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LabelList } from 'recharts';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const TechnicalSearch: React.FC = () => {
  const [searchType, setSearchType] = useState<'instalacao' | 'medidor'>('instalacao');
  const [searchValue, setSearchValue] = useState('');
  
  const [results, setResults] = useState<LeituraRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSearch = async () => {
    const term = searchValue.trim();
    if (!term) return;

    setLoading(true);
    setHasSearched(true);
    setErrorMsg(null);

    try {
      let query = supabase.from(TABLE_NAME).select('*');
      
      // Busca por Identificador (Instalação ou Medidor)
      query = query.eq(searchType, term);

      const { data, error } = await query;
      
      if (error) {
        throw new Error(error.message);
      }
      setResults(data as LeituraRecord[] || []);
    } catch (err: any) {
      console.error("Erro na busca:", err);
      setErrorMsg(err.message || 'Erro na comunicação com o banco de dados.');
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setSearchValue('');
    setResults([]);
    setHasSearched(false);
    setErrorMsg(null);
  };

  const sortedResults = useMemo(() => {
    return [...results].sort((a, b) => {
      if (Number(a.Ano) !== Number(b.Ano)) {
        return Number(a.Ano) - Number(b.Ano);
      }
      const mesA = (MONTH_ORDER[String(a.Mes).toUpperCase()] || 0);
      const mesB = (MONTH_ORDER[String(b.Mes).toUpperCase()] || 0);
      return mesA - mesB;
    });
  }, [results]);

  const historyByCod = useMemo(() => {
    const counts: Record<string, number> = {};
    results.forEach(r => {
      const cod = String(r.nl || 'N/A');
      counts[cod] = (counts[cod] || 0) + 1;
    });
    return Object.entries(counts).map(([cod, qtd]) => ({ cod, qtd })).sort((a, b) => b.qtd - a.qtd);
  }, [results]);

  const consumptionChartData = useMemo(() => {
    return sortedResults.map(r => ({
      label: `${r.Mes}/${r.Ano}`,
      consumo: Number(r.consumo) || 0
    }));
  }, [sortedResults]);

  const exportToExcel = () => {
    if (results.length === 0) return;
    const ws = XLSX.utils.json_to_sheet(results);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Relatório Consulta");
    XLSX.writeFile(wb, `SAL_Consulta_Export.xlsx`);
  };

  const exportToPDF = () => {
    if (results.length === 0) return;
    
    try {
      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });

      autoTable(doc, {
        html: '#report-table',
        theme: 'grid',
        styles: {
          fontSize: 7,
          cellPadding: 1.5,
          lineColor: [0, 0, 0],
          lineWidth: 0.1
        },
        headStyles: {
          fillColor: [241, 245, 249],
          textColor: [0, 0, 0],
          fontStyle: 'bold',
          lineWidth: 0.1
        },
        margin: { top: 10, right: 5, bottom: 10, left: 5 },
        didDrawPage: (data) => {
          const str = `Página ${doc.getNumberOfPages()}`;
          doc.setFontSize(8);
          doc.text(str, data.settings.margin.left, doc.internal.pageSize.height - 5);
        }
      });

      doc.save(`SAL_Relatorio_Consulta.pdf`);
    } catch (err) {
      console.error("Erro ao gerar PDF:", err);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 print:p-0">
      {/* SEÇÃO DE PESQUISA E FILTROS */}
      <section className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200 print:hidden">
        <div className="flex flex-col space-y-6">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
            
            {/* Opção de Busca */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Pesquisar:</label>
              <div className="flex bg-slate-100 p-1 rounded-xl">
                <button 
                  onClick={() => setSearchType('instalacao')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all ${searchType === 'instalacao' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  <Hash size={12} />
                  Instalação
                </button>
                <button 
                  onClick={() => setSearchType('medidor')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all ${searchType === 'medidor' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  <Cpu size={12} />
                  Medidor
                </button>
              </div>
            </div>

            {/* Input de Identificador */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Valor da Pesquisa</label>
              <div className="relative">
                <input 
                  type="text"
                  value={searchValue}
                  onChange={(e) => setSearchValue(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder={searchType === 'instalacao' ? "Ex: 00123456" : "Ex: ABC-123"}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pl-5 pr-12 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all font-semibold text-slate-800 text-sm"
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300">
                  <Search size={16} />
                </div>
              </div>
            </div>

          </div>

          <div className="flex gap-4 justify-center pt-2">
            <button
              onClick={handleSearch}
              disabled={loading || !searchValue}
              className="flex items-center gap-3 px-14 py-4 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 hover:scale-[1.02] shadow-xl shadow-blue-500/20 transition-all disabled:opacity-30"
            >
              {loading ? <RotateCcw className="animate-spin" size={18} /> : <Search size={18} />}
              REALIZAR BUSCA
            </button>
            
            <button
              onClick={handleReset}
              className="flex items-center gap-2 px-8 py-4 bg-slate-100 text-slate-600 rounded-xl text-[10px] font-bold uppercase tracking-wider hover:bg-slate-200 transition-all"
            >
              <RotateCcw size={14} />
              Nova Consulta
            </button>
          </div>
        </div>

        {errorMsg && (
          <div className="mt-6 p-4 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3 text-red-700 text-[10px] font-bold uppercase">
            <AlertCircle size={16} />
            <p>{errorMsg}</p>
          </div>
        )}
      </section>

      {loading && (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-slate-100 border-t-blue-600"></div>
          <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest">Acessando Base de Dados...</p>
        </div>
      )}

      {hasSearched && !loading && results.length === 0 && !errorMsg && (
        <div className="bg-white p-20 rounded-3xl text-center border-2 border-dashed border-slate-100">
          <p className="text-slate-300 font-bold text-xs uppercase">Nenhum registro localizado para os filtros informados</p>
        </div>
      )}

      {results.length > 0 && !loading && (
        <div className="space-y-8">
          {/* BOTÕES DE EXPORTAÇÃO */}
          <div className="flex justify-end gap-3 print:hidden">
            <button 
              onClick={exportToExcel}
              className="flex items-center gap-2 px-6 py-3 bg-white border border-slate-200 text-slate-700 rounded-xl text-[10px] font-bold uppercase tracking-wider hover:bg-slate-50 transition-all shadow-sm"
            >
              <FileSpreadsheet size={14} className="text-green-600" />
              Excel
            </button>
            <button 
              onClick={exportToPDF}
              className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl text-[10px] font-bold uppercase tracking-wider hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20"
            >
              <FileText size={14} />
              PDF Tabular
            </button>
          </div>

          {/* TABELA DE RESULTADOS */}
          <section className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden print-report-only">
            <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between print:hidden">
               <h3 className="text-xs font-bold text-slate-800 uppercase tracking-tight flex items-center gap-2">
                  <LayoutList size={18} className="text-blue-600" />
                  Dados da Instalação/Medidor Pesquisado
               </h3>
               <span className="text-[9px] font-bold bg-blue-50 text-blue-600 px-3 py-1 rounded-full">
                  {results.length} registros
               </span>
            </div>
            
            <div className="overflow-x-auto print:overflow-visible">
              <table id="report-table" className="w-full text-[10px] text-left border-collapse border border-black">
                <thead className="bg-slate-50 text-slate-500 uppercase font-bold tracking-wider sticky top-0 z-10">
                  <tr>
                    <th className="px-6 py-4 border border-black">MÊS</th>
                    <th className="px-6 py-4 border border-black">ANO</th>
                    <th className="px-6 py-4 border border-black">UL</th>
                    <th className="px-6 py-4 border border-black">INSTALAÇÃO</th>
                    <th className="px-6 py-4 border border-black">MEDIDOR</th>
                    <th className="px-6 py-4 border border-black">REG</th>
                    <th className="px-6 py-4 border border-black">MATR</th>
                    <th className="px-6 py-4 border border-black">COD</th>
                    <th className="px-6 py-4 border border-black">LEITURA</th>
                    <th className="px-6 py-4 border border-black">CONSUMO</th>
                    <th className="px-6 py-4 border border-black">DIG</th>
                    <th className="px-6 py-4 border border-black">NOSB.IMP</th>
                    <th className="px-6 py-4 border border-black">NOSB.SIM</th>
                    <th className="px-6 py-4 border border-black">CNA</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black text-slate-700 bg-white">
                  {sortedResults.map((r, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-3 font-bold uppercase whitespace-nowrap border border-black">{r.Mes}</td>
                      <td className="px-6 py-3 border border-black">{r.Ano}</td>
                      <td className="px-6 py-3 border border-black">{r.rz_ul_lv}</td>
                      <td className="px-6 py-3 font-semibold border border-black">{r.instalacao}</td>
                      <td className="px-6 py-3 font-mono border border-black">{r.medidor}</td>
                      <td className="px-6 py-3 border border-black">{r.reg}</td>
                      <td className="px-6 py-3 border border-black">{r.matr}</td>
                      <td className="px-6 py-3 border border-black">
                         <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${IMPEDIMENTO_CODES.includes(String(r.nl)) ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                           {r.nl}
                         </span>
                      </td>
                      <td className="px-6 py-3 font-bold border border-black">{r.l_atual}</td>
                      <td className="px-6 py-3 font-bold text-blue-600 border border-black">{r.consumo}</td>
                      <td className="px-6 py-3 text-slate-400 text-[9px] whitespace-nowrap border border-black">{r.digitacao}</td>
                      <td className="px-6 py-3 border border-black">{r.nosb_impedimento}</td>
                      <td className="px-6 py-3 border border-black">{r.nosb_simulacao}</td>
                      <td className="px-6 py-3 border border-black">{r.cna}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 print-hide-extra">
            <section className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
              <h3 className="text-[11px] font-bold text-slate-800 uppercase tracking-tight mb-6 flex items-center gap-2">
                <History size={16} className="text-blue-600" />
                Histórico de Ocorrências
              </h3>
              <div className="overflow-y-auto max-h-[300px]">
                <table className="w-full text-[10px] border-collapse">
                  <thead className="text-slate-400 border-b">
                    <tr>
                      <th className="text-left py-2 font-bold uppercase tracking-wider">COD</th>
                      <th className="text-right py-2 font-bold uppercase tracking-wider">QTD</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {historyByCod.map((item, idx) => (
                      <tr key={idx}>
                        <td className="py-3 font-bold text-slate-900">{item.cod}</td>
                        <td className="py-3 text-right">
                           <span className="bg-slate-50 px-2 py-1 rounded-md font-bold text-slate-600">{item.qtd}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="lg:col-span-2 bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
              <h3 className="text-[11px] font-bold text-slate-800 uppercase tracking-tight mb-6 flex items-center gap-2">
                <TrendingUp size={16} className="text-blue-600" />
                Histórico de Consumo
              </h3>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={consumptionChartData} margin={{ top: 30, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10}} />
                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10}} />
                    <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} />
                    <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '10px', textTransform: 'uppercase' }} />
                    <Line 
                      name="Consumo"
                      type="monotone" 
                      dataKey="consumo" 
                      stroke="#2563eb" 
                      strokeWidth={3}
                      dot={{ r: 4, fill: '#2563eb' }}
                      activeDot={{ r: 6 }}
                    >
                      <LabelList 
                        dataKey="consumo" 
                        position="top" 
                        offset={15}
                        style={{ fill: '#1e293b', fontSize: '11px', fontWeight: '900' }} 
                      />
                    </Line>
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </section>
          </div>
        </div>
      )}
    </div>
  );
};

export default TechnicalSearch;

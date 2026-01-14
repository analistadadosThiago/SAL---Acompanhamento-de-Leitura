
import React, { useState, useMemo } from 'react';
import { supabase } from '../services/supabaseClient';
import { TABLE_NAME, MONTH_ORDER, IMPEDIMENTO_CODES } from '../constants';
import { LeituraRecord } from '../types';
import { Search, Hash, Cpu, History, TrendingUp, AlertCircle, LayoutList } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

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
      const { data, error } = await supabase
        .from(TABLE_NAME)
        .select('*')
        .eq(searchType, term);
      
      if (error) {
        throw new Error(error.message);
      }
      setResults(data as LeituraRecord[] || []);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Erro na comunicação com o banco de dados.');
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const sortedResults = useMemo(() => {
    // Requirements: Month chronological order, Year ascending
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

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* SEARCH BOX */}
      <section className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
        <div className="flex flex-col md:flex-row items-stretch gap-6">
          <div className="flex bg-slate-100 p-1.5 rounded-xl self-start md:self-auto">
            <button 
              onClick={() => setSearchType('instalacao')}
              className={`flex items-center gap-2 px-6 py-2.5 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all ${searchType === 'instalacao' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <Hash size={12} />
              Instalação
            </button>
            <button 
              onClick={() => setSearchType('medidor')}
              className={`flex items-center gap-2 px-6 py-2.5 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all ${searchType === 'medidor' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <Cpu size={12} />
              Medidor
            </button>
          </div>
          
          <div className="flex-1 relative">
            <input 
              type="text"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder={searchType === 'instalacao' ? "Digite a instalação..." : "Digite o medidor..."}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pl-5 pr-14 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all font-semibold text-slate-800 text-sm"
            />
            <button 
              onClick={handleSearch}
              disabled={loading || !searchValue}
              className="absolute right-2 top-2 bottom-2 px-4 bg-slate-900 text-white rounded-lg flex items-center justify-center hover:bg-blue-600 transition-all disabled:opacity-20"
            >
              <Search size={16} />
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
          <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest">Consultando...</p>
        </div>
      )}

      {hasSearched && !loading && results.length === 0 && !errorMsg && (
        <div className="bg-white p-20 rounded-3xl text-center border-2 border-dashed border-slate-100">
          <p className="text-slate-300 font-bold text-xs uppercase">Nenhum registro localizado</p>
        </div>
      )}

      {results.length > 0 && !loading && (
        <div className="space-y-8">
          {/* RESULTS TABLE */}
          <section className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-8 py-6 border-b border-slate-50 flex items-center justify-between">
               <h3 className="text-xs font-bold text-slate-800 uppercase tracking-tight flex items-center gap-2">
                  <LayoutList size={18} className="text-blue-600" />
                  Relatório Técnico
               </h3>
               <span className="text-[9px] font-bold bg-blue-50 text-blue-600 px-3 py-1 rounded-full">
                  {results.length} registros
               </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[10px] text-left">
                <thead className="bg-slate-50 text-slate-400 uppercase font-bold tracking-wider">
                  <tr>
                    <th className="px-6 py-4">MÊS</th>
                    <th className="px-6 py-4">ANO</th>
                    <th className="px-6 py-4">UL</th>
                    <th className="px-6 py-4">INSTALAÇÃO</th>
                    <th className="px-6 py-4">MEDIDOR</th>
                    <th className="px-6 py-4">REG</th>
                    <th className="px-6 py-4">MATR</th>
                    <th className="px-6 py-4">COD</th>
                    <th className="px-6 py-4">LEITURA</th>
                    <th className="px-6 py-4">CONSUMO</th>
                    <th className="px-6 py-4">DIG</th>
                    <th className="px-6 py-4">NOSB.IMP</th>
                    <th className="px-6 py-4">NOSB.SIM</th>
                    <th className="px-6 py-4">CNA</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {sortedResults.map((r, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-3 font-bold uppercase">{r.Mes}</td>
                      <td className="px-6 py-3">{r.Ano}</td>
                      <td className="px-6 py-3">{r.rz_ul_lv}</td>
                      <td className="px-6 py-3 font-semibold">{r.instalacao}</td>
                      <td className="px-6 py-3 font-mono">{r.medidor}</td>
                      <td className="px-6 py-3">{r.reg}</td>
                      <td className="px-6 py-3">{r.matr}</td>
                      <td className="px-6 py-3">
                         <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${IMPEDIMENTO_CODES.includes(String(r.nl)) ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                           {r.nl}
                         </span>
                      </td>
                      <td className="px-6 py-3 font-bold">{r.l_atual}</td>
                      <td className="px-6 py-3 font-bold text-blue-600">{r.consumo}</td>
                      <td className="px-6 py-3 text-slate-400 text-[9px]">{r.digitacao}</td>
                      <td className="px-6 py-3">{r.nosb_impedimento}</td>
                      <td className="px-6 py-3">{r.nosb_simulacao}</td>
                      <td className="px-6 py-3">{r.cna}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* COD HISTORY */}
            <section className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
              <h3 className="text-[11px] font-bold text-slate-800 uppercase tracking-tight mb-6 flex items-center gap-2">
                <History size={16} className="text-blue-600" />
                Histórico de Ocorrências (COD)
              </h3>
              <div className="overflow-y-auto max-h-[300px]">
                <table className="w-full text-[10px]">
                  <thead className="text-slate-400 border-b">
                    <tr>
                      <th className="text-left py-2">COD</th>
                      <th className="text-right py-2">QTD</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
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

            {/* CONSUMPTION CHART */}
            <section className="lg:col-span-2 bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
              <h3 className="text-[11px] font-bold text-slate-800 uppercase tracking-tight mb-6 flex items-center gap-2">
                <TrendingUp size={16} className="text-blue-600" />
                Evolução de Consumo
              </h3>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={consumptionChartData}>
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
                    />
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

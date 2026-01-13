
import React, { useState, useMemo } from 'react';
import { supabase } from '../services/supabaseClient';
import { TABLE_NAME, MONTH_ORDER, IMPEDIMENTO_CODES } from '../constants';
import { LeituraRecord } from '../types';
import { Search, Hash, Cpu, History, TrendingUp, AlertCircle } from 'lucide-react';
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
        throw new Error(error.message || `Erro ao consultar ${searchType}.`);
      }
      setResults(data as LeituraRecord[] || []);
    } catch (err: any) {
      console.error("Search error:", err);
      setErrorMsg(err.message || 'Erro na comunicação com o banco de dados.');
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const sortedResults = useMemo(() => {
    return [...results].sort((a, b) => {
      if (a.Ano !== b.Ano) return (a.Ano || 0) - (b.Ano || 0);
      return (MONTH_ORDER[a.mes] || 0) - (MONTH_ORDER[b.mes] || 0);
    });
  }, [results]);

  const historyByCod = useMemo(() => {
    const counts: Record<string, number> = {};
    results.forEach(r => {
      const cod = String(r.nl);
      counts[cod] = (counts[cod] || 0) + 1;
    });
    return Object.entries(counts).map(([cod, qtd]) => ({ cod, qtd }));
  }, [results]);

  const consumptionChartData = useMemo(() => {
    return sortedResults.map(r => ({
      label: `${r.mes}/${r.Ano}`,
      consumo: r.consumo || 0,
      timestamp: (r.Ano * 100) + (MONTH_ORDER[r.mes] || 0)
    }));
  }, [sortedResults]);

  return (
    <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
      {/* Search Bar */}
      <section className="bg-white p-8 rounded-xl shadow-sm border border-slate-100">
        <div className="flex flex-col md:flex-row items-center gap-4">
          <div className="flex bg-slate-100 p-1 rounded-lg">
            <button 
              onClick={() => { setSearchType('instalacao'); setHasSearched(false); setResults([]); }}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-all ${searchType === 'instalacao' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <Hash size={16} />
              Instalação
            </button>
            <button 
              onClick={() => { setSearchType('medidor'); setHasSearched(false); setResults([]); }}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-all ${searchType === 'medidor' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <Cpu size={16} />
              Medidor
            </button>
          </div>
          
          <div className="flex-1 relative w-full">
            <input 
              type="text"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder={searchType === 'instalacao' ? "Digite o número da instalação..." : "Digite o número do medidor..."}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg py-3 pl-4 pr-12 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
            />
            <button 
              onClick={handleSearch}
              disabled={loading}
              className="absolute right-2 top-2 h-8 w-8 bg-blue-600 text-white rounded-md flex items-center justify-center hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              <Search size={18} />
            </button>
          </div>
        </div>

        {errorMsg && (
          <div className="mt-4 p-4 bg-red-50 border border-red-100 rounded-lg flex items-center gap-3 text-red-700 text-sm">
            <AlertCircle size={18} />
            <p>{errorMsg}</p>
          </div>
        )}
      </section>

      {loading && (
        <div className="flex flex-col items-center justify-center p-12 gap-3">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
          <p className="text-slate-500 font-medium italic">Consultando base de dados...</p>
        </div>
      )}

      {hasSearched && !loading && results.length === 0 && !errorMsg && (
        <div className="bg-white p-12 rounded-xl text-center border border-dashed border-slate-300">
          <p className="text-slate-500">Nenhum registro encontrado para esta pesquisa.</p>
        </div>
      )}

      {results.length > 0 && !loading && (
        <>
          <section className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-slate-600 uppercase text-[10px] font-bold tracking-widest border-b">
                  <tr>
                    <th className="px-4 py-3">MES</th>
                    <th className="px-4 py-3">ANO</th>
                    <th className="px-4 py-3">UL</th>
                    <th className="px-4 py-3">INSTAL.</th>
                    <th className="px-4 py-3">MEDIDOR</th>
                    <th className="px-4 py-3">REG</th>
                    <th className="px-4 py-3">MATR</th>
                    <th className="px-4 py-3">COD</th>
                    <th className="px-4 py-3">LEITURA</th>
                    <th className="px-4 py-3">CONS.</th>
                    <th className="px-4 py-3">DIG</th>
                    <th className="px-4 py-3">NOSB.IMP</th>
                    <th className="px-4 py-3">NOSB.SIM</th>
                    <th className="px-4 py-3">CNA</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sortedResults.map((r, idx) => (
                    <tr key={idx} className="hover:bg-blue-50/30 transition-colors">
                      <td className="px-4 py-3 font-medium text-slate-900">{r.mes}</td>
                      <td className="px-4 py-3 text-slate-600">{r.Ano}</td>
                      <td className="px-4 py-3 text-slate-500">{r.rz_ul_lv}</td>
                      <td className="px-4 py-3 text-slate-800">{r.instalacao}</td>
                      <td className="px-4 py-3 text-slate-600 font-mono">{r.medidor}</td>
                      <td className="px-4 py-3 text-slate-500">{r.reg}</td>
                      <td className="px-4 py-3 text-slate-500">{r.matr}</td>
                      <td className="px-4 py-3">
                         <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${IMPEDIMENTO_CODES.includes(String(r.nl)) ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                           {r.nl}
                         </span>
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-800">{r.l_atual}</td>
                      <td className="px-4 py-3 font-semibold text-blue-600">{r.consumo}</td>
                      <td className="px-4 py-3 text-slate-400 italic">{r.digitacao}</td>
                      <td className="px-4 py-3 text-slate-500">{r.nosb_impedimento}</td>
                      <td className="px-4 py-3 text-slate-500">{r.nosb_simulacao}</td>
                      <td className="px-4 py-3 text-slate-500">{r.cna}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <section className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
              <div className="flex items-center gap-2 mb-6 text-blue-900 font-bold uppercase tracking-tight">
                <History size={18} />
                <h3>Histórico por Código (COD)</h3>
              </div>
              <div className="overflow-y-auto max-h-[300px]">
                <table className="w-full text-sm">
                  <thead className="text-slate-400 border-b">
                    <tr>
                      <th className="text-left py-2 font-medium">COD</th>
                      <th className="text-right py-2 font-medium">QTD</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {historyByCod.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="py-3 font-mono text-blue-600">{item.cod}</td>
                        <td className="py-3 text-right font-bold text-slate-700">{item.qtd}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
              <div className="flex items-center gap-2 mb-6 text-blue-900 font-bold uppercase tracking-tight">
                <TrendingUp size={18} />
                <h3>Progressão de Consumo</h3>
              </div>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={consumptionChartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 10}} />
                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 10}} />
                    <Tooltip 
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                    />
                    <Legend verticalAlign="top" height={36}/>
                    <Line 
                      name="Consumo"
                      type="monotone" 
                      dataKey="consumo" 
                      stroke="#3b82f6" 
                      strokeWidth={3}
                      dot={{ r: 4, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff' }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  );
};

export default TechnicalSearch;


import React, { useState, useMemo } from 'react';
import { supabase } from '../services/supabaseClient';
import { TABLE_NAME, MONTH_ORDER, IMPEDIMENTO_CODES } from '../constants';
import { LeituraRecord } from '../types';
import { Search, Hash, Cpu, History, TrendingUp, AlertCircle, Database, LayoutList } from 'lucide-react';
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
    // Ordem: Ano crescente, Mês cronológico
    return [...results].sort((a, b) => {
      if (parseInt(String(a.Ano)) !== parseInt(String(b.Ano))) {
        return parseInt(String(a.Ano)) - parseInt(String(b.Ano));
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
      consumo: r.consumo || 0
    }));
  }, [sortedResults]);

  return (
    <div className="space-y-10 animate-in fade-in duration-500">
      {/* Search Bar - Professional Design */}
      <section className="bg-white p-10 rounded-[32px] shadow-sm border border-slate-200">
        <div className="flex flex-col md:flex-row items-stretch gap-6">
          <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200 self-start md:self-auto">
            <button 
              onClick={() => { setSearchType('instalacao'); setHasSearched(false); setResults([]); }}
              className={`flex items-center gap-2 px-6 py-3 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${searchType === 'instalacao' ? 'bg-white text-blue-600 shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <Hash size={14} />
              Instalação
            </button>
            <button 
              onClick={() => { setSearchType('medidor'); setHasSearched(false); setResults([]); }}
              className={`flex items-center gap-2 px-6 py-3 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${searchType === 'medidor' ? 'bg-white text-blue-600 shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <Cpu size={14} />
              Medidor
            </button>
          </div>
          
          <div className="flex-1 relative">
            <input 
              type="text"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder={searchType === 'instalacao' ? "Digite o número da instalação para buscar..." : "Digite o número do medidor para buscar..."}
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 pl-6 pr-16 focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all font-bold text-slate-800"
            />
            <button 
              onClick={handleSearch}
              disabled={loading || !searchValue}
              className="absolute right-3 top-2 bottom-2 px-6 bg-slate-900 text-white rounded-xl flex items-center justify-center hover:bg-blue-600 transition-all shadow-lg disabled:opacity-20"
            >
              <Search size={18} />
            </button>
          </div>
        </div>

        {errorMsg && (
          <div className="mt-6 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-700 text-xs font-bold uppercase tracking-wider">
            <AlertCircle size={18} />
            <p>{errorMsg}</p>
          </div>
        )}
      </section>

      {loading && (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-slate-100 border-t-blue-600"></div>
          <p className="text-slate-400 font-black text-xs uppercase tracking-widest">Acessando base de dados...</p>
        </div>
      )}

      {hasSearched && !loading && results.length === 0 && !errorMsg && (
        <div className="bg-white p-24 rounded-[32px] text-center border-2 border-dashed border-slate-100">
          <div className="bg-slate-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
             <Search size={32} className="text-slate-200" />
          </div>
          <h3 className="text-xl font-black text-slate-300 uppercase tracking-tighter">Nenhum Registro Encontrado</h3>
          <p className="text-slate-400 text-sm mt-2">Tente buscar por outro número de instalação ou medidor.</p>
        </div>
      )}

      {results.length > 0 && !loading && (
        <>
          {/* Tabela de Resultados */}
          <section className="bg-white rounded-[32px] shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-10 py-8 border-b border-slate-50 flex items-center justify-between">
               <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight flex items-center gap-3">
                  <LayoutList className="text-blue-600" />
                  Dados da Instalação
               </h3>
               <span className="text-[10px] font-black bg-blue-50 text-blue-600 px-4 py-2 rounded-full border border-blue-100">
                  {results.length} Registros Encontrados
               </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-400 uppercase text-[9px] font-black tracking-[0.15em]">
                  <tr>
                    <th className="px-6 py-5">MÊS</th>
                    <th className="px-6 py-5">ANO</th>
                    <th className="px-6 py-5">UL</th>
                    <th className="px-6 py-5">INSTALAÇÃO</th>
                    <th className="px-6 py-5">MEDIDOR</th>
                    <th className="px-6 py-5">REG</th>
                    <th className="px-6 py-5">MATR</th>
                    <th className="px-6 py-5">COD</th>
                    <th className="px-6 py-5">LEITURA</th>
                    <th className="px-6 py-5">CONSUMO</th>
                    <th className="px-6 py-5">DIG</th>
                    <th className="px-6 py-5">NOSB.IMP</th>
                    <th className="px-6 py-5">NOSB.SIM</th>
                    <th className="px-6 py-5">CNA</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sortedResults.map((r, idx) => (
                    <tr key={idx} className="hover:bg-blue-50/20 transition-colors group">
                      <td className="px-6 py-4 font-black text-slate-900 uppercase">{r.Mes}</td>
                      <td className="px-6 py-4 font-bold text-slate-500">{r.Ano}</td>
                      <td className="px-6 py-4 text-slate-500">{r.rz_ul_lv}</td>
                      <td className="px-6 py-4 text-slate-800 font-bold">{r.instalacao}</td>
                      <td className="px-6 py-4 text-slate-600 font-mono text-[10px]">{r.medidor}</td>
                      <td className="px-6 py-4 text-slate-500">{r.reg}</td>
                      <td className="px-6 py-4 text-slate-500">{r.matr}</td>
                      <td className="px-6 py-4">
                         <span className={`px-2.5 py-1 rounded-md text-[9px] font-black ${IMPEDIMENTO_CODES.includes(String(r.nl)) ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-green-50 text-green-600 border border-green-100'}`}>
                           {r.nl}
                         </span>
                      </td>
                      <td className="px-6 py-4 font-black text-slate-800">{r.l_atual}</td>
                      <td className="px-6 py-4 font-black text-blue-600">{r.consumo}</td>
                      <td className="px-6 py-4 text-slate-400 italic text-[10px]">{r.digitacao}</td>
                      <td className="px-6 py-4 text-slate-500">{r.nosb_impedimento}</td>
                      <td className="px-6 py-4 text-slate-500">{r.nosb_simulacao}</td>
                      <td className="px-6 py-4 text-slate-500">{r.cna}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Gráficos Secundários */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
            <section className="lg:col-span-1 bg-white p-10 rounded-[32px] shadow-sm border border-slate-200">
              <div className="flex items-center gap-3 mb-8 border-b border-slate-50 pb-6">
                <History size={18} className="text-blue-600" />
                <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Frequência COD</h3>
              </div>
              <div className="overflow-y-auto max-h-[400px] custom-scrollbar pr-2">
                <table className="w-full text-xs">
                  <thead className="text-[10px] font-black text-slate-400 uppercase border-b">
                    <tr>
                      <th className="text-left py-4 tracking-widest">CÓDIGO (COD)</th>
                      <th className="text-right py-4 tracking-widest">QTD</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {historyByCod.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 transition-colors">
                        <td className="py-4">
                           <span className="font-mono text-blue-600 font-black">{item.cod}</span>
                        </td>
                        <td className="py-4 text-right">
                           <span className="bg-slate-100 text-slate-800 px-3 py-1 rounded-lg font-black">{item.qtd}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="lg:col-span-2 bg-white p-10 rounded-[32px] shadow-sm border border-slate-200">
              <div className="flex items-center gap-3 mb-8 border-b border-slate-50 pb-6">
                <TrendingUp size={18} className="text-blue-600" />
                <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Progressão de Consumo</h3>
              </div>
              <div className="h-[400px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={consumptionChartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 'bold'}} />
                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10}} />
                    <Tooltip 
                      contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', fontWeight: 'black' }}
                    />
                    <Legend verticalAlign="top" align="right" height={40} iconType="circle" wrapperStyle={{fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase'}} />
                    <Line 
                      name="Volume de Consumo"
                      type="monotone" 
                      dataKey="consumo" 
                      stroke="#2563eb" 
                      strokeWidth={4}
                      dot={{ r: 6, fill: '#2563eb', strokeWidth: 3, stroke: '#fff' }}
                      activeDot={{ r: 8, strokeWidth: 0 }}
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

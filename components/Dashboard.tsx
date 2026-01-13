
import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../services/supabaseClient';
import { TABLE_NAME, IMPEDIMENTO_CODES, MONTH_ORDER } from '../constants';
import { LeituraRecord, FilterState } from '../types';
import IndicatorCard from './IndicatorCard';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { FileText, XCircle, CheckCircle, AlertTriangle, Filter, Layout, RefreshCw, AlertCircle } from 'lucide-react';

const Dashboard: React.FC = () => {
  const [data, setData] = useState<LeituraRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [availableFilters, setAvailableFilters] = useState<FilterState>({ anos: [], meses: [], razoes: [] });
  const [selectedFilters, setSelectedFilters] = useState({
    anos: [] as string[],
    meses: [] as string[],
    razoes: [] as string[]
  });

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const { data: records, error } = await supabase.from(TABLE_NAME).select('*');
      
      if (error) {
        throw new Error(error.message || 'Erro desconhecido ao buscar dados do Supabase.');
      }

      if (records) {
        const typedRecords = records as LeituraRecord[];
        setData(typedRecords);

        const anos = Array.from(new Set(typedRecords.map(r => r.Ano?.toString())))
          .filter((a): a is string => Boolean(a))
          .sort();

        const meses = Array.from(new Set(typedRecords.map(r => r.mes)))
          .filter((m): m is string => Boolean(m))
          .sort((a, b) => (MONTH_ORDER[a] || 0) - (MONTH_ORDER[b] || 0));

        const razoes = Array.from(new Set(typedRecords.map(r => r.rz)))
          .filter((rz): rz is string => Boolean(rz))
          .sort();

        setAvailableFilters({ anos, meses, razoes });
        
        if (anos.length > 0) setSelectedFilters(prev => ({ ...prev, anos: [anos[anos.length - 1]] }));
        if (meses.length > 0) setSelectedFilters(prev => ({ ...prev, meses: meses }));
        if (razoes.length > 0) setSelectedFilters(prev => ({ ...prev, razoes: razoes }));
      }
    } catch (err: any) {
      console.error("Error fetching data:", err);
      setErrorMsg(err.message || 'Falha na conexão com o banco de dados.');
    } finally {
      setLoading(false);
    }
  };

  const filteredData = useMemo(() => {
    return data.filter(r => {
      const matchAno = selectedFilters.anos.length === 0 || selectedFilters.anos.includes(r.Ano?.toString());
      const matchMes = selectedFilters.meses.length === 0 || selectedFilters.meses.includes(r.mes);
      const matchRz = selectedFilters.razoes.length === 0 || selectedFilters.razoes.includes(r.rz);
      return matchAno && matchMes && matchRz;
    });
  }, [data, selectedFilters]);

  const metrics = useMemo(() => {
    const totalLeituras = filteredData.length;
    const naoRealizadas = filteredData.filter(r => IMPEDIMENTO_CODES.includes(String(r.nl))).length;
    const realizadas = totalLeituras - naoRealizadas;
    const percImpedimentos = realizadas > 0 ? (naoRealizadas / realizadas) * 100 : 0;

    return { totalLeituras, naoRealizadas, realizadas, percImpedimentos };
  }, [filteredData]);

  const chartData = useMemo(() => {
    const timeMap: Record<string, any> = {};
    
    filteredData.forEach(r => {
      const key = `${r.mes} ${r.Ano}`;
      if (!timeMap[key]) {
        timeMap[key] = { label: key, totalImpedimentos: 0, sortKey: (r.Ano * 100) + (MONTH_ORDER[r.mes] || 0) };
      }
      if (IMPEDIMENTO_CODES.includes(String(r.nl))) {
        timeMap[key].totalImpedimentos++;
      }
    });

    return Object.values(timeMap).sort((a, b) => a.sortKey - b.sortKey);
  }, [filteredData]);

  const tipoGroups = useMemo(() => {
    const groups: Record<string, { tipo: string, total: number, nr: number, r: number, perc: number }> = {};
    filteredData.forEach(r => {
      const t = r.tipo || 'OUTROS';
      if (!groups[t]) groups[t] = { tipo: t, total: 0, nr: 0, r: 0, perc: 0 };
      groups[t].total++;
      if (IMPEDIMENTO_CODES.includes(String(r.nl))) groups[t].nr++;
    });

    return Object.values(groups).map(g => {
      const r = g.total - g.nr;
      const perc = r > 0 ? (g.nr / r) * 100 : 0;
      return { ...g, r, perc };
    });
  }, [filteredData]);

  const handleFilterChange = (key: keyof typeof selectedFilters, value: string) => {
    setSelectedFilters(prev => {
      const current = prev[key];
      const next = current.includes(value) 
        ? current.filter(v => v !== value) 
        : [...current, value];
      return { ...prev, [key]: next };
    });
  };

  if (loading) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <p className="text-slate-500 font-medium">Carregando indicadores...</p>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 text-center bg-white rounded-2xl shadow-sm border border-red-100">
        <AlertCircle size={48} className="text-red-500 mb-4" />
        <h2 className="text-xl font-bold text-slate-800 mb-2">Erro ao carregar dados</h2>
        <p className="text-slate-500 mb-6 max-w-md">{errorMsg}</p>
        <button 
          onClick={fetchInitialData}
          className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-lg shadow-blue-100"
        >
          <RefreshCw size={18} />
          Tentar Novamente
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      {/* Global Filters */}
      <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <div className="flex items-center gap-2 mb-6 text-blue-900 font-bold border-b pb-4">
          <Filter size={20} />
          <h2 className="text-lg">Filtros Obrigatórios</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 block">Ano</label>
            <div className="flex flex-wrap gap-2">
              {availableFilters.anos.map(ano => (
                <button
                  key={ano}
                  onClick={() => handleFilterChange('anos', ano)}
                  className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${
                    selectedFilters.anos.includes(ano) 
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' 
                      : 'bg-slate-50 text-slate-500 border border-slate-100 hover:bg-slate-100'
                  }`}
                >
                  {ano}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 block">Mês</label>
            <div className="flex flex-wrap gap-2">
              {availableFilters.meses.map(mes => (
                <button
                  key={mes}
                  onClick={() => handleFilterChange('meses', mes)}
                  className={`px-3 py-1 text-[10px] font-bold rounded-lg transition-all border ${
                    selectedFilters.meses.includes(mes) 
                      ? 'bg-blue-600 text-white border-blue-600' 
                      : 'bg-white text-slate-500 border-slate-200 hover:bg-blue-50'
                  }`}
                >
                  {mes}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 block">Razão</label>
            <div className="flex flex-wrap gap-2">
              {availableFilters.razoes.map(rz => (
                <button
                  key={rz}
                  onClick={() => handleFilterChange('razoes', rz)}
                  className={`px-3 py-1 text-[10px] font-bold rounded-lg transition-all border ${
                    selectedFilters.razoes.includes(rz) 
                      ? 'bg-blue-600 text-white border-blue-600' 
                      : 'bg-white text-slate-500 border-slate-200 hover:bg-blue-50'
                  }`}
                >
                  {rz}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Main KPIs */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <IndicatorCard label="Leituras a Realizar" value={metrics.totalLeituras.toLocaleString()} icon={<FileText />} color="blue" />
        <IndicatorCard label="Leituras Não Realizadas" value={metrics.naoRealizadas.toLocaleString()} icon={<XCircle />} color="red" />
        <IndicatorCard label="Leituras Realizadas" value={metrics.realizadas.toLocaleString()} icon={<CheckCircle />} color="green" />
        <IndicatorCard label="% Impedimentos" value={metrics.percImpedimentos.toFixed(2)} suffix="%" icon={<AlertTriangle />} color="amber" />
      </section>

      {/* Analytical Chart */}
      <section className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100">
        <div className="mb-6 flex items-center justify-between">
          <h3 className="text-slate-800 font-bold text-xl tracking-tight">Impedimentos por Mês e Ano</h3>
          <span className="text-xs text-slate-400 font-medium">Análise Comparativa Temporal</span>
        </div>
        <div className="h-[350px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 11}} />
              <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 11}} />
              <Tooltip 
                contentStyle={{ border: 'none', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
              />
              <Legend verticalAlign="top" align="right" />
              <Bar name="Qtd. Impedimentos" dataKey="totalImpedimentos" fill="#3b82f6" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Groups by Tipo */}
      <div className="space-y-6">
        <div className="flex items-center gap-2 text-slate-700 font-bold">
          <Layout size={20} />
          <h3>Resumo por Tipo de Instalação</h3>
        </div>
        {tipoGroups.map((group, idx) => (
          <div key={idx} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 transition-all hover:shadow-md">
             <div className="flex items-center justify-between mb-6">
               <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest">{group.tipo}</span>
               <div className="h-px flex-1 mx-4 bg-slate-100" />
               <span className="text-xs font-bold text-slate-400">STATUS DO TIPO</span>
             </div>
             <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Total Leituras</p>
                  <p className="text-2xl font-bold text-slate-800">{group.total.toLocaleString()}</p>
                </div>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col gap-2">
                   <div className="flex justify-between items-end">
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Não Realizadas</p>
                        <p className="text-xl font-bold text-red-600">{group.nr.toLocaleString()}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Realizadas</p>
                        <p className="text-xl font-bold text-green-600">{group.r.toLocaleString()}</p>
                      </div>
                   </div>
                   <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden flex">
                      <div 
                        className="bg-red-500 h-full" 
                        style={{ width: `${(group.nr / (group.total || 1)) * 100}%` }} 
                      />
                      <div 
                        className="bg-green-500 h-full" 
                        style={{ width: `${(group.r / (group.total || 1)) * 100}%` }} 
                      />
                   </div>
                </div>
                <div className="bg-blue-600 p-4 rounded-xl border border-blue-500 shadow-lg shadow-blue-100 text-white">
                  <p className="text-[10px] font-bold text-blue-200 uppercase mb-1">% Impedimentos</p>
                  <p className="text-3xl font-black">{group.perc.toFixed(2)}%</p>
                </div>
             </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Dashboard;

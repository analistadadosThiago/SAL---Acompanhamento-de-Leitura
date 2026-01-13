
import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../services/supabaseClient';
import { MONTH_ORDER } from '../constants';
import { FilterState } from '../types';
import IndicatorCard from './IndicatorCard';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { FileText, XCircle, CheckCircle, AlertTriangle, Filter, Layout, RefreshCw, AlertCircle, Play, ChevronDown, Check, Database, TrendingUp } from 'lucide-react';

const VIEW_ANOS = "v_anos";
const VIEW_MESES = "v_meses";
const VIEW_RAZOES = "v_razoes";

interface MultiSelectProps {
  label: string;
  options: string[];
  selected: string[];
  onToggle: (value: string) => void;
  placeholder: string;
}

const MultiSelectDropdown: React.FC<MultiSelectProps> = ({ label, options, selected, onToggle, placeholder }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="flex flex-col w-full relative" ref={dropdownRef}>
      <label className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3 flex justify-between items-center px-1">
        {label}
        {selected.length > 0 && (
          <span className="bg-blue-600 text-white px-2 py-0.5 rounded-md text-[9px] shadow-lg shadow-blue-200">
            {selected.length} selecionados
          </span>
        )}
      </label>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center justify-between w-full px-5 py-4 bg-white border rounded-2xl text-sm transition-all duration-300 shadow-sm ${
          isOpen ? 'border-blue-600 ring-4 ring-blue-50' : 'border-slate-200 hover:border-blue-400'
        } ${selected.length > 0 ? 'text-slate-900 font-bold' : 'text-slate-400'}`}
      >
        <span className="truncate pr-4 text-left">
          {selected.length > 0 ? selected.join(', ') : placeholder}
        </span>
        <ChevronDown size={18} className={`flex-shrink-0 text-slate-400 transition-transform duration-500 ${isOpen ? 'rotate-180 text-blue-600' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 z-[100] mt-3 bg-white border border-slate-100 rounded-2xl shadow-2xl max-h-80 overflow-hidden animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="p-3 overflow-y-auto max-h-80 custom-scrollbar">
            <div 
              onClick={() => {
                if (selected.length === options.length) {
                  options.forEach(o => onToggle(o));
                } else {
                  options.filter(o => !selected.includes(o)).forEach(o => onToggle(o));
                }
              }}
              className="flex items-center justify-between px-4 py-3 rounded-xl cursor-pointer hover:bg-slate-50 text-blue-600 font-bold text-xs uppercase mb-2 border border-blue-50"
            >
              {selected.length === options.length ? 'Desmarcar Todos' : 'Selecionar Todos'}
            </div>
            {options.map((option) => (
              <div
                key={option}
                onClick={() => onToggle(option)}
                className={`flex items-center justify-between px-4 py-3 rounded-xl cursor-pointer transition-all duration-200 mb-1 group ${
                  selected.includes(option) 
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' 
                    : 'hover:bg-slate-50 text-slate-600'
                }`}
              >
                <span className="text-sm font-bold">{option}</span>
                <div className={`w-5 h-5 rounded border flex items-center justify-center transition-all ${
                  selected.includes(option) ? 'bg-white border-white text-blue-600' : 'border-slate-200 bg-slate-50'
                }`}>
                  {selected.includes(option) && <Check size={14} strokeWidth={4} />}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

interface Indicators {
  leituras_a_realizar: number;
  leituras_nao_realizadas: number;
  leituras_realizadas: number;
  percentual_impedimentos: number;
}

interface ChartData {
  label: string;
  value: number;
}

interface CardType {
  tipo: string;
  total: number;
  nr: number;
  r: number;
  perc: number;
}

const Dashboard: React.FC = () => {
  const [indicators, setIndicators] = useState<Indicators | null>(null);
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [cards, setCards] = useState<CardType[]>([]);
  
  const [loading, setLoading] = useState(false);
  const [fetchingMetadata, setFetchingMetadata] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isReportGenerated, setIsReportGenerated] = useState(false);
  
  const [availableFilters, setAvailableFilters] = useState<FilterState>({ 
    anos: [], meses: [], razoes: [] 
  });
  
  const [selectedFilters, setSelectedFilters] = useState({
    anos: [] as string[], meses: [] as string[], razoes: [] as string[]
  });

  const fetchFilters = async () => {
    try {
      setFetchingMetadata(true);
      setErrorMsg(null);

      const [anoRes, mesRes, rzRes] = await Promise.all([
        supabase.from(VIEW_ANOS).select('Ano').order('Ano', { ascending: true }),
        supabase.from(VIEW_MESES).select('Mes'),
        supabase.from(VIEW_RAZOES).select('rz').order('rz', { ascending: true })
      ]);

      if (anoRes.error || mesRes.error || rzRes.error) {
        throw new Error("Erro ao carregar metadados dos filtros.");
      }

      // Explicitly type mapped results to string and use type guards in filter to ensure correct inference for sort
      const anos = Array.from(new Set((anoRes.data || []).map((r: any) => String(r.Ano))))
        .filter((v): v is string => !!v);

      const meses = Array.from(new Set((mesRes.data || []).map((r: any) => String(r.Mes))))
        .filter((v): v is string => !!v)
        .sort((a: string, b: string) => (MONTH_ORDER[a.toUpperCase()] || 0) - (MONTH_ORDER[b.toUpperCase()] || 0));

      const razoes = Array.from(new Set((rzRes.data || []).map((r: any) => String(r.rz))))
        .filter((v): v is string => !!v);

      setAvailableFilters({ anos, meses, razoes });
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setFetchingMetadata(false);
    }
  };

  useEffect(() => { fetchFilters(); }, []);

  const handleGenerateReport = async () => {
    if (selectedFilters.anos.length === 0 || selectedFilters.meses.length === 0 || selectedFilters.razoes.length === 0) {
      setErrorMsg("Selecione pelo menos um valor em cada filtro.");
      return;
    }
    
    try {
      setLoading(true);
      setErrorMsg(null);
      setIsReportGenerated(false);

      const params = {
        p_anos: selectedFilters.anos,
        p_meses: selectedFilters.meses,
        p_razoes: selectedFilters.razoes
      };

      // Chamada RPC para Indicadores (calculado no backend)
      const { data: indData, error: indError } = await supabase.rpc('rpc_indicadores_inicio', params);
      if (indError) throw indError;

      // Chamada RPC para Gráfico
      const { data: gData, error: gError } = await supabase.rpc('rpc_grafico_mes_a_mes', params);
      if (gError) throw gError;

      // Chamada RPC para Cards
      const { data: cData, error: cError } = await supabase.rpc('rpc_cards_por_tipo', params);
      if (cError) throw cError;

      setIndicators(indData);
      setChartData(gData || []);
      setCards(cData || []);
      setIsReportGenerated(true);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Erro ao gerar o relatório.");
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = (key: keyof typeof selectedFilters, value: string) => {
    setSelectedFilters(prev => {
      const current = prev[key];
      const next = current.includes(value) ? current.filter(v => v !== value) : [...current, value];
      return { ...prev, [key]: next };
    });
  };

  if (fetchingMetadata) {
    return (
      <div className="flex h-[50vh] flex-col items-center justify-center gap-6">
        <div className="h-14 w-14 rounded-full border-4 border-slate-200 border-t-blue-600 animate-spin"></div>
        <p className="text-slate-400 font-bold text-xs uppercase tracking-[0.2em]">Conectando à base de dados...</p>
      </div>
    );
  }

  return (
    <div className="space-y-12 animate-in fade-in duration-500">
      {/* SEÇÃO DE FILTROS GLOBAIS */}
      <section className="bg-white p-10 rounded-[32px] shadow-sm border border-slate-200">
        <div className="flex items-center gap-3 mb-10 pb-6 border-b border-slate-50">
          <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl"><Filter size={20} /></div>
          <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">Filtros Operacionais</h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <MultiSelectDropdown label="Selecione o Ano" options={availableFilters.anos} selected={selectedFilters.anos} onToggle={(v) => handleToggle('anos', v)} placeholder="Selecione o(s) Ano(s)" />
          <MultiSelectDropdown label="Selecione o Mês" options={availableFilters.meses} selected={selectedFilters.meses} onToggle={(v) => handleToggle('meses', v)} placeholder="Selecione o(s) Mês(es)" />
          <MultiSelectDropdown label="Selecione o Razão" options={availableFilters.razoes} selected={selectedFilters.razoes} onToggle={(v) => handleToggle('razoes', v)} placeholder="Selecione a(s) Razão(ões)" />
        </div>

        <div className="mt-12 flex justify-center">
          <button
            onClick={handleGenerateReport}
            disabled={loading}
            className={`flex items-center gap-4 px-16 py-5 rounded-2xl font-black text-lg transition-all shadow-xl ${
                !loading ? 'bg-slate-900 text-white hover:bg-blue-600 hover:scale-[1.02] active:scale-[0.98]' : 'bg-slate-100 text-slate-400 cursor-not-allowed'
            }`}
          >
            {loading ? <RefreshCw className="animate-spin" size={24} /> : <><Play size={20} fill="currentColor" /> GERAR RELATÓRIO</>}
          </button>
        </div>

        {errorMsg && (
          <div className="mt-8 p-4 bg-red-50 border border-red-100 rounded-xl text-red-600 text-xs font-bold uppercase text-center">
            {errorMsg}
          </div>
        )}
      </section>

      {/* ÁREA DE RESULTADOS */}
      {isReportGenerated && indicators && (
        <div className="space-y-12 animate-in slide-in-from-bottom-8 duration-700">
          {/* Indicadores de Topo */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <IndicatorCard label="Leituras a Realizar" value={indicators.leituras_a_realizar.toLocaleString()} icon={<FileText size={24} />} color="blue" />
            <IndicatorCard label="Leituras Não Realizadas" value={indicators.leituras_nao_realizadas.toLocaleString()} icon={<XCircle size={24} />} color="red" />
            <IndicatorCard label="Leituras Realizadas" value={indicators.leituras_realizadas.toLocaleString()} icon={<CheckCircle size={24} />} color="green" />
            <IndicatorCard label="% Impedimentos" value={indicators.percentual_impedimentos.toFixed(2)} suffix="%" icon={<AlertTriangle size={24} />} color="amber" />
          </div>

          {/* Gráfico Principal */}
          {chartData.length > 0 && (
            <section className="bg-white p-10 rounded-[32px] shadow-sm border border-slate-200">
              <div className="flex items-center justify-between mb-10">
                <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight flex items-center gap-3">
                    <TrendingUp className="text-blue-600" />
                    Impedimentos Mês a Mês
                </h3>
              </div>
              <div className="h-[400px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 'bold'}} />
                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10}} />
                    <Tooltip 
                      cursor={{fill: '#f8fafc'}} 
                      contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', fontWeight: 'bold' }} 
                    />
                    <Bar dataKey="value" name="Impedimentos" fill="#1e293b" radius={[6, 6, 0, 0]} barSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>
          )}

          {/* Cards por Tipo */}
          {cards.length > 0 && (
            <div className="space-y-8">
              <div className="flex items-center gap-3">
                <div className="h-8 w-1.5 bg-blue-600 rounded-full"></div>
                <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Indicadores por Tipo</h3>
              </div>
              <div className="grid grid-cols-1 gap-8">
                {cards.map((card, idx) => (
                  <div key={idx} className="bg-white rounded-[32px] p-8 shadow-sm border border-slate-200 transition-all hover:border-blue-200">
                    <div className="mb-8 flex items-center justify-between">
                      <span className="bg-slate-900 text-white px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest">
                        {card.tipo}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                      <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
                        <p className="text-[10px] font-bold text-slate-400 uppercase mb-2 tracking-widest">Leituras</p>
                        <p className="text-3xl font-black text-slate-900">{card.total.toLocaleString()}</p>
                      </div>
                      <div className="p-6 bg-red-50/50 rounded-2xl border border-red-100">
                        <p className="text-[10px] font-bold text-red-400 uppercase mb-2 tracking-widest">Não Realizadas</p>
                        <p className="text-3xl font-black text-red-600">{card.nr.toLocaleString()}</p>
                      </div>
                      <div className="p-6 bg-green-50/50 rounded-2xl border border-green-100">
                        <p className="text-[10px] font-bold text-green-500 uppercase mb-2 tracking-widest">Realizadas</p>
                        <p className="text-3xl font-black text-green-700">{card.r.toLocaleString()}</p>
                      </div>
                      <div className="p-6 bg-slate-900 rounded-2xl text-white shadow-xl shadow-slate-200 flex flex-col justify-center">
                        <p className="text-[10px] font-bold text-slate-400 uppercase mb-1 tracking-widest">% Impedimento</p>
                        <p className="text-4xl font-black">{card.perc.toFixed(2)}%</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ESTADO INICIAL / VAZIO */}
      {!isReportGenerated && !loading && (
        <div className="flex flex-col items-center justify-center py-40 bg-white rounded-[32px] border border-dashed border-slate-200 text-center">
          <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6">
            <Layout size={32} className="text-slate-300" />
          </div>
          <h3 className="text-2xl font-black text-slate-300 uppercase tracking-tighter">Relatório Pronto para Gerar</h3>
          <p className="text-slate-400 font-medium text-sm mt-3 max-w-xs mx-auto uppercase tracking-widest">
            Selecione os parâmetros acima para visualizar os indicadores operacionais.
          </p>
        </div>
      )}

      {/* LOADER GLOBAL */}
      {loading && (
        <div className="fixed inset-0 z-[1000] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-white p-12 rounded-[40px] shadow-2xl flex flex-col items-center gap-6 text-center">
             <div className="relative h-20 w-20">
                <div className="absolute inset-0 rounded-full border-4 border-slate-100 border-t-blue-600 animate-spin"></div>
                <Database size={24} className="absolute inset-0 m-auto text-blue-600 animate-pulse" />
             </div>
             <div>
                <h2 className="text-xl font-black text-slate-900 uppercase">Processando Dados</h2>
                <p className="text-xs font-bold text-slate-400 mt-2 uppercase tracking-widest animate-pulse">Consultando 100% da base via RPC...</p>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;

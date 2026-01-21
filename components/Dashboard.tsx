
import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../services/supabaseClient';
import { FilterState } from '../types';
import IndicatorCard from './IndicatorCard';
import { TABLE_NAME, IMPEDIMENTO_CODES } from '../constants';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LabelList, Cell } from 'recharts';
import { FileText, XCircle, CheckCircle, AlertTriangle, Filter, Layout, RefreshCw, Play, ChevronDown, Check, Database, TrendingUp, Sparkles } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";

const VIEW_ANOS = "v_anos";
const VIEW_MESES = "v_meses";
const VIEW_RAZOES = "v_razoes";

const RPC_NAMES = {
  INDICADORES: 'rpc_indicadores_inicio',
  RELACAO_TIPO: 'rpc_relacao_por_tipo'
};

interface DropdownFilterProps {
  label: string;
  options: string[];
  selected: string | string[] | null;
  onToggle: (value: string | null) => void;
  placeholder: string;
  multiple?: boolean;
}

const DropdownFilter: React.FC<DropdownFilterProps> = ({ label, options, selected, onToggle, placeholder, multiple = false }) => {
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

  const isSelected = (option: string | null) => {
    if (multiple && Array.isArray(selected)) {
      return option !== null && selected.includes(option);
    }
    return selected === option;
  };

  const getSummary = () => {
    if (multiple && Array.isArray(selected)) {
      return selected.length > 0 ? `${selected.length} selecionados` : placeholder;
    }
    return selected ? String(selected) : "Selecionar Todos";
  };

  const getSelectedText = () => {
    if (multiple && Array.isArray(selected)) {
      return selected.length > 0 ? selected.join(', ') : 'Todos';
    }
    return selected ? String(selected) : 'Todos';
  };

  return (
    <div className="flex flex-col w-full relative" ref={dropdownRef}>
      <div className="mb-2 flex flex-col gap-1">
        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex justify-between items-center">
          {label}
        </label>
        <div className="text-[10px] font-medium text-blue-600 bg-blue-50/50 px-2.5 py-2 rounded-xl border border-blue-100/50 truncate min-h-[32px] flex items-center">
          <span className="text-slate-400 font-black mr-2 uppercase tracking-tight">Vínculo:</span>
          <span className="truncate font-bold">{getSelectedText()}</span>
        </div>
      </div>
      
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center justify-between w-full px-5 py-4 bg-white border rounded-2xl text-sm transition-all ${
          isOpen ? 'border-blue-600 ring-4 ring-blue-50' : 'border-slate-200 hover:border-blue-400 shadow-sm'
        }`}
      >
        <span className="truncate pr-4 text-left font-semibold text-slate-700">
          {getSummary()}
        </span>
        <ChevronDown size={18} className={`flex-shrink-0 text-slate-400 transition-transform ${isOpen ? 'rotate-180 text-blue-600' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 z-[100] mt-3 bg-white border border-slate-100 rounded-2xl shadow-2xl max-h-72 overflow-hidden animate-in fade-in slide-in-from-top-3 duration-300">
          <div className="p-3 overflow-y-auto max-h-72 scrollbar-hide">
            {multiple ? (
              <div 
                onClick={() => {
                  if (Array.isArray(selected) && selected.length === options.length) {
                    options.forEach(o => onToggle(o));
                  } else {
                    const toToggle = Array.isArray(selected) 
                      ? options.filter(o => !selected.includes(o))
                      : options;
                    toToggle.forEach(o => onToggle(o));
                  }
                }}
                className="flex items-center justify-between px-4 py-3 rounded-xl cursor-pointer hover:bg-blue-50 text-blue-700 font-black text-[10px] uppercase mb-2 border border-blue-100"
              >
                {Array.isArray(selected) && selected.length === options.length ? 'Desmarcar Todos' : 'Selecionar Todos'}
              </div>
            ) : (
              <div
                onClick={() => {
                  onToggle(null);
                  setIsOpen(false);
                }}
                className={`flex items-center justify-between px-4 py-3 rounded-xl cursor-pointer transition-all mb-1 ${
                  selected === null 
                    ? 'bg-blue-50 text-blue-700 font-bold' 
                    : 'hover:bg-slate-50 text-slate-600'
                }`}
              >
                <span className="text-xs uppercase font-bold tracking-tight">Selecionar Todos</span>
                <div className={`w-5 h-5 rounded-lg border flex items-center justify-center transition-all ${
                  selected === null ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-500/30' : 'border-slate-200 bg-slate-50'
                }`}>
                  {selected === null && <Check size={12} strokeWidth={4} />}
                </div>
              </div>
            )}
            {options.map((option) => (
              <div
                key={option}
                onClick={() => {
                  onToggle(option);
                  if (!multiple) setIsOpen(false);
                }}
                className={`flex items-center justify-between px-4 py-3 rounded-xl cursor-pointer transition-all mb-1 ${
                  isSelected(option) 
                    ? 'bg-blue-50 text-blue-700 font-bold' 
                    : 'hover:bg-slate-50 text-slate-600'
                }`}
              >
                <span className="text-xs uppercase font-bold tracking-tight">{option}</span>
                <div className={`w-5 h-5 rounded-lg border flex items-center justify-center transition-all ${
                  isSelected(option) ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-500/30' : 'border-slate-200 bg-slate-50'
                }`}>
                  {isSelected(option) && <Check size={12} strokeWidth={4} />}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

interface IndicatorsData {
  leituras_totais: number;
  leituras_nao_realizadas: number;
  leituras_realizadas: number;
}

const Dashboard: React.FC = () => {
  const [indicators, setIndicators] = useState<IndicatorsData | null>(null);
  const [graphData, setGraphData] = useState<any[]>([]);
  const [cardsData, setCardsData] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(false);
  const [fetchingMetadata, setFetchingMetadata] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isReportGenerated, setIsReportGenerated] = useState(false);
  
  const [aiInsights, setAiInsights] = useState<string | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);
  
  const [availableFilters, setAvailableFilters] = useState<FilterState & { matriculas: string[] }>({ 
    anos: [], meses: [], razoes: [], matriculas: [] 
  });
  
  const [selectedFilters, setSelectedFilters] = useState({
    ano: null as string | null,
    mes: null as string | null,
    razoes: [] as string[],
    matricula: null as string | null
  });

  useEffect(() => {
    const fetchInitialMetadata = async () => {
      try {
        setFetchingMetadata(true);
        setErrorMsg(null);
        
        const [anoRes, mesRes, rzRes] = await Promise.all([
          supabase.from(VIEW_ANOS).select('Ano').order('Ano', { ascending: false }),
          supabase.from(VIEW_MESES).select('mes, ordem_mes').order('ordem_mes', { ascending: true }),
          supabase.from(VIEW_RAZOES).select('rz').order('rz', { ascending: true })
        ]);

        setAvailableFilters(prev => ({
          ...prev,
          anos: Array.from(new Set((anoRes.data || []).map(r => String(r.Ano)))),
          meses: Array.from(new Set((mesRes.data || []).map(r => String(r.mes)))),
          razoes: Array.from(new Set((rzRes.data || []).map(r => String(r.rz))))
        }));
      } catch (err: any) {
        setErrorMsg("Erro ao sincronizar metadados iniciais do painel.");
      } finally {
        setFetchingMetadata(false);
      }
    };
    fetchInitialMetadata();
  }, []);

  useEffect(() => {
    const fetchMatriculas = async () => {
      try {
        const p_ano = selectedFilters.ano ? Number(selectedFilters.ano) : null;
        const p_mes = selectedFilters.mes;
        const p_rz = selectedFilters.razoes.length > 0 ? selectedFilters.razoes[0] : null;

        let query = supabase.from(TABLE_NAME).select('matr', { count: 'exact', head: false });
        if (p_ano) query = query.eq('Ano', p_ano);
        if (p_mes) query = query.eq('Mes', p_mes);
        if (p_rz) query = query.eq('rz', p_rz);

        const { data, error } = await query.not('matr', 'is', null).limit(2000);
        if (error) throw error;
        
        const uniqueMatr = Array.from(new Set((data || []).map(r => String(r.matr)))).sort();
        setAvailableFilters(prev => ({ ...prev, matriculas: uniqueMatr }));
      } catch (err: any) {
        console.error("Erro ao carregar matrículas:", err);
      }
    };
    fetchMatriculas();
  }, [selectedFilters.ano, selectedFilters.mes, selectedFilters.razoes]);

  const handleGenerateReport = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      setIsReportGenerated(false);
      setAiInsights(null);

      const p_ano = selectedFilters.ano ? Number(selectedFilters.ano) : null;
      const p_mes = selectedFilters.mes;
      const p_rz = selectedFilters.razoes.length > 0 ? selectedFilters.razoes[0] : null;
      const p_matr = selectedFilters.matricula;

      const [indRes, tipoRes] = await Promise.all([
        supabase.rpc(RPC_NAMES.INDICADORES, { p_ano, p_mes, p_rz, p_matr }),
        supabase.rpc(RPC_NAMES.RELACAO_TIPO, { p_ano, p_mes, p_rz, p_matr })
      ]);

      if (indRes.error) throw indRes.error;
      if (tipoRes.error) throw tipoRes.error;

      setIndicators(Array.isArray(indRes.data) ? indRes.data[0] : indRes.data);
      setCardsData(tipoRes.data || []);
      
      // Carregar dados de impedimentos para o gráfico
      let allLeiturasComImpedimento: any[] = [];
      let from = 0;
      const step = 2000;
      let hasMore = true;

      while (hasMore) {
        let query = supabase.from(TABLE_NAME).select('matr, nl').in('nl', IMPEDIMENTO_CODES);
        if (p_ano) query = query.eq('Ano', p_ano);
        if (p_mes) query = query.eq('Mes', p_mes);
        if (p_rz) query = query.eq('rz', p_rz);
        if (p_matr) query = query.eq('matr', p_matr);

        const { data, error } = await query.range(from, from + step - 1);
        if (error) throw error;
        
        if (!data || data.length === 0) {
          hasMore = false;
        } else {
          allLeiturasComImpedimento = [...allLeiturasComImpedimento, ...data];
          if (data.length < step) hasMore = false;
          else from += step;
        }
      }

      const groupedMap: Record<string, number> = {};
      allLeiturasComImpedimento.forEach((item: any) => {
        const key = item.matr || 'DESCONHECIDO';
        groupedMap[key] = (groupedMap[key] || 0) + 1;
      });

      const formattedData = Object.entries(groupedMap)
        .map(([name, total]) => ({ matricula: name, qtd_impedimentos: total }))
        .sort((a, b) => b.qtd_impedimentos - a.qtd_impedimentos);

      setGraphData(formattedData);
      setIsReportGenerated(true);
    } catch (err: any) {
      setErrorMsg(err?.message || "Erro no processamento estratégico.");
    } finally {
      setLoading(false);
    }
  };

  const handleGetAiInsights = async () => {
    if (!indicators || loadingAi) return;
    setLoadingAi(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const prompt = `Analise estes dados de leitura de energia:
      - Leituras Totais: ${indicators.leituras_totais}
      - Impedimentos: ${indicators.leituras_nao_realizadas}
      - Taxa de Falha: ${((indicators.leituras_nao_realizadas / (indicators.leituras_totais || 1)) * 100).toFixed(2)}%
      - Top Técnicos com problemas: ${graphData.slice(0, 3).map(d => `${d.matricula} (${d.qtd_impedimentos})`).join(', ')}
      
      Gere 4 frases curtas e profissionais:
      1. Diagnóstico da situação.
      2. Alerta crítico se necessário.
      3. Recomendação de ação.
      4. Visão de futuro.
      Use tom executivo e direto.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt
      });
      setAiInsights(response.text);
    } catch (err) {
      setAiInsights("Falha ao sincronizar com o núcleo de inteligência.");
    } finally {
      setLoadingAi(false);
    }
  };

  const handleToggleSingle = (key: 'ano' | 'mes' | 'matricula', value: string | null) => {
    setSelectedFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleToggleMulti = (key: 'razoes', value: string | null) => {
    if (value === null) return;
    setSelectedFilters(prev => {
      const current = prev[key];
      const next = current.includes(value) ? current.filter(v => v !== value) : [...current, value];
      return { ...prev, [key]: next };
    });
  };

  const leiturasARealizar = indicators ? Number(indicators.leituras_totais) || 0 : 0;
  const leiturasNaoRealizadas = indicators ? Number(indicators.leituras_nao_realizadas) || 0 : 0;
  const leiturasRealizadas = Math.max(0, leiturasARealizar - leiturasNaoRealizadas);
  const percentImpedimentos = leiturasARealizar > 0 ? ((leiturasNaoRealizadas / leiturasARealizar) * 100).toFixed(2).replace('.', ',') : "0,00";

  const tiposObrigatorios = ['Povoado', 'Rural', 'Urbano'];

  return (
    <div className="space-y-10 animate-in fade-in duration-500 pb-24">
      <section className="bg-white p-10 rounded-[40px] shadow-sm border border-slate-200">
        <div className="flex items-center gap-3 mb-10">
          <div className="p-2.5 bg-blue-600 text-white rounded-xl shadow-lg shadow-blue-500/20"><Filter size={20} /></div>
          <h2 className="text-base font-black text-slate-900 uppercase tracking-tighter italic">Painel de Parâmetros</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          <DropdownFilter label="Ano Base" options={availableFilters.anos} selected={selectedFilters.ano} onToggle={(v) => handleToggleSingle('ano', v)} placeholder="Todos" />
          <DropdownFilter label="Mês Competência" options={availableFilters.meses} selected={selectedFilters.mes} onToggle={(v) => handleToggleSingle('mes', v)} placeholder="Todos" />
          <DropdownFilter label="Razão Social" options={availableFilters.razoes} selected={selectedFilters.razoes} onToggle={(v) => handleToggleMulti('razoes', v)} placeholder="Todas" multiple={true} />
          <DropdownFilter label="Técnico (Matrícula)" options={availableFilters.matriculas} selected={selectedFilters.matricula} onToggle={(v) => handleToggleSingle('matricula', v)} placeholder="Todas" />
        </div>
        <div className="mt-12 flex justify-center">
          <button onClick={handleGenerateReport} disabled={loading} className="flex items-center gap-4 px-20 py-5 rounded-2xl font-black text-xs uppercase tracking-[0.2em] transition-all bg-slate-950 text-white hover:bg-slate-800 hover:scale-[1.02] shadow-2xl disabled:opacity-50">
            {loading ? <RefreshCw className="animate-spin" size={20} /> : <><Play size={18} fill="currentColor" /> Processar Dataset</>}
          </button>
        </div>
        {errorMsg && <div className="mt-8 p-5 bg-red-50 border-l-4 border-red-600 rounded-2xl text-red-700 text-[11px] font-bold uppercase">{errorMsg}</div>}
      </section>

      {isReportGenerated && indicators && (
        <div className="space-y-12 animate-in slide-in-from-bottom-6 duration-700">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            <IndicatorCard label="Dataset Total" value={leiturasARealizar.toLocaleString()} icon={<FileText size={24} />} color="blue" />
            <IndicatorCard label="Ocorrências" value={leiturasNaoRealizadas.toLocaleString()} icon={<XCircle size={24} />} color="red" />
            <IndicatorCard label="Eficiência" value={leiturasRealizadas.toLocaleString()} icon={<CheckCircle size={24} />} color="green" />
            <IndicatorCard label="Taxa de Falha" value={percentImpedimentos} suffix="%" icon={<AlertTriangle size={24} />} color="amber" />
          </div>

          <div className="bg-slate-950 rounded-[40px] p-10 text-white shadow-2xl relative overflow-hidden border border-white/5">
             <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none"><Sparkles size={160} /></div>
             <div className="relative z-10">
                <div className="flex items-center gap-4 mb-6">
                   <div className="p-3 bg-blue-600 rounded-2xl shadow-lg shadow-blue-500/40"><Sparkles size={22} className="text-white" /></div>
                   <h3 className="text-xl font-black uppercase tracking-tighter italic">Consultoria de IA SAL</h3>
                </div>
                {aiInsights ? (
                  <div className="p-8 bg-white/5 rounded-3xl border border-white/10">
                    <p className="text-sm font-medium leading-relaxed max-w-4xl animate-in fade-in slide-in-from-left-6 text-slate-100">{aiInsights}</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-4">
                    <p className="text-xs text-slate-400 uppercase font-bold tracking-[0.3em] mb-2">Processamento de linguagem natural para análise de tendências</p>
                    <button onClick={handleGetAiInsights} disabled={loadingAi} className="w-fit px-10 py-4 bg-blue-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.3em] hover:bg-blue-500 transition-all flex items-center gap-3 shadow-xl shadow-blue-600/20">
                       {loadingAi ? <RefreshCw className="animate-spin" size={16} /> : "Gerar Resumo Estratégico"}
                    </button>
                  </div>
                )}
             </div>
          </div>

          <section className="bg-white p-10 rounded-[40px] shadow-sm border border-slate-200">
            <div className="flex items-center justify-between mb-10">
              <h3 className="text-base font-black text-slate-900 uppercase tracking-tighter italic flex items-center gap-3">
                <TrendingUp size={22} className="text-blue-600" />
                Impedimentos por Matrícula (Top 15)
              </h3>
            </div>
            <div className="h-[500px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={graphData.slice(0, 15)} margin={{ top: 20, right: 30, left: 20, bottom: 80 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="matricula" axisLine={false} tickLine={false} tick={{fill: '#0f172a', fontSize: 10, fontWeight: '900'}} angle={-45} textAnchor="end" interval={0} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 11}} />
                  <Tooltip cursor={{fill: '#f8fafc', radius: 10}} contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', padding: '20px' }} />
                  <Bar dataKey="qtd_impedimentos" name="Impedimentos" barSize={35} radius={[10, 10, 0, 0]}>
                    {graphData.slice(0, 15).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={index === 0 ? '#991b1b' : '#ef4444'} />
                    ))}
                    <LabelList dataKey="qtd_impedimentos" position="top" style={{ fill: '#0f172a', fontSize: '11px', fontWeight: '900' }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {tiposObrigatorios.map((tipo) => {
              const data = cardsData.find(c => String(c.tipo || c.tipo_leitura).trim().toLowerCase() === tipo.toLowerCase()) || { leituras_totais: 0, leituras_nao_realizadas: 0 };
              const tRealizadas = Math.max(0, Number(data.leituras_totais) - Number(data.leituras_nao_realizadas));
              const tPerc = data.leituras_totais > 0 ? ((data.leituras_nao_realizadas / data.leituras_totais) * 100).toFixed(2) : "0,00";
              
              return (
                <div key={tipo} className="bg-white rounded-[32px] p-10 border border-slate-200 shadow-sm hover:shadow-xl transition-all group">
                  <div className="flex items-center justify-between mb-8 border-b pb-6 border-slate-50">
                    <span className="text-xs font-black uppercase text-slate-400 tracking-[0.3em]">{tipo}</span>
                    <Database size={22} className="text-slate-200 group-hover:text-blue-200 transition-colors" />
                  </div>
                  <div className="space-y-6">
                    <div className="flex justify-between items-center"><span className="text-[11px] font-bold text-slate-500 uppercase tracking-tight">Dataset</span><span className="text-xl font-black text-slate-900">{Number(data.leituras_totais).toLocaleString()}</span></div>
                    <div className="flex justify-between items-center"><span className="text-[11px] font-bold text-slate-500 uppercase tracking-tight">Falhas</span><span className="text-xl font-black text-red-600">{Number(data.leituras_nao_realizadas).toLocaleString()}</span></div>
                    <div className="flex justify-between items-center"><span className="text-[11px] font-bold text-slate-500 uppercase tracking-tight">Eficiência</span><span className="text-xl font-black text-green-700">{tRealizadas.toLocaleString()}</span></div>
                    <div className="pt-6 border-t border-slate-50 flex justify-between items-center font-black">
                       <span className="text-[11px] uppercase text-amber-600 tracking-widest">Taxa de Falha</span>
                       <span className="text-2xl text-amber-700 italic">{tPerc}%</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {!isReportGenerated && !loading && (
        <div className="flex flex-col items-center justify-center py-48 bg-white rounded-[60px] border-2 border-dashed border-slate-200 text-center mx-auto max-w-4xl shadow-inner">
          <div className="p-8 bg-slate-50 rounded-full mb-8"><Layout size={60} className="text-slate-200" /></div>
          <h3 className="text-slate-950 font-black text-2xl mb-4 tracking-tighter uppercase italic">Análise Estratégica SAL</h3>
          <p className="text-slate-400 font-bold text-[11px] uppercase tracking-[0.4em] px-20 leading-loose">Selecione os parâmetros de competência e execute o processamento do dataset.</p>
        </div>
      )}

      {loading && (
        <div className="fixed inset-0 z-[1000] bg-slate-950/80 backdrop-blur-md flex items-center justify-center">
          <div className="bg-white p-20 rounded-[50px] shadow-2xl flex flex-col items-center gap-10 text-center animate-in zoom-in-95 duration-500">
             <div className="relative h-24 w-24">
                <div className="absolute inset-0 rounded-full border-[8px] border-slate-100 border-t-blue-600 animate-spin"></div>
                <Database size={30} className="absolute inset-0 m-auto text-blue-600 animate-pulse" />
             </div>
             <div>
               <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter italic">Processando Dataset</h2>
               <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.3em] mt-2">Sincronizando modelos estatísticos...</p>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;

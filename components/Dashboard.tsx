
import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../services/supabaseClient';
import { FilterState } from '../types';
import IndicatorCard from './IndicatorCard';
import { TABLE_NAME, IMPEDIMENTO_CODES } from '../constants';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts';
import { FileText, XCircle, CheckCircle, AlertTriangle, Filter, Layout, RefreshCw, Play, ChevronDown, Check, Database, TrendingUp, Sparkles, Activity } from 'lucide-react';
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

  return (
    <div className="flex flex-col w-full relative" ref={dropdownRef}>
      <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-3 ml-1">
        {label}
      </label>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center justify-between w-full px-6 py-5 bg-slate-50 border-2 rounded-2xl text-sm transition-all font-bold ${
          isOpen ? 'border-blue-600 bg-white ring-4 ring-blue-50' : 'border-slate-100 hover:border-blue-200'
        }`}
      >
        <span className="truncate pr-4 text-left text-slate-700 uppercase tracking-tight">
          {getSummary()}
        </span>
        <ChevronDown size={18} className={`flex-shrink-0 text-slate-400 transition-transform ${isOpen ? 'rotate-180 text-blue-600' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 z-[100] mt-3 bg-white border border-slate-100 rounded-[28px] shadow-2xl max-h-72 overflow-hidden animate-in fade-in slide-in-from-top-3 duration-300">
          <div className="p-3 overflow-y-auto max-h-72">
            {multiple ? (
              <div 
                onClick={() => {
                  if (Array.isArray(selected) && selected.length === options.length) {
                    options.forEach(o => onToggle(o));
                  } else {
                    const toToggle = Array.isArray(selected) ? options.filter(o => !selected.includes(o)) : options;
                    toToggle.forEach(o => onToggle(o));
                  }
                }}
                className="flex items-center justify-between px-5 py-4 rounded-xl cursor-pointer hover:bg-blue-50 text-blue-700 font-black text-[10px] uppercase mb-2 border border-blue-100"
              >
                {Array.isArray(selected) && selected.length === options.length ? 'Desmarcar Todos' : 'Selecionar Todos'}
              </div>
            ) : (
              <div onClick={() => { onToggle(null); setIsOpen(false); }} className={`flex items-center justify-between px-5 py-4 rounded-xl cursor-pointer transition-all mb-1 ${selected === null ? 'bg-blue-50 text-blue-700 font-bold' : 'hover:bg-slate-50 text-slate-600'}`}>
                <span className="text-xs uppercase font-bold tracking-tight">Selecionar Todos</span>
                <div className={`w-5 h-5 rounded-lg border flex items-center justify-center transition-all ${selected === null ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-500/30' : 'border-slate-200 bg-slate-50'}`}>
                  {selected === null && <Check size={12} strokeWidth={4} />}
                </div>
              </div>
            )}
            {options.map((option) => (
              <div key={option} onClick={() => { onToggle(option); if (!multiple) setIsOpen(false); }} className={`flex items-center justify-between px-5 py-4 rounded-xl cursor-pointer transition-all mb-1 ${isSelected(option) ? 'bg-blue-50 text-blue-700 font-bold' : 'hover:bg-slate-50 text-slate-600'}`}>
                <span className="text-xs uppercase font-bold tracking-tight">{option}</span>
                <div className={`w-5 h-5 rounded-lg border flex items-center justify-center transition-all ${isSelected(option) ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-500/30' : 'border-slate-200 bg-slate-50'}`}>
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

const Dashboard: React.FC = () => {
  const [indicators, setIndicators] = useState<any>(null);
  const [graphData, setGraphData] = useState<any[]>([]);
  const [cardsData, setCardsData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchingMetadata, setFetchingMetadata] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isReportGenerated, setIsReportGenerated] = useState(false);
  const [aiInsights, setAiInsights] = useState<string | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);
  const [availableFilters, setAvailableFilters] = useState<FilterState & { matriculas: string[] }>({ anos: [], meses: [], razoes: [], matriculas: [] });
  const [selectedFilters, setSelectedFilters] = useState({ ano: null as string | null, mes: null as string | null, razoes: [] as string[], matricula: null as string | null });

  useEffect(() => {
    const fetchInitialMetadata = async () => {
      try {
        setFetchingMetadata(true);
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
        setErrorMsg("Erro ao sincronizar metadados iniciais.");
      } finally {
        setFetchingMetadata(false);
      }
    };
    fetchInitialMetadata();
  }, []);

  const handleGenerateReport = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
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
      setIndicators(Array.isArray(indRes.data) ? indRes.data[0] : indRes.data);
      setCardsData(tipoRes.data || []);
      
      let query = supabase.from(TABLE_NAME).select('matr, nl').in('nl', IMPEDIMENTO_CODES);
      if (p_ano) query = query.eq('Ano', p_ano);
      if (p_mes) query = query.eq('Mes', p_mes);
      if (p_rz) query = query.eq('rz', p_rz);
      if (p_matr) query = query.eq('matr', p_matr);

      const { data: impData } = await query.limit(5000);
      const groupedMap: Record<string, number> = {};
      (impData || []).forEach((item: any) => {
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
      const prompt = `Analise estes dados operacionais de leitura:
      - Total Dataset: ${indicators.leituras_totais}
      - Impedimentos (Não Realizadas): ${indicators.leituras_nao_realizadas}
      - Eficiência Atual: ${(( (indicators.leituras_totais - indicators.leituras_nao_realizadas) / indicators.leituras_totais) * 100).toFixed(2)}%
      - Top Ocorrências por Técnico: ${graphData.slice(0, 3).map(d => `${d.matricula} (${d.qtd_impedimentos})`).join(', ')}
      
      Gere um resumo estratégico de alto nível em 3 parágrafos curtos:
      1. Diagnóstico da produtividade mensal.
      2. Identificação de gargalo crítico baseado nos impedimentos.
      3. Sugestão de ação corretiva imediata.
      Seja profissional, direto e use tom executivo.`;

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

  return (
    <div className="space-y-12 pb-32 animate-in fade-in duration-700">
      {/* PAINEL DE CONTROLE DE FILTROS */}
      <section className="bg-white p-12 rounded-[56px] shadow-sm border border-slate-200">
        <div className="flex items-center gap-5 mb-14">
          <div className="p-4 bg-blue-600 text-white rounded-2xl shadow-xl shadow-blue-500/30"><Filter size={24} /></div>
          <div>
            <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter italic leading-none">Painel de Parâmetros</h2>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.35em] mt-2">Configuração de Competência e Lote</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
          <DropdownFilter label="Ano Base" options={availableFilters.anos} selected={selectedFilters.ano} onToggle={(v) => setSelectedFilters(p => ({...p, ano: v}))} placeholder="Todos" />
          <DropdownFilter label="Mês Competência" options={availableFilters.meses} selected={selectedFilters.mes} onToggle={(v) => setSelectedFilters(p => ({...p, mes: v}))} placeholder="Todos" />
          <DropdownFilter label="Razão Social" options={availableFilters.razoes} selected={selectedFilters.razoes} onToggle={(v) => { if(!v) return; const cur=selectedFilters.razoes; const n=cur.includes(v)?cur.filter(i=>i!==v):[...cur,v]; setSelectedFilters(p=>({...p,razoes:n})) }} placeholder="Todas" multiple={true} />
          <DropdownFilter label="Técnico (Matrícula)" options={availableFilters.matriculas.length ? availableFilters.matriculas : ['0001','0002']} selected={selectedFilters.matricula} onToggle={(v) => setSelectedFilters(p=>({...p, matricula:v}))} placeholder="Todas" />
        </div>
        <div className="mt-16 flex justify-center">
          <button onClick={handleGenerateReport} disabled={loading} className="px-28 py-6 bg-slate-950 text-white rounded-[32px] font-black text-xs uppercase tracking-[0.4em] shadow-2xl hover:scale-[1.03] transition-all disabled:opacity-20 flex items-center gap-6">
            {loading ? <Activity className="animate-spin" size={24} /> : <><Play size={24} fill="currentColor" /> Processar Dataset</>}
          </button>
        </div>
      </section>

      {isReportGenerated && indicators && (
        <div className="space-y-16 animate-in slide-in-from-bottom-12 duration-1000">
          {/* CARDS DE IMPACTO */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">
            <IndicatorCard label="Dataset Total" value={indicators.leituras_totais.toLocaleString()} icon={<FileText size={28}/>} color="blue" />
            <IndicatorCard label="Ocorrências" value={indicators.leituras_nao_realizadas.toLocaleString()} icon={<XCircle size={28}/>} color="red" />
            <IndicatorCard label="Eficiência Real" value={(indicators.leituras_totais - indicators.leituras_nao_realizadas).toLocaleString()} icon={<CheckCircle size={28}/>} color="green" />
            <IndicatorCard label="Taxa de Falha" value={((indicators.leituras_nao_realizadas / indicators.leituras_totais) * 100).toFixed(2).replace('.',',')} suffix="%" icon={<AlertTriangle size={28}/>} color="amber" />
          </div>

          {/* AI INSIGHTS AREA */}
          <div className="bg-slate-950 p-14 rounded-[64px] text-white shadow-2xl relative overflow-hidden border border-white/5">
             <div className="absolute top-0 right-0 p-20 opacity-5 pointer-events-none"><Sparkles size={200} /></div>
             <div className="relative z-10">
                <div className="flex items-center gap-6 mb-10">
                   <div className="p-4 bg-blue-600 rounded-3xl shadow-xl shadow-blue-500/40"><Sparkles size={28} className="text-white" /></div>
                   <h3 className="text-3xl font-black uppercase tracking-tighter italic">Diagnóstico Estratégico SAL</h3>
                </div>
                {aiInsights ? (
                  <div className="p-10 bg-white/5 rounded-[40px] border border-white/10">
                    <p className="text-sm font-medium leading-relaxed max-w-5xl animate-in fade-in slide-in-from-left-6 text-slate-200 whitespace-pre-wrap">{aiInsights}</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-6">
                    <p className="text-[11px] text-slate-400 uppercase font-bold tracking-[0.4em]">Núcleo de processamento cognitivo para análise de faturamento</p>
                    <button onClick={handleGetAiInsights} disabled={loadingAi} className="w-fit px-12 py-5 bg-blue-600 text-white rounded-[24px] font-black text-[11px] uppercase tracking-[0.3em] hover:bg-blue-500 transition-all flex items-center gap-4 shadow-2xl shadow-blue-600/30">
                       {loadingAi ? <RefreshCw className="animate-spin" size={18} /> : "Gerar Consultoria IA"}
                    </button>
                  </div>
                )}
             </div>
          </div>

          {/* GRÁFICO DE PARETO */}
          <section className="bg-white p-14 rounded-[64px] shadow-sm border border-slate-200">
            <div className="flex items-center justify-between mb-14">
              <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter italic flex items-center gap-5">
                <TrendingUp size={28} className="text-blue-600" />
                Impedimentos por Matrícula (Top 15)
              </h3>
            </div>
            <div className="h-[600px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={graphData.slice(0, 15)} margin={{ top: 20, right: 30, left: 20, bottom: 100 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="matricula" axisLine={false} tickLine={false} tick={{fill: '#0f172a', fontSize: 10, fontWeight: '900'}} angle={-45} textAnchor="end" interval={0} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                  <Tooltip cursor={{fill: '#f8fafc', radius: 15}} contentStyle={{ borderRadius: '32px', border: 'none', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', padding: '24px' }} />
                  <Bar dataKey="qtd_impedimentos" name="Ocorrências" barSize={45} radius={[15, 15, 0, 0]}>
                    {graphData.slice(0, 15).map((_, index) => (
                      <Cell key={`cell-${index}`} fill={index === 0 ? '#991b1b' : '#3b82f6'} />
                    ))}
                    <LabelList dataKey="qtd_impedimentos" position="top" style={{ fill: '#0f172a', fontSize: '12px', fontStyle: 'italic', fontWeight: '900' }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        </div>
      )}

      {!isReportGenerated && !loading && (
        <div className="flex flex-col items-center justify-center py-56 bg-white rounded-[72px] border-4 border-dashed border-slate-100 text-center mx-auto max-w-5xl">
          <div className="p-12 bg-slate-50 rounded-full mb-10 text-slate-200"><Layout size={80} /></div>
          <h3 className="text-slate-950 font-black text-3xl mb-4 tracking-tighter uppercase italic">Análise de Leitura V9</h3>
          <p className="text-slate-400 font-bold text-[11px] uppercase tracking-[0.5em] px-24 leading-loose">Aguardando parametrização de competência para sincronização de modelos estatísticos.</p>
        </div>
      )}

      {loading && (
        <div className="fixed inset-0 z-[1000] bg-slate-950/90 backdrop-blur-xl flex items-center justify-center">
          <div className="bg-white p-24 rounded-[80px] shadow-2xl flex flex-col items-center gap-12 text-center animate-in zoom-in-95 duration-500">
             <div className="relative h-36 w-36">
                <div className="absolute inset-0 rounded-full border-[12px] border-slate-50 border-t-blue-600 animate-spin"></div>
                <Database size={44} className="absolute inset-0 m-auto text-blue-600 animate-pulse" />
             </div>
             <div>
               <h2 className="text-4xl font-black text-slate-950 uppercase tracking-tighter italic">Sincronizando SAL</h2>
               <p className="text-[12px] font-bold text-slate-400 uppercase tracking-[0.5em] mt-4">Extraindo Dataset e Aplicando Regras de Negócio...</p>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;

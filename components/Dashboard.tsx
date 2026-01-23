
import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../services/supabaseClient';
import { FilterState } from '../types';
import IndicatorCard from './IndicatorCard';
import { TABLE_NAME, IMPEDIMENTO_CODES } from '../constants';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts';
import { FileText, XCircle, CheckCircle, AlertTriangle, Filter, Layout, RefreshCw, Play, ChevronDown, Check, Database, TrendingUp, Sparkles, Activity, Zap } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";

const VIEW_ANOS = "v_anos";
const VIEW_MESES = "v_meses";
const VIEW_RAZOES = "v_razoes";

const RPC_NAMES = {
  INDICADORES: 'rpc_indicadores_inicio',
  RELACAO_TIPO: 'rpc_relacao_por_tipo'
};

const safeGet = (val: any) => {
  if (!val) return 'N/A';
  if (typeof val === 'object') return val.nome || val.rz || val.matr || JSON.stringify(val);
  return String(val);
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
    return selected ? String(selected) : "Todos";
  };

  return (
    <div className="flex flex-col w-full relative" ref={dropdownRef}>
      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2.5 ml-1">
        {label}
      </label>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center justify-between w-full px-5 py-4 bg-white border-2 rounded-2xl text-sm transition-all font-bold ${
          isOpen ? 'border-blue-600 ring-4 ring-blue-50' : 'border-slate-100 hover:border-blue-200'
        }`}
      >
        <span className="truncate pr-4 text-left text-slate-700 uppercase tracking-tight">
          {getSummary()}
        </span>
        <ChevronDown size={16} className={`flex-shrink-0 text-slate-300 transition-transform ${isOpen ? 'rotate-180 text-blue-600' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 z-[100] mt-2 bg-white border border-slate-100 rounded-2xl shadow-2xl max-h-64 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="p-2 overflow-y-auto max-h-64 custom-scrollbar">
            {!multiple && (
              <div onClick={() => { onToggle(null); setIsOpen(false); }} className={`flex items-center justify-between px-4 py-3 rounded-xl cursor-pointer transition-all mb-1 ${selected === null ? 'bg-blue-50 text-blue-700 font-bold' : 'hover:bg-slate-50 text-slate-600'}`}>
                <span className="text-xs uppercase font-bold tracking-tight">Selecionar Todos</span>
                <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${selected === null ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-200 bg-slate-50'}`}>
                  {selected === null && <Check size={10} strokeWidth={4} />}
                </div>
              </div>
            )}
            {options.map((option) => (
              <div key={option} onClick={() => { onToggle(option); if (!multiple) setIsOpen(false); }} className={`flex items-center justify-between px-4 py-3 rounded-xl cursor-pointer transition-all mb-1 ${isSelected(option) ? 'bg-blue-50 text-blue-700 font-bold' : 'hover:bg-slate-50 text-slate-600'}`}>
                <span className="text-xs uppercase font-bold tracking-tight">{option}</span>
                <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${isSelected(option) ? 'bg-blue-600 border-blue-600 text-white shadow-md' : 'border-slate-200 bg-slate-50'}`}>
                  {isSelected(option) && <Check size={10} strokeWidth={4} />}
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
  const [loading, setLoading] = useState(false);
  const [fetchingMetadata, setFetchingMetadata] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isReportGenerated, setIsReportGenerated] = useState(false);
  const [aiInsights, setAiInsights] = useState<string | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);
  const [availableFilters, setAvailableFilters] = useState<FilterState & { matriculas: string[] }>({ anos: [], meses: [], razoes: [], matriculas: [] });
  const [selectedFilters, setSelectedFilters] = useState({ ano: null as string | null, mes: null as string | null, razoes: [] as string[] });

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
          razoes: Array.from(new Set((rzRes.data || []).map(r => safeGet(r.rz))))
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

      const [indRes] = await Promise.all([
        supabase.rpc(RPC_NAMES.INDICADORES, { p_ano, p_mes, p_rz, p_matr: null })
      ]);

      if (indRes.error) throw indRes.error;
      const currentIndicators = Array.isArray(indRes.data) ? indRes.data[0] : indRes.data;
      setIndicators(currentIndicators);
      
      let query = supabase.from(TABLE_NAME).select('matr, nl').in('nl', IMPEDIMENTO_CODES);
      if (p_ano) query = query.eq('Ano', p_ano);
      if (p_mes) query = query.eq('Mes', p_mes);
      if (p_rz) query = query.eq('rz', p_rz);

      const { data: impData } = await query.limit(10000);
      const groupedMap: Record<string, number> = {};
      (impData || []).forEach((item: any) => {
        const key = safeGet(item.matr) || 'N/A';
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
      const eff = (((indicators.leituras_totais - indicators.leituras_nao_realizadas) / (indicators.leituras_totais || 1)) * 100).toFixed(2);
      const topMatrs = graphData.slice(0,3).map(d => d.matricula).join(', ');
      const prompt = `Como analista sênior do SAL v9, forneça um diagnóstico sobre estes dados: Total de Leituras: ${indicators.leituras_totais}, Impedimentos Totais: ${indicators.leituras_nao_realizadas}, Eficiência Operacional: ${eff}%. Principais técnicos com desvio: ${topMatrs}. Gere 3 parágrafos profissionais de análise executiva focando em redução de custos operacionais e rotas de auditoria.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt
      });
      setAiInsights(response.text);
    } catch (err) {
      setAiInsights("Falha ao sincronizar com o núcleo de inteligência v9.");
    } finally {
      setLoadingAi(false);
    }
  };

  return (
    <div className="space-y-10 animate-in fade-in duration-500 pb-20">
      <section className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-200">
        <div className="flex items-center gap-4 mb-10">
          <div className="p-3 bg-blue-600 text-white rounded-2xl shadow-lg shadow-blue-500/20"><Filter size={20} /></div>
          <div>
            <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight">Filtros de Parâmetros</h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Configuração de Lote Estratégico</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <DropdownFilter label="Ano Operacional" options={availableFilters.anos} selected={selectedFilters.ano} onToggle={(v) => setSelectedFilters(p => ({...p, ano: v}))} placeholder="Todos os Anos" />
          <DropdownFilter label="Mês Competência" options={availableFilters.meses} selected={selectedFilters.mes} onToggle={(v) => setSelectedFilters(p => ({...p, mes: v}))} placeholder="Todos os Meses" />
          <DropdownFilter label="Razão Social" options={availableFilters.razoes} selected={selectedFilters.razoes} onToggle={(v) => { if(!v) return; const cur=selectedFilters.razoes; const n=cur.includes(v)?cur.filter(i=>i!==v):[...cur,v]; setSelectedFilters(p=>({...p,razoes:n})) }} placeholder="Todas as Empresas" multiple={true} />
        </div>
        <div className="mt-10 flex justify-center">
          <button 
            onClick={handleGenerateReport} 
            disabled={loading} 
            className="px-24 py-5 bg-slate-950 text-white rounded-[2rem] font-black text-xs uppercase tracking-[0.3em] shadow-xl hover:scale-[1.02] transition-all disabled:opacity-20 flex items-center gap-4"
          >
            {loading ? <Activity className="animate-spin" size={20} /> : <Zap size={20} fill="currentColor" />}
            SINCRONIZAR DASHBOARD
          </button>
        </div>
      </section>

      {isReportGenerated && indicators && (
        <div className="space-y-10 animate-in slide-in-from-bottom-6 duration-700">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <IndicatorCard label="Dataset Analisado" value={indicators.leituras_totais.toLocaleString()} icon={<FileText size={24}/>} color="blue" />
            <IndicatorCard label="Não Realizadas" value={indicators.leituras_nao_realizadas.toLocaleString()} icon={<XCircle size={24}/>} color="red" />
            <IndicatorCard label="Realizadas" value={(indicators.leituras_totais - indicators.leituras_nao_realizadas).toLocaleString()} icon={<CheckCircle size={24}/>} color="green" />
            <IndicatorCard label="Taxa de Falha" value={((indicators.leituras_nao_realizadas / (indicators.leituras_totais || 1)) * 100).toFixed(2).replace('.',',')} suffix="%" icon={<AlertTriangle size={24}/>} color="amber" />
          </div>

          <div className="bg-[#0f172a] p-12 rounded-[3.5rem] text-white shadow-2xl relative overflow-hidden border border-white/5 group">
             <div className="absolute top-0 right-0 p-16 opacity-10 pointer-events-none rotate-12 transition-transform group-hover:scale-110"><Sparkles size={180} /></div>
             <div className="relative z-10">
                <div className="flex items-center gap-5 mb-10">
                   <div className="p-4 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-3xl shadow-xl shadow-blue-500/30 ring-2 ring-white/10"><Sparkles size={28} className="text-white" /></div>
                   <div>
                      <h3 className="text-2xl font-black uppercase tracking-tight italic">Relatório Analítico SAL Inteligência</h3>
                      <p className="text-[10px] text-blue-400 font-black uppercase tracking-widest mt-1">Core Engine v9.0 Neural</p>
                   </div>
                </div>
                {aiInsights ? (
                  <div className="p-10 bg-white/5 backdrop-blur-md rounded-[2.5rem] border border-white/10 text-slate-300 text-base leading-relaxed animate-in fade-in-50 duration-1000">
                    <div className="prose prose-invert max-w-none">
                       <p className="whitespace-pre-wrap">{aiInsights}</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-6">
                    <p className="text-sm text-slate-400 font-medium max-w-2xl">O núcleo de processamento cognitivo está aguardando para analisar anomalias de faturamento, padrões de impedimento por região e performance de campo do lote atual.</p>
                    <button onClick={handleGetAiInsights} disabled={loadingAi} className="w-fit px-12 py-5 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] hover:bg-blue-500 transition-all flex items-center gap-4 shadow-2xl shadow-blue-600/40">
                       {loadingAi ? <RefreshCw className="animate-spin" size={18} /> : <>GERAR CONSULTORIA IA <Zap size={16} fill="currentColor" /></>}
                    </button>
                  </div>
                )}
             </div>
          </div>

          <section className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-200">
            <div className="flex items-center justify-between mb-10">
              <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight flex items-center gap-4">
                <TrendingUp size={24} className="text-blue-600" />
                Impedimentos Críticos por Matrícula
              </h3>
              <span className="text-[9px] font-black bg-slate-100 px-4 py-2 rounded-full uppercase text-slate-500 tracking-widest">Top 12 Ocorrências do Lote</span>
            </div>
            <div className="h-[450px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={graphData.slice(0, 12)} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="matricula" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 10, fontWeight: '900'}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 11}} />
                  <Tooltip 
                    cursor={{fill: '#f8fafc', radius: 12}} 
                    contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.15)', padding: '20px', fontSize: '11px', fontWeight: 'bold' }} 
                  />
                  <Bar dataKey="qtd_impedimentos" name="Ocorrências" barSize={44} radius={[12, 12, 0, 0]}>
                    {graphData.slice(0, 12).map((_, index) => (
                      <Cell key={`cell-${index}`} fill={index === 0 ? '#dc2626' : '#2563eb'} fillOpacity={1 - (index * 0.05)} />
                    ))}
                    <LabelList dataKey="qtd_impedimentos" position="top" style={{ fill: '#0f172a', fontSize: '12px', fontWeight: '900' }} offset={10} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        </div>
      )}

      {!isReportGenerated && !loading && (
        <div className="flex flex-col items-center justify-center py-40 bg-white rounded-[3.5rem] border-2 border-dashed border-slate-200 text-center animate-pulse">
          <div className="p-10 bg-slate-50 rounded-full mb-8 text-slate-200"><Layout size={80} /></div>
          <h3 className="text-slate-900 font-black text-3xl mb-3 tracking-tighter uppercase italic">Sincronização Requerida</h3>
          <p className="text-slate-400 font-bold text-[10px] uppercase tracking-[0.5em] px-20 max-w-lg">O núcleo de dados aguarda parâmetros operacionais para iniciar a análise neural v9.0</p>
        </div>
      )}

      {loading && (
        <div className="fixed inset-0 z-[5000] bg-slate-950/80 backdrop-blur-2xl flex items-center justify-center animate-in fade-in duration-500">
           <div className="bg-white p-20 rounded-[4rem] shadow-2xl flex flex-col items-center gap-10 border border-slate-100">
              <div className="relative h-32 w-32">
                 <div className="absolute inset-0 rounded-full border-[10px] border-slate-50 border-t-blue-600 animate-spin"></div>
                 <Database size={40} className="absolute inset-0 m-auto text-blue-600 animate-pulse" />
              </div>
              <div className="text-center">
                <h2 className="text-2xl font-black uppercase text-slate-900 tracking-tight">Processando Dataset Neural</h2>
                <p className="text-[10px] font-bold text-blue-600 uppercase tracking-[0.5em] mt-4 animate-pulse">Cruzando Matrizes de Impedimentos v9.0...</p>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;

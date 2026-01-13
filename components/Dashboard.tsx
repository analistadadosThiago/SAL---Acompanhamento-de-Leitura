
import React, { useEffect, useState, useMemo, useRef } from 'react';
import { supabase } from '../services/supabaseClient';
import { TABLE_NAME, IMPEDIMENTO_CODES, MONTH_ORDER } from '../constants';
import { LeituraRecord, FilterState } from '../types';
import IndicatorCard from './IndicatorCard';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { FileText, XCircle, CheckCircle, AlertTriangle, Filter, Layout, RefreshCw, AlertCircle, Play, ChevronDown, Check, Database, Terminal, Copy } from 'lucide-react';

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
      <label className="text-[11px] font-black text-slate-500 uppercase tracking-[0.15em] mb-2 flex justify-between items-center">
        {label}
        {selected.length > 0 && (
          <span className="bg-blue-600 text-white px-2 py-0.5 rounded-full text-[10px] shadow-lg shadow-blue-100">
            {selected.length}
          </span>
        )}
      </label>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center justify-between w-full px-5 py-3.5 bg-white border-2 rounded-2xl text-sm transition-all duration-300 ${
          isOpen ? 'border-blue-600 ring-8 ring-blue-50' : 'border-slate-100 hover:border-blue-200'
        } ${selected.length > 0 ? 'text-slate-900 font-bold' : 'text-slate-400'}`}
      >
        <span className="truncate pr-4 text-left">
          {selected.length > 0 ? selected.join(', ') : placeholder}
        </span>
        <ChevronDown size={20} className={`flex-shrink-0 text-slate-300 transition-transform duration-500 ${isOpen ? 'rotate-180 text-blue-600' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 z-[100] mt-3 bg-white border border-slate-100 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] max-h-80 overflow-hidden animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="p-3 overflow-y-auto max-h-80 custom-scrollbar">
            {options.map((option) => (
              <div
                key={option}
                onClick={() => onToggle(option)}
                className={`flex items-center justify-between px-4 py-3 rounded-xl cursor-pointer transition-all duration-200 mb-1 group ${
                  selected.includes(option) 
                    ? 'bg-blue-600 text-white shadow-xl shadow-blue-200' 
                    : 'hover:bg-slate-50 text-slate-600'
                }`}
              >
                <span className="text-sm font-bold tracking-tight">{option}</span>
                <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${
                  selected.includes(option) ? 'bg-white border-white text-blue-600' : 'border-slate-100 bg-slate-50 group-hover:border-blue-200'
                }`}>
                  {selected.includes(option) && <Check size={16} strokeWidth={4} />}
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
  const [datasetFiltrado, setDatasetFiltrado] = useState<LeituraRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchingMetadata, setFetchingMetadata] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isViewMissing, setIsViewMissing] = useState(false);
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
      setIsViewMissing(false);

      const [anoRes, mesRes, rzRes] = await Promise.all([
        supabase.from(VIEW_ANOS).select('Ano').range(0, 99999),
        supabase.from(VIEW_MESES).select('Mes').range(0, 99999),
        supabase.from(VIEW_RAZOES).select('rz').range(0, 99999)
      ]);

      if (anoRes.error || mesRes.error || rzRes.error) {
        const err = anoRes.error || mesRes.error || rzRes.error;
        if (err?.message.includes('schema cache')) setIsViewMissing(true);
        throw new Error(err?.message || "Erro nas views materializadas.");
      }

      const anos = Array.from(new Set((anoRes.data || []).map(r => r.Ano?.toString())))
        .filter((v): v is string => !!v).sort((a, b) => a.localeCompare(b));

      const mesesRaw = (mesRes.data || []).map(r => {
          const m = (r.Mes as string).trim();
          return m.charAt(0).toUpperCase() + m.slice(1).toLowerCase();
      });
      const meses = Array.from(new Set(mesesRaw))
        .filter((v): v is string => !!v)
        .sort((a, b) => (MONTH_ORDER[a.toUpperCase()] || 0) - (MONTH_ORDER[b.toUpperCase()] || 0));

      const razoes = Array.from(new Set((rzRes.data || []).map(r => r.rz?.toString())))
        .filter((v): v is string => !!v).sort((a, b) => parseInt(a) - parseInt(b));

      setAvailableFilters({ anos, meses, razoes });
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setFetchingMetadata(false);
    }
  };

  useEffect(() => { fetchFilters(); }, []);

  const canGenerate = useMemo(() => 
    selectedFilters.anos.length > 0 && selectedFilters.meses.length > 0 && selectedFilters.razoes.length > 0, 
    [selectedFilters]
  );

  const handleGenerateReport = async () => {
    if (!canGenerate) return;
    try {
      setLoading(true);
      setErrorMsg(null);
      setIsReportGenerated(false);

      const { data: records, error } = await supabase
        .from(TABLE_NAME)
        .select('*')
        .in('Ano', selectedFilters.anos)
        .in('Mes', selectedFilters.meses)
        .in('rz', selectedFilters.razoes)
        .range(0, 1000000); 
      
      if (error) throw error;
      setDatasetFiltrado(records as LeituraRecord[] || []);
      setIsReportGenerated(true);
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = (key: keyof typeof selectedFilters, value: string) => {
    setIsReportGenerated(false);
    setSelectedFilters(prev => {
      const current = prev[key];
      const next = current.includes(value) ? current.filter(v => v !== value) : [...current, value];
      return { ...prev, [key]: next };
    });
  };

  // CÁLCULOS DETERMINÍSTICOS SOBRE DATASET_FILTRADO
  const metrics = useMemo(() => {
    if (!isReportGenerated || datasetFiltrado.length === 0) return null;

    // Definição exata: COUNT(DISTINCT instalacao)
    const leiturasARealizarSet = new Set(datasetFiltrado.map(r => String(r.instalacao).trim()).filter(Boolean));
    const leiturasARealizar = leiturasARealizarSet.size;

    // Definição exata: COUNT(DISTINCT instalacao) com nl nos códigos de impedimento
    const leiturasNaoRealizadasSet = new Set(
      datasetFiltrado
        .filter(r => IMPEDIMENTO_CODES.includes(String(r.nl).trim()))
        .map(r => String(r.instalacao).trim())
        .filter(Boolean)
    );
    const leiturasNaoRealizadas = leiturasNaoRealizadasSet.size;

    // Definição exata: Leituras a Realizar - Leituras Não Realizadas
    const leiturasRealizadas = leiturasARealizar - leiturasNaoRealizadas;

    // Fórmula exata: (Não Realizadas ÷ a Realizar) × 100
    const percImpedimentos = leiturasARealizar > 0 ? (leiturasNaoRealizadas / leiturasARealizar) * 100 : 0;

    // Validação Obrigatória
    if (leiturasRealizadas + leiturasNaoRealizadas !== leiturasARealizar) {
        console.error("Divergência matemática detectada na lógica de conjuntos.");
    }

    return { total: leiturasARealizar, nr: leiturasNaoRealizadas, r: leiturasRealizadas, perc: percImpedimentos };
  }, [datasetFiltrado, isReportGenerated]);

  const chartData = useMemo(() => {
    if (!isReportGenerated) return [];
    const map: Record<string, Set<string>> = {};
    const sortMap: Record<string, number> = {};

    datasetFiltrado.forEach(r => {
      if (IMPEDIMENTO_CODES.includes(String(r.nl).trim())) {
        const k = `${r.Mes} ${r.Ano}`;
        if (!map[k]) {
            map[k] = new Set();
            sortMap[k] = (parseInt(String(r.Ano)) * 100) + (MONTH_ORDER[String(r.Mes).toUpperCase()] || 0);
        }
        map[k].add(String(r.instalacao).trim());
      }
    });

    return Object.entries(map).map(([label, set]) => ({
      label,
      value: set.size,
      sort: sortMap[label]
    })).sort((a, b) => a.sort - b.sort);
  }, [datasetFiltrado, isReportGenerated]);

  const tipoGroups = useMemo(() => {
    if (!isReportGenerated) return [];
    const groups: Record<string, { totalSet: Set<string>, nrSet: Set<string> }> = {};
    
    datasetFiltrado.forEach(r => {
      const t = r.tipo || 'NÃO INFORMADO';
      if (!groups[t]) groups[t] = { totalSet: new Set(), nrSet: new Set() };
      
      const inst = String(r.instalacao).trim();
      if (inst) {
        groups[t].totalSet.add(inst);
        if (IMPEDIMENTO_CODES.includes(String(r.nl).trim())) {
          groups[t].nrSet.add(inst);
        }
      }
    });

    return Object.entries(groups).map(([tipo, data]) => {
      const total = data.totalSet.size;
      const nr = data.nrSet.size;
      const r = total - nr;
      return { tipo, total, nr, r, perc: total > 0 ? (nr / total) * 100 : 0 };
    });
  }, [datasetFiltrado, isReportGenerated]);

  if (fetchingMetadata) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-6 bg-white rounded-[40px] shadow-2xl border border-slate-50">
        <div className="h-16 w-16 rounded-full border-4 border-slate-50 border-t-blue-600 animate-spin"></div>
        <p className="text-slate-400 font-black text-xs uppercase tracking-[0.3em]">Validando Schema da Base...</p>
      </div>
    );
  }

  if (isViewMissing) {
    return (
      <div className="max-w-4xl mx-auto py-12 px-6">
        <div className="bg-white rounded-[40px] shadow-2xl border-2 border-red-50 overflow-hidden">
          <div className="bg-red-600 p-10 text-white flex items-center gap-6">
            <AlertCircle size={48} strokeWidth={3} />
            <div>
              <h2 className="text-3xl font-black uppercase tracking-tighter">Views Materializadas Requeridas</h2>
              <p className="text-red-100 font-bold text-sm mt-1 uppercase tracking-widest opacity-80">Correção necessária via SQL Editor</p>
            </div>
          </div>
          <div className="p-10 space-y-8">
            <div className="bg-slate-900 rounded-3xl p-8">
              <code className="text-blue-400 text-sm font-mono block break-all">
                CREATE MATERIALIZED VIEW v_anos AS SELECT DISTINCT "Ano" FROM "LeituraGeral" ORDER BY "Ano" ASC;<br/>
                CREATE MATERIALIZED VIEW v_meses AS SELECT DISTINCT "Mes" FROM "LeituraGeral";<br/>
                CREATE MATERIALIZED VIEW v_razoes AS SELECT DISTINCT "rz" FROM "LeituraGeral" ORDER BY "rz" ASC;
              </code>
            </div>
            <button onClick={fetchFilters} className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black uppercase hover:bg-blue-600 transition-all shadow-xl shadow-slate-200">Revalidar Conexão</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-12 pb-24">
      {/* FILTROS INTEGRADOS */}
      <section className="bg-white p-10 rounded-[40px] shadow-2xl border border-slate-100">
        <div className="flex items-center gap-4 mb-12 border-b border-slate-50 pb-8">
          <div className="p-3 bg-blue-600 rounded-2xl text-white shadow-lg shadow-blue-100"><Filter size={24} /></div>
          <div>
              <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter leading-none">Configuração Analítica</h2>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">Filtros dinâmicos via views materializadas</p>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 mb-12">
          <MultiSelectDropdown label="Selecione o Ano:" options={availableFilters.anos} selected={selectedFilters.anos} onToggle={(v) => handleToggle('anos', v)} placeholder="Escolha os Anos" />
          <MultiSelectDropdown label="Selecione o Mês:" options={availableFilters.meses} selected={selectedFilters.meses} onToggle={(v) => handleToggle('meses', v)} placeholder="Escolha os Meses" />
          <MultiSelectDropdown label="Selecione o Razão:" options={availableFilters.razoes} selected={selectedFilters.razoes} onToggle={(v) => handleToggle('razoes', v)} placeholder="Escolha as Razões" />
        </div>

        <div className="flex flex-col items-center border-t border-slate-50 pt-8 gap-4">
          <button
            onClick={handleGenerateReport}
            disabled={!canGenerate || loading}
            className={`flex items-center gap-5 px-24 py-5 rounded-3xl font-black text-2xl transition-all duration-300 ${
                canGenerate && !loading ? 'bg-slate-900 text-white hover:bg-blue-600 hover:scale-105 active:scale-95 shadow-2xl shadow-slate-200' : 'bg-slate-100 text-slate-300 cursor-not-allowed'
            }`}
          >
            {loading ? <RefreshCw className="animate-spin" size={28} /> : <><Play size={24} fill="currentColor" /> GERAR</>}
          </button>
          {!canGenerate && <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest bg-amber-50 px-4 py-2 rounded-lg">Preenchimento de filtros obrigatório</p>}
        </div>
      </section>

      {/* DASHBOARD INTEGRAL */}
      {isReportGenerated && !loading && metrics && (
        <div className="animate-in fade-in slide-in-from-bottom-8 duration-1000 space-y-12">
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            <IndicatorCard label="Leituras a Realizar" value={metrics.total.toLocaleString()} icon={<FileText size={32} />} color="blue" />
            <IndicatorCard label="Leituras Não Realizadas" value={metrics.nr.toLocaleString()} icon={<XCircle size={32} />} color="red" />
            <IndicatorCard label="Leituras Realizadas" value={metrics.r.toLocaleString()} icon={<CheckCircle size={32} />} color="green" />
            <IndicatorCard label="% de Impedimentos" value={metrics.perc.toFixed(2)} suffix="%" icon={<AlertTriangle size={32} />} color="amber" />
          </section>

          <section className="bg-white p-12 rounded-[40px] shadow-2xl border border-slate-100">
            <h3 className="text-slate-900 font-black text-3xl tracking-tighter uppercase mb-12 flex items-center gap-4">
                <Database size={28} className="text-blue-600" />
                Curva de Impedimentos (Task Distinct)
            </h3>
            <div className="h-[450px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="5 5" vertical={false} stroke="#f8fafc" />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 11, fontWeight: 900}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 11}} />
                  <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{ border: 'none', borderRadius: '24px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.1)', fontWeight: 900 }} />
                  <Bar dataKey="value" name="Impedimentos" fill="#1e293b" radius={[10, 10, 0, 0]} barSize={50} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-center italic">O somatório dos períodos pode divergir do total se houver instalações repetidas em diferentes seleções.</p>
          </section>

          <div className="space-y-12">
            <div className="flex items-center gap-4 text-slate-900 font-black uppercase tracking-tighter border-l-8 border-blue-600 pl-6">
                <Layout size={28} />
                <h3 className="text-3xl italic">Performance por Segmentação</h3>
            </div>
            {tipoGroups.map((g, idx) => (
              <div key={idx} className="bg-white p-10 rounded-[40px] shadow-xl border border-slate-100 transition-all hover:scale-[1.01] duration-500">
                <div className="mb-12 flex items-center justify-between">
                    <span className="bg-slate-900 text-white px-8 py-3 rounded-2xl text-sm font-black uppercase tracking-widest shadow-lg shadow-slate-200">{g.tipo}</span>
                    <div className="text-[10px] font-black text-blue-600 bg-blue-50 px-5 py-2 rounded-full border border-blue-100 flex items-center gap-2"><Database size={12}/> DATASET_FILTRADO</div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                  <div className="p-8 bg-slate-50 rounded-3xl border border-slate-100 text-center">
                    <p className="text-[10px] font-black text-slate-400 uppercase mb-4 tracking-widest">Leituras a Realizar</p>
                    <p className="text-5xl font-black text-slate-900 tracking-tighter">{g.total.toLocaleString()}</p>
                  </div>
                  <div className="p-8 bg-red-50 rounded-3xl border border-red-100 text-center">
                    <p className="text-[10px] font-black text-red-400 uppercase mb-4 tracking-widest">Leituras Não Realizadas</p>
                    <p className="text-5xl font-black text-red-600 tracking-tighter">{g.nr.toLocaleString()}</p>
                  </div>
                  <div className="p-8 bg-green-50 rounded-3xl border border-green-100 text-center">
                    <p className="text-[10px] font-black text-green-500 uppercase mb-4 tracking-widest">Leituras Realizadas</p>
                    <p className="text-5xl font-black text-green-700 tracking-tighter">{g.r.toLocaleString()}</p>
                  </div>
                  <div className="bg-slate-900 p-8 rounded-[32px] text-white flex flex-col justify-center text-center shadow-2xl">
                    <p className="text-[11px] font-black text-slate-400 uppercase mb-3 tracking-[0.2em]">% de Impedimentos</p>
                    <p className="text-6xl font-black tracking-tighter">{g.perc.toFixed(2)}%</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TELA EM STAND-BY */}
      {!isReportGenerated && !loading && (
        <div className="flex flex-col items-center justify-center py-56 bg-white rounded-[40px] border-4 border-dashed border-slate-100 text-center animate-in fade-in duration-700">
          <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mb-8 rotate-12">
            <Layout size={40} className="text-slate-200" />
          </div>
          <h3 className="text-3xl font-black text-slate-300 uppercase tracking-tighter">Aguardando Extração Integral</h3>
          <p className="text-slate-400 font-bold text-sm mt-3 max-w-sm mx-auto uppercase tracking-widest leading-relaxed">
            Selecione Ano, Mês e Razão nos filtros acima para iniciar o processamento dos indicadores.
          </p>
        </div>
      )}

      {/* OVERLAY DE PROCESSAMENTO */}
      {loading && (
        <div className="fixed inset-0 z-[200] bg-slate-900/40 backdrop-blur-md flex items-center justify-center animate-in fade-in duration-300">
            <div className="bg-white p-16 rounded-[60px] shadow-2xl flex flex-col items-center gap-8 border-4 border-blue-600">
                <div className="relative h-24 w-24">
                    <div className="absolute inset-0 rounded-full border-8 border-slate-50 border-t-blue-600 animate-spin"></div>
                    <Database size={32} className="absolute inset-0 m-auto text-blue-600 animate-bounce" />
                </div>
                <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tighter">Sincronizando Dataset</h2>
            </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;

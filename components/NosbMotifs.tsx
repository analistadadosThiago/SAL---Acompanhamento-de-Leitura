
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../services/supabaseClient';
import { 
  RPC_CE_FILTRO_ANO, 
  RPC_CE_FILTRO_MES, 
  RPC_CE_IMPEDIMENTOS,
  RPC_CE_SIMULACAO_NOSB,
  MONTH_ORDER
} from '../constants';
import { 
  Filter, Play, RotateCcw, Printer, BarChart3, ChevronLeft, ChevronRight, 
  Table as TableIcon, LayoutDashboard, Database, Activity, FileText, 
  ShieldAlert, ScanLine, ListFilter, TrendingUp, Users, Target, Search, RefreshCw
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend } from 'recharts';
import IndicatorCard from './IndicatorCard';

enum SubMenu {
  IMPRESSAO = 'IMPRESSAO',
  SIMULACAO = 'SIMULACAO'
}

interface Option {
  label: string;
  value: string;
}

interface FilterData {
  anos: string[];
  meses: Option[];
}

const NosbMotifs: React.FC = () => {
  const [activeSubMenu, setActiveSubMenu] = useState<SubMenu>(SubMenu.IMPRESSAO);

  // States for Impressão
  const [impFilters, setImpFilters] = useState({ ano: '', mes: '', rz: '', matr: '' });
  const [impOptions, setImpOptions] = useState<FilterData>({ anos: [], meses: [] });
  const [impData, setImpData] = useState<any[]>([]);
  const [impLoading, setImpLoading] = useState(false);
  const [impIsLoaded, setImpIsLoaded] = useState(false);

  // States for Simulação
  const [simFilters, setSimFilters] = useState({ ano: '', mes: '', rz: '', matr: '', motivo: '', limit: 25 });
  const [simOptions, setSimOptions] = useState<FilterData>({ anos: [], meses: [] });
  const [simData, setSimData] = useState<any[]>([]);
  const [simLoading, setSimLoading] = useState(false);
  const [simIsLoaded, setSimIsLoaded] = useState(false);

  const safeExtract = (val: any, field: string): string => {
    if (!val) return "";
    const key = Object.keys(val).find(k => k.toLowerCase() === field.toLowerCase());
    const result = key ? val[key] : (val.rz || val.RZ || val.razao || val.matr || val.MATR || "");
    return String(result).trim();
  };

  // Memoized dynamic options based on loaded data
  const impDynamicOptions = useMemo(() => {
    const rz = Array.from(new Set(impData.map(i => safeExtract(i, 'rz')))).filter(Boolean).sort();
    const matr = Array.from(new Set(impData.map(i => safeExtract(i, 'matr')))).filter(Boolean).sort();
    return { 
      razoes: rz.map(r => ({ label: r, value: r })), 
      matriculas: matr.map(m => ({ label: m, value: m })) 
    };
  }, [impData]);

  const simDynamicOptions = useMemo(() => {
    const rz = Array.from(new Set(simData.map(i => safeExtract(i, 'rz')))).filter(Boolean).sort();
    const matr = Array.from(new Set(simData.map(i => safeExtract(i, 'matr')))).filter(Boolean).sort();
    return { 
      razoes: rz.map(r => ({ label: r, value: r })), 
      matriculas: matr.map(m => ({ label: m, value: m })) 
    };
  }, [simData]);

  // Carregamento Inicial de Metadados
  useEffect(() => {
    const fetchBase = async () => {
      try {
        const [resAnos, resMeses] = await Promise.all([
          supabase.rpc(RPC_CE_FILTRO_ANO),
          supabase.rpc(RPC_CE_FILTRO_MES)
        ]);
        const anos = (resAnos.data || []).map((a: any) => String(a.ano || a)).sort((a, b) => Number(b) - Number(a));
        const meses = (resMeses.data || []).map((m: any) => String(m.mes || m).toUpperCase())
          .filter((m: string) => !!MONTH_ORDER[m])
          .sort((a: string, b: string) => (MONTH_ORDER[a] || 0) - (MONTH_ORDER[b] || 0))
          .map(m => ({ label: m, value: m }));
        
        setImpOptions({ anos, meses });
        setSimOptions({ anos, meses });
      } catch (err) { console.error("SAL - Erro base filters:", err); }
    };
    fetchBase();
  }, []);

  const handleGerarImpressao = async () => {
    if (!impFilters.ano || !impFilters.mes) return;
    setImpLoading(true);
    try {
      const { data, error } = await supabase.rpc(RPC_CE_IMPEDIMENTOS, {
        p_ano: impFilters.ano,
        p_mes: impFilters.mes,
        p_rz: null,
        p_matr: null
      });
      if (error) throw error;
      setImpData(data || []);
      setImpIsLoaded(true);
    } catch (err) { console.error("Erro Impressão:", err); }
    finally { setImpLoading(false); }
  };

  const handleGerarSimulacao = async () => {
    if (!simFilters.ano || !simFilters.mes) return;
    setSimLoading(true);
    try {
      const { data, error } = await supabase.rpc(RPC_CE_SIMULACAO_NOSB, {
        p_ano: simFilters.ano,
        p_mes: simFilters.mes,
        p_rz: null,
        p_matr: null,
        p_motivo: null,
        p_limit: 1000000,
        p_offset: 0
      });
      if (error) throw error;
      setSimData(data || []);
      setSimIsLoaded(true);
    } catch (err) { console.error("Erro Simulação:", err); }
    finally { setSimLoading(false); }
  };

  // GATILHOS DE ATIVAÇÃO EXPLÍCITA V9.2
  useEffect(() => {
    if (impFilters.ano && impFilters.mes && !impIsLoaded && !impLoading) {
      handleGerarImpressao();
    }
  }, [impFilters.ano, impFilters.mes, impIsLoaded]);

  useEffect(() => {
    if (simFilters.ano && simFilters.mes && !simIsLoaded && !simLoading) {
      handleGerarSimulacao();
    }
  }, [simFilters.ano, simFilters.mes, simIsLoaded]);

  const filteredImpData = useMemo(() => {
    return impData.filter(i => {
      const matchRz = !impFilters.rz || safeExtract(i, 'rz') === impFilters.rz;
      const matchMatr = !impFilters.matr || safeExtract(i, 'matr') === impFilters.matr;
      return matchRz && matchMatr;
    });
  }, [impData, impFilters.rz, impFilters.matr]);

  const filteredSimData = useMemo(() => {
    return simData.filter(i => {
      const motifStr = String(i.motivo || i.nosb_impedimento || '').toLowerCase();
      const matchRz = !simFilters.rz || safeExtract(i, 'rz') === simFilters.rz;
      const matchMatr = !simFilters.matr || safeExtract(i, 'matr') === simFilters.matr;
      const matchMotif = !simFilters.motivo || motifStr.includes(simFilters.motivo.toLowerCase());
      return matchRz && matchMatr && matchMotif;
    });
  }, [simData, simFilters.rz, simFilters.matr, simFilters.motivo]);

  const chartDataSim = useMemo(() => {
    const map: Record<string, number> = {};
    filteredSimData.forEach(d => {
      const key = d.motivo || d.nosb_impedimento || 'N/A';
      map[key] = (map[key] || 0) + 1;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value).slice(0, 10);
  }, [filteredSimData]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex bg-white p-2 rounded-2xl shadow-sm border border-slate-200">
        <button onClick={() => setActiveSubMenu(SubMenu.IMPRESSAO)} className={`flex-1 flex items-center justify-center gap-3 py-4 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${activeSubMenu === SubMenu.IMPRESSAO ? 'bg-slate-950 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}><Printer size={18} /> NOSB Impressão</button>
        <button onClick={() => setActiveSubMenu(SubMenu.SIMULACAO)} className={`flex-1 flex items-center justify-center gap-3 py-4 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${activeSubMenu === SubMenu.SIMULACAO ? 'bg-slate-950 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}><BarChart3 size={18} /> NOSB Simulação</button>
      </div>

      {activeSubMenu === SubMenu.IMPRESSAO ? (
        <div className="space-y-8 animate-in slide-in-from-left-4 duration-300">
          <section className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-200 relative">
            <div className="flex items-center gap-4 mb-8"><div className="p-3 bg-blue-50 text-blue-600 rounded-xl"><ShieldAlert size={20}/></div><h2 className="text-sm font-black text-slate-900 uppercase">Filtros Operacionais (Carga Automática)</h2></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ano</label>
                <select value={impFilters.ano} onChange={e => { setImpFilters({...impFilters, ano: e.target.value, rz: '', matr: ''}); setImpData([]); setImpIsLoaded(false); }} className="w-full bg-slate-50 border-2 rounded-xl py-3.5 px-4 text-sm font-bold"><option value="">Selecione</option>{impOptions.anos.map(a => <option key={a} value={a}>{a}</option>)}</select>
              </div>
              <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Mês</label>
                <select value={impFilters.mes} onChange={e => { setImpFilters({...impFilters, mes: e.target.value, rz: '', matr: ''}); setImpData([]); setImpIsLoaded(false); }} className="w-full bg-slate-50 border-2 rounded-xl py-3.5 px-4 text-sm font-bold"><option value="">Selecione</option>{impOptions.meses.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}</select>
              </div>
              <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Razão Social</label>
                <select value={impFilters.rz} onChange={e => setImpFilters({...impFilters, rz: e.target.value})} className="w-full bg-slate-50 border-2 rounded-xl py-3.5 px-4 text-sm font-bold" disabled={impLoading || !impIsLoaded}>
                   <option value="">{impLoading ? "Carregando..." : impIsLoaded ? "Todas as Razões" : "Aguardando Ano/Mês..."}</option>
                   {impDynamicOptions.razoes.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
              <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Matrícula</label>
                <select value={impFilters.matr} onChange={e => setImpFilters({...impFilters, matr: e.target.value})} className="w-full bg-slate-50 border-2 rounded-xl py-3.5 px-4 text-sm font-bold" disabled={impLoading || !impIsLoaded}>
                   <option value="">{impLoading ? "Carregando..." : impIsLoaded ? "Todas as Matrículas" : "Aguardando Ano/Mês..."}</option>
                   {impDynamicOptions.matriculas.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
            </div>
            <div className="mt-10 flex justify-center">
              <button onClick={handleGerarImpressao} disabled={impLoading || !impFilters.ano || !impFilters.mes} className="px-16 py-4 bg-slate-950 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-xl flex items-center gap-3">{impLoading ? <Activity className="animate-spin" size={18}/> : <RefreshCw size={16}/>} RECARREGAR BASE</button>
            </div>
          </section>

          {impIsLoaded && !impLoading && (
            <section className="bg-white rounded-[2rem] shadow-sm border border-slate-200 overflow-hidden">
              <div className="px-8 py-6 border-b flex items-center justify-between"><h3 className="text-xs font-black uppercase text-slate-900">Auditoria Real Time ({filteredImpData.length})</h3></div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[11px] border-collapse">
                  <thead className="bg-slate-50 text-slate-500 font-black uppercase border-b"><tr><th className="px-6 py-4">COMPETÊNCIA</th><th className="px-6 py-4">RAZÃO</th><th className="px-6 py-4 text-center">INSTALAÇÃO</th><th className="px-6 py-4">MOTIVO</th><th className="px-6 py-4 text-right">LEITURA</th></tr></thead>
                  <tbody className="divide-y divide-slate-100">{filteredImpData.slice(0, 500).map((r, i) => (
                    <tr key={i} className="hover:bg-slate-50"><td className="px-6 py-4">{r.mes}/{r.ano}</td><td className="px-6 py-4 font-bold">{safeExtract(r, 'rz')}</td><td className="px-6 py-4 text-center font-mono">{r.instalacao}</td><td className="px-6 py-4 italic text-blue-800">{r.motivo || r.nosb_impedimento}</td><td className="px-6 py-4 text-right font-black">{r.l_atual}</td></tr>
                  ))}</tbody>
                </table>
              </div>
            </section>
          )}
        </div>
      ) : (
        <div className="space-y-8 animate-in slide-in-from-right-4 duration-300">
           <section className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-200 relative">
             <div className="flex items-center gap-4 mb-8"><div className="p-3 bg-slate-900 text-white rounded-xl"><ScanLine size={20}/></div><h2 className="text-sm font-black text-slate-900 uppercase">Filtros Simulação (Carga Automática)</h2></div>
             <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
                <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ano</label><select value={simFilters.ano} onChange={e => { setSimFilters({...simFilters, ano: e.target.value, rz: '', matr: ''}); setSimData([]); setSimIsLoaded(false); }} className="w-full bg-slate-50 border-2 rounded-xl py-3.5 px-4 text-sm font-bold"><option value="">Selecione</option>{simOptions.anos.map(a => <option key={a} value={a}>{a}</option>)}</select></div>
                <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Mês</label><select value={simFilters.mes} onChange={e => { setSimFilters({...simFilters, mes: e.target.value, rz: '', matr: ''}); setSimData([]); setSimIsLoaded(false); }} className="w-full bg-slate-50 border-2 rounded-xl py-3.5 px-4 text-sm font-bold"><option value="">Selecione</option>{simOptions.meses.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}</select></div>
                <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Razão Social</label><select value={simFilters.rz} onChange={e => setSimFilters({...simFilters, rz: e.target.value})} className="w-full bg-slate-50 border-2 rounded-xl py-3.5 px-4 text-sm font-bold" disabled={simLoading || !simIsLoaded}><option value="">{simLoading ? "Carregando..." : simIsLoaded ? "Todas as Razões" : "Aguardando Ano/Mês..."}</option>{simDynamicOptions.razoes.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}</select></div>
                <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Matrícula</label><select value={simFilters.matr} onChange={e => setSimFilters({...simFilters, matr: e.target.value})} className="w-full bg-slate-50 border-2 rounded-xl py-3.5 px-4 text-sm font-bold" disabled={simLoading || !simIsLoaded}><option value="">{simLoading ? "Carregando..." : simIsLoaded ? "Todas as Matrículas" : "Aguardando Ano/Mês..."}</option>{simDynamicOptions.matriculas.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}</select></div>
                <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Motivo</label><input type="text" value={simFilters.motivo} onChange={e => setSimFilters({...simFilters, motivo: e.target.value})} className="w-full bg-slate-50 border-2 rounded-xl py-3.5 px-4 text-sm font-bold" placeholder="Filtrar Motivo..." /></div>
             </div>
             <div className="mt-10 flex justify-center"><button onClick={handleGerarSimulacao} disabled={simLoading || !simFilters.ano || !simFilters.mes} className="px-24 py-4 bg-slate-950 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-xl flex items-center gap-4">{simLoading ? <RefreshCw className="animate-spin" size={18}/> : <RefreshCw size={18}/>} REFRESH SIMULAÇÃO</button></div>
           </section>

           {simIsLoaded && !simLoading && (
             <div className="space-y-10 animate-in fade-in duration-500">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                   <section className="bg-white p-10 rounded-[2.5rem] shadow-sm border border-slate-200">
                      <h3 className="text-xs font-black uppercase mb-8 flex items-center gap-3"><TrendingUp size={20} className="text-blue-600"/> Impacto na Simulação</h3>
                      <div className="h-[350px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={chartDataSim} layout="vertical"><CartesianGrid strokeDasharray="3 3" horizontal={false} /><XAxis type="number" hide /><YAxis dataKey="name" type="category" width={120} tick={{fontSize: 9, fontWeight: '900'}} axisLine={false}/><Tooltip/><Bar dataKey="value" fill="#0f172a" radius={[0, 10, 10, 0]}/></BarChart></ResponsiveContainer></div>
                   </section>
                   <section className="bg-white rounded-[2.5rem] shadow-sm border overflow-hidden"><div className="px-8 py-6 bg-slate-50/50"><h3 className="text-xs font-black uppercase">Detalhamento ({filteredSimData.length})</h3></div><div className="overflow-y-auto max-h-[400px]"><table className="w-full text-left text-[10px]"><thead className="bg-slate-50 uppercase text-slate-400 font-black"><tr><th className="px-6 py-4">RAZÃO</th><th className="px-6 py-4">INSTAL.</th><th className="px-6 py-4">MOTIVO</th></tr></thead><tbody className="divide-y">{filteredSimData.slice(0, 200).map((r, i) => (<tr key={i} className="hover:bg-slate-50"><td className="px-6 py-3 font-bold">{safeExtract(r, 'rz')}</td><td className="px-6 py-3 font-mono text-blue-600">{r.instalacao}</td><td className="px-6 py-3 italic">{r.motivo || r.nosb_impedimento}</td></tr>))}</tbody></table></div></section>
                </div>
             </div>
           )}
        </div>
      )}

      {(impLoading || simLoading) && (
        <div className="flex flex-col items-center justify-center py-20 animate-pulse">
           <Activity className="animate-spin text-slate-900 mb-4" size={40} />
           <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Sincronizando Base...</p>
        </div>
      )}
    </div>
  );
};

export default NosbMotifs;

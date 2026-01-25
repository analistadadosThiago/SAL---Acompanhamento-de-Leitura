
import React from 'react';
import { 
  ListChecks, 
  Settings2, 
  Construction, 
  Database,
  ShieldCheck,
  Cpu
} from 'lucide-react';

const NosbMotifs: React.FC = () => {
  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20">
      {/* Cabeçalho do Módulo de Gestão */}
      <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-200 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-slate-900 via-blue-600 to-slate-900"></div>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div className="flex items-center gap-6">
            <div className="p-5 bg-slate-950 text-white rounded-[2rem] shadow-2xl shadow-slate-900/20">
              <ListChecks size={32} />
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter italic leading-none">
                Gestão de Motivos NOSB
              </h2>
              <div className="flex items-center gap-2 mt-2">
                <ShieldCheck size={14} className="text-blue-600" />
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">
                  Módulo Estrutural v9.0 | Core Analytics
                </p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-3 bg-slate-50 px-6 py-3 rounded-2xl border border-slate-100">
            <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse"></div>
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
              Aguardando Nova Integração
            </span>
          </div>
        </div>
      </div>

      {/* Container de Placeholder Profissional */}
      <section className="bg-white/50 border-2 border-dashed border-slate-200 rounded-[4rem] p-20 flex flex-col items-center justify-center text-center min-h-[500px] group transition-all hover:bg-white hover:border-blue-200">
        <div className="relative mb-10">
          <div className="absolute inset-0 bg-blue-100 rounded-full scale-150 blur-3xl opacity-20 group-hover:opacity-40 transition-opacity"></div>
          <div className="relative p-12 bg-white rounded-full shadow-xl border border-slate-100 text-slate-200 group-hover:text-blue-600 transition-colors">
            <Construction size={80} className="animate-pulse" />
          </div>
        </div>
        
        <div className="max-w-xl space-y-6">
          <h3 className="text-3xl font-black text-slate-900 uppercase tracking-tighter italic">
            Otimização de Módulo em Curso
          </h3>
          <p className="text-slate-500 font-medium text-sm leading-relaxed">
            Os submenus anteriores foram removidos para garantir a integridade do estado global do sistema. 
            O núcleo de processamento está sendo reconfigurado para suportar uma nova arquitetura 
            de análise de motivos NOSB com maior estabilidade e performance.
          </p>
          
          <div className="grid grid-cols-3 gap-4 pt-6">
            <div className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center gap-2">
              <Database size={16} className="text-slate-400" />
              <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Dataset Protegido</span>
            </div>
            <div className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center gap-2">
              <Cpu size={16} className="text-slate-400" />
              <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Engine Off</span>
            </div>
            <div className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center gap-2">
              <Settings2 size={16} className="text-slate-400" />
              <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Nova Config</span>
            </div>
          </div>
        </div>
      </section>

      {/* Footer Informativo */}
      <div className="flex justify-center">
        <p className="text-[9px] font-bold text-slate-300 uppercase tracking-[0.5em]">
          SAL v9.0 • Sistema Analítico de Leitura • 2024
        </p>
      </div>
    </div>
  );
};

export default NosbMotifs;

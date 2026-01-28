
import React, { useState } from 'react';
import { ShieldCheck, BarChart3, Search, Lock, User, ArrowRight, Globe, Zap } from 'lucide-react';

interface LoginProps {
  onLogin: () => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      onLogin();
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-[#020617] flex items-center justify-center p-6 relative overflow-hidden font-sans">
      {/* Background Decorative Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600/20 rounded-full blur-[120px] animate-pulse"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-600/10 rounded-full blur-[120px] animate-pulse"></div>
      
      <div className="w-full max-w-[1100px] grid grid-cols-1 lg:grid-cols-2 bg-slate-900/40 backdrop-blur-xl rounded-[3rem] border border-white/10 shadow-2xl overflow-hidden relative z-10">
        
        {/* Left Side: Branding & Info */}
        <div className="hidden lg:flex flex-col justify-between p-16 bg-gradient-to-br from-indigo-600 to-indigo-900 relative">
          <div className="absolute inset-0 opacity-10 pointer-events-none overflow-hidden">
             <div className="absolute top-0 left-0 w-full h-full transform rotate-12 scale-150">
               {[...Array(20)].map((_, i) => (
                 <div key={i} className="h-px bg-white w-full mb-8 opacity-20"></div>
               ))}
             </div>
          </div>

          <div className="relative z-10">
            <div className="flex items-center gap-4 mb-12">
              <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-2xl">
                <BarChart3 size={32} className="text-indigo-600" />
              </div>
              <h1 className="text-5xl font-black text-white tracking-tighter">SAL</h1>
            </div>
            
            <h2 className="text-4xl font-bold text-white leading-tight mb-6">
              O Futuro da <br /> 
              <span className="text-indigo-200 italic">Análise de Leitura</span>
            </h2>
            <p className="text-indigo-100/70 text-lg leading-relaxed max-w-sm font-medium">
              Monitoramento estratégico, controle de performance e inteligência artificial integrados em um só ecossistema empresarial.
            </p>
          </div>

          <div className="relative z-10 space-y-6">
             <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20">
                   <ShieldCheck size={20} className="text-emerald-400" />
                </div>
                <span className="text-white text-sm font-bold uppercase tracking-widest">Security Audit Level 4</span>
             </div>
             <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20">
                   <Zap size={20} className="text-amber-400" />
                </div>
                <span className="text-white text-sm font-bold uppercase tracking-widest">Real-time Data Sync</span>
             </div>
          </div>
        </div>

        {/* Right Side: Login Form */}
        <div className="p-12 lg:p-20 flex flex-col justify-center">
          <div className="mb-12">
            <h3 className="text-3xl font-black text-white tracking-tight mb-2">Acesso Restrito</h3>
            <p className="text-slate-400 text-sm font-medium uppercase tracking-[0.2em]">Insira suas credenciais corporativas</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Usuário / Matrícula</label>
              <div className="relative">
                <input 
                  type="text" 
                  required
                  placeholder="Ex: 102030"
                  className="w-full bg-slate-800/50 border border-white/10 rounded-2xl py-4 px-6 pl-14 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all font-bold placeholder:text-slate-600"
                />
                <User size={20} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500" />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Senha de Acesso</label>
              <div className="relative">
                <input 
                  type="password" 
                  required
                  placeholder="••••••••"
                  className="w-full bg-slate-800/50 border border-white/10 rounded-2xl py-4 px-6 pl-14 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all font-bold placeholder:text-slate-600"
                />
                <Lock size={20} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500" />
              </div>
            </div>

            <div className="flex items-center justify-between py-2">
              <label className="flex items-center gap-3 cursor-pointer group">
                <input type="checkbox" className="hidden" />
                <div className="w-5 h-5 rounded-md border border-white/10 bg-slate-800 flex items-center justify-center group-hover:border-indigo-500 transition-colors">
                  <div className="w-2 h-2 rounded-full bg-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                </div>
                <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Lembrar acesso</span>
              </label>
              <button type="button" className="text-xs text-indigo-400 font-black uppercase tracking-wider hover:text-indigo-300 transition-colors">Esqueceu a senha?</button>
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-5 rounded-2xl font-black text-xs uppercase tracking-[0.4em] shadow-2xl shadow-indigo-600/30 transition-all flex items-center justify-center gap-4 hover:scale-[1.02] active:scale-95 disabled:opacity-50"
            >
              {loading ? (
                <div className="h-5 w-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
              ) : (
                <>ACESSAR SISTEMA <ArrowRight size={18} /></>
              )}
            </button>
          </form>

          <div className="mt-12 pt-8 border-t border-white/5 flex flex-col items-center gap-6">
            <div className="flex items-center gap-2 text-slate-600">
               <Globe size={14} />
               <span className="text-[9px] font-black uppercase tracking-[0.3em]">Corporate Network v9.0.42</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;

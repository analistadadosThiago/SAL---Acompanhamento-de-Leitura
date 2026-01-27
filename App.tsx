
import React, { useState, useEffect } from 'react';
import { 
  LayoutGrid, Search, Menu as MenuIcon, X, ShieldCheck, 
  BarChart3, Users, LogOut, Bell, Globe, Camera,
  UserCircle, Settings, HelpCircle, Activity
} from 'lucide-react';
import { Menu } from './types';
import Dashboard from './components/Dashboard';
import TechnicalSearch from './components/TechnicalSearch';
import LeituristaControl from './components/LeituristaControl';
import EvidenceAuditControl from './components/EvidenceAuditControl';

const App: React.FC = () => {
  const [activeMenu, setActiveMenu] = useState<Menu>(Menu.INICIO);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = (e: any) => {
      setScrolled(e.target.scrollTop > 20);
    };
    const viewport = document.getElementById('main-viewport');
    viewport?.addEventListener('scroll', handleScroll);
    return () => viewport?.removeEventListener('scroll', handleScroll);
  }, []);

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  const renderContent = () => {
    switch(activeMenu) {
      case Menu.INICIO: return <Dashboard />;
      case Menu.CONSULTA_TECNICA: return <TechnicalSearch />;
      case Menu.CONTROLE_LEITURISTA: return <LeituristaControl />;
      case Menu.CONTROLE_EVIDENCIAS: return <EvidenceAuditControl />;
      default: return <Dashboard />;
    }
  };

  const getMenuTitle = () => {
    switch(activeMenu) {
      case Menu.INICIO: return 'Dashboard Operacional';
      case Menu.CONSULTA_TECNICA: return 'Pesquisa de Dados';
      case Menu.CONTROLE_LEITURISTA: return 'Controle de Leiturista';
      case Menu.CONTROLE_EVIDENCIAS: return 'Controle de Evidências';
      default: return 'SAL Enterprise';
    }
  };

  const menuItems = [
    { id: Menu.INICIO, label: 'Dashboard', icon: <LayoutGrid size={18} /> },
    { id: Menu.CONSULTA_TECNICA, label: 'Pesquisa', icon: <Search size={18} /> },
    { id: Menu.CONTROLE_LEITURISTA, label: 'Controle de Leiturista', icon: <Users size={18} /> },
    { id: Menu.CONTROLE_EVIDENCIAS, label: 'Controle de Evidências', icon: <Camera size={18} /> }
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-[#f8fafc] font-sans text-slate-900 selection:bg-indigo-100 selection:text-indigo-900">
      <aside className={`fixed inset-y-0 left-0 z-50 w-72 bg-[#020617] text-white shadow-2xl transition-all duration-500 lg:static lg:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex h-full flex-col">
          {/* Header Branding - Sidebar */}
          <div className="px-8 py-12 flex flex-col items-center text-center">
            <div className="relative group cursor-pointer mb-6">
              <div className="absolute -inset-4 bg-indigo-500/10 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
              <img 
                src="Logo.png" 
                alt="SAL Logo" 
                className="h-32 w-auto relative z-10 drop-shadow-[0_20px_30px_rgba(79,70,229,0.3)] transition-transform duration-500 group-hover:scale-105" 
                onError={(e) => {
                  e.currentTarget.src = 'https://raw.githubusercontent.com/lucide-icons/lucide/main/icons/bar-chart-3.svg';
                }}
              />
            </div>
            <div className="flex flex-col items-center">
              <h1 className="text-5xl font-black tracking-tighter text-white leading-none">
                SAL
              </h1>
              <div className="h-1 w-12 bg-indigo-500 my-4 rounded-full"></div>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] max-w-[150px] leading-relaxed">
                Sistema de Análise de Leitura
              </span>
            </div>
          </div>

          {/* Navigation - Sidebar */}
          <nav className="flex-1 space-y-1 px-6 mt-4 overflow-y-auto custom-scrollbar">
            <p className="px-4 text-[10px] font-black text-slate-600 uppercase tracking-[0.3em] mb-4">Menus</p>
            {menuItems.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  setActiveMenu(item.id);
                  if (window.innerWidth < 1024) setIsSidebarOpen(false);
                }}
                className={`flex w-full items-center gap-4 rounded-xl px-4 py-3.5 text-xs font-bold uppercase tracking-widest transition-all duration-300 ${activeMenu === item.id ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
              >
                <span className={`${activeMenu === item.id ? 'text-white' : 'text-slate-50'}`}>{item.icon}</span>
                {item.label}
              </button>
            ))}
          </nav>

          {/* Status Indicator - Bottom Sidebar */}
          <div className="p-6 border-t border-white/5 bg-[#020617]">
            <div className="bg-slate-900/40 rounded-2xl p-4 border border-white/5">
              <div className="flex items-center gap-3">
                <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]"></div>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Global Node: Active</span>
              </div>
            </div>
          </div>
        </div>
      </aside>

      <main className="flex flex-1 flex-col overflow-hidden relative">
        <header className={`flex h-20 items-center justify-between px-8 z-40 transition-all duration-300 ${scrolled ? 'bg-white/90 backdrop-blur-md shadow-sm border-b' : 'bg-transparent'}`}>
          <div className="flex items-center gap-6">
            <button onClick={toggleSidebar} className="lg:hidden text-slate-600 p-2.5 hover:bg-slate-100 rounded-xl transition-all">
              {isSidebarOpen ? <X size={24} /> : <MenuIcon size={24} />}
            </button>
            <div className="flex flex-col">
              <h1 className="text-xl font-black text-slate-900 tracking-tight uppercase italic flex items-center gap-3">
                {getMenuTitle()}
              </h1>
              <div className="flex items-center gap-2 mt-0.5">
                 <Globe size={10} className="text-indigo-500" />
                 <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Monitoramento de Rede em Tempo Real</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-5">
             <button className="hidden sm:flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 rounded-xl text-[10px] font-black uppercase hover:bg-indigo-100 transition-all">
               <ShieldCheck size={14} /> SECURITY AUDIT: ON
             </button>
             <button className="p-3 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-2xl transition-all relative">
                <Bell size={20} />
                <span className="absolute top-3 right-3 h-2 w-2 bg-rose-500 rounded-full border-2 border-white"></span>
             </button>
             <div className="h-8 w-px bg-slate-200 mx-1"></div>
             <div className="flex items-center gap-3 pl-2 group cursor-pointer">
                <div className="h-11 w-11 rounded-2xl bg-slate-100 flex items-center justify-center border-2 border-slate-200 transition-all group-hover:border-indigo-500 group-hover:scale-105 overflow-hidden">
                  <UserCircle size={24} className="text-slate-400" />
                </div>
             </div>
          </div>
        </header>

        <div id="main-viewport" className="flex-1 overflow-y-auto p-6 lg:p-10 custom-scrollbar scroll-smooth">
          <div className="mx-auto max-w-7xl">{renderContent()}</div>
        </div>
      </main>
    </div>
  );
};

export default App;

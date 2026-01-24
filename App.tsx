
import React, { useState } from 'react';
import { 
  LayoutGrid, Search, Menu as MenuIcon, X, ShieldCheck, 
  BarChart3, Users, Image as ImageIcon, Printer, 
  Settings, LogOut, Bell, Globe
} from 'lucide-react';
import { Menu } from './types';
import Dashboard from './components/Dashboard';
import TechnicalSearch from './components/TechnicalSearch';
import LeituristaControl from './components/LeituristaControl';
import EvidenceControl from './components/EvidenceControl';
import PrintControl from './components/PrintControl';

const App: React.FC = () => {
  const [activeMenu, setActiveMenu] = useState<Menu>(Menu.INICIO);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  const renderContent = () => {
    switch(activeMenu) {
      case Menu.INICIO: return <Dashboard />;
      case Menu.CONSULTA_TECNICA: return <TechnicalSearch />;
      case Menu.CONTROLE_LEITURISTA: return <LeituristaControl />;
      case Menu.CONTROLE_EVIDENCIAS: return <EvidenceControl />;
      case Menu.CONTROLE_IMPRESSAO: return <PrintControl />;
      default: return <Dashboard />;
    }
  };

  const getMenuTitle = () => {
    switch(activeMenu) {
      case Menu.INICIO: return 'Analytics Estratégico';
      case Menu.CONSULTA_TECNICA: return 'Consulta Operacional';
      case Menu.CONTROLE_LEITURISTA: return 'Performance de Campo';
      case Menu.CONTROLE_EVIDENCIAS: return 'Auditoria de Evidências';
      case Menu.CONTROLE_IMPRESSAO: return 'Controle de Impressão';
      default: return 'SAL v9.0';
    }
  };

  const menuItems = [
    { id: Menu.INICIO, label: 'Dashboard', icon: <LayoutGrid size={20} /> },
    { id: Menu.CONSULTA_TECNICA, label: 'Consulta Técnica', icon: <Search size={20} /> },
    { id: Menu.CONTROLE_LEITURISTA, label: 'Produtividade', icon: <Users size={20} /> },
    { id: Menu.CONTROLE_EVIDENCIAS, label: 'Auditoria', icon: <ImageIcon size={20} /> },
    { id: Menu.CONTROLE_IMPRESSAO, label: 'Impressão', icon: <Printer size={20} /> },
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-[#f0f2f5] font-sans text-slate-900 selection:bg-blue-100 selection:text-blue-900">
      {/* Sidebar Corporativa Premium */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-72 bg-[#0a0c10] text-white shadow-2xl transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] lg:static lg:translate-x-0
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex h-full flex-col">
          {/* Logo Section */}
          <div className="px-8 py-10 border-b border-white/5">
            <div className="flex items-center gap-4 group cursor-pointer">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-700 shadow-xl shadow-blue-500/20 ring-1 ring-white/20 transition-transform group-hover:scale-105">
                <BarChart3 size={24} className="text-white" />
              </div>
              <div className="flex flex-col">
                <span className="text-xl font-black tracking-tight text-white leading-none">SAL <span className="text-blue-500">v9</span></span>
                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-1">SISTEMA ANALÍTICO</span>
              </div>
            </div>
          </div>

          {/* Navigation Menu */}
          <nav className="flex-1 space-y-1.5 p-6 mt-4 overflow-y-auto">
            <p className="px-4 text-[10px] font-black text-slate-600 uppercase tracking-[0.2em] mb-4">Módulos do Sistema</p>
            {menuItems.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  setActiveMenu(item.id);
                  if (window.innerWidth < 1024) setIsSidebarOpen(false);
                }}
                className={`flex w-full items-center gap-4 rounded-xl px-4 py-3.5 text-xs font-bold uppercase tracking-wider transition-all duration-200 ${
                  activeMenu === item.id 
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30 translate-x-1' 
                    : 'text-slate-400 hover:bg-white/5 hover:text-white'
                }`}
              >
                <span className={`${activeMenu === item.id ? 'text-white' : 'text-slate-500'}`}>
                  {item.icon}
                </span>
                {item.label}
              </button>
            ))}
          </nav>

          {/* Footer Sidebar */}
          <div className="p-6 border-t border-white/5 space-y-4">
            <div className="bg-slate-900/50 rounded-2xl p-4 border border-white/5">
              <div className="flex items-center gap-3">
                <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Servidor Online</span>
              </div>
            </div>
            <button className="flex w-full items-center gap-3 px-4 py-2 text-slate-500 hover:text-red-400 text-xs font-bold transition-colors">
              <LogOut size={16} />
              SAIR DO SISTEMA
            </button>
          </div>
        </div>
      </aside>

      {/* Main Container */}
      <main className="flex flex-1 flex-col overflow-hidden relative">
        {/* Modern Header */}
        <header className="flex h-20 items-center justify-between border-b bg-white/80 backdrop-blur-xl px-8 z-30">
          <div className="flex items-center gap-6">
            <button onClick={toggleSidebar} className="lg:hidden text-slate-600 p-2 hover:bg-slate-100 rounded-xl transition-all">
              {isSidebarOpen ? <X size={24} /> : <MenuIcon size={24} />}
            </button>
            <div className="flex flex-col">
              <h1 className="text-xl font-black text-slate-900 tracking-tight uppercase">
                {getMenuTitle()}
              </h1>
              <div className="flex items-center gap-2 mt-0.5">
                 <Globe size={10} className="text-blue-500" />
                 <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                   Monitoramento em Tempo Real
                 </p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
             <button className="p-2.5 text-slate-400 hover:text-slate-900 hover:bg-slate-50 rounded-xl transition-all relative">
                <Bell size={20} />
                <span className="absolute top-2 right-2 h-2 w-2 bg-red-500 rounded-full border-2 border-white"></span>
             </button>
             <div className="h-8 w-px bg-slate-200 mx-2"></div>
             <div className="flex items-center gap-3 pl-2">
                <div className="text-right hidden sm:block">
                   <p className="text-xs font-black text-slate-900 leading-none">ANALISTA MASTER</p>
                   <span className="text-[9px] font-bold text-blue-600 uppercase tracking-widest">ADMINISTRADOR</span>
                </div>
                <div className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center border border-slate-200">
                  <ShieldCheck size={20} className="text-slate-400" />
                </div>
             </div>
          </div>
        </header>

        {/* Viewport Area */}
        <div className="flex-1 overflow-y-auto bg-slate-50/50 p-6 lg:p-10 custom-scrollbar">
          <div className="mx-auto max-w-7xl">
            {renderContent()}
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;

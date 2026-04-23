import { useState } from "react";
import { MainLayout } from "./components/layout/MainLayout";
import { Dashboard } from "./pages/Dashboard";
import { Folders } from "./pages/Folders";
import { Settings } from "./pages/Settings";
import { History } from "./pages/History";
import { HookPage } from "./pages/Hook";
import { LogsPage } from "./pages/Logs";
import { TabType } from "./components/layout/Sidebar";
import { useThemeInit } from "./hooks/useThemeInit";

function App() {
  const [activeTab, setActiveTab] = useState<TabType>('Dashboard');

  useThemeInit();

  return (
    <MainLayout activeTab={activeTab} onTabChange={setActiveTab}>
      {activeTab === 'Dashboard' ? (
        <Dashboard onTabChange={setActiveTab} />
      ) : activeTab === 'Folders' ? (
        <Folders />
      ) : activeTab === 'History' ? (
        <History />
      ) : activeTab === 'Settings' ? (
        <Settings />
      ) : activeTab === 'Hook' ? (
        <HookPage />
      ) : activeTab === 'Logs' ? (
        <LogsPage />
      ) : (
        <div className="flex items-center justify-center h-full min-h-[400px] animate-in fade-in zoom-in-95 duration-300">
          <div className="text-center space-y-3">
            <div className="w-16 h-16 rounded-2xl bg-back-200 border border-bc-100 mx-auto flex items-center justify-center shadow-(--shadow-soft)">
              <span className="text-2xl opacity-50 text-accent">✨</span>
            </div>
            <h2 className="text-2xl font-semibold text-primary">{activeTab}</h2>
            <p className="text-secondary">This section is currently under construction.</p>
          </div>
        </div>
      )}
    </MainLayout>
  );
}

export default App;

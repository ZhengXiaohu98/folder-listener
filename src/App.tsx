import { useState } from "react";
import { MainLayout } from "./components/layout/MainLayout";
import { Dashboard } from "./pages/Dashboard";
import { Settings } from "./pages/Settings";
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
      ) : activeTab === 'Settings' ? (
        <Settings />
      ) : activeTab === 'Logs' ? (
        <LogsPage />
      ) : (
        <></>
      )}
    </MainLayout>
  );
}

export default App;

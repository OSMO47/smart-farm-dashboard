import { useState } from 'react';
import Dashboard from './components/Dashboard';
import SimulatorControlPanel from './components/SimulatorControlPanel';

type View = 'dashboard' | 'simulator';

const TABS: { id: View; label: string }[] = [
  { id: 'dashboard', label: 'แดชบอร์ด · Dashboard' },
  { id: 'simulator', label: 'จำลองข้อมูล · Simulator' },
];

function TabBar({ view, onChange }: { view: View; onChange: (view: View) => void }) {
  return (
    <div className="max-w-[1400px] mx-auto flex gap-2">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className="text-[13px] font-bold px-3.5 py-2 rounded-full border transition-colors"
          style={
            view === tab.id
              ? { background: '#1f9d55', color: '#ffffff', borderColor: '#1f9d55' }
              : { background: '#ffffff', color: '#5b6d61', borderColor: '#d9e8dd' }
          }
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

function App() {
  const [view, setView] = useState<View>('dashboard');

  if (view === 'simulator') {
    return (
      <div className="min-h-screen p-4 sm:p-6 lg:p-9 box-border" style={{ background: '#f2f7f3' }}>
        <div className="mb-4">
          <TabBar view={view} onChange={setView} />
        </div>
        <SimulatorControlPanel />
      </div>
    );
  }

  return (
    <div style={{ background: '#f2f7f3' }}>
      <div className="pt-4 px-4 sm:px-6 lg:px-9 box-border">
        <TabBar view={view} onChange={setView} />
      </div>
      <Dashboard />
    </div>
  );
}

export default App;

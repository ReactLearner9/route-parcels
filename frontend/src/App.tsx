import { SiteHeader } from './components/layout/site-header';
import { HomePage } from './pages/home-page';

export default function App() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <SiteHeader />
      <HomePage />
    </div>
  );
}

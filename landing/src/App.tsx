import { Routes, Route } from 'react-router-dom';
import { LandingPage } from './pages/LandingPage';
import { DocsPage } from './pages/DocsPage';
import { TermsPage } from './pages/TermsPage';
import { PrivacyPage } from './pages/PrivacyPage';
import { DownloadPage } from './pages/DownloadPage';

function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/docs" element={<DocsPage />} />
      <Route path="/terms" element={<TermsPage />} />
      <Route path="/privacy" element={<PrivacyPage />} />
      <Route path="/download" element={<DownloadPage />} />
      <Route path="/download/:os" element={<DownloadPage />} />
    </Routes>
  );
}

export default App;
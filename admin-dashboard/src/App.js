import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { theme } from './theme';

// Composants
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Updates from './pages/Updates';
import Metrics from './pages/Metrics';
import Errors from './pages/Errors';
import Settings from './pages/Settings';

// Contexte
import { AuthProvider } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <NotificationProvider>
          <Router>
            <Layout>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/updates" element={<Updates />} />
                <Route path="/metrics" element={<Metrics />} />
                <Route path="/errors" element={<Errors />} />
                <Route path="/settings" element={<Settings />} />
              </Routes>
            </Layout>
          </Router>
        </NotificationProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;

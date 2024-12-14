import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { ThemeProvider } from '@mui/material/styles';
import { theme } from '../theme';
import Dashboard from '../pages/Dashboard';
import { fetchDashboardData } from '../api/dashboard';

// Mock des dépendances
vi.mock('../api/dashboard');

const mockDashboardData = {
  systemMetrics: {
    cpu: 45,
    memory: 2048,
    cpuTrend: 'up',
    memoryTrend: 'stable'
  },
  errorRates: {
    current: 2.5,
    previous: 3.0
  },
  updateStatus: {
    status: 'up-to-date',
    version: '1.0.0',
    lastCheck: '2024-12-14T03:54:17Z',
    pendingUpdates: 0
  },
  activeUsers: {
    current: 150,
    trend: 'up'
  },
  performanceData: [
    { time: '00:00', cpu: 40, memory: 1800 },
    { time: '01:00', cpu: 45, memory: 2000 }
  ],
  usageDistribution: [
    { name: 'Feature A', value: 30 },
    { name: 'Feature B', value: 40 }
  ]
};

describe('Dashboard', () => {
  beforeEach(() => {
    fetchDashboardData.mockResolvedValue(mockDashboardData);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const renderDashboard = () => {
    return render(
      <ThemeProvider theme={theme}>
        <Dashboard />
      </ThemeProvider>
    );
  };

  test('charge et affiche les données du tableau de bord', async () => {
    renderDashboard();

    // Vérification du chargement initial
    expect(screen.getByText(/Chargement.../i)).toBeInTheDocument();

    // Vérification des données chargées
    await waitFor(() => {
      expect(fetchDashboardData).toHaveBeenCalledTimes(1);
      expect(screen.getByText('45%')).toBeInTheDocument(); // CPU
      expect(screen.getByText('2048MB')).toBeInTheDocument(); // Mémoire
    });
  });

  test('affiche correctement les métriques système', async () => {
    renderDashboard();

    await waitFor(() => {
      // Vérification des cartes de métrique
      const cpuCard = screen.getByText(/CPU/i).closest('.MuiPaper-root');
      const memoryCard = screen.getByText(/Mémoire/i).closest('.MuiPaper-root');

      expect(cpuCard).toBeInTheDocument();
      expect(memoryCard).toBeInTheDocument();
      expect(cpuCard).toHaveTextContent('45%');
      expect(memoryCard).toHaveTextContent('2048MB');
    });
  });

  test('affiche correctement les graphiques', async () => {
    renderDashboard();

    await waitFor(() => {
      // Vérification du graphique de performance
      expect(screen.getByText('Performance sur 24h')).toBeInTheDocument();
      
      // Vérification du graphique de distribution
      expect(screen.getByText('Distribution d\'utilisation')).toBeInTheDocument();
    });
  });

  test('affiche le statut des mises à jour', async () => {
    renderDashboard();

    await waitFor(() => {
      const updateCard = screen.getByText(/Statut des mises à jour/i)
        .closest('.MuiPaper-root');
      
      expect(updateCard).toBeInTheDocument();
      expect(updateCard).toHaveTextContent('1.0.0');
      expect(updateCard).toHaveTextContent('up-to-date');
    });
  });

  test('gère les erreurs de chargement', async () => {
    const error = new Error('Erreur de chargement');
    fetchDashboardData.mockRejectedValueOnce(error);

    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText(/Erreur:/i)).toBeInTheDocument();
    });
  });

  test('met à jour les données périodiquement', async () => {
    vi.useFakeTimers();
    renderDashboard();

    await waitFor(() => {
      expect(fetchDashboardData).toHaveBeenCalledTimes(1);
    });

    // Avance le temps de 1 minute
    vi.advanceTimersByTime(60000);

    await waitFor(() => {
      expect(fetchDashboardData).toHaveBeenCalledTimes(2);
    });

    vi.useRealTimers();
  });

  test('affiche correctement les tendances', async () => {
    renderDashboard();

    await waitFor(() => {
      // Vérification des icônes de tendance
      const upTrendIcons = screen.getAllByTestId('trending-up-icon');
      const stableTrendIcons = screen.getAllByTestId('trending-flat-icon');
      
      expect(upTrendIcons.length).toBeGreaterThan(0);
      expect(stableTrendIcons.length).toBeGreaterThan(0);
    });
  });

  test('affiche correctement le nombre d\'utilisateurs actifs', async () => {
    renderDashboard();

    await waitFor(() => {
      const activeUsersCard = screen.getByText(/Utilisateurs actifs/i)
        .closest('.MuiPaper-root');
      
      expect(activeUsersCard).toBeInTheDocument();
      expect(activeUsersCard).toHaveTextContent('150');
      expect(activeUsersCard).toHaveTextContent('up');
    });
  });
});

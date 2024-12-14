import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { ThemeProvider } from '@mui/material/styles';
import { theme } from '../theme';
import Metrics from '../pages/Metrics';
import { fetchMetrics } from '../api/metrics';

// Mock des dépendances
vi.mock('../api/metrics');

const mockMetricsData = {
  systemMetrics: [
    { timestamp: '2024-12-14T03:00:00Z', cpu: 45, memory: 2048, disk: 70 },
    { timestamp: '2024-12-14T03:30:00Z', cpu: 50, memory: 2100, disk: 71 }
  ],
  errorDistribution: [
    { name: 'Type A', value: 30 },
    { name: 'Type B', value: 20 }
  ],
  featureUsage: [
    { name: 'Feature 1', count: 100 },
    { name: 'Feature 2', count: 80 }
  ],
  performanceMetrics: [
    { timestamp: '2024-12-14T03:00:00Z', responseTime: 200, throughput: 50 },
    { timestamp: '2024-12-14T03:30:00Z', responseTime: 220, throughput: 48 }
  ]
};

describe('Metrics', () => {
  beforeEach(() => {
    fetchMetrics.mockResolvedValue(mockMetricsData);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const renderMetrics = () => {
    return render(
      <ThemeProvider theme={theme}>
        <Metrics />
      </ThemeProvider>
    );
  };

  test('charge et affiche les métriques', async () => {
    renderMetrics();

    await waitFor(() => {
      expect(fetchMetrics).toHaveBeenCalledTimes(1);
      expect(screen.getByText('Métriques système')).toBeInTheDocument();
      expect(screen.getByText('Distribution des erreurs')).toBeInTheDocument();
    });
  });

  test('permet de changer la période', async () => {
    renderMetrics();

    // Change la période à 7 jours
    const periodSelect = screen.getByLabelText('Période');
    fireEvent.mouseDown(periodSelect);
    fireEvent.click(screen.getByText('7 jours'));

    await waitFor(() => {
      expect(fetchMetrics).toHaveBeenCalledWith(
        expect.objectContaining({ timeRange: '7d' })
      );
    });
  });

  test('permet de sélectionner une période personnalisée', async () => {
    renderMetrics();

    // Sélectionne la période personnalisée
    const periodSelect = screen.getByLabelText('Période');
    fireEvent.mouseDown(periodSelect);
    fireEvent.click(screen.getByText('Personnalisé'));

    // Les sélecteurs de date devraient apparaître
    expect(screen.getByLabelText('Date de début')).toBeInTheDocument();
    expect(screen.getByLabelText('Date de fin')).toBeInTheDocument();

    // Sélectionne les dates
    const startDate = screen.getByLabelText('Date de début');
    const endDate = screen.getByLabelText('Date de fin');

    fireEvent.change(startDate, { target: { value: '2024-12-01' } });
    fireEvent.change(endDate, { target: { value: '2024-12-14' } });

    await waitFor(() => {
      expect(fetchMetrics).toHaveBeenCalledWith(
        expect.objectContaining({
          startDate: expect.any(Date),
          endDate: expect.any(Date)
        })
      );
    });
  });

  test('permet de changer le type de métrique', async () => {
    renderMetrics();

    // Change le type de métrique
    const typeSelect = screen.getByLabelText('Type de métrique');
    fireEvent.mouseDown(typeSelect);
    fireEvent.click(screen.getByText('Performance'));

    await waitFor(() => {
      expect(fetchMetrics).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'performance' })
      );
    });
  });

  test('affiche correctement les graphiques', async () => {
    renderMetrics();

    await waitFor(() => {
      // Vérifie la présence des composants de graphique
      expect(screen.getByText('Métriques système')).toBeInTheDocument();
      expect(screen.getByText('Distribution des erreurs')).toBeInTheDocument();
      expect(screen.getByText('Utilisation par fonctionnalité')).toBeInTheDocument();
      expect(screen.getByText('Métriques de performance')).toBeInTheDocument();
    });
  });

  test('gère les erreurs de chargement', async () => {
    fetchMetrics.mockRejectedValueOnce(new Error('Erreur de chargement'));
    renderMetrics();

    await waitFor(() => {
      expect(screen.getByText(/Erreur lors du chargement des métriques/i))
        .toBeInTheDocument();
    });
  });

  test('met à jour les graphiques lors du changement de filtre', async () => {
    renderMetrics();

    // Change plusieurs filtres
    const periodSelect = screen.getByLabelText('Période');
    fireEvent.mouseDown(periodSelect);
    fireEvent.click(screen.getByText('24 heures'));

    const typeSelect = screen.getByLabelText('Type de métrique');
    fireEvent.mouseDown(typeSelect);
    fireEvent.click(screen.getByText('Erreurs'));

    await waitFor(() => {
      expect(fetchMetrics).toHaveBeenCalledTimes(3); // Initial + 2 changements
    });
  });

  test('affiche les tooltips sur les graphiques', async () => {
    renderMetrics();

    await waitFor(() => {
      // Simule le survol d'un point de données
      const dataPoint = screen.getByTestId('chart-data-point');
      fireEvent.mouseOver(dataPoint);

      // Vérifie que le tooltip apparaît
      expect(screen.getByTestId('chart-tooltip')).toBeInTheDocument();
      expect(screen.getByTestId('chart-tooltip')).toHaveTextContent('45%');
    });
  });
});

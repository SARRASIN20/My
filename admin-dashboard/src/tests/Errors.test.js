import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { ThemeProvider } from '@mui/material/styles';
import { theme } from '../theme';
import Errors from '../pages/Errors';
import { fetchErrors, resolveError, updateErrorStatus } from '../api/errors';

// Mock des dépendances
vi.mock('../api/errors');

const mockErrors = [
  {
    id: '1',
    timestamp: '2024-12-14T03:54:17Z',
    type: 'RuntimeError',
    message: 'Erreur inattendue',
    stack: 'Error: Erreur inattendue\n    at Function.execute',
    status: 'open',
    priority: 'high',
    count: 5
  },
  {
    id: '2',
    timestamp: '2024-12-14T03:50:00Z',
    type: 'NetworkError',
    message: 'Timeout',
    stack: 'Error: Timeout\n    at ApiClient.request',
    status: 'resolved',
    priority: 'medium',
    count: 2
  }
];

describe('Errors', () => {
  beforeEach(() => {
    fetchErrors.mockResolvedValue(mockErrors);
    resolveError.mockResolvedValue({ success: true });
    updateErrorStatus.mockResolvedValue({ success: true });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const renderErrors = () => {
    return render(
      <ThemeProvider theme={theme}>
        <Errors />
      </ThemeProvider>
    );
  };

  test('charge et affiche la liste des erreurs', async () => {
    renderErrors();

    await waitFor(() => {
      expect(fetchErrors).toHaveBeenCalledTimes(1);
      expect(screen.getByText('Erreur inattendue')).toBeInTheDocument();
      expect(screen.getByText('Timeout')).toBeInTheDocument();
    });
  });

  test('filtre les erreurs par statut', async () => {
    renderErrors();

    // Sélectionne le filtre "Résolu"
    const statusSelect = screen.getByLabelText('Statut');
    fireEvent.mouseDown(statusSelect);
    fireEvent.click(screen.getByText('Résolu'));

    await waitFor(() => {
      expect(fetchErrors).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'resolved' })
      );
    });
  });

  test('filtre les erreurs par priorité', async () => {
    renderErrors();

    // Sélectionne le filtre "Haute"
    const prioritySelect = screen.getByLabelText('Priorité');
    fireEvent.mouseDown(prioritySelect);
    fireEvent.click(screen.getByText('Haute'));

    await waitFor(() => {
      expect(fetchErrors).toHaveBeenCalledWith(
        expect.objectContaining({ priority: 'high' })
      );
    });
  });

  test('ouvre le dialogue de détails d\'erreur', async () => {
    renderErrors();

    await waitFor(() => {
      // Clique sur une erreur pour voir les détails
      const errorRow = screen.getByText('Erreur inattendue').closest('tr');
      fireEvent.click(errorRow);

      expect(screen.getByText('Détails de l\'erreur')).toBeInTheDocument();
      expect(screen.getByText('RuntimeError')).toBeInTheDocument();
      expect(screen.getByText(/Error: Erreur inattendue/)).toBeInTheDocument();
    });
  });

  test('résout une erreur', async () => {
    renderErrors();

    await waitFor(() => {
      // Ouvre les détails de l'erreur
      const errorRow = screen.getByText('Erreur inattendue').closest('tr');
      fireEvent.click(errorRow);
    });

    // Clique sur le bouton de résolution
    fireEvent.click(screen.getByText('Résoudre'));

    await waitFor(() => {
      expect(resolveError).toHaveBeenCalledWith('1');
      expect(fetchErrors).toHaveBeenCalledTimes(2); // Initial + refresh
    });
  });

  test('met à jour le statut d\'une erreur', async () => {
    renderErrors();

    await waitFor(() => {
      // Ouvre les détails de l'erreur
      const errorRow = screen.getByText('Erreur inattendue').closest('tr');
      fireEvent.click(errorRow);
    });

    // Change le statut
    const statusSelect = screen.getByLabelText('Changer le statut');
    fireEvent.mouseDown(statusSelect);
    fireEvent.click(screen.getByText('En cours'));

    await waitFor(() => {
      expect(updateErrorStatus).toHaveBeenCalledWith('1', 'in_progress');
      expect(fetchErrors).toHaveBeenCalledTimes(2); // Initial + refresh
    });
  });

  test('affiche la pagination', async () => {
    renderErrors();

    await waitFor(() => {
      expect(screen.getByLabelText('pagination navigation')).toBeInTheDocument();
    });

    // Change de page
    fireEvent.click(screen.getByLabelText('Go to page 2'));

    await waitFor(() => {
      expect(fetchErrors).toHaveBeenCalledWith(
        expect.objectContaining({ page: 1 }) // 0-based index
      );
    });
  });

  test('permet la recherche d\'erreurs', async () => {
    renderErrors();

    // Entre un terme de recherche
    const searchInput = screen.getByPlaceholderText('Rechercher des erreurs...');
    fireEvent.change(searchInput, { target: { value: 'timeout' } });

    // Attendre un peu pour le debounce
    await new Promise(resolve => setTimeout(resolve, 300));

    await waitFor(() => {
      expect(fetchErrors).toHaveBeenCalledWith(
        expect.objectContaining({ search: 'timeout' })
      );
    });
  });

  test('affiche les statistiques d\'erreur', async () => {
    renderErrors();

    await waitFor(() => {
      expect(screen.getByText('Erreurs totales:')).toBeInTheDocument();
      expect(screen.getByText('7')).toBeInTheDocument(); // 5 + 2 du mock
    });
  });

  test('gère les erreurs de chargement', async () => {
    fetchErrors.mockRejectedValueOnce(new Error('Erreur de chargement'));
    renderErrors();

    await waitFor(() => {
      expect(screen.getByText(/Erreur lors du chargement des erreurs/i))
        .toBeInTheDocument();
    });
  });

  test('permet l\'export des erreurs', async () => {
    renderErrors();

    // Clique sur le bouton d'export
    fireEvent.click(screen.getByText('Exporter'));

    // Vérifie que le fichier est généré
    expect(window.URL.createObjectURL).toHaveBeenCalled();
    expect(document.createElement('a').click).toHaveBeenCalled();
  });
});

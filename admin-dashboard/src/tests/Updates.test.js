import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { ThemeProvider } from '@mui/material/styles';
import { theme } from '../theme';
import Updates from '../pages/Updates';
import { fetchUpdates, createUpdate, uploadUpdate } from '../api/updates';

// Mock des dépendances
vi.mock('../api/updates');

const mockUpdates = [
  {
    id: '1',
    version: '1.1.0',
    platform: 'win',
    publishedAt: '2024-12-14T03:54:17Z',
    minimumVersion: '1.0.0',
    downloads: 150,
    status: 'active',
    downloadUrl: 'https://example.com/updates/1.1.0'
  },
  {
    id: '2',
    version: '1.0.0',
    platform: 'win',
    publishedAt: '2024-12-13T00:00:00Z',
    minimumVersion: '0.9.0',
    downloads: 500,
    status: 'active',
    downloadUrl: 'https://example.com/updates/1.0.0'
  }
];

describe('Updates', () => {
  beforeEach(() => {
    fetchUpdates.mockResolvedValue(mockUpdates);
    createUpdate.mockResolvedValue({ id: '3', ...mockUpdates[0] });
    uploadUpdate.mockResolvedValue({ success: true });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const renderUpdates = () => {
    return render(
      <ThemeProvider theme={theme}>
        <Updates />
      </ThemeProvider>
    );
  };

  test('charge et affiche la liste des mises à jour', async () => {
    renderUpdates();

    await waitFor(() => {
      expect(fetchUpdates).toHaveBeenCalledTimes(1);
      expect(screen.getByText('1.1.0')).toBeInTheDocument();
      expect(screen.getByText('1.0.0')).toBeInTheDocument();
    });
  });

  test('ouvre le dialogue de création de mise à jour', async () => {
    renderUpdates();

    const createButton = screen.getByText('Nouvelle mise à jour');
    fireEvent.click(createButton);

    expect(screen.getByText('Nouvelle mise à jour')).toBeInTheDocument();
    expect(screen.getByLabelText('Version')).toBeInTheDocument();
    expect(screen.getByLabelText('Plateforme')).toBeInTheDocument();
  });

  test('crée une nouvelle mise à jour', async () => {
    renderUpdates();

    // Ouvre le dialogue
    fireEvent.click(screen.getByText('Nouvelle mise à jour'));

    // Remplit le formulaire
    fireEvent.change(screen.getByLabelText('Version'), {
      target: { value: '1.2.0' }
    });
    
    fireEvent.change(screen.getByLabelText('Version minimale requise'), {
      target: { value: '1.0.0' }
    });

    fireEvent.change(screen.getByLabelText('Notes de mise à jour'), {
      target: { value: 'Test notes' }
    });

    // Simule la sélection d'un fichier
    const file = new File(['test'], 'update.zip', { type: 'application/zip' });
    const fileInput = screen.getByLabelText(/Sélectionner le fichier/i);
    Object.defineProperty(fileInput, 'files', {
      value: [file]
    });
    fireEvent.change(fileInput);

    // Soumet le formulaire
    fireEvent.click(screen.getByText('Créer'));

    await waitFor(() => {
      expect(createUpdate).toHaveBeenCalledTimes(1);
      expect(uploadUpdate).toHaveBeenCalledTimes(1);
      expect(fetchUpdates).toHaveBeenCalledTimes(2); // Initial + refresh
    });
  });

  test('affiche les erreurs de création', async () => {
    createUpdate.mockRejectedValueOnce(new Error('Erreur test'));
    renderUpdates();

    // Ouvre le dialogue
    fireEvent.click(screen.getByText('Nouvelle mise à jour'));

    // Remplit et soumet le formulaire
    fireEvent.change(screen.getByLabelText('Version'), {
      target: { value: '1.2.0' }
    });
    fireEvent.click(screen.getByText('Créer'));

    await waitFor(() => {
      expect(screen.getByText('Erreur lors de la création de la mise à jour'))
        .toBeInTheDocument();
    });
  });

  test('permet le téléchargement des mises à jour', async () => {
    const { container } = renderUpdates();

    await waitFor(() => {
      const downloadButtons = screen.getAllByText('Télécharger');
      expect(downloadButtons.length).toBe(mockUpdates.length);
    });

    // Simule le clic sur le bouton de téléchargement
    const firstDownloadButton = screen.getAllByText('Télécharger')[0];
    fireEvent.click(firstDownloadButton);

    // Vérifie que l'URL de téléchargement est correcte
    expect(window.open).toHaveBeenCalledWith(mockUpdates[0].downloadUrl);
  });

  test('filtre les mises à jour par plateforme', async () => {
    renderUpdates();

    // Simule la sélection d'une plateforme
    const platformSelect = screen.getByLabelText('Plateforme');
    fireEvent.mouseDown(platformSelect);
    fireEvent.click(screen.getByText('macOS'));

    await waitFor(() => {
      expect(fetchUpdates).toHaveBeenCalledWith(
        expect.objectContaining({ platform: 'mac' })
      );
    });
  });

  test('affiche les détails de la mise à jour', async () => {
    renderUpdates();

    await waitFor(() => {
      // Clique sur une ligne du tableau
      const firstRow = screen.getByText('1.1.0').closest('tr');
      fireEvent.click(firstRow);

      // Vérifie que les détails sont affichés
      expect(screen.getByText('Détails de la mise à jour')).toBeInTheDocument();
      expect(screen.getByText('150')).toBeInTheDocument(); // Nombre de téléchargements
    });
  });
});

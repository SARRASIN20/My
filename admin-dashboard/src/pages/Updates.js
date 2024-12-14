import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from '@mui/material';
import { Add as AddIcon, Upload as UploadIcon } from '@mui/icons-material';
import { fetchUpdates, createUpdate, uploadUpdate } from '../api/updates';

const Updates = () => {
  const [updates, setUpdates] = useState([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [newUpdate, setNewUpdate] = useState({
    version: '',
    platform: 'win',
    notes: '',
    minimumVersion: ''
  });

  useEffect(() => {
    loadUpdates();
  }, []);

  const loadUpdates = async () => {
    try {
      const data = await fetchUpdates();
      setUpdates(data);
    } catch (error) {
      console.error('Erreur lors du chargement des mises à jour:', error);
    }
  };

  const handleCreateUpdate = async () => {
    try {
      if (!selectedFile) {
        alert('Veuillez sélectionner un fichier de mise à jour');
        return;
      }

      // Création de la mise à jour
      const updateData = await createUpdate(newUpdate);

      // Upload du fichier
      await uploadUpdate(updateData.id, selectedFile);

      setOpenDialog(false);
      setNewUpdate({
        version: '',
        platform: 'win',
        notes: '',
        minimumVersion: ''
      });
      setSelectedFile(null);
      loadUpdates();
    } catch (error) {
      console.error('Erreur lors de la création de la mise à jour:', error);
      alert('Erreur lors de la création de la mise à jour');
    }
  };

  const handleFileSelect = (event) => {
    setSelectedFile(event.target.files[0]);
  };

  return (
    <Box p={3}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5">Gestion des mises à jour</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setOpenDialog(true)}
        >
          Nouvelle mise à jour
        </Button>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Version</TableCell>
              <TableCell>Plateforme</TableCell>
              <TableCell>Date de publication</TableCell>
              <TableCell>Version minimale</TableCell>
              <TableCell>Téléchargements</TableCell>
              <TableCell>Statut</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {updates.map((update) => (
              <TableRow key={update.id}>
                <TableCell>{update.version}</TableCell>
                <TableCell>{update.platform}</TableCell>
                <TableCell>
                  {new Date(update.publishedAt).toLocaleDateString()}
                </TableCell>
                <TableCell>{update.minimumVersion}</TableCell>
                <TableCell>{update.downloads}</TableCell>
                <TableCell>{update.status}</TableCell>
                <TableCell>
                  <Button
                    size="small"
                    onClick={() => window.open(update.downloadUrl)}
                  >
                    Télécharger
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Nouvelle mise à jour</DialogTitle>
        <DialogContent>
          <Box mt={2}>
            <TextField
              fullWidth
              label="Version"
              value={newUpdate.version}
              onChange={(e) => setNewUpdate({ ...newUpdate, version: e.target.value })}
              margin="normal"
            />
            <FormControl fullWidth margin="normal">
              <InputLabel>Plateforme</InputLabel>
              <Select
                value={newUpdate.platform}
                onChange={(e) => setNewUpdate({ ...newUpdate, platform: e.target.value })}
              >
                <MenuItem value="win">Windows</MenuItem>
                <MenuItem value="mac">macOS</MenuItem>
                <MenuItem value="linux">Linux</MenuItem>
              </Select>
            </FormControl>
            <TextField
              fullWidth
              label="Version minimale requise"
              value={newUpdate.minimumVersion}
              onChange={(e) => setNewUpdate({ ...newUpdate, minimumVersion: e.target.value })}
              margin="normal"
            />
            <TextField
              fullWidth
              multiline
              rows={4}
              label="Notes de mise à jour"
              value={newUpdate.notes}
              onChange={(e) => setNewUpdate({ ...newUpdate, notes: e.target.value })}
              margin="normal"
            />
            <Button
              variant="outlined"
              component="label"
              startIcon={<UploadIcon />}
              fullWidth
              sx={{ mt: 2 }}
            >
              Sélectionner le fichier
              <input
                type="file"
                hidden
                onChange={handleFileSelect}
              />
            </Button>
            {selectedFile && (
              <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                Fichier sélectionné: {selectedFile.name}
              </Typography>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Annuler</Button>
          <Button onClick={handleCreateUpdate} variant="contained">
            Créer
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Updates;

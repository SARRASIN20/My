import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField
} from '@mui/material';
import {
  Error as ErrorIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  Search as SearchIcon,
  FilterList as FilterIcon
} from '@mui/icons-material';
import { fetchErrors, updateErrorStatus } from '../api/errors';

const Errors = () => {
  const [errors, setErrors] = useState([]);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [selectedError, setSelectedError] = useState(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    severity: [],
    status: [],
    dateRange: null
  });

  useEffect(() => {
    loadErrors();
  }, [page, rowsPerPage, filters]);

  const loadErrors = async () => {
    try {
      const data = await fetchErrors({
        page,
        limit: rowsPerPage,
        search: searchTerm,
        filters
      });
      setErrors(data);
    } catch (error) {
      console.error('Erreur lors du chargement des erreurs:', error);
    }
  };

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleErrorClick = (error) => {
    setSelectedError(error);
    setOpenDialog(true);
  };

  const handleStatusUpdate = async (errorId, newStatus) => {
    try {
      await updateErrorStatus(errorId, newStatus);
      loadErrors();
    } catch (error) {
      console.error('Erreur lors de la mise à jour du statut:', error);
    }
  };

  const getSeverityIcon = (severity) => {
    switch (severity.toLowerCase()) {
      case 'error':
        return <ErrorIcon color="error" />;
      case 'warning':
        return <WarningIcon color="warning" />;
      case 'info':
        return <InfoIcon color="info" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status) => {
    switch (status.toLowerCase()) {
      case 'new':
        return 'error';
      case 'in_progress':
        return 'warning';
      case 'resolved':
        return 'success';
      default:
        return 'default';
    }
  };

  return (
    <Box p={3}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5">Journal des erreurs</Typography>

        <Box display="flex" gap={2}>
          <TextField
            size="small"
            placeholder="Rechercher..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: <SearchIcon color="action" />
            }}
          />
          <IconButton>
            <FilterIcon />
          </IconButton>
        </Box>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Sévérité</TableCell>
              <TableCell>Timestamp</TableCell>
              <TableCell>Message</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Source</TableCell>
              <TableCell>Statut</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {errors.map((error) => (
              <TableRow
                key={error.id}
                hover
                onClick={() => handleErrorClick(error)}
                sx={{ cursor: 'pointer' }}
              >
                <TableCell>
                  {getSeverityIcon(error.severity)}
                </TableCell>
                <TableCell>
                  {new Date(error.timestamp).toLocaleString()}
                </TableCell>
                <TableCell>{error.message}</TableCell>
                <TableCell>{error.type}</TableCell>
                <TableCell>{error.source}</TableCell>
                <TableCell>
                  <Chip
                    label={error.status}
                    color={getStatusColor(error.status)}
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  <Button
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleStatusUpdate(error.id, 'resolved');
                    }}
                  >
                    Résoudre
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <TablePagination
          component="div"
          count={errors.length}
          page={page}
          onPageChange={handleChangePage}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
      </TableContainer>

      <Dialog
        open={openDialog}
        onClose={() => setOpenDialog(false)}
        maxWidth="md"
        fullWidth
      >
        {selectedError && (
          <>
            <DialogTitle>
              Détails de l'erreur
              {getSeverityIcon(selectedError.severity)}
            </DialogTitle>
            <DialogContent>
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle1">Message</Typography>
                <Typography variant="body1" gutterBottom>
                  {selectedError.message}
                </Typography>

                <Typography variant="subtitle1">Stack Trace</Typography>
                <Paper
                  sx={{
                    p: 2,
                    backgroundColor: 'grey.100',
                    maxHeight: 200,
                    overflow: 'auto'
                  }}
                >
                  <pre>{selectedError.stack}</pre>
                </Paper>

                <Typography variant="subtitle1" sx={{ mt: 2 }}>
                  Informations système
                </Typography>
                <Typography variant="body2">
                  OS: {selectedError.systemInfo.platform}
                  <br />
                  Version: {selectedError.systemInfo.version}
                  <br />
                  Navigateur: {selectedError.systemInfo.browser}
                </Typography>
              </Box>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setOpenDialog(false)}>Fermer</Button>
              <Button
                variant="contained"
                onClick={() => {
                  handleStatusUpdate(selectedError.id, 'resolved');
                  setOpenDialog(false);
                }}
              >
                Marquer comme résolu
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  );
};

export default Errors;

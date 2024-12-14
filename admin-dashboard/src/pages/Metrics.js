import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  BarChart, Bar, PieChart, Pie, Cell
} from 'recharts';
import { fetchMetrics } from '../api/metrics';

const Metrics = () => {
  const [metrics, setMetrics] = useState(null);
  const [timeRange, setTimeRange] = useState('24h');
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [metricType, setMetricType] = useState('system');

  useEffect(() => {
    loadMetrics();
  }, [timeRange, startDate, endDate, metricType]);

  const loadMetrics = async () => {
    try {
      const data = await fetchMetrics({
        timeRange,
        startDate,
        endDate,
        type: metricType
      });
      setMetrics(data);
    } catch (error) {
      console.error('Erreur lors du chargement des métriques:', error);
    }
  };

  if (!metrics) return null;

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

  return (
    <Box p={3}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5">Métriques de performance</Typography>
        
        <Box display="flex" gap={2}>
          <FormControl sx={{ minWidth: 120 }}>
            <InputLabel>Période</InputLabel>
            <Select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              label="Période"
            >
              <MenuItem value="1h">1 heure</MenuItem>
              <MenuItem value="24h">24 heures</MenuItem>
              <MenuItem value="7d">7 jours</MenuItem>
              <MenuItem value="30d">30 jours</MenuItem>
              <MenuItem value="custom">Personnalisé</MenuItem>
            </Select>
          </FormControl>

          {timeRange === 'custom' && (
            <LocalizationProvider dateAdapter={AdapterDateFns}>
              <DatePicker
                label="Date de début"
                value={startDate}
                onChange={setStartDate}
                renderInput={(params) => <TextField {...params} />}
              />
              <DatePicker
                label="Date de fin"
                value={endDate}
                onChange={setEndDate}
                renderInput={(params) => <TextField {...params} />}
              />
            </LocalizationProvider>
          )}

          <FormControl sx={{ minWidth: 120 }}>
            <InputLabel>Type de métrique</InputLabel>
            <Select
              value={metricType}
              onChange={(e) => setMetricType(e.target.value)}
              label="Type de métrique"
            >
              <MenuItem value="system">Système</MenuItem>
              <MenuItem value="performance">Performance</MenuItem>
              <MenuItem value="usage">Utilisation</MenuItem>
              <MenuItem value="errors">Erreurs</MenuItem>
            </Select>
          </FormControl>
        </Box>
      </Box>

      <Grid container spacing={3}>
        {/* Graphique de performance système */}
        <Grid item xs={12}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Métriques système
            </Typography>
            <LineChart
              width={1100}
              height={300}
              data={metrics.systemMetrics}
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="timestamp" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="cpu" stroke="#8884d8" name="CPU" />
              <Line type="monotone" dataKey="memory" stroke="#82ca9d" name="Mémoire" />
              <Line type="monotone" dataKey="disk" stroke="#ffc658" name="Disque" />
            </LineChart>
          </Paper>
        </Grid>

        {/* Distribution des erreurs */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Distribution des erreurs
            </Typography>
            <PieChart width={500} height={300}>
              <Pie
                data={metrics.errorDistribution}
                cx={250}
                cy={150}
                innerRadius={60}
                outerRadius={80}
                fill="#8884d8"
                paddingAngle={5}
                dataKey="value"
              >
                {metrics.errorDistribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </Paper>
        </Grid>

        {/* Utilisation par fonctionnalité */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Utilisation par fonctionnalité
            </Typography>
            <BarChart
              width={500}
              height={300}
              data={metrics.featureUsage}
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="count" fill="#8884d8" />
            </BarChart>
          </Paper>
        </Grid>

        {/* Métriques de performance */}
        <Grid item xs={12}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Métriques de performance
            </Typography>
            <LineChart
              width={1100}
              height={300}
              data={metrics.performanceMetrics}
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="timestamp" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="responseTime"
                stroke="#8884d8"
                name="Temps de réponse"
              />
              <Line
                type="monotone"
                dataKey="throughput"
                stroke="#82ca9d"
                name="Débit"
              />
            </LineChart>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Metrics;

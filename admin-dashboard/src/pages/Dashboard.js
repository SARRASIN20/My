import React, { useState, useEffect } from 'react';
import { Grid, Paper, Typography, Box } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell
} from 'recharts';
import { fetchDashboardData } from '../api/dashboard';

// Composants
import MetricCard from '../components/MetricCard';
import ErrorRateCard from '../components/ErrorRateCard';
import UpdateStatusCard from '../components/UpdateStatusCard';
import ActiveUsersCard from '../components/ActiveUsersCard';

const Dashboard = () => {
  const theme = useTheme();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        const dashboardData = await fetchDashboardData();
        setData(dashboardData);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadDashboardData();
    const interval = setInterval(loadDashboardData, 60000); // Actualisation toutes les minutes

    return () => clearInterval(interval);
  }, []);

  if (loading) return <Box>Chargement...</Box>;
  if (error) return <Box>Erreur: {error}</Box>;
  if (!data) return null;

  const {
    systemMetrics,
    errorRates,
    updateStatus,
    activeUsers,
    performanceData,
    usageDistribution
  } = data;

  const COLORS = [
    theme.palette.primary.main,
    theme.palette.secondary.main,
    theme.palette.error.main,
    theme.palette.warning.main
  ];

  return (
    <Box p={3}>
      <Grid container spacing={3}>
        {/* Métriques principales */}
        <Grid item xs={12} md={3}>
          <MetricCard
            title="CPU"
            value={`${systemMetrics.cpu}%`}
            trend={systemMetrics.cpuTrend}
          />
        </Grid>
        <Grid item xs={12} md={3}>
          <MetricCard
            title="Mémoire"
            value={`${systemMetrics.memory}MB`}
            trend={systemMetrics.memoryTrend}
          />
        </Grid>
        <Grid item xs={12} md={3}>
          <ErrorRateCard
            errorRate={errorRates.current}
            previousRate={errorRates.previous}
          />
        </Grid>
        <Grid item xs={12} md={3}>
          <ActiveUsersCard
            activeUsers={activeUsers.current}
            trend={activeUsers.trend}
          />
        </Grid>

        {/* Graphiques de performance */}
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Performance sur 24h
            </Typography>
            <LineChart
              width={800}
              height={300}
              data={performanceData}
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="cpu"
                stroke={theme.palette.primary.main}
                name="CPU"
              />
              <Line
                type="monotone"
                dataKey="memory"
                stroke={theme.palette.secondary.main}
                name="Mémoire"
              />
            </LineChart>
          </Paper>
        </Grid>

        {/* Distribution d'utilisation */}
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Distribution d'utilisation
            </Typography>
            <PieChart width={400} height={300}>
              <Pie
                data={usageDistribution}
                cx={200}
                cy={150}
                innerRadius={60}
                outerRadius={80}
                fill="#8884d8"
                paddingAngle={5}
                dataKey="value"
                label
              >
                {usageDistribution.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={COLORS[index % COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </Paper>
        </Grid>

        {/* Statut des mises à jour */}
        <Grid item xs={12}>
          <UpdateStatusCard
            status={updateStatus.status}
            version={updateStatus.version}
            lastCheck={updateStatus.lastCheck}
            pendingUpdates={updateStatus.pendingUpdates}
          />
        </Grid>
      </Grid>
    </Box>
  );
};

export default Dashboard;

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement, PointElement, Title, Tooltip, Legend, ArcElement } from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';
import { FiPackage, FiAlertTriangle, FiTruck, FiTrendingUp } from 'react-icons/fi';
import { inventoryApi, alertApi, orderApi, forecastApi } from '../services/api';
import { toast } from 'react-toastify';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Title, Tooltip, Legend, ArcElement);

const Dashboard = () => {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [pendingOrders, setPendingOrders] = useState(null);
  const [reorderRecs, setReorderRecs] = useState([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [summaryRes, alertRes, ordersRes, reorderRes] = await Promise.all([
        inventoryApi.getSummary(),
        alertApi.getSummary(),
        orderApi.getPendingSummary(),
        forecastApi.getReorderRecommendations()
      ]);
      
      setSummary(summaryRes.data.data);
      setAlerts(alertRes.data.data.recentActive || []);
      setPendingOrders(ordersRes.data.data);
      setReorderRecs(reorderRes.data.data || []);
    } catch (error) {
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="page-content">
        <div className="loading-screen">
          <div className="spinner"></div>
        </div>
      </div>
    );
  }

  const statusChartData = {
    labels: ['Adequate', 'Below Target', 'Low', 'Critical', 'Out of Stock'],
    datasets: [{
      data: [
        summary?.byStatus?.adequate || 0,
        summary?.byStatus?.below_target || 0,
        summary?.byStatus?.low || 0,
        summary?.byStatus?.critical || 0,
        summary?.byStatus?.out_of_stock || 0
      ],
      backgroundColor: ['#10b981', '#3b82f6', '#f59e0b', '#f97316', '#ef4444'],
    }]
  };

  const categoryChartData = {
    labels: Object.keys(summary?.byCategory || {}),
    datasets: [{
      label: 'Total Items',
      data: Object.values(summary?.byCategory || {}).map(c => c.count),
      backgroundColor: '#1e3a5f',
    }, {
      label: 'Low Stock',
      data: Object.values(summary?.byCategory || {}).map(c => c.lowStock),
      backgroundColor: '#ef4444',
    }]
  };

  const lowStockCount = (summary?.byStatus?.low || 0) + (summary?.byStatus?.critical || 0) + (summary?.byStatus?.out_of_stock || 0);

  return (
    <>
      <header className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <div className="flex gap-2">
          <Link to="/inventory" className="btn btn-primary">
            <FiPackage /> View Inventory
          </Link>
        </div>
      </header>
      
      <div className="page-content">
        {/* Stats Grid */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon primary"><FiPackage /></div>
            <div className="stat-content">
              <div className="stat-value">{summary?.totalItems || 0}</div>
              <div className="stat-label">Total Items</div>
            </div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon warning"><FiAlertTriangle /></div>
            <div className="stat-content">
              <div className="stat-value">{lowStockCount}</div>
              <div className="stat-label">Low Stock Items</div>
            </div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon success"><FiTruck /></div>
            <div className="stat-content">
              <div className="stat-value">{pendingOrders?.summary?.total || 0}</div>
              <div className="stat-label">Pending Orders</div>
            </div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon danger"><FiTrendingUp /></div>
            <div className="stat-content">
              <div className="stat-value">{reorderRecs.length}</div>
              <div className="stat-label">Reorder Needed</div>
            </div>
          </div>
        </div>

        <div className="grid-2">
          {/* Stock Status Chart */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Inventory Status</h3>
            </div>
            <div className="chart-container" style={{ height: '250px' }}>
              <Doughnut data={statusChartData} options={{ maintainAspectRatio: false, plugins: { legend: { position: 'bottom' }}}} />
            </div>
          </div>

          {/* Category Chart */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Items by Category</h3>
            </div>
            <div className="chart-container" style={{ height: '250px' }}>
              <Bar data={categoryChartData} options={{ maintainAspectRatio: false, plugins: { legend: { position: 'bottom' }}}} />
            </div>
          </div>
        </div>

        <div className="grid-2 mt-4">
          {/* Active Alerts */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Active Alerts</h3>
              <Link to="/alerts" className="btn btn-secondary btn-sm">View All</Link>
            </div>
            {alerts.length === 0 ? (
              <p className="text-muted text-center">No active alerts</p>
            ) : (
              <div className="table-container">
                <table>
                  <tbody>
                    {alerts.slice(0, 5).map(alert => (
                      <tr key={alert._id}>
                        <td>
                          <span className={`badge badge-${alert.priority === 'critical' ? 'danger' : alert.priority === 'high' ? 'warning' : 'info'}`}>
                            {alert.priority}
                          </span>
                        </td>
                        <td>{alert.title}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Reorder Recommendations */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Reorder Recommendations</h3>
              <Link to="/forecasts" className="btn btn-secondary btn-sm">View All</Link>
            </div>
            {reorderRecs.length === 0 ? (
              <p className="text-muted text-center">No items need reordering</p>
            ) : (
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Days Left</th>
                      <th>Order Qty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reorderRecs.slice(0, 5).map(rec => (
                      <tr key={rec.item.id}>
                        <td>
                          <Link to={`/inventory/${rec.item.id}`}>{rec.item.name}</Link>
                        </td>
                        <td>
                          <span className={`badge badge-${rec.urgency === 'critical' ? 'danger' : 'warning'}`}>
                            {rec.daysUntilStockout} days
                          </span>
                        </td>
                        <td className="font-mono">{rec.recommendedOrderQty}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default Dashboard;

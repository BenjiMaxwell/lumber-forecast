import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Chart as ChartJS, CategoryScale, LinearScale, LineElement, PointElement, Title, Tooltip, Legend } from 'chart.js';
import { Line } from 'react-chartjs-2';
import { FiArrowLeft, FiEdit, FiPlus } from 'react-icons/fi';
import { inventoryApi, forecastApi } from '../services/api';
import { toast } from 'react-toastify';

ChartJS.register(CategoryScale, LinearScale, LineElement, PointElement, Title, Tooltip, Legend);

const ItemDetail = () => {
  const { id } = useParams();
  const [item, setItem] = useState(null);
  const [forecast, setForecast] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCountModal, setShowCountModal] = useState(false);
  const [newCount, setNewCount] = useState({ count: '', notes: '' });

  useEffect(() => { fetchData(); }, [id]);

  const fetchData = async () => {
    try {
      const [itemRes, forecastRes] = await Promise.all([
        inventoryApi.getOne(id),
        forecastApi.getOne(id)
      ]);
      setItem(itemRes.data.data);
      setForecast(forecastRes.data.data);
    } catch (error) {
      toast.error('Failed to load item');
    } finally {
      setLoading(false);
    }
  };

  const handleRecordCount = async (e) => {
    e.preventDefault();
    try {
      await inventoryApi.recordCount(id, { count: parseFloat(newCount.count), notes: newCount.notes });
      toast.success('Count recorded');
      setShowCountModal(false);
      setNewCount({ count: '', notes: '' });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to record count');
    }
  };

  if (loading) return <div className="page-content"><div className="loading-screen"><div className="spinner"></div></div></div>;
  if (!item) return <div className="page-content"><p>Item not found</p></div>;

  const historyChartData = {
    labels: item.recentCounts?.slice().reverse().map(c => new Date(c.countDate).toLocaleDateString()) || [],
    datasets: [{
      label: 'Stock Level',
      data: item.recentCounts?.slice().reverse().map(c => c.count) || [],
      borderColor: '#1e3a5f',
      backgroundColor: 'rgba(30, 58, 95, 0.1)',
      fill: true,
      tension: 0.3
    }]
  };

  const forecastChartData = forecast?.predictions ? {
    labels: forecast.predictions.map(p => p.date),
    datasets: [{
      label: 'Projected Stock',
      data: forecast.predictions.map(p => p.projectedStock),
      borderColor: '#f59e0b',
      borderDash: [5, 5],
      tension: 0.3
    }, {
      label: 'Minimum',
      data: forecast.predictions.map(() => item.currentMinimum),
      borderColor: '#ef4444',
      borderDash: [2, 2],
    }]
  } : null;

  return (
    <>
      <header className="page-header">
        <div className="flex items-center gap-4">
          <Link to="/inventory" className="btn btn-icon"><FiArrowLeft /></Link>
          <div>
            <h1 className="page-title">{item.displayName || item.name}</h1>
            <span className="text-muted font-mono">{item.sku}</span>
          </div>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-primary" onClick={() => setShowCountModal(true)}>
            <FiPlus /> Record Count
          </button>
        </div>
      </header>

      <div className="page-content">
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-content">
              <div className="stat-value">{item.currentStock}</div>
              <div className="stat-label">Current Stock</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-content">
              <div className="stat-value">{item.currentMinimum}</div>
              <div className="stat-label">Minimum (Current Season)</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-content">
              <div className="stat-value">{item.currentTarget}</div>
              <div className="stat-label">Target</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-content">
              <div className="stat-value">{item.daysUntilStockout ?? 'N/A'}</div>
              <div className="stat-label">Days Until Stockout</div>
            </div>
          </div>
        </div>

        <div className="grid-2">
          <div className="card">
            <div className="card-header"><h3 className="card-title">Stock History</h3></div>
            <div className="chart-container">
              <Line data={historyChartData} options={{ maintainAspectRatio: false }} />
            </div>
          </div>

          <div className="card">
            <div className="card-header"><h3 className="card-title">Forecast ({forecast?.method})</h3></div>
            {forecastChartData ? (
              <div className="chart-container">
                <Line data={forecastChartData} options={{ maintainAspectRatio: false }} />
              </div>
            ) : <p className="text-muted">Not enough data for forecast</p>}
          </div>
        </div>

        <div className="card mt-4">
          <div className="card-header"><h3 className="card-title">Recent Counts</h3></div>
          <table>
            <thead>
              <tr><th>Date</th><th className="text-right">Count</th><th className="text-right">Change</th><th>Notes</th></tr>
            </thead>
            <tbody>
              {item.recentCounts?.map(count => (
                <tr key={count._id}>
                  <td>{new Date(count.countDate).toLocaleDateString()}</td>
                  <td className="text-right font-mono">{count.count}</td>
                  <td className={`text-right font-mono ${count.change > 0 ? 'text-success' : count.change < 0 ? 'text-danger' : ''}`}>
                    {count.change > 0 ? '+' : ''}{count.change}
                  </td>
                  <td className="text-muted text-sm">{count.notes || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showCountModal && (
        <div className="modal-overlay" onClick={() => setShowCountModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Record Count</h3>
              <button className="modal-close" onClick={() => setShowCountModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleRecordCount}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Count (supports fractions like 10.5)</label>
                  <input type="number" step="0.5" className="form-input" value={newCount.count} onChange={e => setNewCount({...newCount, count: e.target.value})} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Notes</label>
                  <input className="form-input" value={newCount.notes} onChange={e => setNewCount({...newCount, notes: e.target.value})} placeholder="Optional" />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowCountModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Count</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default ItemDetail;

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FiRefreshCw, FiTrendingUp, FiAlertCircle } from 'react-icons/fi';
import { forecastApi } from '../services/api';
import { toast } from 'react-toastify';

const Forecasts = () => {
  const [forecasts, setForecasts] = useState([]);
  const [reorderRecs, setReorderRecs] = useState([]);
  const [modelStatus, setModelStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [retraining, setRetraining] = useState(false);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const [forecastsRes, reorderRes, statusRes] = await Promise.all([
        forecastApi.getBatch({ days: 30 }),
        forecastApi.getReorderRecommendations(),
        forecastApi.getModelStatus()
      ]);
      setForecasts(forecastsRes.data.data);
      setReorderRecs(reorderRes.data.data);
      setModelStatus(statusRes.data.data);
    } catch (error) {
      toast.error('Failed to load forecasts');
    } finally {
      setLoading(false);
    }
  };

  const handleRetrain = async () => {
    setRetraining(true);
    try {
      const res = await forecastApi.retrain();
      toast.success(res.data.message);
      fetchData();
    } catch (error) {
      toast.error('Retraining failed');
    } finally {
      setRetraining(false);
    }
  };

  return (
    <>
      <header className="page-header">
        <h1 className="page-title">Forecasts & AI</h1>
        <button className="btn btn-secondary" onClick={handleRetrain} disabled={retraining}>
          <FiRefreshCw className={retraining ? 'spinning' : ''} /> {retraining ? 'Retraining...' : 'Retrain Model'}
        </button>
      </header>

      <div className="page-content">
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon primary"><FiTrendingUp /></div>
            <div className="stat-content">
              <div className="stat-value">{modelStatus?.modelTrained ? 'LSTM' : 'Average'}</div>
              <div className="stat-label">Forecast Method</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon warning"><FiAlertCircle /></div>
            <div className="stat-content">
              <div className="stat-value">{reorderRecs.length}</div>
              <div className="stat-label">Reorder Needed</div>
            </div>
          </div>
        </div>

        {/* Reorder Recommendations */}
        <div className="card mb-4">
          <div className="card-header">
            <h3 className="card-title">🚨 Reorder Recommendations</h3>
          </div>
          {reorderRecs.length === 0 ? (
            <p className="text-muted text-center">All items are adequately stocked!</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Current Stock</th>
                  <th>Days Until Stockout</th>
                  <th>Lead Time</th>
                  <th>Recommended Order</th>
                  <th>Urgency</th>
                </tr>
              </thead>
              <tbody>
                {reorderRecs.map(rec => (
                  <tr key={rec.item.id}>
                    <td><Link to={`/inventory/${rec.item.id}`}>{rec.item.name}</Link></td>
                    <td className="font-mono">{rec.item.currentStock}</td>
                    <td className="font-mono">{rec.daysUntilStockout} days</td>
                    <td className="font-mono">{rec.leadTime} days</td>
                    <td className="font-mono font-bold">{rec.recommendedOrderQty} units</td>
                    <td><span className={`badge badge-${rec.urgency === 'critical' ? 'danger' : 'warning'}`}>{rec.urgency}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* All Forecasts */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">30-Day Demand Forecasts</h3>
          </div>
          {loading ? <div className="spinner"></div> : (
            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Method</th>
                  <th className="text-right">Current</th>
                  <th className="text-right">Predicted Demand</th>
                  <th className="text-right">Avg Daily</th>
                  <th className="text-right">Days Left</th>
                  <th className="text-right">Rec. Min</th>
                </tr>
              </thead>
              <tbody>
                {forecasts.filter(f => !f.error).map(forecast => (
                  <tr key={forecast.itemId}>
                    <td><Link to={`/inventory/${forecast.itemId}`}>{forecast.itemName}</Link></td>
                    <td><span className={`badge ${forecast.method === 'lstm' ? 'badge-success' : 'badge-neutral'}`}>{forecast.method}</span></td>
                    <td className="text-right font-mono">{forecast.currentStock}</td>
                    <td className="text-right font-mono">{forecast.summary?.totalPredictedDemand}</td>
                    <td className="text-right font-mono">{forecast.summary?.avgDailyDemand}</td>
                    <td className="text-right font-mono">{forecast.summary?.daysUntilStockout ?? '-'}</td>
                    <td className="text-right font-mono">{forecast.summary?.recommendedMin}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <style>{`.spinning { animation: spin 1s linear infinite; }`}</style>
    </>
  );
};

export default Forecasts;

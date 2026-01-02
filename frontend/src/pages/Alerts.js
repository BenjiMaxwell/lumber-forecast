import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FiBell, FiCheck, FiX, FiAlertTriangle, FiAlertCircle, FiInfo } from 'react-icons/fi';
import { alertApi } from '../services/api';
import { toast } from 'react-toastify';

const Alerts = () => {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('active');

  useEffect(() => { fetchAlerts(); }, [filter]);

  const fetchAlerts = async () => {
    setLoading(true);
    try {
      const params = filter ? { status: filter } : {};
      const res = await alertApi.getAll(params);
      setAlerts(res.data.data);
    } catch (error) {
      toast.error('Failed to load alerts');
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (alertId, action) => {
    try {
      if (action === 'acknowledge') await alertApi.acknowledge(alertId);
      else if (action === 'dismiss') await alertApi.dismiss(alertId);
      else if (action === 'resolve') await alertApi.resolve(alertId, {});
      toast.success(`Alert ${action}d`);
      fetchAlerts();
    } catch (error) {
      toast.error(`Failed to ${action} alert`);
    }
  };

  const getPriorityIcon = (priority) => {
    switch(priority) {
      case 'critical': return <FiAlertTriangle className="text-danger" />;
      case 'high': return <FiAlertCircle className="text-warning" />;
      default: return <FiInfo className="text-info" />;
    }
  };

  const getPriorityBadge = (p) => ({
    critical: 'badge-danger', high: 'badge-warning', medium: 'badge-info', low: 'badge-neutral'
  }[p] || 'badge-neutral');

  const getTypeBadge = (t) => ({
    low_stock: 'badge-warning', critical_stock: 'badge-danger', out_of_stock: 'badge-danger',
    reorder_reminder: 'badge-info', anomaly_detected: 'badge-danger'
  }[t] || 'badge-neutral');

  const formatType = (t) => t.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

  const activeCount = alerts.filter(a => a.status === 'active').length;

  return (
    <>
      <header className="page-header">
        <h1 className="page-title">Alerts</h1>
        <span className="badge badge-danger">{activeCount} Active</span>
      </header>

      <div className="page-content">
        <div className="stats-grid">
          <div className="stat-card" onClick={() => setFilter('active')} style={{ cursor: 'pointer' }}>
            <div className="stat-icon danger"><FiBell /></div>
            <div className="stat-content">
              <div className="stat-value">{alerts.filter(a => a.status === 'active').length}</div>
              <div className="stat-label">Active</div>
            </div>
          </div>
          <div className="stat-card" onClick={() => setFilter('acknowledged')} style={{ cursor: 'pointer' }}>
            <div className="stat-icon warning"><FiCheck /></div>
            <div className="stat-content">
              <div className="stat-value">{alerts.filter(a => a.status === 'acknowledged').length}</div>
              <div className="stat-label">Acknowledged</div>
            </div>
          </div>
          <div className="stat-card" onClick={() => setFilter('resolved')} style={{ cursor: 'pointer' }}>
            <div className="stat-icon success"><FiCheck /></div>
            <div className="stat-content">
              <div className="stat-value">{alerts.filter(a => a.status === 'resolved').length}</div>
              <div className="stat-label">Resolved</div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="card-title">All Alerts</h3>
            <select className="form-select" value={filter} onChange={(e) => setFilter(e.target.value)} style={{ width: '150px' }}>
              <option value="">All</option>
              <option value="active">Active</option>
              <option value="acknowledged">Acknowledged</option>
              <option value="resolved">Resolved</option>
              <option value="dismissed">Dismissed</option>
            </select>
          </div>

          {loading ? <div className="spinner"></div> : alerts.length === 0 ? (
            <p className="text-muted text-center">No alerts found</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th style={{ width: '40px' }}></th>
                  <th>Alert</th>
                  <th>Type</th>
                  <th>Item</th>
                  <th>Priority</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {alerts.map(alert => (
                  <tr key={alert._id}>
                    <td>{getPriorityIcon(alert.priority)}</td>
                    <td>
                      <strong>{alert.title}</strong>
                      <p className="text-sm text-muted">{alert.message}</p>
                    </td>
                    <td><span className={`badge ${getTypeBadge(alert.type)}`}>{formatType(alert.type)}</span></td>
                    <td>{alert.item ? <Link to={`/inventory/${alert.item._id}`}>{alert.item.name}</Link> : '-'}</td>
                    <td><span className={`badge ${getPriorityBadge(alert.priority)}`}>{alert.priority}</span></td>
                    <td className="text-sm">{new Date(alert.createdAt).toLocaleString()}</td>
                    <td>
                      {alert.status === 'active' && (
                        <div className="flex gap-1">
                          <button className="btn btn-sm btn-secondary" onClick={() => handleAction(alert._id, 'acknowledge')} title="Acknowledge">
                            <FiCheck />
                          </button>
                          <button className="btn btn-sm btn-secondary" onClick={() => handleAction(alert._id, 'dismiss')} title="Dismiss">
                            <FiX />
                          </button>
                        </div>
                      )}
                      {alert.status === 'acknowledged' && (
                        <button className="btn btn-sm btn-success" onClick={() => handleAction(alert._id, 'resolve')}>Resolve</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
};

export default Alerts;

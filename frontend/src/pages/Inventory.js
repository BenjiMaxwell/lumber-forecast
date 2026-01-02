import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FiPlus, FiUpload, FiSearch, FiFilter } from 'react-icons/fi';
import { inventoryApi } from '../services/api';
import { toast } from 'react-toastify';

const Inventory = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [newItem, setNewItem] = useState({
    sku: '', name: '', category: 'dimensional',
    dimensions: { thickness: '', width: '', length: '' },
    currentStock: 0, minimums: { winter: 0, summer: 0 }
  });

  useEffect(() => { fetchItems(); }, [search, category, status]);

  const fetchItems = async () => {
    try {
      const params = {};
      if (search) params.search = search;
      if (category) params.category = category;
      if (status) params.status = status;
      const res = await inventoryApi.getAll(params);
      setItems(res.data.data);
    } catch (error) {
      toast.error('Failed to load inventory');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateItem = async (e) => {
    e.preventDefault();
    try {
      await inventoryApi.create(newItem);
      toast.success('Item created');
      setShowModal(false);
      fetchItems();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to create');
    }
  };

  const getStatusBadge = (s) => ({
    adequate: 'badge-success', below_target: 'badge-info',
    low: 'badge-warning', critical: 'badge-danger', out_of_stock: 'badge-danger'
  }[s] || 'badge-neutral');

  const formatStatus = (s) => s.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

  return (
    <>
      <header className="page-header">
        <h1 className="page-title">Inventory</h1>
        <div className="flex gap-2">
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            <FiPlus /> Add Item
          </button>
        </div>
      </header>

      <div className="page-content">
        <div className="card mb-4">
          <div className="flex gap-4 items-center">
            <div className="flex items-center gap-2" style={{ flex: 1 }}>
              <FiSearch className="text-muted" />
              <input type="text" className="form-input" placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <select className="form-select" value={category} onChange={(e) => setCategory(e.target.value)} style={{ width: '150px' }}>
              <option value="">All Categories</option>
              <option value="dimensional">Dimensional</option>
              <option value="plywood">Plywood</option>
              <option value="treated">Treated</option>
            </select>
            <select className="form-select" value={status} onChange={(e) => setStatus(e.target.value)} style={{ width: '150px' }}>
              <option value="">All Status</option>
              <option value="adequate">Adequate</option>
              <option value="low">Low</option>
              <option value="critical">Critical</option>
            </select>
          </div>
        </div>

        <div className="card">
          {loading ? <div className="text-center"><div className="spinner"></div></div> : (
            <table>
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Name</th>
                  <th>Category</th>
                  <th className="text-right">Stock</th>
                  <th className="text-right">Min</th>
                  <th>Status</th>
                  <th className="text-right">Days Left</th>
                </tr>
              </thead>
              <tbody>
                {items.map(item => (
                  <tr key={item._id}>
                    <td className="font-mono text-sm">{item.sku}</td>
                    <td><Link to={`/inventory/${item._id}`}>{item.displayName || item.name}</Link></td>
                    <td className="text-sm">{item.category}</td>
                    <td className="text-right font-mono">{item.currentStock}</td>
                    <td className="text-right font-mono">{item.currentMinimum}</td>
                    <td><span className={`badge ${getStatusBadge(item.stockStatus)}`}>{formatStatus(item.stockStatus)}</span></td>
                    <td className="text-right font-mono">{item.daysUntilStockout ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Add Inventory Item</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleCreateItem}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">SKU</label>
                  <input className="form-input" value={newItem.sku} onChange={e => setNewItem({...newItem, sku: e.target.value})} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Name</label>
                  <input className="form-input" value={newItem.name} onChange={e => setNewItem({...newItem, name: e.target.value})} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Category</label>
                  <select className="form-select" value={newItem.category} onChange={e => setNewItem({...newItem, category: e.target.value})}>
                    <option value="dimensional">Dimensional</option>
                    <option value="plywood">Plywood</option>
                    <option value="treated">Treated</option>
                    <option value="specialty">Specialty</option>
                  </select>
                </div>
                <div className="grid-3">
                  <div className="form-group">
                    <label className="form-label">Current Stock</label>
                    <input type="number" step="0.5" className="form-input" value={newItem.currentStock} onChange={e => setNewItem({...newItem, currentStock: parseFloat(e.target.value)})} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Winter Min</label>
                    <input type="number" className="form-input" value={newItem.minimums.winter} onChange={e => setNewItem({...newItem, minimums: {...newItem.minimums, winter: parseInt(e.target.value)}})} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Summer Min</label>
                    <input type="number" className="form-input" value={newItem.minimums.summer} onChange={e => setNewItem({...newItem, minimums: {...newItem.minimums, summer: parseInt(e.target.value)}})} />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Create Item</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default Inventory;

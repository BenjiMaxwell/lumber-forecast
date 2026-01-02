import React, { useState, useEffect } from 'react';
import { FiPlus, FiTruck, FiPackage, FiClock } from 'react-icons/fi';
import { orderApi, vendorApi, inventoryApi } from '../services/api';
import { toast } from 'react-toastify';

const Orders = () => {
  const [orders, setOrders] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [newOrder, setNewOrder] = useState({ vendor: '', items: [{ item: '', quantity: 1 }] });

  useEffect(() => { fetchData(); }, [filter]);

  const fetchData = async () => {
    try {
      const params = filter ? { status: filter } : {};
      const [ordersRes, vendorsRes, itemsRes] = await Promise.all([
        orderApi.getAll(params),
        vendorApi.getAll({ active: 'true' }),
        inventoryApi.getAll({ limit: 100 })
      ]);
      setOrders(ordersRes.data.data);
      setVendors(vendorsRes.data.data);
      setItems(itemsRes.data.data);
    } catch (error) {
      toast.error('Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOrder = async (e) => {
    e.preventDefault();
    try {
      await orderApi.create(newOrder);
      toast.success('Order created');
      setShowModal(false);
      setNewOrder({ vendor: '', items: [{ item: '', quantity: 1 }] });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to create order');
    }
  };

  const handleStatusUpdate = async (orderId, status) => {
    try {
      await orderApi.updateStatus(orderId, { status, actualDeliveryDate: status === 'delivered' ? new Date() : undefined });
      toast.success(`Order ${status}`);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to update');
    }
  };

  const getStatusBadge = (s) => ({
    pending: 'badge-warning', confirmed: 'badge-info',
    shipped: 'badge-info', delivered: 'badge-success', cancelled: 'badge-neutral'
  }[s] || 'badge-neutral');

  const addItemRow = () => setNewOrder({ ...newOrder, items: [...newOrder.items, { item: '', quantity: 1 }] });

  return (
    <>
      <header className="page-header">
        <h1 className="page-title">Orders</h1>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}><FiPlus /> New Order</button>
      </header>

      <div className="page-content">
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon warning"><FiClock /></div>
            <div className="stat-content">
              <div className="stat-value">{orders.filter(o => o.status === 'pending').length}</div>
              <div className="stat-label">Pending</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon primary"><FiPackage /></div>
            <div className="stat-content">
              <div className="stat-value">{orders.filter(o => o.status === 'confirmed').length}</div>
              <div className="stat-label">Confirmed</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon info"><FiTruck /></div>
            <div className="stat-content">
              <div className="stat-value">{orders.filter(o => o.status === 'shipped').length}</div>
              <div className="stat-label">Shipped</div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="card-title">All Orders</h3>
            <select className="form-select" value={filter} onChange={(e) => setFilter(e.target.value)} style={{ width: '150px' }}>
              <option value="">All Status</option>
              <option value="pending">Pending</option>
              <option value="confirmed">Confirmed</option>
              <option value="shipped">Shipped</option>
              <option value="delivered">Delivered</option>
            </select>
          </div>
          {loading ? <div className="spinner"></div> : (
            <table>
              <thead>
                <tr>
                  <th>Order #</th>
                  <th>Vendor</th>
                  <th>Items</th>
                  <th className="text-right">Total</th>
                  <th>Status</th>
                  <th>Expected</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {orders.map(order => (
                  <tr key={order._id}>
                    <td className="font-mono">{order.orderNumber}</td>
                    <td>{order.vendor?.name}</td>
                    <td>{order.items.length} items</td>
                    <td className="text-right font-mono">${order.totalAmount?.toFixed(2)}</td>
                    <td><span className={`badge ${getStatusBadge(order.status)}`}>{order.status}</span></td>
                    <td>{order.expectedDeliveryDate ? new Date(order.expectedDeliveryDate).toLocaleDateString() : '-'}</td>
                    <td>
                      {order.status === 'pending' && <button className="btn btn-sm btn-secondary" onClick={() => handleStatusUpdate(order._id, 'confirmed')}>Confirm</button>}
                      {order.status === 'confirmed' && <button className="btn btn-sm btn-secondary" onClick={() => handleStatusUpdate(order._id, 'shipped')}>Mark Shipped</button>}
                      {order.status === 'shipped' && <button className="btn btn-sm btn-success" onClick={() => handleStatusUpdate(order._id, 'delivered')}>Mark Delivered</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" style={{ maxWidth: '600px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">New Order</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleCreateOrder}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Vendor</label>
                  <select className="form-select" value={newOrder.vendor} onChange={e => setNewOrder({...newOrder, vendor: e.target.value})} required>
                    <option value="">Select vendor...</option>
                    {vendors.map(v => <option key={v._id} value={v._id}>{v.name}</option>)}
                  </select>
                </div>
                <label className="form-label">Items</label>
                {newOrder.items.map((item, i) => (
                  <div key={i} className="flex gap-2 mb-2">
                    <select className="form-select" style={{ flex: 2 }} value={item.item} onChange={e => {
                      const items = [...newOrder.items];
                      items[i].item = e.target.value;
                      setNewOrder({...newOrder, items});
                    }} required>
                      <option value="">Select item...</option>
                      {items.map(it => <option key={it._id} value={it._id}>{it.name}</option>)}
                    </select>
                    <input type="number" className="form-input" style={{ flex: 1 }} placeholder="Qty" value={item.quantity} onChange={e => {
                      const items = [...newOrder.items];
                      items[i].quantity = parseInt(e.target.value);
                      setNewOrder({...newOrder, items});
                    }} min="1" required />
                  </div>
                ))}
                <button type="button" className="btn btn-secondary btn-sm" onClick={addItemRow}>+ Add Item</button>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Create Order</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default Orders;

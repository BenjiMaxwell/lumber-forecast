import React, { useState, useEffect } from 'react';
import { FiPlus, FiStar, FiClock, FiPercent } from 'react-icons/fi';
import { vendorApi } from '../services/api';
import { toast } from 'react-toastify';

const Vendors = () => {
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newVendor, setNewVendor] = useState({
    name: '', code: '', contact: { name: '', email: '', phone: '' },
    address: { street: '', city: '', state: '', zip: '' }, paymentTerms: 'net30'
  });

  useEffect(() => { fetchVendors(); }, []);

  const fetchVendors = async () => {
    try {
      const res = await vendorApi.getAll();
      setVendors(res.data.data);
    } catch (error) {
      toast.error('Failed to load vendors');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateVendor = async (e) => {
    e.preventDefault();
    try {
      await vendorApi.create(newVendor);
      toast.success('Vendor added');
      setShowModal(false);
      fetchVendors();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to create vendor');
    }
  };

  return (
    <>
      <header className="page-header">
        <h1 className="page-title">Vendors</h1>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}><FiPlus /> Add Vendor</button>
      </header>

      <div className="page-content">
        {loading ? <div className="spinner"></div> : (
          <div className="grid-3">
            {vendors.map(vendor => (
              <div key={vendor._id} className="card">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="card-title">{vendor.name}</h3>
                  <span className="badge badge-neutral font-mono">{vendor.code}</span>
                </div>
                {vendor.isPreferred && <span className="badge badge-warning mb-2"><FiStar /> Preferred</span>}
                
                <div className="text-sm text-muted mb-4">
                  {vendor.contact?.name && <p>{vendor.contact.name}</p>}
                  {vendor.contact?.email && <p>{vendor.contact.email}</p>}
                  {vendor.contact?.phone && <p>{vendor.contact.phone}</p>}
                </div>

                <div className="flex gap-4 text-sm">
                  <div className="flex items-center gap-1">
                    <FiClock className="text-muted" />
                    <span>{vendor.metrics?.avgLeadTime || 7} days</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <FiPercent className="text-muted" />
                    <span>{vendor.metrics?.onTimeDeliveryRate || 100}%</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <FiStar className="text-muted" />
                    <span>{vendor.rating}/5</span>
                  </div>
                </div>

                <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--color-border)' }}>
                  <span className="text-sm text-muted">Terms: {vendor.paymentTerms?.toUpperCase()}</span>
                  <span className="text-sm text-muted ml-4">{vendor.metrics?.totalOrders || 0} orders</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" style={{ maxWidth: '500px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Add Vendor</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleCreateVendor}>
              <div className="modal-body">
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Name</label>
                    <input className="form-input" value={newVendor.name} onChange={e => setNewVendor({...newVendor, name: e.target.value})} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Code</label>
                    <input className="form-input" value={newVendor.code} onChange={e => setNewVendor({...newVendor, code: e.target.value.toUpperCase()})} required maxLength={5} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Contact Name</label>
                  <input className="form-input" value={newVendor.contact.name} onChange={e => setNewVendor({...newVendor, contact: {...newVendor.contact, name: e.target.value}})} />
                </div>
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Email</label>
                    <input type="email" className="form-input" value={newVendor.contact.email} onChange={e => setNewVendor({...newVendor, contact: {...newVendor.contact, email: e.target.value}})} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Phone</label>
                    <input className="form-input" value={newVendor.contact.phone} onChange={e => setNewVendor({...newVendor, contact: {...newVendor.contact, phone: e.target.value}})} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Payment Terms</label>
                  <select className="form-select" value={newVendor.paymentTerms} onChange={e => setNewVendor({...newVendor, paymentTerms: e.target.value})}>
                    <option value="cod">COD</option>
                    <option value="net15">Net 15</option>
                    <option value="net30">Net 30</option>
                    <option value="net45">Net 45</option>
                    <option value="net60">Net 60</option>
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Add Vendor</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default Vendors;

import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Layout from './components/Layout/Layout';
import Dashboard from './pages/Dashboard';
import Inventory from './pages/Inventory';
import ItemDetail from './pages/ItemDetail';
import Orders from './pages/Orders';
import Vendors from './pages/Vendors';
import Forecasts from './pages/Forecasts';
import Alerts from './pages/Alerts';
import './styles/index.css';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="inventory" element={<Inventory />} />
          <Route path="inventory/:id" element={<ItemDetail />} />
          <Route path="orders" element={<Orders />} />
          <Route path="vendors" element={<Vendors />} />
          <Route path="forecasts" element={<Forecasts />} />
          <Route path="alerts" element={<Alerts />} />
        </Route>
      </Routes>
      <ToastContainer position="top-right" autoClose={3000} />
    </Router>
  );
}

export default App;

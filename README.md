# 🪵 LumberFlow - AI-Powered Inventory Forecasting System

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)

An intelligent inventory management and demand forecasting system built for lumber companies. Uses machine learning (TensorFlow.js LSTM) to predict demand, optimize purchasing, and prevent stockouts.

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              LUMBERFLOW SYSTEM                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                         FRONTEND (React.js)                          │    │
│  │  ┌─────────┐ ┌──────────┐ ┌──────────┐ ┌─────────┐ ┌─────────────┐  │    │
│  │  │Dashboard│ │Inventory │ │ Orders   │ │ Vendors │ │  Forecasts  │  │    │
│  │  │  View   │ │ Manager  │ │ Tracker  │ │ Compare │ │  & Alerts   │  │    │
│  │  └─────────┘ └──────────┘ └──────────┘ └─────────┘ └─────────────┘  │    │
│  │                              │                                       │    │
│  │                    ┌─────────▼─────────┐                            │    │
│  │                    │   Chart.js Viz    │                            │    │
│  │                    └───────────────────┘                            │    │
│  └────────────────────────────┬────────────────────────────────────────┘    │
│                               │ REST API                                     │
│  ┌────────────────────────────▼────────────────────────────────────────┐    │
│  │                      BACKEND (Node.js/Express)                       │    │
│  │  ┌─────────────────────────────────────────────────────────────┐    │    │
│  │  │                        API Routes                            │    │    │
│  │  │  /inventory  /orders  /vendors  /forecasts  /alerts  /auth  │    │    │
│  │  └─────────────────────────────────────────────────────────────┘    │    │
│  │                               │                                      │    │
│  │  ┌───────────────┬────────────┼────────────┬──────────────────┐     │    │
│  │  │               │            │            │                  │     │    │
│  │  ▼               ▼            ▼            ▼                  ▼     │    │
│  │ ┌─────────┐ ┌─────────┐ ┌──────────┐ ┌──────────┐ ┌────────────┐   │    │
│  │ │ Anomaly │ │Reminder │ │Forecast  │ │ Vendor   │ │   Auth     │   │    │
│  │ │Detector │ │ Service │ │ Engine   │ │Optimizer │ │ Middleware │   │    │
│  │ └─────────┘ └─────────┘ └──────────┘ └──────────┘ └────────────┘   │    │
│  │                               │                                      │    │
│  │              ┌────────────────┼────────────────┐                    │    │
│  │              ▼                ▼                ▼                    │    │
│  │      ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │    │
│  │      │ TensorFlow  │  │  node-cron  │  │ Nodemailer  │             │    │
│  │      │   LSTM AI   │  │  Scheduler  │  │   Emails    │             │    │
│  │      └─────────────┘  └─────────────┘  └─────────────┘             │    │
│  └────────────────────────────┬────────────────────────────────────────┘    │
│                               │                                              │
│  ┌────────────────────────────▼────────────────────────────────────────┐    │
│  │                         DATABASE (MongoDB)                           │    │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │    │
│  │  │Inventory │ │  Orders  │ │ Vendors  │ │Historical│ │  Users   │   │    │
│  │  │  Items   │ │          │ │          │ │   Data   │ │          │   │    │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘   │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## ✨ Key Features

### 📊 Smart Inventory Management
- Track lumber items with fractional units (e.g., 10.5 units of "2x4 - 16'")
- Seasonal min/max thresholds (winter slow season, summer busy season)
- CSV import from existing spreadsheets
- Real-time inventory counts and history

### 🤖 AI-Powered Forecasting
- **LSTM Neural Network** trained on historical consumption patterns
- 30-45 day demand predictions
- Dynamic adjustment of min/target levels based on trends
- Weekly model retraining with new data

### 📦 Order Management
- Track purchase orders from placement to delivery
- Automatic lead time calculation per product/vendor
- Order status tracking (pending, shipped, delivered)
- Integration with inventory forecasts

### ⚠️ Proactive Alerts
- Email reminders when stock projected to fall below threshold
- Lead time-aware notifications (order before it's too late)
- Anomaly detection for suspicious inventory changes
- Dashboard notifications and email integration

### 💰 Vendor Optimization
- Store and compare pricing across vendors
- Track delivery times and reliability
- Suggest best vendor based on price/speed preference
- Historical pricing trends

### 🔒 Security
- JWT-based authentication
- Role-based access control
- Secure password hashing with bcrypt

## 🚀 Quick Start

### Prerequisites
- Node.js >= 18.0.0
- MongoDB (local or Atlas connection string)
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/lumber-forecast.git
cd lumber-forecast

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### Configuration

Create `.env` file in the backend directory:

```env
# Server
PORT=5000
NODE_ENV=development

# Database
MONGODB_URI=mongodb://localhost:27017/lumberflow

# JWT
JWT_SECRET=your-super-secret-key-change-in-production
JWT_EXPIRES_IN=7d

# Email (for reminders)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
ALERT_EMAIL=purchaser@company.com

# AI Model
MODEL_RETRAIN_SCHEDULE=0 0 * * 0
FORECAST_DAYS=45
```

Create `.env` file in the frontend directory:

```env
REACT_APP_API_URL=http://localhost:5000/api
```

### Running the Application

```bash
# Terminal 1: Start MongoDB (if local)
mongod

# Terminal 2: Start backend
cd backend
npm run dev

# Terminal 3: Start frontend
cd frontend
npm start
```

Visit `http://localhost:3000` to access the dashboard.

### Seed Demo Data

```bash
cd backend
npm run seed
```

This creates sample inventory items, historical data, and a demo user:
- **Email:** demo@lumberflow.com
- **Password:** Demo123!

## 📁 Project Structure

```
lumber-forecast/
├── backend/
│   ├── config/
│   │   └── db.js              # MongoDB connection
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── inventoryController.js
│   │   ├── orderController.js
│   │   ├── vendorController.js
│   │   ├── forecastController.js
│   │   └── alertController.js
│   ├── middleware/
│   │   ├── auth.js            # JWT verification
│   │   └── errorHandler.js
│   ├── models/
│   │   ├── User.js
│   │   ├── InventoryItem.js
│   │   ├── InventoryCount.js
│   │   ├── Order.js
│   │   ├── Vendor.js
│   │   └── Alert.js
│   ├── routes/
│   │   ├── auth.js
│   │   ├── inventory.js
│   │   ├── orders.js
│   │   ├── vendors.js
│   │   ├── forecasts.js
│   │   └── alerts.js
│   ├── services/
│   │   ├── forecastService.js   # TensorFlow.js LSTM
│   │   ├── anomalyService.js
│   │   ├── reminderService.js
│   │   └── vendorOptimizer.js
│   ├── utils/
│   │   ├── seasonHelper.js
│   │   └── csvParser.js
│   ├── seeds/
│   │   └── seedData.js
│   ├── server.js
│   └── package.json
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Layout/
│   │   │   ├── Dashboard/
│   │   │   ├── Inventory/
│   │   │   ├── Orders/
│   │   │   ├── Vendors/
│   │   │   ├── Forecasts/
│   │   │   └── common/
│   │   ├── pages/
│   │   ├── hooks/
│   │   ├── services/
│   │   ├── context/
│   │   ├── utils/
│   │   ├── App.js
│   │   └── index.js
│   └── package.json
├── docs/
│   └── screenshots/
└── README.md
```

## 🧠 AI/ML: How the Forecasting Works

### LSTM Model Architecture

```
Input Layer (sequence_length=12, features=3)
    │
    ▼
LSTM Layer (64 units, return_sequences=true)
    │
    ▼
Dropout (0.2)
    │
    ▼
LSTM Layer (32 units)
    │
    ▼
Dropout (0.2)
    │
    ▼
Dense Layer (16 units, ReLU)
    │
    ▼
Output Layer (1 unit - predicted demand)
```

### Training Process

1. **Data Collection**: Weekly inventory counts stored with timestamps
2. **Feature Engineering**: 
   - Weekly consumption rate
   - Season indicator (0=winter, 1=summer)
   - Day of year (normalized)
3. **Sequence Creation**: 12-week sliding window
4. **Model Training**: Adam optimizer, MSE loss
5. **Retraining Schedule**: Weekly (Sunday midnight) via node-cron

### Prediction Flow

```javascript
// Simplified prediction logic
const predict = async (itemId, daysAhead) => {
  const history = await getHistoricalData(itemId, 12); // 12 weeks
  const features = engineerFeatures(history);
  const prediction = model.predict(features);
  return denormalize(prediction);
};
```

## 🔌 API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login, returns JWT |
| GET | `/api/auth/me` | Get current user |

### Inventory
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/inventory` | List all items |
| POST | `/api/inventory` | Create item |
| GET | `/api/inventory/:id` | Get item details |
| PUT | `/api/inventory/:id` | Update item |
| DELETE | `/api/inventory/:id` | Delete item |
| POST | `/api/inventory/:id/count` | Record count |
| POST | `/api/inventory/import` | CSV import |

### Orders
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/orders` | List orders |
| POST | `/api/orders` | Create order |
| PUT | `/api/orders/:id/status` | Update status |
| GET | `/api/orders/lead-times` | Get avg lead times |

### Vendors
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/vendors` | List vendors |
| POST | `/api/vendors` | Add vendor |
| GET | `/api/vendors/:id/prices` | Get vendor prices |
| POST | `/api/vendors/compare` | Compare for item |

### Forecasts
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/forecasts/:itemId` | Get forecast |
| POST | `/api/forecasts/retrain` | Trigger retrain |
| GET | `/api/forecasts/batch` | Batch forecasts |

### Alerts
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/alerts` | List alerts |
| PUT | `/api/alerts/:id/dismiss` | Dismiss alert |
| GET | `/api/alerts/anomalies` | Get anomalies |

## 🧪 Testing

```bash
cd backend
npm test           # Run all tests
npm run test:watch # Watch mode
npm run test:coverage # Coverage report
```

## 🚢 Deployment

### Heroku

```bash
# Install Heroku CLI
heroku create lumberflow-app

# Set environment variables
heroku config:set MONGODB_URI=your-atlas-uri
heroku config:set JWT_SECRET=your-secret
# ... other vars

# Deploy
git push heroku main
```

### Vercel (Frontend) + Railway (Backend)

1. Deploy backend to Railway with MongoDB addon
2. Deploy frontend to Vercel with API URL pointing to Railway

### Docker

```bash
docker-compose up -d
```

## 📸 Screenshots

*See `/docs/screenshots/` for application screenshots*

## 🔮 Future Enhancements

- [ ] Mobile app (React Native)
- [ ] Barcode scanning for counts
- [ ] Multi-location support
- [ ] Purchase order generation
- [ ] Integration with accounting software
- [ ] Advanced ML: ensemble methods, external factors (weather, construction trends)
- [ ] Real-time WebSocket updates

## 📄 License

MIT License - see LICENSE file for details.

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

Built with ❤️ for lumber companies looking to modernize inventory management.

# OurCityNirman Backend — Production Deployment Guide

## 📁 Project Structure

```
src/
├── app.js              ← Express middleware setup
├── routes.js           ← Centralized route registry
├── index.js            ← Entry point (server boot + graceful shutdown)
├── constants.js        ← App-level constants (DB_NAME etc.)
├── modules/            ← Feature modules (auth, orders, vendor, etc.)
└── shared/             ← Middleware, utils, DB, services
```

---

## 🔧 Local Development

```bash
# 1. Clone & install
npm install

# 2. Setup environment files
# Local dev (using MongoDB localhost)
cp .env.example .env.development
# Production simulation (using MongoDB Atlas)
cp .env.example .env.production

# 3. Start dev server (loads .env.development)
npm run dev

# 4. Test production mode locally (loads .env.production)
npm start

# Health check
curl http://localhost:5000/api/v1/health
```

---

## 🚀 Production Deployment

### Option A — Render / Railway / Fly.io

1. Set all env vars in the platform dashboard (copy from `.env.example`)
2. Set **Build Command**: `npm install`
3. Set **Start Command**: `npm start`
4. Set `NODE_ENV=production`
5. Use your **MongoDB Atlas URI** for `MONGODB_URI`

### Option B — VPS (Ubuntu + PM2)

```bash
# On the server
git clone <your-repo>
cd OurCityNirman-Backend
npm install --omit=dev

# Create .env with production values
nano .env

# Install PM2 globally
npm install -g pm2

# Start with PM2 (uses ecosystem.config.cjs)
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup

# Check logs
pm2 logs ourcitynirman-backend
```

### Option C — Docker

```bash
docker build -t ourcitynirman-backend .
docker run -d \
  --name ocn-api \
  -p 5000:5000 \
  --env-file .env.production \
  ourcitynirman-backend
```

---

## ✅ Pre-Production Checklist

| Item | Check |
|---|---|
| `NODE_ENV=production` | Must be set |
| `MONGODB_URI` pointing to Atlas (not localhost) | ✅ |
| Strong JWT secrets (64+ chars random hex) | ✅ |
| `RAZORPAY_KEY_ID` using `rzp_live_*` key | ✅ |
| `CORS_ORIGIN` set to your production domain | ✅ |
| `FRONTEND_URL` set to your production domain | ✅ |
| Cloudinary using production account | ✅ |
| Email credentials verified | ✅ |

---

## 🌐 API Base URL

- **Local**: `http://localhost:5000/api/v1`
- **Production**: `https://api.ourcitynirman.com/api/v1`

## 🔍 Health Check

```
GET /api/v1/health
```

Response:
```json
{
  "success": true,
  "status": "ok",
  "timestamp": "2026-05-05T...",
  "environment": "production"
}
```

---

## 📋 All API Endpoints

| Module | Base Path |
|---|---|
| Auth | `/api/v1/auth` |
| Products | `/api/v1/products` |
| Brands | `/api/v1/brands` |
| Categories | `/api/v1/categories` |
| HSN Codes | `/api/v1/hsn` |
| Search | `/api/v1/search` |
| Inventory | `/api/v1/inventory` |
| User Address | `/api/v1/user/address` |
| Cart | `/api/v1/user/cart` |
| Wishlist | `/api/v1/user/wishlist` |
| Orders | `/api/v1/orders` |
| Reviews | `/api/v1/reviews` |
| Invoice | `/api/v1/invoice` |
| Vendor | `/api/v1/vendor` |
| Shop | `/api/v1/shop` |
| Shop Reviews | `/api/v1/shop-reviews` |
| Admin | `/api/v1/admin` |
| Slider | `/api/v1/slider` |
| Settings | `/api/v1/settings` |

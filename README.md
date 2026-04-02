# Food Ordering System

**Enterprise-Grade Full-Stack Food Ordering Platform**

A production-ready, scalable food ordering system built with Node.js, Express, MySQL, React, and Expo. Designed for resilience, real-time updates, and comprehensive audit trails.

---

## Table of Contents

- [Overview](#overview)
- [Technology Stack](#technology-stack)
- [Core Features](#core-features)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Installation & Setup](#installation--setup)
- [Configuration](#configuration)
- [Deployment](#deployment)
- [API Documentation](#api-documentation)
- [Database Schema](#database-schema)
- [Troubleshooting](#troubleshooting)
- [Educational Value](#educational-value)

---

## Overview

This project demonstrates a complete, production-ready food ordering platform with:

- **Multi-platform support**: Web (React), Mobile (Expo/React Native), and API
- **Enterprise security**: JWT authentication, OAuth 2.0 integration, rate limiting
- **Real-time capabilities**: WebSocket events via Socket.IO
- **Data resilience**: ACID transactions, audit logging, backup/restore systems
- **Cloud-ready infrastructure**: Docker containerization, CI/CD automation

---

## Technology Stack

### Backend
| Component | Version | Purpose |
|-----------|---------|---------|
| Node.js | 22+ | Runtime environment |
| Express.js | 4.18+ | REST API framework |
| MySQL | 8.4+ | Primary data store |
| JWT (jsonwebtoken) | 9.0.3+ | Authentication tokens |
| Socket.IO | 4.8+ | Real-time WebSocket events |
| Redis (ioredis) | 5.10+ | Distributed cache (optional) |
| Passport.js | 0.7+ | OAuth authentication |

### Frontend
| Component | Version | Purpose |
|-----------|---------|---------|
| React | 18.2+ | UI framework |
| React Router | 6.22+ | Client-side routing |
| Axios | 1.5+ | HTTP client |
| Socket.IO Client | 4.8+ | Real-time updates |
| Web Notifications API | Native | Browser push notifications |

### Mobile
| Component | Version | Purpose |
|-----------|---------|---------|
| Expo | 51.0+ | React Native runtime |
| React Native | 0.74+ | Mobile framework |
| Socket.IO Client | 4.8+ | Real-time updates |
| Expo Notifications | 55.0+ | Push-like alerts |

### DevOps
| Tool | Purpose |
|------|---------|
| Docker | Containerization |
| Docker Compose | Multi-service orchestration |
| GitHub Actions | CI/CD automation |
| PowerShell | Database backup/restore |

---

## Core Features

### Authentication & Security
- JWT-based access tokens (7-day expiry)
- Google OAuth 2.0 support
- Rate limiting on auth endpoints (50 req/15min per IP)
- Password hashing with bcrypt
- Protected API routes with token middleware

### Order Management
- Transactional order placement with `FOR UPDATE` row locking
- Real-time order status updates via Socket.IO
- Order history per user
- Admin order status management
- Order items with menu reference

### Review System
- Rate and review after purchase
- CRUD operations with ownership validation
- Restaurant-aggregated statistics

### Inventory & Menu
- Real-time inventory tracking
- Low-stock alerts
- Menu categories and item management
- Audit logging of inventory changes

### Pricing & Promotions
- Promo code validation and application
- Percentage and fixed-amount discount types
- Usage limits and expiration tracking
- Minimum order thresholds

### Analytics & Reporting
- Order analytics dashboard
- Top customers report
- Recovery logs for compliance
- Audit trails for all data changes

### Data Integrity
- ACID transactions with rollback
- Foreign key constraints
- Normalized schema (3NF)
- Comprehensive audit logging

---

## Architecture

### System Diagram

```
┌─────────────────┐         ┌──────────────────┐
│   Web Frontend  │         │  Mobile App      │
│   (React 18.2)  │         │  (Expo/RN 0.74)  │
└────────┬────────┘         └──────────┬───────┘
         │                            │
         │    HTTPS/WebSocket         │
         └────────────┬───────────────┘
                      │
              ┌───────▼────────┐
              │  Express API   │
              │  (Node 22)     │
              ├────────────────┤
              │ Routes:        │
              │ • /api/auth    │
              │ • /api/orders  │
              │ • /api/reviews │
              │ • /api/promos  │
              │ • /api/admin   │
              └────────┬──────┘
                       │
           ┌───────────┼───────────┐
           │           │           │
      ┌────▼──┐   ┌───▼───┐  ┌───▼────┐
      │ MySQL │   │ Redis │  │Socket.IO
      │ 8.4   │   │Cache  │  │Server
      └───────┘   └───────┘  └────────┘
```

### Data Flow

1. **Authentication**: User registers/logs in → JWT generated → Token stored in localStorage/secure storage
2. **Order Placement**: User submits order → Backend validates stock → Transaction begins → Order + items inserted → Inventory deducted → Event emitted via Socket.IO
3. **Real-time Updates**: Admin updates order status → Event emitted → All connected clients notified instantly
4. **Review Submission**: User submits review → Backend derives restaurant from order → Review persisted → Available to other users

---

## Prerequisites

### System Requirements
- **OS**: Windows 10+, macOS 10.14+, or Ubuntu 18.04+
- **RAM**: 4GB minimum (8GB recommended)
- **Disk**: 2GB free space
- **Internet**: Required for OAuth and npm packages

### Required Software
- Node.js 22+ ([download](https://nodejs.org/))
- MySQL 8.4+ ([download](https://dev.mysql.com/downloads/mysql/))
- Docker & Docker Compose ([download](https://www.docker.com/products/docker-desktop))
- Git ([download](https://git-scm.com/))

### Optional
- Redis 7.0+ (for distributed caching; in-memory fallback available)
- Google OAuth credentials ([setup guide](https://console.cloud.google.com/))

---

## Installation & Setup

### Project Structure

```
food-ordering-system/
├── backend/                    # Express REST API
│   ├── controllers/
│   ├── routes/
│   ├── middleware/
│   ├── utils/
│   ├── config/
│   ├── server.js
│   ├── .env.example
│   └── package.json
├── frontend/                   # React web application
│   ├── src/
│   ├── public/
│   ├── nginx.conf
│   ├── .env.example
│   └── package.json
├── mobile_app/                 # Expo React Native app
│   ├── src/
│   ├── .env.example
│   └── package.json
├── database/
│   ├── schema.sql              # Database initialization
│   ├── backup.ps1              # Backup script
│   └── restore.ps1             # Restore script
├── docker-compose.yml
└── README.md
```

### Quick Start (Windows PowerShell - 3 Terminals)

#### Terminal 1: Backend API

```powershell
cd D:\sql_project\food-ordering-system\backend
if (!(Test-Path .env)) { Copy-Item .env.example .env }
npm install
npm start
```

Expected output: `Server running on port 5000`

**Endpoints**:
- Health check: `http://localhost:5000/health`
- API base: `http://localhost:5000/api`

#### Terminal 2: Frontend (Web)

```powershell
cd D:\sql_project\food-ordering-system\frontend
npm install
npm start
```

Expected output: `Compiled successfully! Served at http://localhost:3000`

**Access**: Open `http://localhost:3000` in your browser

#### Terminal 3: Mobile (Expo)

```powershell
cd D:\sql_project\food-ordering-system\mobile_app
if (!(Test-Path .env)) { Copy-Item .env.example .env }
npm install
npm start
```

**Configure LAN Access**:
Edit `mobile_app/.env`:
```env
EXPO_PUBLIC_API_BASE_URL=http://<YOUR_PC_LAN_IP>:5000
```

Find your LAN IP:
```powershell
ipconfig | Select-String "IPv4"
```

Scan QR code with Expo Go app (iOS) or Android.

---

## Configuration

### Backend Environment Variables

Create `backend/.env` from `backend/.env.example`:

```env
# Server
PORT=5000
NODE_ENV=development

# Database
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=root
DB_NAME=food_ordering

# JWT & Sessions
JWT_SECRET=your_super_secret_key_change_this_in_production_min_32_chars
SESSION_SECRET=your_session_secret_change_this_min_32_chars

# OAuth (Optional - Leave empty to disable)
GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=http://localhost:5000/api/auth/oauth/google/callback
OAUTH_FRONTEND_REDIRECT=http://localhost:3000

# Caching (Optional - Leave empty for in-memory cache)
REDIS_URL=redis://localhost:6379

# WebSocket CORS
SOCKET_CORS_ORIGIN=http://localhost:3000
```

### Frontend Environment Variables

Create `frontend/.env.example`:
```env
REACT_APP_API_BASE_URL=http://localhost:5000/api
```

### Mobile Environment Variables

Create `mobile_app/.env`:
```env
EXPO_PUBLIC_API_BASE_URL=http://<LAN_IP>:5000
```

---

## Deployment

### Local Docker Deployment

```powershell
cd D:\sql_project\food-ordering-system
docker compose up --build
```

**Services**:
- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:5000`
- MySQL: `localhost:3306`
- Redis: `localhost:6379`

### Production Considerations

- Use environment-specific `.env` files
- Generate strong JWT and session secrets (minimum 32 characters)
- Enable HTTPS with valid SSL certificates
- Use managed MySQL (AWS RDS, Azure Database, Google Cloud SQL)
- Use managed Redis (AWS ElastiCache, Azure Cache)
- Enable database automated backups
- Configure WAF and DDoS protection
- Implement request logging and monitoring

---

## API Documentation

### Endpoints Overview

| Method | Endpoint | Purpose | Auth |
|--------|----------|---------|------|
| POST | `/api/auth/register` | User registration | ❌ |
| POST | `/api/auth/login` | User login | ❌ |
| GET | `/api/auth/me` | Current user profile | ✅ |
| GET | `/api/restaurants` | List all restaurants | ❌ |
| GET | `/api/restaurants/:id/menu` | Get restaurant menu | ❌ |
| POST | `/api/orders` | Place new order | ✅ |
| GET | `/api/orders` | Get user orders | ✅ |
| POST | `/api/orders/:id/status` | Update order status | ✅ Admin |
| POST | `/api/reviews` | Add review | ✅ |
| GET | `/api/reviews/:restaurantId` | Get reviews | ❌ |
| POST | `/api/promos/validate` | Validate promo code | ❌ |
| GET | `/api/analytics/summary` | Order analytics | ✅ Admin |

For complete API schema, see `backend/routes/`.

---

## Database Schema

### Core Tables

**users**
```sql
- id: INT PRIMARY KEY AUTO_INCREMENT
- email: VARCHAR(255) UNIQUE NOT NULL
- name: VARCHAR(255) NOT NULL
- password_hash: VARCHAR(255)
- role: ENUM('user', 'admin') DEFAULT 'user'
- created_at: TIMESTAMP DEFAULT CURRENT_TIMESTAMP
```

**orders**
```sql
- id: INT PRIMARY KEY AUTO_INCREMENT
- user_id: INT NOT NULL (FK → users)
- restaurant_id: INT NOT NULL (FK → restaurants)
- total_amount: DECIMAL(10,2) NOT NULL
- discount_amount: DECIMAL(10,2) DEFAULT 0
- status: ENUM('pending', 'confirmed', 'preparing', 'ready', 'delivered') DEFAULT 'pending'
- created_at: TIMESTAMP DEFAULT CURRENT_TIMESTAMP
```

**Additional Tables**: `restaurants`, `menu`, `order_items`, `reviews`, `inventory_logs`, `promo_codes`, `recovery_logs`, `order_promotions`

### Key Relationships

- Users → Orders (1:N)
- Orders → Order Items (1:N)
- Order Items → Menu (N:1)
- Restaurants → Menu (1:N)
- Users → Reviews (1:N)
- Orders → Promos (N:N via order_promotions)

---

## Troubleshooting

### 1. npm Start Fails: ENOENT package.json

**Cause**: Running from wrong directory

**Solution**:
```powershell
# Wrong
cd food-ordering-system
npm install

# Correct
cd food-ordering-system\backend
npm install
```

### 2. Frontend Crashes: "undefined" is not valid JSON

**Cause**: Corrupted localStorage from previous sessions

**Solution** (Browser DevTools Console):
```javascript
localStorage.removeItem("user");
localStorage.removeItem("auth_token");
location.reload();
```

### 3. Port 5000 Already in Use

**Solution**:
```powershell
netstat -ano | findstr :5000
taskkill /PID <PID> /F
```

Or change `PORT` in `backend/.env`.

### 4. Mobile App Cannot Reach Backend

**Checklist**:
- ✅ Phone and PC on same Wi-Fi network
- ✅ Using LAN IP (`ipconfig`), not `localhost`
- ✅ Firewall allows Node.js (Windows Defender Firewall)
- ✅ Backend running and accessible: `curl http://<IP>:5000/health`

### 5. Docker Compose Port Conflict

**Solution**:
```powershell
docker compose down
docker system prune -a
docker compose up --build
```

### 6. MySQL Connection Refused

**Solution**:
```powershell
# Check MySQL service
Get-Service MySQL80  # or your MySQL version

# Or use Docker MySQL
docker compose up mysql -d
```

---

## Database Backup & Restore

### Backup

```powershell
cd D:\sql_project\food-ordering-system\database
.\backup.ps1 -OutputFile backup-$(Get-Date -Format 'yyyyMMdd-HHmmss').sql
```

### Restore

```powershell
cd D:\sql_project\food-ordering-system\database
.\restore.ps1 -InputFile backup-20240402-120000.sql
```

---

## CI/CD Pipeline

GitHub Actions workflow is configured at `.github/workflows/ci.yml`

**Triggers**: On push and pull requests

**Jobs**:
1. Backend syntax validation (Node.js)
2. Frontend production build (React)
3. Mobile syntax check (React Native)

---

## Educational Value

This project demonstrates:

#### Database Concepts
- Entity-Relationship (ER) modeling
- Normalization (1NF, 2NF, 3NF)
- Primary and Foreign Key constraints
- SQL transactions and ACID properties
- Concurrency control (row-level locking with `FOR UPDATE`)
- Audit logging and recovery

#### Backend Concepts
- REST API design patterns
- Authentication (JWT, OAuth 2.0)
- Authorization and role-based access control (RBAC)
- Rate limiting
- Caching strategies (Redis + fallback)
- Real-time updates (WebSockets)
- Error handling and validation

#### Frontend Concepts
- Component-based architecture
- State management
- Client-side routing
- API integration
- Real-time event handling
- Responsive design

#### DevOps Concepts
- Containerization (Docker)
- Container orchestration (Docker Compose)
- Continuous Integration (GitHub Actions)
- Infrastructure as Code
- Backup and disaster recovery

---

## License

This project is provided for educational purposes.



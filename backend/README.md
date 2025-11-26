# Nafes Healthcare Management System - Backend API

A comprehensive Node.js + Express backend API for the Nafes Healthcare Management System with PostgreSQL database integration.

## 🚀 Features

### **Complete CRUD Operations**
- **8 Database Tables**: Patients, Providers, Insurers, Authorizations, Eligibility, Claims, Claim Batches, Payments
- **RESTful API**: Full CRUD operations for all entities
- **Advanced Queries**: JOIN operations for related data
- **Pagination**: Efficient data loading with pagination support
- **Search & Filtering**: Full-text search across all tables

### **Production-Ready Features**
- **Security**: Helmet.js, CORS, Rate Limiting
- **Error Handling**: Comprehensive error handling and validation
- **Database Pooling**: Efficient PostgreSQL connection management
- **Input Validation**: Joi schema validation
- **Logging**: Request/response logging
- **Health Checks**: Database connectivity monitoring

### **API Endpoints**

#### **Patients** (`/api/patients`)
- `GET /api/patients` - List all patients with pagination and search
- `GET /api/patients/:id` - Get patient with related claims and authorizations
- `POST /api/patients` - Create new patient
- `PUT /api/patients/:id` - Update patient
- `DELETE /api/patients/:id` - Delete patient

#### **Providers** (`/api/providers`)
- `GET /api/providers` - List all providers with pagination and search
- `GET /api/providers/:id` - Get provider with related claims and statistics
- `POST /api/providers` - Create new provider
- `PUT /api/providers/:id` - Update provider
- `DELETE /api/providers/:id` - Delete provider

#### **Insurers** (`/api/insurers`)
- `GET /api/insurers` - List all insurers with pagination and search
- `GET /api/insurers/:id` - Get insurer with related claims and payment statistics
- `POST /api/insurers` - Create new insurer
- `PUT /api/insurers/:id` - Update insurer
- `DELETE /api/insurers/:id` - Delete insurer

#### **Authorizations** (`/api/authorizations`)
- `GET /api/authorizations` - List all authorizations with joins
- `GET /api/authorizations/:id` - Get authorization with full details
- `POST /api/authorizations` - Create new authorization
- `PUT /api/authorizations/:id` - Update authorization
- `PATCH /api/authorizations/:id/status` - Update authorization status
- `DELETE /api/authorizations/:id` - Delete authorization

#### **Eligibility** (`/api/eligibility`)
- `GET /api/eligibility` - List all eligibility records with joins
- `GET /api/eligibility/:id` - Get eligibility record with full details
- `POST /api/eligibility` - Create new eligibility record
- `PUT /api/eligibility/:id` - Update eligibility record
- `PATCH /api/eligibility/:id/status` - Update eligibility status
- `DELETE /api/eligibility/:id` - Delete eligibility record

#### **Claims** (`/api/claims`)
- `GET /api/claims` - List all claims with joins
- `GET /api/claims/stats` - Get claims statistics
- `GET /api/claims/:id` - Get claim with full details
- `POST /api/claims` - Create new claim
- `PUT /api/claims/:id` - Update claim
- `PATCH /api/claims/:id/status` - Update claim status
- `DELETE /api/claims/:id` - Delete claim

#### **Claim Batches** (`/api/claim-batches`)
- `GET /api/claim-batches` - List all claim batches with joins
- `GET /api/claim-batches/stats` - Get claim batch statistics
- `GET /api/claim-batches/:id` - Get claim batch with related claims
- `POST /api/claim-batches` - Create new claim batch
- `PUT /api/claim-batches/:id` - Update claim batch
- `PATCH /api/claim-batches/:id/status` - Update claim batch status
- `DELETE /api/claim-batches/:id` - Delete claim batch

#### **Payments** (`/api/payments`)
- `GET /api/payments` - List all payments with joins
- `GET /api/payments/stats` - Get payment statistics
- `GET /api/payments/insurer/:insurerId` - Get payments by insurer
- `GET /api/payments/:id` - Get payment with full details
- `POST /api/payments` - Create new payment
- `PUT /api/payments/:id` - Update payment
- `PATCH /api/payments/:id/status` - Update payment status
- `DELETE /api/payments/:id` - Delete payment

#### **Dashboard** (`/api/dashboard`)
- `GET /api/dashboard/stats` - Get comprehensive dashboard statistics

## 🛠️ Technology Stack

- **Runtime**: Node.js with ES Modules
- **Framework**: Express.js
- **Database**: PostgreSQL with pg (node-postgres)
- **Validation**: Joi
- **Security**: Helmet.js, CORS, Rate Limiting
- **Environment**: dotenv

## 📋 Prerequisites

- Node.js (v16 or higher)
- PostgreSQL (v12 or higher)
- npm or yarn

## 🚀 Installation & Setup

### 1. **Clone and Install Dependencies**
```bash
cd backend
npm install
```

### 2. **Database Setup**
Create a PostgreSQL database and run the schema:

```sql
-- Create database
CREATE DATABASE nafes_healthcare;

-- Connect to the database and run the schema
\c nafes_healthcare;

-- Run the schema.sql file (see below)
```

### 3. **Environment Configuration**
Copy the example environment file and configure:

```bash
cp env.example .env
```

Edit `.env` with your database credentials:

```env
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=nafes_healthcare
DB_USER=your_username
DB_PASSWORD=your_password

# Server Configuration
PORT=8000
NODE_ENV=development

# CORS Configuration
CORS_ORIGIN=http://localhost:5173

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### 4. **Start the Server**

**Development Mode:**
```bash
npm run dev
```

**Production Mode:**
```bash
npm start
```

The server will start on `http://localhost:8000`

## 🗄️ Database Schema

The API expects the following PostgreSQL tables:

### **Patients Table**
```sql
CREATE TABLE patients (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    identifier VARCHAR(50) UNIQUE NOT NULL,
    gender VARCHAR(10) NOT NULL CHECK (gender IN ('Male', 'Female', 'Other')),
    birth_date DATE NOT NULL,
    phone VARCHAR(20),
    email VARCHAR(255),
    address TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### **Providers Table**
```sql
CREATE TABLE providers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(100) NOT NULL,
    nphies_id VARCHAR(50) UNIQUE NOT NULL,
    address TEXT,
    phone VARCHAR(20),
    email VARCHAR(255),
    contact_person VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### **Insurers Table**
```sql
CREATE TABLE insurers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    nphies_id VARCHAR(50) UNIQUE NOT NULL,
    status VARCHAR(20) DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive', 'Suspended')),
    contact_person VARCHAR(255),
    phone VARCHAR(20),
    email VARCHAR(255),
    address TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### **Authorizations Table**
```sql
CREATE TABLE authorizations (
    id SERIAL PRIMARY KEY,
    status VARCHAR(20) NOT NULL CHECK (status IN ('Approved', 'Pending', 'Rejected', 'Under Review')),
    purpose VARCHAR(255) NOT NULL,
    patient_id INTEGER REFERENCES patients(id) ON DELETE CASCADE,
    provider_id INTEGER REFERENCES providers(id) ON DELETE CASCADE,
    insurer_id INTEGER REFERENCES insurers(id) ON DELETE CASCADE,
    amount DECIMAL(10,2),
    request_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    approval_date TIMESTAMP,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### **Eligibility Table**
```sql
CREATE TABLE eligibility (
    id SERIAL PRIMARY KEY,
    purpose VARCHAR(255) NOT NULL,
    patient_id INTEGER REFERENCES patients(id) ON DELETE CASCADE,
    provider_id INTEGER REFERENCES providers(id) ON DELETE CASCADE,
    insurer_id INTEGER REFERENCES insurers(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL CHECK (status IN ('Eligible', 'Not Eligible', 'Pending', 'Under Review')),
    coverage VARCHAR(20),
    request_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    response_date TIMESTAMP,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### **Claims Table**
```sql
CREATE TABLE claims (
    id SERIAL PRIMARY KEY,
    claim_number VARCHAR(50) UNIQUE NOT NULL,
    patient_id INTEGER REFERENCES patients(id) ON DELETE CASCADE,
    provider_id INTEGER REFERENCES providers(id) ON DELETE CASCADE,
    insurer_id INTEGER REFERENCES insurers(id) ON DELETE CASCADE,
    authorization_id INTEGER REFERENCES authorizations(id) ON DELETE SET NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('Approved', 'Pending', 'Rejected', 'Under Review')),
    amount DECIMAL(10,2) NOT NULL,
    submission_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_date TIMESTAMP,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### **Claim Batches Table**
```sql
CREATE TABLE claim_batches (
    id SERIAL PRIMARY KEY,
    batch_identifier VARCHAR(50) UNIQUE NOT NULL,
    provider_id INTEGER REFERENCES providers(id) ON DELETE CASCADE,
    insurer_id INTEGER REFERENCES insurers(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL CHECK (status IN ('Processed', 'Pending', 'Rejected', 'Under Review')),
    total_amount DECIMAL(12,2),
    submission_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_date TIMESTAMP,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### **Payments Table**
```sql
CREATE TABLE payments (
    id SERIAL PRIMARY KEY,
    payment_ref_number VARCHAR(50) UNIQUE NOT NULL,
    provider_id INTEGER REFERENCES providers(id) ON DELETE CASCADE,
    insurer_id INTEGER REFERENCES insurers(id) ON DELETE CASCADE,
    claim_id INTEGER REFERENCES claims(id) ON DELETE SET NULL,
    total_amount DECIMAL(10,2) NOT NULL,
    payment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) NOT NULL CHECK (status IN ('Completed', 'Pending', 'Failed', 'Processing')),
    method VARCHAR(50),
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## 📊 API Response Format

### **Success Response**
```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 100,
    "pages": 10
  }
}
```

### **Error Response**
```json
{
  "error": "Error message",
  "message": "Detailed error description"
}
```

## 🔍 Query Parameters

### **Pagination**
- `page` - Page number (default: 1)
- `limit` - Records per page (default: 10)

### **Search**
- `search` - Full-text search across relevant fields

### **Filtering**
- `status` - Filter by status (where applicable)

## 🛡️ Security Features

- **Rate Limiting**: 100 requests per 15 minutes per IP
- **CORS**: Configurable cross-origin resource sharing
- **Helmet**: Security headers
- **Input Validation**: Joi schema validation
- **SQL Injection Protection**: Parameterized queries

## 🚦 Health Monitoring

### **Health Check Endpoint**
```bash
GET /health
```

Response:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-20T10:30:00.000Z",
  "uptime": 3600,
  "database": "connected"
}
```

## 🧪 Testing the API

### **Using curl**
```bash
# Get all patients
curl http://localhost:8000/api/patients

# Get patient by ID
curl http://localhost:8000/api/patients/1

# Create new patient
curl -X POST http://localhost:8000/api/patients \
  -H "Content-Type: application/json" \
  -d '{
    "name": "أحمد محمد العلي",
    "identifier": "1234567890",
    "gender": "Male",
    "birth_date": "1985-03-15",
    "phone": "+966501234567",
    "email": "ahmed.ali@example.com"
  }'
```

### **Using Postman**
Import the API collection or use the provided endpoints above.

## 📝 Development

### **Project Structure**
```
backend/
├── controllers/          # Business logic controllers
├── routes/              # Express route definitions
├── models/              # Database schemas and validation
├── db.js               # Database connection
├── server.js           # Main application file
├── package.json        # Dependencies and scripts
└── README.md          # This file
```

### **Adding New Endpoints**
1. Create controller in `controllers/`
2. Create route in `routes/`
3. Add route to `server.js`
4. Update validation schema if needed

## 🚀 Deployment

### **Production Considerations**
- Set `NODE_ENV=production`
- Configure proper database credentials
- Set up SSL/TLS certificates
- Configure reverse proxy (nginx)
- Set up monitoring and logging
- Configure backup strategies

### **Docker Support** (Optional)
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 8000
CMD ["npm", "start"]
```

## 📞 Support

For issues and questions:
- Check the health endpoint: `/health`
- Review server logs for errors
- Verify database connectivity
- Check environment variables

## 📄 License

This project is licensed under the MIT License.

---

**Built with ❤️ for the Nafes Healthcare Management System**

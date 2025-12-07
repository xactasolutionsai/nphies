# NAFES Healthcare Management System
## Technical Specification Document

**Version:** 1.0  
**Date:** December 2024  
**Author:** NAFES Development Team

---

## Table of Contents

1. [Technology Stack](#1-technology-stack)
2. [Backend Architecture](#2-backend-architecture)
3. [Frontend Architecture](#3-frontend-architecture)
4. [Database Architecture](#4-database-architecture)
5. [AI/ML Integration](#5-aiml-integration)
6. [NPHIES Integration](#6-nphies-integration)
7. [API Reference](#7-api-reference)
8. [Security](#8-security)

---

## 1. Technology Stack

### 1.1 Backend Technologies

| Technology | Version | Purpose |
|------------|---------|---------|
| Node.js | 18+ | JavaScript runtime |
| Express.js | 4.18.2 | Web framework |
| PostgreSQL | 14+ | Primary database |
| pg | 8.11.3 | PostgreSQL client |
| Joi | 17.11.0 | Request validation |
| Axios | 1.13.2 | HTTP client for NPHIES |
| Helmet | 7.1.0 | Security headers |
| CORS | 2.8.5 | Cross-origin resource sharing |
| express-rate-limit | 7.1.5 | API rate limiting |
| dotenv | 16.3.1 | Environment configuration |

### 1.2 Frontend Technologies

| Technology | Version | Purpose |
|------------|---------|---------|
| React | 18.2.0 | UI framework |
| Vite | 4.5.0 | Build tool and dev server |
| React Router DOM | 6.20.1 | Client-side routing |
| TailwindCSS | 3.3.5 | Utility-first CSS |
| React Hook Form | 7.63.0 | Form management |
| Zod | 4.1.11 | Schema validation |
| Recharts | 2.8.0 | Data visualization |
| Lucide React | 0.294.0 | Icon library |
| React Select | 5.10.2 | Enhanced select inputs |
| React Datepicker | 8.8.0 | Date selection |
| date-fns | 4.1.0 | Date utilities |
| clsx | 2.0.0 | Conditional classnames |
| tailwind-merge | 2.0.0 | Tailwind class merging |

### 1.3 AI/ML Technologies

| Technology | Version | Purpose |
|------------|---------|---------|
| Ollama | 0.6.2 | Local LLM inference |
| LangChain | 1.0.3 | LLM application framework |
| @langchain/ollama | 1.0.0 | Ollama integration |
| @langchain/community | 1.0.0 | Community integrations |
| pgvector | - | Vector similarity search |

### 1.4 Development Tools

| Technology | Version | Purpose |
|------------|---------|---------|
| Nodemon | 3.0.2 | Development auto-reload |
| ESLint | 8.53.0 | Code linting |
| PostCSS | 8.4.31 | CSS processing |
| Autoprefixer | 10.4.16 | CSS vendor prefixes |

---

## 2. Backend Architecture

### 2.1 Project Structure

```
backend/
├── server.js                 # Application entry point
├── db.js                     # Database connection
├── package.json              # Dependencies
├── .env                      # Environment variables
│
├── controllers/              # Request handlers (21 files)
│   ├── baseController.js
│   ├── patientsController.js
│   ├── providersController.js
│   ├── insurersController.js
│   ├── eligibilityController.js
│   ├── priorAuthorizationsController.js
│   ├── claimsController.js
│   ├── claimBatchesController.js
│   ├── dentalApprovalsController.js
│   ├── eyeApprovalsController.js
│   ├── standardApprovalsController.js
│   ├── generalRequestsController.js
│   ├── medicinesController.js
│   ├── medicationSafetyController.js
│   ├── nphiesCodesController.js
│   ├── chatController.js
│   ├── aiValidationController.js
│   ├── paymentsController.js
│   ├── authorizationsController.js
│   ├── responseViewerController.js
│   └── generalRequestValidationController.js
│
├── routes/                   # API route definitions (21 files)
│   ├── patients.js
│   ├── providers.js
│   ├── insurers.js
│   ├── eligibility.js
│   ├── priorAuthorizations.js
│   ├── claims.js
│   ├── claimBatches.js
│   ├── dentalApprovals.js
│   ├── eyeApprovals.js
│   ├── standardApprovals.js
│   ├── generalRequests.js
│   ├── medicines.js
│   ├── medicationSafety.js
│   ├── nphiesCodes.js
│   ├── chat.js
│   ├── aiValidation.js
│   ├── payments.js
│   ├── authorizations.js
│   ├── responseViewer.js
│   ├── generalRequestValidation.js
│   └── dashboard.js
│
├── services/                 # Business logic (21 files)
│   ├── nphiesService.js          # NPHIES API communication
│   ├── eligibilityService.js     # Eligibility processing
│   ├── ollamaService.js          # Ollama AI integration
│   ├── ragService.js             # RAG retrieval
│   ├── medbotService.js          # Medical chatbot
│   ├── chatService.js            # Chat management
│   ├── medicationSafetyService.js
│   ├── medicalValidationService.js
│   ├── generalRequestValidationService.js
│   └── priorAuthMapper/          # FHIR mappers
│       ├── index.js              # Mapper factory
│       ├── BaseMapper.js         # Base FHIR mapping
│       ├── ProfessionalMapper.js # Professional claims
│       ├── InstitutionalMapper.js# Institutional claims
│       ├── DentalMapper.js       # Dental claims
│       ├── VisionMapper.js       # Vision claims
│       └── PharmacyMapper.js     # Pharmacy claims
│
├── models/                   # Data models
│   └── schema.js
│
├── db/                       # Database utilities
│   ├── queries.js
│   └── queryLoader.js
│
├── migrations/               # Database migrations (22 files)
│   └── *.sql
│
├── scripts/                  # Utility scripts
│   ├── importMedicines.js
│   ├── seedMedicalKnowledge.js
│   └── ...
│
└── data/                     # Static data files
    └── medical_guidelines/
```

### 2.2 Controller Pattern

Controllers follow a consistent pattern:

```javascript
// Example: patientsController.js
class PatientsController {
  // GET /api/patients
  async getAll(req, res) { ... }
  
  // GET /api/patients/:id
  async getById(req, res) { ... }
  
  // POST /api/patients
  async create(req, res) { ... }
  
  // PUT /api/patients/:id
  async update(req, res) { ... }
  
  // DELETE /api/patients/:id
  async delete(req, res) { ... }
}
```

### 2.3 NPHIES FHIR Mappers

The Prior Authorization system uses a mapper hierarchy:

```
BaseMapper (abstract)
├── ProfessionalMapper
├── InstitutionalMapper
├── DentalMapper
├── VisionMapper
└── PharmacyMapper
```

**BaseMapper** provides:
- Common FHIR resource building (Patient, Organization, Coverage)
- Bundle construction with MessageHeader
- Response parsing
- Error handling

**Specialized Mappers** provide:
- Type-specific Claim resource building
- Specialty-specific extensions
- Item-level customizations

### 2.4 Service Layer

Key services and their responsibilities:

| Service | Responsibility |
|---------|---------------|
| `nphiesService.js` | HTTP communication with NPHIES API |
| `eligibilityService.js` | Eligibility request/response processing |
| `ollamaService.js` | Ollama LLM API wrapper |
| `ragService.js` | Vector search and knowledge retrieval |
| `medbotService.js` | Medical chatbot logic |
| `medicationSafetyService.js` | Drug interaction checking |
| `medicalValidationService.js` | AI-powered medical validation |

---

## 3. Frontend Architecture

### 3.1 Project Structure

```
frontend/
├── index.html                # HTML entry point
├── vite.config.js            # Vite configuration
├── tailwind.config.js        # Tailwind configuration
├── postcss.config.js         # PostCSS configuration
├── package.json              # Dependencies
│
├── public/                   # Static assets
│   ├── logo.png
│   └── logo.svg
│
└── src/
    ├── main.jsx              # React entry point
    ├── App.jsx               # Root component with routing
    ├── index.css             # Global styles
    │
    ├── pages/                # Page components (43 files)
    │   ├── Dashboard.jsx
    │   ├── Patients.jsx
    │   ├── Providers.jsx
    │   ├── Insurers.jsx
    │   ├── Eligibility.jsx
    │   ├── NphiesEligibility.jsx
    │   ├── PriorAuthorizations.jsx
    │   ├── PriorAuthorizationForm.jsx
    │   ├── PriorAuthorizationDetails.jsx
    │   ├── Claims.jsx
    │   ├── ClaimBatches.jsx
    │   ├── DentalApprovals.jsx
    │   ├── DentalApprovalsForm.jsx
    │   ├── DentalApprovalsDetails.jsx
    │   ├── EyeApprovals.jsx
    │   ├── EyeApprovalsForm.jsx
    │   ├── EyeApprovalsDetails.jsx
    │   ├── StandardApprovals.jsx
    │   ├── StandardApprovalsForm.jsx
    │   ├── StandardApprovalsDetails.jsx
    │   ├── GeneralRequests.jsx
    │   ├── GeneralRequestDetails.jsx
    │   ├── MedicineSearch.jsx
    │   ├── Payments.jsx
    │   ├── ResponseViewer.jsx
    │   └── pa-portal/        # Specialized PA pages
    │       ├── DentalPage.tsx
    │       ├── VisionPage.tsx
    │       ├── PharmacyPage.tsx
    │       └── ...
    │
    ├── components/           # Reusable components (64 files)
    │   ├── ui/               # Base UI components
    │   │   ├── button.jsx
    │   │   ├── input.jsx
    │   │   ├── card.jsx
    │   │   ├── table.jsx
    │   │   ├── dialog.jsx
    │   │   └── ...
    │   ├── prior-auth/       # Prior auth components
    │   │   ├── constants.js
    │   │   ├── helpers.js
    │   │   └── ...
    │   └── Layout.jsx        # Main layout wrapper
    │
    ├── services/             # API services (7 files)
    │   ├── api.js            # Base API client
    │   ├── patientService.js
    │   ├── providerService.js
    │   └── ...
    │
    ├── hooks/                # Custom React hooks
    │   └── useApi.js
    │
    ├── lib/                  # Utility libraries
    │   └── utils.js
    │
    └── utils/                # Helper functions
        └── formatters.js
```

### 3.2 Routing Structure

```javascript
// App.jsx routing
<Routes>
  <Route path="/" element={<Dashboard />} />
  
  {/* Core Entities */}
  <Route path="/patients" element={<Patients />} />
  <Route path="/providers" element={<Providers />} />
  <Route path="/insurers" element={<Insurers />} />
  
  {/* Eligibility */}
  <Route path="/eligibility" element={<Eligibility />} />
  <Route path="/nphies-eligibility" element={<NphiesEligibility />} />
  
  {/* Prior Authorization */}
  <Route path="/prior-authorizations" element={<PriorAuthorizations />} />
  <Route path="/prior-authorizations/new" element={<PriorAuthorizationForm />} />
  <Route path="/prior-authorizations/:id" element={<PriorAuthorizationDetails />} />
  <Route path="/prior-authorizations/:id/edit" element={<PriorAuthorizationForm />} />
  
  {/* Claims */}
  <Route path="/claims" element={<Claims />} />
  <Route path="/claim-batches" element={<ClaimBatches />} />
  
  {/* Specialty Approvals */}
  <Route path="/dental-approvals" element={<DentalApprovals />} />
  <Route path="/eye-approvals" element={<EyeApprovals />} />
  <Route path="/standard-approvals" element={<StandardApprovals />} />
  <Route path="/general-requests" element={<GeneralRequests />} />
  
  {/* Utilities */}
  <Route path="/medicines" element={<MedicineSearch />} />
  <Route path="/payments" element={<Payments />} />
  <Route path="/response-viewer" element={<ResponseViewer />} />
</Routes>
```

### 3.3 State Management

- **Form State:** React Hook Form with Zod validation
- **Server State:** Direct API calls with loading states
- **UI State:** React useState/useReducer

### 3.4 API Client

```javascript
// services/api.js
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export const api = {
  get: (endpoint) => fetch(`${API_BASE_URL}${endpoint}`).then(r => r.json()),
  post: (endpoint, data) => fetch(`${API_BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }).then(r => r.json()),
  // ... put, delete
};
```

---

## 4. Database Architecture

### 4.1 PostgreSQL Configuration

- **Version:** PostgreSQL 14+
- **Extensions:**
  - `uuid-ossp` - UUID generation
  - `pgvector` - Vector similarity search for AI

### 4.2 Connection Configuration

```javascript
// db.js
import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'nafes',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});
```

### 4.3 Table Summary

| Domain | Tables | Description |
|--------|--------|-------------|
| Core Entities | 5 | patients, providers, insurers, patient_coverage, policy_holders |
| Prior Authorization | 6 | prior_authorizations, items, diagnoses, supporting_info, attachments, responses |
| Eligibility | 2 | eligibility, eligibility_benefits |
| Claims | 2 | claims, claims_batch |
| Dental | 3 | dental_approvals, dental_procedures, dental_medications |
| Vision | 2 | eye_approvals, eye_procedures |
| Standard | 3 | standard_approvals_claims, management_items, medications |
| General | 1 | general_requests |
| Reference | 5 | nphies_codes, nphies_code_systems, medicines, medicine_brands, medicine_codes |
| AI/Knowledge | 3 | medical_knowledge, ai_validations, medical_exams |
| Other | 2 | authorizations, payments |
| **Total** | **34** | |

---

## 5. AI/ML Integration

### 5.1 Ollama Service

```javascript
// services/ollamaService.js
class OllamaService {
  constructor() {
    this.baseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
    this.model = process.env.OLLAMA_MODEL || 'cniongolo/biomistral';
    this.timeout = parseInt(process.env.OLLAMA_TIMEOUT) || 120000;
  }

  async generateCompletion(prompt, options = {}) {
    // Generate completion using Ollama API
  }

  async validateMedicalRequest(requestData) {
    // Validate medical requests using AI
  }
}
```

### 5.2 RAG Service

```javascript
// services/ragService.js
class RAGService {
  constructor() {
    // Initialize vector store connection
  }

  async searchKnowledge(query, limit = 5) {
    // Search medical knowledge base using vector similarity
  }

  async generateResponse(query, context) {
    // Generate response with retrieved context
  }
}
```

### 5.3 Vector Storage

Medical knowledge is stored with vector embeddings for semantic search:

```sql
CREATE TABLE medical_knowledge (
  id SERIAL PRIMARY KEY,
  content TEXT NOT NULL,
  embedding vector(384),  -- pgvector
  category VARCHAR(100),
  source VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Similarity search
SELECT content, 1 - (embedding <=> $1) as similarity
FROM medical_knowledge
ORDER BY embedding <=> $1
LIMIT 5;
```

---

## 6. NPHIES Integration

### 6.1 NPHIES Service

```javascript
// services/nphiesService.js
class NphiesService {
  constructor() {
    this.baseUrl = process.env.NPHIES_BASE_URL;
    this.providerId = process.env.NPHIES_PROVIDER_ID;
  }

  async submitPriorAuth(bundle) {
    // Submit prior authorization to NPHIES
  }

  async checkEligibility(bundle) {
    // Check eligibility via NPHIES
  }

  async submitClaim(bundle) {
    // Submit claim to NPHIES
  }
}
```

### 6.2 FHIR Bundle Structure

```json
{
  "resourceType": "Bundle",
  "id": "uuid",
  "type": "message",
  "timestamp": "2024-12-06T12:00:00+03:00",
  "entry": [
    { "resource": { "resourceType": "MessageHeader", ... } },
    { "resource": { "resourceType": "Claim", ... } },
    { "resource": { "resourceType": "Patient", ... } },
    { "resource": { "resourceType": "Coverage", ... } },
    { "resource": { "resourceType": "Organization", ... } }
  ]
}
```

### 6.3 Mapper Selection

```javascript
// services/priorAuthMapper/index.js
export function getMapper(authType) {
  switch (authType) {
    case 'professional': return new ProfessionalMapper();
    case 'institutional': return new InstitutionalMapper();
    case 'dental': return new DentalMapper();
    case 'vision': return new VisionMapper();
    case 'pharmacy': return new PharmacyMapper();
    default: return new ProfessionalMapper();
  }
}
```

---

## 7. API Reference

### 7.1 Core Entity Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/patients` | List all patients |
| GET | `/api/patients/:id` | Get patient by ID |
| POST | `/api/patients` | Create patient |
| PUT | `/api/patients/:id` | Update patient |
| DELETE | `/api/patients/:id` | Delete patient |
| GET | `/api/providers` | List all providers |
| GET | `/api/providers/:id` | Get provider by ID |
| POST | `/api/providers` | Create provider |
| PUT | `/api/providers/:id` | Update provider |
| DELETE | `/api/providers/:id` | Delete provider |
| GET | `/api/insurers` | List all insurers |
| GET | `/api/insurers/:id` | Get insurer by ID |
| POST | `/api/insurers` | Create insurer |
| PUT | `/api/insurers/:id` | Update insurer |
| DELETE | `/api/insurers/:id` | Delete insurer |

### 7.2 Eligibility Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/eligibility` | List eligibility records |
| GET | `/api/eligibility/:id` | Get eligibility by ID |
| POST | `/api/eligibility` | Create eligibility check |
| POST | `/api/eligibility/:id/send` | Submit to NPHIES |
| GET | `/api/eligibility/:id/benefits` | Get benefits |

### 7.3 Prior Authorization Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/prior-authorizations` | List all prior auths |
| GET | `/api/prior-authorizations/:id` | Get prior auth by ID |
| POST | `/api/prior-authorizations` | Create prior auth |
| PUT | `/api/prior-authorizations/:id` | Update prior auth |
| DELETE | `/api/prior-authorizations/:id` | Delete prior auth |
| POST | `/api/prior-authorizations/:id/send` | Submit to NPHIES |
| POST | `/api/prior-authorizations/:id/cancel` | Cancel prior auth |
| GET | `/api/prior-authorizations/:id/preview` | Preview FHIR bundle |

### 7.4 Claims Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/claims` | List all claims |
| GET | `/api/claims/:id` | Get claim by ID |
| POST | `/api/claims` | Create claim |
| PUT | `/api/claims/:id` | Update claim |
| DELETE | `/api/claims/:id` | Delete claim |
| GET | `/api/claim-batches` | List claim batches |
| POST | `/api/claim-batches` | Create batch |

### 7.5 Specialty Approval Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/dental-approvals` | List dental approvals |
| POST | `/api/dental-approvals` | Create dental approval |
| GET | `/api/eye-approvals` | List eye approvals |
| POST | `/api/eye-approvals` | Create eye approval |
| GET | `/api/standard-approvals` | List standard approvals |
| POST | `/api/standard-approvals` | Create standard approval |
| GET | `/api/general-requests` | List general requests |
| POST | `/api/general-requests` | Create general request |

### 7.6 Medicine & Safety Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/medicines` | Search medicines |
| GET | `/api/medicines/:id` | Get medicine by ID |
| POST | `/api/medication-safety/check` | Check drug interactions |

### 7.7 AI & Chat Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/chat` | Send chat message |
| GET | `/api/chat/history` | Get chat history |
| POST | `/api/ai-validation/validate` | Validate medical request |

### 7.8 Reference Data Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/nphies-codes` | List code systems |
| GET | `/api/nphies-codes/:system` | Get codes by system |
| GET | `/api/dashboard/stats` | Get dashboard statistics |

---

## 8. Security

### 8.1 Security Headers (Helmet)

```javascript
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));
```

### 8.2 CORS Configuration

```javascript
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));
```

### 8.3 Rate Limiting

```javascript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

app.use('/api/', limiter);
```

### 8.4 Input Validation

All API inputs are validated using Joi schemas:

```javascript
const patientSchema = Joi.object({
  name: Joi.string().required().max(255),
  identifier: Joi.string().required(),
  identifier_type: Joi.string().valid('national_id', 'iqama', 'passport'),
  gender: Joi.string().valid('male', 'female'),
  birth_date: Joi.date().iso(),
  // ...
});
```

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | December 2024 | NAFES Team | Initial document |

---

*This document provides detailed technical specifications for the NAFES Healthcare Management System. For database schema details, refer to the Database Schema Document.*


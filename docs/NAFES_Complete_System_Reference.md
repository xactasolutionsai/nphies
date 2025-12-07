# NAFES Healthcare Management System
## Complete Technical Reference Documentation

**Version:** 1.0.0  
**Last Updated:** December 2024  
**Document Classification:** Technical Reference

---

# Table of Contents

1. [System Overview](#1-system-overview)
2. [Technology Stack](#2-technology-stack)
3. [Backend Architecture](#3-backend-architecture)
4. [Frontend Architecture](#4-frontend-architecture)
5. [NPHIES Integration](#5-nphies-integration)
6. [AI/ML Services](#6-aiml-services)
7. [Module Reference](#7-module-reference)
8. [API Reference](#8-api-reference)
9. [Data Structures](#9-data-structures)
10. [Configuration](#10-configuration)

---

# 1. System Overview

## 1.1 Purpose

NAFES (نافس) is a comprehensive healthcare management system designed for the Saudi Arabian healthcare ecosystem. It provides:

- **NPHIES Integration**: Full compliance with Saudi Arabia's National Platform for Health Information Exchange Services
- **Prior Authorization Management**: Multi-type authorization workflows (Institutional, Professional, Pharmacy, Dental, Vision)
- **Eligibility Verification**: Real-time patient coverage verification
- **Claims Processing**: End-to-end claims management with batch processing
- **AI-Powered Validation**: Medical form validation using machine learning
- **Medication Safety Analysis**: Drug interaction checking and safety analysis

## 1.2 System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        NAFES SYSTEM                             │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────┐ │
│  │   React.js      │    │   Express.js    │    │ PostgreSQL  │ │
│  │   Frontend      │◄──►│   Backend       │◄──►│  Database   │ │
│  │   (Vite)        │    │   (Node.js)     │    │  (pgvector) │ │
│  └─────────────────┘    └────────┬────────┘    └─────────────┘ │
│                                  │                              │
│                    ┌─────────────┼─────────────┐                │
│                    │             │             │                │
│              ┌─────▼─────┐ ┌─────▼─────┐ ┌─────▼─────┐         │
│              │  NPHIES   │ │  Ollama   │ │   RAG     │         │
│              │   API     │ │  AI/LLM   │ │  Service  │         │
│              └───────────┘ └───────────┘ └───────────┘         │
└─────────────────────────────────────────────────────────────────┘
```

## 1.3 Key Features

| Feature | Description |
|---------|-------------|
| Multi-tenant Support | Supports multiple healthcare providers and insurers |
| FHIR R4 Compliance | Full HL7 FHIR R4 standard implementation |
| Real-time Processing | Synchronous NPHIES transaction processing |
| AI Validation | Medical form validation with confidence scoring |
| RAG Knowledge Base | Retrieval-augmented generation for medical guidelines |
| Interactive UI | Modern React-based user interface with multi-step wizards |

---

# 2. Technology Stack

## 2.1 Backend Technologies

### Core Framework
| Technology | Version | Purpose |
|------------|---------|---------|
| Node.js | 18.x+ | Runtime environment |
| Express.js | 4.x | Web application framework |
| PostgreSQL | 14+ | Primary database |
| pgvector | 0.5+ | Vector similarity search extension |

### Dependencies (package.json)
```json
{
  "dependencies": {
    "express": "^4.18.2",
    "pg": "^8.11.3",
    "cors": "^2.8.5",
    "helmet": "^7.1.0",
    "express-rate-limit": "^7.1.5",
    "dotenv": "^16.3.1",
    "axios": "^1.6.2",
    "uuid": "^9.0.0",
    "ollama": "^0.5.0",
    "langchain": "^0.1.0"
  }
}
```

### Backend Directory Structure
```
backend/
├── server.js                 # Application entry point
├── db.js                     # Database connection pool
├── controllers/              # Request handlers
│   ├── baseController.js
│   ├── priorAuthorizationsController.js
│   ├── eligibilityController.js
│   ├── dentalApprovalsController.js
│   ├── eyeApprovalsController.js
│   ├── standardApprovalsController.js
│   ├── aiValidationController.js
│   ├── chatController.js
│   ├── medicinesController.js
│   ├── medicationSafetyController.js
│   └── ... (21 controllers total)
├── routes/                   # API route definitions
│   ├── priorAuthorizations.js
│   ├── eligibility.js
│   ├── dentalApprovals.js
│   ├── eyeApprovals.js
│   ├── aiValidation.js
│   ├── chat.js
│   ├── medicationSafety.js
│   └── ... (21 routes total)
├── services/                 # Business logic services
│   ├── nphiesService.js
│   ├── nphiesMapper.js
│   ├── nphiesDataService.js
│   ├── ollamaService.js
│   ├── chatService.js
│   ├── ragService.js
│   ├── medicalValidationService.js
│   ├── medicationSafetyService.js
│   ├── medbotService.js
│   └── priorAuthMapper/      # NPHIES FHIR Mappers
│       ├── BaseMapper.js
│       ├── InstitutionalMapper.js
│       ├── ProfessionalMapper.js
│       ├── PharmacyMapper.js
│       ├── DentalMapper.js
│       ├── VisionMapper.js
│       └── index.js
├── models/                   # Data models and schemas
├── db/                       # Database utilities
├── migrations/               # SQL migration files
└── data/                     # Static data files
```

## 2.2 Frontend Technologies

### Core Framework
| Technology | Version | Purpose |
|------------|---------|---------|
| React.js | 18.x | UI component library |
| Vite | 5.x | Build tool and dev server |
| TailwindCSS | 3.x | Utility-first CSS framework |
| React Router | 6.x | Client-side routing |

### Key Libraries
```json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.21.0",
    "react-select": "^5.8.0",
    "react-datepicker": "^4.24.0",
    "date-fns": "^2.30.0",
    "lucide-react": "^0.294.0",
    "@radix-ui/react-*": "Various UI primitives"
  }
}
```

### Frontend Directory Structure
```
frontend/
├── src/
│   ├── pages/                    # Page components
│   │   ├── Dashboard.jsx
│   │   ├── PriorAuthorizationForm.jsx
│   │   ├── PriorAuthorizationDetails.jsx
│   │   ├── PriorAuthorizations.jsx
│   │   ├── NphiesEligibility.jsx
│   │   ├── Eligibility.jsx
│   │   ├── DentalApprovalsForm.jsx
│   │   ├── DentalApprovalsDetails.jsx
│   │   ├── DentalApprovals.jsx
│   │   ├── EyeApprovalsForm.jsx
│   │   ├── EyeApprovalsDetails.jsx
│   │   ├── EyeApprovals.jsx
│   │   ├── StandardApprovalsForm.jsx
│   │   ├── GeneralRequests.jsx
│   │   ├── GeneralRequestDetails.jsx
│   │   ├── MedicineSearch.jsx
│   │   ├── Patients.jsx
│   │   ├── Providers.jsx
│   │   ├── Insurers.jsx
│   │   ├── Claims.jsx
│   │   ├── ClaimBatches.jsx
│   │   ├── Payments.jsx
│   │   └── ResponseViewer.jsx
│   ├── components/               # Reusable components
│   │   ├── Layout.jsx
│   │   ├── DataTable.jsx
│   │   ├── DentalChart.jsx
│   │   ├── AIValidationModal.jsx
│   │   ├── InlineValidationWarning.jsx
│   │   ├── ui/                   # Base UI components
│   │   │   ├── button.jsx
│   │   │   ├── card.jsx
│   │   │   ├── input.jsx
│   │   │   ├── label.jsx
│   │   │   ├── table.jsx
│   │   │   └── badge.jsx
│   │   ├── prior-auth/           # Prior auth components
│   │   │   ├── constants.js
│   │   │   ├── helpers.js
│   │   │   └── TabButton.jsx
│   │   ├── general-request/      # General request wizard
│   │   │   ├── GeneralRequestWizard.jsx
│   │   │   ├── WizardProgress.jsx
│   │   │   ├── useGeneralRequestForm.js
│   │   │   ├── config/
│   │   │   │   └── wizardConfig.js
│   │   │   ├── steps/
│   │   │   │   ├── PatientInfoStep.jsx
│   │   │   │   ├── CoverageStep.jsx
│   │   │   │   ├── ProviderStep.jsx
│   │   │   │   ├── ServiceRequestStep.jsx
│   │   │   │   ├── MedicationsStep.jsx
│   │   │   │   └── ReviewStep.jsx
│   │   │   └── shared/
│   │   │       ├── MedicationInputWithSearch.jsx
│   │   │       ├── MedicationSafetyPanel.jsx
│   │   │       └── MedicationsTable.jsx
│   │   └── chat/                 # AI Chat components
│   │       ├── ChatAssistant.jsx
│   │       ├── ChatButton.jsx
│   │       ├── ChatWindow.jsx
│   │       ├── MessageBubble.jsx
│   │       └── ModeSelector.jsx
│   ├── services/                 # API services
│   │   ├── api.js
│   │   ├── priorAuthApi.js
│   │   ├── aiValidationService.js
│   │   ├── chatService.js
│   │   └── responseViewerApi.js
│   └── utils/                    # Utility functions
├── public/                       # Static assets
├── index.html
├── vite.config.js
├── tailwind.config.js
└── package.json
```

## 2.3 AI/ML Technologies

| Technology | Model | Purpose |
|------------|-------|---------|
| Ollama | Local LLM Server | AI inference engine |
| BioMistral | cniongolo/biomistral | Medical knowledge model |
| Medbot | Goosedev/medbot | Drug/medication specialist |
| pgvector | PostgreSQL Extension | Vector similarity search |
| Langchain | 0.1.x | LLM orchestration framework |

---

# 3. Backend Architecture

## 3.1 Server Configuration

### Express Server Setup (server.js)

```javascript
// Core middleware stack
app.use(helmet());                    // Security headers
app.use(cors(corsOptions));           // CORS configuration
app.use(limiter);                     // Rate limiting
app.use(express.json({ limit: '10mb' }));

// Rate limiting configuration
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,          // 15 minutes
  max: 10000                          // requests per window
});
```

### Environment Variables
```bash
# Server Configuration
PORT=8001
NODE_ENV=development

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/nafes_db

# NPHIES
NPHIES_BASE_URL=http://176.105.150.83
NPHIES_TIMEOUT=60000
NPHIES_RETRY_ATTEMPTS=3

# AI/Ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=cniongolo/biomistral
OLLAMA_TIMEOUT=120000
AI_VALIDATION_ENABLED=true

# CORS
CORS_ORIGIN=http://localhost:5173,http://localhost:5174

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=10000
```

## 3.2 Controller Architecture

### Base Controller Pattern
All controllers extend a base controller that provides common CRUD operations:

```javascript
// baseController.js
export class BaseController {
  constructor(tableName, validationSchema) {
    this.tableName = tableName;
    this.validationSchema = validationSchema;
  }

  async getAll(req, res) { /* Paginated list with search/filter */ }
  async getById(req, res) { /* Single record retrieval */ }
  async create(req, res) { /* Record creation with validation */ }
  async update(req, res) { /* Record update with validation */ }
  async delete(req, res) { /* Soft/hard delete */ }
}
```

### Controller Inventory

| Controller | File | Primary Functions |
|------------|------|-------------------|
| PriorAuthorizationsController | priorAuthorizationsController.js | NPHIES prior auth requests, response handling |
| EligibilityController | eligibilityController.js | NPHIES eligibility checks |
| DentalApprovalsController | dentalApprovalsController.js | Dental form CRUD, NPHIES submission |
| EyeApprovalsController | eyeApprovalsController.js | Eye/optical form CRUD, AI validation |
| StandardApprovalsController | standardApprovalsController.js | Standard approval forms |
| AIValidationController | aiValidationController.js | AI form validation endpoints |
| ChatController | chatController.js | AI chat streaming |
| MedicinesController | medicinesController.js | Drug database search |
| MedicationSafetyController | medicationSafetyController.js | Drug interaction analysis |
| PatientsController | patientsController.js | Patient management |
| ProvidersController | providersController.js | Healthcare provider management |
| InsurersController | insurersController.js | Insurance company management |
| ClaimsController | claimsController.js | Claims management |
| ClaimBatchesController | claimBatchesController.js | Batch claim processing |
| PaymentsController | paymentsController.js | Payment tracking |

## 3.3 Service Layer Architecture

### NPHIES Service (nphiesService.js)

Handles all communication with the NPHIES OBA test environment:

```javascript
class NphiesService {
  constructor() {
    this.baseURL = 'http://176.105.150.83';
    this.timeout = 60000;
    this.retryAttempts = 3;
  }

  // Eligibility check
  async checkEligibility(requestBundle) {
    return await this.sendRequest(requestBundle, 'eligibility');
  }

  // Prior authorization submission
  async submitPriorAuth(requestBundle) {
    return await this.sendRequest(requestBundle, 'priorauth');
  }

  // Generic FHIR $process-message
  async sendRequest(bundle, type) {
    const response = await axios.post(
      `${this.baseURL}/$process-message`,
      bundle,
      {
        headers: {
          'Content-Type': 'application/fhir+json',
          'Accept': 'application/fhir+json'
        },
        timeout: this.timeout
      }
    );
    return response;
  }
}
```

### Ollama Service (ollamaService.js)

Provides AI inference capabilities:

```javascript
class OllamaService {
  constructor() {
    this.baseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
    this.model = process.env.OLLAMA_MODEL || 'cniongolo/biomistral';
    this.timeout = 120000;
    this.maxRetries = 3;
    
    this.client = new Ollama({ host: this.baseUrl });
  }

  // Text generation
  async generateCompletion(prompt, options = {}) {
    const response = await this.client.generate({
      model: this.model,
      prompt: prompt,
      stream: false,
      format: options.format,
      options: {
        temperature: options.temperature || 0.7,
        top_p: options.top_p || 0.9,
        num_predict: options.num_predict || 2048
      }
    });
    return response;
  }

  // Embedding generation
  async generateEmbedding(text) {
    const response = await this.client.embeddings({
      model: this.model,
      prompt: text
    });
    return response.embedding;
  }

  // Eye form validation
  async validateEyeForm(formData, relevantGuidelines = []) {
    const prompt = this.buildValidationPrompt(formData, relevantGuidelines);
    return await this.generateCompletion(prompt, { format: 'json' });
  }
}
```

### RAG Service (ragService.js)

Implements Retrieval-Augmented Generation for medical knowledge:

```javascript
class RAGService {
  constructor() {
    this.embeddingDimension = 4096;  // BioMistral dimension
    this.similarityThreshold = 0.7;
    this.maxRetrievalResults = 5;
  }

  // Store medical knowledge with embedding
  async storeKnowledge(content, metadata, category) {
    const embedding = await this.generateEmbedding(content);
    const vectorString = `[${embedding.join(',')}]`;
    
    await query(`
      INSERT INTO medical_knowledge (content, embedding, metadata, source, category)
      VALUES ($1, $2::vector, $3, $4, $5)
    `, [content, vectorString, JSON.stringify(metadata), metadata.source, category]);
  }

  // Retrieve relevant guidelines using vector similarity
  async retrieveRelevantGuidelines(formData) {
    const queryText = this.buildQueryFromForm(formData);
    const queryEmbedding = await this.generateEmbedding(queryText);
    
    const results = await query(`
      SELECT content, metadata, 
             1 - (embedding <=> $1::vector) as similarity
      FROM medical_knowledge
      WHERE 1 - (embedding <=> $1::vector) > $2
      ORDER BY similarity DESC
      LIMIT $3
    `, [`[${queryEmbedding.join(',')}]`, this.similarityThreshold, this.maxRetrievalResults]);
    
    return results.rows;
  }
}
```

### Chat Service (chatService.js)

Dual-mode AI chat with streaming support:

```javascript
class ChatService {
  constructor() {
    this.drugModel = 'Goosedev/medbot';      // Drug specialist
    this.generalModel = 'cniongolo/biomistral'; // General medical
  }

  // Stream chat response
  async streamChat(message, mode, history, onChunk, onComplete, onError) {
    const model = mode === 'drug' ? this.drugModel : this.generalModel;
    const systemPrompt = this.getSystemPrompt(mode);
    
    const stream = await this.client.generate({
      model: model,
      prompt: this.buildPromptWithContext(message, history, systemPrompt),
      stream: true
    });

    for await (const chunk of stream) {
      onChunk(chunk.response);
    }
    onComplete();
  }

  getSystemPrompt(mode) {
    if (mode === 'drug') {
      return `You are a pharmaceutical AI assistant. Provide accurate 
              information about medications, dosages, interactions...`;
    }
    return `You are a medical AI assistant. Provide clear information 
            about medical conditions, symptoms...`;
  }
}
```

### Medication Safety Service (medicationSafetyService.js)

Drug interaction and safety analysis:

```javascript
class MedicationSafetyService {
  // Check drug-drug interactions
  async checkDrugInteractions(medications) {
    const prompt = `Analyze these medications for interactions:
      ${medications.map(m => m.medicationName).join(', ')}
      
      Return JSON: {
        "hasInteractions": boolean,
        "interactions": [{
          "severity": "severe|moderate|mild",
          "affectedDrugs": ["Drug A", "Drug B"],
          "interaction": "description",
          "recommendation": "action"
        }]
      }`;

    const result = await medbotService.generateCompletion(prompt);
    return this.parseInteractionsResponse(result.response);
  }

  // Comprehensive safety analysis
  async analyzeMedicationSafety(medications, patientContext) {
    // Checks: interactions, contraindications, dosing, duplicates
    const analysis = await medbotService.generateCompletion(
      this.buildSafetyAnalysisPrompt(medications, patientContext)
    );
    return this.parseSafetyAnalysisResponse(analysis.response);
  }

  // Detect duplicate active ingredients
  detectDuplicateIngredients(medications) {
    const ingredients = new Map();
    medications.forEach(med => {
      const key = (med.activeIngredient || med.medicationName).toLowerCase();
      if (ingredients.has(key)) {
        // Duplicate found
      }
      ingredients.set(key, med);
    });
    return duplicates;
  }
}
```

---

# 4. Frontend Architecture

## 4.1 Application Structure

### Main Application Entry
```javascript
// App.jsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="patients" element={<Patients />} />
          <Route path="providers" element={<Providers />} />
          <Route path="insurers" element={<Insurers />} />
          <Route path="eligibility" element={<Eligibility />} />
          <Route path="nphies-eligibility" element={<NphiesEligibility />} />
          <Route path="prior-authorizations" element={<PriorAuthorizations />} />
          <Route path="prior-authorizations/new" element={<PriorAuthorizationForm />} />
          <Route path="prior-authorizations/:id" element={<PriorAuthorizationDetails />} />
          <Route path="prior-authorizations/:id/edit" element={<PriorAuthorizationForm />} />
          <Route path="dental-approvals" element={<DentalApprovals />} />
          <Route path="dental-approvals/new" element={<DentalApprovalsForm />} />
          <Route path="dental-approvals/:id" element={<DentalApprovalsDetails />} />
          <Route path="eye-approvals" element={<EyeApprovals />} />
          <Route path="eye-approvals/new" element={<EyeApprovalsForm />} />
          <Route path="eye-approvals/:id" element={<EyeApprovalsDetails />} />
          <Route path="general-requests" element={<GeneralRequests />} />
          <Route path="general-requests/:id" element={<GeneralRequestDetails />} />
          <Route path="claims" element={<Claims />} />
          <Route path="claim-batches" element={<ClaimBatches />} />
          <Route path="payments" element={<Payments />} />
          <Route path="medicine-search" element={<MedicineSearch />} />
          <Route path="response-viewer" element={<ResponseViewer />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
```

## 4.2 Page Components

### Prior Authorization Form (PriorAuthorizationForm.jsx)

Multi-tab form for NPHIES prior authorization requests:

**Features:**
- Dynamic form based on authorization type (institutional, professional, pharmacy, dental, vision)
- Real-time NPHIES FHIR bundle preview
- Claim subtype selection with validation rules
- Supporting information management
- Diagnosis and procedure entry
- Attachment handling

**Key State:**
```javascript
const [formData, setFormData] = useState({
  auth_type: 'professional',
  sub_type: 'op',
  patient_id: '',
  provider_id: '',
  insurer_id: '',
  coverage_id: '',
  encounter_class: '',
  encounter_period_start: '',
  encounter_period_end: '',
  items: [getInitialItemData()],
  diagnoses: [{ code: '', type: 'principal', on_admission: 'y' }],
  supporting_info: [],
  vital_signs: {},
  clinical_info: {},
  admission_info: {},
  vision_prescription: {},
  attachments: []
});
```

**Authorization Type Rules:**
```javascript
const ALLOWED_ENCOUNTER_CLASSES = {
  institutional: ['inpatient', 'daycase', 'emergency', 'ambulatory', 'home', 'telemedicine'],
  professional: ['outpatient', 'ambulatory', 'emergency', 'home', 'telemedicine'],
  dental: ['ambulatory'],
  vision: [],      // No encounter for vision
  pharmacy: []     // No encounter for pharmacy
};

const ALLOWED_CLAIM_SUBTYPES = {
  institutional: ['ip', 'op'],
  professional: ['op', 'emr'],
  pharmacy: ['op'],
  dental: ['op'],
  vision: ['op']
};
```

### NPHIES Eligibility Form (NphiesEligibility.jsx)

Real-time eligibility verification:

**Features:**
- Patient and coverage selection
- Multiple purpose selection (benefits, validation, discovery, auth-requirements)
- Service date specification
- Newborn eligibility extension support
- Transfer of care extension support
- FHIR bundle preview
- Response display with benefit details

**Key Functions:**
```javascript
// Submit eligibility check
const handleSubmit = async (e) => {
  e.preventDefault();
  setLoading(true);
  
  const response = await api.checkNphiesEligibility({
    patientId,
    providerId,
    insurerId,
    coverageId,
    purpose: selectedPurposes,
    servicedDate,
    isNewborn,
    isTransfer
  });
  
  setEligibilityResponse(response);
};
```

### Dental Approvals Form (DentalApprovalsForm.jsx)

Comprehensive dental treatment approval form:

**Features:**
- 4-tab wizard interface (Reception, Insured Info, Dentist Section, Procedures)
- Interactive dental chart with tooth selection
- FDI tooth numbering system
- Procedure and medication entry
- Treatment type checkboxes
- Form validation with error indicators

**Dental Chart Integration:**
```javascript
// Handle tooth selection from interactive chart
const handleToothClick = (selectedTeethArray) => {
  const newProcedures = [...procedures];
  
  selectedTeethArray.forEach(tooth => {
    const emptyRowIndex = newProcedures.findIndex(p => !p.tooth_number);
    if (emptyRowIndex !== -1) {
      newProcedures[emptyRowIndex].tooth_number = tooth;
    } else {
      newProcedures.push({ 
        code: '', 
        service_description: '', 
        tooth_number: tooth, 
        cost: '' 
      });
    }
  });
  
  setProcedures(newProcedures);
};
```

### Eye Approvals Form (EyeApprovalsForm.jsx)

Optical/vision approval form with AI validation:

**Features:**
- 4-tab wizard (Reception, Insured Info, Optician, Procedures)
- Right/Left eye specification tables (Sphere, Cylinder, Axis, Prism, V/N)
- Lens type and specification checkboxes
- Contact lens options
- Frame requirements
- AI validation integration
- Inline validation warnings

**Eye Specifications Structure:**
```javascript
const eyeSpecs = {
  right_eye_specs: {
    distance: { sphere: '', cylinder: '', axis: '', prism: '', vn: '' },
    near: { sphere: '', cylinder: '', axis: '', prism: '', vn: '' },
    bifocal_add: '',
    vertex_add: ''
  },
  left_eye_specs: {
    distance: { sphere: '', cylinder: '', axis: '', prism: '', vn: '', pd: '' },
    near: { sphere: '', cylinder: '', axis: '', prism: '', vn: '' },
    bifocal_add: ''
  }
};
```

**AI Validation Integration:**
```javascript
const handleAIValidation = async () => {
  setValidating(true);
  
  const response = await aiValidationService.validateForm(formData, {
    saveToDatabase: isEditMode,
    formId: id
  });

  if (response.success && response.data) {
    setValidationResult(response.data);
    setShowValidationModal(true);
    
    // Map warnings to fields
    const warningsByField = {};
    response.data.warnings?.forEach(warning => {
      if (warning.field) {
        warningsByField[warning.field] = warning;
      }
    });
    setAiWarnings(warningsByField);
  }
  
  setValidating(false);
};
```

## 4.3 Reusable Components

### General Request Wizard (GeneralRequestWizard.jsx)

Multi-step form wizard for general service requests:

**Steps:**
1. Patient Information
2. Coverage Selection
3. Provider Details
4. Service Request
5. Medications (with safety analysis)
6. Review & Submit

**Features:**
- Lazy-loaded step components
- Draft auto-save
- Step validation
- Progress indicator
- Medication search with database integration
- Drug interaction checking

### AI Validation Modal (AIValidationModal.jsx)

Displays AI validation results:

```javascript
<AIValidationModal
  isOpen={showValidationModal}
  onClose={() => setShowValidationModal(false)}
  validationResult={validationResult}
  onProceed={handleValidationProceed}
  onFixIssues={handleValidationFixIssues}
/>
```

**Validation Result Structure:**
```javascript
{
  isValid: boolean,
  confidenceScore: number,  // 0-100
  warnings: [{
    field: string,
    message: string,
    severity: 'high' | 'medium' | 'low'
  }],
  recommendations: string[],
  missingAnalyses: string[],
  metadata: {
    validationDuration: number,
    guidelinesUsed: number,
    timestamp: string
  }
}
```

### Chat Assistant (ChatAssistant.jsx)

AI-powered medical chat interface:

**Features:**
- Dual mode: Drug specialist (Medbot) / General medical (BioMistral)
- Streaming responses
- Conversation history
- Mode switching
- Collapsible interface

### Interactive Dental Chart (DentalChart.jsx)

SVG-based dental chart component:

**Features:**
- FDI tooth numbering (11-48 permanent, 51-85 deciduous)
- Multi-tooth selection
- Visual tooth highlighting
- Quadrant organization
- Click handlers for procedure linking

## 4.4 API Service Layer

### Main API Service (api.js)

```javascript
class ApiService {
  constructor() {
    this.baseURL = 'http://localhost:8001/api';
    this.cache = new Map();
    this.cacheDuration = 30000;  // 30 seconds
  }

  async request(endpoint, options = {}) {
    // Check cache
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheDuration) {
      return cached.data;
    }

    // Make request with retry on rate limit
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      headers: { 'Content-Type': 'application/json' },
      ...options
    });

    // Cache and return
    const data = await response.json();
    this.cache.set(cacheKey, { data, timestamp: Date.now() });
    return data;
  }

  // Entity methods
  getPatients(params) { return this.request('/patients', { params }); }
  getProviders(params) { return this.request('/providers', { params }); }
  getInsurers(params) { return this.request('/insurers', { params }); }
  
  // Prior Authorization
  getPriorAuthorizations(params) { return this.request('/prior-authorizations', { params }); }
  createPriorAuthorization(data) { return this.request('/prior-authorizations', { method: 'POST', body: data }); }
  submitPriorAuthToNphies(id) { return this.request(`/prior-authorizations/${id}/submit`, { method: 'POST' }); }
  
  // Eligibility
  checkNphiesEligibility(data) { return this.request('/eligibility/check-nphies', { method: 'POST', body: data }); }
  
  // Dental Approvals
  getDentalApprovals(params) { return this.request('/dental-approvals', { params }); }
  createDentalApproval(data) { return this.request('/dental-approvals', { method: 'POST', body: data }); }
  
  // Eye Approvals
  getEyeApprovals(params) { return this.request('/eye-approvals', { params }); }
  createEyeApproval(data) { return this.request('/eye-approvals', { method: 'POST', body: data }); }
  
  // AI Validation
  validateEyeForm(data) { return this.request('/ai-validation/eye-form', { method: 'POST', body: data }); }
  
  // Medication Safety
  checkDrugInteractions(medications) { return this.request('/medication-safety/interactions', { method: 'POST', body: medications }); }
  analyzeMedicationSafety(data) { return this.request('/medication-safety/analyze', { method: 'POST', body: data }); }
  
  // Chat
  sendChatMessage(message, mode, history) { return this.request('/chat/message', { method: 'POST', body: { message, mode, history } }); }
}
```

---

# 5. NPHIES Integration

## 5.1 Overview

NPHIES (National Platform for Health Information Exchange Services) is Saudi Arabia's national health information exchange system. NAFES implements full FHIR R4 compliance for:

- **Prior Authorization**: Pre-approval for medical services
- **Eligibility Verification**: Real-time coverage verification
- **Claims Submission**: Healthcare claim processing

## 5.2 FHIR Resources

### Core Resources Used

| Resource | Profile | Purpose |
|----------|---------|---------|
| Bundle | nphies-fs/bundle | Message container |
| MessageHeader | nphies-fs/message-header | Message routing |
| Claim | Various priorauth profiles | Authorization request |
| ClaimResponse | nphies-fs/claim-response | Authorization response |
| CoverageEligibilityRequest | nphies-fs/coverage-eligibility-request | Eligibility request |
| CoverageEligibilityResponse | nphies-fs/coverage-eligibility-response | Eligibility response |
| Patient | nphies-fs/patient | Patient demographics |
| Coverage | nphies-fs/coverage | Insurance coverage |
| Organization | nphies-fs/organization | Provider/Insurer |
| Practitioner | nphies-fs/practitioner | Healthcare provider |
| Encounter | Various encounter profiles | Visit/admission details |
| VisionPrescription | nphies-fs/vision-prescription | Vision specifications |

## 5.3 Prior Authorization Mappers

### Base Mapper (BaseMapper.js)

Provides shared functionality for all authorization types:

```javascript
class BaseMapper {
  // Profile URLs
  getAuthorizationProfileUrl(authType) {
    const profiles = {
      'institutional': 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/institutional-priorauth|1.0.0',
      'professional': 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/professional-priorauth|1.0.0',
      'pharmacy': 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/pharmacy-priorauth|1.0.0',
      'dental': 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/oral-priorauth|1.0.0',
      'vision': 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/vision-priorauth|1.0.0'
    };
    return profiles[authType];
  }

  // Encounter class codes
  getEncounterClassCode(encounterClass) {
    const codes = {
      'ambulatory': 'AMB',
      'outpatient': 'AMB',
      'emergency': 'EMER',
      'home': 'HH',
      'inpatient': 'IMP',
      'daycase': 'SS',
      'telemedicine': 'VR'
    };
    return codes[encounterClass];
  }

  // Build common resources
  buildPatientResourceWithId(patient, id) { /* ... */ }
  buildProviderOrganizationWithId(provider, id) { /* ... */ }
  buildInsurerOrganizationWithId(insurer, id) { /* ... */ }
  buildCoverageResourceWithId(coverage, patient, insurer, policyHolder, ids) { /* ... */ }
  buildPractitionerResourceWithId(practitioner, id) { /* ... */ }
  buildMessageHeader(provider, insurer, claimFullUrl) { /* ... */ }
  
  // Response parsing
  parsePriorAuthResponse(responseBundle) {
    // Extract ClaimResponse
    const claimResponse = responseBundle.entry?.find(
      e => e.resource?.resourceType === 'ClaimResponse'
    )?.resource;

    return {
      success: claimResponse?.outcome !== 'error',
      outcome: claimResponse?.outcome,
      adjudicationOutcome: /* extension extraction */,
      disposition: claimResponse?.disposition,
      preAuthRef: claimResponse?.preAuthRef,
      preAuthPeriod: claimResponse?.preAuthPeriod,
      itemResults: /* item-level adjudication */,
      totals: /* total amounts */,
      errors: /* error extraction */
    };
  }
}
```

### Institutional Mapper (InstitutionalMapper.js)

For inpatient/daycase admissions:

**Required Elements:**
- Encounter with hospitalization block
- Chief complaint (BV-00770)
- Estimated length of stay (BV-00802)
- Diagnosis with onAdmission (BV-00027)
- Admit source and admission specialty

**Bundle Structure:**
```
Bundle
├── MessageHeader
├── Claim (institutional-priorauth)
├── Encounter (IMP or SS profile)
├── Coverage
├── Practitioner
├── Organization (Provider)
├── Organization (Insurer)
├── Patient
└── Binary (attachments)
```

### Professional Mapper (ProfessionalMapper.js)

For outpatient professional services:

**Required Elements:**
- Encounter reference
- CareTeam with practitioner
- Service items with productOrService

**Bundle Structure:**
```
Bundle
├── MessageHeader
├── Claim (professional-priorauth)
├── Encounter (AMB, EMER, HH, VR)
├── Coverage
├── Practitioner
├── Organization (Provider)
├── Organization (Insurer)
├── Patient
└── Binary (attachments)
```

### Pharmacy Mapper (PharmacyMapper.js)

For medication prior authorizations:

**Special Requirements:**
- NO Encounter resource
- NO Practitioner/careTeam
- Medication codes from NPHIES medication-codes system
- Item extensions: extension-package, extension-patient-share, extension-prescribed-Medication, extension-pharmacist-Selection-Reason, extension-pharmacist-substitute, extension-maternity
- days-supply supportingInfo (BV-00376)

**Bundle Structure:**
```
Bundle
├── MessageHeader
├── Claim (pharmacy-priorauth)
├── Coverage
├── Organization (Provider)
├── Organization (Insurer)
├── Patient
└── Binary (attachments)
```

**Pharmacy Item Extensions:**
```javascript
buildPharmacyClaimItem(item, sequence, bundleResourceIds) {
  const itemExtensions = [];

  // 1. extension-package (required)
  itemExtensions.push({
    url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-package',
    valueBoolean: item.is_package || false
  });

  // 2. extension-patient-share (required)
  itemExtensions.push({
    url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-patient-share',
    valueMoney: {
      value: parseFloat(item.patient_share) || 0,
      currency: 'SAR'
    }
  });

  // 3. extension-prescribed-Medication (required)
  itemExtensions.push({
    url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-prescribed-Medication',
    valueCodeableConcept: {
      coding: [{
        system: 'http://nphies.sa/terminology/CodeSystem/medication-codes',
        code: item.prescribed_medication_code || item.medication_code
      }]
    }
  });

  // 4. extension-pharmacist-Selection-Reason
  if (item.pharmacist_selection_reason) {
    itemExtensions.push({
      url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-pharmacist-Selection-Reason',
      valueCodeableConcept: {
        coding: [{
          system: 'http://nphies.sa/terminology/CodeSystem/pharmacist-selection-reason',
          code: item.pharmacist_selection_reason
        }]
      }
    });
  }

  // 5. extension-pharmacist-substitute
  if (item.pharmacist_substitute) {
    itemExtensions.push({
      url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-pharmacist-substitute',
      valueCodeableConcept: {
        coding: [{
          system: 'http://nphies.sa/terminology/CodeSystem/pharmacist-substitute',
          code: item.pharmacist_substitute
        }]
      }
    });
  }

  // 6. extension-maternity
  itemExtensions.push({
    url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-maternity',
    valueBoolean: item.is_maternity || false
  });

  return {
    extension: itemExtensions,
    sequence: sequence,
    productOrService: {
      coding: [{
        system: 'http://nphies.sa/terminology/CodeSystem/medication-codes',
        code: item.medication_code
      }]
    },
    quantity: {
      value: parseInt(item.quantity) || 1
    },
    unitPrice: {
      value: parseFloat(item.unit_price) || 0,
      currency: 'SAR'
    },
    informationSequence: [1]  // Links to days-supply supportingInfo
  };
}
```

### Dental Mapper (DentalMapper.js)

For oral/dental services:

**Special Requirements:**
- Must use 'op' subType (BV-00366)
- Must use 'ambulatory' encounter class (BV-00743)
- serviceEventType extension required (BV-00736)
- FDI tooth numbering (fdi-oral-region)
- Tooth surfaces (fdi-tooth-surface)
- ProductOrService uses oral-health-op CodeSystem
- NO hospitalization block

**Bundle Structure:**
```
Bundle
├── MessageHeader
├── Claim (oral-priorauth)
├── Encounter (AMB with serviceEventType)
├── Coverage
├── Practitioner
├── Organization (Provider)
├── Organization (Insurer)
├── Patient
└── Binary (attachments)
```

### Vision Mapper (VisionMapper.js)

For vision/optical services:

**Special Requirements:**
- NO Encounter resource (BV-00354)
- NO bodySite on items (BV-00374)
- VisionPrescription resource required
- Lens specifications

**Bundle Structure:**
```
Bundle
├── MessageHeader
├── Claim (vision-priorauth)
├── VisionPrescription
├── Coverage
├── Practitioner
├── Organization (Provider)
├── Organization (Insurer)
├── Patient
└── Binary (attachments)
```

## 5.4 NPHIES Code Systems

### Claim Types
```javascript
{
  'institutional': 'institutional',
  'professional': 'professional',
  'pharmacy': 'pharmacy',
  'dental': 'oral',
  'vision': 'vision'
}
```

### Claim SubTypes
```javascript
{
  'ip': 'Inpatient',
  'op': 'Outpatient',
  'emr': 'Emergency'
}
```

### Encounter Classes (v3-ActCode)
```javascript
{
  'AMB': 'ambulatory',
  'EMER': 'emergency',
  'HH': 'home health',
  'IMP': 'inpatient encounter',
  'SS': 'short stay',
  'VR': 'virtual'
}
```

### Supporting Info Categories
```javascript
{
  'vital-sign-systolic': 'Systolic Blood Pressure',
  'vital-sign-diastolic': 'Diastolic Blood Pressure',
  'vital-sign-height': 'Height',
  'vital-sign-weight': 'Weight',
  'pulse': 'Pulse Rate',
  'temperature': 'Body Temperature',
  'oxygen-saturation': 'Oxygen Saturation',
  'respiratory-rate': 'Respiratory Rate',
  'chief-complaint': 'Chief Complaint',
  'days-supply': 'Days Supply',
  'estimated-Length-of-Stay': 'Estimated Length of Stay',
  'hospitalized': 'Hospitalized',
  'info': 'General Information',
  'attachment': 'Attachment'
}
```

---

# 6. AI/ML Services

## 6.1 Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    AI SERVICE LAYER                         │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │   Ollama    │  │   Medbot    │  │    RAG Service      │ │
│  │  Service    │  │  Service    │  │  (Vector Search)    │ │
│  │ (BioMistral)│  │ (Drug AI)   │  │                     │ │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘ │
│         │                │                     │            │
│         └────────────────┼─────────────────────┘            │
│                          │                                  │
│              ┌───────────▼───────────┐                      │
│              │  Medical Validation   │                      │
│              │      Service          │                      │
│              └───────────┬───────────┘                      │
│                          │                                  │
│         ┌────────────────┼────────────────┐                 │
│         │                │                │                 │
│  ┌──────▼──────┐  ┌──────▼──────┐  ┌──────▼──────┐        │
│  │ Eye Form    │  │ Medication  │  │    Chat     │        │
│  │ Validation  │  │   Safety    │  │   Service   │        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
└─────────────────────────────────────────────────────────────┘
```

## 6.2 Ollama Service Details

### Configuration
```javascript
{
  baseUrl: 'http://localhost:11434',
  model: 'cniongolo/biomistral',
  timeout: 120000,
  maxRetries: 3
}
```

### BioMistral Model Capabilities
- Medical knowledge understanding
- Clinical reasoning
- Symptom analysis
- Treatment recommendations
- Medical terminology processing
- 4096-dimension embeddings

### Eye Form Validation Prompt
```javascript
buildValidationPrompt(formData, guidelines) {
  return `You are an ophthalmology AI assistant. Analyze this eye examination form.

PATIENT DATA:
- Name: ${formData.insured_name}
- Age: ${formData.age}
- Sex: ${formData.sex}
- Chief Complaints: ${formData.chief_complaints}
- Duration: ${formData.duration_of_illness_days} days
- Significant Signs: ${formData.significant_signs}

RIGHT EYE:
- Distance: SPH ${formData.right_eye_specs?.distance?.sphere}, CYL ${formData.right_eye_specs?.distance?.cylinder}, AXIS ${formData.right_eye_specs?.distance?.axis}
- Near: SPH ${formData.right_eye_specs?.near?.sphere}
- Bifocal Add: ${formData.right_eye_specs?.bifocal_add}

LEFT EYE:
- Distance: SPH ${formData.left_eye_specs?.distance?.sphere}, CYL ${formData.left_eye_specs?.distance?.cylinder}, AXIS ${formData.left_eye_specs?.distance?.axis}
- Near: SPH ${formData.left_eye_specs?.near?.sphere}
- Bifocal Add: ${formData.left_eye_specs?.bifocal_add}

LENS SPECIFICATIONS:
${Object.entries(formData.lens_specifications || {}).filter(([k,v]) => v).map(([k]) => `- ${k}`).join('\n')}

PROCEDURES:
${formData.procedures?.map(p => `- ${p.code}: ${p.service_description}`).join('\n')}

${guidelines.length > 0 ? `RELEVANT GUIDELINES:\n${guidelines.map(g => g.content).join('\n\n')}` : ''}

Analyze and return JSON:
{
  "isValid": boolean,
  "confidenceScore": 0-100,
  "warnings": [{"field": "string", "message": "string", "severity": "high|medium|low"}],
  "recommendations": ["string"],
  "missingAnalyses": ["string"],
  "clinicalAssessment": "string"
}`;
}
```

## 6.3 Medbot Service Details

### Configuration
```javascript
{
  model: 'Goosedev/medbot',
  specialization: 'Pharmaceutical/Drug Information'
}
```

### Drug Interaction Analysis Prompt
```javascript
buildInteractionPrompt(medications) {
  return `You are a clinical pharmacist AI. Analyze these medications for drug-drug interactions:

${medications.map((med, i) => `${i+1}. ${med.medicationName}${med.strength ? ` ${med.strength}${med.unit || ''}` : ''}`).join('\n')}

Provide JSON response:
{
  "hasInteractions": boolean,
  "interactions": [
    {
      "severity": "severe|moderate|mild",
      "affectedDrugs": ["Drug A", "Drug B"],
      "interaction": "Description of the interaction",
      "mechanism": "Pharmacological mechanism",
      "recommendation": "Clinical recommendation"
    }
  ]
}`;
}
```

### Medication Safety Analysis Prompt
```javascript
buildSafetyAnalysisPrompt(medications, patientContext) {
  return `Comprehensive medication safety analysis:

PATIENT:
- Age: ${patientContext.age || 'Unknown'}
- Weight: ${patientContext.weight || 'Unknown'}
- Conditions: ${patientContext.conditions?.join(', ') || 'None specified'}
- Allergies: ${patientContext.allergies?.join(', ') || 'None specified'}

MEDICATIONS:
${medications.map((med, i) => `
${i+1}. ${med.medicationName || med.activeIngredient}
   - Strength: ${med.strength || 'N/A'} ${med.unit || ''}
   - Dosage: ${med.dosage || 'N/A'}
   - Frequency: ${med.frequency || 'N/A'}
   - Route: ${med.route || 'N/A'}
   - Duration: ${med.duration || 'N/A'}
`).join('')}

Analyze for:
1. Drug-drug interactions
2. Contraindications based on patient conditions
3. Dosing appropriateness
4. Duplicate therapy
5. Age-related concerns

Return JSON:
{
  "overallRisk": "high|moderate|low",
  "interactions": [...],
  "contraindications": [...],
  "dosingIssues": [...],
  "duplicateTherapy": [...],
  "recommendations": [...]
}`;
}
```

## 6.4 RAG Service Details

### Vector Storage Schema
```sql
CREATE TABLE medical_knowledge (
  id SERIAL PRIMARY KEY,
  content TEXT NOT NULL,
  embedding vector(4096),
  metadata JSONB,
  source VARCHAR(255),
  category VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX ON medical_knowledge USING ivfflat (embedding vector_cosine_ops);
```

### Knowledge Retrieval
```javascript
async retrieveRelevantGuidelines(formData) {
  // Build query from form data
  const queryText = `
    Eye examination for ${formData.age} year old patient.
    Chief complaints: ${formData.chief_complaints}.
    Signs: ${formData.significant_signs}.
    Prescription: SPH ${formData.right_eye_specs?.distance?.sphere}, 
                  CYL ${formData.right_eye_specs?.distance?.cylinder}.
    Procedures: ${formData.procedures?.map(p => p.service_description).join(', ')}.
  `;

  // Generate embedding
  const queryEmbedding = await this.generateEmbedding(queryText);

  // Vector similarity search
  const results = await query(`
    SELECT 
      content,
      metadata,
      1 - (embedding <=> $1::vector) as similarity
    FROM medical_knowledge
    WHERE 1 - (embedding <=> $1::vector) > $2
    ORDER BY similarity DESC
    LIMIT $3
  `, [
    `[${queryEmbedding.join(',')}]`,
    this.similarityThreshold,  // 0.7
    this.maxRetrievalResults   // 5
  ]);

  return results.rows;
}
```

## 6.5 Chat Service Details

### Dual-Mode Operation

**Drug Mode (Medbot):**
- Pharmaceutical information
- Drug interactions
- Dosing guidance
- Side effects
- Medication alternatives

**General Mode (BioMistral):**
- Medical conditions
- Symptoms analysis
- Health information
- When to seek care
- General medical questions

### Streaming Implementation
```javascript
async streamChat(message, mode, history, onChunk, onComplete, onError) {
  const model = mode === 'drug' ? this.drugModel : this.generalModel;
  
  try {
    const stream = await this.client.generate({
      model: model,
      prompt: this.buildPromptWithContext(message, history, this.getSystemPrompt(mode)),
      stream: true,
      options: {
        temperature: 0.7,
        top_p: 0.9,
        num_predict: 2048
      }
    });

    let fullResponse = '';
    for await (const chunk of stream) {
      fullResponse += chunk.response;
      onChunk(chunk.response);
    }
    
    onComplete(fullResponse);
  } catch (error) {
    onError(error);
  }
}
```

---

# 7. Module Reference

## 7.1 Prior Authorization Module

### Purpose
Manages healthcare service pre-approvals through NPHIES integration.

### Authorization Types

| Type | Profile | Encounter | Special Requirements |
|------|---------|-----------|---------------------|
| Institutional | institutional-priorauth | IMP/SS | Hospitalization, chief-complaint, length-of-stay |
| Professional | professional-priorauth | AMB/EMER/HH/VR | CareTeam, encounter reference |
| Pharmacy | pharmacy-priorauth | None | Medication extensions, days-supply |
| Dental | oral-priorauth | AMB only | FDI tooth numbers, serviceEventType |
| Vision | vision-priorauth | None | VisionPrescription, lens specs |

### Workflow
```
1. Create Prior Authorization
   └── Select auth type
   └── Enter patient/provider/insurer
   └── Add items/procedures
   └── Add diagnoses
   └── Add supporting info
   └── Add attachments

2. Save Draft
   └── Validate required fields
   └── Store in database

3. Preview FHIR Bundle
   └── Generate request bundle
   └── Display JSON preview

4. Submit to NPHIES
   └── Build FHIR bundle
   └── Send to NPHIES API
   └── Parse response
   └── Update database

5. View Response
   └── Display outcome
   └── Show pre-auth reference
   └── Show item adjudications
   └── Show errors if any
```

### API Endpoints
```
GET    /api/prior-authorizations          # List all
GET    /api/prior-authorizations/:id      # Get by ID
POST   /api/prior-authorizations          # Create new
PUT    /api/prior-authorizations/:id      # Update
DELETE /api/prior-authorizations/:id      # Delete
POST   /api/prior-authorizations/:id/submit  # Submit to NPHIES
GET    /api/prior-authorizations/:id/preview # Preview FHIR bundle
```

## 7.2 Eligibility Module

### Purpose
Real-time verification of patient insurance coverage through NPHIES.

### Features
- Multiple purpose selection (benefits, validation, discovery, auth-requirements)
- Newborn eligibility extension
- Transfer of care extension
- Service date specification
- Coverage benefit details display

### Workflow
```
1. Select Patient
   └── Load patient coverages

2. Select Coverage
   └── Auto-populate insurer

3. Select Provider

4. Choose Purpose(s)
   └── benefits
   └── validation
   └── discovery
   └── auth-requirements

5. Set Service Date

6. Optional Extensions
   └── Newborn (use mother's coverage)
   └── Transfer (care transfer)

7. Submit Check
   └── Build CoverageEligibilityRequest
   └── Send to NPHIES
   └── Parse CoverageEligibilityResponse
   └── Display results
```

### API Endpoints
```
GET    /api/eligibility                    # List all checks
GET    /api/eligibility/:id                # Get by ID
POST   /api/eligibility/check-nphies       # Submit NPHIES check
PUT    /api/eligibility/:id/status         # Update status
```

## 7.3 Dental Approvals Module

### Purpose
Dental treatment approval forms with interactive tooth chart.

### Features
- 4-tab wizard interface
- Interactive dental chart (FDI numbering)
- Multi-tooth selection
- Procedure-tooth linking
- Medication entry
- Treatment type classification

### Form Sections

**Tab 1: Reception/Nurse**
- Provider name
- Insurance company
- TPA company
- Patient file number
- Date of visit
- Plan type
- Visit type (new/follow-up)

**Tab 2: Insured Information**
- Insured name
- ID card number
- Sex/Age
- Policy holder
- Policy number
- Expiry date
- Class

**Tab 3: Dentist Section**
- Duration of illness
- Chief complaints
- Significant signs
- Diagnosis (ICD-10)
- Primary/secondary diagnosis
- Treatment type checkboxes
- Provider approval

**Tab 4: Procedures & Medications**
- Interactive dental chart
- Procedure table (code, description, tooth, cost)
- Medication table (name, type, quantity)

### API Endpoints
```
GET    /api/dental-approvals               # List all
GET    /api/dental-approvals/:id           # Get by ID
POST   /api/dental-approvals               # Create new
PUT    /api/dental-approvals/:id           # Update
DELETE /api/dental-approvals/:id           # Delete
POST   /api/dental-approvals/:id/submit    # Submit to NPHIES
```

## 7.4 Eye Approvals Module

### Purpose
Optical/vision approval forms with AI validation.

### Features
- 4-tab wizard interface
- Right/left eye specification tables
- Lens type and specifications
- Contact lens options
- Frame requirements
- AI validation integration
- Inline validation warnings

### Form Sections

**Tab 1: Reception/Nurse**
- Provider name
- Insurance company
- TPA company
- Date of visit
- Plan type
- Visit type

**Tab 2: Insured Information**
- Insured name
- ID card number
- Sex/Age
- Policy details
- Approval status

**Tab 3: Optician**
- Duration of illness
- Chief complaints
- Significant signs
- Right eye specifications (distance/near/bifocal)
- Left eye specifications (distance/near/bifocal)
- Lens type (glass/plastic)
- Lens specifications (multi-coated, varilux, aspheric, etc.)
- Contact lenses (permanent/disposal)
- Frames required

**Tab 4: Procedures**
- Procedure table (code, description, type, cost)

### AI Validation
```javascript
// Validation result structure
{
  isValid: boolean,
  confidenceScore: 0-100,
  warnings: [{
    field: 'chief_complaints',
    message: 'Consider documenting onset date',
    severity: 'medium'
  }],
  recommendations: [
    'Recommend retinal examination for patient over 40',
    'Consider OCT scan given symptoms'
  ],
  missingAnalyses: [
    'Intraocular pressure not documented'
  ],
  clinicalAssessment: 'Prescription appears consistent with presbyopia...'
}
```

### API Endpoints
```
GET    /api/eye-approvals                  # List all
GET    /api/eye-approvals/:id              # Get by ID
POST   /api/eye-approvals                  # Create new
PUT    /api/eye-approvals/:id              # Update
DELETE /api/eye-approvals/:id              # Delete
POST   /api/eye-approvals/:id/validate     # AI validation
```

## 7.5 General Request Module

### Purpose
Multi-step wizard for general healthcare service requests with medication safety analysis.

### Features
- 6-step wizard
- Draft auto-save
- Medication database search
- Drug interaction checking
- Safety analysis
- Prerequisite justification

### Wizard Steps

**Step 1: Patient Information**
- Patient selection
- Demographics display

**Step 2: Coverage Selection**
- Coverage selection
- Benefit verification

**Step 3: Provider Details**
- Provider selection
- Practitioner info

**Step 4: Service Request**
- Service type
- Diagnosis
- Clinical information

**Step 5: Medications**
- Medication search
- Add medications
- Interaction checking
- Safety analysis panel

**Step 6: Review & Submit**
- Summary display
- Validation
- Submit

### Medication Safety Features
```javascript
// Drug interaction check
const interactions = await medicationSafetyService.checkDrugInteractions([
  { medicationName: 'Warfarin', strength: '5mg' },
  { medicationName: 'Aspirin', strength: '100mg' }
]);

// Result
{
  hasInteractions: true,
  interactions: [{
    severity: 'severe',
    affectedDrugs: ['Warfarin', 'Aspirin'],
    interaction: 'Increased bleeding risk',
    recommendation: 'Monitor INR closely, consider alternative'
  }]
}
```

### API Endpoints
```
GET    /api/general-requests               # List all
GET    /api/general-requests/:id           # Get by ID
POST   /api/general-requests               # Create new
PUT    /api/general-requests/:id           # Update
DELETE /api/general-requests/:id           # Delete
POST   /api/general-request/validate       # Validate request
```

## 7.6 Medicine Search Module

### Purpose
Drug database search with detailed medication information.

### Features
- Search by name, ingredient, or code
- Detailed drug information display
- Dosage forms and strengths
- Manufacturer information
- SFDA registration status

### API Endpoints
```
GET    /api/medicines/search?q=            # Search medicines
GET    /api/medicines/:id                  # Get medicine details
GET    /api/medicines/suggestions?q=       # Auto-complete suggestions
```

## 7.7 AI Chat Module

### Purpose
AI-powered medical assistant with dual-mode operation.

### Modes

**Drug Mode (Medbot):**
- Pharmaceutical questions
- Drug information
- Interaction queries
- Dosing questions

**General Mode (BioMistral):**
- Medical conditions
- Symptoms
- Health information
- General questions

### Features
- Streaming responses
- Conversation history
- Mode switching
- Collapsible interface

### API Endpoints
```
POST   /api/chat/message                   # Send message (non-streaming)
GET    /api/chat/stream                    # SSE streaming endpoint
GET    /api/chat/health                    # Service health check
```

## 7.8 Medication Safety Module

### Purpose
Comprehensive medication safety analysis.

### Features
- Drug-drug interaction checking
- Contraindication analysis
- Dosing validation
- Duplicate therapy detection
- Age-related concerns

### API Endpoints
```
POST   /api/medication-safety/interactions # Check interactions
POST   /api/medication-safety/analyze      # Full safety analysis
POST   /api/medication-safety/validate-dose # Dose validation
```

---

# 8. API Reference

## 8.1 Base URL
```
http://localhost:8001/api
```

## 8.2 Common Response Format

### Success Response
```json
{
  "data": { ... },
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 100,
    "pages": 10
  }
}
```

### Error Response
```json
{
  "error": "Error type",
  "message": "Detailed error message"
}
```

## 8.3 Endpoint Summary

| Module | Endpoint | Methods |
|--------|----------|---------|
| Patients | /api/patients | GET, POST, PUT, DELETE |
| Providers | /api/providers | GET, POST, PUT, DELETE |
| Insurers | /api/insurers | GET, POST, PUT, DELETE |
| Prior Auth | /api/prior-authorizations | GET, POST, PUT, DELETE, /submit, /preview |
| Eligibility | /api/eligibility | GET, POST, /check-nphies |
| Dental | /api/dental-approvals | GET, POST, PUT, DELETE, /submit |
| Eye | /api/eye-approvals | GET, POST, PUT, DELETE, /validate |
| General | /api/general-requests | GET, POST, PUT, DELETE |
| AI Validation | /api/ai-validation | POST /eye-form |
| Chat | /api/chat | POST /message, GET /stream |
| Medicines | /api/medicines | GET /search, GET /:id |
| Med Safety | /api/medication-safety | POST /interactions, /analyze |
| Dashboard | /api/dashboard | GET /stats |
| NPHIES Codes | /api/nphies-codes | GET /:codeSystem |

---

# 9. Data Structures

## 9.1 Prior Authorization Form Data

```javascript
{
  // Basic Info
  auth_type: 'professional' | 'institutional' | 'pharmacy' | 'dental' | 'vision',
  sub_type: 'op' | 'ip' | 'emr',
  priority: 'stat' | 'normal',
  
  // References
  patient_id: 'uuid',
  provider_id: 'uuid',
  insurer_id: 'uuid',
  coverage_id: 'uuid',
  
  // Encounter (not for pharmacy/vision)
  encounter_class: 'ambulatory' | 'inpatient' | 'daycase' | 'emergency' | 'home' | 'telemedicine',
  encounter_period_start: 'date',
  encounter_period_end: 'date',
  
  // Items
  items: [{
    sequence: 1,
    product_or_service_code: 'string',
    product_or_service_display: 'string',
    quantity: 1,
    unit_price: 0.00,
    net: 0.00,
    body_site: 'string',
    sub_site: 'string',
    serviced_date: 'date',
    
    // Pharmacy-specific
    medication_code: 'string',
    medication_name: 'string',
    days_supply: 30,
    prescribed_medication_code: 'string',
    pharmacist_selection_reason: 'string',
    pharmacist_substitute: 'string',
    is_package: false,
    patient_share: 0.00,
    is_maternity: false,
    
    // Dental-specific
    tooth_number: 'string',
    tooth_surface: 'string',
    
    // Vision-specific
    lens_type: 'string',
    lens_specifications: {}
  }],
  
  // Diagnoses
  diagnoses: [{
    sequence: 1,
    code: 'string',
    type: 'principal' | 'secondary' | 'admitting',
    on_admission: 'y' | 'n' | 'u' | 'w'
  }],
  
  // Supporting Info
  supporting_info: [{
    sequence: 1,
    category: 'string',
    code: 'string',
    value: 'string',
    unit: 'string'
  }],
  
  // Vital Signs
  vital_signs: {
    systolic: 'string',
    diastolic: 'string',
    height: 'string',
    weight: 'string',
    pulse: 'string',
    temperature: 'string',
    oxygen_saturation: 'string',
    respiratory_rate: 'string'
  },
  
  // Clinical Info
  clinical_info: {
    chief_complaint_format: 'snomed' | 'text',
    chief_complaint_code: 'string',
    chief_complaint_display: 'string',
    chief_complaint_text: 'string',
    patient_history: 'string',
    history_of_present_illness: 'string',
    physical_examination: 'string',
    treatment_plan: 'string',
    investigation_result: 'string'
  },
  
  // Admission Info (Institutional)
  admission_info: {
    admit_source: 'string',
    admission_specialty: 'string',
    estimated_length_of_stay: 0,
    re_admission: false,
    discharge_disposition: 'string'
  },
  
  // Vision Prescription
  vision_prescription: {
    right_eye: {
      sphere: 'string',
      cylinder: 'string',
      axis: 'string',
      prism: 'string',
      add: 'string'
    },
    left_eye: {
      sphere: 'string',
      cylinder: 'string',
      axis: 'string',
      prism: 'string',
      add: 'string'
    }
  },
  
  // Attachments
  attachments: [{
    title: 'string',
    content_type: 'string',
    data: 'base64',
    category: 'string'
  }],
  
  // Totals
  total_amount: 0.00,
  
  // Extensions
  eligibility_ref: 'string',
  eligibility_offline_ref: 'string',
  eligibility_offline_date: 'date',
  is_transfer: false
}
```

## 9.2 Eye Approval Form Data

```javascript
{
  // Reception
  provider_name: 'string',
  insurance_company_name: 'string',
  tpa_company_name: 'string',
  patient_file_number: 'string',
  date_of_visit: 'date',
  plan_type: 'string',
  new_visit: false,
  follow_up: false,
  
  // Insured
  insured_name: 'string',
  id_card_number: 'string',
  sex: 'Male' | 'Female' | 'Other',
  age: 'number',
  policy_holder: 'string',
  policy_number: 'string',
  expiry_date: 'date',
  class: 'string',
  approval: 'string',
  
  // Clinical
  duration_of_illness_days: 'number',
  chief_complaints: 'string',
  significant_signs: 'string',
  
  // Eye Specifications
  right_eye_specs: {
    distance: {
      sphere: 'string',
      cylinder: 'string',
      axis: 'string',
      prism: 'string',
      vn: 'string'
    },
    near: {
      sphere: 'string',
      cylinder: 'string',
      axis: 'string',
      prism: 'string',
      vn: 'string'
    },
    bifocal_add: 'string',
    vertex_add: 'string'
  },
  left_eye_specs: {
    distance: {
      sphere: 'string',
      cylinder: 'string',
      axis: 'string',
      prism: 'string',
      vn: 'string',
      pd: 'string'
    },
    near: {
      sphere: 'string',
      cylinder: 'string',
      axis: 'string',
      prism: 'string',
      vn: 'string'
    },
    bifocal_add: 'string'
  },
  
  // Lens
  lens_type: 'glass' | 'plastic' | 'none',
  lens_specifications: {
    multi_coated: false,
    varilux: false,
    light: false,
    aspheric: false,
    bifocal: false,
    medium: false,
    lenticular: false,
    single_vision: false,
    dark: false,
    safety_thickness: false,
    anti_reflecting: false,
    photosensitive: false,
    high_index: false,
    colored: false,
    anti_scratch: false
  },
  
  // Contact Lenses
  contact_lenses_permanent: false,
  contact_lenses_disposal: false,
  
  // Frames
  frames_required: false,
  number_of_pairs: 'number',
  
  // Provider Approval
  completed_coded_by: 'string',
  provider_signature: 'string',
  provider_date: 'date',
  
  // Procedures
  procedures: [{
    code: 'string',
    service_description: 'string',
    type: 'string',
    cost: 'number'
  }],
  
  // Foreign Keys
  patient_id: 'uuid',
  provider_id: 'uuid',
  insurer_id: 'uuid',
  status: 'Draft' | 'Submitted' | 'Approved' | 'Rejected' | 'Pending'
}
```

## 9.3 Dental Approval Form Data

```javascript
{
  // Reception
  provider_name: 'string',
  insurance_company_name: 'string',
  tpa_company_name: 'string',
  patient_file_number: 'string',
  date_of_visit: 'date',
  plan_type: 'string',
  new_visit: false,
  follow_up: false,
  
  // Insured
  insured_name: 'string',
  id_card_number: 'string',
  sex: 'Male' | 'Female' | 'Other',
  age: 'number',
  policy_holder: 'string',
  policy_number: 'string',
  expiry_date: 'date',
  class: 'string',
  
  // Dentist
  duration_of_illness_days: 'number',
  chief_complaints: 'string',
  significant_signs: 'string',
  diagnosis_icd10: 'string',
  primary_diagnosis: 'string',
  secondary_diagnosis: 'string',
  other_conditions: 'string',
  
  // Treatment Type
  regular_dental_treatment: false,
  dental_cleaning: false,
  trauma_treatment: false,
  trauma_rta: false,
  work_related: false,
  other_treatment: false,
  treatment_details: 'string',
  treatment_how: 'string',
  treatment_when: 'string',
  treatment_where: 'string',
  
  // Provider Approval
  completed_coded_by: 'string',
  provider_signature: 'string',
  provider_date: 'date',
  
  // Procedures
  procedures: [{
    code: 'string',
    service_description: 'string',
    tooth_number: 'string',  // FDI notation: 11-48, 51-85
    cost: 'number'
  }],
  
  // Medications
  medications: [{
    medication_name: 'string',
    type: 'string',
    quantity: 'number'
  }],
  
  // Foreign Keys
  patient_id: 'uuid',
  provider_id: 'uuid',
  insurer_id: 'uuid',
  status: 'Draft' | 'Submitted' | 'Approved' | 'Rejected' | 'Pending'
}
```

## 9.4 AI Validation Result

```javascript
{
  isValid: true,
  confidenceScore: 85,
  warnings: [{
    field: 'chief_complaints',
    message: 'Consider documenting onset date for symptoms',
    severity: 'medium'
  }, {
    field: 'right_eye_specs',
    message: 'High cylinder value may indicate astigmatism - ensure axis is accurate',
    severity: 'low'
  }],
  recommendations: [
    'Recommend retinal examination for patient over 40 with presbyopia',
    'Consider OCT scan given duration of symptoms',
    'Document any family history of glaucoma'
  ],
  missingAnalyses: [
    'Intraocular pressure measurement not documented',
    'Pupil dilation status not specified'
  ],
  clinicalAssessment: 'The prescription appears consistent with age-related presbyopia. The cylinder values suggest mild astigmatism. Recommendations for comprehensive examination are appropriate given patient age and symptom duration.',
  metadata: {
    validationDuration: 2345,
    guidelinesUsed: 3,
    model: 'cniongolo/biomistral',
    timestamp: '2024-12-06T10:30:00Z'
  }
}
```

## 9.5 Medication Safety Analysis

```javascript
{
  success: true,
  analysis: {
    overallRisk: 'moderate',
    interactions: [{
      severity: 'moderate',
      affectedDrugs: ['Warfarin', 'Aspirin'],
      interaction: 'Increased bleeding risk due to combined anticoagulant/antiplatelet effect',
      mechanism: 'Both drugs affect hemostasis through different pathways',
      recommendation: 'Monitor INR more frequently, watch for signs of bleeding'
    }],
    contraindications: [{
      drug: 'Metformin',
      condition: 'Renal impairment',
      severity: 'high',
      recommendation: 'Contraindicated if eGFR < 30, dose adjustment if 30-45'
    }],
    dosingIssues: [{
      drug: 'Amoxicillin',
      issue: 'Dose may be subtherapeutic for severe infection',
      currentDose: '250mg TID',
      suggestedDose: '500mg TID',
      rationale: 'Standard adult dose for moderate-severe infection'
    }],
    duplicateTherapy: [{
      drugs: ['Omeprazole', 'Pantoprazole'],
      class: 'Proton Pump Inhibitors',
      recommendation: 'Use only one PPI, discontinue duplicate'
    }],
    ageRelatedConcerns: [{
      drug: 'Diphenhydramine',
      concern: 'Anticholinergic effects in elderly',
      recommendation: 'Consider non-anticholinergic alternative'
    }]
  },
  metadata: {
    model: 'Goosedev/medbot',
    responseTime: 3456,
    timestamp: '2024-12-06T10:30:00Z'
  }
}
```

---

# 10. Configuration

## 10.1 Environment Variables

### Backend (.env)
```bash
# Server
PORT=8001
NODE_ENV=development

# Database
DATABASE_URL=postgresql://username:password@localhost:5432/nafes_db
DB_HOST=localhost
DB_PORT=5432
DB_NAME=nafes_db
DB_USER=username
DB_PASSWORD=password

# NPHIES
NPHIES_BASE_URL=http://176.105.150.83
NPHIES_TIMEOUT=60000
NPHIES_RETRY_ATTEMPTS=3

# AI/Ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=cniongolo/biomistral
OLLAMA_TIMEOUT=120000
AI_VALIDATION_ENABLED=true

# Security
CORS_ORIGIN=http://localhost:5173,http://localhost:5174
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=10000

# Logging
LOG_LEVEL=debug
```

### Frontend (vite.config.js)
```javascript
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8001',
        changeOrigin: true
      }
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
});
```

## 10.2 Tailwind Configuration

```javascript
// tailwind.config.js
module.exports = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'primary-purple': '#553781',
        'accent-purple': '#7c3aed',
        'light-purple': '#f3e8ff'
      }
    }
  },
  plugins: []
};
```

## 10.3 AI Model Requirements

### Ollama Setup
```bash
# Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Pull required models
ollama pull cniongolo/biomistral    # Medical model
ollama pull Goosedev/medbot         # Drug specialist

# Start Ollama server
ollama serve
```

### Model Specifications

| Model | Size | Purpose | Embedding Dim |
|-------|------|---------|---------------|
| cniongolo/biomistral | ~4GB | Medical knowledge, validation | 4096 |
| Goosedev/medbot | ~4GB | Drug information, interactions | N/A |

---

# Document Information

**Document Title:** NAFES Healthcare Management System - Complete Technical Reference  
**Version:** 1.0.0  
**Created:** December 2024  
**Author:** Development Team  
**Classification:** Technical Documentation

---

*End of Document*


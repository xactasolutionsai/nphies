# AI Medical Validation with RAG - Setup and Testing Guide

## Overview

This system integrates Ollama AI with RAG (Retrieval-Augmented Generation) to provide intelligent medical validation for eye approval forms. The system uses the `cniongolo/biomistral` model by default but can be easily switched to any Ollama-compatible model.

## Architecture

```
┌─────────────┐
│   Frontend  │ 
│  (React)    │
└──────┬──────┘
       │
       │ API Call
       ▼
┌─────────────────────────────┐
│   Backend (Node.js/Express) │
│  ┌──────────────────────┐  │
│  │ AI Validation API    │  │
│  └──────┬───────────────┘  │
│         │                   │
│         ▼                   │
│  ┌──────────────────────┐  │
│  │Medical Validation    │  │
│  │Service               │  │
│  └──┬────────────────┬──┘  │
│     │                │      │
│     ▼                ▼      │
│  ┌─────────┐   ┌─────────┐ │
│  │  RAG    │   │ Ollama  │ │
│  │ Service │   │ Service │ │
│  └────┬────┘   └────┬────┘ │
│       │             │       │
└───────┼─────────────┼───────┘
        │             │
        ▼             ▼
┌────────────┐  ┌──────────┐
│ PostgreSQL │  │  Ollama  │
│ + pgvector │  │  Server  │
└────────────┘  └──────────┘
```

## Prerequisites

### 1. Install Ollama

**Windows:**
```bash
# Download from https://ollama.com/download
# Or use winget:
winget install Ollama.Ollama
```

**Mac/Linux:**
```bash
curl -fsSL https://ollama.com/install.sh | sh
```

### 2. Pull the biomistral model

```bash
ollama pull cniongolo/biomistral
```

Verify installation:
```bash
ollama list
```

### 3. Install PostgreSQL pgvector extension

Connect to your PostgreSQL database and run:
```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

Or run the migration script:
```bash
cd backend
psql -U postgres -d nafes_healthcare -f migrations/add_pgvector_extension.sql
```

## Setup Instructions

### Backend Setup

1. **Install Dependencies**
```bash
cd backend
npm install
```

2. **Configure Environment Variables**

Update your `.env` file (or create one from `env.example`):
```env
# AI Validation Configuration
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=cniongolo/biomistral
OLLAMA_TIMEOUT=120000
AI_VALIDATION_ENABLED=true
```

3. **Run Database Migrations**
```bash
# Run the pgvector migration
psql -U postgres -d nafes_healthcare -f migrations/add_pgvector_extension.sql
```

4. **Seed Medical Knowledge Base**
```bash
# Seed ophthalmology guidelines with embeddings
node scripts/seedMedicalKnowledge.js

# Or run full seeding with tests
node scripts/seedMedicalKnowledge.js full
```

5. **Start the Backend Server**
```bash
npm start
# or for development with auto-reload:
npm run dev
```

### Frontend Setup

1. **Install Dependencies**
```bash
cd frontend
npm install
```

2. **Configure Environment Variables**

Update your `.env` file:
```env
VITE_AI_VALIDATION_ENABLED=true
VITE_API_BASE_URL=http://localhost:8001/api
```

3. **Start the Frontend**
```bash
npm run dev
```

## Testing the Integration

### 1. Health Check

Test if the AI validation service is running:

```bash
curl http://localhost:8001/api/ai-validation/health
```

Expected response:
```json
{
  "success": true,
  "data": {
    "enabled": true,
    "ollama": {
      "available": true,
      "modelInstalled": true,
      "configuredModel": "cniongolo/biomistral"
    },
    "knowledgeBase": {
      "totalEntries": 20,
      "categories": {
        "ophthalmology": 20
      }
    },
    "status": "ready"
  }
}
```

### 2. Test Knowledge Base

Check if medical guidelines are loaded:

```bash
curl http://localhost:8001/api/ai-validation/knowledge/stats
```

Search for knowledge:
```bash
curl -X POST http://localhost:8001/api/ai-validation/knowledge/search \
  -H "Content-Type: application/json" \
  -d '{"query": "myopia correction", "limit": 3}'
```

### 3. Test Form Validation

#### Test Case 1: Complete Valid Form

Navigate to: `http://localhost:5173/eye-approvals/new`

Fill in the form with:
- Provider Name: Eye Care Center
- Insurance Company: Bupa Arabia
- Insured Name: Ahmed Al-Qahtani
- ID Card Number: 1234567890
- Date of Visit: Today's date
- Age: 35
- Chief Complaints: Blurred vision
- Right Eye Distance Sphere: -2.00
- Right Eye Distance Cylinder: -0.50
- Left Eye Distance Sphere: -1.75

Click "AI Validate" button.

**Expected Result:**
- Validation modal opens
- Confidence score: ~85-95%
- Minimal warnings
- Recommendations may include standard examinations

#### Test Case 2: Incomplete Form (Missing Critical Data)

Fill in minimal data:
- Provider Name: Eye Care Center
- Insurance Company: Bupa Arabia
- Insured Name: Test Patient
- ID Card Number: 123

Click "AI Validate" button.

**Expected Result:**
- Validation modal opens
- Several warnings about missing data
- Lower confidence score: ~40-60%
- Recommendations for additional tests
- List of missing analyses

#### Test Case 3: High Prescription Values

Fill form with high prescription:
- Age: 45
- Right Eye Distance Sphere: -8.00
- Right Eye Distance Cylinder: -3.00
- Chief Complaints: Severe myopia

Click "AI Validate" button.

**Expected Result:**
- Validation modal opens
- Warnings about high prescription values
- Recommendations for high-index lenses
- Suggestions for additional eye health checks
- Recommendations for presbyopia assessment (age 45+)

#### Test Case 4: Pediatric Case

Fill form with:
- Age: 8
- Chief Complaints: Difficulty seeing board at school
- Right Eye Distance Sphere: +2.50

Click "AI Validate" button.

**Expected Result:**
- Pediatric-specific recommendations
- Warnings about amblyopia screening
- Age-appropriate guidance

### 4. Manual API Testing

Test validation directly via API:

```bash
curl -X POST http://localhost:8001/api/ai-validation/validate-eye-form \
  -H "Content-Type: application/json" \
  -d '{
    "insured_name": "Ahmed Al-Qahtani",
    "age": "35",
    "chief_complaints": "Blurred vision when reading",
    "duration_of_illness_days": "30",
    "right_eye_specs": {
      "distance": {"sphere": "-2.00", "cylinder": "-0.50", "axis": "180"}
    },
    "left_eye_specs": {
      "distance": {"sphere": "-1.75", "cylinder": "-0.75", "axis": "170"}
    },
    "lens_type": "plastic",
    "procedures": [
      {"code": "3320", "service_description": "Comprehensive eye examination"}
    ]
  }'
```

## Changing the AI Model

To use a different Ollama model:

1. **Pull the new model:**
```bash
ollama pull <model-name>
```

2. **Update backend `.env`:**
```env
OLLAMA_MODEL=<model-name>
```

3. **Restart backend server:**
```bash
npm restart
```

**Note:** Different models may have different embedding dimensions. If embeddings fail, you may need to adjust the `embeddingDimension` in `ragService.js` or use the fallback embedding method.

## Troubleshooting

### Issue: "Ollama service unavailable"

**Solution:**
1. Check if Ollama is running:
   ```bash
   ollama list
   ```
2. Start Ollama if not running
3. Verify the model is installed:
   ```bash
   ollama pull cniongolo/biomistral
   ```

### Issue: "Model does not support embeddings"

**Solution:**
The system will automatically fall back to a simple embedding method. For better results:
1. Use an embedding-specific model
2. Or continue with fallback (works but less accurate)

### Issue: "Knowledge base empty"

**Solution:**
```bash
cd backend
node scripts/seedMedicalKnowledge.js
```

### Issue: "Validation taking too long"

**Solution:**
1. Increase timeout in `.env`:
   ```env
   OLLAMA_TIMEOUT=180000
   ```
2. Or reduce the number of retrieved guidelines in `ragService.js`:
   ```javascript
   this.maxRetrievalResults = 3; // Default is 5
   ```

### Issue: "Frontend not showing AI Validate button"

**Solution:**
1. Check frontend `.env`:
   ```env
   VITE_AI_VALIDATION_ENABLED=true
   ```
2. Restart frontend development server

## Performance Optimization

### Caching Responses
The system caches RAG retrievals for similar queries. Clear cache by restarting the backend.

### Adjusting Retrieval
Edit `backend/services/ragService.js`:
```javascript
this.maxRetrievalResults = 5; // Number of guidelines to retrieve
this.similarityThreshold = 0.7; // Minimum similarity score (0-1)
```

### Model Performance
- **biomistral**: Good medical knowledge, slower (~10-30s)
- **llama2**: Faster but less medical-specific (~5-15s)
- **mistral**: Balanced performance (~8-20s)

## API Endpoints

### Validation Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/ai-validation/validate-eye-form` | Validate a form |
| GET | `/api/ai-validation/history/:formId` | Get validation history |
| POST | `/api/ai-validation/override/:validationId` | Mark as overridden |
| GET | `/api/ai-validation/statistics` | Get validation stats |
| GET | `/api/ai-validation/health` | Check service health |

### Knowledge Base Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/ai-validation/knowledge/search` | Search knowledge base |
| GET | `/api/ai-validation/knowledge/stats` | Get knowledge stats |

## Adding Custom Medical Guidelines

Edit `backend/data/medical_guidelines/ophthalmology_guidelines.json` and add:

```json
{
  "content": "Your medical guideline text here...",
  "category": "ophthalmology",
  "metadata": {
    "title": "Guideline Title",
    "source": "Medical Source",
    "tags": ["tag1", "tag2"]
  }
}
```

Then re-seed:
```bash
node scripts/seedMedicalKnowledge.js
```

## Security Notes

1. **Never commit `.env` files** with sensitive credentials
2. **AI validation is advisory only** - always requires human review
3. **User override capability** - users can proceed despite AI warnings
4. **Audit trail** - all validations are logged to database
5. **Feature flag** - can be disabled via environment variable

## Support

For issues or questions:
1. Check this README
2. Review console logs (backend and frontend)
3. Check Ollama logs: `ollama logs`
4. Verify database connectivity
5. Test health endpoint

## License

This AI validation system is part of the Nafes Healthcare Management System.


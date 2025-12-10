# Medicine Module - Setup and Usage Guide

## Overview

The Medicine Module is a comprehensive system for searching and retrieving detailed information about medicines using:
- **RAG (Retrieval-Augmented Generation)** for semantic search
- **AI-powered information** using the Goosedev/medbot model
- **PostgreSQL with pgvector** for efficient vector search

## Setup Instructions

### 1. Database Setup

First, run the database migration to create the necessary tables:

```bash
# Connect to your PostgreSQL database
psql -U postgres -d nafes_healthcare

# Run the migration script
\i backend/migrations/create_medicines_tables.sql
```

This creates:
- `medicines` - Core medicine data with vector embeddings
- `medicine_brands` - Brand names and package information
- `medicine_codes` - Various identification codes (MOH, NHIC, NUPCO, GTIN, Registration)

### 2. Import Medicine Data

The CSV files are located in the `files/` directory. To import them into the database:

```bash
cd backend
node scripts/importMedicines.js
```

This script will:
- Parse all 7 CSV files
- Insert ~5,667 generic medicines
- Insert ~10,204 brand medicines
- Insert ~26,000+ medicine codes
- Generate embeddings for each medicine (this takes time!)

**Expected Duration**: 30-60 minutes depending on your hardware and AI model speed.

### 3. Verify Import

Check the import statistics:

```bash
# Connect to PostgreSQL
psql -U postgres -d nafes_healthcare

# Check counts
SELECT COUNT(*) FROM medicines;
SELECT COUNT(*) FROM medicine_brands;
SELECT COUNT(*) FROM medicine_codes;
SELECT code_type, COUNT(*) FROM medicine_codes GROUP BY code_type;
```

### 4. Configure AI Models

The module uses **two AI models** via Ollama:

1. **cniongolo/biomistral** - For embeddings and semantic search
2. **Goosedev/medbot** - For detailed medical information

Install both models:

```bash
# Pull the embedding model (required for search)
ollama pull cniongolo/biomistral

# Pull the medical information model (required for AI info)
ollama pull Goosedev/medbot

# Verify both are installed
curl http://206.168.83.244:11434/api/tags
```

Update your `.env` file:

```env
OLLAMA_BASE_URL=http://206.168.83.244:11434
OLLAMA_MODEL=cniongolo/biomistral  # For embeddings
OLLAMA_TIMEOUT=120000
# Note: Goosedev/medbot is hardcoded in medbotService.js
```

## API Endpoints

### 1. Search Medicines (Natural Language)

**Endpoint**: `GET /api/medicines/search`

**Query Parameters**:
- `q` (required): Search query in natural language
- `limit` (optional): Maximum results (default: 20)

**Example**:
```bash
curl "http://localhost:8001/api/medicines/search?q=painkiller for headache"
curl "http://localhost:8001/api/medicines/search?q=insulin for diabetes"
curl "http://localhost:8001/api/medicines/search?q=antibiotic for infection"
```

**Response**:
```json
{
  "success": true,
  "query": "painkiller for headache",
  "count": 10,
  "results": [
    {
      "id": 1,
      "mrid": "010101-0122-6401",
      "activeIngredient": "acetylsalicylic acid",
      "strength": "100",
      "unit": "mg",
      "dosageForm": {
        "parent": "tablet",
        "child": "tablet"
      },
      "similarity": 0.85,
      "brands": [...],
      "codes": [...]
    }
  ]
}
```

### 2. Get Medicine by MRID

**Endpoint**: `GET /api/medicines/:mrid`

**Example**:
```bash
curl "http://localhost:8001/api/medicines/010101-0122-6401"
```

### 3. Get Medicine by Code

**Endpoint**: `GET /api/medicines/code/:type/:value`

**Code Types**: MOH, NHIC, NUPCO, GTIN, REGISTRATION

**Example**:
```bash
curl "http://localhost:8001/api/medicines/code/MOH/548014280"
curl "http://localhost:8001/api/medicines/code/GTIN/96600000002606"
```

### 4. Search by Active Ingredient

**Endpoint**: `GET /api/medicines/ingredient/:name`

**Example**:
```bash
curl "http://localhost:8001/api/medicines/ingredient/acetylsalicylic"
```

### 5. Search by Brand Name

**Endpoint**: `GET /api/medicines/brand/:name`

**Example**:
```bash
curl "http://localhost:8001/api/medicines/brand/aspirin"
```

### 6. Get AI-Generated Medicine Information

**Endpoint**: `POST /api/medicines/:mrid/ai-info`

**Example**:
```bash
curl -X POST "http://localhost:8001/api/medicines/010101-0122-6401/ai-info"
```

**Response**:
```json
{
  "success": true,
  "medicine": {
    "mrid": "010101-0122-6401",
    "activeIngredient": "acetylsalicylic acid",
    "strength": "100",
    "unit": "mg",
    "dosageForm": {...},
    "brands": [...]
  },
  "aiInformation": {
    "indications": [
      "Pain relief for mild to moderate pain",
      "Reduction of fever",
      "Anti-inflammatory effects"
    ],
    "contraindications": [
      "Active peptic ulcer disease",
      "Severe bleeding disorders",
      "Hypersensitivity to aspirin"
    ],
    "sideEffects": [
      "Gastrointestinal discomfort",
      "Increased bleeding risk",
      "Allergic reactions"
    ],
    "interactions": [
      "Anticoagulants (increased bleeding risk)",
      "NSAIDs (increased GI toxicity)",
      "Methotrexate (increased toxicity)"
    ],
    "dosageGuidelines": "Adults: 300-900mg every 4-6 hours...",
    "warnings": [
      "Not recommended for children under 16",
      "Use with caution in elderly patients"
    ],
    "mechanismOfAction": "Irreversibly inhibits cyclooxygenase (COX) enzymes...",
    "metadata": {
      "model": "gooseai/medbot",
      "responseTime": "3.45s",
      "timestamp": "2024-01-15T10:30:00Z"
    }
  }
}
```

### 7. Get Statistics

**Endpoint**: `GET /api/medicines/stats`

**Example**:
```bash
curl "http://localhost:8001/api/medicines/stats"
```

### 8. Health Check

**Endpoint**: `GET /api/medicines/health`

**Example**:
```bash
curl "http://localhost:8001/api/medicines/health"
```

## Frontend Usage

### Accessing the Medicine Search Page

1. Navigate to `/medicines` in your browser
2. Use the search bar to enter natural language queries
3. View search results with similarity scores
4. Click "Get AI Info" on any medicine to see detailed information

### Features

- **Natural Language Search**: Search using phrases like "medicine for high blood pressure"
- **Similarity Scores**: See how well each result matches your query
- **Brand Names**: View all available brand names for each medicine
- **AI Information Modal**: Get detailed clinical information including:
  - Indications (what it treats)
  - Contraindications (when not to use)
  - Side effects
  - Drug interactions
  - Dosage guidelines
  - Warnings
  - Mechanism of action

## Troubleshooting

### Import Script Issues

**Problem**: Import fails with "embedding dimension mismatch"
**Solution**: Ensure your Ollama model generates 768-dimensional embeddings. Update `ragService.js` if needed.

**Problem**: Import is very slow
**Solution**: This is normal. Generating embeddings for 5,000+ medicines takes time. You can:
- Reduce the dataset for testing
- Use a faster embedding model
- Run the import overnight

### Search Issues

**Problem**: No results found
**Solution**: 
- Check similarity threshold in `medicineService.js` (default: 0.6)
- Lower the threshold for more results
- Try more specific queries

**Problem**: Poor search results
**Solution**:
- Ensure embeddings were generated correctly
- Try different query phrasing
- Check that the model is appropriate for medical terminology

### AI Information Issues

**Problem**: AI information is incomplete or incorrect
**Solution**:
- Ensure Goosedev/medbot model is properly installed: `ollama pull Goosedev/medbot`
- Check Ollama is running: `ollama list`
- Verify the model in `backend/services/medbotService.js`
- Increase the `num_predict` parameter in `medbotService.js`

**Problem**: AI requests timeout
**Solution**:
- Increase `OLLAMA_TIMEOUT` in `.env`
- Use a more powerful machine or GPU acceleration
- Reduce the `num_predict` parameter

## Architecture

The Medicine Module uses a **separated service architecture**:

### Service Structure

```
backend/services/
├── ollamaService.js    - Base Ollama client (embeddings, cniongolo/biomistral)
├── medbotService.js    - Medical AI (Goosedev/medbot for clinical information)
├── ragService.js       - Uses ollamaService for semantic search
└── medicineService.js  - Business logic, uses both ragService and medbotService
```

### Model Separation

- **ollamaService.js**: Handles embeddings using `cniongolo/biomistral` for RAG search
- **medbotService.js**: Handles medical information using `Goosedev/medbot` for detailed clinical data

This separation ensures:
- Clear responsibilities
- Independent model configuration
- Better maintainability
- Easier testing

## Configuration

### Adjusting Search Behavior

Edit `backend/services/medicineService.js`:

```javascript
this.similarityThreshold = 0.6; // Lower = more results, higher = more precise
this.maxResults = 20; // Maximum number of results to return
```

### Adjusting AI Behavior

Edit `backend/services/medbotService.js` in the `getMedicineInformation` method:

```javascript
const result = await this.generateCompletion(prompt, {
  temperature: 0.3,    // Lower = more deterministic, higher = more creative
  num_predict: 4000,   // Maximum tokens to generate
  repeat_penalty: 1.1  // Reduces repetition
});
```

## CSV File Structure

### All_generic_v072124.csv
- Active Ingredient
- Strength
- Unit
- Dosage Form - Parent
- Dosage Form - Child
- MG_MRID (Medicine Generic MRID)

### All_brand_v072124.csv
- Active Ingredient
- Strength
- Unit
- Dosage Form - Parent
- Dosage Form - Child
- Brand Name
- Package Form
- MB_MRID (Medicine Brand MRID)

### Code Files (MOH, NHIC, NUPCO, GTIN, Registration)
- Code Value (moh_code, nhic_code, etc.)
- MRID (links to medicines table)

## Performance Optimization

### Database Indexes

The migration script creates optimal indexes:
- Vector similarity index (ivfflat)
- Full-text search indexes
- Foreign key indexes

### Query Performance

- Vector searches are O(log n) with proper indexing
- Use pagination for large result sets
- Cache frequently accessed medicines

## Security Considerations

1. **Rate Limiting**: API endpoints are rate-limited by the server
2. **Input Validation**: All inputs are validated
3. **SQL Injection**: Using parameterized queries
4. **CORS**: Configured in server.js

## Future Enhancements

- [ ] Add medicine image support
- [ ] Implement prescription validation
- [ ] Add drug interaction checker
- [ ] Support multiple languages
- [ ] Add medicine availability tracking
- [ ] Implement price comparison
- [ ] Add user favorites/bookmarks
- [ ] Export medicine information to PDF

## Support

For issues or questions:
1. Check the server logs for detailed error messages
2. Verify database connection
3. Ensure Ollama is running
4. Check API endpoint responses

## License

This module is part of the Nafes Healthcare Management System.


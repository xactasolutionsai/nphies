# AI Validation Debugging Guide

## 🔍 How to Track AI Requests & Responses

### Server-Side Logging

When you run AI validation, the backend now logs comprehensive information to the console:

#### 1. **Request Tracking**
Look for this in your backend console:
```
🔍 ==> AI VALIDATION REQUEST <==
📅 Timestamp: 2025-11-06T10:30:45.123Z
🤖 Model: cniongolo/biomistral
📋 Patient: Ahmed Mohammed Al-Qahtani, Age: 45
💊 Chief Complaints: Difficulty reading small text, blurred vision at near dist...
📚 Guidelines Retrieved: 3
📝 Prompt Length: 2847 characters
```

#### 2. **Raw AI Response**
The complete, unprocessed response from the model:
```
📥 ==> RAW AI RESPONSE <==
────────────────────────────────────────────────────────────────────────────────
[Complete AI response text here - exactly what the model returned]
────────────────────────────────────────────────────────────────────────────────
⏱️  Response Time: 12.45s
```

#### 3. **Parsed Results**
The structured validation after parsing:
```
✅ ==> PARSED VALIDATION RESULT <==
   Valid: true
   Confidence: 85%
   Warnings: 2
   Recommendations: 4
   Missing Analyses: 1
```

### Frontend Debugging

#### View Raw Response in Modal

1. Submit your form and click "AI Validate"
2. In the validation modal, scroll to the bottom
3. Click on **"Raw AI Response (Debug)"** section
4. You'll see the complete unprocessed AI response in a code-style view

This helps you:
- ✅ Verify the AI is actually responding
- ✅ See if the response format matches expectations
- ✅ Debug parsing issues
- ✅ Understand why certain recommendations appear

### Common Issues & Solutions

#### Issue 1: Generic Recommendations
**Symptom:** You see messages like:
- "AI provided feedback: Check detailed response for insights."
- "AI analysis completed. Please review the raw response in server logs."

**Cause:** The AI's response format doesn't match the expected structure.

**Solution:**
1. Check the **server console** for the raw response
2. Look at the **Raw AI Response (Debug)** section in the modal
3. The AI model might need prompt engineering adjustments in `ollamaService.js`

#### Issue 2: No Response Data
**Symptom:** Empty or missing recommendations/warnings

**Solution:**
1. Check if Ollama is running: `ollama list`
2. Verify the model is pulled: `ollama pull cniongolo/biomistral`
3. Check backend console for connection errors
4. Test Ollama directly: `ollama run cniongolo/biomistral "test"`

#### Issue 3: Timeout Errors
**Symptom:** Request fails with timeout

**Solution:**
1. Increase `OLLAMA_TIMEOUT` in `.env` (default: 120000ms = 2 minutes)
2. Consider using a smaller/faster model for testing
3. Check system resources (CPU/RAM)

### Expected Response Format

The AI should respond in this structure:
```
VALIDITY: Yes/No
CONFIDENCE: 0.85

WARNINGS:
- [field_name]: Warning message - Severity: high/medium/low
- [another_field]: Another warning - Severity: medium

RECOMMENDATIONS:
- Recommendation 1
- Recommendation 2

MISSING_ANALYSES:
- Suggested test 1
- Suggested test 2
```

If the AI doesn't follow this format:
- The system will attempt to extract useful information anyway
- Check the raw response to see what the model actually generated
- You may need to adjust the prompt in `ollamaService.js` → `buildValidationPrompt()`

### Logs Location

**Backend Logs:**
- Console output where you ran `npm run dev`
- Typically: Terminal in your IDE or command prompt

**Frontend Logs:**
- Browser console (F12 → Console tab)
- Network tab (F12 → Network) to see API requests/responses

### Testing the AI Pipeline

#### Quick Test Command
```bash
# In backend directory
cd backend
npm run seed-medical-knowledge  # Ensure RAG data is present
npm run dev                      # Start server

# In another terminal - frontend
cd frontend
npm run dev
```

#### Test Checklist
1. ✅ Ollama running: `ollama ps`
2. ✅ Model pulled: `ollama list | grep biomistral`
3. ✅ Database seeded: Check for medical_knowledge table data
4. ✅ Environment variables set (see `.env.example`)
5. ✅ Backend running on port 5000
6. ✅ Frontend running on port 5173

### Advanced Debugging

#### Enable Verbose Ollama Logging
```bash
# Set this before starting backend
export OLLAMA_DEBUG=1  # Linux/Mac
set OLLAMA_DEBUG=1     # Windows CMD
$env:OLLAMA_DEBUG="1"  # Windows PowerShell
```

#### Database Query to Check RAG Data
```sql
-- Check if medical knowledge is seeded
SELECT COUNT(*) FROM medical_knowledge;

-- View sample documents
SELECT id, source, LEFT(content, 100) as preview 
FROM medical_knowledge 
LIMIT 5;

-- Check AI validation history
SELECT 
  form_id, 
  is_valid, 
  confidence_score,
  validation_timestamp,
  array_length(warnings::json::text::json, 1) as warning_count
FROM ai_validations 
ORDER BY validation_timestamp DESC 
LIMIT 10;
```

#### API Test with cURL
```bash
# Test the validation endpoint directly
curl -X POST http://localhost:5000/api/ai-validation/eye-approval \
  -H "Content-Type: application/json" \
  -d '{
    "age": "45",
    "chief_complaints": "Blurred vision",
    "duration_of_illness_days": "30",
    "insured_name": "Test Patient",
    "provider_name": "Test Provider",
    "insurance_company_name": "Test Insurance",
    "date_of_visit": "2025-11-06",
    "right_eye_specs": {"distance": {"sphere": "-2.00"}},
    "procedures": [{"code": "92015", "service_description": "Eye Exam"}]
  }'
```

### Performance Metrics

Monitor these in the console:
- **Response Time**: How long the AI takes to respond
- **Guidelines Retrieved**: How many RAG documents were found (should be > 0)
- **Confidence Score**: AI's certainty in its assessment (0.0 - 1.0)

### Getting Help

If you're still having issues:
1. Check the raw AI response in both console and modal
2. Verify your prompt engineering in `buildValidationPrompt()`
3. Test the model directly with Ollama CLI
4. Consider trying a different model temporarily for comparison
5. Review the `AI_VALIDATION_README.md` for setup verification

### Model-Specific Notes

#### cniongolo/biomistral
- Medical-focused model
- May require specific prompting style
- Check model documentation for optimal prompt format

#### Switching Models
If the current model isn't working well:
1. Update `OLLAMA_MODEL` in `.env`
2. Pull the new model: `ollama pull model-name`
3. Restart the backend
4. Test and adjust prompts if needed

---

**Remember:** The raw response logging is your best friend for debugging! Always check the backend console first when troubleshooting AI validation issues.


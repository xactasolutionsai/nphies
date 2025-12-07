# NAFES Healthcare Management System
## High-Level Architecture Document

**Version:** 1.0  
**Date:** December 2024  
**Author:** NAFES Development Team

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [System Overview](#system-overview)
3. [Architecture Overview](#architecture-overview)
4. [Core Modules](#core-modules)
5. [NPHIES Integration](#nphies-integration)
6. [Technology Stack Summary](#technology-stack-summary)
7. [Key Business Workflows](#key-business-workflows)

---

## 1. Executive Summary

NAFES (National Automated Financial Exchange System) is a comprehensive healthcare management platform designed for Saudi Arabian healthcare providers. The system integrates with NPHIES (National Platform for Health and Insurance Exchange Services) to facilitate electronic health insurance transactions including eligibility verification, prior authorizations, and claims processing.

### Key Objectives

- Streamline healthcare insurance workflows
- Ensure NPHIES compliance with FHIR R4 standards
- Reduce administrative burden on healthcare providers
- Provide real-time eligibility and authorization processing
- Enable AI-powered medical validation and assistance

---

## 2. System Overview

NAFES is a full-stack web application that serves as an intermediary between healthcare providers and insurance companies through the NPHIES platform. The system handles multiple types of healthcare transactions across various specialties including general medical, dental, vision, and pharmacy services.

### Target Users

- **Healthcare Providers:** Hospitals, clinics, pharmacies, dental offices, optical centers
- **Administrative Staff:** Insurance coordinators, billing specialists
- **Medical Staff:** Physicians, dentists, pharmacists, optometrists

### Key Capabilities

- Patient registration and management
- Insurance eligibility verification
- Prior authorization requests (5 types)
- Claims submission and tracking
- Specialty-specific approval workflows
- AI-powered medical validation
- NPHIES code system management
- Comprehensive reporting and analytics

---

## 3. Architecture Overview

NAFES follows a three-tier architecture pattern:

```
┌─────────────────────────────────────────────────────────────────┐
│                        PRESENTATION TIER                         │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                    React Frontend (SPA)                      │ │
│  │  • Dashboard & Analytics                                     │ │
│  │  • Patient/Provider/Insurer Management                       │ │
│  │  • Prior Authorization Forms (5 types)                       │ │
│  │  • Eligibility Verification                                  │ │
│  │  • Claims Management                                         │ │
│  │  • Specialty Approvals (Dental, Vision, Standard)            │ │
│  │  • AI Medical Assistant                                      │ │
│  └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ REST API (HTTP/JSON)
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        APPLICATION TIER                          │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                 Node.js/Express Backend                      │ │
│  │                                                               │ │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │ │
│  │  │ Controllers │  │  Services   │  │   Mappers   │          │ │
│  │  │ (21 files)  │  │ (21 files)  │  │  (7 files)  │          │ │
│  │  └─────────────┘  └─────────────┘  └─────────────┘          │ │
│  │         │                │                │                   │ │
│  │         └────────────────┼────────────────┘                   │ │
│  │                          │                                    │ │
│  │  ┌─────────────────────────────────────────────────────────┐ │ │
│  │  │              NPHIES FHIR R4 Integration                  │ │ │
│  │  │  • Bundle/MessageHeader construction                     │ │ │
│  │  │  • Claim/ClaimResponse mapping                           │ │ │
│  │  │  • CoverageEligibilityRequest/Response                   │ │ │
│  │  └─────────────────────────────────────────────────────────┘ │ │
│  │                                                               │ │
│  │  ┌─────────────────────────────────────────────────────────┐ │ │
│  │  │                   AI/ML Services                         │ │ │
│  │  │  • Ollama (BioMistral) for medical validation            │ │ │
│  │  │  • LangChain RAG for knowledge retrieval                 │ │ │
│  │  │  • Medical chatbot assistance                            │ │ │
│  │  └─────────────────────────────────────────────────────────┘ │ │
│  └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ SQL / Vector Search
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                          DATA TIER                               │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                 PostgreSQL Database                          │ │
│  │                                                               │ │
│  │  • 34 Tables across multiple domains                         │ │
│  │  • pgvector extension for AI embeddings                      │ │
│  │  • uuid-ossp for UUID generation                             │ │
│  │  • JSONB for FHIR bundle storage                             │ │
│  └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTPS/FHIR R4
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      EXTERNAL SYSTEMS                            │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                    NPHIES Platform                           │ │
│  │  • Eligibility verification                                  │ │
│  │  • Prior authorization processing                            │ │
│  │  • Claims adjudication                                       │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                   Ollama AI Server                           │ │
│  │  • BioMistral medical language model                         │ │
│  │  • Local inference for privacy                               │ │
│  └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. Core Modules

### 4.1 Prior Authorization Module

The Prior Authorization module is the central feature of NAFES, supporting five distinct authorization types as defined by NPHIES:

| Type | Description | Use Case |
|------|-------------|----------|
| **Professional** | Outpatient professional services | Consultations, procedures, lab tests |
| **Institutional** | Inpatient hospital services | Admissions, surgeries, extended care |
| **Dental (Oral)** | Dental and oral health services | Dental procedures, orthodontics |
| **Vision** | Eye care and optical services | Eye exams, glasses, contact lenses |
| **Pharmacy** | Medication dispensing | Prescription drugs, specialty medications |

**Key Features:**
- FHIR R4 compliant Claim resource generation
- Support for diagnoses (ICD-10), procedures, and service codes
- Encounter management with class types (ambulatory, inpatient, emergency)
- Supporting information (vital signs, clinical data, attachments)
- Real-time NPHIES submission and response handling
- Approval status tracking and history

### 4.2 Eligibility Module

Verifies patient insurance coverage before services are rendered.

**Key Features:**
- Real-time eligibility checks via NPHIES
- Coverage period validation
- Benefit details retrieval
- Transfer eligibility support
- Offline eligibility reference handling

### 4.3 Claims Module

Manages healthcare claims submission and tracking.

**Key Features:**
- Individual claim creation
- Batch claim processing
- Claim status tracking
- Payment reconciliation

### 4.4 Dental Approvals Module

Specialized workflow for dental services.

**Key Features:**
- Dental procedure coding (CDT codes)
- Tooth number and surface tracking
- Dental-specific medications
- Odontogram integration

### 4.5 Eye/Vision Approvals Module

Specialized workflow for vision services.

**Key Features:**
- Vision prescription management
- Eye-specific procedure codes
- Lens specifications (sphere, cylinder, axis)
- Right/left eye differentiation

### 4.6 Standard Approvals Module

General approval management for various healthcare services.

**Key Features:**
- Flexible approval workflows
- Management item tracking
- Medication approvals
- Multi-purpose form handling

### 4.7 General Requests Module

Handles miscellaneous healthcare requests.

**Key Features:**
- Generic request handling
- AI-powered validation
- Flexible data structure

### 4.8 Patient Management Module

Comprehensive patient registration and management.

**Key Features:**
- Patient demographics (NPHIES compliant)
- Multiple identifier types (National ID, Iqama, Passport)
- Insurance coverage linking
- Contact information management

### 4.9 Provider Management Module

Healthcare provider registration and management.

**Key Features:**
- Provider licensing (NPHIES ID)
- Provider type classification
- Location and contact management
- Department tracking

### 4.10 Insurer Management Module

Insurance company management.

**Key Features:**
- Insurer registration
- NPHIES payer ID mapping
- Plan type management
- Contact information

### 4.11 Medicine Management Module

Comprehensive drug database and safety features.

**Key Features:**
- Medicine database with GTIN codes
- Brand and generic name mapping
- Multiple code systems (MOH, NHIC, NUPCO)
- Drug interaction checking
- Medication safety alerts

### 4.12 AI Validation Module

AI-powered medical validation and assistance.

**Key Features:**
- Medical request validation
- Diagnosis-procedure matching
- Clinical guideline compliance
- Automated recommendations

### 4.13 Medical Chatbot Module

AI-powered conversational assistant.

**Key Features:**
- Medical knowledge retrieval (RAG)
- Natural language queries
- Context-aware responses
- Medical guideline references

---

## 5. NPHIES Integration

### 5.1 Overview

NAFES integrates with NPHIES using the HL7 FHIR R4 standard. All transactions are formatted as FHIR Bundles containing appropriate resources.

### 5.2 Supported FHIR Resources

| Resource | Usage |
|----------|-------|
| Bundle | Container for all transactions |
| MessageHeader | Transaction metadata and routing |
| Claim | Prior authorization and claim requests |
| ClaimResponse | Authorization and adjudication responses |
| CoverageEligibilityRequest | Eligibility verification requests |
| CoverageEligibilityResponse | Eligibility verification responses |
| Patient | Patient demographics |
| Coverage | Insurance coverage details |
| Organization | Provider and insurer information |
| Practitioner | Healthcare practitioner details |
| Encounter | Service encounter context |
| Location | Service location |

### 5.3 NPHIES Profiles Supported

- `institutional-priorauth` - Institutional prior authorization
- `professional-priorauth` - Professional prior authorization
- `oral-priorauth` - Dental/oral prior authorization
- `vision-priorauth` - Vision prior authorization
- `pharmacy-priorauth` - Pharmacy prior authorization
- `eligibility-request` - Eligibility verification

### 5.4 Code Systems

NAFES maintains comprehensive NPHIES code system support:

- Claim types and subtypes
- Diagnosis codes (ICD-10)
- Procedure codes (CPT, HCPCS, CDT)
- Medication codes (GTIN, SFDA)
- Service codes
- Adjudication outcomes
- Error codes

---

## 6. Technology Stack Summary

### Frontend
- **Framework:** React 18.2
- **Build Tool:** Vite 4.5
- **Styling:** TailwindCSS 3.3
- **State Management:** React Hook Form
- **Routing:** React Router DOM 6.20
- **Charts:** Recharts 2.8

### Backend
- **Runtime:** Node.js 18+
- **Framework:** Express.js 4.18
- **Database Driver:** pg 8.11
- **Validation:** Joi 17.11
- **Security:** Helmet, CORS, Rate Limiting

### Database
- **DBMS:** PostgreSQL 14+
- **Extensions:** pgvector, uuid-ossp
- **Data Types:** JSONB for FHIR bundles

### AI/ML
- **LLM:** Ollama with BioMistral
- **RAG:** LangChain
- **Embeddings:** pgvector

### External Integration
- **Protocol:** HTTPS
- **Format:** FHIR R4 JSON
- **Platform:** NPHIES

---

## 7. Key Business Workflows

### 7.1 Eligibility Verification Workflow

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  Select  │───▶│  Build   │───▶│  Submit  │───▶│ Process  │
│  Patient │    │ Request  │    │ to NPHIES│    │ Response │
└──────────┘    └──────────┘    └──────────┘    └──────────┘
                                                      │
                                                      ▼
                                               ┌──────────┐
                                               │  Display │
                                               │ Benefits │
                                               └──────────┘
```

### 7.2 Prior Authorization Workflow

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  Create  │───▶│   Add    │───▶│   Add    │───▶│  Review  │
│  Request │    │ Diagnoses│    │  Items   │    │  & Save  │
└──────────┘    └──────────┘    └──────────┘    └──────────┘
                                                      │
                                                      ▼
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  Track   │◀───│  Update  │◀───│ Process  │◀───│  Submit  │
│  Status  │    │  Status  │    │ Response │    │ to NPHIES│
└──────────┘    └──────────┘    └──────────┘    └──────────┘
```

### 7.3 Claims Processing Workflow

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  Create  │───▶│   Link   │───▶│  Submit  │───▶│ Receive  │
│  Claim   │    │ Prior Auth│   │  Claim   │    │ Response │
└──────────┘    └──────────┘    └──────────┘    └──────────┘
                                                      │
                                                      ▼
                                               ┌──────────┐
                                               │  Payment │
                                               │ Tracking │
                                               └──────────┘
```

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | December 2024 | NAFES Team | Initial document |

---

*This document provides a high-level overview of the NAFES Healthcare Management System. For detailed technical specifications, refer to the Technical Specification Document.*


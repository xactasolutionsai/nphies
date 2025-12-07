# NAFES Healthcare Management System
## Database Schema Document

**Version:** 1.0  
**Date:** December 2024  
**Author:** NAFES Development Team

---

## Table of Contents

1. [Overview](#1-overview)
2. [Database Configuration](#2-database-configuration)
3. [Schema Summary](#3-schema-summary)
4. [Core Entity Tables](#4-core-entity-tables)
5. [Prior Authorization Tables](#5-prior-authorization-tables)
6. [Eligibility Tables](#6-eligibility-tables)
7. [Claims Tables](#7-claims-tables)
8. [Specialty Approval Tables](#8-specialty-approval-tables)
9. [Reference Data Tables](#9-reference-data-tables)
10. [AI/Knowledge Tables](#10-aiknowledge-tables)
11. [Other Tables](#11-other-tables)
12. [Entity Relationships](#12-entity-relationships)

---

## 1. Overview

The NAFES database is built on PostgreSQL and serves as the central data store for all healthcare management operations. The schema is designed to support NPHIES FHIR R4 compliance while maintaining efficient relational data structures.

### Key Design Principles

- **UUID Primary Keys:** Most tables use UUID for distributed system compatibility
- **JSONB Storage:** FHIR bundles stored as JSONB for flexibility
- **Audit Timestamps:** `created_at` and `updated_at` on all tables
- **Soft References:** Foreign keys to support data integrity
- **NPHIES Compliance:** Fields aligned with NPHIES data requirements

---

## 2. Database Configuration

### PostgreSQL Version
- **Minimum:** PostgreSQL 14
- **Recommended:** PostgreSQL 15+

### Extensions Required

```sql
-- UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Vector similarity search for AI
CREATE EXTENSION IF NOT EXISTS "vector";
```

### Connection Settings

| Parameter | Value |
|-----------|-------|
| Host | localhost (configurable) |
| Port | 5432 |
| Database | nafes |
| Max Connections | 20 |
| Idle Timeout | 30000ms |
| Connection Timeout | 2000ms |

---

## 3. Schema Summary

### Tables by Domain

| Domain | Table Count | Description |
|--------|-------------|-------------|
| Core Entities | 5 | Patients, Providers, Insurers, Coverage, Policy Holders |
| Prior Authorization | 6 | Main records, Items, Diagnoses, Supporting Info, Attachments, Responses |
| Eligibility | 2 | Eligibility requests and benefit details |
| Claims | 2 | Individual claims and batch processing |
| Dental Approvals | 3 | Dental-specific approval workflows |
| Eye/Vision Approvals | 2 | Vision-specific approval workflows |
| Standard Approvals | 3 | General approval management |
| General Requests | 1 | Miscellaneous healthcare requests |
| Reference Data | 5 | NPHIES codes, medicines, brands, codes |
| AI/Knowledge | 3 | Medical knowledge base and AI validations |
| Other | 2 | Authorizations and payments |
| **Total** | **34** | |

### Complete Table List

| # | Table Name | Columns | Primary Key Type |
|---|------------|---------|------------------|
| 1 | patients | 21 | UUID |
| 2 | providers | 14 | UUID |
| 3 | insurers | 11 | UUID |
| 4 | patient_coverage | 24 | UUID |
| 5 | policy_holders | 12 | UUID |
| 6 | prior_authorizations | 62 | INTEGER |
| 7 | prior_authorization_items | 31 | INTEGER |
| 8 | prior_authorization_diagnoses | 9 | INTEGER |
| 9 | prior_authorization_supporting_info | 22 | INTEGER |
| 10 | prior_authorization_attachments | 12 | INTEGER |
| 11 | prior_authorization_responses | 12 | INTEGER |
| 12 | eligibility | 27 | UUID |
| 13 | eligibility_benefits | 15 | UUID |
| 14 | claims | 9 | UUID |
| 15 | claims_batch | 7 | INTEGER |
| 16 | dental_approvals | 44 | INTEGER |
| 17 | dental_procedures | 7 | INTEGER |
| 18 | dental_medications | 6 | INTEGER |
| 19 | eye_approvals | 39 | INTEGER |
| 20 | eye_procedures | 7 | INTEGER |
| 21 | standard_approvals_claims | 74 | INTEGER |
| 22 | standard_approvals_management_items | 8 | INTEGER |
| 23 | standard_approvals_medications | 6 | INTEGER |
| 24 | general_requests | 25 | INTEGER |
| 25 | nphies_codes | 10 | INTEGER |
| 26 | nphies_code_systems | 8 | INTEGER |
| 27 | medicines | 10 | INTEGER |
| 28 | medicine_brands | 6 | INTEGER |
| 29 | medicine_codes | 5 | INTEGER |
| 30 | medical_knowledge | 8 | INTEGER |
| 31 | ai_validations | 14 | INTEGER |
| 32 | medical_exams | 2 | INTEGER |
| 33 | authorizations | 8 | INTEGER |
| 34 | payments | 7 | INTEGER |

---

## 4. Core Entity Tables

### 4.1 patients

Stores patient demographic and identification information.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| patient_id | UUID | NO | gen_random_uuid() | Primary key |
| name | VARCHAR(255) | NO | | Full name |
| name_ar | VARCHAR(255) | YES | | Arabic name |
| identifier | VARCHAR(100) | NO | | National ID/Iqama/Passport |
| identifier_type | VARCHAR(20) | YES | 'national_id' | Type of identifier |
| identifier_system | VARCHAR(255) | YES | | NPHIES identifier system |
| gender | VARCHAR(10) | YES | | male/female |
| birth_date | DATE | YES | | Date of birth |
| phone | VARCHAR(20) | YES | | Contact phone |
| email | VARCHAR(255) | YES | | Email address |
| address_line | VARCHAR(255) | YES | | Street address |
| address_city | VARCHAR(100) | YES | | City |
| address_district | VARCHAR(100) | YES | | District |
| address_state | VARCHAR(100) | YES | | State/Province |
| address_postal_code | VARCHAR(20) | YES | | Postal code |
| address_country | VARCHAR(2) | YES | 'SA' | Country code |
| marital_status | VARCHAR(20) | YES | | Marital status |
| nationality | VARCHAR(2) | YES | | Nationality code |
| is_active | BOOLEAN | YES | true | Active status |
| created_at | TIMESTAMP | YES | CURRENT_TIMESTAMP | Creation time |
| updated_at | TIMESTAMP | YES | CURRENT_TIMESTAMP | Last update time |

### 4.2 providers

Stores healthcare provider organization information.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| provider_id | UUID | NO | gen_random_uuid() | Primary key |
| name | VARCHAR(255) | NO | | Organization name |
| name_ar | VARCHAR(255) | YES | | Arabic name |
| nphies_id | VARCHAR(100) | NO | | NPHIES provider ID |
| license_number | VARCHAR(100) | YES | | License number |
| provider_type | VARCHAR(50) | YES | | Type of provider |
| phone | VARCHAR(20) | YES | | Contact phone |
| email | VARCHAR(255) | YES | | Email address |
| address_line | VARCHAR(255) | YES | | Street address |
| address_city | VARCHAR(100) | YES | | City |
| address_country | VARCHAR(2) | YES | 'SA' | Country code |
| is_active | BOOLEAN | YES | true | Active status |
| created_at | TIMESTAMP | YES | CURRENT_TIMESTAMP | Creation time |
| updated_at | TIMESTAMP | YES | CURRENT_TIMESTAMP | Last update time |

### 4.3 insurers

Stores insurance company information.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| insurer_id | UUID | NO | gen_random_uuid() | Primary key |
| name | VARCHAR(255) | NO | | Company name |
| name_ar | VARCHAR(255) | YES | | Arabic name |
| nphies_id | VARCHAR(100) | NO | | NPHIES payer ID |
| license_number | VARCHAR(100) | YES | | License number |
| organization_type | VARCHAR(50) | YES | | Organization type |
| phone | VARCHAR(20) | YES | | Contact phone |
| email | VARCHAR(255) | YES | | Email address |
| is_active | BOOLEAN | YES | true | Active status |
| created_at | TIMESTAMP | YES | CURRENT_TIMESTAMP | Creation time |
| updated_at | TIMESTAMP | YES | CURRENT_TIMESTAMP | Last update time |

### 4.4 patient_coverage

Links patients to their insurance coverage.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| coverage_id | UUID | NO | gen_random_uuid() | Primary key |
| patient_id | UUID | YES | | FK to patients |
| insurer_id | UUID | YES | | FK to insurers |
| policy_number | VARCHAR(100) | NO | | Insurance policy number |
| member_id | VARCHAR(100) | YES | | Member ID |
| coverage_type | VARCHAR(50) | YES | 'EHCPOL' | Coverage type code |
| relationship | VARCHAR(20) | YES | 'self' | Subscriber relationship |
| dependent_number | VARCHAR(10) | YES | | Dependent number |
| subscriber_id | VARCHAR(100) | YES | | Subscriber ID |
| dependent | VARCHAR(10) | YES | | Dependent indicator |
| plan_name | VARCHAR(255) | YES | | Plan name |
| network_type | VARCHAR(50) | YES | | Network type |
| network | VARCHAR(100) | YES | | Network code |
| class_code | VARCHAR(50) | YES | | Class code |
| class_name | VARCHAR(255) | YES | | Class name |
| start_date | DATE | YES | | Coverage start |
| end_date | DATE | YES | | Coverage end |
| period_start | DATE | YES | | Period start |
| period_end | DATE | YES | | Period end |
| is_active | BOOLEAN | YES | true | Active status |
| nphies_coverage_id | VARCHAR(100) | YES | | NPHIES coverage ID |
| policy_holder_id | UUID | YES | | FK to policy_holders |
| created_at | TIMESTAMP | YES | CURRENT_TIMESTAMP | Creation time |
| updated_at | TIMESTAMP | YES | CURRENT_TIMESTAMP | Last update time |

### 4.5 policy_holders

Stores policy holder information (when different from patient).

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| policy_holder_id | UUID | NO | gen_random_uuid() | Primary key |
| name | VARCHAR(255) | NO | | Full name |
| identifier | VARCHAR(100) | NO | | Identifier |
| identifier_type | VARCHAR(20) | YES | | Identifier type |
| identifier_system | VARCHAR(255) | YES | | Identifier system |
| gender | VARCHAR(10) | YES | | Gender |
| birth_date | DATE | YES | | Date of birth |
| phone | VARCHAR(20) | YES | | Contact phone |
| email | VARCHAR(255) | YES | | Email address |
| relationship | VARCHAR(20) | YES | | Relationship to patient |
| created_at | TIMESTAMP | YES | CURRENT_TIMESTAMP | Creation time |
| updated_at | TIMESTAMP | YES | CURRENT_TIMESTAMP | Last update time |

---

## 5. Prior Authorization Tables

### 5.1 prior_authorizations

Main prior authorization request records (62 columns).

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | INTEGER | NO | SERIAL | Primary key |
| patient_id | UUID | NO | | FK to patients |
| provider_id | UUID | NO | | FK to providers |
| insurer_id | UUID | NO | | FK to insurers |
| coverage_id | UUID | YES | | FK to patient_coverage |
| auth_type | VARCHAR(20) | NO | 'professional' | Authorization type |
| sub_type | VARCHAR(20) | YES | | Claim sub-type |
| priority | VARCHAR(20) | YES | 'normal' | Process priority |
| status | VARCHAR(20) | YES | 'draft' | Request status |
| outcome | VARCHAR(20) | YES | | NPHIES outcome |
| adjudication_outcome | VARCHAR(50) | YES | | Adjudication result |
| disposition | TEXT | YES | | Disposition message |
| pre_auth_ref | VARCHAR(100) | YES | | Pre-auth reference number |
| pre_auth_period_start | DATE | YES | | Approval period start |
| pre_auth_period_end | DATE | YES | | Approval period end |
| nphies_response_id | VARCHAR(100) | YES | | NPHIES response ID |
| nphies_message_id | VARCHAR(255) | YES | | Message header ID |
| nphies_response_code | VARCHAR(50) | YES | | Response code |
| original_request_identifier | VARCHAR(255) | YES | | Original request ID |
| is_nphies_generated | BOOLEAN | YES | false | NPHIES generated flag |
| encounter_class | VARCHAR(20) | YES | | Encounter class |
| encounter_period_start | TIMESTAMP | YES | | Encounter start |
| encounter_period_end | TIMESTAMP | YES | | Encounter end |
| encounter_service_type | VARCHAR(50) | YES | | Service type |
| practitioner_id | VARCHAR(100) | YES | | Practitioner ID |
| practitioner_name | VARCHAR(255) | YES | | Practitioner name |
| practitioner_role | VARCHAR(50) | YES | | Practitioner role |
| practitioner_specialty | VARCHAR(50) | YES | | Specialty code |
| total_amount | NUMERIC | YES | | Total claim amount |
| currency | VARCHAR(3) | YES | 'SAR' | Currency code |
| approved_amount | NUMERIC | YES | | Approved amount |
| eligible_amount | NUMERIC | YES | | Eligible amount |
| benefit_amount | NUMERIC | YES | | Benefit amount |
| copay_amount | NUMERIC | YES | | Copay amount |
| insurance_sequence | INTEGER | YES | | Insurance sequence |
| insurance_focal | BOOLEAN | YES | | Insurance focal |
| claim_response_status | VARCHAR(50) | YES | | Response status |
| claim_response_use | VARCHAR(50) | YES | | Response use |
| claim_response_created | DATE | YES | | Response created date |
| eligibility_ref | VARCHAR(255) | YES | | Eligibility reference |
| transfer_auth_number | VARCHAR(100) | YES | | Transfer auth number |
| transfer_provider_id | VARCHAR(100) | YES | | Transfer provider |
| transfer_period_start | DATE | YES | | Transfer period start |
| transfer_period_end | DATE | YES | | Transfer period end |
| vital_signs | JSONB | YES | | Vital signs data |
| clinical_info | JSONB | YES | | Clinical information |
| admission_info | JSONB | YES | | Admission details |
| request_bundle | JSONB | YES | | FHIR request bundle |
| response_bundle | JSONB | YES | | FHIR response bundle |
| response_date | TIMESTAMP | YES | | Response received date |
| notes | TEXT | YES | | Internal notes |
| created_at | TIMESTAMP | YES | CURRENT_TIMESTAMP | Creation time |
| updated_at | TIMESTAMP | YES | CURRENT_TIMESTAMP | Last update time |
| *...additional columns* | | | | |

### 5.2 prior_authorization_items

Line items within a prior authorization (31 columns).

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | INTEGER | NO | SERIAL | Primary key |
| prior_auth_id | INTEGER | NO | | FK to prior_authorizations |
| sequence | INTEGER | NO | | Item sequence number |
| product_or_service_code | VARCHAR(50) | NO | | Service/procedure code |
| product_or_service_system | VARCHAR(255) | YES | | Code system URI |
| product_or_service_display | VARCHAR(255) | YES | | Display name |
| tooth_number | VARCHAR(10) | YES | | Dental tooth number |
| tooth_surface | VARCHAR(50) | YES | | Dental tooth surface |
| eye | VARCHAR(10) | YES | | Vision: left/right eye |
| medication_code | VARCHAR(50) | YES | | Medication GTIN code |
| medication_system | VARCHAR(255) | YES | | Medication code system |
| days_supply | INTEGER | YES | | Pharmacy days supply |
| quantity | NUMERIC | YES | 1 | Item quantity |
| unit_price | NUMERIC | YES | | Unit price |
| net_amount | NUMERIC | YES | | Net amount |
| currency | VARCHAR(3) | YES | 'SAR' | Currency code |
| serviced_date | DATE | YES | | Service date |
| serviced_period_start | DATE | YES | | Service period start |
| serviced_period_end | DATE | YES | | Service period end |
| body_site_code | VARCHAR(50) | YES | | Body site code |
| body_site_system | VARCHAR(255) | YES | | Body site system |
| sub_site_code | VARCHAR(50) | YES | | Sub-site code |
| description | TEXT | YES | | Item description |
| notes | TEXT | YES | | Item notes |
| adjudication_status | VARCHAR(20) | YES | | Item adjudication status |
| adjudication_amount | NUMERIC | YES | | Adjudicated amount |
| adjudication_reason | TEXT | YES | | Adjudication reason |
| adjudication_eligible_amount | NUMERIC | YES | | Eligible amount |
| adjudication_copay_amount | NUMERIC | YES | | Copay amount |
| adjudication_approved_quantity | NUMERIC | YES | | Approved quantity |
| created_at | TIMESTAMP | YES | CURRENT_TIMESTAMP | Creation time |

### 5.3 prior_authorization_diagnoses

Diagnosis codes associated with prior authorizations.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | INTEGER | NO | SERIAL | Primary key |
| prior_auth_id | INTEGER | NO | | FK to prior_authorizations |
| sequence | INTEGER | NO | | Diagnosis sequence |
| diagnosis_code | VARCHAR(50) | NO | | ICD-10 code |
| diagnosis_system | VARCHAR(255) | YES | 'http://hl7.org/fhir/sid/icd-10' | Code system |
| diagnosis_display | VARCHAR(255) | YES | | Display name |
| diagnosis_type | VARCHAR(20) | YES | 'principal' | principal/secondary |
| on_admission | BOOLEAN | YES | | Present on admission |
| created_at | TIMESTAMP | YES | CURRENT_TIMESTAMP | Creation time |

### 5.4 prior_authorization_supporting_info

Supporting information for prior authorizations (22 columns).

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | INTEGER | NO | SERIAL | Primary key |
| prior_auth_id | INTEGER | NO | | FK to prior_authorizations |
| sequence | INTEGER | NO | | Info sequence |
| category | VARCHAR(50) | NO | | Category code |
| category_system | VARCHAR(255) | YES | | Category system |
| code | VARCHAR(50) | YES | | Value code |
| code_system | VARCHAR(255) | YES | | Code system |
| code_display | VARCHAR(255) | YES | | Code display |
| value_string | TEXT | YES | | String value |
| value_quantity | NUMERIC | YES | | Quantity value |
| value_quantity_unit | VARCHAR(50) | YES | | Quantity unit |
| value_boolean | BOOLEAN | YES | | Boolean value |
| value_date | DATE | YES | | Date value |
| value_period_start | DATE | YES | | Period start |
| value_period_end | DATE | YES | | Period end |
| value_reference | VARCHAR(255) | YES | | Reference value |
| timing_date | DATE | YES | | Timing date |
| timing_period_start | DATE | YES | | Timing period start |
| timing_period_end | DATE | YES | | Timing period end |
| reason_code | VARCHAR(50) | YES | | Reason code |
| reason_system | VARCHAR(255) | YES | | Reason system |
| created_at | TIMESTAMP | YES | CURRENT_TIMESTAMP | Creation time |

### 5.5 prior_authorization_attachments

File attachments for prior authorizations.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | INTEGER | NO | SERIAL | Primary key |
| prior_auth_id | INTEGER | NO | | FK to prior_authorizations |
| supporting_info_id | INTEGER | YES | | FK to supporting_info |
| file_name | VARCHAR(255) | NO | | Original filename |
| content_type | VARCHAR(100) | NO | | MIME type |
| file_size | INTEGER | YES | | File size in bytes |
| base64_content | TEXT | NO | | Base64 encoded content |
| title | VARCHAR(255) | YES | | Attachment title |
| description | TEXT | YES | | Attachment description |
| category | VARCHAR(50) | YES | | Attachment category |
| binary_id | VARCHAR(100) | YES | | FHIR Binary ID |
| created_at | TIMESTAMP | YES | CURRENT_TIMESTAMP | Creation time |

### 5.6 prior_authorization_responses

Stores NPHIES response history.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | INTEGER | NO | SERIAL | Primary key |
| prior_auth_id | INTEGER | NO | | FK to prior_authorizations |
| response_type | VARCHAR(20) | NO | | Response type |
| outcome | VARCHAR(20) | YES | | Outcome code |
| disposition | TEXT | YES | | Disposition message |
| pre_auth_ref | VARCHAR(100) | YES | | Pre-auth reference |
| bundle_json | JSONB | NO | | Full FHIR bundle |
| has_errors | BOOLEAN | YES | false | Error flag |
| errors | JSONB | YES | | Error details |
| is_nphies_generated | BOOLEAN | YES | false | NPHIES generated |
| nphies_response_id | VARCHAR(100) | YES | | NPHIES response ID |
| received_at | TIMESTAMP | YES | CURRENT_TIMESTAMP | Received time |

---

## 6. Eligibility Tables

### 6.1 eligibility

Eligibility verification requests (27 columns).

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| eligibility_id | UUID | NO | gen_random_uuid() | Primary key |
| patient_id | UUID | YES | | FK to patients |
| provider_id | UUID | YES | | FK to providers |
| insurer_id | UUID | YES | | FK to insurers |
| coverage_id | UUID | YES | | FK to patient_coverage |
| service_date | DATE | YES | | Service date |
| purpose | VARCHAR(50) | YES | 'benefits' | Request purpose |
| status | VARCHAR(20) | YES | 'pending' | Request status |
| outcome | VARCHAR(20) | YES | | Response outcome |
| disposition | TEXT | YES | | Disposition message |
| in_force | BOOLEAN | YES | | Coverage in force |
| benefit_period_start | DATE | YES | | Benefit period start |
| benefit_period_end | DATE | YES | | Benefit period end |
| request_bundle | JSONB | YES | | FHIR request bundle |
| response_bundle | JSONB | YES | | FHIR response bundle |
| nphies_response_id | VARCHAR(100) | YES | | NPHIES response ID |
| is_nphies_generated | BOOLEAN | YES | false | NPHIES generated |
| response_date | TIMESTAMP | YES | | Response date |
| notes | TEXT | YES | | Notes |
| created_at | TIMESTAMP | YES | CURRENT_TIMESTAMP | Creation time |
| updated_at | TIMESTAMP | YES | CURRENT_TIMESTAMP | Last update time |
| *...additional columns* | | | | |

### 6.2 eligibility_benefits

Benefit details from eligibility responses.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| benefit_id | UUID | NO | gen_random_uuid() | Primary key |
| eligibility_id | UUID | YES | | FK to eligibility |
| category | VARCHAR(100) | YES | | Benefit category |
| network | VARCHAR(50) | YES | | Network type |
| unit | VARCHAR(50) | YES | | Unit of measure |
| term | VARCHAR(50) | YES | | Term period |
| benefit_type | VARCHAR(100) | YES | | Benefit type |
| allowed_value | NUMERIC | YES | | Allowed amount |
| allowed_currency | VARCHAR(3) | YES | 'SAR' | Currency |
| used_value | NUMERIC | YES | | Used amount |
| used_currency | VARCHAR(3) | YES | 'SAR' | Currency |
| excluded | BOOLEAN | YES | false | Excluded flag |
| name | VARCHAR(255) | YES | | Benefit name |
| description | TEXT | YES | | Description |
| created_at | TIMESTAMP | YES | CURRENT_TIMESTAMP | Creation time |

---

## 7. Claims Tables

### 7.1 claims

Individual claim records.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| claim_id | UUID | NO | gen_random_uuid() | Primary key |
| patient_id | UUID | YES | | FK to patients |
| provider_id | UUID | YES | | FK to providers |
| insurer_id | UUID | YES | | FK to insurers |
| prior_auth_id | INTEGER | YES | | FK to prior_authorizations |
| claim_type | VARCHAR(20) | YES | | Claim type |
| status | VARCHAR(20) | YES | 'draft' | Claim status |
| created_at | TIMESTAMP | YES | CURRENT_TIMESTAMP | Creation time |
| updated_at | TIMESTAMP | YES | CURRENT_TIMESTAMP | Last update time |

### 7.2 claims_batch

Batch claim processing records.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | INTEGER | NO | SERIAL | Primary key |
| batch_name | VARCHAR(255) | YES | | Batch name |
| status | VARCHAR(20) | YES | 'pending' | Batch status |
| total_claims | INTEGER | YES | | Total claims count |
| processed_claims | INTEGER | YES | 0 | Processed count |
| created_at | TIMESTAMP | YES | CURRENT_TIMESTAMP | Creation time |
| updated_at | TIMESTAMP | YES | CURRENT_TIMESTAMP | Last update time |

---

## 8. Specialty Approval Tables

### 8.1 dental_approvals (44 columns)

Dental-specific approval records including patient info, dental-specific fields, and NPHIES integration data.

**Key columns:** id, patient_name, patient_id_number, insurer_id, provider_id, diagnosis_code, treatment_plan, tooth_numbers, surfaces, status, nphies_response, created_at

### 8.2 dental_procedures (7 columns)

Dental procedure line items linked to dental_approvals.

### 8.3 dental_medications (6 columns)

Medications prescribed in dental approvals.

### 8.4 eye_approvals (39 columns)

Vision-specific approval records including patient info, prescription data (sphere, cylinder, axis), and NPHIES integration.

**Key columns:** id, patient_name, patient_id_number, insurer_id, provider_id, diagnosis_code, right_eye_sphere, left_eye_sphere, lens_type, status, nphies_response, created_at

### 8.5 eye_procedures (7 columns)

Vision procedure line items linked to eye_approvals.

### 8.6 standard_approvals_claims (74 columns)

General approval records with comprehensive fields for various healthcare services.

### 8.7 standard_approvals_management_items (8 columns)

Management items linked to standard approvals.

### 8.8 standard_approvals_medications (6 columns)

Medications linked to standard approvals.

### 8.9 general_requests (25 columns)

Generic healthcare request records with flexible data structure.

---

## 9. Reference Data Tables

### 9.1 nphies_codes

NPHIES code values for various code systems.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | INTEGER | NO | SERIAL | Primary key |
| code_system_id | INTEGER | YES | | FK to nphies_code_systems |
| code | VARCHAR(50) | NO | | Code value |
| display | VARCHAR(255) | YES | | Display name |
| display_ar | VARCHAR(255) | YES | | Arabic display |
| definition | TEXT | YES | | Code definition |
| is_active | BOOLEAN | YES | true | Active status |
| parent_code | VARCHAR(50) | YES | | Parent code |
| sort_order | INTEGER | YES | | Sort order |
| created_at | TIMESTAMP | YES | CURRENT_TIMESTAMP | Creation time |

### 9.2 nphies_code_systems

NPHIES code system definitions.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | INTEGER | NO | SERIAL | Primary key |
| system_url | VARCHAR(255) | NO | | Code system URL |
| name | VARCHAR(100) | NO | | System name |
| title | VARCHAR(255) | YES | | System title |
| description | TEXT | YES | | Description |
| version | VARCHAR(20) | YES | | Version |
| is_active | BOOLEAN | YES | true | Active status |
| created_at | TIMESTAMP | YES | CURRENT_TIMESTAMP | Creation time |

### 9.3 medicines

Medicine database.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | INTEGER | NO | SERIAL | Primary key |
| trade_name | VARCHAR(255) | NO | | Trade name |
| generic_name | VARCHAR(255) | YES | | Generic name |
| strength | VARCHAR(100) | YES | | Strength |
| form | VARCHAR(100) | YES | | Dosage form |
| route | VARCHAR(100) | YES | | Route of administration |
| manufacturer | VARCHAR(255) | YES | | Manufacturer |
| atc_code | VARCHAR(20) | YES | | ATC code |
| is_active | BOOLEAN | YES | true | Active status |
| created_at | TIMESTAMP | YES | CURRENT_TIMESTAMP | Creation time |

### 9.4 medicine_brands (6 columns)

Brand name variations for medicines.

### 9.5 medicine_codes (5 columns)

Various code systems for medicines (GTIN, SFDA, MOH, etc.).

---

## 10. AI/Knowledge Tables

### 10.1 medical_knowledge

RAG knowledge base with vector embeddings.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | INTEGER | NO | SERIAL | Primary key |
| content | TEXT | NO | | Knowledge content |
| embedding | VECTOR(384) | YES | | Vector embedding |
| category | VARCHAR(100) | YES | | Content category |
| source | VARCHAR(255) | YES | | Content source |
| title | VARCHAR(255) | YES | | Content title |
| metadata | JSONB | YES | | Additional metadata |
| created_at | TIMESTAMP | YES | CURRENT_TIMESTAMP | Creation time |

### 10.2 ai_validations

AI validation request logs.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | INTEGER | NO | SERIAL | Primary key |
| request_type | VARCHAR(50) | YES | | Type of request |
| request_data | JSONB | YES | | Request payload |
| validation_result | JSONB | YES | | Validation result |
| is_valid | BOOLEAN | YES | | Validation outcome |
| confidence_score | NUMERIC | YES | | Confidence score |
| recommendations | JSONB | YES | | AI recommendations |
| model_used | VARCHAR(100) | YES | | AI model used |
| processing_time_ms | INTEGER | YES | | Processing time |
| error_message | TEXT | YES | | Error if any |
| user_id | VARCHAR(100) | YES | | User ID |
| session_id | VARCHAR(100) | YES | | Session ID |
| created_at | TIMESTAMP | YES | CURRENT_TIMESTAMP | Creation time |
| updated_at | TIMESTAMP | YES | CURRENT_TIMESTAMP | Last update time |

### 10.3 medical_exams (2 columns)

Medical examination type reference data.

---

## 11. Other Tables

### 11.1 authorizations

Legacy authorization records.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | INTEGER | NO | SERIAL | Primary key |
| patient_id | UUID | YES | | FK to patients |
| provider_id | UUID | YES | | FK to providers |
| insurer_id | UUID | YES | | FK to insurers |
| auth_number | VARCHAR(100) | YES | | Authorization number |
| status | VARCHAR(20) | YES | | Status |
| created_at | TIMESTAMP | YES | CURRENT_TIMESTAMP | Creation time |
| updated_at | TIMESTAMP | YES | CURRENT_TIMESTAMP | Last update time |

### 11.2 payments

Payment tracking records.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | INTEGER | NO | SERIAL | Primary key |
| claim_id | UUID | YES | | FK to claims |
| amount | NUMERIC | YES | | Payment amount |
| currency | VARCHAR(3) | YES | 'SAR' | Currency |
| status | VARCHAR(20) | YES | | Payment status |
| created_at | TIMESTAMP | YES | CURRENT_TIMESTAMP | Creation time |
| updated_at | TIMESTAMP | YES | CURRENT_TIMESTAMP | Last update time |

---

## 12. Entity Relationships

### Primary Relationships

```
patients (1) ──────────────────── (N) patient_coverage
    │                                      │
    │                                      │
    └──────────────────────────────────────┼──── insurers
                                           │
                                           │
prior_authorizations (1) ─────── (N) prior_authorization_items
         │
         ├──────────────────────── (N) prior_authorization_diagnoses
         │
         ├──────────────────────── (N) prior_authorization_supporting_info
         │
         ├──────────────────────── (N) prior_authorization_attachments
         │
         └──────────────────────── (N) prior_authorization_responses


eligibility (1) ─────────────────── (N) eligibility_benefits


dental_approvals (1) ──────────── (N) dental_procedures
         │
         └──────────────────────── (N) dental_medications


eye_approvals (1) ─────────────── (N) eye_procedures


standard_approvals_claims (1) ─── (N) standard_approvals_management_items
         │
         └──────────────────────── (N) standard_approvals_medications


medicines (1) ─────────────────── (N) medicine_brands
         │
         └──────────────────────── (N) medicine_codes


nphies_code_systems (1) ────────── (N) nphies_codes
```

### Foreign Key Summary

| Child Table | Parent Table | FK Column |
|-------------|--------------|-----------|
| patient_coverage | patients | patient_id |
| patient_coverage | insurers | insurer_id |
| patient_coverage | policy_holders | policy_holder_id |
| prior_authorizations | patients | patient_id |
| prior_authorizations | providers | provider_id |
| prior_authorizations | insurers | insurer_id |
| prior_authorizations | patient_coverage | coverage_id |
| prior_authorization_items | prior_authorizations | prior_auth_id |
| prior_authorization_diagnoses | prior_authorizations | prior_auth_id |
| prior_authorization_supporting_info | prior_authorizations | prior_auth_id |
| prior_authorization_attachments | prior_authorizations | prior_auth_id |
| prior_authorization_responses | prior_authorizations | prior_auth_id |
| eligibility | patients | patient_id |
| eligibility | providers | provider_id |
| eligibility | insurers | insurer_id |
| eligibility | patient_coverage | coverage_id |
| eligibility_benefits | eligibility | eligibility_id |
| claims | patients | patient_id |
| claims | providers | provider_id |
| claims | insurers | insurer_id |
| claims | prior_authorizations | prior_auth_id |
| nphies_codes | nphies_code_systems | code_system_id |
| medicine_brands | medicines | medicine_id |
| medicine_codes | medicines | medicine_id |

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | December 2024 | NAFES Team | Initial document |

---

*This document provides the database schema specification for the NAFES Healthcare Management System. For setup instructions, refer to the Setup and Deployment Guide.*


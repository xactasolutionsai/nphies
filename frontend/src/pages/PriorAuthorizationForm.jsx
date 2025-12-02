import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import DatePicker from 'react-datepicker';
import Select from 'react-select';
import 'react-datepicker/dist/react-datepicker.css';
import api from '@/services/api';
import { 
  Save, Send, ArrowLeft, Plus, Trash2, FileText, User, Building, 
  Shield, Stethoscope, Activity, Receipt, Paperclip, Eye, Pill,
  Calendar, DollarSign, AlertCircle, CheckCircle, XCircle, Copy, CreditCard
} from 'lucide-react';

// Custom CSS for DatePicker
const datePickerStyles = `
  .react-datepicker__day--selected,
  .react-datepicker__day--keyboard-selected {
    background-color: #553781 !important;
    color: white !important;
  }
  .react-datepicker__day--selected:hover,
  .react-datepicker__day--keyboard-selected:hover {
    background-color: #452d6b !important;
    color: white !important;
  }
  .react-datepicker__day:hover {
    background-color: #f3f4f6 !important;
  }
  .react-datepicker__day--today {
    font-weight: bold;
    border: 1px solid #553781;
  }
  .react-datepicker-wrapper {
    width: 100%;
  }
  .datepicker-wrapper {
    position: relative;
    width: 100%;
  }
  .datepicker-wrapper .datepicker-icon {
    position: absolute;
    left: 12px;
    top: 50%;
    transform: translateY(-50%);
    color: #9ca3af;
    pointer-events: none;
    z-index: 1;
  }
  .datepicker-wrapper input {
    padding-left: 36px !important;
  }
`;

// Select styles matching the design system
const selectStyles = {
  control: (base, state) => ({
    ...base,
    minHeight: '42px',
    borderColor: '#e5e7eb',
    borderRadius: '6px',
    backgroundColor: state.isDisabled ? '#f3f4f6' : 'white',
    paddingLeft: '0.25rem',
    paddingRight: '0.25rem',
    boxShadow: state.isFocused ? '0 0 0 2px rgba(85, 55, 129, 0.3)' : 'none',
    borderWidth: '1px',
    cursor: state.isDisabled ? 'not-allowed' : 'default',
    '&:hover': {
      borderColor: '#e5e7eb'
    }
  }),
  option: (base, { isFocused, isSelected }) => ({
    ...base,
    backgroundColor: isSelected ? '#553781' : isFocused ? '#f3f4f6' : 'white',
    color: isSelected ? 'white' : '#374151',
    cursor: 'pointer',
    padding: '8px 12px'
  }),
  menu: (base) => ({ 
    ...base, 
    zIndex: 9999,
    position: 'absolute'
  }),
  menuPortal: (base) => ({ 
    ...base, 
    zIndex: 9999 
  })
};

// Dropdown options
const AUTH_TYPE_OPTIONS = [
  { value: 'institutional', label: 'Institutional' },
  { value: 'professional', label: 'Professional' },
  { value: 'pharmacy', label: 'Pharmacy' },
  { value: 'dental', label: 'Dental' },
  { value: 'vision', label: 'Vision' }
];

const PRIORITY_OPTIONS = [
  { value: 'stat', label: 'STAT (Urgent)' },
  { value: 'normal', label: 'Normal' },
  { value: 'deferred', label: 'Deferred' }
];

const ENCOUNTER_CLASS_OPTIONS = [
  { value: 'inpatient', label: 'Inpatient (IMP)' },
  { value: 'outpatient', label: 'Outpatient' },
  { value: 'ambulatory', label: 'Ambulatory (AMB)' },
  { value: 'daycase', label: 'Day Case (SS)' },
  { value: 'emergency', label: 'Emergency (EMER)' },
  { value: 'home', label: 'Home Healthcare (HH)' },
  { value: 'telemedicine', label: 'Telemedicine (VR)' }
];

const CURRENCY_OPTIONS = [
  { value: 'SAR', label: 'SAR - Saudi Riyal' },
  { value: 'USD', label: 'USD - US Dollar' }
];

const DIAGNOSIS_TYPE_OPTIONS = [
  { value: 'principal', label: 'Principal' },
  { value: 'secondary', label: 'Secondary' },
  { value: 'admitting', label: 'Admitting' },
  { value: 'discharge', label: 'Discharge' }
];

// Dental ICD-10 Codes (K00-K10)
const DENTAL_ICD10_OPTIONS = [
  // K00 – Disorders of tooth development and eruption
  { value: 'K00.0', label: 'K00.0 - Anodontia' },
  { value: 'K00.1', label: 'K00.1 - Supernumerary teeth' },
  { value: 'K00.2', label: 'K00.2 - Abnormalities of size & form of teeth' },
  { value: 'K00.3', label: 'K00.3 - Mottled teeth' },
  { value: 'K00.4', label: 'K00.4 - Disturbances in tooth formation' },
  { value: 'K00.5', label: 'K00.5 - Hereditary disturbances of tooth structure' },
  { value: 'K00.6', label: 'K00.6 - Disturbances in tooth eruption' },
  { value: 'K00.7', label: 'K00.7 - Teething syndrome' },
  { value: 'K00.8', label: 'K00.8 - Other disorders of tooth development' },
  { value: 'K00.9', label: 'K00.9 - Disorder of tooth development, unspecified' },
  // K01 – Embedded and impacted teeth
  { value: 'K01.0', label: 'K01.0 - Embedded teeth' },
  { value: 'K01.1', label: 'K01.1 - Impacted teeth' },
  // K02 – Dental caries (decay)
  { value: 'K02.0', label: 'K02.0 - Caries of enamel' },
  { value: 'K02.1', label: 'K02.1 - Caries of dentin' },
  { value: 'K02.2', label: 'K02.2 - Caries of cementum' },
  { value: 'K02.3', label: 'K02.3 - Arrested dental caries' },
  { value: 'K02.4', label: 'K02.4 - Odontoclasia' },
  { value: 'K02.5', label: 'K02.5 - Dental caries on smooth surface' },
  { value: 'K02.6', label: 'K02.6 - Dental caries on pit and fissure' },
  { value: 'K02.7', label: 'K02.7 - Root caries' },
  { value: 'K02.8', label: 'K02.8 - Other dental caries' },
  { value: 'K02.9', label: 'K02.9 - Dental caries, unspecified' },
  // K03 – Other diseases of hard tissues of teeth
  { value: 'K03.0', label: 'K03.0 - Excessive attrition of teeth' },
  { value: 'K03.1', label: 'K03.1 - Abrasion of teeth' },
  { value: 'K03.2', label: 'K03.2 - Erosion of teeth' },
  { value: 'K03.3', label: 'K03.3 - Pathological resorption of teeth' },
  { value: 'K03.4', label: 'K03.4 - Hypercementosis' },
  { value: 'K03.5', label: 'K03.5 - Ankylosis of teeth' },
  { value: 'K03.6', label: 'K03.6 - Deposits (calculus) on teeth' },
  { value: 'K03.7', label: 'K03.7 - Posteruptive colour changes of dental hard tissues' },
  { value: 'K03.8', label: 'K03.8 - Other specified diseases of hard tissues' },
  { value: 'K03.9', label: 'K03.9 - Hard tissue disease, unspecified' },
  // K04 – Diseases of pulp and periapical tissues
  { value: 'K04.0', label: 'K04.0 - Pulpitis' },
  { value: 'K04.1', label: 'K04.1 - Necrosis of pulp' },
  { value: 'K04.2', label: 'K04.2 - Pulp degeneration' },
  { value: 'K04.3', label: 'K04.3 - Abnormal hard tissue formation in pulp' },
  { value: 'K04.4', label: 'K04.4 - Acute apical periodontitis of pulpal origin' },
  { value: 'K04.5', label: 'K04.5 - Chronic apical periodontitis' },
  { value: 'K04.6', label: 'K04.6 - Periapical abscess with sinus' },
  { value: 'K04.7', label: 'K04.7 - Periapical abscess without sinus' },
  { value: 'K04.8', label: 'K04.8 - Radicular cyst' },
  { value: 'K04.9', label: 'K04.9 - Other diseases of pulp/periapical tissue' },
  // K05 – Gingivitis and periodontal diseases
  { value: 'K05.0', label: 'K05.0 - Acute gingivitis' },
  { value: 'K05.1', label: 'K05.1 - Chronic gingivitis' },
  { value: 'K05.2', label: 'K05.2 - Acute periodontitis' },
  { value: 'K05.3', label: 'K05.3 - Chronic periodontitis' },
  { value: 'K05.4', label: 'K05.4 - Periodontosis' },
  { value: 'K05.5', label: 'K05.5 - Other periodontal diseases' },
  { value: 'K05.6', label: 'K05.6 - Periodontal disease, unspecified' },
  // K06 – Other disorders of gingiva and edentulous alveolar ridge
  { value: 'K06.0', label: 'K06.0 - Gingival recession' },
  { value: 'K06.1', label: 'K06.1 - Gingival enlargement' },
  { value: 'K06.2', label: 'K06.2 - Gingival/edentulous alveolar ridge disorder' },
  { value: 'K06.8', label: 'K06.8 - Other disorders of gingiva' },
  { value: 'K06.9', label: 'K06.9 - Disorder of gingiva, unspecified' },
  // K07 – Dentofacial anomalies
  { value: 'K07.0', label: 'K07.0 - Major anomalies of jaw size' },
  { value: 'K07.1', label: 'K07.1 - Anomalies of jaw-cranial base relationship' },
  { value: 'K07.2', label: 'K07.2 - Anomalies of dental arch relationship' },
  { value: 'K07.3', label: 'K07.3 - Anomalies of tooth position' },
  { value: 'K07.4', label: 'K07.4 - Malocclusion, unspecified' },
  { value: 'K07.5', label: 'K07.5 - Dentofacial functional anomalies' },
  { value: 'K07.6', label: 'K07.6 - Temporomandibular joint disorders' },
  { value: 'K07.8', label: 'K07.8 - Other dentofacial anomalies' },
  { value: 'K07.9', label: 'K07.9 - Dentofacial anomaly, unspecified' },
  // K08 – Loss of teeth and other local conditions
  { value: 'K08.0', label: 'K08.0 - Exfoliation of teeth due to systemic causes' },
  { value: 'K08.1', label: 'K08.1 - Loss of teeth due to accident/extraction' },
  { value: 'K08.2', label: 'K08.2 - Atrophy of edentulous alveolar ridge' },
  { value: 'K08.3', label: 'K08.3 - Retained dental root' },
  { value: 'K08.4', label: 'K08.4 - Odontogenic cysts' },
  { value: 'K08.8', label: 'K08.8 - Other conditions of teeth' },
  { value: 'K08.9', label: 'K08.9 - Condition of teeth, unspecified' },
  // K09 – Cysts of oral region
  { value: 'K09.0', label: 'K09.0 - Developmental odontogenic cysts' },
  { value: 'K09.1', label: 'K09.1 - Non-odontogenic developmental cysts' },
  { value: 'K09.2', label: 'K09.2 - Other cysts of jaws' },
  { value: 'K09.8', label: 'K09.8 - Other cysts of oral region' },
  { value: 'K09.9', label: 'K09.9 - Cyst of oral region, unspecified' },
  // K10 – Other diseases of jaws
  { value: 'K10.0', label: 'K10.0 - Developmental disorders of jaws' },
  { value: 'K10.1', label: 'K10.1 - Giant cell granuloma' },
  { value: 'K10.2', label: 'K10.2 - Inflammatory conditions of jaws' },
  { value: 'K10.3', label: 'K10.3 - Osteonecrosis of jaw' },
  { value: 'K10.8', label: 'K10.8 - Other diseases of jaws' },
  { value: 'K10.9', label: 'K10.9 - Disease of jaw, unspecified' }
];

const EYE_OPTIONS = [
  { value: 'left', label: 'Left' },
  { value: 'right', label: 'Right' },
  { value: 'both', label: 'Both' }
];

// FDI Oral Region Codes (NPHIES fdi-oral-region CodeSystem)
// Permanent teeth: Quadrants 1-4 (11-48)
// Deciduous teeth: Quadrants 5-8 (51-85)
const FDI_TOOTH_OPTIONS = [
  // === PERMANENT TEETH ===
  // Upper Right (Quadrant 1)
  { value: '11', label: '11 - UPPER RIGHT; PERMANENT TEETH # 1', display: 'UPPER RIGHT; PERMANENT TEETH # 1' },
  { value: '12', label: '12 - UPPER RIGHT; PERMANENT TEETH # 2', display: 'UPPER RIGHT; PERMANENT TEETH # 2' },
  { value: '13', label: '13 - UPPER RIGHT; PERMANENT TEETH # 3', display: 'UPPER RIGHT; PERMANENT TEETH # 3' },
  { value: '14', label: '14 - UPPER RIGHT; PERMANENT TEETH # 4', display: 'UPPER RIGHT; PERMANENT TEETH # 4' },
  { value: '15', label: '15 - UPPER RIGHT; PERMANENT TEETH # 5', display: 'UPPER RIGHT; PERMANENT TEETH # 5' },
  { value: '16', label: '16 - UPPER RIGHT; PERMANENT TEETH # 6', display: 'UPPER RIGHT; PERMANENT TEETH # 6' },
  { value: '17', label: '17 - UPPER RIGHT; PERMANENT TEETH # 7', display: 'UPPER RIGHT; PERMANENT TEETH # 7' },
  { value: '18', label: '18 - UPPER RIGHT; PERMANENT TEETH # 8', display: 'UPPER RIGHT; PERMANENT TEETH # 8' },
  // Upper Left (Quadrant 2)
  { value: '21', label: '21 - UPPER LEFT; PERMANENT TEETH # 1', display: 'UPPER LEFT; PERMANENT TEETH # 1' },
  { value: '22', label: '22 - UPPER LEFT; PERMANENT TEETH # 2', display: 'UPPER LEFT; PERMANENT TEETH # 2' },
  { value: '23', label: '23 - UPPER LEFT; PERMANENT TEETH # 3', display: 'UPPER LEFT; PERMANENT TEETH # 3' },
  { value: '24', label: '24 - UPPER LEFT; PERMANENT TEETH # 4', display: 'UPPER LEFT; PERMANENT TEETH # 4' },
  { value: '25', label: '25 - UPPER LEFT; PERMANENT TEETH # 5', display: 'UPPER LEFT; PERMANENT TEETH # 5' },
  { value: '26', label: '26 - UPPER LEFT; PERMANENT TEETH # 6', display: 'UPPER LEFT; PERMANENT TEETH # 6' },
  { value: '27', label: '27 - UPPER LEFT; PERMANENT TEETH # 7', display: 'UPPER LEFT; PERMANENT TEETH # 7' },
  { value: '28', label: '28 - UPPER LEFT; PERMANENT TEETH # 8', display: 'UPPER LEFT; PERMANENT TEETH # 8' },
  // Lower Left (Quadrant 3)
  { value: '31', label: '31 - LOWER LEFT; PERMANENT TEETH # 1', display: 'LOWER LEFT; PERMANENT TEETH # 1' },
  { value: '32', label: '32 - LOWER LEFT; PERMANENT TEETH # 2', display: 'LOWER LEFT; PERMANENT TEETH # 2' },
  { value: '33', label: '33 - LOWER LEFT; PERMANENT TEETH # 3', display: 'LOWER LEFT; PERMANENT TEETH # 3' },
  { value: '34', label: '34 - LOWER LEFT; PERMANENT TEETH # 4', display: 'LOWER LEFT; PERMANENT TEETH # 4' },
  { value: '35', label: '35 - LOWER LEFT; PERMANENT TEETH # 5', display: 'LOWER LEFT; PERMANENT TEETH # 5' },
  { value: '36', label: '36 - LOWER LEFT; PERMANENT TEETH # 6', display: 'LOWER LEFT; PERMANENT TEETH # 6' },
  { value: '37', label: '37 - LOWER LEFT; PERMANENT TEETH # 7', display: 'LOWER LEFT; PERMANENT TEETH # 7' },
  { value: '38', label: '38 - LOWER LEFT; PERMANENT TEETH # 8', display: 'LOWER LEFT; PERMANENT TEETH # 8' },
  // Lower Right (Quadrant 4)
  { value: '41', label: '41 - LOWER RIGHT; PERMANENT TEETH # 1', display: 'LOWER RIGHT; PERMANENT TEETH # 1' },
  { value: '42', label: '42 - LOWER RIGHT; PERMANENT TEETH # 2', display: 'LOWER RIGHT; PERMANENT TEETH # 2' },
  { value: '43', label: '43 - LOWER RIGHT; PERMANENT TEETH # 3', display: 'LOWER RIGHT; PERMANENT TEETH # 3' },
  { value: '44', label: '44 - LOWER RIGHT; PERMANENT TEETH # 4', display: 'LOWER RIGHT; PERMANENT TEETH # 4' },
  { value: '45', label: '45 - LOWER RIGHT; PERMANENT TEETH # 5', display: 'LOWER RIGHT; PERMANENT TEETH # 5' },
  { value: '46', label: '46 - LOWER RIGHT; PERMANENT TEETH # 6', display: 'LOWER RIGHT; PERMANENT TEETH # 6' },
  { value: '47', label: '47 - LOWER RIGHT; PERMANENT TEETH # 7', display: 'LOWER RIGHT; PERMANENT TEETH # 7' },
  { value: '48', label: '48 - LOWER RIGHT; PERMANENT TEETH # 8', display: 'LOWER RIGHT; PERMANENT TEETH # 8' },
  // === DECIDUOUS (BABY) TEETH ===
  // Upper Right Deciduous (Quadrant 5)
  { value: '51', label: '51 - UPPER RIGHT; DECIDUOUS TEETH # 1', display: 'UPPER RIGHT; DECIDUOUS TEETH # 1' },
  { value: '52', label: '52 - UPPER RIGHT; DECIDUOUS TEETH # 2', display: 'UPPER RIGHT; DECIDUOUS TEETH # 2' },
  { value: '53', label: '53 - UPPER RIGHT; DECIDUOUS TEETH # 3', display: 'UPPER RIGHT; DECIDUOUS TEETH # 3' },
  { value: '54', label: '54 - UPPER RIGHT; DECIDUOUS TEETH # 4', display: 'UPPER RIGHT; DECIDUOUS TEETH # 4' },
  { value: '55', label: '55 - UPPER RIGHT; DECIDUOUS TEETH # 5', display: 'UPPER RIGHT; DECIDUOUS TEETH # 5' },
  // Upper Left Deciduous (Quadrant 6)
  { value: '61', label: '61 - UPPER LEFT; DECIDUOUS TEETH # 1', display: 'UPPER LEFT; DECIDUOUS TEETH # 1' },
  { value: '62', label: '62 - UPPER LEFT; DECIDUOUS TEETH # 2', display: 'UPPER LEFT; DECIDUOUS TEETH # 2' },
  { value: '63', label: '63 - UPPER LEFT; DECIDUOUS TEETH # 3', display: 'UPPER LEFT; DECIDUOUS TEETH # 3' },
  { value: '64', label: '64 - UPPER LEFT; DECIDUOUS TEETH # 4', display: 'UPPER LEFT; DECIDUOUS TEETH # 4' },
  { value: '65', label: '65 - UPPER LEFT; DECIDUOUS TEETH # 5', display: 'UPPER LEFT; DECIDUOUS TEETH # 5' },
  // Lower Left Deciduous (Quadrant 7)
  { value: '71', label: '71 - LOWER LEFT; DECIDUOUS TEETH # 1', display: 'LOWER LEFT; DECIDUOUS TEETH # 1' },
  { value: '72', label: '72 - LOWER LEFT; DECIDUOUS TEETH # 2', display: 'LOWER LEFT; DECIDUOUS TEETH # 2' },
  { value: '73', label: '73 - LOWER LEFT; DECIDUOUS TEETH # 3', display: 'LOWER LEFT; DECIDUOUS TEETH # 3' },
  { value: '74', label: '74 - LOWER LEFT; DECIDUOUS TEETH # 4', display: 'LOWER LEFT; DECIDUOUS TEETH # 4' },
  { value: '75', label: '75 - LOWER LEFT; DECIDUOUS TEETH # 5', display: 'LOWER LEFT; DECIDUOUS TEETH # 5' },
  // Lower Right Deciduous (Quadrant 8)
  { value: '81', label: '81 - LOWER RIGHT; DECIDUOUS TEETH # 1', display: 'LOWER RIGHT; DECIDUOUS TEETH # 1' },
  { value: '82', label: '82 - LOWER RIGHT; DECIDUOUS TEETH # 2', display: 'LOWER RIGHT; DECIDUOUS TEETH # 2' },
  { value: '83', label: '83 - LOWER RIGHT; DECIDUOUS TEETH # 3', display: 'LOWER RIGHT; DECIDUOUS TEETH # 3' },
  { value: '84', label: '84 - LOWER RIGHT; DECIDUOUS TEETH # 4', display: 'LOWER RIGHT; DECIDUOUS TEETH # 4' },
  { value: '85', label: '85 - LOWER RIGHT; DECIDUOUS TEETH # 5', display: 'LOWER RIGHT; DECIDUOUS TEETH # 5' }
];

// Tooth Surface Codes for dental procedures (NPHIES tooth-surface CodeSystem)
const TOOTH_SURFACE_OPTIONS = [
  // Single surfaces
  { value: 'M', label: 'M - Mesial (closest to midline)' },
  { value: 'O', label: 'O - Occlusal (chewing surface)' },
  { value: 'I', label: 'I - Incisal (biting edge)' },
  { value: 'D', label: 'D - Distal (away from midline)' },
  { value: 'B', label: 'B - Buccal (facing cheeks)' },
  { value: 'V', label: 'V - Ventral (facing lips)' },
  { value: 'L', label: 'L - Lingual (facing tongue)' },
  // Combined surfaces
  { value: 'MO', label: 'MO - Mesioclusal' },
  { value: 'DO', label: 'DO - Distoclusal' },
  { value: 'DI', label: 'DI - Distoincisal' },
  { value: 'MOD', label: 'MOD - Mesioclusodistal' }
];

const SUPPORTING_INFO_CATEGORY_OPTIONS = [
  { value: 'info', label: 'General Info' },
  { value: 'days-supply', label: 'Days Supply' },
  { value: 'attachment', label: 'Attachment' },
  { value: 'clinical-notes', label: 'Clinical Notes' },
  { value: 'onset', label: 'Onset' },
  { value: 'related-claim', label: 'Related Claim' }
];

// NPHIES Vital Signs Fields (per Claim-483069.json example)
const VITAL_SIGNS_FIELDS = [
  { key: 'systolic', category: 'vital-sign-systolic', label: 'Systolic BP', unit: 'mm[Hg]', unitLabel: 'mmHg', placeholder: '120' },
  { key: 'diastolic', category: 'vital-sign-diastolic', label: 'Diastolic BP', unit: 'mm[Hg]', unitLabel: 'mmHg', placeholder: '80' },
  { key: 'height', category: 'vital-sign-height', label: 'Height', unit: 'cm', unitLabel: 'cm', placeholder: '170' },
  { key: 'weight', category: 'vital-sign-weight', label: 'Weight', unit: 'kg', unitLabel: 'kg', placeholder: '70' },
  { key: 'pulse', category: 'pulse', label: 'Pulse Rate', unit: '/min', unitLabel: 'bpm', placeholder: '72' },
  { key: 'temperature', category: 'temperature', label: 'Temperature', unit: 'Cel', unitLabel: '°C', placeholder: '37' },
  { key: 'oxygen_saturation', category: 'oxygen-saturation', label: 'O2 Saturation', unit: '%', unitLabel: '%', placeholder: '98' },
  { key: 'respiratory_rate', category: 'respiratory-rate', label: 'Respiratory Rate', unit: '/min', unitLabel: '/min', placeholder: '16' }
];

// NPHIES Clinical Text Fields
const CLINICAL_TEXT_FIELDS = [
  { key: 'patient_history', category: 'patient-history', label: 'Patient History', placeholder: 'Document any relevant patient history, allergies, chronic conditions...' },
  { key: 'history_of_present_illness', category: 'history-of-present-illness', label: 'History of Present Illness', placeholder: 'Describe the current illness, symptoms, and timeline...' },
  { key: 'physical_examination', category: 'physical-examination', label: 'Physical Examination', placeholder: 'Document physical examination findings...' },
  { key: 'treatment_plan', category: 'treatment-plan', label: 'Treatment Plan', placeholder: 'Describe the proposed treatment plan...' }
];

// NPHIES Admission-specific Fields (for inpatient/daycase)
const ADMISSION_FIELDS = [
  { key: 'admission_weight', category: 'admission-weight', label: 'Admission Weight', unit: 'kg', unitLabel: 'kg', placeholder: '70' },
  { key: 'estimated_length_of_stay', category: 'estimated-Length-of-Stay', label: 'Estimated Length of Stay', unit: 'd', unitLabel: 'days', placeholder: '3' }
];

// NPHIES Investigation Result Options
const INVESTIGATION_RESULT_OPTIONS = [
  { value: 'INP', label: 'Investigation(s) not performed' },
  { value: 'NAD', label: 'No abnormality detected' },
  { value: 'ABN', label: 'Abnormal results' }
];

// Helper functions
const formatAmount = (amount, currency = 'SAR') => {
  if (amount == null || amount === '') return `0.00 ${currency}`;
  return `${parseFloat(amount).toFixed(2)} ${currency}`;
};

const getInitialItemData = (sequence) => ({
  sequence,
  product_or_service_code: '',
  product_or_service_display: '',
  quantity: 1,
  unit_price: '',
  net_amount: ''
});

const getInitialDiagnosisData = (sequence) => ({
  sequence,
  diagnosis_code: '',
  diagnosis_display: '',
  diagnosis_type: 'principal'
});

const getInitialSupportingInfoData = (sequence, category = 'info') => ({
  sequence,
  category,
  code: '',
  value_string: '',
  value_quantity: ''
});

// Tab Button Component
const TabButton = ({ active, onClick, icon: Icon, children }) => (
  <button
    type="button"
    onClick={onClick}
    className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
      active 
        ? 'bg-primary-purple text-white' 
        : 'text-gray-600 hover:bg-gray-100'
    }`}
  >
    {Icon && <Icon className="h-4 w-4" />}
    {children}
  </button>
);

export default function PriorAuthorizationForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditMode = !!id;

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [testSending, setTestSending] = useState(false);
  const [errors, setErrors] = useState([]);
  const [activeTab, setActiveTab] = useState('basic');
  
  // Preview state
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  
  // Reference data
  const [patients, setPatients] = useState([]);
  const [providers, setProviders] = useState([]);
  const [insurers, setInsurers] = useState([]);
  const [coverages, setCoverages] = useState([]);
  const [loadingCoverages, setLoadingCoverages] = useState(false);

  // Form data
  const [formData, setFormData] = useState({
    auth_type: 'professional',
    status: 'draft',
    priority: 'normal',
    currency: 'SAR',
    encounter_class: 'ambulatory',
    patient_id: '',
    provider_id: '',
    insurer_id: '',
    coverage_id: '',
    diagnosis_codes: '',
    primary_diagnosis: '',
    total_amount: '',
    eligibility_ref: '',
    encounter_start: '',
    encounter_end: '',
    items: [getInitialItemData(1)],
    supporting_info: [],
    diagnoses: [getInitialDiagnosisData(1)],
    attachments: [],
    // NPHIES Vital Signs & Clinical Data
    vital_signs: {
      systolic: '',
      diastolic: '',
      height: '',
      weight: '',
      pulse: '',
      temperature: '',
      oxygen_saturation: '',
      respiratory_rate: '',
      measurement_time: null
    },
    clinical_info: {
      chief_complaint_code: '',
      chief_complaint_display: '',
      patient_history: '',
      history_of_present_illness: '',
      physical_examination: '',
      treatment_plan: '',
      investigation_result: ''
    },
    admission_info: {
      admission_weight: '',
      estimated_length_of_stay: ''
    }
  });

  useEffect(() => {
    loadReferenceData();
    if (isEditMode) {
      loadPriorAuthorization();
    }
  }, [id]);

  const loadReferenceData = async () => {
    try {
      const [patientsRes, providersRes, insurersRes] = await Promise.all([
        api.getPatients({ limit: 1000 }),
        api.getProviders({ limit: 1000 }),
        api.getInsurers({ limit: 1000 })
      ]);
      setPatients(patientsRes?.data || []);
      setProviders(providersRes?.data || []);
      setInsurers(insurersRes?.data || []);
    } catch (error) {
      console.error('Error loading reference data:', error);
    }
  };

  const loadPriorAuthorization = async () => {
    try {
      setLoading(true);
      const response = await api.getPriorAuthorization(id);
      const data = response.data;
      
      // Parse existing supporting_info into structured fields
      const supportingInfo = data.supporting_info || [];
      const vitalSigns = {
        systolic: '', diastolic: '', height: '', weight: '',
        pulse: '', temperature: '', oxygen_saturation: '', respiratory_rate: '',
        measurement_time: null
      };
      const clinicalInfo = {
        chief_complaint_code: '', chief_complaint_display: '',
        patient_history: '', history_of_present_illness: '',
        physical_examination: '', treatment_plan: '',
        investigation_result: ''
      };
      const admissionInfo = {
        admission_weight: '', estimated_length_of_stay: ''
      };
      
      // Track which supporting_info items are parsed into structured fields
      const parsedCategories = new Set();
      
      supportingInfo.forEach(info => {
        // Vital signs
        const vitalField = VITAL_SIGNS_FIELDS.find(f => f.category === info.category);
        if (vitalField && info.value_quantity != null) {
          vitalSigns[vitalField.key] = String(info.value_quantity);
          if (info.timing_period_start && !vitalSigns.measurement_time) {
            vitalSigns.measurement_time = info.timing_period_start;
          }
          parsedCategories.add(info.category);
        }
        
        // Clinical text fields
        const clinicalField = CLINICAL_TEXT_FIELDS.find(f => f.category === info.category);
        if (clinicalField && info.value_string) {
          clinicalInfo[clinicalField.key] = info.value_string;
          parsedCategories.add(info.category);
        }
        
        // Chief complaint
        if (info.category === 'chief-complaint' && info.code) {
          clinicalInfo.chief_complaint_code = info.code;
          clinicalInfo.chief_complaint_display = info.code_display || '';
          parsedCategories.add(info.category);
        }
        
        // Investigation result
        if (info.category === 'investigation-result' && info.code) {
          clinicalInfo.investigation_result = info.code;
          parsedCategories.add(info.category);
        }
        
        // Admission fields
        const admissionField = ADMISSION_FIELDS.find(f => f.category === info.category);
        if (admissionField && info.value_quantity != null) {
          admissionInfo[admissionField.key] = String(info.value_quantity);
          parsedCategories.add(info.category);
        }
      });
      
      // Filter out parsed items from supporting_info (keep only manual/other entries)
      const remainingSupportingInfo = supportingInfo.filter(info => !parsedCategories.has(info.category));
      
      setFormData({
        ...data,
        items: data.items?.length > 0 ? data.items : [getInitialItemData(1)],
        diagnoses: data.diagnoses?.length > 0 ? data.diagnoses : [getInitialDiagnosisData(1)],
        supporting_info: remainingSupportingInfo,
        attachments: data.attachments || [],
        vital_signs: vitalSigns,
        clinical_info: clinicalInfo,
        admission_info: admissionInfo
      });
      
      // Load coverages for the patient (if patient exists)
      if (data.patient_id) {
        try {
          const coveragesRes = await api.getPatientCoverages(data.patient_id);
          setCoverages(coveragesRes?.data || []);
        } catch (coverageError) {
          console.error('Error loading patient coverages:', coverageError);
        }
      }
    } catch (error) {
      console.error('Error loading prior authorization:', error);
      alert('Error loading prior authorization');
      navigate('/prior-authorizations');
    } finally {
      setLoading(false);
    }
  };

  // Load coverages when patient is selected
  const loadPatientCoverages = async (patientId) => {
    if (!patientId) {
      setCoverages([]);
      return;
    }
    
    try {
      setLoadingCoverages(true);
      const response = await api.getPatientCoverages(patientId);
      const patientCoverages = response?.data || [];
      setCoverages(patientCoverages);
      
      // If patient has only one coverage, auto-select it
      if (patientCoverages.length === 1) {
        const coverage = patientCoverages[0];
        setFormData(prev => ({
          ...prev,
          coverage_id: coverage.coverage_id,
          insurer_id: coverage.insurer_id
        }));
      } else {
        // Clear coverage and insurer if patient has multiple or no coverages
        setFormData(prev => ({
          ...prev,
          coverage_id: '',
          insurer_id: ''
        }));
      }
    } catch (error) {
      console.error('Error loading patient coverages:', error);
      setCoverages([]);
    } finally {
      setLoadingCoverages(false);
    }
  };

  // Handle coverage selection - auto-set insurer
  const handleCoverageChange = (coverageId) => {
    const selectedCoverage = coverages.find(c => c.coverage_id === coverageId);
    setFormData(prev => ({
      ...prev,
      coverage_id: coverageId,
      insurer_id: selectedCoverage?.insurer_id || prev.insurer_id
    }));
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // If patient changed, load their coverages
    if (field === 'patient_id') {
      loadPatientCoverages(value);
    }
  };

  const handleItemChange = (index, field, value) => {
    setFormData(prev => {
      const newItems = [...prev.items];
      newItems[index] = { ...newItems[index], [field]: value };
      
      // Auto-calculate net amount
      if (field === 'quantity' || field === 'unit_price') {
        const qty = field === 'quantity' ? value : newItems[index].quantity;
        const price = field === 'unit_price' ? value : newItems[index].unit_price;
        newItems[index].net_amount = (parseFloat(qty) || 0) * (parseFloat(price) || 0);
      }
      
      return { ...prev, items: newItems };
    });
  };

  const addItem = () => {
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, getInitialItemData(prev.items.length + 1)]
    }));
  };

  const removeItem = (index) => {
    if (formData.items.length > 1) {
      setFormData(prev => ({
        ...prev,
        items: prev.items.filter((_, i) => i !== index).map((item, i) => ({ ...item, sequence: i + 1 }))
      }));
    }
  };

  const handleDiagnosisChange = (index, field, value) => {
    setFormData(prev => {
      const newDiagnoses = [...prev.diagnoses];
      newDiagnoses[index] = { ...newDiagnoses[index], [field]: value };
      return { ...prev, diagnoses: newDiagnoses };
    });
  };

  const addDiagnosis = () => {
    setFormData(prev => ({
      ...prev,
      diagnoses: [...prev.diagnoses, getInitialDiagnosisData(prev.diagnoses.length + 1)]
    }));
  };

  const removeDiagnosis = (index) => {
    if (formData.diagnoses.length > 1) {
      setFormData(prev => ({
        ...prev,
        diagnoses: prev.diagnoses.filter((_, i) => i !== index).map((diag, i) => ({ ...diag, sequence: i + 1 }))
      }));
    }
  };

  const handleSupportingInfoChange = (index, field, value) => {
    setFormData(prev => {
      const newInfo = [...prev.supporting_info];
      newInfo[index] = { ...newInfo[index], [field]: value };
      return { ...prev, supporting_info: newInfo };
    });
  };

  const addSupportingInfo = (category = 'info') => {
    setFormData(prev => ({
      ...prev,
      supporting_info: [...prev.supporting_info, getInitialSupportingInfoData(prev.supporting_info.length + 1, category)]
    }));
  };

  const removeSupportingInfo = (index) => {
    setFormData(prev => ({
      ...prev,
      supporting_info: prev.supporting_info.filter((_, i) => i !== index).map((info, i) => ({ ...info, sequence: i + 1 }))
    }));
  };

  // Handlers for structured vital signs, clinical info, and admission info
  const handleVitalSignChange = (key, value) => {
    setFormData(prev => ({
      ...prev,
      vital_signs: { ...prev.vital_signs, [key]: value }
    }));
  };

  const handleClinicalInfoChange = (key, value) => {
    setFormData(prev => ({
      ...prev,
      clinical_info: { ...prev.clinical_info, [key]: value }
    }));
  };

  const handleAdmissionInfoChange = (key, value) => {
    setFormData(prev => ({
      ...prev,
      admission_info: { ...prev.admission_info, [key]: value }
    }));
  };

  // Build supporting info array from structured data (for save/preview)
  const buildSupportingInfoArray = () => {
    const supportingInfo = [...formData.supporting_info]; // Keep existing manual entries
    let sequence = supportingInfo.length + 1;

    // Add vital signs
    VITAL_SIGNS_FIELDS.forEach(field => {
      if (formData.vital_signs[field.key]) {
        supportingInfo.push({
          sequence: sequence++,
          category: field.category,
          value_quantity: parseFloat(formData.vital_signs[field.key]),
          value_quantity_unit: field.unit,
          timing_period_start: formData.vital_signs.measurement_time || formData.encounter_start || new Date().toISOString()
        });
      }
    });

    // Add chief complaint if provided
    if (formData.clinical_info.chief_complaint_code) {
      supportingInfo.push({
        sequence: sequence++,
        category: 'chief-complaint',
        code: formData.clinical_info.chief_complaint_code,
        code_system: 'http://snomed.info/sct',
        code_display: formData.clinical_info.chief_complaint_display || ''
      });
    }

    // Add clinical text fields
    CLINICAL_TEXT_FIELDS.forEach(field => {
      if (formData.clinical_info[field.key]) {
        supportingInfo.push({
          sequence: sequence++,
          category: field.category,
          value_string: formData.clinical_info[field.key]
        });
      }
    });

    // Add investigation result if provided
    if (formData.clinical_info.investigation_result) {
      supportingInfo.push({
        sequence: sequence++,
        category: 'investigation-result',
        code: formData.clinical_info.investigation_result,
        code_system: 'http://nphies.sa/terminology/CodeSystem/investigation-result',
        code_display: INVESTIGATION_RESULT_OPTIONS.find(o => o.value === formData.clinical_info.investigation_result)?.label || ''
      });
    }

    // Add admission fields (only for inpatient/daycase)
    if (['inpatient', 'daycase'].includes(formData.encounter_class)) {
      ADMISSION_FIELDS.forEach(field => {
        if (formData.admission_info[field.key]) {
          supportingInfo.push({
            sequence: sequence++,
            category: field.category,
            value_quantity: parseFloat(formData.admission_info[field.key]),
            value_quantity_unit: field.unit
          });
        }
      });
    }

    return supportingInfo;
  };

  // Pure function for display - doesn't set state
  const getCalculatedTotal = () => {
    return formData.items.reduce((sum, item) => sum + (parseFloat(item.net_amount) || 0), 0);
  };

  // Click handler that sets state
  const calculateTotal = () => {
    const total = getCalculatedTotal();
    handleChange('total_amount', total);
    return total;
  };

  const validateForm = () => {
    const validationErrors = [];
    if (!formData.patient_id) validationErrors.push({ field: 'patient_id', message: 'Patient is required' });
    if (!formData.provider_id) validationErrors.push({ field: 'provider_id', message: 'Provider is required' });
    if (!formData.insurer_id) validationErrors.push({ field: 'insurer_id', message: 'Insurer is required' });
    if (!formData.items || formData.items.length === 0) validationErrors.push({ field: 'items', message: 'At least one service item is required' });
    
    const invalidItems = formData.items.filter(item => !item.product_or_service_code);
    if (invalidItems.length > 0) validationErrors.push({ field: 'items', message: 'All items must have a service code' });
    
    return { valid: validationErrors.length === 0, errors: validationErrors };
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setErrors([]);

      const validation = validateForm();
      if (!validation.valid) {
        setErrors(validation.errors);
        alert('Please fix the validation errors before saving.');
        return;
      }

      // Merge structured vital signs and clinical data into supporting_info
      const dataToSave = {
        ...formData,
        supporting_info: buildSupportingInfoArray()
      };
      // Remove structured fields (already merged into supporting_info)
      delete dataToSave.vital_signs;
      delete dataToSave.clinical_info;
      delete dataToSave.admission_info;

      let response;
      if (isEditMode) {
        response = await api.updatePriorAuthorization(id, dataToSave);
      } else {
        response = await api.createPriorAuthorization(dataToSave);
      }

      alert(isEditMode ? 'Prior authorization updated successfully!' : 'Prior authorization created successfully!');
      navigate(`/prior-authorizations/${response.data.id}`);
    } catch (error) {
      console.error('Error saving prior authorization:', error);
      const errorMsg = error.response?.data?.error || error.message;
      setErrors([{ field: 'general', message: errorMsg }]);
      alert(`Error: ${errorMsg}`);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAndSend = async () => {
    try {
      setSending(true);
      setErrors([]);

      const validation = validateForm();
      if (!validation.valid) {
        setErrors(validation.errors);
        alert('Please fix the validation errors before sending.');
        return;
      }

      // Merge structured vital signs and clinical data into supporting_info
      const dataToSave = {
        ...formData,
        supporting_info: buildSupportingInfoArray()
      };
      // Remove structured fields (already merged into supporting_info)
      delete dataToSave.vital_signs;
      delete dataToSave.clinical_info;
      delete dataToSave.admission_info;

      // Save first
      let savedId = id;
      if (!isEditMode) {
        const createResponse = await api.createPriorAuthorization(dataToSave);
        savedId = createResponse.data.id;
      } else {
        await api.updatePriorAuthorization(id, dataToSave);
      }

      // Then send to NPHIES
      const sendResponse = await api.sendPriorAuthorizationToNphies(savedId);
      
      if (sendResponse.success) {
        alert(`Successfully sent to NPHIES!\nPre-Auth Ref: ${sendResponse.nphiesResponse?.preAuthRef || 'Pending'}`);
        navigate(`/prior-authorizations/${savedId}`);
      } else {
        alert(`NPHIES Error: ${sendResponse.error?.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error sending to NPHIES:', error);
      const errorMsg = error.response?.data?.error || error.message;
      setErrors([{ field: 'general', message: errorMsg }]);
      alert(`Error: ${errorMsg}`);
    } finally {
      setSending(false);
    }
  };

  const handlePreview = async () => {
    try {
      setPreviewLoading(true);
      setErrors([]);

      const validation = validateForm();
      if (!validation.valid) {
        setErrors(validation.errors);
        alert('Please fix the validation errors before previewing.');
        return;
      }

      // Merge structured vital signs and clinical data into supporting_info
      const dataToPreview = {
        ...formData,
        supporting_info: buildSupportingInfoArray()
      };
      // Remove structured fields (already merged into supporting_info)
      delete dataToPreview.vital_signs;
      delete dataToPreview.clinical_info;
      delete dataToPreview.admission_info;

      const response = await api.previewPriorAuthorizationBundle(dataToPreview);
      setPreviewData(response);
      setShowPreview(true);
    } catch (error) {
      console.error('Error generating preview:', error);
      const errorMsg = error.response?.data?.error || error.message;
      alert(`Error: ${errorMsg}`);
    } finally {
      setPreviewLoading(false);
    }
  };

  // Test send to NPHIES (validates without saving to DB)
  const handleTestSend = async () => {
    try {
      setTestSending(true);
      setErrors([]);

      const validation = validateForm();
      if (!validation.valid) {
        setErrors(validation.errors);
        alert('Please fix the validation errors before testing.');
        return;
      }

      // Merge structured vital signs and clinical data into supporting_info
      const dataToTest = {
        ...formData,
        supporting_info: buildSupportingInfoArray()
      };
      // Remove structured fields (already merged into supporting_info)
      delete dataToTest.vital_signs;
      delete dataToTest.clinical_info;
      delete dataToTest.admission_info;

      const response = await api.testSendPriorAuthorization(dataToTest);
      setPreviewData(response);
      setShowPreview(true);
    } catch (error) {
      console.error('Error testing NPHIES send:', error);
      const errorMsg = error.response?.data?.error || error.message;
      setPreviewData({
        success: false,
        outcome: 'error',
        errors: [{
          code: 'REQUEST_ERROR',
          message: errorMsg
        }],
        entities: {
          patient: { name: patients.find(p => p.patient_id === formData.patient_id)?.name || 'N/A' },
          provider: { name: providers.find(p => p.provider_id === formData.provider_id)?.provider_name || 'N/A' },
          insurer: { name: insurers.find(i => i.insurer_id === formData.insurer_id)?.insurer_name || 'N/A' }
        }
      });
      setShowPreview(true);
    } finally {
      setTestSending(false);
    }
  };

  const handleCopyJson = () => {
    const bundleData = previewData?.data || previewData?.fhirBundle;
    if (bundleData) {
      navigator.clipboard.writeText(JSON.stringify(bundleData, null, 2));
      alert('FHIR Bundle copied to clipboard!');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="relative">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-primary-purple/20"></div>
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-transparent border-t-primary-purple absolute top-0"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10">
      {/* Inject custom DatePicker styles */}
      <style>{datePickerStyles}</style>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate('/prior-authorizations')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {isEditMode ? 'Edit Prior Authorization' : 'New Prior Authorization'}
            </h1>
            <p className="text-gray-600">
              {isEditMode ? `Request #: ${formData.request_number}` : 'Create a new NPHIES prior authorization request'}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/prior-authorizations')}>
            Cancel
          </Button>
          <Button 
            variant="outline" 
            onClick={handlePreview} 
            disabled={previewLoading || testSending || saving || sending}
          >
            <Eye className="h-4 w-4 mr-2" />
            {previewLoading ? 'Building...' : 'Preview JSON'}
          </Button>
          <Button 
            variant="outline"
            onClick={handleTestSend} 
            disabled={testSending || previewLoading || saving || sending}
            className="border-amber-500 text-amber-600 hover:bg-amber-50"
          >
            <Shield className="h-4 w-4 mr-2" />
            {testSending ? 'Testing...' : 'Test with NPHIES'}
          </Button>
          <Button onClick={handleSave} disabled={saving || sending || previewLoading || testSending}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Saving...' : 'Save Draft'}
          </Button>
          <Button 
            onClick={handleSaveAndSend} 
            disabled={saving || sending || previewLoading || testSending}
            className="bg-gradient-to-r from-blue-500 to-blue-600"
          >
            <Send className="h-4 w-4 mr-2" />
            {sending ? 'Sending...' : 'Save & Send to NPHIES'}
          </Button>
        </div>
      </div>

      {/* Validation Errors */}
      {errors.length > 0 && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-red-500 mt-0.5" />
              <div>
                <p className="font-medium text-red-800">Please fix the following errors:</p>
                <ul className="mt-2 text-sm text-red-700 list-disc list-inside">
                  {errors.map((error, index) => (
                    <li key={index}>{error.message}</li>
                  ))}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs Navigation */}
      <div className="flex gap-2 bg-gray-100 p-1 rounded-lg w-fit flex-wrap">
        <TabButton active={activeTab === 'basic'} onClick={() => setActiveTab('basic')} icon={FileText}>
          Basic Info
        </TabButton>
        <TabButton active={activeTab === 'parties'} onClick={() => setActiveTab('parties')} icon={Building}>
          Parties
        </TabButton>
        <TabButton active={activeTab === 'clinical'} onClick={() => setActiveTab('clinical')} icon={Stethoscope}>
          Clinical
        </TabButton>
        <TabButton active={activeTab === 'vitals'} onClick={() => setActiveTab('vitals')} icon={Activity}>
          Vitals & Clinical
        </TabButton>
        <TabButton active={activeTab === 'items'} onClick={() => setActiveTab('items')} icon={Receipt}>
          Items
        </TabButton>
        <TabButton active={activeTab === 'supporting'} onClick={() => setActiveTab('supporting')} icon={Paperclip}>
          Supporting Info
        </TabButton>
      </div>

      {/* Basic Info Tab */}
      {activeTab === 'basic' && (
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
            <CardDescription>Core details about the prior authorization request</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Authorization Type *</Label>
                <Select
                  value={AUTH_TYPE_OPTIONS.find(opt => opt.value === formData.auth_type)}
                  onChange={(option) => handleChange('auth_type', option?.value || 'professional')}
                  options={AUTH_TYPE_OPTIONS}
                  styles={selectStyles}
                  menuPortalTarget={document.body}
                />
              </div>
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select
                  value={PRIORITY_OPTIONS.find(opt => opt.value === formData.priority)}
                  onChange={(option) => handleChange('priority', option?.value || 'normal')}
                  options={PRIORITY_OPTIONS}
                  styles={selectStyles}
                  menuPortalTarget={document.body}
                />
              </div>
              <div className="space-y-2">
                <Label>Encounter Class</Label>
                <Select
                  value={ENCOUNTER_CLASS_OPTIONS.find(opt => opt.value === formData.encounter_class)}
                  onChange={(option) => handleChange('encounter_class', option?.value || 'ambulatory')}
                  options={ENCOUNTER_CLASS_OPTIONS}
                  styles={selectStyles}
                  menuPortalTarget={document.body}
                />
              </div>
            </div>

            <hr className="border-gray-200" />

            {/* Encounter Period - Format depends on encounter class:
                - AMB (Ambulatory): date only "2023-12-04"
                - SS/IMP (Short Stay/Inpatient): dateTime "2023-12-04T10:25:00+03:00" */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>
                  Encounter Start {['inpatient', 'daycase'].includes(formData.encounter_class) ? 'Date & Time' : 'Date'}
                </Label>
                <div className="datepicker-wrapper">
                  <DatePicker
                    selected={formData.encounter_start ? new Date(formData.encounter_start) : null}
                    onChange={(date) => handleChange('encounter_start', date ? (
                      ['inpatient', 'daycase'].includes(formData.encounter_class) 
                        ? date.toISOString() 
                        : date.toISOString().split('T')[0]
                    ) : '')}
                    showTimeSelect={['inpatient', 'daycase'].includes(formData.encounter_class)}
                    dateFormat={['inpatient', 'daycase'].includes(formData.encounter_class) ? "yyyy-MM-dd HH:mm" : "yyyy-MM-dd"}
                    className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                    placeholderText={['inpatient', 'daycase'].includes(formData.encounter_class) ? "Select date & time" : "Select date"}
                  />
                  <Calendar className="datepicker-icon h-4 w-4" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>
                  Encounter End {['inpatient', 'daycase'].includes(formData.encounter_class) ? 'Date & Time' : 'Date'} (Optional)
                </Label>
                <div className="datepicker-wrapper">
                  <DatePicker
                    selected={formData.encounter_end ? new Date(formData.encounter_end) : null}
                    onChange={(date) => handleChange('encounter_end', date ? (
                      ['inpatient', 'daycase'].includes(formData.encounter_class) 
                        ? date.toISOString() 
                        : date.toISOString().split('T')[0]
                    ) : '')}
                    showTimeSelect={['inpatient', 'daycase'].includes(formData.encounter_class)}
                    dateFormat={['inpatient', 'daycase'].includes(formData.encounter_class) ? "yyyy-MM-dd HH:mm" : "yyyy-MM-dd"}
                    isClearable
                    className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                    placeholderText={['inpatient', 'daycase'].includes(formData.encounter_class) ? "Select date & time (optional)" : "Select date (optional)"}
                  />
                  <Calendar className="datepicker-icon h-4 w-4" />
                </div>
              </div>
            </div>

            <hr className="border-gray-200" />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="total_amount">Total Amount</Label>
                <div className="flex gap-2">
                  <Input
                    id="total_amount"
                    type="number"
                    step="0.01"
                    value={formData.total_amount}
                    onChange={(e) => handleChange('total_amount', e.target.value)}
                    placeholder="0.00"
                  />
                  <Button type="button" variant="outline" size="sm" onClick={calculateTotal}>
                    Calculate
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Currency</Label>
                <Select
                  value={CURRENCY_OPTIONS.find(opt => opt.value === formData.currency)}
                  onChange={(option) => handleChange('currency', option?.value || 'SAR')}
                  options={CURRENCY_OPTIONS}
                  styles={selectStyles}
                  menuPortalTarget={document.body}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="eligibility_ref">Eligibility Reference</Label>
                <Input
                  id="eligibility_ref"
                  value={formData.eligibility_ref || ''}
                  onChange={(e) => handleChange('eligibility_ref', e.target.value)}
                  placeholder="Optional eligibility reference"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Parties Tab */}
      {activeTab === 'parties' && (
        <Card>
          <CardHeader>
            <CardTitle>Involved Parties</CardTitle>
            <CardDescription>Select the patient, provider, and insurer for this request</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Patient */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Patient *
                </Label>
                <Select
                  value={patients.map(p => ({ value: p.patient_id, label: `${p.name}${p.identifier ? ` (${p.identifier})` : ''}` })).find(opt => opt.value == formData.patient_id)}
                  onChange={(option) => handleChange('patient_id', option?.value || '')}
                  options={patients.map(p => ({ value: p.patient_id, label: `${p.name}${p.identifier ? ` (${p.identifier})` : ''}` }))}
                  styles={selectStyles}
                  placeholder="Search and select patient..."
                  isClearable
                  isSearchable
                  menuPortalTarget={document.body}
                />
              </div>

              {/* Provider */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Building className="h-4 w-4" />
                  Provider *
                </Label>
                <Select
                  value={providers.map(p => ({ value: p.provider_id, label: `${p.provider_name || p.name}${p.nphies_id ? ` (${p.nphies_id})` : ''}` })).find(opt => opt.value == formData.provider_id)}
                  onChange={(option) => handleChange('provider_id', option?.value || '')}
                  options={providers.map(p => ({ value: p.provider_id, label: `${p.provider_name || p.name}${p.nphies_id ? ` (${p.nphies_id})` : ''}` }))}
                  styles={selectStyles}
                  placeholder="Search and select provider..."
                  isClearable
                  isSearchable
                  menuPortalTarget={document.body}
                />
              </div>

              {/* Coverage - Shows patient's insurance coverages */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4" />
                  Coverage {formData.patient_id && '*'}
                  {loadingCoverages && <span className="text-xs text-gray-500">(Loading...)</span>}
                </Label>
                {!formData.patient_id ? (
                  <div className="text-sm text-gray-500 p-3 bg-gray-50 rounded-md">
                    Select a patient first to see their insurance coverages
                  </div>
                ) : coverages.length === 0 && !loadingCoverages ? (
                  <div className="text-sm text-amber-600 p-3 bg-amber-50 rounded-md">
                    No coverages found for this patient. You can manually select an insurer below.
                  </div>
                ) : (
                  <Select
                    value={coverages.map(c => ({ 
                      value: c.coverage_id, 
                      label: `${c.insurer_name || 'Unknown Insurer'} - ${c.member_id || c.policy_number}${c.plan_name ? ` (${c.plan_name})` : ''}`
                    })).find(opt => opt.value == formData.coverage_id)}
                    onChange={(option) => handleCoverageChange(option?.value || '')}
                    options={coverages.map(c => ({ 
                      value: c.coverage_id, 
                      label: `${c.insurer_name || 'Unknown Insurer'} - ${c.member_id || c.policy_number}${c.plan_name ? ` (${c.plan_name})` : ''}`
                    }))}
                    styles={selectStyles}
                    placeholder="Select coverage..."
                    isClearable
                    isSearchable
                    isLoading={loadingCoverages}
                    menuPortalTarget={document.body}
                  />
                )}
              </div>

              {/* Insurer - Auto-filled from coverage, or manual selection */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Insurer *
                  {formData.coverage_id && <span className="text-xs text-green-600">(from coverage)</span>}
                </Label>
                <Select
                  value={insurers.map(i => ({ value: i.insurer_id, label: `${i.insurer_name || i.name}${i.nphies_id ? ` (${i.nphies_id})` : ''}` })).find(opt => opt.value == formData.insurer_id)}
                  onChange={(option) => handleChange('insurer_id', option?.value || '')}
                  options={insurers.map(i => ({ value: i.insurer_id, label: `${i.insurer_name || i.name}${i.nphies_id ? ` (${i.nphies_id})` : ''}` }))}
                  styles={selectStyles}
                  placeholder="Search and select insurer..."
                  isClearable
                  isSearchable
                  menuPortalTarget={document.body}
                  isDisabled={!!formData.coverage_id}
                />
                {formData.coverage_id && (
                  <p className="text-xs text-gray-500">Clear coverage selection to manually choose insurer</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Clinical Tab */}
      {activeTab === 'clinical' && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Diagnoses</CardTitle>
                <CardDescription>ICD-10 diagnosis codes for this authorization</CardDescription>
              </div>
              <Button type="button" onClick={addDiagnosis} variant="outline" size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Diagnosis
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {formData.diagnoses.map((diagnosis, index) => (
              <div key={index} className="flex items-start gap-4 p-4 border rounded-lg bg-gray-50">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary-purple text-white flex items-center justify-center text-sm font-medium">
                  {diagnosis.sequence}
                </div>
                <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="space-y-2 md:col-span-2">
                    <Label>ICD-10 Code *</Label>
                    {formData.auth_type === 'dental' ? (
                      <Select
                        value={DENTAL_ICD10_OPTIONS.find(opt => opt.value === diagnosis.diagnosis_code)}
                        onChange={(option) => {
                          handleDiagnosisChange(index, 'diagnosis_code', option?.value || '');
                          handleDiagnosisChange(index, 'diagnosis_display', option?.label?.split(' - ')[1] || '');
                        }}
                        options={DENTAL_ICD10_OPTIONS}
                        styles={selectStyles}
                        placeholder="Select dental diagnosis..."
                        isClearable
                        isSearchable
                        menuPortalTarget={document.body}
                      />
                    ) : (
                      <Input
                        value={diagnosis.diagnosis_code}
                        onChange={(e) => handleDiagnosisChange(index, 'diagnosis_code', e.target.value)}
                        placeholder="e.g., J06.9"
                      />
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Input
                      value={diagnosis.diagnosis_display || ''}
                      onChange={(e) => handleDiagnosisChange(index, 'diagnosis_display', e.target.value)}
                      placeholder="Diagnosis description"
                      disabled={formData.auth_type === 'dental'}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <Select
                      value={DIAGNOSIS_TYPE_OPTIONS.find(opt => opt.value === diagnosis.diagnosis_type)}
                      onChange={(option) => handleDiagnosisChange(index, 'diagnosis_type', option?.value || 'principal')}
                      options={DIAGNOSIS_TYPE_OPTIONS}
                      styles={selectStyles}
                      menuPortalTarget={document.body}
                    />
                  </div>
                </div>
                {formData.diagnoses.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-red-500 hover:text-red-700"
                    onClick={() => removeDiagnosis(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Vitals & Clinical Tab */}
      {activeTab === 'vitals' && (
        <div className="space-y-6">
          {/* Vital Signs Section */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-red-500" />
                    Vital Signs
                  </CardTitle>
                  <CardDescription>Patient vital signs measured during the encounter</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-sm text-gray-500">Measurement Time:</Label>
                  <div className="datepicker-wrapper w-52">
                    <DatePicker
                      selected={formData.vital_signs.measurement_time ? new Date(formData.vital_signs.measurement_time) : null}
                      onChange={(date) => handleVitalSignChange('measurement_time', date ? date.toISOString() : null)}
                      showTimeSelect
                      dateFormat="yyyy-MM-dd HH:mm"
                      className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                      placeholderText="Select time"
                    />
                    <Calendar className="datepicker-icon h-4 w-4" />
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {VITAL_SIGNS_FIELDS.map((field) => (
                  <div key={field.key} className="space-y-2">
                    <Label htmlFor={field.key} className="text-sm font-medium">
                      {field.label}
                    </Label>
                    <div className="relative">
                      <Input
                        id={field.key}
                        type="number"
                        step="0.1"
                        value={formData.vital_signs[field.key]}
                        onChange={(e) => handleVitalSignChange(field.key, e.target.value)}
                        placeholder={field.placeholder}
                        className="pr-16"
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <Badge variant="secondary" className="font-mono text-xs">
                          {field.unitLabel}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Quick BMI calculation display */}
              {formData.vital_signs.height && formData.vital_signs.weight && (
                <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-sm text-blue-800">
                    <strong>Calculated BMI:</strong>{' '}
                    {(parseFloat(formData.vital_signs.weight) / Math.pow(parseFloat(formData.vital_signs.height) / 100, 2)).toFixed(1)} kg/m²
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Clinical Information Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Stethoscope className="h-5 w-5 text-blue-500" />
                Clinical Information
              </CardTitle>
              <CardDescription>Chief complaint, patient history, and clinical findings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Chief Complaint Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="chief_complaint_code">Chief Complaint Code (SNOMED)</Label>
                  <Input
                    id="chief_complaint_code"
                    value={formData.clinical_info.chief_complaint_code}
                    onChange={(e) => handleClinicalInfoChange('chief_complaint_code', e.target.value)}
                    placeholder="e.g., 21522001"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="chief_complaint_display">Chief Complaint Description</Label>
                  <Input
                    id="chief_complaint_display"
                    value={formData.clinical_info.chief_complaint_display}
                    onChange={(e) => handleClinicalInfoChange('chief_complaint_display', e.target.value)}
                    placeholder="e.g., Abdominal pain"
                  />
                </div>
              </div>

              {/* Clinical Text Fields */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {CLINICAL_TEXT_FIELDS.map((field) => (
                  <div key={field.key} className="space-y-2">
                    <Label htmlFor={field.key}>{field.label}</Label>
                    <textarea
                      id={field.key}
                      value={formData.clinical_info[field.key]}
                      onChange={(e) => handleClinicalInfoChange(field.key, e.target.value)}
                      placeholder={field.placeholder}
                      rows={3}
                      className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-purple/30 resize-none"
                    />
                    <p className="text-xs text-gray-400 text-right">
                      {formData.clinical_info[field.key]?.length || 0} characters
                    </p>
                  </div>
                ))}
              </div>

              {/* Investigation Result */}
              <div className="space-y-2">
                <Label>Investigation Result</Label>
                <Select
                  value={INVESTIGATION_RESULT_OPTIONS.find(opt => opt.value === formData.clinical_info.investigation_result)}
                  onChange={(option) => handleClinicalInfoChange('investigation_result', option?.value || '')}
                  options={INVESTIGATION_RESULT_OPTIONS}
                  styles={selectStyles}
                  placeholder="Select investigation result status..."
                  isClearable
                  menuPortalTarget={document.body}
                />
              </div>
            </CardContent>
          </Card>

          {/* Admission Information Section - Only for inpatient/daycase */}
          {['inpatient', 'daycase'].includes(formData.encounter_class) && (
            <Card className="border-amber-200 bg-amber-50/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building className="h-5 w-5 text-amber-600" />
                  Admission Information
                </CardTitle>
                <CardDescription>
                  Required for {formData.encounter_class === 'inpatient' ? 'inpatient' : 'day case'} encounters
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {ADMISSION_FIELDS.map((field) => (
                    <div key={field.key} className="space-y-2">
                      <Label htmlFor={field.key}>{field.label}</Label>
                      <div className="relative">
                        <Input
                          id={field.key}
                          type="number"
                          step={field.key === 'estimated_length_of_stay' ? '1' : '0.1'}
                          value={formData.admission_info[field.key]}
                          onChange={(e) => handleAdmissionInfoChange(field.key, e.target.value)}
                          placeholder={field.placeholder}
                          className="pr-16"
                        />
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          <Badge variant="secondary" className="font-mono text-xs">
                            {field.unitLabel}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Non-admission hint */}
          {!['inpatient', 'daycase'].includes(formData.encounter_class) && (
            <div className="flex items-center gap-2 p-4 bg-gray-50 border border-gray-200 rounded-lg">
              <AlertCircle className="h-5 w-5 text-gray-400" />
              <span className="text-sm text-gray-600">
                Admission information fields are only shown for Inpatient or Day Case encounters. 
                Current encounter type: <strong className="capitalize">{formData.encounter_class}</strong>
              </span>
            </div>
          )}

          {/* Summary of what will be submitted */}
          <Card className="bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                Data Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                <div className="bg-white rounded-lg p-2 border">
                  <p className="text-gray-500 text-xs">Vital Signs</p>
                  <p className="font-medium">
                    {VITAL_SIGNS_FIELDS.filter(f => formData.vital_signs[f.key]).length} / {VITAL_SIGNS_FIELDS.length}
                  </p>
                </div>
                <div className="bg-white rounded-lg p-2 border">
                  <p className="text-gray-500 text-xs">Clinical Fields</p>
                  <p className="font-medium">
                    {CLINICAL_TEXT_FIELDS.filter(f => formData.clinical_info[f.key]).length} / {CLINICAL_TEXT_FIELDS.length}
                  </p>
                </div>
                <div className="bg-white rounded-lg p-2 border">
                  <p className="text-gray-500 text-xs">Chief Complaint</p>
                  <p className="font-medium">
                    {formData.clinical_info.chief_complaint_code ? 'Set' : 'Not set'}
                  </p>
                </div>
                <div className="bg-white rounded-lg p-2 border">
                  <p className="text-gray-500 text-xs">Investigation Result</p>
                  <p className="font-medium">
                    {formData.clinical_info.investigation_result || 'Not set'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Items Tab */}
      {activeTab === 'items' && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Service Items</CardTitle>
                <CardDescription>Services, procedures, or medications requiring authorization</CardDescription>
              </div>
              <Button type="button" onClick={addItem} variant="outline" size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Item
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {formData.items.map((item, index) => (
              <div key={index} className="p-4 border rounded-lg bg-gray-50 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-primary-purple text-white flex items-center justify-center text-sm font-medium">
                      {item.sequence}
                    </div>
                    <span className="font-medium">Item {item.sequence}</span>
                  </div>
                  {formData.items.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-red-500 hover:text-red-700"
                      onClick={() => removeItem(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Service/Procedure Code *</Label>
                    <Input
                      value={item.product_or_service_code}
                      onChange={(e) => handleItemChange(index, 'product_or_service_code', e.target.value)}
                      placeholder="CPT/SNOMED code"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Input
                      value={item.product_or_service_display || ''}
                      onChange={(e) => handleItemChange(index, 'product_or_service_display', e.target.value)}
                      placeholder="Service description"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label>Quantity</Label>
                    <Input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Unit Price</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={item.unit_price}
                      onChange={(e) => handleItemChange(index, 'unit_price', e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Net Amount</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={item.net_amount}
                      onChange={(e) => handleItemChange(index, 'net_amount', e.target.value)}
                      placeholder="Auto-calculated"
                      className="bg-gray-100"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Service Date</Label>
                    <div className="datepicker-wrapper">
                      <DatePicker
                        selected={item.serviced_date ? new Date(item.serviced_date) : null}
                        onChange={(date) => handleItemChange(index, 'serviced_date', date ? date.toISOString().split('T')[0] : '')}
                        dateFormat="yyyy-MM-dd"
                        className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                        placeholderText="Select date"
                      />
                      <Calendar className="datepicker-icon h-4 w-4" />
                    </div>
                  </div>
                </div>

                {/* Type-specific fields */}
                {formData.auth_type === 'dental' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Dental Procedure Code (oral-health-op)</Label>
                        <Input
                          value={item.product_or_service_code || ''}
                          onChange={(e) => {
                            handleItemChange(index, 'product_or_service_code', e.target.value);
                            handleItemChange(index, 'product_or_service_system', 'http://nphies.sa/terminology/CodeSystem/oral-health-op');
                          }}
                          placeholder="e.g. 97613-07-00"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Procedure Description</Label>
                        <Input
                          value={item.product_or_service_display || ''}
                          onChange={(e) => handleItemChange(index, 'product_or_service_display', e.target.value)}
                          placeholder="e.g. Lithium disilicate ceramic crown"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Tooth Number (FDI)</Label>
                        <Select
                          value={FDI_TOOTH_OPTIONS.find(opt => opt.value === item.tooth_number)}
                          onChange={(option) => {
                            handleItemChange(index, 'tooth_number', option?.value || '');
                            handleItemChange(index, 'tooth_display', option?.display || '');
                          }}
                          options={FDI_TOOTH_OPTIONS}
                          styles={selectStyles}
                          placeholder="Select tooth..."
                          isClearable
                          isSearchable
                          menuPortalTarget={document.body}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Tooth Surfaces (select multiple if needed)</Label>
                      <Select
                        value={TOOTH_SURFACE_OPTIONS.filter(opt => 
                          item.tooth_surface?.split(',').map(s => s.trim()).includes(opt.value)
                        )}
                        onChange={(options) => {
                          const surfaces = options?.map(opt => opt.value).join(',') || '';
                          handleItemChange(index, 'tooth_surface', surfaces);
                        }}
                        options={TOOTH_SURFACE_OPTIONS}
                        styles={selectStyles}
                        placeholder="Select tooth surfaces..."
                        isClearable
                        isMulti
                        menuPortalTarget={document.body}
                      />
                      <p className="text-xs text-gray-500">
                        M=Mesial, O=Occlusal, D=Distal, B=Buccal, L=Lingual
                      </p>
                    </div>
                  </div>
                )}

                {formData.auth_type === 'vision' && (
                  <div className="space-y-2">
                    <Label>Eye</Label>
                    <Select
                      value={EYE_OPTIONS.find(opt => opt.value === item.eye)}
                      onChange={(option) => handleItemChange(index, 'eye', option?.value || '')}
                      options={EYE_OPTIONS}
                      styles={selectStyles}
                      placeholder="Select eye..."
                      isClearable
                      menuPortalTarget={document.body}
                    />
                  </div>
                )}

                {formData.auth_type === 'pharmacy' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Medication Code</Label>
                      <Input
                        value={item.medication_code || ''}
                        onChange={(e) => handleItemChange(index, 'medication_code', e.target.value)}
                        placeholder="NPHIES medication code"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Days Supply</Label>
                      <Input
                        type="number"
                        value={item.days_supply || ''}
                        onChange={(e) => handleItemChange(index, 'days_supply', e.target.value)}
                        placeholder="Required for pharmacy"
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* Total */}
            <div className="flex justify-end pt-4 border-t">
              <div className="text-right">
                <p className="text-sm text-gray-500">Total Amount</p>
                <p className="text-2xl font-bold text-primary-purple">
                  {formatAmount(formData.total_amount || getCalculatedTotal(), formData.currency)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Supporting Info Tab */}
      {activeTab === 'supporting' && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Supporting Information</CardTitle>
                <CardDescription>Additional clinical justification and attachments</CardDescription>
              </div>
              <div className="flex gap-2">
                <Button type="button" onClick={() => addSupportingInfo('info')} variant="outline" size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Info
                </Button>
                {formData.auth_type === 'pharmacy' && (
                  <Button type="button" onClick={() => addSupportingInfo('days-supply')} variant="outline" size="sm">
                    <Pill className="h-4 w-4 mr-2" />
                    Add Days Supply
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {formData.supporting_info.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Paperclip className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p>No supporting information added</p>
                <p className="text-sm">Click "Add Info" to add clinical justification</p>
              </div>
            ) : (
              formData.supporting_info.map((info, index) => (
                <div key={index} className="flex items-start gap-4 p-4 border rounded-lg bg-gray-50">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-accent-cyan text-white flex items-center justify-center text-sm font-medium">
                    {info.sequence}
                  </div>
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Category</Label>
                      <Select
                        value={SUPPORTING_INFO_CATEGORY_OPTIONS.find(opt => opt.value === info.category)}
                        onChange={(option) => handleSupportingInfoChange(index, 'category', option?.value || 'info')}
                        options={SUPPORTING_INFO_CATEGORY_OPTIONS}
                        styles={selectStyles}
                        menuPortalTarget={document.body}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Code</Label>
                      <Input
                        value={info.code || ''}
                        onChange={(e) => handleSupportingInfoChange(index, 'code', e.target.value)}
                        placeholder="Code"
                      />
                    </div>
                    {info.category === 'days-supply' ? (
                      <div className="space-y-2">
                        <Label>Days</Label>
                        <Input
                          type="number"
                          value={info.value_quantity || ''}
                          onChange={(e) => handleSupportingInfoChange(index, 'value_quantity', e.target.value)}
                          placeholder="Number of days"
                        />
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Label>Value</Label>
                        <Input
                          value={info.value_string || ''}
                          onChange={(e) => handleSupportingInfoChange(index, 'value_string', e.target.value)}
                          placeholder="Value"
                        />
                      </div>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-red-500 hover:text-red-700"
                    onClick={() => removeSupportingInfo(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))
            )}

            {/* Pharmacy warning */}
            {formData.auth_type === 'pharmacy' && !formData.supporting_info.some(i => i.category === 'days-supply') && (
              <div className="flex items-center gap-2 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <AlertCircle className="h-5 w-5 text-yellow-600" />
                <span className="text-sm text-yellow-800">
                  Pharmacy authorizations require "Days Supply" supporting information
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Preview Modal */}
      {showPreview && previewData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col m-4">
            {/* Modal Header */}
            <div className={`flex items-center justify-between p-6 border-b ${
              previewData.errors?.length > 0 
                ? 'bg-gradient-to-r from-red-50 to-amber-50' 
                : 'bg-gradient-to-r from-blue-50 to-purple-50'
            }`}>
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${
                  previewData.errors?.length > 0 ? 'bg-red-100' : 'bg-blue-100'
                }`}>
                  {previewData.errors?.length > 0 ? (
                    <AlertCircle className="h-6 w-6 text-red-600" />
                  ) : (
                    <Eye className="h-6 w-6 text-blue-600" />
                  )}
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">
                    {previewData.errors?.length > 0 ? 'NPHIES Validation Errors' : 'FHIR Request Preview'}
                  </h2>
                  <p className="text-sm text-gray-600">
                    {previewData.errors?.length > 0 
                      ? `${previewData.errors.length} validation error(s) returned from NPHIES`
                      : 'This is the bundle that will be sent to NPHIES'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {previewData.outcome && (
                  <Badge variant={previewData.outcome === 'error' ? 'destructive' : 'default'}>
                    {previewData.outcome?.toUpperCase()}
                  </Badge>
                )}
                <button
                  onClick={() => setShowPreview(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <XCircle className="h-6 w-6 text-gray-500" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              
              {/* NPHIES Errors Section */}
              {previewData.errors && previewData.errors.length > 0 && (
                <div className="bg-red-50 rounded-xl p-6 border border-red-200">
                  <h3 className="text-lg font-semibold mb-4 text-red-900 flex items-center">
                    <AlertCircle className="h-5 w-5 mr-2" />
                    NPHIES Validation Errors ({previewData.errors.length})
                  </h3>
                  <div className="space-y-3">
                    {previewData.errors.map((err, index) => (
                      <div key={index} className="bg-white rounded-lg p-4 border-l-4 border-red-500">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-2">
                              <Badge variant="destructive" className="font-mono">
                                {err.code}
                              </Badge>
                              <span className="text-sm text-gray-500">Error #{index + 1}</span>
                            </div>
                            <p className="text-red-700 font-medium mb-2">{err.message || err.display}</p>
                            {err.location && (
                              <div className="bg-gray-50 rounded px-3 py-2 mt-2">
                                <p className="text-xs text-gray-600 mb-1">Location in Bundle:</p>
                                <p className="text-sm font-mono text-gray-800">{err.location}</p>
                              </div>
                            )}
                          </div>
                          <XCircle className="h-5 w-5 text-red-500 flex-shrink-0 ml-3" />
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 p-3 bg-amber-50 rounded-lg border border-amber-200">
                    <p className="text-sm text-amber-800">
                      <strong>Tip:</strong> Review the errors above and update your request accordingly. 
                      Common issues include missing required fields, invalid references, or incorrect data formats.
                    </p>
                  </div>
                </div>
              )}

              {/* Entities Summary */}
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                <h3 className="font-semibold text-gray-800 mb-3">Request Summary</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                  <div className="bg-white rounded-lg p-3 border">
                    <p className="text-gray-500 text-xs mb-1">Patient</p>
                    <p className="font-medium">{previewData.entities?.patient?.name || 'N/A'}</p>
                    <p className="text-xs text-gray-400 font-mono">{previewData.entities?.patient?.identifier}</p>
                  </div>
                  <div className="bg-white rounded-lg p-3 border">
                    <p className="text-gray-500 text-xs mb-1">Provider</p>
                    <p className="font-medium">{previewData.entities?.provider?.name || 'N/A'}</p>
                    <p className="text-xs text-gray-400 font-mono">{previewData.entities?.provider?.nphiesId}</p>
                  </div>
                  <div className="bg-white rounded-lg p-3 border">
                    <p className="text-gray-500 text-xs mb-1">Insurer</p>
                    <p className="font-medium">{previewData.entities?.insurer?.name || 'N/A'}</p>
                    <p className="text-xs text-gray-400 font-mono">{previewData.entities?.insurer?.nphiesId}</p>
                  </div>
                  <div className="bg-white rounded-lg p-3 border">
                    <p className="text-gray-500 text-xs mb-1">Authorization Type</p>
                    <p className="font-medium capitalize">{previewData.entities?.authType || formData.auth_type || 'N/A'}</p>
                    <p className="text-xs text-gray-400">
                      {previewData.entities?.itemsCount || formData.items?.length || 0} items
                    </p>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-gray-200 flex flex-wrap gap-2">
                  <Badge variant="outline" className="capitalize">
                    Priority: {formData.priority || 'normal'}
                  </Badge>
                  {formData.encounter_class && (
                    <Badge variant="outline" className="capitalize">
                      Encounter: {formData.encounter_class}
                    </Badge>
                  )}
                  {previewData.nphiesResponseId && (
                    <Badge variant="secondary" className="font-mono text-xs">
                      Response ID: {previewData.nphiesResponseId}
                    </Badge>
                  )}
                </div>
              </div>

              {/* FHIR Bundle JSON */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    FHIR Bundle (JSON)
                  </h3>
                  <Button variant="outline" size="sm" onClick={handleCopyJson}>
                    <Copy className="h-4 w-4 mr-2" />
                    Copy JSON
                  </Button>
                </div>
                <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto text-xs max-h-[400px] overflow-y-auto">
                  {JSON.stringify(previewData.data || previewData.fhirBundle, null, 2)}
                </pre>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 p-6 border-t bg-gray-50">
              <Button variant="outline" onClick={handleCopyJson}>
                <Copy className="h-4 w-4 mr-2" />
                Copy to Clipboard
              </Button>
              <Button onClick={() => setShowPreview(false)}>
                Close Preview
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

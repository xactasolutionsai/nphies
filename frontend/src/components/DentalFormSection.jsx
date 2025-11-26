import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Scan, Heart, ClipboardCheck } from 'lucide-react';
import api from '@/services/api';

export default function DentalFormSection() {
  const [form, setForm] = useState({
    patient: {
      fullName: '',
      idNumber: '',
      dob: '',
      gender: 'male',
      contactPhone: '',
      email: '',
      // Clinical Detail fields
      vitals: {
        bloodPressure: '',
        temperature: '',
        pulse: '',
        respiratoryRate: '',
        weight: '',
        height: ''
      },
      otherConditions: '',
      chiefComplaints: '',
      maritalStatus: '',
      planType: ''
    },
    provider: {
      facilityName: '',
      doctorName: '',
      licenseNumber: '',
      department: '',
      contactPhone: '',
      email: '',
      specialty: 'Dentist'
    },
    coverage: {
      insurer: '',
      contactPerson: '',
      phone: '',
      coverageType: ''
    },
    encounterClass: 'outpatient',
    encounterStart: '',
    encounterEnd: '',
    service: {
      description: '',
      diagnosis: '',
      previousTest: '',
      testResults: '',
      medicalPlan: '',
      startDate: '',
      urgency: 'routine',
      // Dental-specific fields
      toothNumber: '',
      toothSurface: '',
      treatmentType: '',
      anesthesiaType: '',
      cptCodes: '',
      icd10Codes: ''
    },
    // Dental-specific sections
    dental: {
      oralExamination: {
        generalCondition: '',
        oralHygiene: '',
        periodontalStatus: '',
        softTissues: '',
        hardTissues: ''
      },
      radiographs: {
        bitewing: false,
        periapical: false,
        panoramic: false,
        coneBeam: false,
        other: ''
      },
      treatmentPlan: {
        phase1: '',
        phase2: '',
        phase3: '',
        maintenance: ''
      },
      consent: {
        treatmentConsent: '',
        anesthesiaConsent: '',
        radiographConsent: ''
      }
    },
    attachments: []
  });
  const [status, setStatus] = useState({ type: 'idle', message: '' });
  const [preview, setPreview] = useState(null);
  const [lastResponse, setLastResponse] = useState(null);

  const setField = (path, value) => {
    const keys = path.split('.');
    setForm(prev => {
      const newForm = { ...prev };
      let current = newForm;
      for (let i = 0; i < keys.length - 1; i++) {
        current = current[keys[i]] = { ...current[keys[i]] };
      }
      current[keys[keys.length - 1]] = value;
      return newForm;
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setPreview(form);
    setStatus({ type: 'success', message: 'Dental request prepared automatically. Click "AI Check" to validate with n8n.' });
  };

  const handleAICheck = async () => {
    // Auto-generate preview if not exists
    if (!preview) {
      setPreview(form);
    }

    try {
      setStatus({ type: 'idle', message: 'Sending to AI for validation...' });
      
      // Clear old cached URL and get fresh URL
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem('webhookUrl');
      }
      
      // Get webhook URL from localStorage or prompt user
      let webhookUrl = typeof window !== 'undefined' ? window.localStorage.getItem('webhookUrl') || '' : '';
      if (!webhookUrl) {
        const input = typeof window !== 'undefined' ? window.prompt('Enter n8n Webhook URL', 'http://localhost:5678/webhook/check') : '';
        if (input && input.trim().length > 0) {
          window.localStorage.setItem('webhookUrl', input.trim());
          webhookUrl = input.trim();
        } else {
          setStatus({ type: 'error', message: 'No webhook URL provided.' });
          return;
        }
      }

      // Send to n8n webhook
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'dental_request',
          data: preview || form,
          timestamp: new Date().toISOString()
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      setLastResponse(result);
      setStatus({ type: 'success', message: 'AI check completed successfully!' });
    } catch (error) {
      console.error('Error sending to n8n:', error);
      setStatus({ type: 'error', message: error?.message || 'Failed to send to AI check' });
    }
  };

  const toothNumbers = [
    '11', '12', '13', '14', '15', '16', '17', '18',
    '21', '22', '23', '24', '25', '26', '27', '28',
    '31', '32', '33', '34', '35', '36', '37', '38',
    '41', '42', '43', '44', '45', '46', '47', '48'
  ];

  const toothSurfaces = [
    'Mesial', 'Distal', 'Buccal', 'Lingual', 'Occlusal', 'Incisal', 'Cervical'
  ];

  const treatmentTypes = [
    'Preventive', 'Restorative', 'Endodontic', 'Periodontal', 'Oral Surgery',
    'Orthodontic', 'Prosthodontic', 'Cosmetic', 'Emergency', 'Other'
  ];

  const anesthesiaTypes = [
    'Local Anesthesia', 'Nitrous Oxide', 'IV Sedation', 'General Anesthesia', 'None'
  ];

  // Backend lookups (patients by ID/Iqama, provider by license, insurer by name or id)
  const fetchPatient = async () => {
    const id = form.patient.idNumber?.trim();
    if (!id) {
      setStatus({ type: 'error', message: 'Enter ID/Iqama to fetch patient.' });
      return;
    }
    try {
      setStatus({ type: 'idle', message: 'Fetching patient…' });
      // Try direct lookup; if backend expects different param, try search fallback
      let data;
      try {
        data = await api.getPatient(id);
      } catch {
        const res = await api.getPatients({ identifier: id, limit: 1 });
        data = (res?.data && res.data[0]) || (Array.isArray(res) ? res[0] : null);
      }
      if (!data) throw new Error('Patient not found');
      const p = data.data || data;
      setField('patient.fullName', p.name || p.full_name || p.fullName || '');
      setField('patient.dob', p.birthdate || p.dob || '');
      setField('patient.gender', (p.gender || '').toLowerCase() || 'male');
      setField('patient.contactPhone', p.phone || p.contactPhone || '');
      setField('patient.email', p.email || '');
      setStatus({ type: 'success', message: 'Patient info retrieved.' });
    } catch (e) {
      setStatus({ type: 'error', message: e?.message || 'Failed to fetch patient' });
    }
  };

  const fetchProvider = async () => {
    const license = form.provider.licenseNumber?.trim();
    if (!license) {
      setStatus({ type: 'error', message: 'Enter License/NPI to fetch provider.' });
      return;
    }
    try {
      setStatus({ type: 'idle', message: 'Fetching provider…' });
      let data;
      try {
        data = await api.getProvider(license);
      } catch {
        const res = await api.getProviders({ license: license, limit: 1 });
        data = (res?.data && res.data[0]) || (Array.isArray(res) ? res[0] : null);
      }
      if (!data) throw new Error('Provider not found');
      const pr = data.data || data;
      setField('provider.facilityName', pr.facility_name || pr.facilityName || pr.name || '');
      setField('provider.doctorName', pr.doctor_name || pr.doctorName || pr.contact_person || '');
      setField('provider.department', pr.department || '');
      setField('provider.contactPhone', pr.phone || pr.contactPhone || '');
      setField('provider.email', pr.email || '');
      setStatus({ type: 'success', message: 'Provider info retrieved.' });
    } catch (e) {
      setStatus({ type: 'error', message: e?.message || 'Failed to fetch provider' });
    }
  };

  const fetchInsurer = async () => {
    const nameOrId = form.coverage.insurer?.trim();
    if (!nameOrId) {
      setStatus({ type: 'error', message: 'Enter Insurance Company name or ID to fetch.' });
      return;
    }
    try {
      setStatus({ type: 'idle', message: 'Fetching insurer…' });
      let data;
      
      // Check if input looks like a UUID (insurer_id)
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(nameOrId);
      
      if (isUUID) {
        // Try to get by ID first if it looks like a UUID
        try {
          data = await api.getInsurer(nameOrId);
        } catch {
          // Fall back to search if ID lookup fails
          const res = await api.getInsurers({ search: nameOrId, limit: 1 });
          data = (res?.data && res.data[0]) || (Array.isArray(res) ? res[0] : null);
        }
      } else {
        // Search by name directly
        const res = await api.getInsurers({ search: nameOrId, limit: 1 });
        data = (res?.data && res.data[0]) || (Array.isArray(res) ? res[0] : null);
      }
      
      if (!data) throw new Error('Insurer not found');
      const ins = data.data || data;
      setField('coverage.insurer', ins.name || ins.insurer_name || '');
      setField('coverage.contactPerson', ins.contact_person || ins.contactPerson || '');
      setField('coverage.phone', ins.phone || ins.contact_phone || '');
      setField('coverage.coverageType', ins.plan_type || ins.coverageType || '');
      setStatus({ type: 'success', message: 'Insurer info retrieved.' });
    } catch (e) {
      setStatus({ type: 'error', message: e?.message || 'Failed to fetch insurer' });
    }
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Patient Information */}
        <Card>
          <CardHeader>
            <CardTitle>Patient Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
                <input
                  type="text"
                  value={form.patient.fullName}
                  onChange={(e) => setField('patient.fullName', e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                  placeholder="e.g. Ahmed Al-Qahtani"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ID/Iqama *</label>
                <div className="flex gap-2">
                <input
                  type="text"
                  value={form.patient.idNumber}
                  onChange={(e) => setField('patient.idNumber', e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                  placeholder="e.g. 1023456789"
                  required
                />
                <button type="button" onClick={fetchPatient} className="px-3 py-2 rounded-lg bg-primary-purple text-white hover:opacity-90">Fetch</button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth *</label>
                <input
                  type="date"
                  value={form.patient.dob}
                  onChange={(e) => setField('patient.dob', e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Gender *</label>
                <select
                  value={form.patient.gender}
                  onChange={(e) => setField('patient.gender', e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                  required
                >
                  <option value="">Select gender…</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                  <option value="unknown">Unknown</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input
                  type="text"
                  value={form.patient.contactPhone}
                  onChange={(e) => setField('patient.contactPhone', e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                  placeholder="e.g. +966512345678"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={form.patient.email}
                  onChange={(e) => setField('patient.email', e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                  placeholder="e.g. ahmed@example.com"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Clinical Detail Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Scan className="h-5 w-5 text-primary-purple" />
              Clinical Detail Information
            </CardTitle>
            <CardDescription>Essential clinical information for proper diagnosis and treatment planning</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* Vitals Section */}
              <div>
                <h4 className="text-lg font-semibold text-gray-800 mb-4">Vital Signs</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Blood Pressure</label>
                    <input
                      type="text"
                      value={form.patient.vitals.bloodPressure}
                      onChange={(e) => setField('patient.vitals.bloodPressure', e.target.value)}
                      className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                      placeholder="e.g. 120/80"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Temperature</label>
                    <input
                      type="text"
                      value={form.patient.vitals.temperature}
                      onChange={(e) => setField('patient.vitals.temperature', e.target.value)}
                      className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                      placeholder="e.g. 37.0 °C"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Pulse</label>
                    <input
                      type="text"
                      value={form.patient.vitals.pulse}
                      onChange={(e) => setField('patient.vitals.pulse', e.target.value)}
                      className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                      placeholder="e.g. 72 bpm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Respiratory Rate</label>
                    <input
                      type="text"
                      value={form.patient.vitals.respiratoryRate}
                      onChange={(e) => setField('patient.vitals.respiratoryRate', e.target.value)}
                      className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                      placeholder="e.g. 16"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Weight</label>
                    <input
                      type="text"
                      value={form.patient.vitals.weight}
                      onChange={(e) => setField('patient.vitals.weight', e.target.value)}
                      className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                      placeholder="e.g. 70 kg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Height</label>
                    <input
                      type="text"
                      value={form.patient.vitals.height}
                      onChange={(e) => setField('patient.vitals.height', e.target.value)}
                      className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                      placeholder="e.g. 175 cm"
                    />
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-2">Required documentation to justify urgency and necessity of the service</p>
              </div>

              {/* Other Clinical Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Other Conditions</label>
                  <textarea
                    value={form.patient.otherConditions}
                    onChange={(e) => setField('patient.otherConditions', e.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                    placeholder="e.g. Patient has known history of Hypertension and Asthma"
                    rows={3}
                  />
                  <p className="text-xs text-gray-500 mt-1">Chronic, non-acute conditions that may affect treatment</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Chief Complaints and Main Symptoms *</label>
                  <textarea
                    value={form.patient.chiefComplaints}
                    onChange={(e) => setField('patient.chiefComplaints', e.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                    placeholder="e.g. Severe tooth pain for 3 days, swelling in lower jaw"
                    rows={3}
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">Primary complaints before formal diagnosis</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Marital Status</label>
                  <select
                    value={form.patient.maritalStatus}
                    onChange={(e) => setField('patient.maritalStatus', e.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                  >
                    <option value="">Select marital status...</option>
                    <option value="single">Single</option>
                    <option value="married">Married</option>
                    <option value="divorced">Divorced</option>
                    <option value="widowed">Widowed</option>
                    <option value="separated">Separated</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Plan Type</label>
                  <select
                    value={form.patient.planType}
                    onChange={(e) => setField('patient.planType', e.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                  >
                    <option value="">Select plan type...</option>
                    <option value="individual">Individual</option>
                    <option value="family">Family</option>
                    <option value="corporate">Corporate</option>
                    <option value="government">Government</option>
                  </select>
                  <p className="text-xs text-gray-500 mt-1">Used to verify eligibility and scope of coverage</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Provider Information */}
        <Card>
          <CardHeader>
            <CardTitle>Provider Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Facility *</label>
                <input
                  type="text"
                  value={form.provider.facilityName}
                  onChange={(e) => setField('provider.facilityName', e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                  placeholder="e.g. King Faisal Dental Center"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Dentist *</label>
                <input
                  type="text"
                  value={form.provider.doctorName}
                  onChange={(e) => setField('provider.doctorName', e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                  placeholder="e.g. Dr. Sara Al-Shehri"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">License/NPI *</label>
                <div className="flex gap-2">
                <input
                  type="text"
                  value={form.provider.licenseNumber}
                  onChange={(e) => setField('provider.licenseNumber', e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                  placeholder="e.g. 12-345678"
                  required
                />
                <button type="button" onClick={fetchProvider} className="px-3 py-2 rounded-lg bg-primary-purple text-white hover:opacity-90">Fetch</button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Specialty</label>
                <select
                  value={form.provider.specialty}
                  onChange={(e) => setField('provider.specialty', e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                >
                  <option value="Dentist">General Dentist</option>
                  <option value="Orthodontist">Orthodontist</option>
                  <option value="Oral Surgeon">Oral Surgeon</option>
                  <option value="Periodontist">Periodontist</option>
                  <option value="Endodontist">Endodontist</option>
                  <option value="Prosthodontist">Prosthodontist</option>
                  <option value="Pediatric Dentist">Pediatric Dentist</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input
                  type="text"
                  value={form.provider.contactPhone}
                  onChange={(e) => setField('provider.contactPhone', e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                  placeholder="e.g. +966511223344"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={form.provider.email}
                  onChange={(e) => setField('provider.email', e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                  placeholder="e.g. referral@dental.sa"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Coverage Information */}
        <Card>
          <CardHeader>
            <CardTitle>Coverage Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Insurance Company *</label>
                <div className="flex gap-2">
                <input
                  type="text"
                  value={form.coverage.insurer}
                  onChange={(e) => setField('coverage.insurer', e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                  placeholder="e.g. Bupa Arabia"
                  required
                />
                <button type="button" onClick={fetchInsurer} className="px-3 py-2 rounded-lg bg-primary-purple text-white hover:opacity-90">Fetch</button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contact Person</label>
                <input
                  type="text"
                  value={form.coverage.contactPerson}
                  onChange={(e) => setField('coverage.contactPerson', e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                  placeholder="e.g. John Smith"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input
                  type="text"
                  value={form.coverage.phone}
                  onChange={(e) => setField('coverage.phone', e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                  placeholder="e.g. +966501234567"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Dental Examination */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Heart className="h-5 w-5 text-primary-purple" />
              Dental Examination
            </CardTitle>
            <CardDescription>Comprehensive oral examination findings</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">General Oral Condition</label>
                  <textarea
                    value={form.dental.oralExamination.generalCondition}
                    onChange={(e) => setField('dental.oralExamination.generalCondition', e.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                    placeholder="e.g. Good oral hygiene, no visible lesions"
                    rows={3}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Oral Hygiene Status</label>
                  <select
                    value={form.dental.oralExamination.oralHygiene}
                    onChange={(e) => setField('dental.oralExamination.oralHygiene', e.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                  >
                    <option value="">Select status...</option>
                    <option value="excellent">Excellent</option>
                    <option value="good">Good</option>
                    <option value="fair">Fair</option>
                    <option value="poor">Poor</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Periodontal Status</label>
                  <textarea
                    value={form.dental.oralExamination.periodontalStatus}
                    onChange={(e) => setField('dental.oralExamination.periodontalStatus', e.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                    placeholder="e.g. Gingivitis present, no bone loss"
                    rows={3}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Soft Tissues</label>
                  <textarea
                    value={form.dental.oralExamination.softTissues}
                    onChange={(e) => setField('dental.oralExamination.softTissues', e.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                    placeholder="e.g. Normal mucosa, no lesions"
                    rows={3}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Hard Tissues (Teeth)</label>
                  <textarea
                    value={form.dental.oralExamination.hardTissues}
                    onChange={(e) => setField('dental.oralExamination.hardTissues', e.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                    placeholder="e.g. Caries on tooth 16, 26, 36, 46. Missing teeth: 18, 28, 38, 48"
                    rows={3}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Radiographs */}
        <Card>
          <CardHeader>
            <CardTitle>Radiographic Examination</CardTitle>
            <CardDescription>Required radiographs for diagnosis and treatment planning</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={form.dental.radiographs.bitewing}
                    onChange={(e) => setField('dental.radiographs.bitewing', e.target.checked)}
                    className="rounded border-gray-300 text-primary-purple focus:ring-primary-purple"
                  />
                  <span className="text-sm font-medium">Bitewing</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={form.dental.radiographs.periapical}
                    onChange={(e) => setField('dental.radiographs.periapical', e.target.checked)}
                    className="rounded border-gray-300 text-primary-purple focus:ring-primary-purple"
                  />
                  <span className="text-sm font-medium">Periapical</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={form.dental.radiographs.panoramic}
                    onChange={(e) => setField('dental.radiographs.panoramic', e.target.checked)}
                    className="rounded border-gray-300 text-primary-purple focus:ring-primary-purple"
                  />
                  <span className="text-sm font-medium">Panoramic</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={form.dental.radiographs.coneBeam}
                    onChange={(e) => setField('dental.radiographs.coneBeam', e.target.checked)}
                    className="rounded border-gray-300 text-primary-purple focus:ring-primary-purple"
                  />
                  <span className="text-sm font-medium">Cone Beam CT</span>
                </label>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Other Radiographs</label>
                <input
                  type="text"
                  value={form.dental.radiographs.other}
                  onChange={(e) => setField('dental.radiographs.other', e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                  placeholder="e.g. Cephalometric, TMJ series"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Treatment Information */}
        <Card>
          <CardHeader>
            <CardTitle>Treatment Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tooth Number *</label>
                  <select
                    value={form.service.toothNumber}
                    onChange={(e) => setField('service.toothNumber', e.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                    required
                  >
                    <option value="">Select tooth...</option>
                    {toothNumbers.map((tooth) => (
                      <option key={tooth} value={tooth}>{tooth}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tooth Surface</label>
                  <select
                    value={form.service.toothSurface}
                    onChange={(e) => setField('service.toothSurface', e.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                  >
                    <option value="">Select surface...</option>
                    {toothSurfaces.map((surface) => (
                      <option key={surface} value={surface}>{surface}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Treatment Type *</label>
                  <select
                    value={form.service.treatmentType}
                    onChange={(e) => setField('service.treatmentType', e.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                    required
                  >
                    <option value="">Select treatment...</option>
                    {treatmentTypes.map((type) => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Anesthesia Type</label>
                  <select
                    value={form.service.anesthesiaType}
                    onChange={(e) => setField('service.anesthesiaType', e.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                  >
                    <option value="">Select anesthesia...</option>
                    {anesthesiaTypes.map((type) => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Service Description *</label>
                  <textarea
                    value={form.service.description}
                    onChange={(e) => setField('service.description', e.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                    placeholder="e.g. Root canal treatment on tooth 16"
                    rows={3}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Diagnosis *</label>
                  <textarea
                    value={form.service.diagnosis}
                    onChange={(e) => setField('service.diagnosis', e.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                    placeholder="e.g. Irreversible pulpitis, tooth 16"
                    rows={3}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">CPT Codes</label>
                  <input
                    type="text"
                    value={form.service.cptCodes}
                    onChange={(e) => setField('service.cptCodes', e.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                    placeholder="e.g. 3320, 3321"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ICD-10 Codes</label>
                  <input
                    type="text"
                    value={form.service.icd10Codes}
                    onChange={(e) => setField('service.icd10Codes', e.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                    placeholder="e.g. K04.1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Previous Dental Treatment</label>
                  <textarea
                    value={form.service.previousTest}
                    onChange={(e) => setField('service.previousTest', e.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                    placeholder="e.g. Filling on tooth 16 (2023), Crown on tooth 26 (2022)"
                    rows={3}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Treatment Plan</label>
                  <textarea
                    value={form.service.medicalPlan}
                    onChange={(e) => setField('service.medicalPlan', e.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                    placeholder="e.g. Phase 1: Root canal treatment, Phase 2: Crown placement"
                    rows={3}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Treatment Phases */}
        <Card>
          <CardHeader>
            <CardTitle>Treatment Phases</CardTitle>
            <CardDescription>Detailed treatment planning phases</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phase 1 (Emergency/Urgent)</label>
                  <textarea
                    value={form.dental.treatmentPlan.phase1}
                    onChange={(e) => setField('dental.treatmentPlan.phase1', e.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                    placeholder="e.g. Pain relief, emergency treatment"
                    rows={3}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phase 2 (Restorative)</label>
                  <textarea
                    value={form.dental.treatmentPlan.phase2}
                    onChange={(e) => setField('dental.treatmentPlan.phase2', e.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                    placeholder="e.g. Fillings, crowns, bridges"
                    rows={3}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phase 3 (Rehabilitation)</label>
                  <textarea
                    value={form.dental.treatmentPlan.phase3}
                    onChange={(e) => setField('dental.treatmentPlan.phase3', e.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                    placeholder="e.g. Implants, prosthetics, orthodontics"
                    rows={3}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Maintenance</label>
                  <textarea
                    value={form.dental.treatmentPlan.maintenance}
                    onChange={(e) => setField('dental.treatmentPlan.maintenance', e.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                    placeholder="e.g. Regular cleanings, follow-up visits"
                    rows={3}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Consent Forms */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5 text-primary-purple" />
              Consent Forms
            </CardTitle>
            <CardDescription>Required consent documentation for dental treatment</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Treatment Consent *</label>
                <textarea
                  value={form.dental.consent.treatmentConsent}
                  onChange={(e) => setField('dental.consent.treatmentConsent', e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                  placeholder="I consent to the proposed dental treatment and understand the risks and benefits..."
                  rows={3}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Anesthesia Consent</label>
                <textarea
                  value={form.dental.consent.anesthesiaConsent}
                  onChange={(e) => setField('dental.consent.anesthesiaConsent', e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                  placeholder="I consent to the administration of local anesthesia..."
                  rows={2}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Radiograph Consent</label>
                <textarea
                  value={form.dental.consent.radiographConsent}
                  onChange={(e) => setField('dental.consent.radiographConsent', e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                  placeholder="I consent to the taking of dental radiographs for diagnostic purposes..."
                  rows={2}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Attachments */}
        <Card>
          <CardHeader>
            <CardTitle>Attachments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center text-gray-500 py-8">
              <Scan className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <p>File upload functionality can be added here</p>
            </div>
          </CardContent>
        </Card>

        {status.type !== 'idle' && status.message && (
          <div className={
            status.type === 'success' ?
              'text-green-700 bg-green-50 border border-green-200 rounded-xl px-4 py-3' :
              status.type === 'error' ?
              'text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3' :
              'text-blue-700 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3'
          }>
            {status.message}
          </div>
        )}

        {lastResponse && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-semibold">AI Response</h2>
            </div>
            
            <div className="bg-gray-50 rounded-lg p-4 border">
              <div className="space-y-2">
                {typeof lastResponse === 'object' && lastResponse !== null ? (
                  Object.entries(lastResponse).map(([key, value]) => (
                    <div key={key} className="flex items-start space-x-3">
                      <span className="font-medium text-gray-700 min-w-0 flex-shrink-0">{key}:</span>
                      <span className="text-gray-900 break-words">
                        {typeof value === 'boolean' ? (value ? 'true' : 'false') : 
                         typeof value === 'object' ? JSON.stringify(value) : 
                         String(value)}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="text-gray-900 whitespace-pre-wrap">
                    {typeof lastResponse === 'string' ? lastResponse : JSON.stringify(lastResponse, null, 2)}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => {
              setForm({
                patient: { 
                  fullName: '', idNumber: '', dob: '', gender: 'male', contactPhone: '', email: '',
                  vitals: { bloodPressure: '', temperature: '', pulse: '', respiratoryRate: '', weight: '', height: '' },
                  otherConditions: '', chiefComplaints: '', maritalStatus: '', planType: ''
                },
                provider: { facilityName: '', doctorName: '', licenseNumber: '', department: '', contactPhone: '', email: '', specialty: 'Dentist' },
                coverage: { insurer: '', contactPerson: '', phone: '', coverageType: '' },
                encounterClass: 'outpatient',
                encounterStart: '',
                encounterEnd: '',
                service: { description: '', diagnosis: '', previousTest: '', testResults: '', medicalPlan: '', startDate: '', urgency: 'routine', toothNumber: '', toothSurface: '', treatmentType: '', anesthesiaType: '', cptCodes: '', icd10Codes: '' },
                dental: {
                  oralExamination: { generalCondition: '', oralHygiene: '', periodontalStatus: '', softTissues: '', hardTissues: '' },
                  radiographs: { bitewing: false, periapical: false, panoramic: false, coneBeam: false, other: '' },
                  treatmentPlan: { phase1: '', phase2: '', phase3: '', maintenance: '' },
                  consent: { treatmentConsent: '', anesthesiaConsent: '', radiographConsent: '' }
                },
                attachments: []
              });
              setPreview(null);
              setLastResponse(null);
              setStatus({ type: 'idle', message: '' });
            }}
            className="px-4 py-2 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50 transition"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={handleAICheck}
            className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white px-5 py-2 rounded-xl transition"
          >
            <Scan className="h-4 w-4" />
            AI Check
          </button>
        </div>
      </form>
    </div>
  );
}

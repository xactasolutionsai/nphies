import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Scan, Eye, ClipboardCheck } from 'lucide-react';
import api from '@/services/api';

export default function EyesightFormSection() {
  const [form, setForm] = useState({
    patient: {
      fullName: '',
      idNumber: '',
      dob: '',
      gender: 'male',
      contactPhone: '',
      email: ''
    },
    provider: {
      facilityName: '',
      doctorName: '',
      licenseNumber: '',
      department: '',
      contactPhone: '',
      email: '',
      specialty: 'Ophthalmology'
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
    eyesight: {
      visualAcuity: {
        right: { uncorrected: '', corrected: '' },
        left: { uncorrected: '', corrected: '' }
      },
      refraction: {
        right: { sphere: '', cylinder: '', axis: '' },
        left: { sphere: '', cylinder: '', axis: '' },
        add: ''
      },
      iop: { right: '', left: '' },
      slitLamp: '',
      fundus: '',
      diagnosis: '',
      plan: '',
      lensSpecs: {
        regularLensType: { glass: false, plastic: false, none: false },
        specifications: {
          multiCoated: false, varilux: false, light: false, aspheric: false, bifocal: false,
          medium: false, lenticular: false, singleVision: false, dark: false, safetyThickness: false,
          antiReflectingCoating: false, photosensitive: false, highIndex: false, colored: false, antiScratch: false
        },
        contactLensType: { permanent: false, disposal: false },
        frames: { yes: false, no: false, numberOfPairs: '' },
        cost: { lenses: '', frame: '' }
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
    setStatus({ type: 'success', message: 'Eyesight request prepared automatically. Click "AI Check" to validate with n8n.' });
  };

  const handleAICheck = async () => {
    if (!preview) setPreview(form);
    try {
      setStatus({ type: 'idle', message: 'Sending to AI for validation...' });
      if (typeof window !== 'undefined') window.localStorage.removeItem('webhookUrl');
      let webhookUrl = typeof window !== 'undefined' ? window.localStorage.getItem('webhookUrl') || '' : '';
      if (!webhookUrl) {
        const input = typeof window !== 'undefined' ? window.prompt('Enter n8n Webhook URL', 'http://localhost:5678/webhook/check') : '';
        if (input && input.trim()) { window.localStorage.setItem('webhookUrl', input.trim()); webhookUrl = input.trim(); }
        else { setStatus({ type: 'error', message: 'No webhook URL provided.' }); return; }
      }
      const response = await fetch(webhookUrl, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'eyesight_request', data: preview || form, timestamp: new Date().toISOString() }),
      });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const result = await response.json();
      setLastResponse(result);
      setStatus({ type: 'success', message: 'AI check completed successfully!' });
    } catch (error) {
      console.error('Error sending to n8n:', error);
      setStatus({ type: 'error', message: error?.message || 'Failed to send to AI check' });
    }
  };

  // Backend lookups
  const fetchPatient = async () => {
    const id = form.patient.idNumber?.trim();
    if (!id) { setStatus({ type: 'error', message: 'Enter ID/Iqama to fetch patient.' }); return; }
    try {
      setStatus({ type: 'idle', message: 'Fetching patient…' });
      let data;
      try { data = await api.getPatient(id); }
      catch { const res = await api.getPatients({ identifier: id, limit: 1 }); data = (res?.data && res.data[0]) || (Array.isArray(res) ? res[0] : null); }
      if (!data) throw new Error('Patient not found');
      const p = data.data || data;
      setField('patient.fullName', p.name || p.full_name || p.fullName || '');
      setField('patient.dob', p.birthdate || p.dob || '');
      setField('patient.gender', (p.gender || '').toLowerCase() || 'male');
      setField('patient.contactPhone', p.phone || p.contactPhone || '');
      setField('patient.email', p.email || '');
      setStatus({ type: 'success', message: 'Patient info retrieved.' });
    } catch (e) { setStatus({ type: 'error', message: e?.message || 'Failed to fetch patient' }); }
  };

  const fetchProvider = async () => {
    const license = form.provider.licenseNumber?.trim();
    if (!license) { setStatus({ type: 'error', message: 'Enter License/NPI to fetch provider.' }); return; }
    try {
      setStatus({ type: 'idle', message: 'Fetching provider…' });
      let data;
      try { data = await api.getProvider(license); }
      catch { const res = await api.getProviders({ license: license, limit: 1 }); data = (res?.data && res.data[0]) || (Array.isArray(res) ? res[0] : null); }
      if (!data) throw new Error('Provider not found');
      const pr = data.data || data;
      setField('provider.facilityName', pr.facility_name || pr.facilityName || pr.name || '');
      setField('provider.doctorName', pr.doctor_name || pr.doctorName || pr.contact_person || '');
      setField('provider.department', pr.department || '');
      setField('provider.contactPhone', pr.phone || pr.contactPhone || '');
      setField('provider.email', pr.email || '');
      setStatus({ type: 'success', message: 'Provider info retrieved.' });
    } catch (e) { setStatus({ type: 'error', message: e?.message || 'Failed to fetch provider' }); }
  };

  const fetchInsurer = async () => {
    const nameOrId = form.coverage.insurer?.trim();
    if (!nameOrId) { setStatus({ type: 'error', message: 'Enter Insurance Company name or ID to fetch.' }); return; }
    try {
      setStatus({ type: 'idle', message: 'Fetching insurer…' });
      let data;
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(nameOrId);
      if (isUUID) {
        try { data = await api.getInsurer(nameOrId); }
        catch { const res = await api.getInsurers({ search: nameOrId, limit: 1 }); data = (res?.data && res.data[0]) || (Array.isArray(res) ? res[0] : null); }
      } else {
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
    } catch (e) { setStatus({ type: 'error', message: e?.message || 'Failed to fetch insurer' }); }
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
                <input type="text" value={form.patient.fullName} onChange={(e) => setField('patient.fullName', e.target.value)} className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30" placeholder="e.g. Ahmed Al-Qahtani" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ID/Iqama *</label>
                <div className="flex gap-2">
                  <input type="text" value={form.patient.idNumber} onChange={(e) => setField('patient.idNumber', e.target.value)} className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30" placeholder="e.g. 1023456789" required />
                  <button type="button" onClick={fetchPatient} className="px-3 py-2 rounded-lg bg-primary-purple text-white hover:opacity-90">Fetch</button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth *</label>
                <input type="date" value={form.patient.dob} onChange={(e) => setField('patient.dob', e.target.value)} className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30" required />
              </div>
              <div>
                <label className="block text sm font-medium text-gray-700 mb-1">Gender *</label>
                <select value={form.patient.gender} onChange={(e) => setField('patient.gender', e.target.value)} className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30" required>
                  <option value="">Select gender…</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                  <option value="unknown">Unknown</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input type="text" value={form.patient.contactPhone} onChange={(e) => setField('patient.contactPhone', e.target.value)} className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30" placeholder="e.g. +966512345678" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input type="email" value={form.patient.email} onChange={(e) => setField('patient.email', e.target.value)} className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30" placeholder="e.g. ahmed@example.com" />
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
                  placeholder="e.g. King Faisal Eye Center"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Doctor *</label>
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
                  <option value="Ophthalmology">Ophthalmology</option>
                  <option value="Optometry">Optometry</option>
                  <option value="Retina Specialist">Retina Specialist</option>
                  <option value="Cornea Specialist">Cornea Specialist</option>
                  <option value="Glaucoma Specialist">Glaucoma Specialist</option>
                  <option value="Pediatric Ophthalmology">Pediatric Ophthalmology</option>
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
                  placeholder="e.g. referral@eye.sa"
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

        {/* Eyesight Examination */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-primary-purple" />
              Eyesight Examination
            </CardTitle>
            <CardDescription>Comprehensive ophthalmic assessment (OCAF 2.0)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* Visual Acuity */}
              <div>
                <h4 className="text-lg font-semibold text-gray-800 mb-4">Visual Acuity</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Right Eye (Uncorrected)</label>
                    <input type="text" value={form.eyesight.visualAcuity.right.uncorrected} onChange={(e) => setField('eyesight.visualAcuity.right.uncorrected', e.target.value)} className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30" placeholder="e.g. 6/12 or 20/40" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Right Eye (Corrected)</label>
                    <input type="text" value={form.eyesight.visualAcuity.right.corrected} onChange={(e) => setField('eyesight.visualAcuity.right.corrected', e.target.value)} className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30" placeholder="e.g. 6/6 or 20/20" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Left Eye (Uncorrected)</label>
                    <input type="text" value={form.eyesight.visualAcuity.left.uncorrected} onChange={(e) => setField('eyesight.visualAcuity.left.uncorrected', e.target.value)} className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30" placeholder="e.g. 6/18 or 20/60" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Left Eye (Corrected)</label>
                    <input type="text" value={form.eyesight.visualAcuity.left.corrected} onChange={(e) => setField('eyesight.visualAcuity.left.corrected', e.target.value)} className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30" placeholder="e.g. 6/9 or 20/30" />
                  </div>
                </div>
              </div>

              {/* Refraction */}
              <div>
                <h4 className="text-lg font-semibold text-gray-800 mb-4">Refraction</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Right Sphere (DS)</label>
                    <input type="text" value={form.eyesight.refraction.right.sphere} onChange={(e) => setField('eyesight.refraction.right.sphere', e.target.value)} className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30" placeholder="e.g. -2.00" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Right Cylinder (DC)</label>
                    <input type="text" value={form.eyesight.refraction.right.cylinder} onChange={(e) => setField('eyesight.refraction.right.cylinder', e.target.value)} className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30" placeholder="e.g. -0.75" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Right Axis (°)</label>
                    <input type="text" value={form.eyesight.refraction.right.axis} onChange={(e) => setField('eyesight.refraction.right.axis', e.target.value)} className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30" placeholder="e.g. 170" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Left Sphere (DS)</label>
                    <input type="text" value={form.eyesight.refraction.left.sphere} onChange={(e) => setField('eyesight.refraction.left.sphere', e.target.value)} className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30" placeholder="e.g. -1.50" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Left Cylinder (DC)</label>
                    <input type="text" value={form.eyesight.refraction.left.cylinder} onChange={(e) => setField('eyesight.refraction.left.cylinder', e.target.value)} className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30" placeholder="e.g. -0.50" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Left Axis (°)</label>
                    <input type="text" value={form.eyesight.refraction.left.axis} onChange={(e) => setField('eyesight.refraction.left.axis', e.target.value)} className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30" placeholder="e.g. 10" />
                  </div>
                  <div className="md:col-span-3">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Addition (Near)</label>
                    <input type="text" value={form.eyesight.refraction.add} onChange={(e) => setField('eyesight.refraction.add', e.target.value)} className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30" placeholder="e.g. +2.00" />
                  </div>
                </div>
              </div>

              {/* IOP & Slit Lamp */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Intraocular Pressure (mmHg)</label>
                  <div className="grid grid-cols-2 gap-2">
                    <input type="text" value={form.eyesight.iop.right} onChange={(e) => setField('eyesight.iop.right', e.target.value)} className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30" placeholder="Right (e.g. 14)" />
                    <input type="text" value={form.eyesight.iop.left} onChange={(e) => setField('eyesight.iop.left', e.target.value)} className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30" placeholder="Left (e.g. 15)" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Slit-Lamp Examination</label>
                  <textarea value={form.eyesight.slitLamp} onChange={(e) => setField('eyesight.slitLamp', e.target.value)} className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30" placeholder="Lids, conjunctiva, cornea, anterior chamber, iris, lens" rows={3} />
                </div>
              </div>

              {/* Fundus */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fundus Examination</label>
                  <textarea value={form.eyesight.fundus} onChange={(e) => setField('eyesight.fundus', e.target.value)} className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30" placeholder="Optic disc, macula, vessels, periphery" rows={3} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Diagnosis</label>
                  <textarea value={form.eyesight.diagnosis} onChange={(e) => setField('eyesight.diagnosis', e.target.value)} className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30" placeholder="e.g. Cataract, Glaucoma, Refractive error" rows={3} />
                </div>
              </div>

              {/* Plan */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Management Plan</label>
                <textarea value={form.eyesight.plan} onChange={(e) => setField('eyesight.plan', e.target.value)} className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30" placeholder="e.g. Medications, surgery referral, follow-up" rows={3} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Lens and Frame Specifications */}
        <Card>
          <CardHeader>
            <CardTitle>Lens and Frame Specifications</CardTitle>
            <CardDescription>Specify lens type, frame options, and estimated costs</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* Regular Lenses Type */}
              <div>
                <h4 className="text-lg font-semibold text-gray-800 mb-4">Regular Lenses Type</h4>
                <div className="flex gap-6">
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={form.eyesight.lensSpecs.regularLensType.glass}
                      onChange={(e) => setField('eyesight.lensSpecs.regularLensType.glass', e.target.checked)}
                      className="rounded border-gray-300 text-primary-purple focus:ring-primary-purple"
                    />
                    <span className="text-sm font-medium">Glass</span>
                  </label>
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={form.eyesight.lensSpecs.regularLensType.plastic}
                      onChange={(e) => setField('eyesight.lensSpecs.regularLensType.plastic', e.target.checked)}
                      className="rounded border-gray-300 text-primary-purple focus:ring-primary-purple"
                    />
                    <span className="text-sm font-medium">Plastic</span>
                  </label>
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={form.eyesight.lensSpecs.regularLensType.none}
                      onChange={(e) => setField('eyesight.lensSpecs.regularLensType.none', e.target.checked)}
                      className="rounded border-gray-300 text-primary-purple focus:ring-primary-purple"
                    />
                    <span className="text-sm font-medium">None</span>
                  </label>
                </div>
              </div>

              {/* Lenses Specification */}
              <div>
                <h4 className="text-lg font-semibold text-gray-800 mb-4">Lenses Specification</h4>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={form.eyesight.lensSpecs.specifications.multiCoated}
                        onChange={(e) => setField('eyesight.lensSpecs.specifications.multiCoated', e.target.checked)}
                        className="rounded border-gray-300 text-primary-purple focus:ring-primary-purple"
                      />
                      <span className="text-sm font-medium">Multi-coated</span>
                    </label>
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={form.eyesight.lensSpecs.specifications.varilux}
                        onChange={(e) => setField('eyesight.lensSpecs.specifications.varilux', e.target.checked)}
                        className="rounded border-gray-300 text-primary-purple focus:ring-primary-purple"
                      />
                      <span className="text-sm font-medium">Varilux</span>
                    </label>
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={form.eyesight.lensSpecs.specifications.light}
                        onChange={(e) => setField('eyesight.lensSpecs.specifications.light', e.target.checked)}
                        className="rounded border-gray-300 text-primary-purple focus:ring-primary-purple"
                      />
                      <span className="text-sm font-medium">Light</span>
                    </label>
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={form.eyesight.lensSpecs.specifications.aspheric}
                        onChange={(e) => setField('eyesight.lensSpecs.specifications.aspheric', e.target.checked)}
                        className="rounded border-gray-300 text-primary-purple focus:ring-primary-purple"
                      />
                      <span className="text-sm font-medium">Aspheric</span>
                    </label>
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={form.eyesight.lensSpecs.specifications.bifocal}
                        onChange={(e) => setField('eyesight.lensSpecs.specifications.bifocal', e.target.checked)}
                        className="rounded border-gray-300 text-primary-purple focus:ring-primary-purple"
                      />
                      <span className="text-sm font-medium">Bifocal</span>
                    </label>
                  </div>
                  <div className="space-y-2">
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={form.eyesight.lensSpecs.specifications.medium}
                        onChange={(e) => setField('eyesight.lensSpecs.specifications.medium', e.target.checked)}
                        className="rounded border-gray-300 text-primary-purple focus:ring-primary-purple"
                      />
                      <span className="text-sm font-medium">Medium</span>
                    </label>
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={form.eyesight.lensSpecs.specifications.lenticular}
                        onChange={(e) => setField('eyesight.lensSpecs.specifications.lenticular', e.target.checked)}
                        className="rounded border-gray-300 text-primary-purple focus:ring-primary-purple"
                      />
                      <span className="text-sm font-medium">Lenticular</span>
                    </label>
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={form.eyesight.lensSpecs.specifications.singleVision}
                        onChange={(e) => setField('eyesight.lensSpecs.specifications.singleVision', e.target.checked)}
                        className="rounded border-gray-300 text-primary-purple focus:ring-primary-purple"
                      />
                      <span className="text-sm font-medium">Single Vision</span>
                    </label>
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={form.eyesight.lensSpecs.specifications.dark}
                        onChange={(e) => setField('eyesight.lensSpecs.specifications.dark', e.target.checked)}
                        className="rounded border-gray-300 text-primary-purple focus:ring-primary-purple"
                      />
                      <span className="text-sm font-medium">Dark</span>
                    </label>
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={form.eyesight.lensSpecs.specifications.safetyThickness}
                        onChange={(e) => setField('eyesight.lensSpecs.specifications.safetyThickness', e.target.checked)}
                        className="rounded border-gray-300 text-primary-purple focus:ring-primary-purple"
                      />
                      <span className="text-sm font-medium">Safety Thickness</span>
                    </label>
                  </div>
                  <div className="space-y-2">
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={form.eyesight.lensSpecs.specifications.antiReflectingCoating}
                        onChange={(e) => setField('eyesight.lensSpecs.specifications.antiReflectingCoating', e.target.checked)}
                        className="rounded border-gray-300 text-primary-purple focus:ring-primary-purple"
                      />
                      <span className="text-sm font-medium">Anti-reflecting coating</span>
                    </label>
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={form.eyesight.lensSpecs.specifications.photosensitive}
                        onChange={(e) => setField('eyesight.lensSpecs.specifications.photosensitive', e.target.checked)}
                        className="rounded border-gray-300 text-primary-purple focus:ring-primary-purple"
                      />
                      <span className="text-sm font-medium">Photosensitive</span>
                    </label>
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={form.eyesight.lensSpecs.specifications.highIndex}
                        onChange={(e) => setField('eyesight.lensSpecs.specifications.highIndex', e.target.checked)}
                        className="rounded border-gray-300 text-primary-purple focus:ring-primary-purple"
                      />
                      <span className="text-sm font-medium">High Index</span>
                    </label>
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={form.eyesight.lensSpecs.specifications.colored}
                        onChange={(e) => setField('eyesight.lensSpecs.specifications.colored', e.target.checked)}
                        className="rounded border-gray-300 text-primary-purple focus:ring-primary-purple"
                      />
                      <span className="text-sm font-medium">Colored</span>
                    </label>
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={form.eyesight.lensSpecs.specifications.antiScratch}
                        onChange={(e) => setField('eyesight.lensSpecs.specifications.antiScratch', e.target.checked)}
                        className="rounded border-gray-300 text-primary-purple focus:ring-primary-purple"
                      />
                      <span className="text-sm font-medium">Anti-Scratch</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Contact Lenses Type */}
              <div>
                <h4 className="text-lg font-semibold text-gray-800 mb-4">Contact Lenses Type</h4>
                <div className="flex gap-6">
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={form.eyesight.lensSpecs.contactLensType.permanent}
                      onChange={(e) => setField('eyesight.lensSpecs.contactLensType.permanent', e.target.checked)}
                      className="rounded border-gray-300 text-primary-purple focus:ring-primary-purple"
                    />
                    <span className="text-sm font-medium">Permanent</span>
                  </label>
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={form.eyesight.lensSpecs.contactLensType.disposal}
                      onChange={(e) => setField('eyesight.lensSpecs.contactLensType.disposal', e.target.checked)}
                      className="rounded border-gray-300 text-primary-purple focus:ring-primary-purple"
                    />
                    <span className="text-sm font-medium">Disposal</span>
                  </label>
                </div>
              </div>

              {/* Frames */}
              <div>
                <h4 className="text-lg font-semibold text-gray-800 mb-4">Frames</h4>
                <div className="space-y-4">
                  <div className="flex gap-6">
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={form.eyesight.lensSpecs.frames.yes}
                        onChange={(e) => setField('eyesight.lensSpecs.frames.yes', e.target.checked)}
                        className="rounded border-gray-300 text-primary-purple focus:ring-primary-purple"
                      />
                      <span className="text-sm font-medium">Yes</span>
                    </label>
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={form.eyesight.lensSpecs.frames.no}
                        onChange={(e) => setField('eyesight.lensSpecs.frames.no', e.target.checked)}
                        className="rounded border-gray-300 text-primary-purple focus:ring-primary-purple"
                      />
                      <span className="text-sm font-medium">No</span>
                    </label>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Please specify # of pairs:</label>
                    <input
                      type="number"
                      value={form.eyesight.lensSpecs.frames.numberOfPairs}
                      onChange={(e) => setField('eyesight.lensSpecs.frames.numberOfPairs', e.target.value)}
                      className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                      placeholder="e.g. 2"
                    />
                  </div>
                </div>
              </div>

              {/* Estimated Cost */}
              <div>
                <h4 className="text-lg font-semibold text-gray-800 mb-4">Estimated Cost</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Lenses: SR.</label>
                    <input
                      type="number"
                      value={form.eyesight.lensSpecs.cost.lenses}
                      onChange={(e) => setField('eyesight.lensSpecs.cost.lenses', e.target.value)}
                      className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                      placeholder="e.g. 500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Frame: SR.</label>
                    <input
                      type="number"
                      value={form.eyesight.lensSpecs.cost.frame}
                      onChange={(e) => setField('eyesight.lensSpecs.cost.frame', e.target.value)}
                      className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                      placeholder="e.g. 300"
                    />
                  </div>
                </div>
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
          <button type="button" onClick={() => {
            setForm({
              patient: { fullName: '', idNumber: '', dob: '', gender: 'male', contactPhone: '', email: '' },
              provider: { facilityName: '', doctorName: '', licenseNumber: '', department: '', contactPhone: '', email: '', specialty: 'Ophthalmology' },
              coverage: { insurer: '', contactPerson: '', phone: '', coverageType: '' },
              encounterClass: 'outpatient', encounterStart: '', encounterEnd: '',
              eyesight: {
                visualAcuity: { right: { uncorrected: '', corrected: '' }, left: { uncorrected: '', corrected: '' } },
                refraction: { right: { sphere: '', cylinder: '', axis: '' }, left: { sphere: '', cylinder: '', axis: '' }, add: '' },
                iop: { right: '', left: '' }, slitLamp: '', fundus: '', diagnosis: '', plan: '',
                lensSpecs: {
                  regularLensType: { glass: false, plastic: false, none: false },
                  specifications: {
                    multiCoated: false, varilux: false, light: false, aspheric: false, bifocal: false,
                    medium: false, lenticular: false, singleVision: false, dark: false, safetyThickness: false,
                    antiReflectingCoating: false, photosensitive: false, highIndex: false, colored: false, antiScratch: false
                  },
                  contactLensType: { permanent: false, disposal: false },
                  frames: { yes: false, no: false, numberOfPairs: '' },
                  cost: { lenses: '', frame: '' }
                }
              },
              attachments: []
            });
            setPreview(null); setLastResponse(null); setStatus({ type: 'idle', message: '' });
          }} className="px-4 py-2 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50 transition">Reset</button>
          <button type="button" onClick={handleAICheck} className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white px-5 py-2 rounded-xl transition">
            <Scan className="h-4 w-4" />
            AI Check
          </button>
        </div>
      </form>
    </div>
  );
}

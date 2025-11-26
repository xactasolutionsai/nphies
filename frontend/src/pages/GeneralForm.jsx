import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import GeneralRequestWizard from '@/components/general-request/GeneralRequestWizard';
import api from '@/services/api';

export default function GeneralForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(!!id);
  const [initialData, setInitialData] = useState(null);
  const isEditMode = !!id;

  useEffect(() => {
    if (id) {
      loadRequestData();
    }
  }, [id]);

  const loadRequestData = async () => {
    try {
      setLoading(true);
      const response = await api.getGeneralRequest(id);
      const data = response.data || response;
      
      // Parse JSONB fields and transform to form structure
      const patientData = typeof data.patient_data === 'string' 
        ? JSON.parse(data.patient_data) 
        : data.patient_data || {};
      
      const insuredData = typeof data.insured_data === 'string'
        ? JSON.parse(data.insured_data)
        : data.insured_data || {};
      
      const providerData = typeof data.provider_data === 'string'
        ? JSON.parse(data.provider_data)
        : data.provider_data || {};
      
      const coverageData = typeof data.coverage_data === 'string'
        ? JSON.parse(data.coverage_data)
        : data.coverage_data || {};
      
      const serviceData = typeof data.service_data === 'string'
        ? JSON.parse(data.service_data)
        : data.service_data || {};
      
      const managementItems = typeof data.management_items === 'string'
        ? JSON.parse(data.management_items)
        : data.management_items || [];
      
      const medications = typeof data.medications === 'string'
        ? JSON.parse(data.medications)
        : data.medications || [];
      
      const medicationSafetyAnalysis = typeof data.medication_safety_analysis === 'string'
        ? JSON.parse(data.medication_safety_analysis)
        : data.medication_safety_analysis || null;
      
      // Transform to form data structure
      const formData = {
        id: data.id,
        form_number: data.form_number,
        status: data.status,
        patient: patientData,
        insured: insuredData,
        provider: providerData,
        coverage: coverageData,
        encounterClass: data.encounter_class,
        encounterStart: data.encounter_start,
        encounterEnd: data.encounter_end,
        service: serviceData,
        managementItems: managementItems.length > 0 ? managementItems : [{ code: '', description: '', type: '', quantity: '', cost: '' }],
        medications: medications.length > 0 ? medications : [{
          medicationName: '',
          type: '',
          quantity: '',
          mrid: '',
          activeIngredient: '',
          strength: '',
          unit: '',
          dosageForm: null,
          brands: [],
          hasInteractions: false,
          hasSideEffects: false,
          hasAgeWarning: false,
          hasPregnancyWarning: false,
          isDuplicate: false
        }],
        medicationSafetyAnalysis,
        attachments: [],
        prerequisiteJustification: data.prerequisite_justification || ''
      };
      
      setInitialData(formData);
    } catch (error) {
      console.error('Error loading request data:', error);
      alert('Error loading request data');
      navigate('/general-requests');
    } finally {
      setLoading(false);
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
    <GeneralRequestWizard 
      initialData={initialData} 
      isEditMode={isEditMode}
      requestId={id}
    />
  );
}

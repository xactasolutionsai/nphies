-- Migration: Create medical_exams table for storing exam prerequisites
-- Purpose: Support validation of medical imaging requests with prerequisite checking

-- Create medical_exams table
CREATE TABLE IF NOT EXISTS medical_exams (
    exam_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exam_name VARCHAR(255) NOT NULL,
    prerequisites TEXT,
    description TEXT,
    category VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_medical_exams_name ON medical_exams(LOWER(exam_name));

-- Insert common imaging exams with their prerequisites
INSERT INTO medical_exams (exam_name, prerequisites, description, category) VALUES
-- X-Ray exams (typically no prerequisites)
('X-Ray', NULL, 'Standard radiographic imaging', 'Radiology'),
('Chest X-Ray', NULL, 'Chest radiograph', 'Radiology'),
('Abdominal X-Ray', NULL, 'Abdominal radiograph', 'Radiology'),
('Extremity X-Ray', NULL, 'Limb radiograph', 'Radiology'),
('Spine X-Ray', NULL, 'Spinal radiograph', 'Radiology'),
('Skull X-Ray', NULL, 'Cranial radiograph', 'Radiology'),

-- CT Scans (may require blood work or prior imaging)
('CT', 'Blood creatinine level, Prior relevant imaging', 'Computed Tomography scan', 'Advanced Imaging'),
('CT Scan', 'Blood creatinine level, Prior relevant imaging', 'Computed Tomography scan', 'Advanced Imaging'),
('CT Head', 'Prior consultation notes', 'Head CT scan', 'Advanced Imaging'),
('CT Chest', 'Blood creatinine level', 'Chest CT scan', 'Advanced Imaging'),
('CT Abdomen', 'Blood creatinine level, Fasting 4-6 hours', 'Abdominal CT scan', 'Advanced Imaging'),
('CT Pelvis', 'Blood creatinine level', 'Pelvic CT scan', 'Advanced Imaging'),
('CT Angiography', 'Blood creatinine level, Coagulation profile', 'CT with contrast for vessels', 'Advanced Imaging'),

-- MRI Scans (may require prior imaging or specific preparation)
('MRI', 'Prior X-Ray or consultation notes', 'Magnetic Resonance Imaging', 'Advanced Imaging'),
('MRI Brain', 'Prior consultation notes', 'Brain MRI scan', 'Advanced Imaging'),
('MRI Spine', 'Prior X-Ray recommended', 'Spinal MRI scan', 'Advanced Imaging'),
('MRI Knee', 'Prior X-Ray recommended', 'Knee MRI scan', 'Advanced Imaging'),
('MRI Shoulder', 'Prior X-Ray recommended', 'Shoulder MRI scan', 'Advanced Imaging'),
('MRI Abdomen', 'Fasting 4-6 hours', 'Abdominal MRI scan', 'Advanced Imaging'),
('MRI Pelvis', NULL, 'Pelvic MRI scan', 'Advanced Imaging'),
('MRI Angiography', 'Blood creatinine level', 'MRI with contrast for vessels', 'Advanced Imaging'),

-- Ultrasound (typically no prerequisites)
('Ultrasound', NULL, 'Ultrasound imaging', 'Ultrasound'),
('Abdominal Ultrasound', 'Fasting 6-8 hours', 'Abdominal ultrasound', 'Ultrasound'),
('Pelvic Ultrasound', 'Full bladder', 'Pelvic ultrasound', 'Ultrasound'),
('Cardiac Ultrasound', NULL, 'Echocardiogram', 'Ultrasound'),
('Carotid Ultrasound', NULL, 'Carotid artery ultrasound', 'Ultrasound'),
('Thyroid Ultrasound', NULL, 'Thyroid gland ultrasound', 'Ultrasound'),
('Breast Ultrasound', NULL, 'Breast tissue ultrasound', 'Ultrasound'),

-- Mammography
('Mammography', NULL, 'Breast imaging for cancer screening', 'Radiology'),
('Screening Mammogram', NULL, 'Routine breast screening', 'Radiology'),
('Diagnostic Mammogram', 'Prior mammogram or clinical examination', 'Diagnostic breast imaging', 'Radiology'),

-- Nuclear Medicine
('PET Scan', 'Fasting 6 hours, Blood glucose level', 'Positron Emission Tomography', 'Nuclear Medicine'),
('PET-CT', 'Fasting 6 hours, Blood glucose level, Blood creatinine level', 'Combined PET and CT scan', 'Nuclear Medicine'),
('Bone Scan', NULL, 'Nuclear medicine bone imaging', 'Nuclear Medicine'),

-- Fluoroscopy
('Barium Swallow', 'Fasting 6 hours', 'Upper GI fluoroscopy', 'Fluoroscopy'),
('Barium Enema', 'Bowel preparation', 'Lower GI fluoroscopy', 'Fluoroscopy'),

-- Interventional
('Angiography', 'Blood creatinine level, Coagulation profile', 'Vascular imaging with contrast', 'Interventional'),
('Cardiac Catheterization', 'ECG, Blood creatinine level, Coagulation profile', 'Invasive cardiac procedure', 'Interventional');

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_medical_exams_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER medical_exams_updated_at_trigger
    BEFORE UPDATE ON medical_exams
    FOR EACH ROW
    EXECUTE FUNCTION update_medical_exams_updated_at();

-- Add comments for documentation
COMMENT ON TABLE medical_exams IS 'Stores medical examination types and their prerequisites for validation';
COMMENT ON COLUMN medical_exams.exam_id IS 'Unique identifier for the exam';
COMMENT ON COLUMN medical_exams.exam_name IS 'Name of the medical examination';
COMMENT ON COLUMN medical_exams.prerequisites IS 'Required tests or preparations before this exam';
COMMENT ON COLUMN medical_exams.description IS 'Detailed description of the exam';
COMMENT ON COLUMN medical_exams.category IS 'Category/type of examination';


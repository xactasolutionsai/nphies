import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import DentalFormSection from '@/components/DentalFormSection';

export default function DentalForm() {
  return (
    <div className="space-y-8">
      <div className="relative">
        <div className="relative bg-white rounded-2xl p-8 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-gray-900">
                Dental Form
              </h1>
              <p className="text-gray-600 mt-2 text-lg">Create and prepare dental prior authorization requests (DCAF 2.0)</p>
            </div>
          </div>
        </div>
      </div>

      <DentalFormSection />
    </div>
  );
}

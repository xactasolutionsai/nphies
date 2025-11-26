import React from 'react';
import { Check } from 'lucide-react';
import { WIZARD_STEPS } from './config/wizardConfig';

/**
 * WizardProgress Component
 * Displays progress indicator with step navigation
 */
const WizardProgress = React.memo(({ 
  currentStep, 
  completedSteps, 
  onStepClick 
}) => {
  const getStepStatus = (stepId) => {
    if (completedSteps.includes(stepId)) return 'completed';
    if (stepId === currentStep) return 'current';
    return 'pending';
  };
  
  const getStepClassName = (status) => {
    switch (status) {
      case 'completed':
        return 'bg-green-600 text-white border-green-600';
      case 'current':
        return 'bg-primary-purple text-white border-primary-purple ring-4 ring-primary-purple/20';
      default:
        return 'bg-white text-gray-400 border-gray-300';
    }
  };
  
  const getLineClassName = (fromStepId) => {
    return completedSteps.includes(fromStepId) 
      ? 'bg-green-600' 
      : 'bg-gray-300';
  };
  
  const isStepClickable = (stepId) => {
    // Can click on current step, completed steps, or the next step after last completed
    if (stepId === currentStep) return false; // Already on this step
    if (completedSteps.includes(stepId)) return true;
    
    // Check if it's the step right after a completed step
    const maxCompleted = Math.max(0, ...completedSteps);
    return stepId <= maxCompleted + 1;
  };
  
  return (
    <div className="w-full bg-white border-b border-gray-200 sticky top-0 z-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Desktop view */}
        <div className="hidden md:block">
          <div className="flex items-center justify-between">
            {WIZARD_STEPS.map((step, index) => {
              const status = getStepStatus(step.id);
              const clickable = isStepClickable(step.id);
              
              return (
                <React.Fragment key={step.id}>
                  {/* Step indicator */}
                  <div className="flex flex-col items-center flex-1">
                    <button
                      type="button"
                      onClick={() => clickable && onStepClick(step.id)}
                      disabled={!clickable}
                      className={`
                        w-10 h-10 rounded-full border-2 flex items-center justify-center
                        transition-all duration-200 font-semibold
                        ${getStepClassName(status)}
                        ${clickable ? 'cursor-pointer hover:scale-110' : 'cursor-not-allowed'}
                      `}
                    >
                      {status === 'completed' ? (
                        <Check className="h-5 w-5" />
                      ) : (
                        <span>{step.id}</span>
                      )}
                    </button>
                    <div className="mt-2 text-center">
                      <div className={`text-sm font-medium ${
                        status === 'current' ? 'text-primary-purple' :
                        status === 'completed' ? 'text-green-600' :
                        'text-gray-500'
                      }`}>
                        {step.name}
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        {step.description}
                      </div>
                    </div>
                  </div>
                  
                  {/* Connecting line */}
                  {index < WIZARD_STEPS.length - 1 && (
                    <div className="flex-shrink-0 w-16 h-0.5 mb-12">
                      <div className={`h-full transition-all duration-300 ${getLineClassName(step.id)}`} />
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>
        
        {/* Mobile view */}
        <div className="md:hidden">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-sm text-gray-500">
                Step {currentStep} of {WIZARD_STEPS.length}
              </div>
              <div className="text-lg font-semibold text-gray-900">
                {WIZARD_STEPS.find(s => s.id === currentStep)?.name}
              </div>
            </div>
            <div className={`
              w-12 h-12 rounded-full border-2 flex items-center justify-center
              text-white font-bold bg-primary-purple border-primary-purple
            `}>
              {currentStep}
            </div>
          </div>
          
          {/* Progress bar */}
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-primary-purple h-2 rounded-full transition-all duration-300"
              style={{ 
                width: `${(completedSteps.length / WIZARD_STEPS.length) * 100}%` 
              }}
            />
          </div>
          
          {/* Step dots */}
          <div className="flex justify-between mt-2">
            {WIZARD_STEPS.map(step => {
              const status = getStepStatus(step.id);
              return (
                <div
                  key={step.id}
                  className={`w-2 h-2 rounded-full ${
                    status === 'completed' ? 'bg-green-600' :
                    status === 'current' ? 'bg-primary-purple' :
                    'bg-gray-300'
                  }`}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
});

WizardProgress.displayName = 'WizardProgress';

export default WizardProgress;


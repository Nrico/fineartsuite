import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getStepsForRole, getRoleLabel, toTitleCase } from '../userFlow';

export default function OnboardingWizard({ role, initialStep }) {
  const steps = getStepsForRole(role);
  const navigate = useNavigate();
  const initialIndex = Math.max(0, steps.findIndex(s => s.step === initialStep));
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  useEffect(() => {
    const idx = steps.findIndex(s => s.step === initialStep);
    if (idx >= 0) setCurrentIndex(idx);
  }, [initialStep, steps]);

  const current = steps[currentIndex] || { step: '', actions: [] };

  const handleNext = () => {
    const nextIndex = currentIndex + 1;
    if (nextIndex < steps.length) {
      const nextStep = steps[nextIndex].step;
      navigate(`/onboarding/${role}/${nextStep}`);
      setCurrentIndex(nextIndex);
    }
  };

  return (
    <div>
      <h1>{getRoleLabel(role)} Onboarding</h1>
      <ol>
        {steps.map((s, idx) => (
          <li key={s.step} style={{ fontWeight: idx === currentIndex ? 'bold' : 'normal' }}>
            {toTitleCase(s.step)}
            {idx < currentIndex ? ' ✓' : ''}
          </li>
        ))}
      </ol>
      <h2>{toTitleCase(current.step)}</h2>
      <ul>
        {current.actions.map(action => (
          <li key={action}>{toTitleCase(action)}</li>
        ))}
      </ul>
      {currentIndex < steps.length - 1 && (
        <button onClick={handleNext}>Next</button>
      )}
    </div>
  );
}

import React from 'react';
import { Routes, Route, useParams } from 'react-router-dom';
import OnboardingWizard from '../components/OnboardingWizard.jsx';

function OnboardingRouteWrapper() {
  const { role, step } = useParams();
  return <OnboardingWizard role={role} initialStep={step} />;
}

export default function OnboardingRoutes() {
  return (
    <Routes>
      <Route path="/onboarding/:role/:step" element={<OnboardingRouteWrapper />} />
    </Routes>
  );
}

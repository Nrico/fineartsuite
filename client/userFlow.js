const fs = require('fs');
const path = require('path');

const flowPath = path.join(__dirname, '..', 'user_flow.json');
const flowData = JSON.parse(fs.readFileSync(flowPath, 'utf-8'));

function getStepsForRole(role) {
  return flowData.roles[role]?.steps || [];
}

function getRoleLabel(role) {
  return flowData.roles[role]?.label || '';
}

function getNextStep(role, currentStep) {
  const steps = getStepsForRole(role);
  const index = steps.findIndex(s => s.step === currentStep);
  if (index === -1 || index + 1 >= steps.length) return null;
  return steps[index + 1].step;
}

function getSharedFeatures() {
  return flowData.shared_features || [];
}

function toTitleCase(str) {
  return str
    .split('_')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

module.exports = {
  flowData,
  getStepsForRole,
  getRoleLabel,
  getNextStep,
  getSharedFeatures,
  toTitleCase
};

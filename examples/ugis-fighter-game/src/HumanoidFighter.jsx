import React from 'react';

import FighterRig from './characters/FighterRig.jsx';

/**
 * Compatibility shell kept so GameScene does not own presentation details.
 * v0.3-B decouples visual style from player/enemy slot: either side may now use
 * WanFeng or Kendo-inspired presentation.
 */
export default function HumanoidFighter({ styleId, enemy = false, ...props }) {
  const kendoPresentation = styleId ? styleId === 'kendo' : enemy;
  return <FighterRig {...props} enemy={kendoPresentation} />;
}

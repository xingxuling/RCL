import React from 'react';

import FighterRig from './characters/FighterRig.jsx';

/**
 * Compatibility shell kept so GameScene does not own presentation details.
 * v0.3 moves geometry, rig hierarchy and pose sampling into FighterRig + Motion Runtime.
 */
export default function HumanoidFighter(props) {
  return <FighterRig {...props} />;
}

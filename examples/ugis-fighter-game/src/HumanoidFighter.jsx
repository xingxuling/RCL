import React from 'react';

import FighterRigV2 from './characters/FighterRigV2.jsx';

/**
 * Presentation shell. v0.3-D removes the old pre-drawn arc/line cue:
 * sword trails now come from the actual animated sword tip in FighterRigV2.
 */
export default function HumanoidFighter({ styleId = 'wanfeng', logicRef, rootRef, ...props }) {
  return (
    <group ref={rootRef}>
      <FighterRigV2 {...props} logicRef={logicRef} styleId={styleId} />
    </group>
  );
}

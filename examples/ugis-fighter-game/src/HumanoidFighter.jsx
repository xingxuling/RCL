import React from 'react';

import ExpandedStyleRig from './characters/ExpandedStyleRig.jsx';
import FighterRigV2 from './characters/FighterRigV2.jsx';

const EXPANDED_STYLE_IDS = new Set(['epee','destreza','liechtenauer','fiore','miaodao']);

/** Presentation shell. WanFeng/Kendo keep V2 authored rigs; v0.4 styles use dedicated authored rigs. */
export default function HumanoidFighter({ styleId = 'wanfeng', logicRef, rootRef, ...props }) {
  return (
    <group ref={rootRef}>
      {EXPANDED_STYLE_IDS.has(styleId)
        ? <ExpandedStyleRig {...props} logicRef={logicRef} styleId={styleId} />
        : <FighterRigV2 {...props} logicRef={logicRef} styleId={styleId} />}
    </group>
  );
}

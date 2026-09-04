export const SWORD_STYLES = Object.freeze({
  wanfeng: Object.freeze({
    id: 'wanfeng',
    name: '万风剑道',
    fighterName: '万风剑士',
    roman: 'WANFENG',
    tagline: '侧 · 变 · 流 · 绕 · 连续',
    description: '以连续变线、侧入和重新组织路线为核心。剑路更偏弧线与多段转向。',
    accent: '#55bfff',
    tone: 'blue',
    modelRole: 'wanfeng',
    lightCombo: ['light1', 'light2', 'light3'],
    heavy: 'heavy',
    skills: ['skill_u', 'skill_i', 'skill_o'],
    aiActionMap: Object.freeze({ thrust: 'light1', heavy: 'heavy' }),
    guardLabel: '静动皆风',
    pathLabel: '流动弧线',
  }),
  kendo: Object.freeze({
    id: 'kendo',
    name: '剑道原型',
    fighterName: '剑道剑士',
    roman: 'KENDO-INSPIRED',
    tagline: '正 · 直 · 压 · 截 · 稳定',
    description: '以中心线、直入、压迫和短促收束为核心。剑路更窄、更直、更强调一拍决断。',
    accent: '#ff994f',
    tone: 'orange',
    modelRole: 'kendo',
    lightCombo: ['kendo_light1', 'kendo_light2', 'kendo_light3'],
    heavy: 'kendo_heavy',
    skills: ['kendo_skill_u', 'kendo_skill_i', 'kendo_skill_o'],
    aiActionMap: Object.freeze({ thrust: 'ai_thrust', heavy: 'ai_heavy' }),
    guardLabel: '守中线',
    pathLabel: '中心直线',
  }),
});

export const SWORD_STYLE_IDS = Object.freeze(Object.keys(SWORD_STYLES));

export function getSwordStyle(styleId = 'wanfeng') {
  return SWORD_STYLES[styleId] ?? SWORD_STYLES.wanfeng;
}

export function playerAttackFor(styleId, slot, comboStep = 0) {
  const style = getSwordStyle(styleId);
  if (slot === 'light') return style.lightCombo[comboStep % style.lightCombo.length];
  if (slot === 'heavy') return style.heavy;
  if (slot === 'skill_u') return style.skills[0];
  if (slot === 'skill_i') return style.skills[1];
  if (slot === 'skill_o') return style.skills[2];
  return null;
}

export function aiAttackFor(styleId, semanticAction) {
  const style = getSwordStyle(styleId);
  return style.aiActionMap[semanticAction] ?? null;
}

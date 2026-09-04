export const SWORD_STYLES = Object.freeze({
  wanfeng: Object.freeze({
    id:'wanfeng', name:'万风剑道', fighterName:'万风剑士', roman:'WANFENG',
    tagline:'侧 · 变 · 流 · 绕 · 连续', description:'连续变线、侧入和重新组织路线。攻击动作强调转体、换线与流动衔接。',
    accent:'#55bfff', tone:'blue', modelRole:'wanfeng',
    lightCombo:['light1','light2','light3'], heavy:'heavy', skills:['skill_u','skill_i','skill_o'],
    aiActionMap:Object.freeze({ thrust:'light1', heavy:'heavy' }), guardLabel:'静动皆风', pathLabel:'流动弧线',
  }),
  kendo: Object.freeze({
    id:'kendo', name:'剑道原型', fighterName:'剑道剑士', roman:'KENDO-INSPIRED',
    tagline:'正 · 直 · 压 · 截 · 稳定', description:'中心线、直入、压迫与短促收束。攻击动作强调振上、正劈和一拍决断。',
    accent:'#ff994f', tone:'orange', modelRole:'kendo',
    lightCombo:['kendo_light1','kendo_light2','kendo_light3'], heavy:'kendo_heavy', skills:['kendo_skill_u','kendo_skill_i','kendo_skill_o'],
    aiActionMap:Object.freeze({ thrust:'ai_thrust', heavy:'ai_heavy' }), guardLabel:'守中线', pathLabel:'中心直线',
  }),
  epee: Object.freeze({
    id:'epee', name:'重剑原型', fighterName:'重剑剑手', roman:'EPEE-INSPIRED',
    tagline:'伸 · 刺 · 退 · 复 · 距离', description:'以长距离伸剑、弓步突进和快速复位为核心，动作轮廓窄而长。',
    accent:'#b7d7ff', tone:'blue', modelRole:'epee',
    lightCombo:['epee_light1','epee_light2','epee_light3'], heavy:'epee_heavy', skills:['epee_skill_u','epee_skill_i','epee_skill_o'],
    aiActionMap:Object.freeze({ thrust:'epee_light3', heavy:'epee_heavy' }), guardLabel:'延伸守势', pathLabel:'长线刺击',
  }),
  destreza: Object.freeze({
    id:'destreza', name:'西班牙真剑术原型', fighterName:'圆步剑手', roman:'DESTREZA-INSPIRED',
    tagline:'圆 · 角 · 离 · 占 · 换位', description:'以圆周步、离轴占位和角度控制为核心，攻击常从侧向角线切入。',
    accent:'#d7b6ff', tone:'blue', modelRole:'destreza',
    lightCombo:['destreza_light1','destreza_light2','destreza_light3'], heavy:'destreza_heavy', skills:['destreza_skill_u','destreza_skill_i','destreza_skill_o'],
    aiActionMap:Object.freeze({ thrust:'destreza_light3', heavy:'destreza_heavy' }), guardLabel:'圆周守位', pathLabel:'圆周角线',
  }),
  liechtenauer: Object.freeze({
    id:'liechtenauer', name:'德式长剑原型', fighterName:'长剑剑士', roman:'LIECHTENAUER-INSPIRED',
    tagline:'斜 · 压 · 缠 · 夺 · 转边', description:'双手长剑的斜向切入、上段压迫和交剑后转边，动作幅度明显更大。',
    accent:'#b9d88a', tone:'blue', modelRole:'liechtenauer',
    lightCombo:['liech_light1','liech_light2','liech_light3'], heavy:'liech_heavy', skills:['liech_skill_u','liech_skill_i','liech_skill_o'],
    aiActionMap:Object.freeze({ thrust:'liech_light1', heavy:'liech_heavy' }), guardLabel:'长剑架势', pathLabel:'双手斜切',
  }),
  fiore: Object.freeze({
    id:'fiore', name:'菲奥雷长剑原型', fighterName:'换门剑士', roman:'FIORE-INSPIRED',
    tagline:'门 · 换 · 承 · 入 · 收束', description:'以不同守门之间的转换、承压与近域进入为核心，动作更低、更厚重。',
    accent:'#e8c07d', tone:'orange', modelRole:'fiore',
    lightCombo:['fiore_light1','fiore_light2','fiore_light3'], heavy:'fiore_heavy', skills:['fiore_skill_u','fiore_skill_i','fiore_skill_o'],
    aiActionMap:Object.freeze({ thrust:'fiore_light1', heavy:'fiore_heavy' }), guardLabel:'换门守势', pathLabel:'守门转换',
  }),
  miaodao: Object.freeze({
    id:'miaodao', name:'苗刀原型', fighterName:'长刃剑士', roman:'MIAODAO-INSPIRED',
    tagline:'长 · 阔 · 步 · 压 · 回身', description:'长刃、长步与大弧度压迫，攻击覆盖更远，动作轮廓最宽。',
    accent:'#f4d95d', tone:'orange', modelRole:'miaodao',
    lightCombo:['miaodao_light1','miaodao_light2','miaodao_light3'], heavy:'miaodao_heavy', skills:['miaodao_skill_u','miaodao_skill_i','miaodao_skill_o'],
    aiActionMap:Object.freeze({ thrust:'miaodao_light1', heavy:'miaodao_heavy' }), guardLabel:'长势架', pathLabel:'长刃大弧',
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

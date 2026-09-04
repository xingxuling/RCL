const attack = (id, label, {
  duration, activeStart, activeEnd, damage, range, arcDeg, knockback, hitstun,
  move, energyCost = 0, energyGain = 0, hitstop, routeIntent,
}) => Object.freeze({
  id, label, duration, activeStart, activeEnd, damage, range, arcDeg, knockback, hitstun,
  move, energyCost, energyGain, hitstop, routeIntent,
});

export const EXPANDED_STYLE_ATTACKS = Object.freeze({
  epee_light1: attack('epee_light1', '伸剑·一', { duration:.38, activeStart:.12, activeEnd:.20, damage:46, range:2.02, arcDeg:38, knockback:.28, hitstun:.22, move:.34, energyGain:7, hitstop:.05, routeIntent:'take_line' }),
  epee_light2: attack('epee_light2', '复线·二', { duration:.42, activeStart:.14, activeEnd:.23, damage:50, range:2.06, arcDeg:42, knockback:.30, hitstun:.23, move:.24, energyGain:8, hitstop:.052, routeIntent:'intercept_route' }),
  epee_light3: attack('epee_light3', '长伸·三', { duration:.50, activeStart:.17, activeEnd:.29, damage:66, range:2.22, arcDeg:34, knockback:.46, hitstun:.30, move:.52, energyGain:10, hitstop:.07, routeIntent:'close_resolution' }),
  epee_heavy: attack('epee_heavy', '长弓突进', { duration:.70, activeStart:.27, activeEnd:.42, damage:96, range:2.42, arcDeg:32, knockback:.70, hitstun:.42, move:.72, energyGain:13, hitstop:.09, routeIntent:'take_line' }),
  epee_skill_u: attack('epee_skill_u', '邀击窗', { duration:.54, activeStart:.18, activeEnd:.31, damage:76, range:2.18, arcDeg:44, knockback:.40, hitstun:.30, move:.22, energyCost:18, hitstop:.075, routeIntent:'intercept_route' }),
  epee_skill_i: attack('epee_skill_i', '延伸复进', { duration:.72, activeStart:.28, activeEnd:.46, damage:108, range:2.45, arcDeg:40, knockback:.70, hitstun:.43, move:.66, energyCost:30, hitstop:.105, routeIntent:'contact_control' }),
  epee_skill_o: attack('epee_skill_o', '一线到底', { duration:.94, activeStart:.36, activeEnd:.55, damage:172, range:2.82, arcDeg:30, knockback:1.16, hitstun:.68, move:.98, energyCost:68, hitstop:.15, routeIntent:'close_resolution' }),

  destreza_light1: attack('destreza_light1', '圆步·一', { duration:.44, activeStart:.15, activeEnd:.25, damage:48, range:1.96, arcDeg:58, knockback:.30, hitstun:.23, move:.28, energyGain:8, hitstop:.052, routeIntent:'change_rhythm' }),
  destreza_light2: attack('destreza_light2', '离轴·二', { duration:.48, activeStart:.16, activeEnd:.28, damage:54, range:2.00, arcDeg:66, knockback:.34, hitstun:.25, move:.30, energyGain:9, hitstop:.058, routeIntent:'flow_route' }),
  destreza_light3: attack('destreza_light3', '角线·三', { duration:.58, activeStart:.20, activeEnd:.34, damage:70, range:2.12, arcDeg:72, knockback:.54, hitstun:.34, move:.36, energyGain:11, hitstop:.075, routeIntent:'contact_control' }),
  destreza_heavy: attack('destreza_heavy', '直角决', { duration:.76, activeStart:.30, activeEnd:.46, damage:102, range:2.20, arcDeg:62, knockback:.78, hitstun:.45, move:.34, energyGain:13, hitstop:.095, routeIntent:'intercept_route' }),
  destreza_skill_u: attack('destreza_skill_u', '圆周换位', { duration:.56, activeStart:.18, activeEnd:.31, damage:78, range:2.08, arcDeg:82, knockback:.44, hitstun:.31, move:.44, energyCost:18, hitstop:.08, routeIntent:'disengage_reentry' }),
  destreza_skill_i: attack('destreza_skill_i', '斜径占位', { duration:.74, activeStart:.26, activeEnd:.45, damage:110, range:2.26, arcDeg:86, knockback:.72, hitstun:.45, move:.48, energyCost:30, hitstop:.11, routeIntent:'contact_control' }),
  destreza_skill_o: attack('destreza_skill_o', '圆心裁决', { duration:.98, activeStart:.37, activeEnd:.59, damage:176, range:2.58, arcDeg:90, knockback:1.22, hitstun:.70, move:.72, energyCost:68, hitstop:.155, routeIntent:'close_resolution' }),

  liech_light1: attack('liech_light1', '上斜·一', { duration:.50, activeStart:.17, activeEnd:.29, damage:54, range:2.04, arcDeg:92, knockback:.38, hitstun:.27, move:.28, energyGain:8, hitstop:.06, routeIntent:'take_line' }),
  liech_light2: attack('liech_light2', '返斜·二', { duration:.54, activeStart:.18, activeEnd:.31, damage:60, range:2.08, arcDeg:100, knockback:.42, hitstun:.29, move:.30, energyGain:9, hitstop:.065, routeIntent:'flow_route' }),
  liech_light3: attack('liech_light3', '绕缠·三', { duration:.64, activeStart:.22, activeEnd:.38, damage:78, range:2.12, arcDeg:108, knockback:.62, hitstun:.38, move:.32, energyGain:12, hitstop:.08, routeIntent:'contact_control' }),
  liech_heavy: attack('liech_heavy', '顶斩压入', { duration:.82, activeStart:.33, activeEnd:.50, damage:116, range:2.22, arcDeg:96, knockback:.96, hitstun:.52, move:.34, energyGain:14, hitstop:.105, routeIntent:'close_resolution' }),
  liech_skill_u: attack('liech_skill_u', '夺先上斜', { duration:.58, activeStart:.19, activeEnd:.33, damage:84, range:2.18, arcDeg:88, knockback:.50, hitstun:.34, move:.40, energyCost:18, hitstop:.085, routeIntent:'intercept_route' }),
  liech_skill_i: attack('liech_skill_i', '缠压换边', { duration:.78, activeStart:.29, activeEnd:.48, damage:118, range:2.20, arcDeg:116, knockback:.80, hitstun:.48, move:.30, energyCost:30, hitstop:.115, routeIntent:'contact_control' }),
  liech_skill_o: attack('liech_skill_o', '一击破势', { duration:1.02, activeStart:.40, activeEnd:.62, damage:184, range:2.60, arcDeg:104, knockback:1.34, hitstun:.74, move:.66, energyCost:68, hitstop:.165, routeIntent:'close_resolution' }),

  fiore_light1: attack('fiore_light1', '换位·一', { duration:.52, activeStart:.18, activeEnd:.30, damage:52, range:2.00, arcDeg:96, knockback:.36, hitstun:.27, move:.26, energyGain:8, hitstop:.058, routeIntent:'regenerate_route' }),
  fiore_light2: attack('fiore_light2', '承压·二', { duration:.58, activeStart:.20, activeEnd:.34, damage:58, range:2.04, arcDeg:102, knockback:.42, hitstun:.30, move:.24, energyGain:9, hitstop:.065, routeIntent:'contact_control' }),
  fiore_light3: attack('fiore_light3', '转门·三', { duration:.66, activeStart:.23, activeEnd:.39, damage:76, range:2.10, arcDeg:110, knockback:.64, hitstun:.39, move:.34, energyGain:12, hitstop:.082, routeIntent:'enter_close' }),
  fiore_heavy: attack('fiore_heavy', '宽门重斩', { duration:.86, activeStart:.34, activeEnd:.52, damage:118, range:2.22, arcDeg:112, knockback:1.00, hitstun:.54, move:.30, energyGain:14, hitstop:.108, routeIntent:'close_resolution' }),
  fiore_skill_u: attack('fiore_skill_u', '守门反入', { duration:.62, activeStart:.21, activeEnd:.36, damage:86, range:2.12, arcDeg:92, knockback:.54, hitstun:.36, move:.28, energyCost:18, hitstop:.088, routeIntent:'intercept_route' }),
  fiore_skill_i: attack('fiore_skill_i', '交剑换门', { duration:.82, activeStart:.30, activeEnd:.50, damage:120, range:2.18, arcDeg:120, knockback:.82, hitstun:.50, move:.36, energyCost:30, hitstop:.118, routeIntent:'contact_control' }),
  fiore_skill_o: attack('fiore_skill_o', '近域终结', { duration:1.04, activeStart:.41, activeEnd:.64, damage:186, range:2.48, arcDeg:116, knockback:1.38, hitstun:.76, move:.58, energyCost:68, hitstop:.17, routeIntent:'close_resolution' }),

  miaodao_light1: attack('miaodao_light1', '长势·一', { duration:.56, activeStart:.19, activeEnd:.33, damage:58, range:2.26, arcDeg:118, knockback:.44, hitstun:.30, move:.34, energyGain:8, hitstop:.064, routeIntent:'take_line' }),
  miaodao_light2: attack('miaodao_light2', '反长·二', { duration:.62, activeStart:.21, activeEnd:.37, damage:64, range:2.30, arcDeg:126, knockback:.50, hitstun:.33, move:.36, energyGain:9, hitstop:.07, routeIntent:'flow_route' }),
  miaodao_light3: attack('miaodao_light3', '压步·三', { duration:.72, activeStart:.25, activeEnd:.43, damage:84, range:2.38, arcDeg:132, knockback:.72, hitstun:.42, move:.48, energyGain:12, hitstop:.09, routeIntent:'enter_close' }),
  miaodao_heavy: attack('miaodao_heavy', '长刃沉斩', { duration:.92, activeStart:.37, activeEnd:.56, damage:126, range:2.48, arcDeg:124, knockback:1.08, hitstun:.58, move:.42, energyGain:14, hitstop:.115, routeIntent:'close_resolution' }),
  miaodao_skill_u: attack('miaodao_skill_u', '长步截路', { duration:.66, activeStart:.22, activeEnd:.38, damage:90, range:2.42, arcDeg:104, knockback:.58, hitstun:.38, move:.62, energyCost:18, hitstop:.092, routeIntent:'intercept_route' }),
  miaodao_skill_i: attack('miaodao_skill_i', '回身长风', { duration:.86, activeStart:.31, activeEnd:.52, damage:126, range:2.52, arcDeg:146, knockback:.88, hitstun:.52, move:.46, energyCost:30, hitstop:.122, routeIntent:'flow_route' }),
  miaodao_skill_o: attack('miaodao_skill_o', '长河断势', { duration:1.10, activeStart:.44, activeEnd:.68, damage:192, range:2.92, arcDeg:138, knockback:1.46, hitstun:.80, move:.84, energyCost:68, hitstop:.18, routeIntent:'close_resolution' }),
});

export function selectUiDeviceProfile(adaptation, availableWidth = null) {
  if (!adaptation) return null;
  if (availableWidth === null || availableWidth === undefined) return adaptation.defaultProfile;
  if (!Number.isFinite(availableWidth) || availableWidth < 0) throw new Error(`RCL_UI_DEVICE_ADAPTATION_AVAILABLE_WIDTH:${availableWidth}`);
  const match = adaptation.profiles.find((profile) => (
    availableWidth >= profile.minWidth && (profile.maxWidth === null || availableWidth <= profile.maxWidth)
  ));
  return match?.id ?? adaptation.defaultProfile;
}

export function resolveUiNodeLayout(node, profile) {
  const override = profile === null ? null : node.adaptiveLayouts.find((item) => item.profile === profile);
  return override ? { ...node.layout, mode: override.mode } : node.layout;
}

export function projectUiAdaptiveLayouts(root, profile, result = {}) {
  result[root.id] = resolveUiNodeLayout(root, profile);
  for (const child of root.children) projectUiAdaptiveLayouts(child, profile, result);
  return result;
}

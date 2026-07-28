# RCL RNCS Runtime Binding v0.1

RCL can consume the RNCS `rncs.authority-presentation-binding.v0.1` receipt
after an RNCS spatial simulation has verified its RSR authority frame and VSR
temporal packet.

The adapter is exposed by `src/rncs-runtime-binding.mjs` and is intentionally
upstream-only:

- `stateRoot` identifies the RSR authoritative snapshot;
- `authorityFrame.frameRoot` identifies the RSR frame;
- `temporalPacket.packetRoot` identifies the VSR temporal packet;
- `temporalPacket.sourcePacketRoot` must equal the RSR frame root;
- object IDs and available body roots must remain aligned across the two views;
- the binding root is preserved as an RCL proposal input, causal simulation
  reference and evidence edge.

This contract carries proof references across repositories. It does not claim
that RCL implements RSR physics, VSR presentation, GPU rendering or external
side effects.

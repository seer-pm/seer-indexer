// @ts-nocheck — Envio handler registration infers event/context loosely until typings settle.
import { indexer } from "envio";
import { entityId } from "../entityIds";

indexer.onEvent(
  { contract: "CurateIEvidence", event: "MetaEvidence" },
  async ({ event, context }) => {
    const chainId = Number(event.chainId);
    const addr = event.srcAddress.toLowerCase();
    const id = entityId(chainId, addr);
    let meta = await context.CurateMetadata.get(id);
    if (!meta) {
      meta = {
        id,
        registrationMetaEvidenceURI: "",
        clearingMetaEvidenceURI: "",
        metaEvidenceCount: 0n,
      };
    }
    const nextCount = meta.metaEvidenceCount + 1n;
    const isOdd = nextCount % 2n === 1n;
    context.CurateMetadata.set({
      ...meta,
      metaEvidenceCount: nextCount,
      registrationMetaEvidenceURI: isOdd
        ? event.params._evidence
        : meta.registrationMetaEvidenceURI,
      clearingMetaEvidenceURI: !isOdd ? event.params._evidence : meta.clearingMetaEvidenceURI,
    });
  }
);

indexer.onEvent(
  { contract: "ArbitratorIEvidence", event: "MetaEvidence" },
  async ({ event, context }) => {
    const chainId = Number(event.chainId);
    const addr = event.srcAddress.toLowerCase();
    const id = entityId(chainId, addr);
    let meta = await context.ArbitratorMetadata.get(id);
    if (!meta) {
      meta = { id, registrationMetaEvidenceURI: "" };
    }
    context.ArbitratorMetadata.set({
      ...meta,
      registrationMetaEvidenceURI: event.params._evidence,
    });
  }
);

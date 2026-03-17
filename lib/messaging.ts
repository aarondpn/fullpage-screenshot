import { defineExtensionMessaging } from "@webext-core/messaging";

export interface PageInfo {
  pageWidth: number;
  pageHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  dpr: number;
}

export interface CaptureResult {
  dataUrls: string[];
  scrollPositions: number[];
  pageInfo: PageInfo;
  error?: string;
}

export interface LastCaptureData {
  captureResult: CaptureResult;
  tabUrl: string;
  tabTitle: string;
  format: "png" | "jpeg";
  quality: number;
}

interface ProtocolMap {
  getPageInfo(): PageInfo;
  scrollTo(data: { y: number }): { actualY: number };
  prepareCapture(): void;
  hideFixedElements(): void;
  restoreAll(): void;
  waitForRepaint(): void;
  getLastCapture(): LastCaptureData | null;
}

export const { sendMessage, onMessage } = defineExtensionMessaging<ProtocolMap>();

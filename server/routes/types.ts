/**
 * Shared types and context for route modules.
 * Each route module receives this context instead of importing everything individually.
 */

import type { Express, RequestHandler } from "express";

export interface RouteContext {
  app: Express;
  requireAuth: RequestHandler;
  requireAdmin: RequestHandler;
  requireTier: (minTier: string) => RequestHandler;
  storage: any;
  sql: any;
  hasDatabase: () => boolean;
  getDb: () => any;
  logAdminAction: (adminId: string, action: string, targetType: string | null, targetId: string | null, details: Record<string, any> | null, ipAddress?: string) => Promise<void>;
  sendKycEmail: (to: string, subject: string, html: string) => Promise<void>;
  blockchainConfig: any;
  tableManager: any;
  getClients: () => any;
  sendToUser: (userId: string, msg: any) => void;
  broadcastToTable: (tableId: string, msg: any, excludeUserId?: string) => void;
  sendGameStateToTable: (tableId: string) => void;
  isSystemLocked: () => boolean;
}

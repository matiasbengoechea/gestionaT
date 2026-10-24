"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getClient } from "./clients";
import { DEMO_ROWS } from "./demo-rows";
import type { InvoiceData, ValidationIssue } from "./types";
import { invoiceKey, validateInvoice } from "./validate";

export type RowStatus = "pending" | "processing" | "done" | "error";

export interface InvoiceRow {
  id: string;
  fileName: string;
  fileSize: number;
  /** Blob URL del archivo subido, para el visor. */
  fileUrl?: string;
  fileType?: string;
  clientId: string;
  status: RowStatus;
  data?: InvoiceData;
  issues: ValidationIssue[];
  error?: string;
  durationMs?: number;
  provider?: string;
  model?: string;
  approved: boolean;
  approvedAt?: string;
  file?: File;
}

interface StoredRow {
  id: string;
  fileName: string;
  clientId: string;
  data: InvoiceData;
  approvedAt: string;
  durationMs?: number;
  provider?: string;
  model?: string;
}

const STORAGE_KEY = "gestionat.rows.v1";

function loadApproved(): InvoiceRow[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StoredRow[];
    if (!Array.isArray(parsed)) return [];
    return parsed.map((entry) => ({
      id: entry.id,
      fileName: entry.fileName,
      fileSize: 0,
      clientId: entry.clientId,
      status: "done" as const,
      data: entry.data,
      issues: [],
      durationMs: entry.durationMs,
      provider: entry.provider,
      model: entry.model,
      approved: true,
      approvedAt: entry.approvedAt,
    }));
  } catch {
    return [];
  }
}

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function useInvoiceQueue() {
  const [rows, setRows] = useState<InvoiceRow[]>(DEMO_ROWS);
  const [hydrated, setHydrated] = useState(false);
  const processingRef = useRef(false);

  // Restaura las aprobadas de la sesión anterior, pisando los ejemplos por id.
  useEffect(() => {
    const stored = loadApproved();
    if (stored.length > 0) {
      setRows((prev) => {
        const byId = new Map(prev.map((row) => [row.id, row]));
        for (const row of stored) byId.set(row.id, row);
        return Array.from(byId.values());
      });
    }
    setHydrated(true);
  }, []);

  const knownKeys = useMemo(
    () =>
      rows
        .filter((row) => row.approved && row.data)
        .map((row) => invoiceKey(row.data as InvoiceData)),
    [rows],
  );

  useEffect(() => {
    if (!hydrated) return;
    const stored: StoredRow[] = rows
      .filter((row) => row.approved && row.data)
      .map((row) => ({
        id: row.id,
        fileName: row.fileName,
        clientId: row.clientId,
        data: row.data as InvoiceData,
        approvedAt: row.approvedAt ?? new Date().toISOString(),
        durationMs: row.durationMs,
        provider: row.provider,
        model: row.model,
      }));
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    } catch {
      // Si el storage está lleno, la demo sigue funcionando en memoria.
    }
  }, [rows, hydrated]);

  const addFiles = useCallback((files: File[], clientId: string) => {
    const next: InvoiceRow[] = files.map((file) => ({
      id: newId(),
      fileName: file.name,
      fileSize: file.size,
      fileUrl: URL.createObjectURL(file),
      fileType: file.type,
      clientId,
      status: "pending",
      issues: [],
      approved: false,
      file,
    }));
    setRows((prev) => [...next, ...prev]);
    return next.map((row) => row.id);
  }, []);

  // Procesa la cola de a una factura por vez.
  useEffect(() => {
    if (processingRef.current) return;
    const next = rows.find((row) => row.status === "pending" && row.file);
    if (!next) return;

    processingRef.current = true;

    void (async () => {
      setRows((prev) =>
        prev.map((row) => (row.id === next.id ? { ...row, status: "processing" } : row)),
      );

      try {
        const form = new FormData();
        form.append("file", next.file as File);
        form.append("clientId", next.clientId);
        form.append("known", JSON.stringify(knownKeys));

        const response = await fetch("/api/extract", { method: "POST", body: form });
        const payload = await response.json();

        if (!response.ok || !payload?.ok) {
          throw new Error(payload?.error ?? `Error ${response.status} al procesar la factura.`);
        }

        setRows((prev) =>
          prev.map((row) =>
            row.id === next.id
              ? {
                  ...row,
                  status: "done",
                  data: payload.invoice as InvoiceData,
                  issues: payload.issues as ValidationIssue[],
                  durationMs: payload.meta?.durationMs,
                  provider: payload.meta?.provider,
                  model: payload.meta?.model,
                }
              : row,
          ),
        );
      } catch (error) {
        setRows((prev) =>
          prev.map((row) =>
            row.id === next.id
              ? {
                  ...row,
                  status: "error",
                  error: error instanceof Error ? error.message : "Error inesperado.",
                }
              : row,
          ),
        );
      } finally {
        processingRef.current = false;
      }
    })();
  }, [rows, knownKeys]);

  const updateData = useCallback(
    (id: string, data: InvoiceData) => {
      setRows((prev) =>
        prev.map((row) => {
          if (row.id !== id) return row;
          const client = getClient(row.clientId);
          const ownKey = row.data ? invoiceKey(row.data) : "";
          const issues = validateInvoice(
            data,
            client,
            knownKeys.filter((key) => key !== ownKey),
          );
          return { ...row, data, issues };
        }),
      );
    },
    [knownKeys],
  );

  const approve = useCallback((ids: string[]) => {
    const set = new Set(ids);
    setRows((prev) =>
      prev.map((row) =>
        set.has(row.id) && row.status === "done"
          ? { ...row, approved: true, approvedAt: new Date().toISOString() }
          : row,
      ),
    );
  }, []);

  const unapprove = useCallback((id: string) => {
    setRows((prev) =>
      prev.map((row) =>
        row.id === id ? { ...row, approved: false, approvedAt: undefined } : row,
      ),
    );
  }, []);

  const remove = useCallback((ids: string[]) => {
    const set = new Set(ids);
    setRows((prev) => {
      for (const row of prev) {
        if (set.has(row.id) && row.fileUrl) URL.revokeObjectURL(row.fileUrl);
      }
      return prev.filter((row) => !set.has(row.id));
    });
  }, []);

  const clear = useCallback(() => {
    setRows((prev) => {
      for (const row of prev) {
        if (row.fileUrl) URL.revokeObjectURL(row.fileUrl);
      }
      return [];
    });
  }, []);

  return { rows, hydrated, addFiles, updateData, approve, unapprove, remove, clear };
}

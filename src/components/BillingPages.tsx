"use client";

import { BillingApp } from "@/components/BillingApp";

export function OverviewBillingPage() {
  return <BillingApp mode="overview" />;
}

export function RegisterBillingPage() {
  return <BillingApp mode="register" />;
}

export function ReportsBillingPage() {
  return <BillingApp mode="reports" />;
}

export function AgentBillingPage() {
  return <BillingApp mode="agent" />;
}

export function StocksBillingPage() {
  return <BillingApp mode="stocks" />;
}

export function NotesBillingPage() {
  return <BillingApp mode="notes" />;
}

export function BudgetBillingPage() {
  return <BillingApp mode="budget" />;
}

export function ManagementBillingPage() {
  return <BillingApp mode="management" />;
}

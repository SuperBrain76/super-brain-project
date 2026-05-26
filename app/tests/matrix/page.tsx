"use client";

import { useAuth } from "@/components/AuthProvider";
import MatrixTest from "@/components/matrix/MatrixTest";

export default function MatrixPage() {
  const { user } = useAuth();
  return <MatrixTest userId={user?.id} />;
}

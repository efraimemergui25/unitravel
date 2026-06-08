'use client';

import { useParams } from 'next/navigation';
import { notFound }  from 'next/navigation';

export default function ZoneCatchAll() {
  const { zone } = useParams<{ zone: string }>();

  // All real zones have specific pages — this catch-all only fires for unknown routes.
  // Suppress unused-var lint while still using the param for future diagnostics.
  void zone;
  notFound();
}

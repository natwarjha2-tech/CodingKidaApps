import { useEffect, useState } from 'react';
import { SupportService, type SupportContact } from '@/services';

/**
 * Reactive hook over SupportService. Returns the current WhatsApp/email support
 * contact (fallback → cached → live from /api/app-config) and re-renders when the
 * backend value arrives. Mirrors the desktop _loadSupportWhatsApp behaviour.
 */
export function useSupportContact(): SupportContact {
  const [contact, setContact] = useState<SupportContact>(() => SupportService.get());

  useEffect(() => {
    const update = () => setContact(SupportService.get());
    const unsub = SupportService.subscribe(update);
    SupportService.load().then(update); // fetch + refresh
    return unsub;
  }, []);

  return contact;
}

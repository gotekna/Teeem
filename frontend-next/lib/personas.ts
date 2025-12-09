export type Persona = 'site' | 'office' | 'manager';

export interface PersonaConfig {
  label: string;
  description: string;
  items: string[] | 'all';
}

export const PERSONA_CONFIG: Record<Persona, PersonaConfig> = {
  site: {
    label: 'Site',
    description: 'Field workers on-site',
    items: ['/dashboard', '/jobs', '/tasks', '/schedule-master', '/whs', '/documents']
  },
  office: {
    label: 'Office',
    description: 'Admin & office staff',
    items: ['/dashboard', '/leads', '/tasks', '/quote-requests', '/contacts', '/purchase_orders', '/pricebook', '/xero', '/corporate']
  },
  manager: {
    label: 'All',
    description: 'Full access',
    items: 'all'
  }
};

export const PERSONA_ORDER: Persona[] = ['site', 'office', 'manager'];

export function getStoredPersona(): Persona {
  if (typeof window === 'undefined') return 'manager';
  const stored = localStorage.getItem('teeem-persona');
  if (stored && (stored === 'site' || stored === 'office' || stored === 'manager')) {
    return stored;
  }
  return 'manager';
}

export function setStoredPersona(persona: Persona): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem('teeem-persona', persona);
  }
}

/** Rôles qui gèrent le vivier de candidats POEI : fiches, entretiens et CV */
const ROLES_VIVIER = ['super_admin', 'gestionnaire', 'directeur_commercial', 'commercial']

export const peutGererVivier = (role: string | null | undefined) => !!role && ROLES_VIVIER.includes(role)

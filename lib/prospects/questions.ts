/**
 * Une question de formulaire publicitaire qui demande le NOM de
 * l'établissement (raison sociale, enseigne, « nom de votre restaurant ») :
 * sa réponse devient l'établissement du lead. Une question sur sa taille, son
 * ancienneté ou son compte OPCO ne l'est pas, même si elle cite « entreprise »
 * ou « restaurant » : sinon un client « 11-50 » ou « Oui » serait créé.
 */
export function demandeNomEtablissement(question: string): boolean {
  const q = question.toLowerCase()
  if (/raison sociale|enseigne|nom commercial|company name|business name/.test(q)) return true
  return /\bnom\b/.test(q) && /établissement|etablissement|entreprise|société|societe|restaurant|commerce|boutique|boulangerie|boucherie|pâtisserie|patisserie|magasin/.test(q)
}

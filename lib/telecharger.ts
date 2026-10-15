/**
 * Télécharge un fichier servi par une de nos routes (PDF, ZIP) sans ouvrir
 * d'onglet : utilisable après une action asynchrone, là où window.open serait
 * bloqué par le navigateur, et l'erreur de la route revient en clair au lieu
 * de s'afficher en JSON dans une page vide.
 */
export async function telechargerFichier(url: string): Promise<{ ok: true } | { ok: false; erreur: string }> {
  let reponse: Response
  try {
    reponse = await fetch(url)
  } catch {
    return { ok: false, erreur: 'Téléchargement impossible : vérifiez votre connexion' }
  }
  if (!reponse.ok) {
    let erreur = 'Téléchargement impossible'
    try { erreur = (await reponse.json())?.error || erreur } catch { /* la route n'a pas répondu en JSON */ }
    return { ok: false, erreur }
  }
  let contenu: Blob
  try {
    contenu = await reponse.blob()
  } catch {
    // Connexion coupée pendant la réception du fichier
    return { ok: false, erreur: 'Téléchargement interrompu : vérifiez votre connexion et recommencez' }
  }
  const nom = /filename="([^"]+)"/.exec(reponse.headers.get('Content-Disposition') || '')?.[1] || 'document.pdf'
  const adresse = URL.createObjectURL(contenu)
  const lien = document.createElement('a')
  lien.href = adresse
  lien.download = nom
  document.body.appendChild(lien)
  lien.click()
  lien.remove()
  setTimeout(() => URL.revokeObjectURL(adresse), 30_000)
  return { ok: true }
}

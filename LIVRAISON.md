# Livraison : application de devis Rénov'Express (démo)

## Lancer l'application

**Sur ordinateur, pour tester :**

1. Ouvrir un terminal dans ce dossier.
2. Lancer `python -m http.server 8000`.
3. Ouvrir http://localhost:8000.

Un double-clic sur index.html ne suffit pas, car le service worker exige http(s).

**Mise en ligne (site statique, aucun serveur à programmer) :**

- **GitHub Pages** : pousser ce dossier dans un dépôt, puis aller dans Settings > Pages > Deploy from branch (`main`, dossier `/`). Le fichier `.nojekyll` est déjà présent.
- **Render** : New > Static Site, Publish directory = `.`, sans commande de build. Autre possibilité : New > Blueprint avec `render.yaml`.

**Sur iPhone :**

1. Ouvrir l'adresse dans Safari.
2. Toucher Partager, puis « Sur l'écran d'accueil ».
3. L'application s'ouvre ensuite en plein écran et fonctionne sans réseau.

**Test des calculs :** `node tests/test_calculs.js`

## Ce qui marche (testé dans Chromium en émulation iPhone 13)

1. **Mes tarifs** : les 13 lignes de l'Excel, avec code, prestation, unité, prix HT et remarque. On peut les modifier, en ajouter, en supprimer, et rétablir les tarifs d'origine. FAC1 « sur devis » n'a pas de prix.
2. **Nouveau devis** : client (nom, adresse, email, téléphone), adresse du chantier, objet. On ajoute des prestations depuis les tarifs (avec recherche) ou des lignes libres. Quantité, unité, prix et désignation sont modifiables sur chaque ligne. Une ligne sans prix est signalée et bloque l'envoi.
3. **Calculs** : en centimes entiers, au format français (1 234,56 €). Test sur D2026-041 : **4 994,00 € HT, 499,40 € de TVA, 5 493,40 € TTC**. Les totaux à 20 % et les arrondis sont testés aussi.
4. **Mentions** :
   - numérotation à la suite à partir de D2026-042 ;
   - date et validité de 30 jours (avec la date limite) ;
   - coordonnées, SIRET, TVA et RCS fictifs repris de l'ancien devis ;
   - assurance décennale ;
   - acompte de 30 %, avec son montant, versé à la signature mais pas avant sept jours si le devis est signé hors établissement ;
   - rappel du droit de rétractation de quatorze jours (contrat hors établissement) ;
   - « Bon pour accord » avec date et signature ;
   - médiateur « [à compléter] » ;
   - à 10 % seulement, le bloc « Certification du client pour le taux réduit de TVA » avec le texte provisoire. Aucune mention du Cerfa ni de l'attestation.
5. **PDF** : la dernière page est le formulaire type de rétractation (annexe à l'article R. 221-1 du Code de la consommation), pré-rempli avec le nom et les coordonnées de l'entreprise. Logo en haut à gauche (2 cm de haut, comme le demande la charte), numéro à droite, en-tête du tableau en bleu pétrole, lignes alternées en gris clair, totaux en bas à droite, TTC sur fond jaune ocre. La bibliothèque jsPDF est incluse dans `lib/`, sans appel à un CDN.
6. **Envoyer** : le partage natif (Web Share API) envoie le fichier PDF vers Mail, WhatsApp, etc. Si le partage n'est pas disponible, le PDF est téléchargé. Un bouton « Télécharger le PDF » est aussi présent.
7. **Mes devis** : liste du plus récent au plus ancien, recherche par nom de client, Ouvrir, Dupliquer (le duplicata reçoit un nouveau numéro), Renvoyer le PDF.

**Hors connexion** : le service worker met tout en cache. Le test a été fait coupé du réseau, en rechargeant la page, et les devis comme la génération du PDF fonctionnent. Les données restent sur le téléphone (localStorage). L'icône de l'écran d'accueil est tirée du logo.

## Ce qui ne marche pas / limites

- **Pas encore testé sur un vrai iPhone** : les tests ont été faits dans Chromium en émulation iPhone. Le partage de fichier par Web Share fonctionne en principe dans Safari iOS 15 et plus. À vérifier en conditions réelles, surtout l'envoi vers WhatsApp.
- **Données liées à l'appareil et au navigateur** : si Julien efface les données de Safari ou change de téléphone, il perd ses devis (pas de sauvegarde, idée notée dans IDEES.md). iOS peut aussi effacer les données d'un site non installé et inutilisé depuis plusieurs semaines. Installer l'application sur l'écran d'accueil évite ce cas.
- **Police du PDF** : Helvetica (l'équivalent Arial autorisé par la charte), pas Montserrat. L'interface, elle, est bien en Montserrat, incluse dans le projet.
- **m² dans le PDF** : la police standard du PDF n'affiche pas le « ² » sur tous les lecteurs. Dans le PDF, « m² » est donc écrit « m2 ». L'application, elle, garde « m² ».
- **Mentions juridiques** : le texte sur la rétractation et l'acompte est repris du Code de la consommation, mais il doit être relu par un professionnel du droit ou par le comptable avant un usage réel.
- **Date du devis** : c'est la date du jour de création, sans possibilité de la modifier.
- **Mise à jour de l'application** : après une mise en ligne, il faut changer `VERSION` dans `sw.js`, sinon les téléphones gardent l'ancienne version en cache.
- **À compléter avant un usage réel** : texte de certification TVA (à valider par le comptable), médiateur de la consommation, vraies coordonnées et vrai SIRET.

## Corrections (version 2)

1. Dans le PDF, « m² » est écrit « m2 », pour que l'affichage soit le même partout.
2. Une page « Formulaire de rétractation » est ajoutée à la fin du PDF (formulaire type), et le délai de rétractation de quatorze jours est rappelé dans les conditions.
3. La phrase sur l'acompte est modifiée : il est versé à la signature, mais pas avant sept jours si le devis est signé hors établissement.

Tests refaits :
- calculs de D2026-041 toujours justes ;
- parcours complet sans erreur, réseau coupé compris ;
- PDF à 10 % : 2 pages, sans aucun « ² » ni aucune mention du Cerfa ;
- PDF à 20 % : 2 pages ;
- devis de 22 lignes : 3 pages, le bloc de signature restant d'un seul tenant.

Le cache du service worker passe en version v2, pour que les téléphones récupèrent la mise à jour.

## Temps passé

Environ **1 h 15** de travail effectif : environ 1 h pour la première version et 15 min pour les corrections. L'attente des fichiers du client n'est pas comptée.

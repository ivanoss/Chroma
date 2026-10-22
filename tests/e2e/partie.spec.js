// Parcours complet dans un vrai navigateur : inscription, partie jusqu'à la fin,
// rejeu, historique et classement.
import { test, expect } from '@playwright/test';

test('un joueur s’inscrit, joue une partie complète et la revoit', async ({ page }) => {
  const nom = `e2e${Date.now() % 1_000_000}`;

  await page.goto('/');
  await page.getByRole('button', { name: 'Créer un compte' }).click();
  await page.getByLabel('Courriel').fill(`${nom}@exemple.ca`);
  await page.getByLabel('Nom d’utilisateur').fill(nom);
  await page.getByLabel('Mot de passe').fill('chroma2026');
  await page.getByRole('button', { name: 'Créer mon compte' }).click();
  await expect(page.getByRole('heading', { name: `Bonjour, ${nom}.` })).toBeVisible();

  // Une partie contre un seul bot, pour qu'elle soit courte.
  await page.locator('label[for="bots-1"]').click();
  await page.getByRole('button', { name: 'Lancer la partie' }).click();
  await expect(page.getByRole('group', { name: 'Votre main' })).toBeVisible();
  // La main du bot n'est jamais visible : seulement des dos de cartes.
  await expect(page.locator('.adversaire .main-revelee')).toHaveCount(0);

  const message = page.locator('#message-jeu');
  // On joue jusqu'à la fin (limite de temps : les animations allongent les parties).
  const debut = Date.now();
  while (Date.now() - debut < 150_000) {
    if (await page.locator('dialog[open] #titre-fin').count()) break;
    const couleur = page.locator('dialog[open] .choix-couleurs button').first();
    if (await couleur.count()) {
      await couleur.click();
      continue;
    }
    const texte = (await message.textContent()) ?? '';
    if (!/À vous|Contrez|Aucune/.test(texte)) {
      await page.waitForTimeout(100);
      continue;
    }
    const annonce = page.locator('.bouton-annonce:not([disabled])');
    if ((await annonce.count()) && (await annonce.getAttribute('aria-pressed')) === 'false') await annonce.click();
    const jouable = page.locator('.main-joueur .carte--jouable').first();
    if (await jouable.count()) await jouable.click();
    else await page.locator('.pioche').click();
    await page.waitForTimeout(50);
  }

  await expect(page.locator('dialog[open] #titre-fin')).toBeVisible({ timeout: 30_000 });
  // Fin de partie : on peut rejouer, revoir la partie ou retourner à l'accueil.
  await expect(page.locator('dialog[open]').getByRole('button', { name: 'Rejouer' })).toBeVisible();
  await expect(page.locator('dialog[open]').getByRole('link', { name: 'Retour à l’accueil' })).toBeVisible();
  await page.getByRole('link', { name: 'Revoir la partie' }).click();

  // Rejeu : avancer au clavier change la description du coup.
  await expect(page.locator('.rejeu__description')).toHaveText('Distribution des cartes.');
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('.rejeu__description')).not.toHaveText('Distribution des cartes.');
  await page.getByRole('button', { name: 'Fin' }).click();
  await expect(page.locator('.compteur-tour')).toHaveText(/^(\d+) \/ \1$/);

  await page.goto('/#/historique');
  await expect(page.locator('tbody tr')).toHaveCount(1);

  await page.goto('/#/classement');
  await expect(page.getByRole('cell', { name: nom })).toBeVisible();
});

test('un visiteur voit les règles et le classement mais pas l’historique', async ({ page }) => {
  await page.goto('/#/regles');
  await expect(page.getByRole('heading', { name: 'Règles de Chroma' })).toBeVisible();
  await page.goto('/#/classement');
  await expect(page.getByRole('heading', { name: 'Classement' })).toBeVisible();
  await page.goto('/#/historique');
  await expect(page).toHaveURL(/#\/connexion$/);
});

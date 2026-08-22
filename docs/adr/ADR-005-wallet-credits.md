# ADR-005 — Wallet : monnaie interne (crédits virtuels) + rail argent réel séparé

- **Statut** : **Accepté** — validé CTO (2026-07-15)
- **Épic** : E12 (Wallet)
- **Nom de l'unité** : **Dcoin** (pluriel « Dcoins ») — la monnaie interne en crédits virtuels.
- **Contexte cadrage** : hors stack figée v1.1 (aucun provider de paiement listé). Ce ADR est requis par la règle #8 avant tout code.
- **ADR liés à venir** : ADR-006 (on-ramp argent réel — achat de crédits via PSP), ADR-007 (marketplace argent réel — paiement acheteur→vendeur + KYC).

---

## 1. Contexte

Le wallet (« Portefeuille ») est listé « Bientôt » dans les Réglages. Il doit servir **quatre usages** :

1. Payer les annonces marketplace
2. Transferts entre utilisateurs (P2P)
3. Dépenser sur les features payantes (Studio AI, boosts)
4. Monétisation créateurs (pourboires aux auteurs de cours / créateurs)

> _Usage « Other » évoqué en cadrage : à préciser — non bloquant pour la Phase 1._

Un wallet touche à l'argent : c'est le domaine **le plus sensible** de l'app (sécurité, fraude, réconciliation, et — dès qu'il y a de l'argent réel — régulation KYC/AML). Aucune ligne de wallet n'existe aujourd'hui dans le schéma ni le code : c'est du greenfield.

### Deux rails, décidés avec le CTO

| Usage | Rail |
|---|---|
| Acheter une annonce marketplace | 💶 **Argent réel** (via PSP) |
| Transferts P2P | 🪙 Crédits |
| Dépense IA / boosts | 🪙 Crédits |
| Pourboires / monétisation créateurs | 🪙 Crédits |
| Recharger son solde de crédits | 🪙 par gains (a) **et** achat argent réel (b) |

Les usages 🪙 sont adossés à une **monnaie interne (crédits virtuels)**, les **Dcoins**. Le 💶 marketplace est une intégration paiement distincte.

### Pourquoi ce découpage

- **Crédits virtuels sans cash-out = zéro régulation.** Une monnaie interne qu'on gagne/achète et qu'on ne peut **pas retirer en cash** n'est pas de la monnaie électronique régulée. Buildable immédiatement, sans licence ni PSP.
- **L'argent réel est régulé et dépend du marché.** Deux niveaux de lourdeur très différents :
  - **Acheter des crédits** (user → DOUMASSI) : simple encaissement, **pas de reversement** → PSP léger.
  - **Marketplace** (acheteur → **vendeur** via DOUMASSI) : DOUMASSI devient **intermédiaire de paiement** → **reversements vendeurs + KYC** (Stripe Connect / agrégateur mobile money). Morceau régulé, dépendant du marché cible (cartes vs Orange Money / Wave / MTN MoMo).

---

## 2. Décision

### 2.1 Modèle : ledger interne (grand livre)

Un système à **deux tables** + des **RPC serveur atomiques**. C'est le pattern standard d'une monnaie in-app.

- **`wallets`** — 1 ligne par utilisateur.
  - `user_id` (PK, FK `auth.users`), `balance` **entier** (unité = 1 **Dcoin** — **jamais de float**), `created_at`, `updated_at`.
  - Créé automatiquement au 1er besoin (ou à l'inscription via trigger).
- **`wallet_transactions`** — grand livre **append-only** (immuable).
  - `id`, `user_id`, `amount` **signé** (+ crédit / − débit), `type` (enum), `counterparty_user_id` (nullable), `reference_type` + `reference_id` (nullable : annonce, cours…), `idempotency_key` (**unique**), `balance_after`, `metadata jsonb`, `created_at`.
  - `type` ∈ { `grant`, `reward`, `transfer_in`, `transfer_out`, `purchase`, `tip_in`, `tip_out`, `refund`, `topup`, `adjustment` }.

**Principe de conservation** : un transfert P2P écrit **2 lignes** qui se somment à zéro (−X émetteur, +X récepteur). La masse de crédits n'augmente que par `grant`/`reward`/`topup` et ne diminue que par les « puits » (`purchase` vers une features payante).

### 2.2 Mutations : uniquement côté serveur

Toute mutation passe par une **RPC `SECURITY DEFINER`** (`set search_path = public`), **atomique** (écriture ledger + maj solde dans **la même transaction**) :

- `wallet_transfer(to_user, amount, idempotency_key)` — P2P & tips.
- `wallet_spend(amount, purpose, reference, idempotency_key)` — dépense IA/boosts (puits).
- `wallet_grant(user, amount, reason)` — entrée de crédits (récompenses/admin ; **service-role uniquement** en Phase 1).

Garanties dans chaque RPC :
- **Solde jamais négatif** (contrainte `CHECK (balance >= 0)` + garde applicative).
- **Idempotence** : `idempotency_key` unique → un retry réseau ne double-dépense pas.
- **Montants entiers** (crédits) — jamais de flottant.

### 2.3 Sécurité (non négociable)

- **RLS deny-by-default** sur `wallets` et `wallet_transactions`. L'utilisateur peut **lire** son propre solde et son propre historique. **Aucune écriture directe** depuis le client (INSERT/UPDATE/DELETE refusés par RLS).
- Toute écriture passe par les **RPC** ci-dessus (ou Edge Functions pour l'argent réel).
- **Clés provider de paiement (Phases 2/3) : jamais dans le client mobile** → Edge Functions Supabase uniquement (règle projet).
- **Service role jamais dans le code.**
- Toute PR wallet/DB/paiement → label **`needs-cto-review`**.

---

## 3. Phasing

- **Phase 1 — maintenant (E12, cet ADR) : ledger de crédits pur.**
  Tables + RPC transfer/spend/grant + écran wallet (solde + historique) + P2P + dépense IA/boosts + tips créateurs. Crédits entrant par **gains/grants (a)**. Zéro régulation.
- **Phase 2 — après (ADR-006) : on-ramp argent réel (b).**
  Acheter des crédits via PSP (encaissement simple, pas de reversement).
- **Phase 3 — plus tard (ADR-007) : marketplace argent réel.**
  Paiement acheteur→vendeur avec reversements + KYC vendeur. Dépend du marché cible / PSP / potentiellement juridique.

Ce séquencement débloque le safe maintenant et repousse le régulé au moment où le PSP/marché sera tranché.

---

## 4. Conséquences

**Positives**
- Un seul moteur (ledger) couvre les 4 usages 🪙.
- Aucune dépendance externe ni régulation en Phase 1 → livrable rapidement.
- Modèle auditable (grand livre immuable, idempotent, solde reconstituable depuis les transactions).

**Risques / points de vigilance**
- Les crédits sont un **engagement** vis-à-vis de l'utilisateur ; **pas de cash-out** en MVP → pas une dette monétaire régulée. Toute évolution vers le retrait en cash rouvrirait la question régulatoire (nouvel ADR).
- Phases 2/3 : PSP + KYC + marché + juridique — à ne pas sous-estimer, d'où leur isolement en ADR séparés.
- Bien fixer la **valeur/émission des crédits** (comment on en gagne) côté produit pour éviter l'inflation/abus.

---

## 5. Alternatives écartées

- **Tout en argent réel** (y compris P2P/IA) → régulation immédiate et lourde, incompatible MVP.
- **Tout en crédits** (y compris marketplace) → écarté : le CTO veut de l'argent réel pour le marketplace.
- **Wallet tiers clé-en-main** (ex : provider externe) → dépendance forte + coût + toujours la question KYC ; à réévaluer seulement pour la Phase 3.

---

## 6. Découpage E12 proposé (Phase 1)

- **E12-01** — Migration schéma : `wallets`, `wallet_transactions`, enum `type`, RLS deny-by-default, contraintes (`balance >= 0`, `idempotency_key` unique). + ce ADR.
- **E12-02** — RPC `wallet_transfer` / `wallet_spend` / `wallet_grant` (atomiques, idempotentes) + tests SQL.
- **E12-03** — Hook `useWallet` (solde + historique via TanStack Query) + invalidations.
- **E12-04** — Écran Wallet (solde + historique) ; câbler la tuile Réglages → vrai écran.
- **E12-05** — Flow transfert P2P (envoyer des crédits à un utilisateur).
- **E12-06** — Intégration dépense (IA/boosts) + tips créateurs (depuis cours/profil).

_(Phases 2/3 : E13+ avec ADR-006/007.)_

---

*Décision à valider par le CTO avant d'ouvrir E12-01.*

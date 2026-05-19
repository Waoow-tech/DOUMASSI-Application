// Générateur d'UUID v4 (RFC 4122).
// Usage : nommage unique de fichiers (Storage…) — pas un usage cryptographique.
// On reste sur Math.random plutôt qu'un module natif (expo-crypto) qui
// imposerait un rebuild du Dev Build à toute l'équipe. Choix validé par le CTO.

/**
 * Retourne un UUID v4 conforme RFC 4122.
 * Ex. : « f47ac10b-58cc-4372-a567-0e02b2c3d479 ».
 */
export function uuidv4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const rand = Math.floor(Math.random() * 16);
    // Variant RFC 4122 : le digit « y » doit valoir 8, 9, a ou b.
    const value = char === 'x' ? rand : (rand % 4) + 8;
    return value.toString(16);
  });
}

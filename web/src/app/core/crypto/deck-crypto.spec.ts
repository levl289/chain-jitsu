import { b64ToBytes, bytesToB64, decryptDeck, unwrapMasterKey } from './deck-crypto';
import { provisionDeck } from '../../testing/deck-fixture';

describe('base64 helpers', () => {
  it('round-trips arbitrary bytes', () => {
    const bytes = new Uint8Array([0, 1, 2, 250, 255, 128, 64]);
    expect([...b64ToBytes(bytesToB64(bytes))]).toEqual([...bytes]);
  });
});

describe('envelope decryption', () => {
  const CSV = 'Start Position,Class,Technique\nMount Top,Submission,Ezekiel';

  it('unwraps the master key with the right password and decrypts the deck', async () => {
    const { deck, usersFile } = await provisionDeck(CSV, [
      { username: 'prof', password: 'correct horse', role: 'instructor' },
    ]);
    const rawKey = await unwrapMasterKey(usersFile.users[0], 'correct horse', usersFile.kdf.iters);
    await expectAsync(decryptDeck(deck, rawKey)).toBeResolvedTo(CSV);
  });

  it('rejects a wrong password (AES-GCM tag mismatch)', async () => {
    const { usersFile } = await provisionDeck(CSV, [
      { username: 'prof', password: 'correct horse', role: 'instructor' },
    ]);
    await expectAsync(
      unwrapMasterKey(usersFile.users[0], 'wrong password', usersFile.kdf.iters),
    ).toBeRejected();
  });
});

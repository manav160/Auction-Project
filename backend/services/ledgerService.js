const Transaction = require('../models/Transaction');
const LedgerEntry = require('../models/LedgerEntry');

class LedgerService {
  /**
   * Record a zero-sum transaction in the ledger.
   * Runs inside an optional Mongoose transaction session.
   * 
   * @param {Object} txData - Parent Transaction details
   * @param {Array} entries - Array of LedgerEntry inputs
   * @param {Object} [session] - Optional mongoose ClientSession
   */
  static async recordTransaction(txData, entries, session = null) {
    if (!entries || entries.length < 2) {
      throw new Error('A double-entry transaction must contain at least two entries.');
    }

    // Verify zero-sum invariant: total credits must equal total debits
    let balanceCheck = 0;
    for (const entry of entries) {
      const amt = parseFloat(entry.amount);
      if (isNaN(amt) || amt <= 0) {
        throw new Error('Ledger entry amount must be positive.');
      }
      if (entry.type === 'CREDIT') {
        balanceCheck += amt;
      } else if (entry.type === 'DEBIT') {
        balanceCheck -= amt;
      } else {
        throw new Error('Invalid ledger entry type. Must be CREDIT or DEBIT.');
      }
    }

    // Check for floating-point inaccuracies
    if (Math.abs(balanceCheck) > 0.0001) {
      throw new Error(`Double-entry validation failed. The transaction is not zero-sum (variance: ${balanceCheck}).`);
    }

    // 1. Create Transaction (Journal Entry)
    const [tx] = await Transaction.create([txData], session ? { session, ordered: true } : {});

    // 2. Prepare Ledger Entries
    const entriesToCreate = entries.map(entry => ({
      walletId: entry.walletId,
      transactionId: tx._id,
      type: entry.type,
      balanceType: entry.balanceType,
      amount: entry.amount
    }));

    // 3. Batch insert ledger entries
    await LedgerEntry.create(entriesToCreate, session ? { session, ordered: true } : {});

    return tx;
  }
}

module.exports = LedgerService;

const Wallet = require('../models/Wallet');
const LedgerEntry = require('../models/LedgerEntry');

class ReconciliationService {
  static async runReconciliation() {
    try {
      const wallets = await Wallet.find({}).populate('userId', 'email');
      let discrepancies = 0;

      for (const wallet of wallets) {
        if (!wallet.userId) continue;

        const email = wallet.userId.email || '';
        if (email.endsWith('@test.com') || email.endsWith('@bidtest.com')) {
          continue;
        }

        const entries = await LedgerEntry.find({ walletId: wallet._id });

        let available = 15000;
        let locked = 0;

        for (const entry of entries) {
          if (entry.balanceType === 'AVAILABLE') {
            available += entry.type === 'CREDIT' ? entry.amount : -entry.amount;
          }
          if (entry.balanceType === 'LOCKED') {
            locked += entry.type === 'CREDIT' ? entry.amount : -entry.amount;
          }
        }

        const availableWrong = Math.abs(wallet.availableBalance - available) > 0.01;
        const lockedWrong = Math.abs(wallet.lockedBalance - locked) > 0.01;

        if (availableWrong || lockedWrong) discrepancies++;
      }

      if (discrepancies > 0) {
        console.warn(`Reconciliation: ${discrepancies} wallet discrepancies found`);
      }
    } catch (error) {
      console.error('Reconciliation failed:', error);
    }
  }
}

module.exports = ReconciliationService;
const mongoose = require('mongoose');
const Wallet = require('../models/Wallet');
const Transaction = require('../models/Transaction');
const LedgerService = require('./ledgerService');

class WalletService {
  static SYSTEM_USER_ID = new mongoose.Types.ObjectId('000000000000000000000000');
  static ESCROW_USER_ID = new mongoose.Types.ObjectId('111111111111111111111111');

  static async getOrCreateWallet(userId, initialBalance = 0, session = null) {
    let wallet = await Wallet.findOne({ userId }).session(session);
    if (!wallet) {
      try {
        const results = await Wallet.create(
          [{ userId, availableBalance: initialBalance, lockedBalance: 0, version: 0 }],
          session ? { session, ordered: true } : {}
        );
        wallet = results[0];
      } catch (err) {
        if (err.code === 11000) {
          wallet = await Wallet.findOne({ userId }).session(session);
        } else {
          throw err;
        }
      }
    }
    return wallet;
  }

  static async getWalletByUserId(userId, session = null) {
    return this.getOrCreateWallet(userId, 15000, session);
  }

  static async getSystemWallet(session = null) {
    return this.getOrCreateWallet(this.SYSTEM_USER_ID, 0, session);
  }

  static async getEscrowWallet(session = null) {
    return this.getOrCreateWallet(this.ESCROW_USER_ID, 0, session);
  }

  /**
   * Helper to check for existing idempotent transaction
   */
  static async checkIdempotency(key, session) {
    if (!key) return false;
    const existing = await Transaction.findOne({ idempotencyKey: key }).session(session);
    return !!existing;
  }

  /**
   * Lock available funds in a wallet (e.g. placing a bid)
   */
  static async lockFunds({ userId, amount, referenceType, referenceId, idempotencyKey, description }, session) {
    if (await this.checkIdempotency(idempotencyKey, session)) {
      return await this.getWalletByUserId(userId, session);
    }

    const wallet = await this.getWalletByUserId(userId, session);
    if (wallet.availableBalance < amount) {
      throw new Error(`Insufficient available balance (Available: ₹${wallet.availableBalance}, Required: ₹${amount})`);
    }

    const result = await Wallet.findOneAndUpdate(
      { _id: wallet._id, availableBalance: { $gte: amount } },
      { $inc: { availableBalance: -amount, lockedBalance: amount, version: 1 } },
      { session, returnDocument: 'after' }
    );

    if (!result) {
      throw new Error(`Insufficient available balance (Available: ₹${wallet.availableBalance}, Required: ₹${amount})`);
    }

    await LedgerService.recordTransaction(
      { referenceType, referenceId, idempotencyKey, description },
      [
        { walletId: wallet._id, type: 'DEBIT', balanceType: 'AVAILABLE', amount },
        { walletId: wallet._id, type: 'CREDIT', balanceType: 'LOCKED', amount }
      ],
      session
    );

    return result;
  }

  /**
   * Unlock previously locked funds (e.g. being outbid)
   */
  static async unlockFunds({ userId, amount, referenceType, referenceId, idempotencyKey, description }, session) {
    if (await this.checkIdempotency(idempotencyKey, session)) {
      return await this.getWalletByUserId(userId, session);
    }

    const wallet = await this.getWalletByUserId(userId, session);
    if (wallet.lockedBalance < amount) {
      throw new Error(`Insufficient locked balance to unlock (Locked: ₹${wallet.lockedBalance}, Requested: ₹${amount})`);
    }

    const result = await Wallet.findOneAndUpdate(
      { _id: wallet._id, lockedBalance: { $gte: amount } },
      { $inc: { availableBalance: amount, lockedBalance: -amount, version: 1 } },
      { session, returnDocument: 'after' }
    );

    if (!result) {
      throw new Error(`Insufficient locked balance to unlock (Locked: ₹${wallet.lockedBalance}, Requested: ₹${amount})`);
    }

    await LedgerService.recordTransaction(
      { referenceType, referenceId, idempotencyKey, description },
      [
        { walletId: wallet._id, type: 'DEBIT', balanceType: 'LOCKED', amount },
        { walletId: wallet._id, type: 'CREDIT', balanceType: 'AVAILABLE', amount }
      ],
      session
    );

    return result;
  }

  /**
   * Transfer funds from one user's locked balance to another user's available balance
   */
  static async transferLockedToAvailable({ fromUserId, toUserId, amount, referenceType, referenceId, idempotencyKey, description }, session) {
    if (await this.checkIdempotency(idempotencyKey, session)) {
      return { sender: await this.getWalletByUserId(fromUserId, session), receiver: await this.getWalletByUserId(toUserId, session) };
    }

    const senderWallet = await this.getWalletByUserId(fromUserId, session);
    const receiverWallet = await this.getWalletByUserId(toUserId, session);

    if (senderWallet.lockedBalance < amount) {
      throw new Error(`Sender has insufficient locked funds (Locked: ₹${senderWallet.lockedBalance}, Transfer amount: ₹${amount})`);
    }

    const updatedSender = await Wallet.findOneAndUpdate(
      { _id: senderWallet._id, lockedBalance: { $gte: amount } },
      { $inc: { lockedBalance: -amount, version: 1 } },
      { session, returnDocument: 'after' }
    );

    if (!updatedSender) {
      throw new Error(`Sender has insufficient locked funds (Locked: ₹${senderWallet.lockedBalance}, Transfer amount: ₹${amount})`);
    }

    const updatedReceiver = await Wallet.findOneAndUpdate(
      { _id: receiverWallet._id },
      { $inc: { availableBalance: amount, version: 1 } },
      { session, returnDocument: 'after' }
    );

    if (!updatedReceiver) {
      throw new Error('Receiver wallet update conflict. Please retry.');
    }

    await LedgerService.recordTransaction(
      { referenceType, referenceId, idempotencyKey, description },
      [
        { walletId: senderWallet._id, type: 'DEBIT', balanceType: 'LOCKED', amount },
        { walletId: receiverWallet._id, type: 'CREDIT', balanceType: 'AVAILABLE', amount }
      ],
      session
    );

    return { sender: updatedSender, receiver: updatedReceiver };
  }

  /**
   * Pay fee to platform (Extension fee, Premium listing fee)
   */
  static async payFee({ userId, amount, referenceType, referenceId, idempotencyKey, description }, session) {
    if (await this.checkIdempotency(idempotencyKey, session)) {
      return await this.getWalletByUserId(userId, session);
    }

    const wallet = await this.getWalletByUserId(userId, session);
    if (wallet.availableBalance < amount) {
      throw new Error(`Insufficient funds to pay fee (Available: ₹${wallet.availableBalance}, Required Fee: ₹${amount})`);
    }

    const updatedWallet = await Wallet.findOneAndUpdate(
      { _id: wallet._id, availableBalance: { $gte: amount } },
      { $inc: { availableBalance: -amount, version: 1 } },
      { session, returnDocument: 'after' }
    );

    if (!updatedWallet) {
      throw new Error(`Insufficient funds to pay fee (Available: ₹${wallet.availableBalance}, Required Fee: ₹${amount})`);
    }

    const systemWallet = await this.getSystemWallet(session);
    await Wallet.findOneAndUpdate(
      { _id: systemWallet._id },
      { $inc: { availableBalance: amount, version: 1 } },
      { session }
    );

    await LedgerService.recordTransaction(
      { referenceType, referenceId, idempotencyKey, description },
      [
        { walletId: wallet._id, type: 'DEBIT', balanceType: 'AVAILABLE', amount },
        { walletId: systemWallet._id, type: 'CREDIT', balanceType: 'AVAILABLE', amount }
      ],
      session
    );

    return updatedWallet;
  }

  /**
   * Deduct Premium Listing Fee from Seller
   */
  static async payPremiumFee({ sellerId, amount, auctionId }, session) {
    return this.payFee({
      userId: sellerId,
      amount,
      referenceType: 'PREMIUM_LISTING_FEE',
      referenceId: auctionId,
      idempotencyKey: `premium-fee-${auctionId}`,
      description: 'Premium Listing Upgrade Fee'
    }, session);
  }

  /**
   * Buyer pays Entry Fee for an auction.
   */
  static async payEntryFee({ buyerId, entryFee, platformSharePct = 20, auctionId }, session) {
    const idempotencyKey = `entry-fee-${auctionId}-${buyerId}`;
    if (await this.checkIdempotency(idempotencyKey, session)) {
      return await this.getWalletByUserId(buyerId, session);
    }

    const buyerWallet = await this.getWalletByUserId(buyerId, session);
    if (buyerWallet.availableBalance < entryFee) {
      throw new Error(`Insufficient funds to pay entry fee (Available: ₹${buyerWallet.availableBalance}, Entry Fee: ₹${entryFee})`);
    }

    const platformShare = Math.round((entryFee * platformSharePct) / 100);
    const escrowShare = entryFee - platformShare;

    const updatedBuyer = await Wallet.findOneAndUpdate(
      { _id: buyerWallet._id, availableBalance: { $gte: entryFee } },
      { $inc: { availableBalance: -entryFee, version: 1 } },
      { session, returnDocument: 'after' }
    );

    if (!updatedBuyer) {
      throw new Error(`Insufficient funds to pay entry fee (Available: ₹${buyerWallet.availableBalance}, Entry Fee: ₹${entryFee})`);
    }

    const systemWallet = await this.getSystemWallet(session);
    await Wallet.findOneAndUpdate({ _id: systemWallet._id }, { $inc: { availableBalance: platformShare, version: 1 } }, { session });

    const escrowWallet = await this.getEscrowWallet(session);
    await Wallet.findOneAndUpdate({ _id: escrowWallet._id }, { $inc: { lockedBalance: escrowShare, version: 1 } }, { session });

    await LedgerService.recordTransaction(
      {
        referenceType: 'ENTRY_FEE_PAYMENT',
        referenceId: auctionId,
        idempotencyKey,
        description: `Entry fee payment for auction (Split: ₹${escrowShare} escrow, ₹${platformShare} platform)`
      },
      [
        { walletId: buyerWallet._id, type: 'DEBIT', balanceType: 'AVAILABLE', amount: entryFee },
        { walletId: systemWallet._id, type: 'CREDIT', balanceType: 'AVAILABLE', amount: platformShare },
        { walletId: escrowWallet._id, type: 'CREDIT', balanceType: 'LOCKED', amount: escrowShare }
      ],
      session
    );

    return updatedBuyer;
  }

  /**
   * Refund entry fee to a buyer
   */
  static async refundEntryFee({ buyerId, entryFeePaid, platformSharePct = 20, auctionId, reason = 'Unjoined auction' }, session) {
    if (entryFeePaid <= 0) return;

    const idempotencyKey = `entry-fee-refund-${auctionId}-${buyerId}`;
    if (await this.checkIdempotency(idempotencyKey, session)) {
      return await this.getWalletByUserId(buyerId, session);
    }

    const platformShare = Math.round((entryFeePaid * platformSharePct) / 100);
    const escrowShare = entryFeePaid - platformShare;

    const buyerWallet = await this.getWalletByUserId(buyerId, session);
    const systemWallet = await this.getSystemWallet(session);
    const escrowWallet = await this.getEscrowWallet(session);

    const updatedBuyer = await Wallet.findOneAndUpdate(
      { _id: buyerWallet._id },
      { $inc: { availableBalance: entryFeePaid, version: 1 } },
      { session, returnDocument: 'after' }
    );

    await Wallet.findOneAndUpdate({ _id: systemWallet._id }, { $inc: { availableBalance: -platformShare, version: 1 } }, { session });
    await Wallet.findOneAndUpdate({ _id: escrowWallet._id }, { $inc: { lockedBalance: -escrowShare, version: 1 } }, { session });

    await LedgerService.recordTransaction(
      {
        referenceType: 'ENTRY_FEE_REFUND',
        referenceId: auctionId,
        idempotencyKey,
        description: `Entry fee refund: ${reason}`
      },
      [
        { walletId: escrowWallet._id, type: 'DEBIT', balanceType: 'LOCKED', amount: escrowShare },
        { walletId: systemWallet._id, type: 'DEBIT', balanceType: 'AVAILABLE', amount: platformShare },
        { walletId: buyerWallet._id, type: 'CREDIT', balanceType: 'AVAILABLE', amount: entryFeePaid }
      ],
      session
    );

    return updatedBuyer;
  }

  /**
   * Payout Seller on Auction Finalization
   */
  static async payoutSellerOnFinalization({ winnerId, sellerId, winningBid, finalValueCommissionPct, totalEntryFeeEscrow, auctionId }, session) {
    const fvfTxKey = `fvf-${auctionId}`;
    if (await this.checkIdempotency(fvfTxKey, session)) return;

    const commissionAmount = Math.round((winningBid * finalValueCommissionPct) / 100);
    const sellerNetWinningBid = winningBid - commissionAmount;

    const winnerWallet = winnerId ? await this.getWalletByUserId(winnerId, session) : null;
    const sellerWallet = await this.getWalletByUserId(sellerId, session);
    const systemWallet = await this.getSystemWallet(session);
    const escrowWallet = totalEntryFeeEscrow > 0 ? await this.getEscrowWallet(session) : null;

    if (winnerWallet && winningBid > 0) {
      if (winnerWallet.lockedBalance < winningBid) {
        throw new Error('Winner has insufficient locked funds to settle auction.');
      }

      const updatedWinner = await Wallet.findOneAndUpdate(
        { _id: winnerWallet._id, lockedBalance: { $gte: winningBid } },
        { $inc: { lockedBalance: -winningBid, version: 1 } },
        { session }
      );

      if (!updatedWinner) {
        throw new Error('Winner has insufficient locked funds to settle auction.');
      }

      await Wallet.findOneAndUpdate({ _id: sellerWallet._id }, { $inc: { availableBalance: sellerNetWinningBid, version: 1 } }, { session });
      await Wallet.findOneAndUpdate({ _id: systemWallet._id }, { $inc: { availableBalance: commissionAmount, version: 1 } }, { session });

      await LedgerService.recordTransaction(
        {
          referenceType: 'PLATFORM_COMMISSION',
          referenceId: auctionId,
          idempotencyKey: fvfTxKey,
          description: `Platform Final Value Fee (${finalValueCommissionPct}%) on winning bid ₹${winningBid}`
        },
        [
          { walletId: winnerWallet._id, type: 'DEBIT', balanceType: 'LOCKED', amount: winningBid },
          { walletId: sellerWallet._id, type: 'CREDIT', balanceType: 'AVAILABLE', amount: sellerNetWinningBid },
          { walletId: systemWallet._id, type: 'CREDIT', balanceType: 'AVAILABLE', amount: commissionAmount }
        ],
        session
      );
    }

    if (escrowWallet && totalEntryFeeEscrow > 0) {
      const entryPayoutTxKey = `entry-payout-${auctionId}`;
      if (!await this.checkIdempotency(entryPayoutTxKey, session)) {
        await Wallet.findOneAndUpdate({ _id: escrowWallet._id }, { $inc: { lockedBalance: -totalEntryFeeEscrow, version: 1 } }, { session });
        await Wallet.findOneAndUpdate({ _id: sellerWallet._id }, { $inc: { availableBalance: totalEntryFeeEscrow, version: 1 } }, { session });

        await LedgerService.recordTransaction(
          {
            referenceType: 'ENTRY_FEE_PAYOUT',
            referenceId: auctionId,
            idempotencyKey: entryPayoutTxKey,
            description: 'Release of escrowed entry fees to seller'
          },
          [
            { walletId: escrowWallet._id, type: 'DEBIT', balanceType: 'LOCKED', amount: totalEntryFeeEscrow },
            { walletId: sellerWallet._id, type: 'CREDIT', balanceType: 'AVAILABLE', amount: totalEntryFeeEscrow }
          ],
          session
        );
      }
    }
  }

  /**
   * Process Buy Now instant purchase
   */
  static async processBuyNowPayment({ buyerId, sellerId, buyNowPrice, finalValueCommissionPct, totalEntryFeeEscrow, auctionId, idempotencyKey }, session) {
    const txKey = idempotencyKey || `buynow-${auctionId}-${buyerId}`;
    if (await this.checkIdempotency(txKey, session)) {
      return await this.getWalletByUserId(buyerId, session);
    }

    const buyerWallet = await this.getWalletByUserId(buyerId, session);
    const sellerWallet = await this.getWalletByUserId(sellerId, session);
    const systemWallet = await this.getSystemWallet(session);
    const escrowWallet = totalEntryFeeEscrow > 0 ? await this.getEscrowWallet(session) : null;

    if (buyerWallet.availableBalance < buyNowPrice) {
      throw new Error(`Insufficient wallet balance for Buy Now (Available: ₹${buyerWallet.availableBalance}, Buy Now Price: ₹${buyNowPrice})`);
    }

    const commissionAmount = Math.round((buyNowPrice * finalValueCommissionPct) / 100);
    const sellerNetPayment = buyNowPrice - commissionAmount;

    const updatedBuyer = await Wallet.findOneAndUpdate(
      { _id: buyerWallet._id, availableBalance: { $gte: buyNowPrice } },
      { $inc: { availableBalance: -buyNowPrice, version: 1 } },
      { session, returnDocument: 'after' }
    );

    if (!updatedBuyer) {
      throw new Error(`Insufficient wallet balance for Buy Now (Available: ₹${buyerWallet.availableBalance}, Buy Now Price: ₹${buyNowPrice})`);
    }

    await Wallet.findOneAndUpdate({ _id: sellerWallet._id }, { $inc: { availableBalance: sellerNetPayment, version: 1 } }, { session });
    await Wallet.findOneAndUpdate({ _id: systemWallet._id }, { $inc: { availableBalance: commissionAmount, version: 1 } }, { session });

    await LedgerService.recordTransaction(
      {
        referenceType: 'BUY_NOW_PAYMENT',
        referenceId: auctionId,
        idempotencyKey: txKey,
        description: `Buy Now purchase for auction (FVF Commission: ₹${commissionAmount}, Seller Net: ₹${sellerNetPayment})`
      },
      [
        { walletId: buyerWallet._id, type: 'DEBIT', balanceType: 'AVAILABLE', amount: buyNowPrice },
        { walletId: sellerWallet._id, type: 'CREDIT', balanceType: 'AVAILABLE', amount: sellerNetPayment },
        { walletId: systemWallet._id, type: 'CREDIT', balanceType: 'AVAILABLE', amount: commissionAmount }
      ],
      session
    );

    if (escrowWallet && totalEntryFeeEscrow > 0) {
      const entryPayoutTxKey = `entry-payout-buynow-${auctionId}`;
      if (!await this.checkIdempotency(entryPayoutTxKey, session)) {
        await Wallet.findOneAndUpdate({ _id: escrowWallet._id }, { $inc: { lockedBalance: -totalEntryFeeEscrow, version: 1 } }, { session });
        await Wallet.findOneAndUpdate({ _id: sellerWallet._id }, { $inc: { availableBalance: totalEntryFeeEscrow, version: 1 } }, { session });

        await LedgerService.recordTransaction(
          {
            referenceType: 'ENTRY_FEE_PAYOUT',
            referenceId: auctionId,
            idempotencyKey: entryPayoutTxKey,
            description: 'Release of escrowed entry fees to seller on Buy Now purchase'
          },
          [
            { walletId: escrowWallet._id, type: 'DEBIT', balanceType: 'LOCKED', amount: totalEntryFeeEscrow },
            { walletId: sellerWallet._id, type: 'CREDIT', balanceType: 'AVAILABLE', amount: totalEntryFeeEscrow }
          ],
          session
        );
      }
    }

    return updatedBuyer;
  }
}

module.exports = WalletService;

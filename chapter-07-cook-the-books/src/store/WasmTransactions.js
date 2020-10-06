import initializeWasm from './initializeWasm.js';

/**
 * Class used to wrap the functionality from the Wasm module (rather
 * than access it directly from the Vue components or store).
 * @class
 */

export default class WasmTransactions {
  constructor() {
    this.instance = null;
    this.categories = [];
  }

  async initialize() {
    this.instance = await initializeWasm();
    return this;
  }

  getCategoryId(category) {
    return this.categories.indexOf(category);
  }

  // Ensures the raw and cooked amounts have the proper sign (withdrawals
  // are negative and deposits are positive).
  getValidAmounts(transaction) {
    const { rawAmount, cookedAmount, type } = transaction;
    const getAmount = amount =>
      type === 'Withdrawal' ? -Math.abs(amount) : amount;
    return {
      validRaw: getAmount(rawAmount),
      validCooked: getAmount(cookedAmount)
    };
  }

  // Adds the specified transaction to the linked list in the Wasm module.
  addToWasm(transaction) {
    const { id, category } = transaction;
    const { validRaw, validCooked } = this.getValidAmounts(transaction);
    const categoryId = this.getCategoryId(category);
    this.instance.addTransaction(id, categoryId, validRaw, validCooked);
  }

  // Updates the transaction node in the Wasm module:
  editInWasm(transaction) {
    const { id, category } = transaction;
    const { validRaw, validCooked } = this.getValidAmounts(transaction);
    const categoryId = this.getCategoryId(category);
    this.instance.editTransaction(id, categoryId, validRaw, validCooked);
  }

  // Removes the transaction node from the linked list in the Wasm module:
  removeFromWasm(transactionId) {
    this.instance.removeTransaction(transactionId);
  }

  // Populates the linked list in the Wasm module. The categories are
  // needed to set the categoryId in the Wasm module.
  populateInWasm(transactions, categories) {
    this.categories = categories;
    transactions.forEach(transaction => this.addToWasm(transaction));
  }

  // Returns the balance for raw and cooked transactions based on the
  // specified initial balances.
  getCurrentBalances(initialRaw, initialCooked) {
    const currentRaw = this.instance.getFinalBalanceForType(
      1,
      initialRaw
    );
    const currentCooked = this.instance.getFinalBalanceForType(
      2,
      initialCooked
    );
    return { currentRaw, currentCooked };
  }

  // Returns an object that has category totals for all income (deposit)
  // and expense (withdrawal) transactions.
  getCategoryTotals() {
    // This is done to ensure the totals reflect the most recent
    // transactions:
    this.instance.recalculateForCategories();
    const categoryTotals = this.categories.map((category, idx) => ({
      category,
      id: idx,
      rawTotal: this.instance.getCategoryTotal(1, idx),
      cookedTotal: this.instance.getCategoryTotal(2, idx)
    }));

    const totalsByGroup = { income: [], expenses: [] };
    categoryTotals.forEach(categoryTotal => {
      if (categoryTotal.rawTotal < 0) {
        totalsByGroup.expenses.push(categoryTotal);
      } else {
        totalsByGroup.income.push(categoryTotal);
      }
    });
    return totalsByGroup;
  }
}

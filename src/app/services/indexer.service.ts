import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class IndexerService {

  private mainnetLocalStorageKey = 'mainnetIndexers';
  private testnetLocalStorageKey = 'testnetIndexers';
  private mainnetPrimaryIndexerKey = 'mainnetPrimaryIndexer';
  private testnetPrimaryIndexerKey = 'testnetPrimaryIndexer';

  private defaultMainnetIndexer = 'https://btc.indexer.angor.io/';
  private defaultTestnetIndexer = 'https://tbtc.indexer.angor.io/';

  constructor() {
    // Initialize with default indexers if not already present
    this.initializeDefaultIndexers();
  }

  /**
   * Initializes the default indexers if not present in local storage.
   */
  private initializeDefaultIndexers(): void {
    if (this.getIndexers('mainnet').length === 0) {
      this.addIndexer(this.defaultMainnetIndexer, 'mainnet');
      this.setPrimaryIndexer(this.defaultMainnetIndexer, 'mainnet');
    }
    if (this.getIndexers('testnet').length === 0) {
      this.addIndexer(this.defaultTestnetIndexer, 'testnet');
      this.setPrimaryIndexer(this.defaultTestnetIndexer, 'testnet');
    }
  }

  /**
   * Adds a new indexer to the specified network and stores it in local storage.
   * @param indexer The indexer to be added.
   * @param network The network (mainnet or testnet).
   */
  addIndexer(indexer: string, network: 'mainnet' | 'testnet'): void {
    let indexers = this.getIndexers(network);
    if (!indexers.includes(indexer)) {
      indexers.push(indexer);
      this.saveIndexers(indexers, network);
    }
  }

  /**
   * Retrieves the list of indexers from local storage for the specified network.
   * @param network The network (mainnet or testnet).
   * @returns The list of indexers.
   */
  getIndexers(network: 'mainnet' | 'testnet'): string[] {
    const storageKey = network === 'mainnet' ? this.mainnetLocalStorageKey : this.testnetLocalStorageKey;
    return JSON.parse(localStorage.getItem(storageKey) || '[]');
  }

  /**
   * Saves the list of indexers in local storage for the specified network.
   * @param indexers The list of indexers to be saved.
   * @param network The network (mainnet or testnet).
   */
  private saveIndexers(indexers: string[], network: 'mainnet' | 'testnet'): void {
    const storageKey = network === 'mainnet' ? this.mainnetLocalStorageKey : this.testnetLocalStorageKey;
    localStorage.setItem(storageKey, JSON.stringify(indexers));
  }

  /**
   * Sets the specified indexer as the primary indexer for the specified network and stores it in local storage.
   * @param indexer The indexer to be set as primary.
   * @param network The network (mainnet or testnet).
   */
  setPrimaryIndexer(indexer: string, network: 'mainnet' | 'testnet'): void {
    if (this.getIndexers(network).includes(indexer)) {
      const primaryKey = network === 'mainnet' ? this.mainnetPrimaryIndexerKey : this.testnetPrimaryIndexerKey;
      localStorage.setItem(primaryKey, indexer);
    }
  }

  /**
   * Retrieves the primary indexer from local storage for the specified network.
   * @param network The network (mainnet or testnet).
   * @returns The primary indexer.
   */
  getPrimaryIndexer(network: 'mainnet' | 'testnet'): string | null {
    const primaryKey = network === 'mainnet' ? this.mainnetPrimaryIndexerKey : this.testnetPrimaryIndexerKey;
    return localStorage.getItem(primaryKey);
  }

  /**
   * Removes an indexer from the list and updates local storage for the specified network.
   * If the removed indexer was the primary, the primary indexer is also cleared.
   * @param indexer The indexer to be removed.
   * @param network The network (mainnet or testnet).
   */
  removeIndexer(indexer: string, network: 'mainnet' | 'testnet'): void {
    let indexers = this.getIndexers(network);
    const index = indexers.indexOf(indexer);
    if (index !== -1) {
      indexers.splice(index, 1);
      this.saveIndexers(indexers, network);
      if (indexer === this.getPrimaryIndexer(network)) {
        const primaryKey = network === 'mainnet' ? this.mainnetPrimaryIndexerKey : this.testnetPrimaryIndexerKey;
        localStorage.removeItem(primaryKey);
      }
    }
  }

  /**
   * Clears all indexers and the primary indexer from local storage for the specified network.
   * @param network The network (mainnet or testnet).
   */
  clearAllIndexers(network: 'mainnet' | 'testnet'): void {
    const storageKey = network === 'mainnet' ? this.mainnetLocalStorageKey : this.testnetLocalStorageKey;
    const primaryKey = network === 'mainnet' ? this.mainnetPrimaryIndexerKey : this.testnetPrimaryIndexerKey;
    localStorage.removeItem(storageKey);
    localStorage.removeItem(primaryKey);
  }
}

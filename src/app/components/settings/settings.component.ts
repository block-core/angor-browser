import { ChangeDetectorRef, Component, OnInit, TemplateRef, ViewChild } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { NostrService } from '../../services/nostr.service';
import { IndexerService } from '../../services/indexer.service';
import { RelayService } from '../../services/relay.service';

@Component({
  selector: 'app-settings',
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.css'],
})
export class SettingsComponent implements OnInit {
  @ViewChild('addRelayModal') addRelayModal!: TemplateRef<any>;

  relays: any[] = [];
  newRelayUrl: string = '';
  connectionStatus: string = '';
  connectButtonText: string = 'Refresh Relays';

  newIndexerUrlMainnet: string = '';
  newIndexerUrlTestnet: string = '';
  indexersMainnet: Array<{ url: string; primary: boolean }> = [];
  indexersTestnet: Array<{ url: string; primary: boolean }> = [];
  selectedNetwork: 'mainnet' | 'testnet' = 'testnet';


  constructor(
    private nostrService: NostrService,
    private relayService: RelayService,
    public dialog: MatDialog,
    private indexerService: IndexerService,
    private cdRef: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadNetwork();
    this.loadRelays();
    this.loadIndexers();
  }

  loadNetwork() {
     this.selectedNetwork = this.indexerService.getNetwork();
  }

  loadIndexers() {
    this.indexersMainnet = this.indexerService.getIndexers('mainnet').map((url) => ({
      url,
      primary: url === this.indexerService.getPrimaryIndexer('mainnet'),
    }));

    this.indexersTestnet = this.indexerService.getIndexers('testnet').map((url) => ({
      url,
      primary: url === this.indexerService.getPrimaryIndexer('testnet'),
    }));
  }

  addIndexer(network: string) {
    if (network === 'mainnet' && this.newIndexerUrlMainnet) {
      this.indexerService.addIndexer(this.newIndexerUrlMainnet, 'mainnet');
      this.loadIndexers();
      this.newIndexerUrlMainnet = '';
    } else if (network === 'testnet' && this.newIndexerUrlTestnet) {
      this.indexerService.addIndexer(this.newIndexerUrlTestnet, 'testnet');
      this.loadIndexers();
      this.newIndexerUrlTestnet = '';
    }
  }

  removeIndexer(network: string, indexer: { url: string; primary: boolean }) {
    if (network === 'mainnet') {
      this.indexerService.removeIndexer(indexer.url, 'mainnet');
    } else if (network === 'testnet') {
      this.indexerService.removeIndexer(indexer.url, 'testnet');
    }
    this.loadIndexers();
  }

  toggleIndexerStatus(network: string, indexer: { url: string; primary: boolean }) {
    if (network === 'mainnet') {
      this.indexerService.setPrimaryIndexer(indexer.url, 'mainnet');
    } else if (network === 'testnet') {
      this.indexerService.setPrimaryIndexer(indexer.url, 'testnet');
    }
    this.loadIndexers();
  }

  loadRelays() {
    this.relays = this.relayService.getRelays();
    this.cdRef.detectChanges();
  }

  openAddRelayModal() {
    this.dialog.open(this.addRelayModal);
  }

  addRelay() {
    if (this.newRelayUrl) {
      this.relayService.addRelay(this.newRelayUrl);
      this.newRelayUrl = '';
      this.dialog.closeAll();
    }
  }

  toggleRelayStatus(relay: any) {
    relay.connected = !relay.connected;
    this.relayService.saveRelaysToLocalStorage();
  }

  async connectRelays() {
    try {
      await this.relayService.connectToRelays();
      this.connectionStatus = `Connected to relays: ${this.relayService.getRelays()
        .map((r) => r.url)
        .join(', ')}`;
      this.connectButtonText = 'Connected';
    } catch (error) {
      this.connectionStatus = 'Failed to connect to relays';
      this.connectButtonText = 'Connect to Relays';
    }
  }

  removeRelay(relayUrl: string): void {
    this.relayService.removeRelay(relayUrl);
    this.loadRelays();
  }

  removeAllCustomRelays(): void {
    this.relayService.removeAllCustomRelays();
    this.loadRelays();
  }
  setNetwork(network: 'mainnet' | 'testnet'): void {
    this.selectedNetwork = network;
    this.indexerService.setNetwork(network);
  }
}

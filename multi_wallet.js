/* EIP-6963 Wallet Detection and Selection Module */

import { logos } from './logolist.js';

const addedWallets = new Set();
let walletContainer, connectButton, statusMessage;
let selectedWallet = null;
let selectedWalletRdns = null;
let isDOMLoaded = false;
const providerQueue = [];
const walletLogos = logos;

// Handle newly discovered providers
function handleNewProvider(providerDetail) {
    if (!walletContainer) {
        console.error('walletContainer is not defined');
        alert("No Wallets detected in the browser!");
        return;
    }

    if (addedWallets.has(providerDetail.info.uuid)) return;
    addedWallets.add(providerDetail.info.uuid);

    const walletOption = document.createElement('div');
    walletOption.classList.add('wallet-option');

    const logo = document.createElement('img');
    logo.src = walletLogos[providerDetail.info.name] || './notfound.svg'; // fallback
    logo.alt = providerDetail.info.name;
    logo.classList.add('wallet-logo');

    const label = document.createElement('label');
    label.textContent = providerDetail.info.name;
    label.classList.add('wallet-label');

    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'walletSelection';
    radio.value = providerDetail.info.uuid;
    radio.onclick = () => selectWallet(providerDetail.info.rdns, providerDetail.provider, providerDetail.info.name);

    walletOption.appendChild(logo);
    walletOption.appendChild(label);
    walletOption.appendChild(radio);

    walletContainer.appendChild(walletOption);
}

// Select wallet and enable connect button
function selectWallet(providerrdns, provider, walletName) {
    selectedWallet = provider;
    selectedWalletRdns = providerrdns;

    console.log(`Selected wallet: ${walletName}`);
    statusMessage.textContent = `Selected: ${walletName}`;
    connectButton.disabled = false;
}

// Connect to the selected wallet (Multi-wallet supported)
async function connectToWallet() {
    if (!selectedWallet) {
        statusMessage.textContent = 'No wallet selected.';
        return;
    }

    try {
        localStorage.setItem("selectedWalletRdns", selectedWalletRdns);
        const accounts = await selectedWallet.request({ method: 'eth_requestAccounts' });

        console.log('Connected account:', accounts[0]);
        statusMessage.textContent = `Connected: ${accounts[0]}`;
        setupWalletListeners(selectedWallet);

        setTimeout(() => {
            window.location.href = '/session.html';
        }, 500);
    } catch (error) {
        console.error('Connection failed:', error);
        statusMessage.textContent = 'Connection failed. Check console for details.';
    }
}

// Wallet event listeners
function setupWalletListeners(provider) {
    provider.on('accountsChanged', (newAccounts) => {
        console.log('Account changed:', newAccounts[0]);
        statusMessage.textContent = `Account changed: ${newAccounts[0]}`;
    });

    provider.on('chainChanged', (chainId) => {
        console.log('Chain changed:', chainId);
        statusMessage.textContent = `Chain changed: ${chainId}`;
    });

    provider.on('disconnect', (error) => {
        console.log('Wallet disconnected:', error);
        statusMessage.textContent = 'Wallet disconnected.';
        resetSelection();
    });
}

// Reset selected wallet
function resetSelection() {
    selectedWallet = null;
    selectedWalletRdns = null;
    statusMessage.textContent = 'Wallet selection reset.';
    connectButton.disabled = true;
}

// Handle providers added before DOM loaded
function processProviderQueue() {
    while (providerQueue.length > 0) {
        handleNewProvider(providerQueue.shift());
    }
}

// Listen for wallet announcements
window.addEventListener('eip6963:announceProvider', (event) => {
    if (isDOMLoaded) {
        handleNewProvider(event.detail);
    } else {
        providerQueue.push(event.detail);
    }
});

// Initialize UI when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    walletContainer = document.getElementById('walletContainer');
    connectButton = document.getElementById('connectButton');
    statusMessage = document.getElementById('statusMessage');
    isDOMLoaded = true;

    processProviderQueue();
    window.dispatchEvent(new Event('eip6963:requestProvider'));

    connectButton.addEventListener('click', connectToWallet);
});

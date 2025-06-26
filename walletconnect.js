window.selectedWallet = null;
let eventCount = 0;
const storedWalletRdns = localStorage.getItem("selectedWalletRdns");

const handleProviderAnnouncement = (event) => {
    eventCount++;

    if (!storedWalletRdns) {
        console.log("No wallets selected");
        return;
    }

    if (event.detail.info.rdns === storedWalletRdns) {
        window.selectedWallet = event.detail.provider;
        console.log(`Selected Wallet Detected: ${event.detail.info.name}`);

        // Store that the wallet was successfully reconnected
        localStorage.setItem("walletReconnected", "true");

        // Stop listening to the event after detecting the correct wallet
        window.removeEventListener('eip6963:announceProvider', handleProviderAnnouncement);
    } else {
        console.log("Waiting for Selected Wallet Provider Announcement");
    }

};

window.addEventListener('eip6963:announceProvider', handleProviderAnnouncement);

// If page reloads, request provider announcement again to restore wallet
if (!window.selectedWallet) {
    window.dispatchEvent(new Event('eip6963:requestProvider'));
}

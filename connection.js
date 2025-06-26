import { npByInfura, mlmCrtAddress } from './config.js';

let browserWallet;
let npByWallet;
let currentAccount = 0;

async function getABI() {
    let response;
    response = await fetch('./mlm.json');
    const _abiCode = await response.json();
    return _abiCode;
}

async function initContractInstance(provider) {
    try {
        const abiCode = await getABI();
        let crtInstance;

        if (provider === "infura") { 
            crtInstance = new npByInfura.eth.Contract(abiCode, mlmCrtAddress);
        } else if (provider === "wallet") {

            if (!browserWallet) {
                throw new Error("Wallet provider not available");
            }
            
            if (!npByWallet) {
                npByWallet = new Web3(browserWallet);
            }
            
            const chainIDStatus = await checkChainId(npByWallet);
            console.log("Chain ID Status:", chainIDStatus);
            
            if (!chainIDStatus) {
                toastr.error("Inappropriate network! Please switch to OPBNB network!");
                return null;
            }
            
            crtInstance = new npByWallet.eth.Contract(abiCode, mlmCrtAddress);
        } else {
            throw new Error("Incorrect Provider requested");
        }
        
        return crtInstance;
    } catch (error) {
        console.error("Error initializing contract:", error);
        toastr.error("Failed to initialize contract");
        return null;
    }
}

async function checkUserInSmartContract(walletAddress) {
    try {
        const mlmWalletInst = await initContractInstance("wallet");
        const userData = await mlmWalletInst.methods.users(walletAddress).call({ from: walletAddress });
        const isActive = userData.isExist;
        console.log("User exists:", isActive);

        if (isActive) { console.log("User exists in the contract."); return true; } 
        else { console.log("User does not exist."); return false; }
    } catch (error) {
        toastr.error('Error checking user status');
    }
}

async function checkChainId(web3Instance) {
    try {
        if (!web3Instance) {
            console.error("Web3 instance not provided");
            return false;
        }
        
        const currentNetwork = Number(await web3Instance.eth.getChainId());
        console.log("Current Network ID:", currentNetwork);
        
        // Check for both testnet (5611) and mainnet (204)
        return currentNetwork === 204 || currentNetwork === 5611; // To remove the opBNB testnet chain id in production
    } catch (error) {
        console.error("Error checking chain ID:", error);
        toastr.error('Error in accessing chain id information');
        return false;
    }
}

async function walletNetworkConfig(){
    try{
        if (browserWallet == null) { toastr.error('No wallet detected!'); return [false, "No wallet detected!"]; }
        npByWallet = new Web3(browserWallet);
        const isProperNetwork = await checkChainId(npByWallet);
        if (!isProperNetwork) {toastr.error('Inappropriate network! Please switch to OPBNB network.'); return [false, "Inappropriate network! Please switch to OPBNB network."]; }
        return [true, "success"];
    } catch (error) {toastr.error(`${error.message}`); return [false, error.message]; } 
}
async function handleNetworkChange() {
    try {
        await browserWallet.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: '5611' }], // 0x204 for opBNB Mainnet // 0x5611 for opBNB Testnet
        });
        return [true, "Switched to the expected network successfully"];
    } catch (error) {
        if (error.code === 4902) {
            toastr.error("Expected Network not found in the wallet");
            return [false, "Expected Network not found in the wallet"];
        } else if (error.code === 4001) {
            toastr.error("Network switch request was rejected");
            return [false, "Network switch request was rejected"];
        } else {
            toastr.error(`Network switch error: ${error.message}`);
            return [false, error.message];
        }
    }
}

const checkBrowserWallet = async () => {
    try {
        if (!browserWallet) {
            toastr.error('No wallet detected!');
            return [false, "No wallet detected!"];
        }
        return [true, null];
    } catch (error) {
        return [false, error.message];
    }
};

const handleAccountsChanged = (accounts) => {
    if(currentAccount !== accounts[0]) { alert("Logged in account has been changed !!"); userLogOut(); }
    if (accounts.length === 0) { alert("No accounts detected!!"); userLogOut(); }
    if (currentAccount === 0){ console.log("No Registered Accounts !!"); return; }
};

const handleChainChanged = async (chainId) => {
    const currentChainId = parseInt(chainId, 16);
    if (currentChainId !== 204 && currentChainId !== 5611) { // Remove opBNB Testnet id in production
        const networkMessage = "Inappropriate Network \n \n \n Switch back to opBNB to stay Logged in ?";
        const networkChangeRequest = confirm(networkMessage);
        if (!networkChangeRequest) { userLogOut(); return; }
        else { const [networkStatus, netMsg] = await handleNetworkChange();
        if (networkStatus) { alert("Switched to opBNB successfully!");}
        else { console.log("Unable to switch", netMsg); userLogOut(); return; }
        }
    }
};

const initiateWalletEvents = async () => {
    const [walletAvailable, errorMessage] = await checkBrowserWallet();
    if (!walletAvailable) { console.log("Error Occured: ", errorMessage); return; }

    browserWallet.on('accountsChanged', handleAccountsChanged);
    browserWallet.on('chainChanged', handleChainChanged);
};

async function extractReferralId() {
    try {
        const [netStatus, statusMsg] = await walletNetworkConfig();
        console.log("Reason", statusMsg);
        if(!netStatus) { return false; }
        const accounts = await browserWallet.request({ method: 'eth_requestAccounts' });
        document.getElementById('walletAddress').textContent = accounts[0];
        const mlmWalletInst = await initContractInstance("wallet");
        
        const urlInput = document.getElementById('referralUrl');
        if (!urlInput || !urlInput.value) return null;

        const url = urlInput.value.trim();
        const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);

        const refParam = urlObj.searchParams.get('ref'); 
        if (refParam) {
            const cleanRef = refParam.replace(/[^a-zA-Z0-9_-]/g, '');
            document.getElementById('referrerId').textContent = cleanRef;
            const refrAddress = await mlmWalletInst.methods.userList(cleanRef).call({ from: accounts[0] });            
            document.getElementById('referrerWallet').textContent = refrAddress;
            return cleanRef || null;
        }

        const pathParts = urlObj.pathname.split('/');
        const refIndex = pathParts.findIndex(part => ['ref', 'referral', 'r'].includes(part));
        if (refIndex !== -1 && pathParts[refIndex + 1]) {
            const cleanRef = pathParts[refIndex + 1].replace(/[^a-zA-Z0-9_-]/g, '');
            document.getElementById('referrerId').textContent = cleanRef;
            const refrAddress = await mlmWalletInst.methods.userList(cleanRef).call({ from: accounts[0] });            
            document.getElementById('referrerWallet').textContent = refrAddress;
            return cleanRef || null;
        }

        return null;
    } catch (error) {
        console.error("Error extracting referral ID:", error);
        return null;
    }
}

async function logIN(){
    const walletDetails = document.getElementById('walletDetails');
    const loginButton = document.getElementById('userloginbtn');
    const registerBtn = document.getElementById('userregisterbtn');
    const ProgressBar = document.getElementById('bar-progress');
    try {
        const [netStatus, statusMsg] = await walletNetworkConfig();
        console.log("Reason", statusMsg);
        if(!netStatus) { return false; }
        walletDetails.innerHTML = "Trying to Connect";
        loginButton.classList.add('d-none');
        registerBtn.classList.add('d-none');
        ProgressBar.classList.remove('d-none');
        const accounts = await browserWallet.request({ method: 'eth_requestAccounts' });
        const loginMessage = "Do you want to login to DeGuess with " + accounts[0];
        const loginRequest = await Swal.fire({
            title: 'Confirmation',
            text: loginMessage,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Okay',
            cancelButtonText: 'Cancel',
            reverseButtons: true
        }).then((result) => result.isConfirmed);
        let userRegistrationStatus;
        if (accounts.length >= 1 && loginRequest) { userRegistrationStatus = await checkUserInSmartContract(accounts[0]); }
        else {
            toastr.error("Login Failed"); 
            walletDetails.innerHTML = "No Wallet Detected !";
            loginButton.classList.remove('d-none');
            registerBtn.classList.remove('d-none');
            ProgressBar.classList.add('d-none'); 
            return false; 
        }

        if (userRegistrationStatus) {
            currentAccount = accounts[0];
            // console.log(typeof(currentAccount));
            // showSuccess(`Logged in using address: ${currentAccount}`);
            localStorage.setItem('currentAccount', currentAccount);
            setTimeout(()=>{
            window.location.href = 'dashboard.html'
            }, 500);
            return true;
        } else{
            toastr.error('Not a Registered User');
            walletDetails.innerHTML = "No Wallet Detected !";
            loginButton.classList.remove('d-none');
            registerBtn.classList.remove('d-none');
            ProgressBar.classList.add('d-none'); 
            return false; 
        }

        } catch (error) {
            walletDetails.innerHTML = "No Wallet Detected !";
            loginButton.classList.remove('d-none');
            registerBtn.classList.remove('d-none');
            ProgressBar.classList.add('d-none'); 
            if (error.message.includes("User denied transaction signature") || error.code == 4001) {
                toastr.error("User denied transaction signature.");
            }
            else if (error.message.includes("Internal JSON-RPC error") || error.code == -32603) {
                toastr.error("Please Increase Gas fee! Also Check gas, network settings!");
            }
            else if (error.message.includes("revert")) {
                toastr.error("Transaction reverted. Contract conditions failed.");
            }
            else {
                toastr.error("Error occured while login");
            }
     }
}

async function toRegisterPage(){
    const accounts = await browserWallet.request({ method: 'eth_requestAccounts' });
    let userRegistrationStatus;
    if (accounts.length >= 1) {userRegistrationStatus = await checkUserInSmartContract(accounts[0]); }
    if (userRegistrationStatus) { toastr.info("Already a registered user"); return null; }

    setTimeout(()=>{
    window.location.href = 'register.html'
    }, 500);
}

// async function registerOnchain(){

//     try {
//         const [netStatus, statusMsg] = await walletNetworkConfig();
//         if(!netStatus) { return false; }
//         const accounts = await browserWallet.request({ method: 'eth_requestAccounts' });
//         document.getElementById('walletAddress').value = accounts[0];
//         const registerMessage = "Do you want to register with " + accounts[0] + " ??";
//         const registerRequest = await Swal.fire({
//             title: 'Confirmation',
//             text: registerMessage,
//             icon: 'question',
//             showCancelButton: true,
//             confirmButtonText: 'Okay',
//             cancelButtonText: 'Cancel',
//             reverseButtons: true
//         }).then((result) => result.isConfirmed);
//         let userRegistrationStatus;
//         if (accounts.length >= 1 && registerRequest) {userRegistrationStatus = await checkUserInSmartContract(accounts[0]); }
//         else { toastr.error(`Registration Failed`); alert("Hi 1"); window.location.href = '/session.html'; }
//         if (userRegistrationStatus) { toastr.info("Already a registered user"); alert("Hi 2"); window.location.href = '/session.html'; }

//         const [userCreationStatus, creationErr] = await createUser(accounts[0]);
//         if (userCreationStatus) { 
//             currentAccount = accounts[0];
//             toastr.info( 'Logged in using address' + currentAccount);
//             localStorage.setItem('currentAccount', currentAccount);
//             window.location.href = 'dashboard.html'
//             return true;
//         }else {
//             toastr.error("Registration Failed"); 
//             alert("Hi 3"); 
//             window.location.href = '/session.html';
//         }
//     } catch (error) { 
//         if (error.message.includes("User denied transaction signature") || error.code == 4001) {
//             toastr.error("User denied transaction signature.");
//         }
//         else if (error.message.includes("Internal JSON-RPC error") || error.code == -32603) { toastr.error("Please Increase Gas fee! Also Check gas, network settings!"); }
//         else if (error.message.includes("revert")) { toastr.error("Transaction reverted. Contract conditions failed."); }
//         else { toastr.error("Error submitting transaction"); }
//         alert("Error occured in registration!")
//         window.location.href = '/session.html';
//     }
// }

// async function createUser(walletAddress) {
//     try {
//         const mlmWalletInst = await initContractInstance("wallet");
//         const refr_id = document.getElementById('referrerId').textContent;
//         if(refr_id <= 0 || refr_id == "Not specified") {
//             alert("Invalid Referrer ID");
//             return null;
//         }
//         const estimatedGas = await mlmWalletInst.methods.regUser(refr_id).estimateGas({ from: walletAddress });
//         const adjustedGas = Number(BigInt(estimatedGas) * 200n / 100n);
//         console.log(adjustedGas);

//         const status = await mlmWalletInst.methods.regUser(refr_id).send({ 
//             from: walletAddress, 
//             value: browserWallet.utils.toWei('50', 'ether'),
//             gas: adjustedGas
//             // gasPrice: adjustedGas
//         })
//             .on('transactionHash', function (hash) { showAlert("Transaction yet to be confirmed. Don't refresh the page.", "info") })
//             // .on('confirmation', function (confirmationNumber, receipt) {  })
//             .on('receipt', function (receipt) { 
//                 if (receipt.status) {
//                     const events = receipt.events;
//                     if (events && events.regLevelEvent) {
//                         const { _userAddress, _referrerAddress, _timeOfReg } = events.regLevelEvent.returnValues;
//                         if (_userAddress.toLowerCase() == walletAddress.toLowerCase()) {
//                             window.location.href = '/dashboard.html';
//                         }
//                         else{ 
//                             alert("Event emitted with wrong parameters");
//                             window.location.href = '/session.html';
//                         }
//                     } else {
//                         alert("No regLevelEvent Found!");
//                         window.location.href = '/session.html';
//                     }

//                 }
//             })
//             .on('error', function (error) {
//                 if (error.code === 4001) { toastr.error("User rejected the transaction"); }
//                 else { toastr.error(error.message); } 
//             });

//     } catch (error) { 
//         if (error.message.includes("User denied transaction signature") || error.code == 4001) {
//             toastr.error("User denied transaction signature.");
//         }
//         else if (error.message.includes("Internal JSON-RPC error") || error.code == -32603) {
//             toastr.error("Please Increase Gas fee! Also Check gas, network settings!");
//         }
//         else if (error.message.includes("revert")) { toastr.error("Transaction reverted. Contract conditions failed."); }
//         else { toastr.error("Error submitting transaction"); }
//         alert("Hi 0000"); 
//         window.location.href = '/register.html'; 
//     }
// }

async function registerOnchain() {
    try {
        // Check network connection
        const [netStatus, statusMsg] = await walletNetworkConfig();
        if (!netStatus) {
            toastr.error(`Network error: ${statusMsg}`);
            return false;
        }

        // Request accounts
        const accounts = await browserWallet.request({ method: 'eth_requestAccounts' });
        if (!accounts.length) {
            toastr.error("No accounts available");
            return false;
        }

        // Confirm registration
        const isConfirmed = await Swal.fire({
            title: 'Confirm Registration',
            html: `Register with address:<br><strong>${accounts[0]}</strong>`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Register',
            cancelButtonText: 'Cancel',
            reverseButtons: true
        });

        if (!isConfirmed.isConfirmed) {
            toastr.info("Registration cancelled");
            return false;
        }

        // Execute registration
        const [success, message] = await createUser(accounts[0]);
        
        if (success) {
            toastr.success("Registration successful!");
            currentAccount = accounts[0];
            localStorage.setItem('currentAccount', currentAccount);
            setTimeout(()=>{
                window.location.href = '/dashboard.html';
            }, 500);
            
            // return true;
        } else {
            toastr.error(`Registration failed: ${message}`);
            // return false;
        }

    } catch (error) {
        console.error("Registration error:", error);
        toastr.error(`Error: ${error.message || "Unknown error occurred"}`);
        return false;
    }
}

async function createUser(walletAddress) {
    try {
        const mlmWalletInst = await initContractInstance("wallet");
        const refr_id = document.getElementById('referrerId').textContent;
        
        if(refr_id <= 0 || refr_id === "Not specified" || refr_id === "-") {
            toastr.error("Invalid Referrer ID");
            return [false, "Invalid Referrer ID"];
        }

        // const registrationFeeWei = npByWallet.utils.toWei('50', 'ether'); // To be included in production
        const registrationFeeWei = '5000000000000'; // To remove in production

        // Get current gas price and add buffer
        const gasPrice = await npByWallet.eth.getGasPrice();
        const bufferedGasPrice = Math.floor(Number(gasPrice) * 1.2); // 20% buffer
        
        // Estimate gas with correct value
        const estimatedGas = await mlmWalletInst.methods.regUser(refr_id)
            .estimateGas({ 
                from: walletAddress, 
                value: registrationFeeWei 
            });

        // Send transaction with proper value and gas settings
        const status = await mlmWalletInst.methods.regUser(refr_id)
            .send({ 
                from: walletAddress,
                value: registrationFeeWei,
                gas: estimatedGas,
                gasPrice: bufferedGasPrice
            })
            .on('transactionHash', function (hash) { 
                // showAlert("Transaction yet to be confirmed. Don't refresh the page.", "info") 
            })
            // .on('confirmation', function (confirmationNumber, receipt) {  })
            .on('receipt', function (receipt) { 
                if (receipt.status) {
                    const events = receipt.events;
                    if (events && events.regLevelEvent) {
                        const {_user, _referrer, _time} = events.regLevelEvent.returnValues;
                        return [true, "Registration successful"];
                    } else { return [false, "No Registration Event Emitted"]; }
                }
            })
            .on('error', function (error) {
                if (error.code === 4001) { toastr.error("User rejected the transaction"); }
                else { toastr.error(error.message); } 
                return [false, error.message];
            });
        
        } catch (error) {
            console.error("Registration error:", error);
        
            if (error.code === 4001) {
                return [false, "User denied transaction signature"];
            }
            if (error.message?.includes("revert")) {
                // Parse revert reason if available
                const revertReason = error.message.match(/reason string: '(.+?)'/)?.[1] || 
                                error.data?.message?.match(/reverted: (.+)/)?.[1] ||
                                "Contract reverted transaction";
                return [false, revertReason];
            }
            if (error.code === -32603) {
                return [false, "Internal RPC error - check gas settings"];
            }
            return [false, error.message || "Unknown error occurred"];
        }
}

function userLogOut() {
    // Clear session and local storage
    localStorage.clear();
    // Reset account and address variables
    currentAccount = 0;
    // Redirect to session page
    toastr.error("Logged Out. Redirecting to Log in Page...");
    window.location.href = '/multi_wallet.html';
}

function IsLoggedIn(){
    const getCurrentAccount = localStorage.getItem('currentAccount');
    if (currentAccount !== ''){
        currentAccount = getCurrentAccount;
        return true;
    }
    toastr.error("Cannot store account");
    return false;
}

toastr.options = {
    "closeButton": true,
    "progressBar": true,
    "positionClass": "toast-top-right",
    "showDuration": "300",
    "hideDuration": "5000",
    "timeOut": "5000",
    "extendedTimeOut": "5000",
};

//toastr.success(data); toastr.error(data);

function waitForWallet(timeout = 3000) {
    return new Promise((resolve, reject) => {
        let elapsedTime = 0;
        const checkInterval = 100;  
        
        const interval = setInterval(() => {
            if (window.selectedWallet) {
                clearInterval(interval);
                resolve(window.selectedWallet);
            }
            elapsedTime += checkInterval;
            if (elapsedTime >= timeout) {
                clearInterval(interval);
                reject(new Error("Timeout waiting for wallet provider"));
            }
        }, checkInterval);
    });
}

async function getUserDashboardData(userAddress) {
    try {
        const contract = await initContractInstance("wallet");
        if (!contract) {
            throw new Error("Contract initialization failed");
        }

        const [totalEarnings, levelEligibility, directReferrals, userData] = await Promise.all([
            fetchTotalEarnings(contract, userAddress),
            fetchLevelEligibility(contract, userAddress),
            fetchDirectReferrals(contract, userAddress),
            fetchUserData(contract, userAddress)
        ]);

        // Fetch referral data
        const referralLink = `https://yourwebsite.com/register?ref=${userData.id}`;

        // Get income for each level (1-12)
        const levelIncomes = await fetchLevelIncomes(contract, userAddress);

        // Get indirect referrals (up to level 2 depth)
        const indirectReferrals = await fetchIndirectReferrals(contract, directReferrals);

        // Get direct referral IDs
        const directReferralIds = await fetchReferralIds(contract, directReferrals);

        // Get indirect referral IDs
        const indirectReferralIds = await fetchIndirectReferralIds(contract, indirectReferrals);



        return {
            userAddress,
            referralLink,
            totalEarnings,
            levelEligibility,
            levelStatus: generateLevelStatus(levelEligibility),
            levelIncomes,
            directReferrals,
            indirectReferrals,
            directReferralIds,
            indirectReferralIds,
            userId: userData.id
        };
    } catch (error) {
        console.error("Error fetching dashboard data:", error);
        throw error;
    }
}

async function fetchTotalEarnings(contract, userAddress) {
    try {
        const earnings = await contract.methods.totalEarnings(userAddress).call();
        return npByWallet.utils.fromWei(earnings, 'ether');
    } catch (error) {
        console.error("Error fetching total earnings:", error);
        return "0";
    }
}

async function fetchLevelEligibility(contract, userAddress) {
    try {
        const eligibility = await contract.methods.getUserLevelEligibility(userAddress).call();
        return eligibility.map(level => Number(level));
    } catch (error) {
        console.error("Error fetching level eligibility:", error);
        return [];
    }
}

function generateLevelStatus(levelEligibility) {
    const statusArray = [];

    for (let i = 1; i <= 12; i++) {
        statusArray.push({ level: i, status: levelEligibility.includes(i) ? 'Active' : 'Inactive' });
    }

    return statusArray;
}

async function fetchLevelIncomes(contract, userAddress) {
    try {
        const levelIncomes = [];

        for (let level = 1; level <= 12; level++) {
            const count = await contract.methods.getUserIncomeCount(userAddress, level).call();
            // if (count == 0) { break; }
            levelIncomes.push({ levelNo:level, count: Number(count) });
        }

        return levelIncomes;
    } catch (error) {
        console.error("Error fetching level incomes:", error);
        return Array(12).fill().map((_, i) => ({ level: i + 1, count: 0 }));
    }
}

async function fetchDirectReferrals(contract, userAddress) {
    try {
        const referrals = await contract.methods.getUserReferrals(userAddress).call();

        return referrals;
    } catch (error) {
        console.error("Error fetching direct referrals:", error);
        return [];
    }
}

async function fetchIndirectReferrals(contract, directReferrals) {
    try {
        const indirectReferrals = [];

        for (const referral of directReferrals) {
            const secondLevelReferrals = await contract.methods.getUserReferrals(referral).call();
            indirectReferrals.push({ directReferral: referral, referrals: secondLevelReferrals });
        }

        return indirectReferrals;
    } catch (error) {
        console.error("Error fetching indirect referrals:", error);
        return [];
    }
}

async function fetchUserData(contract, userAddress) {
    try {
        const userData = await contract.methods.users(userAddress).call();
        return userData;
    } catch (error) {
        console.error("Error fetching user data:", error);
        return { id: 0, referrerID: 0, isExist: false };
    }
}

async function fetchReferralIds(contract, referrals) {
    try {
        const referralIds = [];

        for (const referral of referrals) {
            const userData = await contract.methods.users(referral).call();
            referralIds.push({ id: Number(userData.id), address: referral, dateJoined: Number(userData.joined) });
        }

        return referralIds;
    } catch (error) {
        console.error("Error fetching referral IDs:", error);
        return [];
    }
}

async function fetchIndirectReferralIds(contract, indirectReferrals) {
    try {
        const indirectReferralIds = [];

        for (const item of indirectReferrals) {
            const secondLevelIds = [];

            for (const referral of item.referrals) {
                const userData = await contract.methods.users(referral).call();
                secondLevelIds.push({ id: BigInt(userData.id), address: referral, dateJoined: userData.joined });
            }

            indirectReferralIds.push({ referredBy: item.directReferral, secondLevelRefData: secondLevelIds });
        }

        return indirectReferralIds;
    } catch (error) {
        console.error("Error fetching indirect referral IDs:", error);
        return [];
    }
}

function displayGenealogyTree(data) {
    const treeContainer = document.getElementById('genealogyTree');
    treeContainer.innerHTML = '';
    
    // Start building the tree structure
    let treeHTML = '';
    
    // Add current user (YOU)
    treeHTML += `<span class="user you">YOU (${data.userId})</span>\n`;
    
    if (data.directReferralIds.length === 0) {
        treeHTML += '└── No direct referrals\n';
        treeContainer.innerHTML = treeHTML;
        return;
    }
    
    // Process direct referrals
    data.directReferralIds.forEach((directRef, index) => {
        const isLastDirect = index === data.directReferralIds.length - 1;
        const prefix = isLastDirect ? '└── ' : '├── ';
        
        treeHTML += `${prefix}<span class="user direct">${directRef.id}</span>\n`;
        
        // Find indirect referrals for this direct referral
        const indirectRefs = data.indirectReferralIds.find(
            item => item.referredBy === directRef.address
        );
        
        if (indirectRefs && indirectRefs.secondLevelRefData.length > 0) {
            // Process indirect referrals
            indirectRefs.secondLevelRefData.forEach((indirectRef, idx) => {
                const isLastIndirect = idx === indirectRefs.secondLevelRefData.length - 1;
                const indent = isLastDirect ? '    ' : '│   ';
                const subPrefix = isLastIndirect ? '└── ' : '├── ';
                
                treeHTML += `${indent}${subPrefix}<span class="user indirect">${indirectRef.id}</span>\n`;
            });
        } else {
            // No indirect referrals for this direct referral
            const indent = isLastDirect ? '    ' : '│   ';
            treeHTML += `${indent}└── No indirect referrals\n`;
        }
    });
    
    treeContainer.innerHTML = treeHTML;
}

async function displayDashboard() {
    try {
        if (!browserWallet) {
            browserWallet = await waitForWallet();
            if (!browserWallet) { throw new Error("Wallet connection failed"); }
        }

        npByWallet = new Web3(browserWallet);    

        const data = await getUserDashboardData(currentAccount);

        // User info
        document.getElementById('userWallet').textContent = currentAccount;
        document.getElementById('userRegId').textContent = data.userId;

        // Earnings
        document.getElementById('totalEarnings').textContent = `${data.totalEarnings} BNB`;

        // Referral link
        document.getElementById('referralLink').textContent = data.referralLink;

        // Levels status
        const levelsStatusTable = document.getElementById('levelsStatus');
        levelsStatusTable.innerHTML = '';
        data.levelStatus.forEach(level => {
            const row = document.createElement('tr');
            
            const levelCell = document.createElement('td');
            levelCell.textContent = `Level ${level.level}`;
            
            const statusCell = document.createElement('td');
            const statusSpan = document.createElement('span');
            statusSpan.className = level.active ? 'status-active' : 'status-inactive';
            statusSpan.textContent = level.active ? 'Active' : 'Inactive';
            statusCell.appendChild(statusSpan);
            
            row.appendChild(levelCell);
            row.appendChild(statusCell);
            levelsStatusTable.appendChild(row);
        });

        // Levels income
        const levelsIncomeTable = document.getElementById('levelsIncome');
        levelsIncomeTable.innerHTML = '';
        data.levelIncomes.forEach(level => {
            const row = document.createElement('tr');
            const levelCell = document.createElement('td');
            levelCell.textContent = `Level ${level.levelNo}`;
            
            const incomeCell = document.createElement('td');
            incomeCell.textContent = `${level.count}`;
            
            row.appendChild(levelCell);
            row.appendChild(incomeCell);
            levelsIncomeTable.appendChild(row);
        });

        // Direct members
        const directMembersTable = document.getElementById('directMembersTable');
        const directMembersCount = document.getElementById('directMembersCount');
        directMembersTable.innerHTML = '';

        data.directReferralIds.forEach(member => {
            const row = document.createElement('tr');
            
            const idCell = document.createElement('td');
            idCell.textContent = member.id;
            
            const addressCell = document.createElement('td');
            addressCell.className = 'text-truncate';
            addressCell.style.maxWidth = '150px';
            addressCell.textContent = member.address;
            
            const dateCell = document.createElement('td');
            dateCell.textContent = new Date(member.dateJoined * 1000).toISOString().split('T')[0];
            
            row.appendChild(idCell);
            row.appendChild(addressCell);
            row.appendChild(dateCell);
            directMembersTable.appendChild(row);
        });

        directMembersCount.textContent = data.directReferrals.length;
        if (data.directReferrals.length === 0) {
            const row = document.createElement('tr');
            const cell = document.createElement('td');
            cell.colSpan = 4;
            cell.textContent = 'No direct members found';
            cell.className = 'text-center';
            row.appendChild(cell);
            directMembersTable.appendChild(row);
        }

        // Indirect members
        const indirectMembersTable = document.getElementById('indirectMembersTable');
        const indirectMembersCount = document.getElementById('indirectMembersCount');

        indirectMembersTable.innerHTML = '';
        let totalIndirectMembers = 0;

        data.indirectReferralIds.forEach(item => {

            const referredBy = item.referredBy; 
            
            item.secondLevelRefData.forEach(secondLevel => {
                totalIndirectMembers++;
                const row = document.createElement('tr');
                
                const referredByCell = document.createElement('td');
                referredByCell.textContent = referredBy;
                
                const regIdCell = document.createElement('td');
                regIdCell.textContent = secondLevel.id;
                
                const addressCell = document.createElement('td');
                addressCell.textContent = secondLevel.address;
                
                const joinDateCell = document.createElement('td');
                joinDateCell.textContent = secondLevel.dateJoined;
                
                row.appendChild(referredByCell);
                row.appendChild(regIdCell);
                row.appendChild(addressCell);
                row.appendChild(joinDateCell);
                
                indirectMembersTable.appendChild(row);
            });
        });

        indirectMembersCount.textContent = totalIndirectMembers;
        if (totalIndirectMembers === 0) {
            const row = document.createElement('tr');
            const cell = document.createElement('td');
            cell.colSpan = 4;
            cell.textContent = 'No indirect members found';
            cell.className = 'text-center';
            row.appendChild(cell);
            indirectMembersTable.appendChild(row);
        }    

        // Genealogy Tree
        displayGenealogyTree({
            userId: data.userId,
            directReferralIds: data.directReferralIds,
            indirectReferralIds: data.indirectReferralIds
        });
                
    } catch (error) {
        console.error("Error in getUserDashboardData:", error);
        throw error;
    }

}

document.addEventListener('DOMContentLoaded', async () => {
    // console.log("Ensuring wallet connection...");
    // window.dispatchEvent(new Event('eip6963:requestProvider'));

    try {
        browserWallet = await waitForWallet();
        console.log("Restored browserWallet:", browserWallet);
        await initiateWalletEvents();
    } catch (error) {
        console.error(error.message);
    }

    if (localStorage.getItem("walletReconnected") === "true") {
        console.log("Wallet reconnected successfully.");
        localStorage.removeItem("walletReconnected");
    }

    if (!IsLoggedIn()) {
        toastr.error("User is not logged in.");
        return;
    }
 
    const pageHandlers = {
        "Session": async () => {
            document.getElementById('userloginbtn').addEventListener('click', logIN);
            document.getElementById('userregisterbtn').addEventListener('click', toRegisterPage);
        },

        "Dashboard": async () => {
            await displayDashboard();
            document.getElementById('logoutBtn').addEventListener('click', userLogOut);
        },

        "Register": async () => {
            document.getElementById('walletAddress').textContent = '0X00000000000000000000000000000';
            document.getElementById('checkReferralBtn').addEventListener('click', extractReferralId);
            document.getElementById('registerOnChainBtn').addEventListener('click', registerOnchain);
        }

    };

    const currentTitle = document.title;
    if (pageHandlers[currentTitle]) { await pageHandlers[currentTitle]();}

});